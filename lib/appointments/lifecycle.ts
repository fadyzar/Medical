/**
 * Appointment approval lifecycle (server only).
 *
 *   patient books ──► pending ──submit──► payment_pending ──verified payment──► pending_approval
 *                                    └──(no online payment)──────────────────► pending_approval
 *   pending_approval ──doctor approves──► confirmed ──video──► in_progress ──► completed
 *   pending_approval ──doctor rejects───► rejected (+ refund_status 'pending' if money was taken)
 *
 * Every transition is a conditional update (or a locked SQL function) so a
 * repeated or concurrent request cannot apply it twice; emails are sent only
 * by the request that won the transition.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRole } from '@/lib/supabase/server'
import { paymentMode, collectionFor } from '@/lib/payments/mode'
import { sendLifecycleEmail } from '@/lib/appointments/lifecycle-emails'

export type LifecycleResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code?: string }

/** Statuses a booking can be in before it enters the approval lifecycle:
 *  a new booking ('pending'), or an open request the clinic coordinated
 *  through the older scheduling screens (doctor/time assigned later). */
const SUBMITTABLE = ['pending', 'doctor_confirmed', 'time_selected', 'scheduled']

/**
 * Called once a patient's booking row exists. Sets the price from the doctor's
 * profile, decides how payment is collected, and moves the booking to
 * payment_pending (online payment first) or straight to pending_approval.
 */
export async function submitBooking(params: {
  appointmentId: string
  patientId: string
  origin?: string
  admin?: SupabaseClient
  /** Fail (instead of leaving an open request) when doctor or time is missing. */
  requireComplete?: boolean
}): Promise<LifecycleResult<{ status: string; next: 'payment' | 'awaiting_approval' | 'open_request' }>> {
  const admin = params.admin ?? createServiceRole()
  const { data } = await admin.from('appointments')
    .select('id, patient_id, doctor_id, status, scheduled_at, payment_collection, payment_status')
    .eq('id', params.appointmentId).maybeSingle()
  const apt = data as { id: string; patient_id: string; doctor_id: string | null; status: string; scheduled_at: string | null; payment_collection: string | null; payment_status: string | null } | null
  if (!apt || apt.patient_id !== params.patientId) return { ok: false, status: 404, error: 'התור לא נמצא' }

  // Already submitted: report where it stands (idempotent).
  if (apt.payment_collection) {
    if (apt.status === 'payment_pending') return { ok: true, data: { status: apt.status, next: 'payment' } }
    return { ok: true, data: { status: apt.status, next: 'awaiting_approval' } }
  }
  if (!SUBMITTABLE.includes(apt.status)) return { ok: false, status: 409, error: 'התור אינו במצב שניתן לשלוח לאישור' }
  if (!apt.doctor_id || !apt.scheduled_at) {
    // An open request (no doctor or no time yet): the clinic assigns them,
    // and the request enters the approval queue when the doctor approves.
    if (params.requireComplete) {
      return { ok: false, status: 409, error: !apt.doctor_id ? 'לתור לא משויך רופא' : 'יש לקבוע מועד לפני האישור', code: !apt.doctor_id ? 'no_doctor' : 'no_time' }
    }
    return { ok: true, data: { status: apt.status, next: 'open_request' } }
  }
  if (new Date(apt.scheduled_at).getTime() <= Date.now()) return { ok: false, status: 400, error: 'המועד שנבחר כבר עבר' }

  const { data: doc } = await admin.from('users')
    .select('consultation_price, organization_id, role').eq('id', apt.doctor_id).maybeSingle()
  const doctor = doc as { consultation_price: number | null; organization_id: string; role: string } | null
  if (!doctor || doctor.role !== 'doctor') return { ok: false, status: 400, error: 'הרופא אינו זמין' }

  const price = doctor.consultation_price && doctor.consultation_price > 0 ? doctor.consultation_price : null
  const collection = collectionFor(price, paymentMode())
  const nextStatus = collection === 'online' ? 'payment_pending' : 'pending_approval'

  const { data: updated, error } = await admin.from('appointments')
    .update({
      payment_amount: price,
      payment_collection: collection,
      payment_status: collection === 'online' ? 'pending' : null,
      status: nextStatus,
    })
    .eq('id', apt.id)
    .eq('status', apt.status as never)
    .is('payment_collection', null)
    .select('id')
  if (error) {
    console.error('[lifecycle/submit]', error.message)
    return { ok: false, status: 500, error: 'שגיאה בשליחת הבקשה' }
  }
  if (!updated?.length) {
    // Lost a race with a concurrent submit — return the winner's state.
    return submitBooking({ ...params, admin })
  }

  if (nextStatus === 'pending_approval') await notifyAwaitingApproval(apt.id, admin, params.origin)
  return { ok: true, data: { status: nextStatus, next: collection === 'online' ? 'payment' : 'awaiting_approval' } }
}

