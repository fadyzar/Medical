/**
 * Builds the clinical context for a consultation summary from authorized,
 * relevant data only. Each block records who authored it, so the summary can
 * tell patient-reported information from the clinician's findings.
 *
 * Deliberately excluded: the patient's name, ID number, phone, email and
 * insurance; earlier AI outputs (triage, previous summaries, documents) — the
 * model must not summarise its own guesses; staff internal notes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClinicalContext, ContextBlock, SourceKey } from './types'

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

interface AptRow {
  id: string
  organization_id: string
  patient_id: string
  doctor_id: string | null
  chief_complaint: string | null
  complaint_description: string | null
  requested_specialty: string | null
  subjective_notes: string | null
  objective_notes: string | null
  assessment: string | null
  plan: string | null
  diagnosis: string | null
  treatment_plan: string | null
  medications_prescribed: Json
  follow_up_instructions: string | null
  video_duration_seconds: number | null
}

const SPECIALTY_HE: Record<string, string> = {
  general: 'רפואה כללית', family: 'רפואת משפחה', pediatrics: 'רפואת ילדים', dermatology: 'עור',
  cardiology: 'קרדיולוגיה', psychiatry: 'פסיכיאטריה', orthopedics: 'אורתופדיה', gynecology: 'נשים',
}

function list(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => (typeof x === 'string' ? x : x && typeof x === 'object' ? Object.values(x).filter(Boolean).join(' ') : String(x ?? '')))
    .map(s => s.trim()).filter(Boolean)
}

function age(dob: string | null): number | undefined {
  if (!dob) return undefined
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return undefined
  return Math.floor((Date.now() - d.getTime()) / 31557600000)
}

export interface BuiltContext {
  context: ClinicalContext
  appointment: AptRow
  /** Counts per source for the version record (no clinical text). */
  sources: Record<string, unknown>
}

