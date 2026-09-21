import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveCaller } from '@/lib/services/appointments'
import { toolsForRole } from '@/lib/ai/assistant/registry'
import { executeTool, type ConfirmationCard } from '@/lib/ai/assistant/executors'
import { systemForRole } from '@/lib/ai/assistant/prompt'
import {
  loadConversation, createConversation, saveConversation, listConversations,
  type ConversationState,
} from '@/lib/ai/assistant/conversation'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODEL = 'claude-opus-5'
/** Tool rounds per user turn. Enough to look something up, check it, then act. */
const MAX_ROUNDS = 8

const bodySchema = z.object({
  message: z.string().min(1, 'הודעה ריקה').max(4000),
  conversationId: z.string().uuid().nullable().optional(),
})

/** GET — the conversation list for the history panel. */
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ conversations: await listConversations(user.id) })
}

/**
 * POST — one user turn.
 *
 * Runs the tool loop until Claude produces a final answer, or until it asks for
 * a write. Read tools execute immediately; a write tool returns a confirmation
 * card and the loop STOPS there. Nothing is written until the user confirms via
 * /api/ai/assistant/confirm.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`assistant:${user.id}`, { maxRequests: 60, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'הגעת למגבלת השימוש בעוזר. נסה שוב בעוד שעה.' }, { status: 429 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'העוזר החכם אינו מוגדר במערכת' }, { status: 503 })
    }

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400 })
    }

    // Role and organization come from the database, never from the request.
    const caller = await resolveCaller(user.id)
    if (!caller) return NextResponse.json({ error: 'פרופיל לא נמצא' }, { status: 404 })
    if (!caller.organizationId) {
      return NextResponse.json({ error: 'המשתמש אינו משויך למרפאה' }, { status: 403 })
    }

    const existing = await loadConversation(parsed.data.conversationId ?? null, user.id)
    const conversationId = existing?.id ?? await createConversation(user.id, caller.organizationId)
    const state: ConversationState = existing?.result ?? {}

    const messages: Anthropic.MessageParam[] = [
      ...(existing?.messages ?? []),
      { role: 'user', content: parsed.data.message },
    ]

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    // Built from the authenticated role — a tool this user may not use is never
    // described to the model in the first place.
    const tools = toolsForRole(caller.role)

    let pendingCard: ConfirmationCard | null = null
    let finalText = ''
    let inputTokens = 0
    let outputTokens = 0

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: systemForRole(caller.role), cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      })

      inputTokens += response.usage.input_tokens
      outputTokens += response.usage.output_tokens

      messages.push({ role: 'assistant', content: response.content })

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text).join('\n').trim()
      if (text) finalText = text

      if (response.stop_reason !== 'tool_use') break

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (toolUses.length === 0) break

      // All results for one assistant turn go back in a SINGLE user message —
      // splitting them teaches the model to stop calling tools in parallel.
      const results: Anthropic.ToolResultBlockParam[] = []

      for (const call of toolUses) {
        const args = (call.input ?? {}) as Record<string, unknown>
        const outcome = await executeTool(caller, call.name, args)

        if (outcome.kind === 'confirmation') {
          // A write. Do not execute — park it and tell the model it is pending,
          // so its closing sentence says "waiting for your confirmation" rather
          // than claiming the job is done.
          pendingCard = outcome.card
          results.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify({
              status: 'awaiting_user_confirmation',
              note: 'הפעולה לא בוצעה. כרטיס אישור הוצג למשתמש וממתין לאישורו.',
            }),
          })
        } else if (outcome.kind === 'error') {
          results.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify({ error: outcome.error }),
            is_error: true,
          })
        } else {
          results.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify(outcome.result),
          })
        }
      }

      messages.push({ role: 'user', content: results })

      // One pending write at a time: let the model close the turn, then stop.
      if (pendingCard) {
        const closing = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          system: [{ type: 'text', text: systemForRole(caller.role), cache_control: { type: 'ephemeral' } }],
          tools,
          tool_choice: { type: 'none' },
          messages,
        })
        inputTokens += closing.usage.input_tokens
        outputTokens += closing.usage.output_tokens
        messages.push({ role: 'assistant', content: closing.content })
        const closingText = closing.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text).join('\n').trim()
        if (closingText) finalText = closingText
        break
      }
    }

    const nextState: ConversationState = {
      ...state,
      pendingAction: pendingCard ? { card: pendingCard, createdAt: new Date().toISOString() } : null,
    }

    await saveConversation({
      conversationId, messages, state: nextState, inputTokens, outputTokens, model: MODEL,
    })

    return NextResponse.json({
      conversationId,
      reply: finalText || 'לא הצלחתי לנסח תשובה. נסה לנסח מחדש.',
      // The card the client renders. `payload` is stripped — the browser never
      // sees or sends back what will actually be executed.
      confirmation: pendingCard
        ? {
            actionId: pendingCard.actionId,
            title: pendingCard.title,
            intent: pendingCard.intent,
            rows: pendingCard.rows,
            warning: pendingCard.warning,
            confirmLabel: pendingCard.confirmLabel,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'העוזר עמוס כרגע. נסה שוב בעוד רגע.' }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[assistant] anthropic', err.status, err.message)
      return NextResponse.json({ error: 'שגיאה בשירות ה-AI' }, { status: 502 })
    }
    console.error('[assistant]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
