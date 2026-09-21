/**
 * Tool executors.
 *
 * Every function here re-derives what the caller may see from the caller's own
 * row in the database. Nothing trusts an id, a role or an organization that came
 * from the model — Claude proposes, this file disposes.
 *
 * Read tools return data. Write tools do NOT write: they validate everything
 * they can, then hand back a confirmation card. The write itself happens in
 * `runConfirmedAction`, after the user has pressed the button.
 */

import { createServiceRole } from '@/lib/supabase/server'
import { APP_TIMEZONE, formatDateTime } from '@/lib/utils'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { addDays, format } from 'date-fns'
import {
  type Caller, type ServiceResult,
  resolveCaller, rescheduleAppointment, cancelAppointment,
  findSlotConflict, canAccessAppointment, SLOT_MINUTES,
} from '@/lib/services/appointments'
import { searchPatients } from '@/lib/services/patients'
import { assertToolAllowed, WRITE_TOOLS, type ToolName } from '@/lib/ai/assistant/registry'
import { TOPICS, type KnowledgeTopic } from '@/lib/ai/assistant/knowledge'
import type { AppointmentStatus } from '@/types/database'

/** What a write tool hands back instead of writing. Rendered as a card. */
export type ConfirmationCard = {
  actionId: string
  tool: ToolName
  title: string
  intent: 'create' | 'update' | 'destructive'
  /** Human-readable summary rows. No JSON, no tool names, ever shown to the user. */
  rows: Array<{ label: string; value: string }>
  warning?: string
  confirmLabel: string
  /** Validated arguments, replayed server-side on confirm. Never sent by the client. */
  payload: Record<string, unknown>
}

export type ToolOutcome =
  | { kind: 'data'; result: unknown }
  | { kind: 'confirmation'; card: ConfirmationCard }
  | { kind: 'error'; error: string }

const ACTIVE_STATUSES: AppointmentStatus[] = [
  'pending', 'doctor_confirmed', 'time_selected', 'payment_pending',
  'paid', 'scheduled', 'ready', 'in_progress',
]

function israelNow(): Date { return toZonedTime(new Date(), APP_TIMEZONE) }
function fmt(iso: string | null): string { return iso ? formatDateTime(iso) : 'טרם נקבע' }
function clamp(n: number | null | undefined, lo: number, hi: number, dflt: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return dflt
  return Math.min(Math.max(Math.trunc(n), lo), hi)
}

/** Appointment rows scoped to what this caller is allowed to see. */
function scopedAppointmentQuery(caller: Caller) {
  const admin = createServiceRole()
  const q = admin.from('appointments').select(
    'id, status, scheduled_at, duration_minutes, chief_complaint, payment_status, payment_amount, created_at, ' +
    'organization_id, patient_id, doctor_id, ' +
    'patient:patient_id(id, first_name, last_name, phone), ' +
    'doctor:doctor_id(id, first_name, last_name, specialties)'
  )
  switch (caller.role) {
    case 'patient': return q.eq('patient_id', caller.id)
    case 'doctor':  return q.eq('doctor_id', caller.id)
    default:        return q.eq('organization_id', caller.organizationId ?? '00000000-0000-0000-0000-000000000000')
  }
}

type AptJoin = {
  id: string; status: string; scheduled_at: string | null; duration_minutes: number | null
  chief_complaint: string | null; payment_status: string | null; payment_amount: number | null
  created_at: string; organization_id: string; patient_id: string; doctor_id: string | null
  patient: { id: string; first_name: string; last_name: string; phone: string | null } | null
  doctor: { id: string; first_name: string; last_name: string; specialties: string[] | null } | null
}

function shapeAppointment(a: AptJoin) {
  return {
    appointment_id: a.id,
    status: a.status,
    when: a.scheduled_at ? formatDateTime(a.scheduled_at) : null,
    when_iso: a.scheduled_at,
    duration_minutes: a.duration_minutes ?? SLOT_MINUTES,
    reason: a.chief_complaint,
    patient: a.patient ? { id: a.patient.id, name: `${a.patient.first_name} ${a.patient.last_name}` } : null,
    doctor: a.doctor ? { id: a.doctor.id, name: `ד"ר ${a.doctor.first_name} ${a.doctor.last_name}` } : null,
    payment_status: a.payment_status,
    payment_amount: a.payment_amount,
  }
}

// ── Read tools ───────────────────────────────────────────────────────────────