/**
 * A payment was verified server-side (signed provider webhook, or the LOCAL QA
 * simulator). Moves payment_pending → pending_approval exactly once.
 */
export async function markPaymentVerified(params: {
  appointmentId: string
  transactionId: string | null
  method?: string | null
  admin?: SupabaseClient
}): Promise<{ transitioned: boolean }> {
  const admin = params.admin ?? createServiceRole()
  const { data } = await admin.from('appointments')
    .update({
      payment_status: 'completed',
      payment_transaction_id: params.transactionId,
      payment_completed_at: new Date().toISOString(),
      payment_method: params.method ?? null,
      status: 'pending_approval',
    })
    .eq('id', params.appointmentId)
    .eq('status', 'payment_pending')
    .neq('payment_status', 'completed')
    .select('id')
  const transitioned = !!data?.length
  if (transitioned) await notifyAwaitingApproval(params.appointmentId, admin)
  return { transitioned }
}

async function notifyAwaitingApproval(appointmentId: string, admin: SupabaseClient, origin?: string) {
  await Promise.allSettled([
    sendLifecycleEmail('appointment_request_doctor', appointmentId, admin, origin),
    sendLifecycleEmail('appointment_request_received', appointmentId, admin, origin),
  ])
}

const DECISION_ERRORS: Record<string, { status: number; error: string }> = {
  not_found:            { status: 404, error: 'התור לא נמצא' },
  forbidden:            { status: 403, error: 'רק הרופא המטפל או מנהל המרפאה יכולים להחליט על התור' },
  already_confirmed:    { status: 409, error: 'התור כבר אושר' },
  already_rejected:     { status: 409, error: 'הבקשה כבר נדחתה' },
  invalid_status:       { status: 409, error: 'התור אינו ממתין לאישור' },
  no_doctor:            { status: 409, error: 'לתור לא משויך רופא' },
  no_time:              { status: 409, error: 'לתור לא נקבע מועד' },
  not_submitted:        { status: 409, error: 'הבקשה טרם הושלמה על ידי המטופל' },
  payment_not_verified: { status: 409, error: 'התשלום טרם אומת — לא ניתן לאשר' },
  invalid_duration:     { status: 400, error: 'משך לא תקין' },
  time_passed:          { status: 409, error: 'מועד התור כבר עבר' },
  conflict:             { status: 409, error: 'לרופא כבר יש תור מאושר החופף למועד זה' },
}

/** Same rule as approve_appointment(): the assigned doctor or the clinic admin. */
async function canDecide(admin: SupabaseClient, actorId: string, appointmentId: string): Promise<boolean> {
  const [{ data: a }, { data: u }] = await Promise.all([
    admin.from('appointments').select('doctor_id, organization_id').eq('id', appointmentId).maybeSingle(),
    admin.from('users').select('role, organization_id').eq('id', actorId).maybeSingle(),
  ])
  const apt = a as { doctor_id: string | null; organization_id: string } | null
  const me = u as { role: string; organization_id: string | null } | null
  if (!apt || !me) return false
  return (me.role === 'doctor' && apt.doctor_id === actorId) ||
    (me.role === 'admin' && !!me.organization_id && me.organization_id === apt.organization_id)
}

