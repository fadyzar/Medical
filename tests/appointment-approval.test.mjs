// Appointment approval lifecycle, payment mode and video access (migrations 032/033).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { evaluateVideoAccess, tokenTtlSeconds, WAITING_ROOM_OPENS_MIN, OVERRUN_MAX_MIN } from '../lib/video/access.ts'
import { paymentMode, collectionFor } from '../lib/payments/mode.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')

const ORG = 'org-a', OTHER_ORG = 'org-b'
const START = '2026-11-12T12:00:00.000Z' // 14:00 Israel time (UTC+2 in November)
const at = (hhmmss) => new Date(`2026-11-12T${hhmmss}.000Z`)
const apt = (over = {}) => ({
  id: 'apt-1', organization_id: ORG, patient_id: 'pat', doctor_id: 'doc', status: 'confirmed',
  scheduled_at: START, duration_minutes: 30, approved_at: '2026-11-10T10:00:00Z', ...over,
})
const patient = { id: 'pat', role: 'patient', organization_id: ORG }
const doctor = { id: 'doc', role: 'doctor', organization_id: ORG }

test('14:00 appointment: denied before 13:45, waiting room from 13:45, open at 14:00', () => {
  assert.equal(evaluateVideoAccess({ apt: apt(), user: patient, now: at('11:44:59') }).code, 'too_early')
  const atOpen = evaluateVideoAccess({ apt: apt(), user: patient, now: at('11:45:00') })
  assert.equal(atOpen.allowed, true)
  assert.equal(atOpen.phase, 'waiting_room')
  assert.equal(atOpen.secondsToStart, 15 * 60)
  assert.equal(evaluateVideoAccess({ apt: apt(), user: patient, now: at('11:59:59') }).phase, 'waiting_room')
  const start = evaluateVideoAccess({ apt: apt(), user: doctor, now: at('12:00:00') })
  assert.equal(start.phase, 'open')
  assert.equal(start.role, 'doctor')
  assert.equal(WAITING_ROOM_OPENS_MIN, 15)
})

test('late entry until the scheduled end; overrun only while in progress; old appointments closed', () => {
  assert.equal(evaluateVideoAccess({ apt: apt(), user: patient, now: at('12:29:59') }).phase, 'open')
  assert.equal(evaluateVideoAccess({ apt: apt(), user: patient, now: at('12:30:00') }).code, 'ended')
  const running = apt({ status: 'in_progress' })
  assert.equal(evaluateVideoAccess({ apt: running, user: patient, now: at('12:59:59') }).phase, 'open')
  assert.equal(evaluateVideoAccess({ apt: running, user: patient, now: at('13:00:00') }).code, 'ended')
  assert.equal(OVERRUN_MAX_MIN, 30)
  assert.equal(evaluateVideoAccess({ apt: apt({ scheduled_at: '2026-11-01T12:00:00Z' }), user: patient, now: at('12:00:00') }).code, 'ended')
})

test('only doctor-approved appointments: pending, rejected, cancelled, completed and legacy statuses are refused', () => {
  const now = at('12:05:00')
  const code = (over) => evaluateVideoAccess({ apt: apt(over), user: patient, now }).code
  assert.equal(code({ status: 'pending_approval', approved_at: null }), 'not_confirmed')
  assert.equal(code({ status: 'payment_pending', approved_at: null }), 'not_confirmed')
  assert.equal(code({ status: 'rejected' }), 'rejected')
  assert.equal(code({ status: 'cancelled_patient' }), 'cancelled')
  assert.equal(code({ status: 'cancelled_doctor' }), 'cancelled')
  assert.equal(code({ status: 'no_show_patient' }), 'cancelled')
  assert.equal(code({ status: 'completed' }), 'completed')
  for (const legacy of ['scheduled', 'paid', 'ready', 'doctor_confirmed', 'pending']) {
    assert.equal(code({ status: legacy, approved_at: null }), 'not_confirmed', legacy)
  }
  assert.equal(code({ status: 'confirmed', approved_at: null }), 'not_confirmed')
  assert.equal(code({ scheduled_at: null }), 'no_time')
})

test('only the patient or the assigned doctor, in the appointment\'s own clinic', () => {
  const now = at('12:05:00')
  assert.equal(evaluateVideoAccess({ apt: apt(), user: { id: 'other', role: 'patient', organization_id: ORG }, now }).code, 'not_participant')
  assert.equal(evaluateVideoAccess({ apt: apt(), user: { id: 'staff', role: 'admin', organization_id: ORG }, now }).code, 'not_participant')
  assert.equal(evaluateVideoAccess({ apt: apt(), user: { ...patient, organization_id: OTHER_ORG }, now }).code, 'wrong_clinic')
  assert.equal(evaluateVideoAccess({ apt: apt(), user: patient, now, tenantOrgId: OTHER_ORG }).code, 'wrong_clinic')
  assert.equal(evaluateVideoAccess({ apt: apt(), user: patient, now, tenantOrgId: ORG }).allowed, true)
  // A doctor id that matches but is not a doctor account is not the assigned doctor.
  assert.equal(evaluateVideoAccess({ apt: apt({ doctor_id: 'x' }), user: { id: 'x', role: 'patient', organization_id: ORG }, now }).code, 'not_participant')
})