async function getCurrentContext(caller: Caller): Promise<ToolOutcome> {
  const admin = createServiceRole()
  const { data } = await admin.from('users')
    .select('first_name, last_name, email, organization_id').eq('id', caller.id).single()
  const u = data as { first_name: string; last_name: string; email: string; organization_id: string | null } | null

  let clinic: string | null = null
  if (caller.organizationId) {
    const { data: org } = await admin.from('organizations').select('name').eq('id', caller.organizationId).single()
    clinic = (org as { name: string } | null)?.name ?? null
  }

  const now = israelNow()
  return {
    kind: 'data',
    result: {
      user_name: u ? `${u.first_name} ${u.last_name}` : null,
      role: caller.role,
      clinic,
      today: format(now, 'yyyy-MM-dd'),
      now_israel: format(now, 'yyyy-MM-dd HH:mm'),
      weekday: now.getDay(), // 0 = Sunday, the Israeli work week starts here
      timezone: APP_TIMEZONE,
    },
  }
}

function explainSystem(topic: string): ToolOutcome {
  const key = (topic in TOPICS ? topic : 'overview') as KnowledgeTopic
  return { kind: 'data', result: { topic: key, explanation: TOPICS[key] } }
}

async function listAppointments(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const scope = String(args.scope ?? 'upcoming')
  const limit = clamp(args.limit as number, 1, 50, 20)
  let q = scopedAppointmentQuery(caller)

  const nowIso = new Date().toISOString()
  if (scope === 'upcoming') {
    q = q.in('status', ACTIVE_STATUSES).order('scheduled_at', { ascending: true, nullsFirst: false })
  } else if (scope === 'past') {
    q = q.lt('scheduled_at', nowIso).order('scheduled_at', { ascending: false })
  } else if (scope === 'needs_action') {
    q = q.in('status', ['pending', 'doctor_confirmed', 'payment_pending']).order('created_at', { ascending: false })
  } else {
    q = q.order('created_at', { ascending: false })
  }

  // A patient may never filter to someone else — the scope above already pins
  // them to their own rows, so this only applies to staff, admin and doctors.
  if (args.patient_id && caller.role !== 'patient') q = q.eq('patient_id', String(args.patient_id))
  if (args.from) q = q.gte('scheduled_at', new Date(String(args.from)).toISOString())
  if (args.to) q = q.lte('scheduled_at', new Date(String(args.to)).toISOString())

  const { data, error } = await q.limit(limit)
  if (error) return { kind: 'error', error: 'שגיאה בטעינת התורים' }

  return { kind: 'data', result: { appointments: ((data || []) as unknown as AptJoin[]).map(shapeAppointment) } }
}

async function getAppointment(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const id = String(args.appointment_id ?? '')
  const { data, error } = await scopedAppointmentQuery(caller).eq('id', id).maybeSingle()
  if (error) return { kind: 'error', error: 'שגיאה בטעינת התור' }
  if (!data) return { kind: 'error', error: 'התור לא נמצא, או שאין לך הרשאה אליו' }
  return { kind: 'data', result: shapeAppointment(data as unknown as AptJoin) }
}

async function getTodaySchedule(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const dayStr = args.date ? String(args.date) : format(israelNow(), 'yyyy-MM-dd')
  // Day boundaries in Israel time, converted to the instants stored in the DB.
  const dayStart = fromZonedTime(`${dayStr}T00:00:00`, APP_TIMEZONE)
  const dayEnd = fromZonedTime(`${dayStr}T23:59:59`, APP_TIMEZONE)

  let q = scopedAppointmentQuery(caller)
    .in('status', ACTIVE_STATUSES)
    .gte('scheduled_at', dayStart.toISOString())
    .lte('scheduled_at', dayEnd.toISOString())
    .order('scheduled_at', { ascending: true })

  // A doctor always sees their own day; only staff and admin may pick someone else's.
  if (args.doctor_id && (caller.role === 'staff' || caller.role === 'admin')) {
    q = q.eq('doctor_id', String(args.doctor_id))
  }

  const { data, error } = await q.limit(100)
  if (error) return { kind: 'error', error: 'שגיאה בטעינת היומן' }

  const rows = ((data || []) as unknown as AptJoin[]).map(shapeAppointment)
  return { kind: 'data', result: { date: dayStr, count: rows.length, appointments: rows } }
}

