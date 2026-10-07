/**
 * Model choices for CANNA's AI features — the only place model ids live.
 *
 * claude-sonnet-4-20250514 was retired by Anthropic (the API answers 404
 * not_found_error), which silently broke every summary, triage, prescription
 * draft, intake and document call in production. Keep ids here so the next
 * retirement is a one-line change.
 */
import type Anthropic from '@anthropic-ai/sdk'

/** Single-shot clinical drafting (summaries, triage, documents). */
export const CLINICAL_MODEL = 'claude-sonnet-5-5'
/** Structured extraction/drafting: thinking stays short at `low`. */
export const CLINICAL_EFFORT = 'low' as const

/** The conversational CANNA assistant (tool use across the app). */
export const ASSISTANT_MODEL = 'claude-opus-5'

/**
 * The reply text of a response. Read by block type, never by position: with
 * adaptive thinking, content[0] is often a (possibly empty) thinking block.
 */
export function responseText(message: Pick<Anthropic.Message, 'content'>): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}
