/**
 * Summary lifecycle rules: draft → approved → released (superseded when
 * replaced). Pure functions; the service applies them to database rows.
 */
import type { SummaryStatus } from './types'

export type SummaryAction = 'edit' | 'approve' | 'release'

export interface LifecycleRow {
  status: SummaryStatus
  appointment_doctor_id: string | null
}

export interface Actor {
  id: string
  role: string
}

export type Decision =
  | { ok: true; next: SummaryStatus; newVersion?: boolean; revokesApproval?: boolean }
  | { ok: false; code: 403 | 409 | 422; error: string }

/**
 * Only the treating doctor reviews, approves and releases. Admins, staff,
 * other doctors in the clinic and the patient cannot — whatever the UI shows.
 */
export function canReview(actor: Actor, appointmentDoctorId: string | null): boolean {
  return actor.role === 'doctor' && !!appointmentDoctorId && actor.id === appointmentDoctorId
}

export function decide(action: SummaryAction, row: LifecycleRow, actor: Actor): Decision {
  if (!canReview(actor, row.appointment_doctor_id)) {
    return { ok: false, code: 403, error: 'רק הרופא המטפל יכול לערוך, לאשר ולשחרר את הסיכום' }
  }
  switch (action) {
    case 'edit':
      if (row.status === 'draft') return { ok: true, next: 'draft' }
      // Editing an approved text withdraws the approval: it must be approved again.
      if (row.status === 'approved') return { ok: true, next: 'draft', revokesApproval: true }
      // A released text is never changed in place: the edit becomes a new draft version.
      if (row.status === 'released') return { ok: true, next: 'draft', newVersion: true }
      return { ok: false, code: 409, error: 'לא ניתן לערוך גרסה זו. צור טיוטה חדשה.' }
    case 'approve':
      if (row.status === 'draft') return { ok: true, next: 'approved' }
      if (row.status === 'approved') return { ok: false, code: 409, error: 'הסיכום כבר אושר' }
      return { ok: false, code: 409, error: 'רק טיוטה יכולה להיות מאושרת' }
    case 'release':
      if (row.status === 'approved') return { ok: true, next: 'released' }
      if (row.status === 'draft') return { ok: false, code: 409, error: 'יש לאשר את הסיכום לפני שחרורו למטופל' }
      return { ok: false, code: 409, error: 'ניתן לשחרר רק סיכום מאושר' }
  }
}

/** What the patient is shown after release — and nothing else from the version. */
export function patientView(content: { patient_summary: string; patient_instructions: string[] }, meta: {
  version: number; approvedAt: string; approvedByName: string
}) {
  return {
    summary: content.patient_summary.trim(),
    follow_up: content.patient_instructions.map(s => s.trim()).filter(Boolean),
    approved_by: meta.approvedByName,
    approved_at: meta.approvedAt,
    version: meta.version,
    reviewed_by_clinician: true,
  }
}