async function listDoctors(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const admin = createServiceRole()
  let q = admin.from('users')
    .select('id, first_name, last_name, specialties, consultation_price, average_rating, total_ratings, languages')
    .eq('role', 'doctor').eq('is_active', true).limit(30)

  // Everyone inside a clinic sees that clinic's doctors. A patient with no clinic
  // yet (marketplace signup) sees all bookable doctors, as the booking flow does.
  if (caller.organizationId) q = q.eq('organization_id', caller.organizationId)
  if (args.specialty) q = q.contains('specialties', [String(args.specialty)])

  const { data, error } = await q
  if (error) return { kind: 'error', error: 'שגיאה בטעינת הרופאים' }

  let rows = (data || []) as Array<{
    id: string; first_name: string; last_name: string; specialties: string[] | null
    consultation_price: number | null; average_rating: number | null; total_ratings: number; languages: string[] | null
  }>

  if (args.name) {
    const needle = String(args.name).toLowerCase()
    rows = rows.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(needle))
  }

  return {
    kind: 'data',
    result: {
      doctors: rows.map(d => ({
        doctor_id: d.id,
        name: `ד"ר ${d.first_name} ${d.last_name}`,
        specialties: d.specialties ?? [],
        price: d.consultation_price,
        rating: d.average_rating,
        languages: d.languages ?? [],
      })),
    },
  }
}

async function checkAvailability(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  if (!caller.organizationId) return { kind: 'error', error: 'המשתמש אינו משויך למרפאה' }

  const days = clamp(args.days as number, 1, 60, 14)
  const limit = clamp(args.limit as number, 1, 50, 20)
  const admin = createServiceRole()

  let dq = admin.from('users')
    .select('id, first_name, last_name, availability, metadata')
    .eq('organization_id', caller.organizationId).eq('role', 'doctor').eq('is_active', true)
  if (args.doctor_id) dq = dq.eq('id', String(args.doctor_id))

  const { data: docs } = await dq
  const doctors = (docs || []) as Array<{
    id: string; first_name: string; last_name: string
    availability: Array<{ day: number; start: string; end: string }> | null
    metadata: { vacations?: Array<{ start: string; end: string }> } | null
  }>
  if (doctors.length === 0) return { kind: 'data', result: { slots: [] } }

  const startDay = args.from ? new Date(`${String(args.from)}T00:00:00`) : israelNow()
  const rangeEnd = addDays(new Date(), days + 1)

  const { data: booked } = await admin.from('appointments')
    .select('doctor_id, scheduled_at, status')
    .in('doctor_id', doctors.map(d => d.id))
    .not('scheduled_at', 'is', null)
    .in('status', ACTIVE_STATUSES)
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', rangeEnd.toISOString())

  const taken = new Set(
    ((booked || []) as Array<{ doctor_id: string; scheduled_at: string }>).map(
      b => `${b.doctor_id}_${format(toZonedTime(new Date(b.scheduled_at), APP_TIMEZONE), 'yyyy-MM-dd_HH:mm')}`,
    ),
  )

  // Slot times are built as Israel wall-clock strings and resolved through
  // fromZonedTime, so this is correct on a UTC server.
  const earliest = Date.now() + 30 * 60_000
  const pad = (n: number) => String(n).padStart(2, '0')
  const slots: Array<{ doctor_id: string; doctor_name: string; when: string; when_iso: string }> = []

  for (let offset = 0; offset < days && slots.length < limit * doctors.length; offset++) {
    const day = addDays(startDay, offset)
    const dayStr = format(day, 'yyyy-MM-dd')
    const dow = day.getDay()

    for (const doc of doctors) {
      const vacations = doc.metadata?.vacations || []
      if (vacations.some(v => dayStr >= v.start && dayStr <= v.end)) continue
      const avail = (doc.availability || []).find(a => a.day === dow)
      if (!avail) continue

      const [sh, sm] = avail.start.split(':').map(Number)
      const [eh, em] = avail.end.split(':').map(Number)
      if ([sh, sm, eh, em].some(Number.isNaN)) continue

      for (let m = sh * 60 + sm; m < eh * 60 + em; m += SLOT_MINUTES) {
        const wall = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
        if (taken.has(`${doc.id}_${dayStr}_${wall}`)) continue
        const when = fromZonedTime(`${dayStr}T${wall}:00`, APP_TIMEZONE)
        if (when.getTime() < earliest) continue
        slots.push({
          doctor_id: doc.id,
          doctor_name: `ד"ר ${doc.first_name} ${doc.last_name}`,
          when: formatDateTime(when.toISOString()),
          when_iso: when.toISOString(),
        })
      }
    }
  }

  slots.sort((a, b) => a.when_iso.localeCompare(b.when_iso))
  return { kind: 'data', result: { slots: slots.slice(0, limit) } }
}

