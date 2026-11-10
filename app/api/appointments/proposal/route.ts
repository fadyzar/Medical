import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

const schema = z.object({
  appointmentId: z.string().uuid('מזהה תור לא תקין'),
  decision: z.enum(['accept', 'reject']),
})

/**
 * POST /api/appointments/proposal — the patient accepts or declines a time the
 * doctor proposed.
 *
 * This used to be a direct client update, but RLS only lets patients update
 * appointments that are still pending payment, and a doctor's proposal is
 * usually made on an appointment that is already paid and scheduled. The update
 * matched no rows, no error surfaced, and the screen showed the time as accepted.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`proposal:${user.id}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400 })
    }
    const { appointmentId, decision } = parsed.data

    const admin = createServiceRole()
    const { data: apt } = await admin.from('appointments')
      .select('id, patient_id, organization_id, status, scheduled_at, doctor_proposed_at, patient_confirmed_proposed_at, payment_collection')
      .eq('id', appointmentId)
      .maybeSingle()

    if (!apt || apt.patient_id !== user.id) {
      return NextResponse.json({ error: 'התור לא נמצא' }, { status: 404 })
    }
    if (!apt.doctor_proposed_at || apt.patient_confirmed_proposed_at) {
      return NextResponse.json({ error: 'אין הצעת מועד ממתינה לתור זה' }, { status: 409 })
    }
    if (['in_progress', 'completed', 'cancelled_patient', 'cancelled_doctor', 'cancelled_admin', 'no_show_patient', 'no_show_doctor', 'rejected'].includes(apt.status)) {
      return NextResponse.json({ error: 'התור אינו פעיל' }, { status: 409 })
    }

    // Approval lifecycle bookings: accepting a proposed time never confirms by
    // itself — a booking that is not confirmed yet waits for the doctor's
    // approval (and one awaiting payment keeps waiting for it).
    const lifecycle = !!apt.payment_collection
    const keep = apt.status === 'payment_pending' || apt.status === 'confirmed'
    const updates: Record<string, unknown> = decision === 'accept'
      ? { patient_confirmed_proposed_at: new Date().toISOString(),
          status: lifecycle ? (keep ? apt.status : 'pending_approval') : 'scheduled' }
      : { scheduled_at: null, doctor_proposed_at: null, patient_confirmed_proposed_at: null,
          status: lifecycle ? (apt.status === 'payment_pending' ? 'payment_pending' : 'pending_approval') : 'pending',
          ...(lifecycle ? { approved_at: null, approved_by: null } : {}) }

    const { error } = await admin.from('appointments').update(updates).eq('id', appointmentId)
    if (error) {
      console.error('[appointments/proposal]', error.message)
      return NextResponse.json({ error: 'שמירת התשובה נכשלה' }, { status: 500 })
    }

    await admin.from('audit_logs').insert({
      organization_id: apt.organization_id,
      user_id: user.id,
      action: decision === 'accept' ? 'APPOINTMENT_PROPOSAL_ACCEPTED' : 'APPOINTMENT_PROPOSAL_DECLINED',
      resource_type: 'appointment',
      resource_id: appointmentId,
      description: decision === 'accept' ? 'המטופל אישר את המועד שהרופא הציע' : 'המטופל דחה את המועד שהרופא הציע',
      metadata: { proposed_at: apt.scheduled_at },
    })

    return NextResponse.json({ ok: true, updates })
  } catch (err) {
    console.error('[appointments/proposal]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
