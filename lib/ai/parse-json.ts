/**
 * Parse a model reply that should be JSON. The model sometimes wraps it in a
 * ```json fence; without stripping it the parse fails and the SOAP fields of an
 * AI summary are silently left empty. Dependency-free so it can be unit-tested.
 */
export function parseModelJson(text: string): Record<string, unknown> | undefined {
  const jsonText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const value: unknown = JSON.parse(jsonText)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}
