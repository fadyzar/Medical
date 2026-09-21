import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { resolveCaller, rescheduleAppointment } from '@/lib/services/appointments'
import { notify } from '@/lib/notifications'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

const schema = z.object({
  appointmentId: z.string().uuid('מזהה תור לא תקין'),
  scheduledAt: z.string().min(1, 'חסר מועד'),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  reason: z.string().max(500).optional(),
})

/**
 * POST /api/appointments/reschedule
 *
 * Moving an appointment used to be a direct `supabase.from('appointments').update()`
 * from the doctor's and patient's screens, so nothing validated the new time, nothing
 * checked for a double-booking, and nothing was audited. All of that now lives in
 * lib/services/appointments, which this route and the AI assistant both call.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`reschedule:${user.id}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400 })
    }

    const caller = await resolveCaller(user.id)
    if (!caller) return NextResponse.json({ error: 'פרופיל לא נמצא' }, { status: 404 })

    const result = await rescheduleAppointment({ caller, ...parsed.data })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    // Tell the other side. Best-effort: a failed email must not undo the move.
    try {
      await notify(
        result.data.isRequest ? 'appointment_created' : 'appointment_scheduled',
        parsed.data.appointmentId,
        createServiceRole(),
      )
    } catch { /* notification is best-effort */ }

    return NextResponse.json({ ok: true, ...result.data })
  } catch (err) {
    console.error('[appointments/reschedule]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
