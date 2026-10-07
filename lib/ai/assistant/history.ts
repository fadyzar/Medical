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