export async function decideAppointment(params: {
  appointmentId: string
  actorId: string
  decision: 'approve' | 'reject'
  reason?: string
  durationMinutes?: number
  origin?: string
}): Promise<LifecycleResult<{ status: string; refundRequired?: boolean }>> {
  const admin = createServiceRole()

  // A booking that never entered the approval queue (an open request the
  // clinic completed, or a submit call that was lost) is submitted first.
  if (params.decision === 'approve') {
    const { data: row } = await admin.from('appointments')
      .select('patient_id, doctor_id, payment_collection, status').eq('id', params.appointmentId).maybeSingle()
    const r = row as { patient_id: string; doctor_id: string | null; payment_collection: string | null; status: string } | null
    if (r && !r.payment_collection && SUBMITTABLE.includes(r.status)) {
      const auth = await canDecide(admin, params.actorId, params.appointmentId)
      if (!auth) return { ok: false, ...DECISION_ERRORS.forbidden, code: 'forbidden' }
      const sub = await submitBooking({
        appointmentId: params.appointmentId, patientId: r.patient_id, admin, origin: params.origin, requireComplete: true,
      })
      if (!sub.ok) return sub
      if (sub.data.next === 'payment') {
        return { ok: false, ...DECISION_ERRORS.payment_not_verified, code: 'payment_not_verified' }
      }
    }
  }

  const { data, error } = params.decision === 'approve'
    ? await admin.rpc('approve_appointment' as never, {
        p_appointment: params.appointmentId, p_actor: params.actorId,
        p_duration_minutes: params.durationMinutes ?? null,
      } as never)
    : await admin.rpc('reject_appointment' as never, {
        p_appointment: params.appointmentId, p_actor: params.actorId,
        p_reason: params.reason ?? null,
      } as never)

  if (error) {
    console.error('[lifecycle/decide]', error.code, error.message)
    return { ok: false, status: 500, error: 'שמירת ההחלטה נכשלה' }
  }
  const res = data as unknown as { ok: boolean; code?: string; status?: string; refund_required?: boolean }
  if (!res.ok) {
    const e = DECISION_ERRORS[res.code || ''] || { status: 409, error: 'לא ניתן לבצע את הפעולה' }
    return { ok: false, ...e, code: res.code }
  }

  if (params.decision === 'approve') {
    await sendLifecycleEmail('appointment_approved', params.appointmentId, admin, params.origin)
    return { ok: true, data: { status: 'confirmed' } }
  }

  await sendLifecycleEmail('appointment_rejected', params.appointmentId, admin, params.origin)
  if (res.refund_required) {
    await initiateRefund(params.appointmentId, params.actorId, admin, params.origin)
  }
  return { ok: true, data: { status: 'rejected', refundRequired: !!res.refund_required } }
}

/**
 * Start the refund for a rejected, paid booking.
 *
 * Tranzila is configured for immediate capture (cred_type=1) and its refund
 * API is not integrated, so no money is moved automatically: the booking is
 * flagged refund_status='pending', the clinic admin performs the refund in the
 * provider and marks it with /api/payments/refund. In the LOCAL QA simulator
 * nothing real was charged, so nothing is refunded. Never simulated in
 * production (paymentMode() cannot be 'simulated' there).
 */
async function initiateRefund(appointmentId: string, actorId: string, admin: SupabaseClient, origin?: string) {
  const { data } = await admin.from('appointments')
    .select('organization_id, payment_amount, payment_transaction_id').eq('id', appointmentId).maybeSingle()
  const apt = data as { organization_id: string; payment_amount: number | null; payment_transaction_id: string | null } | null
  if (!apt) return
  try {
    await admin.from('audit_logs').insert({
      organization_id: apt.organization_id,
      user_id: actorId,
      action: 'REFUND_REQUESTED',
      resource_type: 'appointment',
      resource_id: appointmentId,
      description: 'נפתחה בקשת החזר לאחר דחיית התור',
      metadata: { amount: apt.payment_amount, transaction_id: apt.payment_transaction_id, provider_mode: paymentMode() },
    })
  } catch { /* best-effort */ }
  await sendLifecycleEmail('appointment_refund_initiated', appointmentId, admin, origin)
}