async function findPatients(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const res = await searchPatients({
    caller,
    query: String(args.query ?? ''),
    limit: clamp(args.limit as number, 1, 25, 10),
  })
  if (!res.ok) return { kind: 'error', error: res.error }
  return {
    kind: 'data',
    result: {
      count: res.data.length,
      patients: res.data.map(p => ({
        patient_id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        phone: p.phone,
        email: p.email,
        last_appointment: p.lastAppointmentAt ? formatDateTime(p.lastAppointmentAt) : null,
      })),
    },
  }
}

// ── Write tools: validate, then ask ──────────────────────────────────────────

function newActionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

async function prepareBooking(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const admin = createServiceRole()
  const doctorId = String(args.doctor_id ?? '')
  const whenIso = String(args.scheduled_at ?? '')
  const when = new Date(whenIso)
  if (Number.isNaN(when.getTime())) return { kind: 'error', error: 'המועד שנבחר אינו תקין' }
  if (when.getTime() < Date.now()) return { kind: 'error', error: 'לא ניתן לקבוע תור בעבר' }

  // A patient books only for themselves, whatever the model passed.
  const patientId = caller.role === 'patient' ? caller.id : String(args.patient_id ?? caller.id)

  const { data: docRow } = await admin.from('users')
    .select('id, first_name, last_name, organization_id, consultation_price')
    .eq('id', doctorId).eq('role', 'doctor').eq('is_active', true).maybeSingle()
  const doctor = docRow as { id: string; first_name: string; last_name: string; organization_id: string | null; consultation_price: number | null } | null
  if (!doctor) return { kind: 'error', error: 'הרופא לא נמצא' }

  // Staff and doctors may only book inside their own clinic.
  if (caller.role !== 'patient' && caller.organizationId && doctor.organization_id !== caller.organizationId) {
    return { kind: 'error', error: 'הרופא אינו שייך למרפאה שלך' }
  }

  const { data: patRow } = await admin.from('users')
    .select('id, first_name, last_name, organization_id, role').eq('id', patientId).maybeSingle()
  const patient = patRow as { id: string; first_name: string; last_name: string; organization_id: string | null; role: string } | null
  if (!patient || patient.role !== 'patient') return { kind: 'error', error: 'המטופל לא נמצא' }
  if (caller.role !== 'patient' && caller.organizationId && patient.organization_id !== caller.organizationId) {
    return { kind: 'error', error: 'המטופל אינו שייך למרפאה שלך' }
  }

  const conflict = await findSlotConflict(doctorId, when.toISOString(), SLOT_MINUTES)
  if (conflict) return { kind: 'error', error: 'המועד הזה כבר תפוס אצל הרופא. בחר מועד אחר.' }

  const complaint = String(args.chief_complaint ?? '').trim()
  if (!complaint) return { kind: 'error', error: 'חסרה סיבת הפנייה' }

  const rows = [
    { label: 'מטופל', value: `${patient.first_name} ${patient.last_name}` },
    { label: 'רופא', value: `ד"ר ${doctor.first_name} ${doctor.last_name}` },
    { label: 'מועד', value: fmt(when.toISOString()) },
    { label: 'סיבת הפנייה', value: complaint },
  ]
  if (doctor.consultation_price) rows.push({ label: 'עלות', value: `₪${doctor.consultation_price}` })

  return {
    kind: 'confirmation',
    card: {
      actionId: newActionId(),
      tool: 'book_appointment',
      title: 'אישור קביעת תור',
      intent: 'create',
      rows,
      warning: doctor.consultation_price ? 'לאחר האישור תועבר לתשלום.' : undefined,
      confirmLabel: 'קבע את התור',
      payload: {
        doctorId,
        patientId,
        organizationId: doctor.organization_id,
        scheduledAt: when.toISOString(),
        chiefComplaint: complaint,
        appointmentType: args.appointment_type ? String(args.appointment_type) : 'video',
        notes: args.notes ? String(args.notes) : null,
        paymentAmount: doctor.consultation_price,
      },
    },
  }
}

