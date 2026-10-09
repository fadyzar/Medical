// Source-level guards for the notification/summary defects fixed in the
// October 2026 QA sprint. Each test names the production symptom it prevents.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name)
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel]
  })
}
const apiRoutes = walk('app/api').filter((f) => f.endsWith('route.ts'))

test('summaries: no API route calls another API route over HTTP (frozen on Vercel)', () => {
  for (const f of apiRoutes) {
    assert.doesNotMatch(read(f), /fetch\(\s*`\$\{origin\}\/api\//, `${f} self-calls an API route`)
  }
})

test('summaries: consultation completion generates the summary via after()', () => {
  const src = read('app/api/appointments/complete/route.ts')
  assert.match(src, /after\(/)
  assert.match(src, /generateConsultationSummary\(/)
  assert.doesNotMatch(src, /action:\s*'summarize'/, "'summarize' is rejected by aiSummarySchema")
})

test('summaries: doctor "end consultation" goes through the completion route', () => {
  const src = read('app/dashboard/doctor/appointments/page.tsx')
  assert.match(src, /fetch\('\/api\/appointments\/complete'/)
})

test('summaries: every action sent to /api/ai-summary is accepted by its schema', () => {
  const schema = read('lib/validation/schemas.ts')
  const allowed = schema.match(/aiSummarySchema[\s\S]*?z\.enum\(\[([^\]]*)\]/)[1]
    .split(',').map((s) => s.trim().replace(/'/g, ''))
  for (const f of walk('app').filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
    const src = read(f)
    if (!src.includes('/api/ai-summary')) continue
    for (const [, action] of src.matchAll(/action:\s*'([a-z_]+)'/g)) {
      assert.ok(allowed.includes(action), `${f} sends action '${action}' not in [${allowed}]`)
    }
  }
})

test('email: notify() reports the real Resend result, not an assumed success', () => {
  const src = read('lib/notifications/index.ts')
  assert.doesNotMatch(src, /results\.email = true/)
  assert.match(src, /results\.email = sent\.success/)
})

test('email: reminder senders throw on failure so the cron retries', () => {
  const src = read('lib/email/index.ts')
  assert.equal((src.match(/if \(!sent\.success\) throw/g) || []).length, 2)
})

test('email: cancelling an appointment notifies the patient and the doctor', () => {
  assert.match(read('app/api/appointments/cancel/route.ts'), /notifyCancellation\(/)
  assert.match(read('app/api/ai/assistant/confirm/route.ts'), /notifyCancellation\(/)
  const lib = read('lib/notifications/index.ts')
  assert.match(lib, /'appointment_cancelled'/)
  assert.match(lib, /'doctor_appointment_cancelled'/)
})

test('whatsapp: manual summary uses the clinic Green API, not the retired Infobip key', () => {
  const src = read('app/api/notifications/send-summary/route.ts')
  assert.doesNotMatch(src, /INFOBIP/)
  assert.match(src, /sendWhatsApp\(/)
})

test('isolation: AI routes restrict doctors to their own appointments', () => {
  assert.match(read('app/api/ai-summary/route.ts'), /apt\.doctor_id !== user\.id/)
  assert.match(read('app/api/ai-document/route.ts'), /\.eq\('doctor_id', user\.id\)/)
})

test('isolation: notification triggers check appointment ownership', () => {
  assert.match(read('app/api/notifications/trigger-patient-created/route.ts'), /apt\.patient_id !== user\.id/)
  assert.match(read('app/api/notifications/trigger/route.ts'), /apt\.doctor_id === user\.id/)
})

test('seo: robots.txt, sitemap.xml and opengraph-image are public (were redirected to login)', () => {
  const src = read('middleware.ts')
  for (const p of ["'/robots.txt'", "'/sitemap.xml'", "'/opengraph-image'"]) assert.ok(src.includes(p), p)
})

test('whatsapp: Green API errors are read safely (401 has an empty body)', () => {
  for (const f of ['lib/whatsapp/index.ts', 'app/api/admin/whatsapp/test/route.ts']) {
    assert.doesNotMatch(read(f).replace(/\/\/.*$/gm, ''), /await res\.json\(\)/, f)
  }
  assert.match(read('lib/whatsapp/index.ts'), /status === 401 \|\| status === 403/)
})

test('onboarding: founder is made admin server-side (019 ignores signup metadata) and side effects run in after()', () => {
  const src = read('app/api/onboarding/route.ts')
  assert.match(src, /role: 'admin',\s*\n\s*\}, \{ onConflict: 'id' \}\)/)
  assert.match(src, /after\(async/)
  assert.match(src, /inviteMember\(/, 'wizard doctors must get real invitation tokens')
  assert.doesNotMatch(src, /provisionSubdomain\([^)]*\)\.catch\([\s\S]{0,200}\}\)\n\n    \/\/ Audit/, 'no fire-and-forget provisioning')
})
