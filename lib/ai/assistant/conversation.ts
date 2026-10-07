/**
 * Conversation persistence.
 *
 * Transcripts live in `ai_conversations`, the table the other agents already
 * use. `agent_type` is 'general' — the CHECK constraint on that column allows it.
 *
 * `result` carries the assistant's own state: the action currently waiting for
 * the user's confirmation, and a small memory of facts worth keeping between
 * turns. The pending action is stored SERVER-SIDE on purpose — the client gets
 * only an opaque id, so it cannot alter what it is about to confirm.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { createServiceRole } from '@/lib/supabase/server'
import type { ConfirmationCard } from '@/lib/ai/assistant/executors'
import { trimHistory } from '@/lib/ai/assistant/history'
export { transcriptForDisplay } from '@/lib/ai/assistant/history'

export type AssistantMemory = {
  /** Short notes the assistant keeps about the user across turns. */
  notes?: string[]
  /** Last patient the user was working with, so "book her another" resolves. */
  lastPatientId?: string
  lastAppointmentId?: string
}

export type ConversationState = {
  pendingAction?: { card: ConfirmationCard; createdAt: string } | null
  memory?: AssistantMemory
}

export type ConversationRow = {
  id: string
  organization_id: string
  user_id: string
  messages: Anthropic.MessageParam[]
  result: ConversationState | null
}

/** Confirmations go stale — a slot free ten minutes ago may not be now. */
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000

/** How many turns of history to replay. Older turns are dropped, not summarised. */
const MAX_HISTORY_MESSAGES = 40

export async function loadConversation(
  conversationId: string | null,
  userId: string,
): Promise<ConversationRow | null> {
  if (!conversationId) return null
  const admin = createServiceRole()
  const { data } = await admin
    .from('ai_conversations')
    .select('id, organization_id, user_id, messages, result')
    .eq('id', conversationId)
    .eq('user_id', userId)      // a conversation belongs to exactly one user
    .maybeSingle()
  return (data as ConversationRow | null) ?? null
}

export async function createConversation(userId: string, organizationId: string): Promise<string> {
  const admin = createServiceRole()
  const { data, error } = await admin.from('ai_conversations').insert({
    organization_id: organizationId,
    user_id: userId,
    agent_type: 'general',
    messages: [],
    result: {},
  } as never).select('id').single()
  if (error) throw new Error(`conversation_create_failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function saveConversation(params: {
  conversationId: string
  messages: Anthropic.MessageParam[]
  state: ConversationState
  inputTokens: number
  outputTokens: number
  model: string
}): Promise<void> {
  const admin = createServiceRole()
  const trimmed = trimHistory(params.messages, MAX_HISTORY_MESSAGES)
  await admin.from('ai_conversations').update({
    messages: trimmed,
    result: params.state,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    model_used: params.model,
    updated_at: new Date().toISOString(),
  } as never).eq('id', params.conversationId)
}

/** Recent conversations for the history panel. */
export async function listConversations(userId: string, limit = 20) {
  const admin = createServiceRole()
  const { data } = await admin
    .from('ai_conversations')
    .select('id, messages, created_at, updated_at')
    .eq('user_id', userId)
    .eq('agent_type', 'general')
    .order('updated_at', { ascending: false })
    .limit(limit)

  return ((data || []) as Array<{ id: string; messages: Anthropic.MessageParam[]; created_at: string; updated_at: string }>)
    .map(c => {
      // Title the thread by its first user message.
      const first = c.messages.find(m => m.role === 'user')
      const text = typeof first?.content === 'string'
        ? first.content
        : (Array.isArray(first?.content)
            ? first.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join(' ')
            : '')
      return {
        id: c.id,
        title: text.trim().slice(0, 60) || 'שיחה חדשה',
        updatedAt: c.updated_at,
        messageCount: c.messages.length,
      }
    })
    .filter(c => c.messageCount > 0)
}
