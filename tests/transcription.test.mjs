// Consented consultation transcription (prototype): guards on consent, secrets and audio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')

test('transcription is off unless the server is configured and the clinic turned it on', () => {
  const cfg = read('lib/transcription/config.ts')
  assert.match(cfg, /!!process\.env\.TRANSCRIPTION_PROVIDER && !!process\.env\.TRANSCRIPTION_INGEST_SECRET/)
  assert.match(cfg, /transcription_enabled === true/)
  const route = read('app/api/consultation-transcript/route.ts')
  assert.match(route, /if \(!transcriptionConfigured\(\) \|\| !clinicEnabled\(apt\.org\?\.settings\)\)/)
})

test('only the doctor and the patient of the appointment consent, each for themselves', () => {
  const route = read('app/api/consultation-transcript/route.ts')
  assert.match(route, /const side = a\.doctor_id === user\.id \? 'doctor' : a\.patient_id === user\.id \? 'patient' : null/)
  assert.match(route, /if \(!side\) return \{ error: NextResponse\.json\(\{ error: 'Forbidden' \}, \{ status: 403 \}\) \}/)
  assert.match(route, /const field = side === 'doctor' \? 'doctor_consent_at' : 'patient_consent_at'/)
  // Withdrawal discards the text.
  assert.match(route, /status: 'withdrawn', withdrawn_at: now, withdrawn_by: user\.id, segments: null/)
})

test('the worker endpoint needs the shared secret, both consents and deleted audio', () => {
  const ingest = read('app/api/consultation-transcript/ingest/route.ts')
  assert.match(ingest, /timingSafeEqual/)
  assert.match(ingest, /!!row\.doctor_consent_at && !!row\.patient_consent_at && row\.status !== 'withdrawn'/)
  assert.match(ingest, /if \(!b\.audioDeleted\) return NextResponse\.json/)
  assert.match(ingest, /retention_until/)
})

test('joining the call never depends on transcription consent; the indicator is visible in the call', () => {
  const page = read('app/video-call/page.tsx')
  assert.match(page, /disabled=\{!hasMic \|\| !livekitUrl\}/)
  assert.match(page, /<TranscriptionIndicator appointmentId=\{appointmentId\} \/>/)
  const ui = read('components/clinical/TranscriptionConsent.tsx')
  assert.match(ui, /הפסק תמלול/)
  assert.match(ui, /התמלול יתחיל רק בהסכמת שני הצדדים/)
})

test('prototype worker: hidden subscribe-only participant, local QA only, no transcript logging', () => {
  const w = read('scripts/qa/transcription/scribe.mjs')
  assert.match(w, /canSubscribe: true, canPublish: false, canPublishData: false, hidden: true/)
  assert.match(w, /runs against LOCAL QA only/)
  assert.match(w, /fs\.rmSync\(file, \{ force: true \}\)/)
  assert.doesNotMatch(w, /log\([^)]*\.text/)
})

test('a transcript arriving after review does not replace the doctor\'s approved text', () => {
  const s = read('lib/clinical-summary/service.ts')
  assert.match(s, /params\.trigger === 'transcript' && versions\.some\(v => v\.status === 'approved' \|\| v\.status === 'released'\)/)
  // The transcript reaches the model only when completed with both consents.
  assert.match(read('lib/clinical-summary/context.ts'), /t\.status === 'completed' && t\.doctor_consent_at && t\.patient_consent_at/)
})