export async function buildClinicalContext(admin: SupabaseClient, appointmentId: string): Promise<BuiltContext | null> {
  const { data: aptData } = await admin.from('appointments')
    .select('id, organization_id, patient_id, doctor_id, chief_complaint, complaint_description, requested_specialty, subjective_notes, objective_notes, assessment, plan, diagnosis, treatment_plan, medications_prescribed, follow_up_instructions, video_duration_seconds')
    .eq('id', appointmentId).single()
  const apt = aptData as AptRow | null
  if (!apt) return null

  const [{ data: patient }, { data: responses }, { data: transcript }] = await Promise.all([
    admin.from('users').select('date_of_birth, gender, medical_history').eq('id', apt.patient_id).single(),
    admin.from('questionnaire_responses')
      .select('responses, completed_at, questionnaire:questionnaire_id(title, questions)')
      .eq('appointment_id', appointmentId).eq('is_complete', true)
      .order('completed_at', { ascending: true }),
    admin.from('consultation_transcripts')
      .select('status, segments, doctor_consent_at, patient_consent_at')
      .eq('appointment_id', appointmentId).maybeSingle(),
  ])

  const blocks: ContextBlock[] = []
  const empty: SourceKey[] = []

  // 1. Booking — the patient's own words when booking.
  const booking: string[] = []
  if (apt.chief_complaint) booking.push(`סיבת הפנייה: ${apt.chief_complaint}`)
  if (apt.complaint_description) booking.push(`תיאור המטופל: ${apt.complaint_description}`)
  if (apt.requested_specialty) booking.push(`תחום מבוקש: ${SPECIALTY_HE[apt.requested_specialty] ?? apt.requested_specialty}`)
  if (booking.length) blocks.push({ key: 'booking', label: 'הזמנת התור — דיווח המטופל', author: 'patient', lines: booking })
  else empty.push('booking')

  // 2. Medical history — entered by the patient in their profile.
  const mh = ((patient as { medical_history?: Record<string, unknown> } | null)?.medical_history || {}) as Record<string, unknown>
  const history: string[] = []
  const conditions = list(mh.chronic_conditions), meds = list(mh.current_medications)
  const allergies = list(mh.allergies), surgeries = list(mh.past_surgeries)
  if (conditions.length) history.push(`מחלות רקע: ${conditions.join('; ')}`)
  if (meds.length) history.push(`תרופות קבועות: ${meds.join('; ')}`)
  if (allergies.length) history.push(`אלרגיות: ${allergies.join('; ')}`)
  if (surgeries.length) history.push(`ניתוחים בעבר: ${surgeries.join('; ')}`)
  if (history.length) blocks.push({ key: 'history', label: 'היסטוריה רפואית — דיווח המטופל', author: 'patient', lines: history })
  else empty.push('history')

  // 3. Intake questionnaire answers for this appointment.
  type QR = { responses: Record<string, unknown> | null; questionnaire: { title: string; questions: { id: string; text: string }[] } | null }
  const intake: string[] = []
  for (const r of ((responses || []) as unknown as QR[])) {
    const questions = r.questionnaire?.questions || []
    for (const [qid, answer] of Object.entries(r.responses || {})) {
      if (answer == null || answer === '' || typeof answer === 'object') continue
      const q = questions.find(x => x.id === qid)
      intake.push(`${q?.text ?? 'שאלה'} — ${String(answer)}`)
    }
  }
  if (intake.length) blocks.push({ key: 'intake', label: 'שאלון קליטה — תשובות המטופל', author: 'patient', lines: intake })
  else empty.push('intake')

  // 4. The doctor's own notes for this consultation.
  const notes: string[] = []
  if (apt.subjective_notes) notes.push(`סובייקטיבי (רופא): ${apt.subjective_notes}`)
  if (apt.objective_notes) notes.push(`ממצאים (רופא): ${apt.objective_notes}`)
  if (apt.assessment) notes.push(`הערכה (רופא): ${apt.assessment}`)
  if (apt.diagnosis) notes.push(`אבחנה (רופא): ${apt.diagnosis}`)
  if (apt.plan) notes.push(`תוכנית (רופא): ${apt.plan}`)
  if (apt.treatment_plan) notes.push(`טיפול (רופא): ${apt.treatment_plan}`)
  const rx = list(apt.medications_prescribed)
  if (rx.length) notes.push(`תרופות שנרשמו (רופא): ${rx.join('; ')}`)
  if (apt.follow_up_instructions) notes.push(`הנחיות מעקב (רופא): ${apt.follow_up_instructions}`)
  if (notes.length) blocks.push({ key: 'clinician_notes', label: 'הערות הרופא לייעוץ', author: 'clinician', lines: notes })
  else empty.push('clinician_notes')

  // 5. Transcript — only a completed transcript both sides consented to.
  type Seg = { speaker: 'doctor' | 'patient'; text: string; start?: number }
  const t = transcript as { status: string; segments: Seg[] | null; doctor_consent_at: string | null; patient_consent_at: string | null } | null
  const segs = t && t.status === 'completed' && t.doctor_consent_at && t.patient_consent_at ? (t.segments || []) : []
  const lines = segs.filter(s => s.text?.trim()).map(s => `${s.speaker === 'doctor' ? 'רופא' : 'מטופל'}: ${s.text.trim()}`)
  if (lines.length) blocks.push({ key: 'transcript', label: 'תמלול השיחה (בהסכמת הרופא והמטופל)', author: 'conversation', lines })
  else empty.push('transcript')

  const p = patient as { date_of_birth: string | null; gender: string | null } | null
  const sex = p?.gender === 'male' || p?.gender === 'female' || p?.gender === 'other' ? p.gender : undefined

  return {
    appointment: apt,
    context: {
      blocks,
      demographics: { age: age(p?.date_of_birth ?? null), sex },
      durationMinutes: apt.video_duration_seconds ? Math.max(1, Math.round(apt.video_duration_seconds / 60)) : undefined,
      empty,
    },
    sources: Object.fromEntries([
      ...blocks.map(b => [b.key, { included: true, lines: b.lines.length }]),
      ...empty.map(k => [k, { included: false }]),
      ['transcript_status', t?.status ?? 'none'],
    ]),
  }
}
