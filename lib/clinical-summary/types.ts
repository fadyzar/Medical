/**
 * Clinical consultation summary — shared types. Dependency-free so node tests
 * can load the pure modules (lifecycle, grounding, prompt) directly.
 */

/** Where a piece of the summary came from. */
export type SourceKey =
  | 'booking'          // patient's booking: reason + free-text description
  | 'history'          // patient-entered medical history (conditions, meds, allergies, surgeries)
  | 'intake'           // intake questionnaire answers
  | 'clinician_notes'  // the doctor's own saved notes for this consultation
  | 'transcript'       // consented consultation transcript

/** Item provenance as the model reports it (transcript split by speaker). */
export type ItemSource =
  | 'booking' | 'history' | 'intake' | 'clinician_notes'
  | 'transcript_doctor' | 'transcript_patient'
  | 'clinician_edit'   // written or changed by the doctor in the review screen

export type Author = 'patient' | 'clinician' | 'conversation'

export interface ContextBlock {
  key: SourceKey
  label: string
  author: Author
  /** Lines of source text. Transcript lines start with "רופא:" / "מטופל:". */
  lines: string[]
}

export interface ClinicalContext {
  blocks: ContextBlock[]
  demographics: { age?: number; sex?: 'male' | 'female' | 'other' }
  durationMinutes?: number
  /** Source categories that exist in the product but had nothing for this visit. */
  empty: SourceKey[]
}

export interface SummaryItem {
  text: string
  source: ItemSource
  /** Verbatim quote from the cited source (checked by grounding.ts). */
  evidence?: string
  /** false when the evidence was not found in the cited source. */
  verified?: boolean
}

export type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan'
export const SECTION_KEYS: SectionKey[] = ['subjective', 'objective', 'assessment', 'plan']

export interface SummaryContent {
  sections: Record<SectionKey, SummaryItem[]>
  missing_information: string[]
  /** For the doctor only. Never part of the patient text. */
  ai_suggestions: { text: string; rationale: string }[]
  /** Patient-facing text, released only after approval. */
  patient_summary: string
  patient_instructions: string[]
  /** Sections the doctor rewrote in the review screen. */
  edited_sections?: string[]
}

export type SummaryStatus = 'draft' | 'approved' | 'released' | 'superseded' | 'legacy_unreviewed'

export interface SummaryWarning {
  section: SectionKey | 'patient_summary' | 'patient_instructions'
  text: string
  reason: 'evidence_not_found' | 'no_evidence' | 'source_not_allowed' | 'source_missing' | 'number_not_in_source'
}

export const SOURCE_LABELS: Record<ItemSource, string> = {
  booking: 'דיווח המטופל בהזמנה',
  history: 'היסטוריה רפואית (דיווח המטופל)',
  intake: 'שאלון קליטה (דיווח המטופל)',
  clinician_notes: 'הערות הרופא',
  transcript_doctor: 'תמלול — הרופא',
  transcript_patient: 'תמלול — המטופל',
  clinician_edit: 'נערך ע"י הרופא',
}

export const STATUS_LABELS: Record<SummaryStatus, string> = {
  draft: 'טיוטה — ממתינה לבדיקת הרופא',
  approved: 'אושר — טרם נשלח למטופל',
  released: 'שוחרר למטופל',
  superseded: 'הוחלף בגרסה חדשה',
  legacy_unreviewed: 'סיכום ישן שלא נבדק',
}
