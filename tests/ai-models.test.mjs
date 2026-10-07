// The production AI outage of 2026: claude-sonnet-4-20250514 was retired and every
// clinical AI call returned 404. These guards keep model ids in one place and keep
// response parsing compatible with thinking-enabled models.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { responseText, CLINICAL_MODEL, ASSISTANT_MODEL } from '../lib/ai/models.ts'

const root = new URL('..', import.meta.url).pathname
function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const rel = join(dir, n)
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel]
  })
}
const sources = [...walk('app'), ...walk('lib')].filter((f) => /\.(ts|tsx)$/.test(f))

test('no model id is hardcoded outside lib/ai/models.ts', () => {
  for (const f of sources) {
    if (f === 'lib/ai/models.ts') continue
    assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /['"`]claude-[a-z0-9-]+['"`]/, f)
  }
})

test('the retired model is not used', () => {
  assert.notEqual(CLINICAL_MODEL, 'claude-sonnet-4-20250514')
  assert.notEqual(ASSISTANT_MODEL, 'claude-sonnet-4-20250514')
})

test('no code reads content[0] as the reply (it is a thinking block on current models)', () => {
  for (const f of sources) {
    assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /\.content\[0\]\.type === 'text'/, f)
  }
})

test('no temperature on clinical calls (rejected by the current Sonnet)', () => {
  assert.doesNotMatch(readFileSync(join(root, 'lib/ai/agents.ts'), 'utf8'), /temperature/)
})

test('responseText skips thinking blocks and joins text blocks', () => {
  const msg = { content: [
    { type: 'thinking', thinking: '', signature: 'x' },
    { type: 'text', text: '{"a":1}' },
  ] }
  assert.equal(responseText(msg), '{"a":1}')
  assert.equal(responseText({ content: [] }), '')
})
