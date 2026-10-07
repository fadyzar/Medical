import type Anthropic from '@anthropic-ai/sdk'

/**
 * Keep roughly the last `max` messages, cut at a safe boundary.
 *
 * A plain `slice(-max)` can start the history on a user message that holds
 * tool_result blocks (its tool_use was cut off) or on an assistant message —
 * both are rejected by the API, which would break the conversation for good.
 * So the kept window always starts at a user turn that is plain text.
 */
export function trimHistory(messages: Anthropic.MessageParam[], max: number): Anthropic.MessageParam[] {
  if (messages.length <= max) return messages
  for (let i = messages.length - max; i < messages.length; i++) {
    const m = messages[i]
    const isPlainUser = m.role === 'user' && (
      typeof m.content === 'string' ||
      (Array.isArray(m.content) && m.content.every(b => b.type === 'text'))
    )
    if (isPlainUser) return messages.slice(i)
  }
  // No safe boundary inside the window: keep only the last plain user turn onward.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && typeof m.content === 'string') return messages.slice(i)
  }
  return []
}

/**
 * The visible part of a stored conversation — what a reopened thread shows.
 * Tool calls, tool results and thinking are internal; the "[העמוד הנוכחי: …]"
 * context line the server prepends to user turns is stripped.
 */
export function transcriptForDisplay(messages: Anthropic.MessageParam[]): Array<{ role: 'user' | 'assistant'; text: string }> {
  const out: Array<{ role: 'user' | 'assistant'; text: string }> = []
  for (const m of messages) {
    const text = typeof m.content === 'string'
      ? m.content
      : m.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n')
    const clean = (m.role === 'user' ? text.replace(/^\[העמוד הנוכחי: [^\]\n]*\]\n/, '') : text).trim()
    if (clean && (m.role === 'user' || m.role === 'assistant')) out.push({ role: m.role, text: clean })
  }
  return out
}
