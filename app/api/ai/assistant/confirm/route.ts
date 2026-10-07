import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { runConfirmedAction } from '@/lib/ai/assistant/executors'
import {
  loadConversation, saveConversation, PENDING_ACTION_TTL_MS,
  type ConversationState,
} from '@/lib/ai/assistant/conversation'
import { notify, notifyBooking, notifyCancellation } from '@/lib/notifications'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'
import { ASSISTANT_MODEL } from '@/lib/ai/models'

export const dynamic = 'force-dynamic'

const schema = z.object({
  conversationId: z.string().uuid(),
  actionId: z.string().min(1),
  decision: z.enum(['confirm', 'cancel']),
})

/**
 * POST /api/ai/assistant/confirm
 *
 * The only place the assistant's write actions actually run.
 *
 * The client sends an opaque action id and nothing else. The action's real
 * arguments were stored server-side when the card was created, so the browser
 * cannot swap the appointment, the time or the patient between seeing the card
 * and pressing the button.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`assistant-confirm:${user.id}`, { maxRequests: 40, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'נתונים לא תקינים' }, { status: 400 })
    }
    const { conversationId, actionId, decision } = parsed.data

    // loadConversation pins on user_id — another user's pending action is invisible.
    const convo = await loadConversation(conversationId, user.id)
    if (!convo) return NextResponse.json({ error: 'השיחה לא נמצאה' }, { status: 404 })

    const state: ConversationState = convo.result ?? {}
    const pending = state.pendingAction
    if (!pending || pending.card.actionId !== actionId) {
      return NextResponse.json({ error: 'הפעולה כבר טופלה או שאינה זמינה' }, { status: 409 })
    }

    const clearPending = async (messages: Anthropic.MessageParam[], memoryPatch: ConversationState['memory']) => {
      await saveConversation({
        conversationId,
        messages,
        state: { ...state, pendingAction: null, memory: { ...state.memory, ...memoryPatch } },
        inputTokens: 0,
        outputTokens: 0,
        model: ASSISTANT_MODEL,
      })
    }

    const messages = [...convo.messages]

    if (decision === 'cancel') {
      messages.push({ role: 'user', content: 'ביטלתי את הפעולה. אל תבצע אותה.' })
      messages.push({ role: 'assistant', content: 'בסדר, לא ביצעתי שום שינוי. יש עוד משהו?' })
      await clearPending(messages, {})
      return NextResponse.json({ ok: true, cancelled: true, message: 'הפעולה בוטלה. לא בוצע שום שינוי.' })
    }

    // A card built ten minutes ago may describe a slot that is no longer free.
    if (Date.now() - new Date(pending.createdAt).getTime() > PENDING_ACTION_TTL_MS) {
      await clearPending(messages, {})
      return NextResponse.json({ error: 'האישור פג תוקף. בקש את הפעולה שוב.' }, { status: 410 })
    }

    // Permissions, appointment state and slot availability are all re-checked
    // inside runConfirmedAction — not taken on trust from when the card was made.
    const result = await runConfirmedAction(user.id, pending.card.tool, pending.card.payload)

    if (!result.ok) {
      messages.push({ role: 'user', content: `אישרתי את הפעולה אבל היא נכשלה: ${result.error}` })
      await clearPending(messages, {})
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Notify the other party. Best-effort — a failed email must not look like a
    // failed booking to the user.
    try {
      const aptId = result.data.appointmentId
      if (aptId) {
        const admin = createServiceRole()
        const tool = pending.card.tool
        if (tool === 'cancel_appointment') await notifyCancellation(aptId, result.data.byPatient === true, admin)
        else if (tool === 'book_appointment') await notifyBooking(aptId, admin)
        else if (tool === 'reschedule_appointment') {
          await notify(result.data.byPatient ? 'appointment_created' : 'appointment_scheduled', aptId, admin)
        }
      }
    } catch { /* best-effort */ }

    // Record the outcome in the transcript so the next turn knows it happened.
    messages.push({ role: 'user', content: `אישרתי את הפעולה. התוצאה: ${result.data.message}` })
    messages.push({ role: 'assistant', content: result.data.message })

    await clearPending(messages, {
      lastAppointmentId: result.data.appointmentId,
      lastPatientId: typeof pending.card.payload.patientId === 'string'
        ? pending.card.payload.patientId
        : state.memory?.lastPatientId,
    })

    return NextResponse.json({
      ok: true,
      message: result.data.message,
      appointmentId: result.data.appointmentId ?? null,
    })
  } catch (err) {
    console.error('[assistant/confirm]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