async function prepareReschedule(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const admin = createServiceRole()
  const id = String(args.appointment_id ?? '')
  const whenIso = String(args.scheduled_at ?? '')
  const when = new Date(whenIso)
  if (Number.isNaN(when.getTime())) return { kind: 'error', error: 'המועד שנבחר אינו תקין' }

  const { data } = await admin.from('appointments')
    .select('id, organization_id, patient_id, doctor_id, status, scheduled_at, duration_minutes, chief_complaint, payment_status')
    .eq('id', id).maybeSingle()
  const apt = data as {
    id: string; organization_id: string; patient_id: string; doctor_id: string | null
    status: string; scheduled_at: string | null; duration_minutes: number | null
    chief_complaint: string | null; payment_status: string | null
  } | null
  if (!apt) return { kind: 'error', error: 'התור לא נמצא' }
  if (!canAccessAppointment(caller, apt)) return { kind: 'error', error: 'אין לך הרשאה לתור הזה' }

  if (apt.doctor_id) {
    const conflict = await findSlotConflict(apt.doctor_id, when.toISOString(), apt.duration_minutes ?? SLOT_MINUTES, apt.id)
    if (conflict) return { kind: 'error', error: 'לרופא כבר יש תור אחר במועד הזה' }
  }

  const isRequest = caller.role === 'patient'
  return {
    kind: 'confirmation',
    card: {
      actionId: newActionId(),
      tool: 'reschedule_appointment',
      title: isRequest ? 'אישור בקשת שינוי מועד' : 'אישור שינוי מועד',
      intent: 'update',
      rows: [
        { label: 'מועד נוכחי', value: fmt(apt.scheduled_at) },
        { label: 'מועד חדש', value: fmt(when.toISOString()) },
        { label: 'סיבת הפנייה', value: apt.chief_complaint || '—' },
      ],
      warning: isRequest ? 'הבקשה תישלח למרפאה לאישור. המועד אינו סופי עד שהמרפאה תאשר.' : undefined,
      confirmLabel: isRequest ? 'שלח בקשה' : 'עדכן מועד',
      payload: { appointmentId: id, scheduledAt: when.toISOString(), reason: args.reason ? String(args.reason) : null },
    },
  }
}

async function prepareCancel(caller: Caller, args: Record<string, unknown>): Promise<ToolOutcome> {
  const admin = createServiceRole()
  const id = String(args.appointment_id ?? '')

  const { data } = await admin.from('appointments')
    .select('id, organization_id, patient_id, doctor_id, status, scheduled_at, duration_minutes, chief_complaint, payment_status')
    .eq('id', id).maybeSingle()
  const apt = data as {
    id: string; organization_id: string; patient_id: string; doctor_id: string | null
    status: string; scheduled_at: string | null; duration_minutes: number | null
    chief_complaint: string | null; payment_status: string | null
  } | null
  if (!apt) return { kind: 'error', error: 'התור לא נמצא' }
  if (!canAccessAppointment(caller, apt)) return { kind: 'error', error: 'אין לך הרשאה לתור הזה' }

  const rows = [
    { label: 'מועד', value: fmt(apt.scheduled_at) },
    { label: 'סיבת הפנייה', value: apt.chief_complaint || '—' },
  ]
  return {
    kind: 'confirmation',
    card: {
      actionId: newActionId(),
      tool: 'cancel_appointment',
      title: 'אישור ביטול תור',
      intent: 'destructive',
      rows,
      warning: apt.payment_status === 'completed'
        ? 'התור שולם. ביטול עשוי לחייב החזר כספי — צור קשר עם המרפאה.'
        : 'לא ניתן לשחזר תור שבוטל. יהיה צורך לקבוע תור חדש.',
      confirmLabel: 'בטל את התור',
      payload: { appointmentId: id, reason: args.reason ? String(args.reason) : null },
    },
  }
}

// ── Entry points ─────────────────────────────────────────────────────────────

/**
 * Runs one tool call. `assertToolAllowed` runs here too, not only when the tool
 * list is built — a hallucinated or injected tool name is rejected at the gate.
 */
export async function executeTool(
  caller: Caller,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  try {
    assertToolAllowed(caller.role, toolName)
  } catch {
    return { kind: 'error', error: 'הפעולה הזו אינה זמינה עבור המשתמש הנוכחי' }
  }

  switch (toolName as ToolName) {
    case 'get_current_context':    return getCurrentContext(caller)
    case 'explain_system':         return explainSystem(String(args.topic ?? 'overview'))
    case 'list_appointments':      return listAppointments(caller, args)
    case 'get_appointment':        return getAppointment(caller, args)
    case 'get_today_schedule':     return getTodaySchedule(caller, args)
    case 'check_availability':     return checkAvailability(caller, args)
    case 'list_doctors':           return listDoctors(caller, args)
    case 'find_patients':          return findPatients(caller, args)
    case 'book_appointment':       return prepareBooking(caller, args)
    case 'reschedule_appointment': return prepareReschedule(caller, args)
    case 'cancel_appointment':     return prepareCancel(caller, args)
    default:                       return { kind: 'error', error: 'פעולה לא מוכרת' }
  }
}

