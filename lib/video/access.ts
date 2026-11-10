/**
 * Who may enter a video consultation, and when. Pure — the caller supplies the
 * appointment, the user and the trusted server clock — so the policy is unit-
 * testable at the exact boundaries. Enforced by /api/video/access (waiting
 * room) and /api/livekit/token (the only place a LiveKit token is minted).
 *
 * Policy for an appointment at 14:00 lasting 30 minutes:
 *   before 13:45            denied (too early)
 *   13:45 – 14:00           waiting room only (no LiveKit token yet)
 *   14:00 – 14:30           consultation open: token issued (late entry is
 *                           allowed until the scheduled end)
 *   14:30 – 15:00           rejoin only while the consultation is in progress
 *                           (overrun); a confirmed-but-never-started visit is
 *                           over at 14:30
 *   after 15:00             denied (old appointment)
 * Only `confirmed` (doctor-approved) appointments, or one already in progress
 * that was approved, qualify. Pending, rejected, cancelled, completed, no-show
 * and legacy unapproved statuses never do.
 */

export const WAITING_ROOM_OPENS_MIN = 15
export const OVERRUN_MAX_MIN = 30
/** LiveKit tokens only need to live long enough to connect; the SFU refreshes
 *  them for connected participants. */
export const TOKEN_TTL_SECONDS = 10 * 60
const DEFAULT_DURATION_MIN = 30

export type VideoAppointment = {
  id: string
  organization_id: string
  patient_id: string
  doctor_id: string | null
  status: string
  scheduled_at: string | null
  duration_minutes: number | null
  approved_at: string | null
  appointment_type?: string | null
}

export type VideoUser = {
  id: string
  role: string
  organization_id: string | null
}

export type VideoDenyCode =
  | 'not_participant'
  | 'wrong_clinic'
  | 'not_confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'no_time'
  | 'too_early'
  | 'ended'

export type VideoAccess =
  | {
      allowed: true
      phase: 'waiting_room' | 'open'
      role: 'patient' | 'doctor'
      opensAt: string
      startsAt: string
      closesAt: string
      /** Seconds until the token may be issued (0 when open). */
      secondsToStart: number
    }
  | {
      allowed: false
      code: VideoDenyCode
      opensAt?: string
      startsAt?: string
      closesAt?: string
    }

const CANCELLED = new Set(['cancelled_patient', 'cancelled_doctor', 'cancelled_admin', 'no_show_patient', 'no_show_doctor'])

export function evaluateVideoAccess(params: {
  apt: VideoAppointment
  user: VideoUser
  now: Date
  /** Clinic of the site the request came from, when it is a clinic site. */
  tenantOrgId?: string | null
}): VideoAccess {
  const { apt, user, now, tenantOrgId } = params

  const role: 'patient' | 'doctor' | null =
    user.id === apt.patient_id ? 'patient'
    : apt.doctor_id && user.id === apt.doctor_id && user.role === 'doctor' ? 'doctor'
    : null
  if (!role) return { allowed: false, code: 'not_participant' }

  // Clinic isolation: the participant belongs to the appointment's clinic, and
  // a clinic's site never opens another clinic's consultation.
  if (user.organization_id !== apt.organization_id) return { allowed: false, code: 'wrong_clinic' }
  if (tenantOrgId && tenantOrgId !== apt.organization_id) return { allowed: false, code: 'wrong_clinic' }

  if (apt.status === 'rejected') return { allowed: false, code: 'rejected' }
  if (CANCELLED.has(apt.status)) return { allowed: false, code: 'cancelled' }
  if (apt.status === 'completed') return { allowed: false, code: 'completed' }
  const inProgress = apt.status === 'in_progress'
  if (!((apt.status === 'confirmed' || inProgress) && apt.approved_at)) {
    return { allowed: false, code: 'not_confirmed' }
  }
  if (!apt.scheduled_at) return { allowed: false, code: 'no_time' }

  const start = new Date(apt.scheduled_at).getTime()
  if (Number.isNaN(start)) return { allowed: false, code: 'no_time' }
  const duration = apt.duration_minutes && apt.duration_minutes > 0 ? apt.duration_minutes : DEFAULT_DURATION_MIN
  const opens = start - WAITING_ROOM_OPENS_MIN * 60_000
  const end = start + duration * 60_000
  const closes = inProgress ? end + OVERRUN_MAX_MIN * 60_000 : end
  const iso = (t: number) => new Date(t).toISOString()
  const times = { opensAt: iso(opens), startsAt: iso(start), closesAt: iso(closes) }

  const t = now.getTime()
  if (t < opens) return { allowed: false, code: 'too_early', ...times }
  if (t >= closes) return { allowed: false, code: 'ended', ...times }

  return {
    allowed: true,
    phase: t < start ? 'waiting_room' : 'open',
    role,
    ...times,
    secondsToStart: Math.max(0, Math.ceil((start - t) / 1000)),
  }
}

/** Token lifetime: short, and never past the end of the access window. */
export function tokenTtlSeconds(closesAtIso: string, now: Date): number {
  const remaining = Math.floor((new Date(closesAtIso).getTime() - now.getTime()) / 1000)
  return Math.max(60, Math.min(TOKEN_TTL_SECONDS, remaining))
}

export const VIDEO_DENY_MESSAGES: Record<VideoDenyCode, string> = {
  not_participant: 'אין לך הרשאה לשיחה זו',
  wrong_clinic: 'השיחה אינה שייכת למרפאה זו',
  not_confirmed: 'התור טרם אושר על ידי הרופא. הכניסה לשיחה תתאפשר לאחר האישור.',
  rejected: 'בקשת התור נדחתה',
  cancelled: 'התור בוטל',
  completed: 'הייעוץ כבר הסתיים',
  no_time: 'לתור לא נקבע מועד',
  too_early: `הכניסה לחדר ההמתנה נפתחת ${WAITING_ROOM_OPENS_MIN} דקות לפני מועד התור`,
  ended: 'מועד השיחה עבר',
}
