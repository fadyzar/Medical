/**
 * Appointment service layer.
 *
 * Single source of truth for the write operations on appointments. Both the API
 * routes (used by the React screens) and the AI assistant's tool executors call
 * these functions — so an appointment moved by the assistant goes through exactly
 * the same authorization, state validation and audit logging as one moved by a
 * human clicking a button.
 *
 * Every function here takes the *caller's* identity and re-derives their
 * permissions from the database. Nothing about who the caller is, what they may
 * do, or which appointment they may touch is ever taken from the request body.
 */

import { createServiceRole } from '@/lib/supabase/server'
import { APP_TIMEZONE } from '@/lib/utils'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

export type CallerRole = 'patient' | 'doctor' | 'staff' | 'admin'

export type Caller = {
  id: string
  role: CallerRole
  organizationId: string | null
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

const TERMINAL_STATUSES = [
  'completed', 'cancelled_patient', 'cancelled_doctor',
  'no_show_patient', 'no_show_doctor',
]

/** Slot granularity used across booking, availability and conflict checks. */
export const SLOT_MINUTES = 30

/**
 * Loads the caller's own profile. Uses the service role deliberately: the caller
 * must be resolvable even when RLS would hide the row, and the value is never
 * taken from the client.
 */
export async function resolveCaller(userId: string): Promise<Caller | null> {
  const admin = createServiceRole()
  const { data } = await admin
    .from('users').select('id, role, organization_id').eq('id', userId).single()
  const row = data as { id: string; role: CallerRole; organization_id: string | null } | null
  if (!row) return null
  return { id: row.id, role: row.role, organizationId: row.organization_id }
}

type AppointmentRow = {
  id: string
  organization_id: string
  patient_id: string
  doctor_id: string | null
  status: string
  scheduled_at: string | null
  duration_minutes: number | null
  chief_complaint: string | null
  payment_status: string | null
}

const APT_FIELDS = 'id, organization_id, patient_id, doctor_id, status, scheduled_at, duration_minutes, chief_complaint, payment_status'

/**
 * Can this caller act on this appointment?
 *
 * Patient  — only their own.
 * Doctor   — only appointments assigned to them.
 * Staff/admin — any appointment inside their own organization.
 */
export function canAccessAppointment(caller: Caller, apt: AppointmentRow): boolean {
  switch (caller.role) {
    case 'patient': return apt.patient_id === caller.id
    case 'doctor':  return apt.doctor_id === caller.id
    case 'staff':
    case 'admin':   return !!caller.organizationId && apt.organization_id === caller.organizationId
    default:        return false
  }
}

async function loadAppointment(appointmentId: string): Promise<AppointmentRow | null> {
  const admin = createServiceRole()
  const { data } = await admin.from('appointments').select(APT_FIELDS).eq('id', appointmentId).single()
  return (data as AppointmentRow | null) ?? null
}

/**
 * Is `doctorId` free at `whenIso`?
 *
 * Checked server-side on every write. The client's view of free slots can be
 * seconds out of date, and the unique index added in migration 019 is the last
 * line of defence — this produces a readable error before we reach it.
 */
export async function findSlotConflict(
  doctorId: string,
  whenIso: string,
  durationMinutes: number,
  excludeAppointmentId?: string,
): Promise<{ conflictId: string } | null> {
  const admin = createServiceRole()
  const start = new Date(whenIso).getTime()
  const end = start + durationMinutes * 60_000

  // Widen the window by the longest plausible appointment so an existing booking
  // that *starts* before this one but overlaps it is still caught.
  const windowStart = new Date(start - 4 * 60 * 60_000).toISOString()
  const windowEnd = new Date(end + 4 * 60 * 60_000).toISOString()

  const { data } = await admin
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('doctor_id', doctorId)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  for (const row of (data || []) as Array<{ id: string; scheduled_at: string; duration_minutes: number | null; status: string }>) {
    if (excludeAppointmentId && row.id === excludeAppointmentId) continue
    if (TERMINAL_STATUSES.includes(row.status) || row.status === 'draft') continue
    const otherStart = new Date(row.scheduled_at).getTime()
    const otherEnd = otherStart + (row.duration_minutes || SLOT_MINUTES) * 60_000
    if (start < otherEnd && otherStart < end) return { conflictId: row.id }
  }
  return null
}

async function writeAudit(params: {
  organizationId: string
  userId: string
  action: string
  appointmentId: string
  description: string
  metadata: Record<string, unknown>
}) {
  try {
    const admin = createServiceRole()
    await admin.from('audit_logs').insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      action: params.action,
      resource_type: 'appointment',
      resource_id: params.appointmentId,
      description: params.description,
      metadata: params.metadata,
    })
  } catch { /* audit is best-effort — never fail the operation on it */ }
}

/**
 * Move an appointment to a new time.
 *
 * Who may do it, and what it means:
 *   staff / admin / doctor — reschedules directly; the appointment becomes
 *                            `scheduled` and the patient is notified.
 *   patient                — cannot impose a time on a clinic. Their request
 *                            resets the appointment to `pending` with the
 *                            requested time attached, for the clinic to accept.
 */