/**
 * Performs a write the user has confirmed.
 *
 * Authorization is checked from scratch here. Time passes between the card being
 * shown and the button being pressed, and the caller's permissions, the
 * appointment's status and the slot's availability can all have changed.
 */
export async function runConfirmedAction(
  userId: string,
  tool: ToolName,
  payload: Record<string, unknown>,
): Promise<ServiceResult<{ message: string; appointmentId?: string }>> {
  const caller = await resolveCaller(userId)
  if (!caller) return { ok: false, status: 404, error: 'פרופיל לא נמצא' }
  if (!WRITE_TOOLS.has(tool)) return { ok: false, status: 400, error: 'פעולה לא ניתנת לאישור' }

  try {
    assertToolAllowed(caller.role, tool)
  } catch {
    return { ok: false, status: 403, error: 'אין הרשאה לפעולה הזו' }
  }

  switch (tool) {
    case 'book_appointment': {
      const admin = createServiceRole()
      const doctorId = String(payload.doctorId)
      const patientId = caller.role === 'patient' ? caller.id : String(payload.patientId)
      const scheduledAt = String(payload.scheduledAt)

      if (new Date(scheduledAt).getTime() < Date.now()) {
        return { ok: false, status: 400, error: 'המועד כבר עבר' }
      }
      const conflict = await findSlotConflict(doctorId, scheduledAt, SLOT_MINUTES)
      if (conflict) return { ok: false, status: 409, error: 'המועד נתפס בינתיים. בחר מועד אחר.' }

      // The payload was built by prepareBooking from validated database rows,
      // but it round-trips through JSON, so re-narrow the types here.
      const organizationId = String(payload.organizationId)
      const paymentAmount = typeof payload.paymentAmount === 'number' ? payload.paymentAmount : null

      const { data, error } = await admin.from('appointments').insert({
        organization_id: organizationId,
        patient_id: patientId,
        doctor_id: doctorId,
        scheduled_at: scheduledAt,
        duration_minutes: SLOT_MINUTES,
        chief_complaint: String(payload.chiefComplaint ?? ''),
        complaint_description: payload.notes ? String(payload.notes) : null,
        appointment_type: String(payload.appointmentType ?? 'video'),
        payment_amount: paymentAmount,
        urgency_level: 'routine',
        status: caller.role === 'patient' ? 'pending' : 'scheduled',
      } as never).select('id').single()

      if (error) {
        if (error.code === '23505') return { ok: false, status: 409, error: 'המועד נתפס בינתיים. בחר מועד אחר.' }
        console.error('[assistant/book]', error.message)
        return { ok: false, status: 500, error: 'שגיאה ביצירת התור' }
      }

      const aptId = (data as { id: string }).id
      try {
        await admin.from('audit_logs').insert({
          organization_id: organizationId,
          user_id: caller.id,
          action: 'APPOINTMENT_CREATED',
          resource_type: 'appointment',
          resource_id: aptId,
          description: 'תור נוצר דרך העוזר החכם',
          metadata: { by_role: caller.role, via: 'ai_assistant' },
        })
      } catch { /* best-effort */ }

      return { ok: true, data: { message: 'התור נקבע.', appointmentId: aptId } }
    }

    case 'reschedule_appointment': {
      const res = await rescheduleAppointment({
        caller,
        appointmentId: String(payload.appointmentId),
        scheduledAt: String(payload.scheduledAt),
        reason: payload.reason ? String(payload.reason) : undefined,
      })
      if (!res.ok) return res
      return {
        ok: true,
        data: {
          message: res.data.isRequest ? 'הבקשה נשלחה למרפאה.' : 'המועד עודכן.',
          appointmentId: String(payload.appointmentId),
        },
      }
    }

    case 'cancel_appointment': {
      const res = await cancelAppointment({
        caller,
        appointmentId: String(payload.appointmentId),
        reason: payload.reason ? String(payload.reason) : undefined,
      })
      if (!res.ok) return res
      return { ok: true, data: { message: 'התור בוטל.', appointmentId: String(payload.appointmentId) } }
    }

    default:
      return { ok: false, status: 400, error: 'פעולה לא ניתנת לאישור' }
  }
}
