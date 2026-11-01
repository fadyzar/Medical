// Guards for the defects found in the 1 Nov 2026 zero-to-end acceptance run.
// Each test names the symptom it prevents.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAiSummary, patientSummary } from '../lib/ai/summary-format.ts'
import { onboardingClinicSchema } from '../lib/validation/onboarding-schema.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')

test('AI summary: a ```json fenced answer still parses (patient saw raw JSON)', () => {
  const fenced = '```json\n{"summary":"סיכום קצר","follow_up":["מנוחה","שתייה"]}\n```'
  assert.equal(parseAiSummary(fenced)?.summary, 'סיכום קצר')
  assert.deepEqual(patientSummary(fenced), { summary: 'סיכום קצר', followUp: ['מנוחה', 'שתייה'] })
})

test('AI summary: patients never get raw JSON, plain text passes through', () => {
  assert.equal(patientSummary('{"broken": ').summary, null)
  assert.equal(patientSummary('```json\n{oops').summary, null)
  assert.equal(patientSummary('סיכום בטקסט חופשי').summary, 'סיכום בטקסט חופשי')
  assert.equal(parseAiSummary(null), null)
})

test('AI summary: stored as clean JSON, not the fenced model output', () => {
  assert.match(read('lib/ai/summary.ts'), /ai_summary: result\.parsed \? JSON\.stringify\(result\.parsed\)/)
  for (const f of ['lib/notifications/index.ts', 'app/api/notifications/send-summary/route.ts', 'lib/ai/assistant/executors.ts']) {
    assert.doesNotMatch(read(f), /JSON\.parse\([^)]*ai_summary/, f)
  }
})

test('video call: camera and microphone are published on join', () => {
  const src = read('app/video-call/page.tsx')
  assert.match(src, /video=\{hasCamera\}/)
  assert.match(src, /audio=\{hasMic\}/)
})

test('video call: only the doctor leaving completes the consultation', () => {
  const src = read('app/video-call/page.tsx')
  const i = src.indexOf("fetch('/api/appointments/complete'")
  assert.ok(i > 0)
  assert.match(src.slice(Math.max(0, i - 300), i), /profile\?\.role === 'doctor'/)
})

test('reschedule proposal: patient answers through the server (RLS blocks paid appointments)', () => {
  const src = read('app/dashboard/patient/appointments/page.tsx')
  assert.match(src, /\/api\/appointments\/proposal/)
  assert.doesNotMatch(src, /patient_confirmed_proposed_at: new Date\(\)\.toISOString\(\),\s*status: 'scheduled' as const,\s*\}\s*await supabase/)
})

test('onboarding: clinic phone accepts the hyphen its own placeholder shows', () => {
  const base = { name: 'מרפאה', contact_email: 'a@b.test', subdomain: 'abc-clinic' }
  const ok = onboardingClinicSchema.safeParse({ ...base, contact_phone: '03-5550202' })
  if (!ok.success) assert.ok(!ok.error.issues.some(i => i.path[0] === 'contact_phone'), JSON.stringify(ok.error.issues))
  else assert.equal(ok.data.contact_phone, '035550202')
})

test('onboarding: wizard logo is sent with the submit, not uploaded anonymously', () => {
  assert.match(read('app/onboarding/page.tsx'), /logo_data: logoData/)
  assert.match(read('app/api/onboarding/route.ts'), /uploadLogo\(admin, logoFile/)
})

test('questionnaire builder: preview of an unsaved questionnaire returns to the editor', () => {
  assert.match(read('app/dashboard/admin/questionnaires/page.tsx'), /onBack=\{\(\) => setView\(previewFrom\)\}/)
})

test('cron: WhatsApp 1h reminders are counted only when actually sent', () => {
  assert.match(read('lib/whatsapp/index.ts'), /sendReminder1hWhatsApp[\s\S]{0,200}Promise<boolean>/)
  assert.match(read('app/api/cron/reminders/route.ts'), /if \(await sendReminder1hWhatsApp\(/)
})

test('WhatsApp test: an unreachable Green API host gets an explained 502, not "internal error"', () => {
  assert.match(read('app/api/admin/whatsapp/test/route.ts'), /לא ניתן להתחבר לשרת Green API/)
})

test('questionnaire: a response without an appointment link is attached to the next appointment', () => {
  assert.match(read('app/dashboard/patient/questionnaire/page.tsx'), /appointment_id: linkedAppointment/)
})

test('lead analysis: knows whether contact details exist, without sending them', () => {
  const src = read('app/api/ai-lead-analysis/route.ts')
  assert.match(src, /יש טלפון: \$\{lead\.phone \? 'כן' : 'לא'\}/)
  assert.doesNotMatch(src, /\$\{lead\.phone\}/)
})

test('copilot overview: saved WhatsApp credentials are not reported as "connected"', () => {
  assert.doesNotMatch(read('lib/ai/assistant/executors.ts'), /whatsapp: whatsapp \? 'מחובר'/)
})

test('onboarding: cancellation window saved under the key the settings page uses', () => {
  assert.match(read('app/api/onboarding/route.ts'), /cancellation_hours: 24/)
})

test('video call: in-call chat is Hebrew (no LiveKit <Chat> with fixed English text)', () => {
  const src = read('app/video-call/page.tsx')
  assert.doesNotMatch(src, /^\s*<Chat[\s/>]/m)
  assert.match(src, /placeholder="כתוב הודעה…"/)
})

test('booking: no promise of automatic doctor assignment that does not exist', () => {
  assert.doesNotMatch(read('app/dashboard/patient/new-appointment/page.tsx'), /יושבץ אוטומטית/)
})

test('clinical safety: an unreviewed AI summary is never sent or shown to the patient', () => {
  // The automatic summary emailed the patient 10s after the call, as the doctor's assessment.
  for (const f of ['app/api/appointments/complete/route.ts', 'app/api/ai-summary/route.ts']) {
    assert.doesNotMatch(read(f), /notifyPatient: true/, f)
  }
  for (const f of ['lib/notifications/index.ts', 'app/api/notifications/send-summary/route.ts']) {
    assert.doesNotMatch(read(f), /parseAiSummary|apt\.ai_summary|ctx\.ai_summary/, f)
  }
  for (const f of ['app/dashboard/patient/appointments/page.tsx', 'app/dashboard/staff/appointments/page.tsx']) {
    assert.doesNotMatch(read(f), /apt\.ai_summary/, f)
  }
})

test('clinical safety: AI text is not written into the doctor\'s own SOAP fields', () => {
  const s = read('lib/ai/summary.ts')
  assert.doesNotMatch(s, /subjective_notes: p\.soap|assessment: p\.soap|plan: p\.soap/)
})

test('summary email escapes the clinical text it embeds in HTML', () => {
  assert.match(read('app/api/notifications/send-summary/route.ts'), /escapeHtml\(summaryText\)/)
})

test('clinical safety: AI documents and prescription drafts stay with the doctor until reviewed', () => {
  // An AI sick-leave note was filed in the patient's record as verified, with no review.
  const doc = read('app/api/ai-document/route.ts')
  assert.doesNotMatch(doc, /from\('documents'\)\.insert/)
  assert.doesNotMatch(doc, /id_number/)
  assert.doesNotMatch(read('app/api/ai-summary/route.ts'), /ai_prescription_draft: result/)
})