export async function rescheduleAppointment(params: {
  caller: Caller
  appointmentId: string
  scheduledAt: string
  durationMinutes?: number
  reason?: string
}): Promise<ServiceResult<{ status: string; scheduledAt: string; isRequest: boolean }>> {
  const { caller, appointmentId, scheduledAt } = params

  const when = new Date(scheduledAt)
  if (Number.isNaN(when.getTime())) {
    return { ok: false, status: 400, error: 'מועד לא תקין' }
  }
  if (when.getTime() < Date.now()) {
    return { ok: false, status: 400, error: 'לא ניתן לקבוע תור בעבר' }
  }

  const apt = await loadAppointment(appointmentId)
  if (!apt) return { ok: false, status: 404, error: 'התור לא נמצא' }
  if (!canAccessAppointment(caller, apt)) return { ok: false, status: 403, error: 'אין הרשאה לתור הזה' }
  if (TERMINAL_STATUSES.includes(apt.status)) {
    return { ok: false, status: 409, error: 'התור כבר אינו פעיל ולא ניתן להזיז אותו' }
  }

  const duration = params.durationMinutes ?? apt.duration_minutes ?? SLOT_MINUTES

  if (apt.doctor_id) {
    const conflict = await findSlotConflict(apt.doctor_id, when.toISOString(), duration, apt.id)
    if (conflict) {
      return { ok: false, status: 409, error: 'לרופא כבר יש תור אחר במועד הזה' }
    }
  }

  const isPatient = caller.role === 'patient'
  const admin = createServiceRole()

  // A patient asks; the clinic decides. Anyone else sets the time outright.
  const updates: Record<string, unknown> = isPatient
    ? {
        scheduled_at: when.toISOString(),
        duration_minutes: duration,
        status: 'pending',
        doctor_proposed_at: null,
        patient_confirmed_proposed_at: null,
      }
    : {
        scheduled_at: when.toISOString(),
        duration_minutes: duration,
        status: 'scheduled',
        doctor_proposed_at: new Date().toISOString(),
        patient_confirmed_proposed_at: null,
      }

  const { error } = await admin.from('appointments').update(updates).eq('id', appointmentId)
  if (error) {
    // 23505 = appointments_doctor_slot_unique (migration 019) — lost a race.
    if (error.code === '23505') {
      return { ok: false, status: 409, error: 'המועד נתפס זה עתה. בחר מועד אחר.' }
    }
    console.error('[reschedule]', error.message)
    return { ok: false, status: 500, error: 'שגיאה בעדכון התור' }
  }

  await writeAudit({
    organizationId: apt.organization_id,
    userId: caller.id,
    action: 'APPOINTMENT_RESCHEDULED',
    appointmentId,
    description: isPatient ? 'המטופל ביקש מועד אחר' : 'המרפאה שינתה את מועד התור',
    metadata: {
      by_role: caller.role,
      from: apt.scheduled_at,
      to: when.toISOString(),
      reason: params.reason?.slice(0, 500) || null,
    },
  })

  return {
    ok: true,
    data: { status: updates.status as string, scheduledAt: when.toISOString(), isRequest: isPatient },
  }
}

/**
 * Cancel an appointment. Never a hard delete — medical history is preserved by
 * moving the row to a terminal status.
 */
export async function cancelAppointment(params: {
  caller: Caller
  appointmentId: string
  reason?: string
}): Promise<ServiceResult<{ status: string }>> {
  const { caller, appointmentId } = params

  const apt = await loadAppointment(appointmentId)
  if (!apt) return { ok: false, status: 404, error: 'התור לא נמצא' }
  if (!canAccessAppointment(caller, apt)) return { ok: false, status: 403, error: 'אין הרשאה לתור הזה' }
  if (TERMINAL_STATUSES.includes(apt.status)) {
    return { ok: false, status: 409, error: 'התור כבר אינו פעיל' }
  }

  const isPatientOwner = caller.role === 'patient' && apt.patient_id === caller.id
  const newStatus = isPatientOwner ? 'cancelled_patient' : 'cancelled_doctor'
  const reason = params.reason?.trim().slice(0, 500) || null

  const admin = createServiceRole()
  const { error } = await admin.from('appointments').update({
    status: newStatus,
    cancelled_at: new Date().toISOString(),
    cancelled_by: caller.id,
    cancellation_reason: reason,
  }).eq('id', appointmentId)

  if (error) {
    console.error('[cancel]', error.message)
    return { ok: false, status: 500, error: 'שגיאה בביטול התור' }
  }

  await writeAudit({
    organizationId: apt.organization_id,
    userId: caller.id,
    action: 'APPOINTMENT_CANCELLED',
    appointmentId,
    description: isPatientOwner ? 'המטופל ביטל תור' : 'המרפאה ביטלה תור',
    metadata: { by_role: caller.role, reason, previous_status: apt.status },
  })

  return { ok: true, data: { status: newStatus } }
}

/** Israel-local day key, so "today" means today in the clinic's timezone. */
export function israelDayKey(d: Date | string): string {
  return format(toZonedTime(new Date(d), APP_TIMEZONE), 'yyyy-MM-dd')
}
