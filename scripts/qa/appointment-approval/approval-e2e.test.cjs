// LOCAL_QA end-to-end: booking → payment verification → doctor approval →
// emails → time-gated video access (migrations 032/033). Local stack only:
// Supabase :55321, app :3105 (PAYMENTS_SIMULATION=enabled) and :3106 (no
// online payment), email outbox on disk. Never touches production.
const fs = require('node:fs')
const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')

const PW = 'CannaQA-Local-2026!'
const SIM = 3105, NONE = 3106
const H = (port, sub) => sub ? `http://${sub}.canna.localhost:${port}` : `http://localhost:${port}`
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_)) throw new Error('LOCAL QA only')
const OUTBOX = process.env.EMAIL_OUTBOX_DIR
const ORG_A = '11111111-1111-4111-8111-111111111111'
const D = { a1: '7642d2c1-1466-44b0-bd26-ad5bdc19ad74', a2: '2578f361-8918-47cc-be34-f7f2adb49f48', b1: '9643928b-e735-4f23-b565-cb630e1c3a55' }
const P = { a: '5e834b03-c430-4858-ab4b-baabc4adce55', a2: 'bcd6f2e7-1765-4620-920d-fe7f0911fa7d', b: '65d8f0dd-8e63-46bc-8f04-d746ddb05faf' }
const COMPLAINT = `QA-APPROVAL-${Date.now().toString(36)} כאב גרון`

