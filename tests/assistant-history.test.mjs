import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trimHistory } from '../lib/ai/assistant/history.ts'

const user = (t) => ({ role: 'user', content: t })
const asst = (t) => ({ role: 'assistant', content: [{ type: 'text', text: t }] })
const toolUse = (id) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name: 'x', input: {} }] })
const toolResult = (id) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: '{}' }] })

test('short history is returned unchanged', () => {
  const h = [user('a'), asst('b')]
  assert.equal(trimHistory(h, 40), h)
})

test('never starts on an orphaned tool_result (API 400 before the fix)', () => {
  // 54 messages; a naive slice(-38) starts at index 16 = a tool_result.
  const h = []
  for (let i = 0; i < 14; i++) h.push(i % 2 === 0 ? user('q' + i) : asst('a' + i))
  for (let i = 0; i < 10; i++) { h.push(user('q')); h.push(toolUse('t' + i)); h.push(toolResult('t' + i)); h.push(asst('done')) }
  const naive = h.slice(-38)
  assert.equal(naive[0].content[0].type, 'tool_result')
  const out = trimHistory(h, 38)
  assert.equal(out[0].role, 'user')
  assert.equal(typeof out[0].content, 'string')
  assert.ok(out.length <= 38)
})

test('never starts on an assistant message', () => {
  const h = [user('a'), asst('b'), user('c'), asst('d'), user('e'), asst('f')]
  const out = trimHistory(h, 3)
  assert.equal(out[0].role, 'user')
})