test('tokens are short-lived and never outlive the access window', () => {
  assert.equal(tokenTtlSeconds('2026-11-12T12:30:00Z', at('12:00:00')), 600)
  assert.equal(tokenTtlSeconds('2026-11-12T12:30:00Z', at('12:27:00')), 180)
  assert.equal(tokenTtlSeconds('2026-11-12T12:30:00Z', at('12:29:50')), 60)
  const route = read('app/api/livekit/token/route.ts')
  assert.doesNotMatch(route, /ttl:\s*'2h'/)
  assert.match(route, /checkVideoAccess\(/)
  assert.match(route, /access\.phase !== 'open'/)
  assert.match(route, /room: roomName/)
})

test('payment simulation can never run in production', () => {
  const local = { PAYMENTS_SIMULATION: 'enabled', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321' }
  assert.equal(paymentMode(local), 'simulated')
  assert.equal(paymentMode({ ...local, VERCEL_ENV: 'production' }), 'none')
  assert.equal(paymentMode({ ...local, NEXT_PUBLIC_SUPABASE_URL: 'https://igkffvtzjkwpjxmldlzh.supabase.co' }), 'none')
  assert.equal(paymentMode({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321' }), 'none')
  assert.equal(paymentMode({ TRANZILA_TERMINAL_NAME: 't', TRANZILA_API_KEY: 'k', ...local }), 'tranzila')
  assert.equal(paymentMode({ TRANZILA_TERMINAL_NAME: 't' }), 'none')
  assert.equal(collectionFor(250, 'none'), 'clinic')
  assert.equal(collectionFor(250, 'tranzila'), 'online')
  assert.equal(collectionFor(null, 'tranzila'), 'none')
  assert.equal(collectionFor(0, 'simulated'), 'none')
  const fake = read('app/api/payments/fake-complete/route.ts')
  assert.match(fake, /if \(paymentMode\(\) !== 'simulated'\)/)
  assert.doesNotMatch(fake, /status: 'scheduled'|newStatus/)
})

test('a verified payment moves to pending_approval, never to a confirmed/scheduled state', () => {
  const life = read('lib/appointments/lifecycle.ts')
  assert.match(life, /status: 'pending_approval',[\s\S]*\.eq\('status', 'payment_pending'\)/)
  const hook = read('app/api/payments/webhook/route.ts')
  assert.match(hook, /markPaymentVerified\(/)
  assert.doesNotMatch(hook, /status: 'paid'/)
  assert.match(hook, /validateTranzilaSignature\(params\)/)
  const page = read('app/dashboard/patient/payment/page.tsx')
  assert.doesNotMatch(page, /NEXT_PUBLIC_TRANZILA_TERMINAL/)
  assert.doesNotMatch(page, /התור שלך אושר ומוכן/)
})

test('lifecycle emails carry no medical content', () => {
  const src = read('lib/appointments/lifecycle-emails.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const field of ['chief_complaint', 'complaint_description', 'diagnosis', 'rejection_reason', 'ai_summary', 'medical_history']) {
    assert.doesNotMatch(src, new RegExp(field), field)
  }
  assert.match(src, /שעון ישראל/)
  for (const t of ['appointment_request_doctor', 'appointment_approved', 'appointment_rejected', 'appointment_refund_initiated', 'appointment_refund_completed']) {
    assert.match(src, new RegExp(`case '${t}'`), t)
  }
})

test('migration 033: server-only decisions with locks; browsers cannot write payment/approval state', () => {
  const sql = read('supabase/migrations/033_appointment_approval_workflow.sql')
  assert.match(sql, /select \* into a from public\.appointments where id = p_appointment for update/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /revoke all on function public\.approve_appointment\(uuid, uuid, int\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.approve_appointment\(uuid, uuid, int\) to service_role/)
  assert.match(sql, /current_setting\('role', true\), 'none'\) not in \('authenticated', 'anon'\)/)
  assert.match(sql, /'completed', 'rejected'\n\s*\);/)
  assert.doesNotMatch(sql, /update public\.appointments set status = '(confirmed|pending_approval|rejected)' where (?!id = a\.id)/)
})
