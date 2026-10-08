import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveCaller } from '@/lib/services/appointments'
import { toolsForRole, type ToolName } from '@/lib/ai/assistant/registry'
import { executeTool, type ConfirmationCard, type UiAction } from '@/lib/ai/assistant/executors'
import { systemForRole } from '@/lib/ai/assistant/prompt'
import { describeCurrentPage } from '@/lib/ai/assistant/navigation'
import {
  loadConversation, createConversation, saveConversation, listConversations, transcriptForDisplay,
  type ConversationState,
} from '@/lib/ai/assistant/conversation'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'
import { ASSISTANT_MODEL, ASSISTANT_EFFORT, responseText } from '@/lib/ai/models'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODEL = ASSISTANT_MODEL
/** Tool rounds per user turn. Enough to look something up, check it, then act. */
const MAX_ROUNDS = 8

/** What the user sees while a tool runs. Never a tool name. */
const TOOL_STATUS: Record<ToolName, string> = {
  get_current_context: 'בודק את הפרטים שלך…',
  explain_system: 'מחפש הסבר…',
  list_appointments: 'טוען תורים…',
  get_appointment: 'טוען את פרטי התור…',
  get_today_schedule: 'בודק את היומן…',
  check_availability: 'מחפש מועדים פנויים…',
  list_doctors: 'מחפש רופאים…',
  find_patients: 'מחפש מטופלים…',
  book_appointment: 'מכין את קביעת התור לאישורך…',
  reschedule_appointment: 'מכין את שינוי המועד לאישורך…',
  cancel_appointment: 'מכין את הביטול לאישורך…',
  navigate_to: 'מאתר את העמוד…',
  get_clinic_status: 'בודק את מצב המרפאה…',
  get_clinic_report: 'מחשב נתונים…',
  list_my_documents: 'טוען את המסמכים שלך…',
  invite_member: 'מכין את ההזמנה לאישורך…',
  generate_visit_summary: 'מכין את הבקשה לאישורך…',
}

const bodySchema = z.object({
  message: z.string().min(1, 'הודעה ריקה').max(4000),
  conversationId: z.string().uuid().nullable().optional(),
  /** The pathname the user is on. Only ever matched against the page allowlist. */
  page: z.string().max(200).optional(),
})

/**
 * GET — the conversation list for the history panel, or (?id=) one
 * conversation's visible transcript so a reopened thread shows its messages.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Bad id' }, { status: 400 })
    // loadConversation pins on user_id: another user's thread is a 404.
    const convo = await loadConversation(id, user.id)
    if (!convo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ messages: transcriptForDisplay(convo.messages) })
  }
  return NextResponse.json({ conversations: await listConversations(user.id) })
}

type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'done'; conversationId: string; reply: string; confirmation: Omit<ConfirmationCard, 'payload' | 'tool'> | null; actions: UiAction[] }
  | { type: 'error'; error: string }

/**
 * POST — one user turn, streamed as NDJSON so the panel shows what is happening
 * ("checking the calendar…") instead of a silent spinner.
 *
 * Runs the tool loop until Claude produces a final answer, or until it asks for
 * a write. Read tools execute immediately; a write tool returns a confirmation
 * card and the loop STOPS there. Nothing is written until the user confirms via
 * /api/ai/assistant/confirm.
 *
 * Failures before the stream starts (auth, rate limit, validation) are plain
 * JSON with an HTTP status.
 */
