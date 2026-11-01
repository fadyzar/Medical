/**
 * Grounding check for an AI summary draft. Every SOAP item must quote its
 * source; the quote is looked up in that source's text. The check cannot prove
 * a draft is correct — it catches lines with no support, which the doctor then
 * sees flagged. Pure and dependency-free (unit-tested).
 */
import type {
  ClinicalContext, ItemSource, SectionKey, SummaryContent, SummaryItem, SummaryWarning,
} from './types'

const SECTIONS: SectionKey[] = ['subjective', 'objective', 'assessment', 'plan']

/** Clinician-only sections: findings, assessment and plan never come from the patient's own report. */
const ALLOWED: Record<SectionKey, ItemSource[]> = {
  subjective: ['booking', 'history', 'intake', 'clinician_notes', 'transcript_patient', 'transcript_doctor'],
  objective: ['clinician_notes', 'transcript_doctor'],
  assessment: ['clinician_notes', 'transcript_doctor'],
  plan: ['clinician_notes', 'transcript_doctor'],
}

/** Lowercase, no niqqud, no punctuation or quote marks, single spaces. */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'`״׳“”‘’„«»()[\]{}.,;:!?\-–—/\\|*_#~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function numbers(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)?/g) || []).map(n => n.replace(',', '.'))
}

/** The text an item may quote from, by its cited source. */
export function sourceText(ctx: ClinicalContext, source: ItemSource): string | null {
  if (source === 'transcript_doctor' || source === 'transcript_patient') {
    const block = ctx.blocks.find(b => b.key === 'transcript')
    if (!block) return null
    const prefix = source === 'transcript_doctor' ? 'רופא:' : 'מטופל:'
    const lines = block.lines.filter(l => l.trim().startsWith(prefix)).map(l => l.trim().slice(prefix.length))
    return lines.length ? lines.join('\n') : null
  }
  if (source === 'clinician_edit') return null
  const block = ctx.blocks.find(b => b.key === source)
  return block ? block.lines.join('\n') : null
}

export interface RawSummary {
  subjective: SummaryItem[]; objective: SummaryItem[]; assessment: SummaryItem[]; plan: SummaryItem[]
  missing_information: string[]
  ai_suggestions: { text: string; rationale: string }[]
  patient_summary: string
  patient_instructions: string[]
}

export function groundSummary(raw: RawSummary, ctx: ClinicalContext): { content: SummaryContent; warnings: SummaryWarning[] } {
  const warnings: SummaryWarning[] = []
  // Numbers as they appear in the sources ("1.5" survives; normalize() would split it).
  const sourceNumbers = new Set(numbers(ctx.blocks.map(b => b.lines.join('\n')).join('\n')))
  const sections = {} as Record<SectionKey, SummaryItem[]>

  for (const section of SECTIONS) {
    sections[section] = []
    for (const item of raw[section] || []) {
      const text = (item.text || '').trim()
      if (!text) continue
      if (!ALLOWED[section].includes(item.source)) {
        // e.g. an "assessment" built from the patient's own booking text: dropped, not shown as the doctor's.
        warnings.push({ section, text, reason: 'source_not_allowed' })
        continue
      }
      const src = sourceText(ctx, item.source)
      if (src == null) {
        warnings.push({ section, text, reason: 'source_missing' })
        continue
      }
      const evidence = (item.evidence || '').trim()
      const nSrc = normalize(src)
      let verified = true
      if (!evidence) {
        verified = false
        warnings.push({ section, text, reason: 'no_evidence' })
      } else if (!nSrc.includes(normalize(evidence))) {
        verified = false
        warnings.push({ section, text, reason: 'evidence_not_found' })
      }
      // Numbers are checked against every source: a line may set two sources side by side
      // ("5 days per the booking, 4 per the doctor"), but a number found nowhere is invented.
      const strayNumber = numbers(text).find(n => !sourceNumbers.has(n))
      if (strayNumber) {
        verified = false
        warnings.push({ section, text, reason: 'number_not_in_source' })
      }
      sections[section].push({ text, source: item.source, evidence, verified })
    }
  }

  const patientSummary = (raw.patient_summary || '').trim()
  if (numbers(patientSummary).some(n => !sourceNumbers.has(n))) {
    warnings.push({ section: 'patient_summary', text: patientSummary, reason: 'number_not_in_source' })
  }
  const instructions = (raw.patient_instructions || []).map(s => s.trim()).filter(Boolean)
  for (const ins of instructions) {
    if (numbers(ins).some(n => !sourceNumbers.has(n))) {
      warnings.push({ section: 'patient_instructions', text: ins, reason: 'number_not_in_source' })
    }
  }

  return {
    content: {
      sections,
      missing_information: (raw.missing_information || []).map(s => s.trim()).filter(Boolean),
      ai_suggestions: (raw.ai_suggestions || []).filter(s => s && s.text?.trim()).slice(0, 3),
      patient_summary: patientSummary,
      patient_instructions: instructions,
    },
    warnings,
  }
}

export const WARNING_LABELS: Record<SummaryWarning['reason'], string> = {
  evidence_not_found: 'הציטוט לא נמצא במקור',
  no_evidence: 'אין ציטוט מהמקור',
  source_not_allowed: 'הוסר: פריט קליני שלא מבוסס על הרופא',
  source_missing: 'הוסר: המקור שצוין לא קיים',
  number_not_in_source: 'מספר שלא מופיע במקורות',
}
