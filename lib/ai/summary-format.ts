// The summary agent answers with JSON, sometimes wrapped in a ```json fence.
// Rows saved before the fence was stripped still have it, so every reader goes
// through here instead of calling JSON.parse on the column directly.

export type AiSummary = {
  summary?: string
  soap?: { subjective?: string; objective?: string; assessment?: string; plan?: string }
  key_findings?: string[]
  follow_up?: string[] | string
  [key: string]: unknown
}

export function parseAiSummary(raw: string | null | undefined): AiSummary | null {
  if (!raw) return null
  // Same unfencing as parseModelJson; kept dependency-free so node tests can load it.
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AiSummary) : null
  } catch {
    return null
  }
}

/** What a patient sees: the plain-language summary and follow-up steps, never raw JSON. */
export function patientSummary(raw: string | null | undefined): { summary: string | null; followUp: string[] } {
  const p = parseAiSummary(raw)
  if (!p) {
    const text = raw?.trim()
    return { summary: text && !text.startsWith('{') && !text.startsWith('```') ? text : null, followUp: [] }
  }
  const followUp = Array.isArray(p.follow_up) ? p.follow_up.map(String).filter(Boolean)
    : typeof p.follow_up === 'string' && p.follow_up ? [p.follow_up] : []
  return { summary: typeof p.summary === 'string' ? p.summary : null, followUp }
}
