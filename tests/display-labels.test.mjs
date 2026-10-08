import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeAudit, specialtyLabels, languageLabels } from '../lib/utils/index.ts'

test('old English audit lines are shown in Hebrew', () => {
  assert.equal(describeAudit('Status: in_progress → completed'), 'סטטוס התור: בתהליך ← הושלם')
  assert.equal(describeAudit('המטופל ביטל תור'), 'המטופל ביטל תור')
  assert.equal(describeAudit(null), '')
})

test('specialty and language codes render as Hebrew labels', () => {
  assert.equal(specialtyLabels(['general', 'dermatology']), 'רפואה כללית · עור ומין')
  assert.equal(languageLabels(['he', 'en']), 'עברית, אנגלית')
  assert.equal(languageLabels(['xx']), 'xx')
})