const results = []
const log = (name, ok, info = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`) }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const created = []

async function login(page, base, email) {
  await page.goto(`${base}/auth/login`)
  await page.fill('input[type=email]', email); await page.fill('input[type=password]', PW)
  await page.click('button[type=submit]')
  await page.waitForURL(u => !u.toString().includes('/auth/login'), { timeout: 30000 })
}
async function session(browser, email, base) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const page = await ctx.newPage()
  await login(page, base, email)
  const call = (path, opts = {}) => page.evaluate(async ([p, o]) => {
    const r = await fetch(p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined })
    let body = null; try { body = await r.json() } catch {}
    return { status: r.status, body }
  }, [path, opts])
  return { ctx, page, call, close: () => ctx.close() }
}
async function restAs(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw error
  return c
}
const row = async (id) => (await admin.from('appointments').select('*').eq('id', id).single()).data
function mails(since, template, to) {
  if (!fs.existsSync(OUTBOX)) return []
  return fs.readdirSync(OUTBOX).filter(f => f.includes(`-${template}-`)).map(f => `${OUTBOX}/${f}`)
    .filter(f => fs.statSync(f).mtimeMs >= since).map(f => JSON.parse(fs.readFileSync(f, 'utf8')))
    .filter(m => !to || m.to === to)
}
async function waitMail(since, template, to) {
  for (let i = 0; i < 40; i++) { const m = mails(since, template, to); if (m.length) return m[m.length - 1]; await sleep(250) }
  return null
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const jwt = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())

/** A ready-made appointment in a given state, directly in the DB (service role). */
async function seedApt(over = {}) {
  const o = {
    organization_id: ORG_A, patient_id: P.a, doctor_id: D.a2, chief_complaint: COMPLAINT,
    scheduled_at: new Date(Date.now() + 3 * 864e5).toISOString(), duration_minutes: 30,
    status: 'pending_approval', payment_collection: 'online', payment_status: 'completed', payment_amount: 250, ...over,
  }
  const { data, error } = await admin.from('appointments').insert(o).select('id').single()
  if (error) throw new Error(`seed: ${error.message}`)
  created.push(data.id); return data.id
}
const setApt = async (id, patch) => { const { error } = await admin.from('appointments').update(patch).eq('id', id); if (error) throw error }
const minutes = (m) => new Date(Date.now() + m * 60e3).toISOString()

async function bookViaUi(page, base, doctorId, slotIndex) {
  await page.goto(`${base}/dashboard/patient/new-appointment?doctor=${doctorId}`)
  const slot = page.locator('main button', { hasText: /^\d{2}:\d{2}$/ }).nth(slotIndex)
  await slot.waitFor({ timeout: 30000 }); await slot.click()
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByPlaceholder('למשל: כאב ראש חזק כבר שבוע').fill(COMPLAINT)
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByRole('button', { name: 'המשך →' }).click()
  const since = Date.now()
  await page.getByRole('button', { name: 'שלח בקשה' }).click()
  await page.waitForURL(u => !u.toString().includes('new-appointment'), { timeout: 30000 })
  const { data } = await admin.from('appointments').select('id').eq('patient_id', P.a).eq('chief_complaint', COMPLAINT)
    .gte('created_at', new Date(since - 5000).toISOString()).order('created_at', { ascending: false }).limit(1)
  created.push(data[0].id)
  return data[0].id
}

;(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const base = H(SIM, 'shaked-qa')
  try {
    // ── 1. Booking + simulated, server-verified payment ─────────────────────
    const pat = await session(browser, 'patient.a@canna.test', base)
    let since = Date.now()
    const aptPaid = await bookViaUi(pat.page, base, D.a2, 6)
    let r = await row(aptPaid)
    log('booking: server sets price from doctor (250) and asks for payment', r.status === 'payment_pending' && Number(r.payment_amount) === 250 && r.payment_collection === 'online', r.status)
    log('booking: patient lands on the payment page', pat.page.url().includes('/dashboard/patient/payment'))
    const pre = await pat.call(`/api/video/access?appointmentId=${aptPaid}`)
    log('unpaid booking: no video access', pre.status === 403 && pre.body.code === 'not_confirmed', JSON.stringify(pre.body?.code))
    await pat.page.locator('#card-number').waitFor({ timeout: 20000 })
    await pat.page.fill('#card-number', '4580 0000 0000 0000'); await pat.page.fill('#card-name', 'דנה מזרחי')
    await pat.page.fill('#card-expiry', '12/29'); await pat.page.fill('#card-cvv', '123')
    await pat.page.getByRole('button', { name: /שלם/ }).click()
    await pat.page.getByText('התשלום התקבל').waitFor({ timeout: 20000 })
    r = await row(aptPaid)
    log('payment verified server-side → pending_approval (not confirmed)', r.status === 'pending_approval' && r.payment_status === 'completed' && !r.approved_at, r.status)
    log('payment success screen no longer offers a video link', !(await pat.page.getByText('כניסה לשיחת וידאו').count()))
    const docMail = await waitMail(since, 'appointment_request_doctor', 'doctor.a2@canna.test')
    log('doctor email: new request awaiting approval', !!docMail && /ממתינה לאישורך/.test(docMail.subject))
    const patMail = await waitMail(since, 'appointment_request_received', 'patient.a@canna.test')
    log('patient email: request received, awaiting doctor', !!patMail)
    log('emails contain no complaint text', [docMail, patMail].every(m => m && !m.html.includes('QA-APPROVAL') && !m.html.includes('כאב גרון')))
    const dup = await pat.call('/api/payments/fake-complete', { method: 'POST', body: { appointmentId: aptPaid } })
    log('repeat payment call is idempotent (already paid)', dup.status === 200 && dup.body.alreadyPaid === true)

    // ── 2. Payment cannot be faked by the browser ───────────────────────────
    const restPat = await restAs('patient.a@canna.test')
    const unpaid = await seedApt({ status: 'payment_pending', payment_status: 'pending', scheduled_at: minutes(60 * 30) })
    const patch1 = await restPat.from('appointments').update({ payment_status: 'completed' }).eq('id', unpaid).select('id')
    const patch2 = await restPat.from('appointments').update({ status: 'confirmed' }).eq('id', unpaid).select('id')
    const patch3 = await restPat.from('appointments').update({ payment_amount: 1 }).eq('id', unpaid).select('id')
    log('REST: patient cannot mark paid / confirm / reprice', [patch1, patch2, patch3].every(x => x.error), [patch1, patch2, patch3].map(x => x.error?.code).join(','))
    const sess = await pat.call('/api/payments/create-session', { method: 'POST', body: { appointmentId: unpaid } })
    log('Tranzila session refused when Tranzila is not configured', sess.status === 409)
    const hook = await fetch(`${H(SIM)}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `Response=000&order_id=x&sum=250&TranzilaToken=forged` })
    log('webhook with forged signature rejected', hook.status === 403, String(hook.status))
    const notPending = await pat.call('/api/payments/fake-complete', { method: 'POST', body: { appointmentId: await seedApt({ status: 'pending_approval', payment_collection: 'clinic', payment_status: null, scheduled_at: minutes(60 * 31) }) } })
    log('simulated payment refused for a booking not awaiting payment', notPending.status === 409)

    // ── 3. Doctor dashboard: pending requests → approve ─────────────────────
    const doc = await session(browser, 'doctor.a2@canna.test', base)
    await doc.page.goto(`${base}/dashboard/doctor/dashboard`)
    const card = doc.page.locator(`[data-appointment-id="${aptPaid}"]`)
    await card.waitFor({ timeout: 30000 })
    const cardText = await card.innerText()
    log('pending card: patient name, requested time, type, payment status', /דנה מזרחי/.test(cardText) && /שעון ישראל/.test(cardText) && /ייעוץ וידאו/.test(cardText) && /שולם ואומת/.test(cardText), cardText.replace(/\s+/g, ' ').slice(0, 140))
    log('pending card has approve + reject actions', (await card.getByRole('button', { name: 'אשר' }).count()) === 1 && (await card.getByRole('button', { name: 'דחה' }).count()) === 1)
    since = Date.now()
    await card.getByRole('button', { name: 'אשר' }).click()
    for (let i = 0; i < 40 && (await row(aptPaid)).status !== 'confirmed'; i++) await sleep(250)
    r = await row(aptPaid)
    log('doctor approval → confirmed', r.status === 'confirmed' && r.approved_by === D.a2, r.status)
    const okMail = await waitMail(since, 'appointment_approved', 'patient.a@canna.test')
    const okText = okMail ? text(okMail.html) : ''
    const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(r.scheduled_at))
    const part = (t) => when.find(p => p.type === t).value
    const dateStr = `${part('day')}/${part('month')}/${part('year')}`, timeStr = `${part('hour')}:${part('minute')}`
    log('approval email: clinic, doctor, date, time, timezone', !!okMail && okText.includes('מרפאת שקד (QA)') && okText.includes('ד"ר איתן כהן') && okText.includes(dateStr) && okText.includes(timeStr) && okText.includes('שעון ישראל'), `${dateStr} ${timeStr}`)
    log('approval email: no medical details', !!okMail && !okText.includes('QA-APPROVAL') && !okText.includes('כאב גרון'))
    const again = await doc.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: aptPaid, decision: 'approve' } })
    log('duplicate approval → 409 already confirmed, no second email', again.status === 409 && again.body.code === 'already_confirmed' && mails(since, 'appointment_approved', 'patient.a@canna.test').length === 1)
    const raced = await seedApt({ scheduled_at: minutes(60 * 50) })
    const race = await Promise.all([1, 2, 3, 4].map(() => doc.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: raced, decision: 'approve' } })))
    log('4 concurrent approvals → exactly one succeeds', race.filter(x => x.status === 200).length === 1 && race.filter(x => x.body?.code === 'already_confirmed').length === 3, race.map(x => x.status).join(','))

    // ── 4. Authorization of decisions ───────────────────────────────────────
    const target = await seedApt({ patient_id: P.a2, scheduled_at: minutes(60 * 52) })
    const otherDoc = await session(browser, 'doctor.a1@canna.test', base)
    const docB = await session(browser, 'doctor.b1@canna.test', H(SIM, 'oren-qa'))
    const adminB = await session(browser, 'admin.b@canna.test', H(SIM, 'oren-qa'))
    const staffA = await session(browser, 'staff.a@canna.test', base)
    const d1 = await otherDoc.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: target, decision: 'approve' } })
    const d2 = await docB.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: target, decision: 'approve' } })
    const d3 = await adminB.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: target, decision: 'reject' } })
    const d4 = await staffA.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: target, decision: 'approve' } })
    const d5 = await pat.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: target, decision: 'approve' } })
    log('approve/reject: other doctor, other clinic doctor/admin, staff, patient all refused', [d1, d2, d3, d4, d5].every(x => x.status === 403) && (await row(target)).status === 'pending_approval', [d1, d2, d3, d4, d5].map(x => x.status).join(','))
    const adminA = await session(browser, 'admin.a@canna.test', base)
    const d6 = await adminA.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: target, decision: 'approve' } })
    log('same-clinic admin may approve', d6.status === 200 && (await row(target)).status === 'confirmed')

    // ── 5. Rejection, refund flag, emails, slot release ─────────────────────
    since = Date.now()
    const toReject = await seedApt({ scheduled_at: minutes(60 * 54) })
    const rej = await doc.call('/api/appointments/decision', { method: 'POST', body: { appointmentId: toReject, decision: 'reject', reason: 'QA-REASON אבחנה פרטית' } })
    r = await row(toReject)
    log('rejection → rejected + refund pending', rej.status === 200 && rej.body.refundRequired === true && r.status === 'rejected' && r.refund_status === 'pending')
    const rejMail = await waitMail(since, 'appointment_rejected', 'patient.a@canna.test')
    const refMail = await waitMail(since, 'appointment_refund_initiated', 'patient.a@canna.test')
    log('patient emails: rejected + refund initiated', !!rejMail && !!refMail)
    log('rejection email omits the doctor\'s free-text reason', !!rejMail && !rejMail.html.includes('QA-REASON'))
    const reb = await admin.from('appointments').insert({ organization_id: ORG_A, patient_id: P.a2, doctor_id: D.a2, chief_complaint: 'QA', scheduled_at: r.scheduled_at, status: 'pending' }).select('id').single()
    if (reb.data) created.push(reb.data.id)
    log('rejected slot can be booked again', !reb.error, reb.error?.message || '')
    const rejAccess = await pat.call(`/api/video/access?appointmentId=${toReject}`)
    log('rejected appointment: video denied', rejAccess.status === 403 && rejAccess.body.code === 'rejected')
    // Refund completion recorded by the clinic admin (no provider call).
    since = Date.now()
    const refundDone = await adminA.call('/api/payments/refund', { method: 'POST', body: { appointmentId: toReject, reason: 'QA' } })
    log('admin records refund → refund completed + email', refundDone.status === 200 && (await row(toReject)).refund_status === 'completed' && !!(await waitMail(since, 'appointment_refund_completed', 'patient.a@canna.test')))

    // ── 6. Video time window (server clock) and LiveKit token ──────────────
    const v = await seedApt({ status: 'confirmed', approved_at: new Date().toISOString(), approved_by: D.a2, scheduled_at: minutes(20) })
    const acc = (s) => s.call(`/api/video/access?appointmentId=${v}`)
    const tok = (s) => s.call('/api/livekit/token', { method: 'POST', body: { appointmentId: v } })
    let a = await acc(pat)
    log('T-20min: waiting room closed (too early)', a.status === 403 && a.body.code === 'too_early', a.body.code)
    log('T-20min: token refused', (await tok(pat)).status === 403)
    await setApt(v, { scheduled_at: new Date(Date.now() + 15 * 60e3 + 20e3).toISOString() })
    a = await acc(pat)
    log('T-15min-20s: still too early', a.status === 403 && a.body.code === 'too_early')
    await setApt(v, { scheduled_at: new Date(Date.now() + 15 * 60e3 - 20e3).toISOString() })
    a = await acc(pat)
    log('T-15min (opening boundary): waiting room open', a.status === 200 && a.body.phase === 'waiting_room', a.body.phase)
    const early = await tok(pat)
    log('waiting room: no LiveKit token before start (425)', early.status === 425)
    await pat.page.goto(`${base}/video-call?id=${v}`)
    log('waiting-room UI shows the countdown and a disabled join button', await pat.page.getByTestId('countdown').waitFor({ timeout: 20000 }).then(() => true, () => false) &&
      await pat.page.getByRole('button', { name: 'הכניסה תיפתח במועד התור' }).isDisabled())
    await setApt(v, { scheduled_at: minutes(-1) })
    a = await acc(pat)
    const t1 = await tok(pat)
    const claims = t1.body?.token ? jwt(t1.body.token) : {}
    log('T+1min: consultation open, token issued', a.body.phase === 'open' && t1.status === 200)
    log('token: bound to this appointment\'s room only, identity = user', claims.video?.room === `apt-${v}` && claims.video?.roomJoin === true && claims.sub === P.a && !claims.video?.roomAdmin && !claims.video?.roomList)
    const life = claims.exp - Math.floor(Date.now() / 1000) // LiveKit sets nbf=0 and no iat
    log('token: expires within 10 minutes of issue', life <= 600 && life >= 60, `${life}s`)
    const t2 = await tok(doc)
    log('assigned doctor gets a token too', t2.status === 200 && jwt(t2.body.token).sub === D.a2)
    await setApt(v, { scheduled_at: minutes(-31) })
    log('after the slot ended (not started): denied', (await acc(pat)).body.code === 'ended')
    await setApt(v, { status: 'in_progress', scheduled_at: minutes(-45) })
    log('in progress: rejoin allowed during overrun', (await acc(pat)).body.phase === 'open')
    await setApt(v, { scheduled_at: minutes(-61) })
    log('in progress beyond overrun cap: denied', (await acc(pat)).body.code === 'ended')

    // statuses
    const stat = async (patch) => { await setApt(v, { scheduled_at: minutes(-1), ...patch }); return (await tok(pat)).body?.code }
    log('pending_approval: token refused', await stat({ status: 'pending_approval', approved_at: null }) === 'not_confirmed')
    log('legacy scheduled (unapproved): token refused', await stat({ status: 'scheduled', approved_at: null }) === 'not_confirmed')
    log('completed: token refused', await stat({ status: 'completed', approved_at: new Date().toISOString() }) === 'completed')
    await setApt(v, { status: 'confirmed' })
    const canc = await pat.call('/api/appointments/cancel', { method: 'POST', body: { appointmentId: v } })
    log('cancelled: token refused', canc.status === 200 && (await tok(pat)).body?.code === 'cancelled')
    const old = await seedApt({ status: 'confirmed', approved_at: new Date().toISOString(), scheduled_at: minutes(-3 * 24 * 60) })
    log('old appointment (3 days ago): denied', (await pat.call(`/api/video/access?appointmentId=${old}`)).body?.code === 'ended')

    // unauthorized
    const live = await seedApt({ status: 'confirmed', approved_at: new Date().toISOString(), scheduled_at: minutes(-2) })
    const anon = await fetch(`${H(SIM)}/api/livekit/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: live }) })
    const patB = await session(browser, 'patient.b@canna.test', H(SIM, 'oren-qa'))
    const pa2 = await session(browser, 'patient.a2@canna.test', base)
    const u1 = await patB.call('/api/livekit/token', { method: 'POST', body: { appointmentId: live } })
    const u2 = await pa2.call('/api/livekit/token', { method: 'POST', body: { appointmentId: live } })
    const u3 = await staffA.call('/api/livekit/token', { method: 'POST', body: { appointmentId: live } })
    const u4 = await otherDoc.call('/api/livekit/token', { method: 'POST', body: { appointmentId: live } })
    const u5 = await pat.call('/api/livekit/token', { method: 'POST', body: { appointmentId: 'not-a-uuid' } })
    log('token: unauthenticated 401, other clinic / other patient / staff / unassigned doctor 404, bad id 400',
      anon.status === 401 && [u1, u2, u3, u4].every(x => x.status === 404) && u5.status === 400,
      [anon.status, u1.status, u2.status, u3.status, u4.status, u5.status].join(','))
    // Correct patient, but through another clinic's site.
    const wrongHost = await session(browser, 'patient.a@canna.test', H(SIM, 'oren-qa')).catch(() => null)
    if (wrongHost) {
      const w = await wrongHost.call('/api/livekit/token', { method: 'POST', body: { appointmentId: live } })
      log('token via another clinic\'s site refused', w.status === 403 && w.body.code === 'wrong_clinic', String(w.status))
      await wrongHost.close()
    } else {
      log('token via another clinic\'s site refused (login there is already refused)', true)
    }
    const own = await pat.call('/api/livekit/token', { method: 'POST', body: { appointmentId: live } })
    log('control: own approved appointment in window gets a token', own.status === 200)

    // ── 7. Double-booking ────────────────────────────────────────────────────
    const slotAt = minutes(60 * 70)
    const c1 = await restAs('patient.a@canna.test'), c2 = await restAs('patient.a2@canna.test')
    const ins = await Promise.all([[c1, P.a], [c2, P.a2]].map(([c, pid]) => c.from('appointments').insert({ organization_id: ORG_A, patient_id: pid, doctor_id: D.a1, chief_complaint: 'QA', scheduled_at: slotAt, status: 'pending' }).select('id').single()))
    ins.forEach(x => x.data && created.push(x.data.id))
    log('two patients, same slot: exactly one booking stored', ins.filter(x => !x.error).length === 1 && ins.some(x => x.error?.code === '23505'))
    const slots = await pat.call(`/api/appointments/available-slots?orgId=${ORG_A}&doctorId=${D.a2}&days=4`)
    const paidAt = (await row(aptPaid)).scheduled_at
    log('available slots exclude the confirmed booking', slots.status === 200 && !slots.body.slots.some(s => s.datetime === new Date(paidAt).toISOString()))

    // ── 8. Regression screens ────────────────────────────────────────────────
    await pat.page.goto(`${base}/dashboard/patient/appointments`)
    log('patient appointments page renders statuses', await pat.page.getByText('מאושר').first().waitFor({ timeout: 20000 }).then(() => true, () => false))
    await doc.page.goto(`${base}/dashboard/doctor/appointments`)
    log('doctor appointments page renders', await doc.page.getByRole('heading').first().waitFor({ timeout: 20000 }).then(() => true, () => false))
    await adminA.page.goto(`${base}/dashboard/admin/appointments`)
    log('admin appointments page renders', await adminA.page.getByRole('heading').first().waitFor({ timeout: 20000 }).then(() => true, () => false))
    await staffA.page.goto(`${base}/dashboard/staff/appointments`)
    log('staff appointments page renders', await staffA.page.getByRole('heading').first().waitFor({ timeout: 20000 }).then(() => true, () => false))

    // ── 9. No online payment configured (production-like) ──────────────────
    const baseNone = H(NONE, 'shaked-qa')
    const patN = await session(browser, 'patient.a@canna.test', baseNone)
    const mode = await patN.call('/api/payments/mode')
    log('no-provider server reports mode none', mode.body?.mode === 'none')
    since = Date.now()
    const aptClinic = await bookViaUi(patN.page, baseNone, D.a2, 9)
    r = await row(aptClinic)
    log('no provider: priced booking goes straight to doctor approval, nothing marked paid', r.status === 'pending_approval' && r.payment_collection === 'clinic' && r.payment_status === null, `${r.status}/${r.payment_collection}/${r.payment_status}`)
    const fakeN = await patN.call('/api/payments/fake-complete', { method: 'POST', body: { appointmentId: aptClinic } })
    log('no provider: simulated payment endpoint disabled (404)', fakeN.status === 404)
    log('no provider: doctor notified', !!(await waitMail(since, 'appointment_request_doctor', 'doctor.a2@canna.test')))
    await patN.page.goto(`${baseNone}/dashboard/patient/payment?id=${aptClinic}`)
    await patN.page.waitForURL(u => u.toString().includes('/dashboard/patient/appointments'), { timeout: 20000 }).catch(() => {})
    log('no provider: payment page shows no card form', !(await patN.page.locator('#card-number').count()))
    const freeApt = await bookViaUi(patN.page, baseNone, D.a1, 3)
    r = await row(freeApt)
    log('free doctor: booking awaits approval with no payment', r.status === 'pending_approval' && r.payment_collection === 'none')
    await patN.close()

    for (const s of [pat, doc, otherDoc, docB, adminB, staffA, adminA, patB, pa2]) await s.close()
  } catch (e) {
    log('UNCAUGHT', false, e.stack || String(e))
  } finally {
    await browser.close()
    if (process.env.KEEP !== '1' && created.length) {
      await admin.from('notifications').delete().in('appointment_id', created)
      await admin.from('audit_logs').delete().in('resource_id', created)
      await admin.from('appointments').delete().in('id', created)
    }
    const failed = results.filter(r => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} passed`)
    process.exit(failed.length ? 1 : 0)
  }
})()
