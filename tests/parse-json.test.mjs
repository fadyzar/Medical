import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseModelJson } from '../lib/ai/parse-json.ts'

test('parses plain JSON', () => {
  assert.deepEqual(parseModelJson('{"summary":"x"}'), { summary: 'x' })
})

test('parses JSON wrapped in a ```json fence (SOAP fields were lost before)', () => {
  const reply = '```json\n{"summary":"s","soap":{"assessment":"a"}}\n```'
  assert.deepEqual(parseModelJson(reply), { summary: 's', soap: { assessment: 'a' } })
})

test('parses JSON wrapped in a bare ``` fence', () => {
  assert.deepEqual(parseModelJson('```\n{"a":1}\n```'), { a: 1 })
})

test('returns undefined for prose and non-object JSON', () => {
  assert.equal(parseModelJson('not json'), undefined)
  assert.equal(parseModelJson('[1,2]'), undefined)
  assert.equal(parseModelJson('null'), undefined)
})