export async function POST(req: Request) {
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400 })
  }

  // Role and organization come from the database, never from the request.
  const caller = await resolveCaller(user.id)
  if (!caller) return NextResponse.json({ error: 'פרופיל לא נמצא' }, { status: 404 })
  if (!caller.organizationId) {
    return NextResponse.json({ error: 'המשתמש אינו משויך למרפאה' }, { status: 403 })
  }
  const organizationId = caller.organizationId

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
      try {
        const existing = await loadConversation(parsed.data.conversationId ?? null, user.id)
        const conversationId = existing?.id ?? await createConversation(user.id, organizationId)
        const state: ConversationState = existing?.result ?? {}

        // The page is described from the allowlist only; a raw client string never reaches the model.
        const pageLabel = describeCurrentPage(caller.role, parsed.data.page)
        const userText = pageLabel
          ? `[העמוד הנוכחי: ${pageLabel}]\n${parsed.data.message}`
          : parsed.data.message

        const messages: Anthropic.MessageParam[] = [
          ...(existing?.messages ?? []),
          { role: 'user', content: userText },
        ]

        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        // Built from the authenticated role — a tool this user may not use is never
        // described to the model in the first place.
        const tools = toolsForRole(caller.role)
        const system: Anthropic.TextBlockParam[] = [
          { type: 'text', text: systemForRole(caller.role), cache_control: { type: 'ephemeral' } },
        ]

        let pendingCard: ConfirmationCard | null = null
        const actions: UiAction[] = []
        // Every text block of the turn, in order. The model often writes the
        // substance of its answer in the same round as a tool call (e.g. the
        // WhatsApp setup steps + the navigation button), then adds a short note
        // in the last round — keeping only the last text dropped the answer.
        const replyParts: string[] = []
        let inputTokens = 0
        let outputTokens = 0

        for (let round = 0; round < MAX_ROUNDS; round++) {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 8192,
            output_config: { effort: ASSISTANT_EFFORT },
            system,
            tools,
            messages,
          })

          inputTokens += response.usage.input_tokens
          outputTokens += response.usage.output_tokens
          messages.push({ role: 'assistant', content: response.content })

          if (response.stop_reason === 'refusal') {
            replyParts.push('אני לא יכול לעזור בבקשה הזו. נסה לנסח אותה אחרת.')
            break
          }

          const text = responseText(response)
          if (text) replyParts.push(text)

          if (response.stop_reason !== 'tool_use') break

          const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          if (toolUses.length === 0) break

          // All results for one assistant turn go back in a SINGLE user message —
          // splitting them teaches the model to stop calling tools in parallel.
          const results: Anthropic.ToolResultBlockParam[] = []

          for (const call of toolUses) {
            send({ type: 'status', text: TOOL_STATUS[call.name as ToolName] ?? 'עובד על זה…' })
            const args = (call.input ?? {}) as Record<string, unknown>
            const outcome = await executeTool(caller, call.name, args)

            if (outcome.kind === 'confirmation') {
              // A write. Do not execute — park it and tell the model it is pending,
              // so its closing sentence says "waiting for your confirmation" rather
              // than claiming the job is done. One pending write at a time.
              if (pendingCard) {
                results.push({
                  type: 'tool_result', tool_use_id: call.id, is_error: true,
                  content: JSON.stringify({ error: 'רק פעולה אחת יכולה להמתין לאישור בכל פעם.' }),
                })
                continue
              }
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
              if (outcome.ui && !actions.some(a => a.href === outcome.ui!.href)) actions.push(outcome.ui)
              results.push({
                type: 'tool_result',
                tool_use_id: call.id,
                content: JSON.stringify(outcome.result),
              })
            }
          }

          messages.push({ role: 'user', content: results })

          if (pendingCard) {
            send({ type: 'status', text: 'מנסח…' })
            const closing = await client.messages.create({
              model: MODEL,
              max_tokens: 2048,
              output_config: { effort: ASSISTANT_EFFORT },
              system,
              tools,
              tool_choice: { type: 'none' },
              messages,
            })
            inputTokens += closing.usage.input_tokens
            outputTokens += closing.usage.output_tokens
            messages.push({ role: 'assistant', content: closing.content })
            const closingText = responseText(closing)
            if (closingText) replyParts.push(closingText)
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

        send({
          type: 'done',
          conversationId,
          reply: replyParts.join('\n\n') || 'לא הצלחתי לנסח תשובה. נסה לנסח מחדש.',
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
          actions,
        })
      } catch (err) {
        let message = 'שגיאה פנימית'
        if (err instanceof Anthropic.RateLimitError) message = 'העוזר עמוס כרגע. נסה שוב בעוד רגע.'
        else if (err instanceof Anthropic.APIError) {
          console.error('[assistant] anthropic', err.status, err.message)
          message = 'שגיאה בשירות ה-AI. נסה שוב.'
        } else {
          console.error('[assistant]', err instanceof Error ? err.message : err)
        }
        send({ type: 'error', error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
