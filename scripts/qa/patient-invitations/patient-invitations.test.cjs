// LOCAL_QA end-to-end tests: patient invitations + single-clinic membership
// (migration 031). Local stack only (Supabase :55321, app :3105, email outbox).
const fs = require('node:fs')
const { chromium, request } = require('playwright')
const { createClient } = require('@supabase/supabase-js')

const PORT = 3105, PW = 'CannaQA-Local-2026!'
const H = (sub) => sub ? `http://${sub}.canna.localhost:${PORT}` : `http://localhost:${PORT}`
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const OUTBOX = process.env.EMAIL_OUTBOX_DIR
const MAILPIT = 'http://127.0.0.1:55324'
const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001'
const ORG_A = '11111111-1111-4111-8111-111111111111', ORG_B = '22222222-2222-4222-8222-222222222222'
const D = { a1: '7642d2c1-1466-44b0-bd26-ad5bdc19ad74', a2: '2578f361-8918-47cc-be34-f7f2adb49f48', b1: '9643928b-e735-4f23-b565-cb630e1c3a55' }
const RUN = Date.now().toString(36)
const mail = (tag) => `pinv-${tag}-${RUN}@qa-pinv.test`
const ONLY = process.argv.slice(2)

const results = []
const log = (name, ok, info = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`) }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── helpers ───────────────────────────────────────────────────
async function login(page, base, email, pw = PW) {
  await page.goto(`${base}/auth/login`)
  await page.fill('input[type=email]', email); await page.fill('input[type=password]', pw)
  await page.click('button[type=submit]')
  await page.waitForURL(u => !u.toString().includes('/auth/login'), { timeout: 20000 })
}

async function session(browser, email, sub = null) {
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, H(sub), email)
  const call = (path, opts = {}) => page.evaluate(async ([p, o]) => {
    const r = await fetch(p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined })
    let body = null; try { body = await r.json() } catch {}
    return { status: r.status, body }
  }, [path, opts])
  return { ctx, page, call, close: () => ctx.close() }
}

function outboxInvite(email, since) {
  if (!fs.existsSync(OUTBOX)) return null
  const files = fs.readdirSync(OUTBOX).filter(f => f.includes('-patient_invite-')).map(f => `${OUTBOX}/${f}`)
    .filter(f => fs.statSync(f).mtimeMs >= since).sort()
  for (const f of files.reverse()) {
    const m = JSON.parse(fs.readFileSync(f, 'utf8'))
    if (m.to !== email) continue
    const link = (m.html.match(/href="([^"]*\/auth\/invite\/[0-9a-f-]{36})"/) || [])[1]
    return { ...m, link, token: link?.split('/').pop() }
  }
  return null
}

async function waitOutbox(email, since) {
  for (let i = 0; i < 20; i++) { const m = outboxInvite(email, since); if (m) return m; await sleep(250) }
  return null
}

async function confirmationLink(email) {
  for (let i = 0; i < 40; i++) {
    const s = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()
    const id = s.messages?.[0]?.ID
    if (id) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()
      const href = ((m.HTML || m.Text || '').match(/https?:\/\/[^"\s]*\/auth\/v1\/verify[^"\s]*/) || [])[0]
      if (href) return href.replace(/&amp;/g, '&')
    }
    await sleep(500)
  }
  return null
}

/** Open the real confirmation link. The local GoTrue allow-list knows only its
 *  own site URL, so it sends the auth code there; hand that code to the
 *  callback on the host the patient registered on — what the production
 *  allow-list does for clinic sites. The PKCE verifier stays in the browser. */
async function openConfirmation(page, link, base, extra = '') {
  const res = await fetch(link, { redirect: 'manual' })
  const loc = res.headers.get('location') || ''
  const code = new URL(loc, 'http://x').searchParams.get('code')
  if (!code) throw new Error(`no auth code in redirect: ${loc.slice(0, 80)}`)
  await page.goto(`${base}/api/auth/callback?code=${code}${extra}`)
  await page.waitForLoadState('networkidle').catch(() => {})
}

async function userRow(email) {
  const { data } = await admin.from('users').select('id, role, organization_id').ilike('email', email)
  return data || []
}
async function invRow(id) {
  return (await admin.from('invitations').select('*').eq('id', id).single()).data
}
async function createMarketplacePatient(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { first_name: 'שוק', last_name: 'פתוח' } })
  if (error) throw error
  return data.user.id
}
async function registerViaInvite(page, link, first = 'מטופלת', last = 'מוזמנת') {
  await page.goto(link)
  await page.getByLabel('שם פרטי').fill(first); await page.getByLabel('שם משפחה').fill(last)
  await page.getByLabel('סיסמה', { exact: true }).fill(PW); await page.getByLabel('אימות סיסמה').fill(PW)
  await page.getByRole('checkbox', { name: /תנאי השימוש/ }).check()
  await page.getByRole('button', { name: 'השלם הרשמה' }).click()
}

async function book(page, base, doctorId) {
  await page.goto(`${base}/dashboard/patient/new-appointment?doctor=${doctorId}`)
  const slot = page.locator('main button', { hasText: /^\d{2}:\d{2}$/ }).nth(4)
  await slot.waitFor({ timeout: 20000 }); await slot.click()
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByPlaceholder('למשל: כאב ראש חזק כבר שבוע').fill('בדיקת QA להזמנת מטופל')
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByRole('button', { name: 'שלח בקשה' }).click()
  await page.waitForURL(u => !u.toString().includes('new-appointment'), { timeout: 20000 })
}

const has = (page, text) => page.getByText(text).first().waitFor({ state: 'attached', timeout: 15000 }).then(() => true, () => false)
const ids = (rows) => (rows || []).map(r => r.id)

// ── scenarios ─────────────────────────────────────────────────
const S = {}
const shared = {}

S.adminInvitesNewPatient = async (browser) => {
  const email = mail('new'); const since = Date.now() - 1000
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  const r = await a.call('/api/patient-invitations', { method: 'POST', body: { email, name: 'דנה' } })
  log('admin invites new patient → 201 sent', r.status === 201 && r.body?.outcome === 'sent' && r.body.emailSent === true, JSON.stringify(r))
  log('create response never includes the link when the email was sent', r.body && !('inviteUrl' in r.body && r.body.inviteUrl))
  const inv = await invRow(r.body.invitationId)
  log('invitation row: patient role, admin\'s clinic, inviter recorded', inv?.role === 'patient' && inv.organization_id === ORG_A && inv.invited_by && inv.used_at === null)
  const days = (new Date(inv.expires_at) - Date.now()) / 86400000
  log('invitation expires in 7 days', days > 6.9 && days <= 7.01, days.toFixed(2))
  const m = await waitOutbox(email, since)
  log('email delivered to the invitee', !!m?.link, m?.subject)
  log('email branded with the clinic name', m?.subject?.includes('מרפאת שקד') && m.html.includes('מרפאת שקד'))
  log('email link points at the clinic subdomain', m?.link?.startsWith(`${H('shaked-qa')}/auth/invite/`), m?.link)
  log('email link token = invitation token', m?.token === inv.token)
  const { data: aud } = await admin.from('audit_logs').select('action, metadata').eq('resource_id', inv.id).eq('action', 'patient_invited')
  log('audit: patient_invited recorded (no token in it)', aud?.length === 1 && !JSON.stringify(aud).includes(inv.token))
  shared.newInvite = { email, id: inv.id, link: m.link, token: inv.token }

  // From the central site the link still goes to the clinic's own site.
  const a2 = await session(browser, 'admin.a@canna.test', null)
  const email2 = mail('central'); const since2 = Date.now() - 1000
  const r2 = await a2.call('/api/patient-invitations', { method: 'POST', body: { email: email2 } })
  const m2 = await waitOutbox(email2, since2)
  log('invite sent from central site → link on the clinic subdomain', r2.status === 201 && m2?.link?.startsWith(`${H('shaked-qa')}/auth/invite/`), m2?.link)

  // Duplicate
  const dup = await a.call('/api/patient-invitations', { method: 'POST', body: { email: email.toUpperCase() } })
  const { count } = await admin.from('invitations').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_A).ilike('email', email)
  log('duplicate invitation (any case) → no second invitation', dup.status === 200 && dup.body?.outcome === 'duplicate' && count === 1, JSON.stringify(dup.body))

  // Same-clinic member and staff
  const same = await a.call('/api/patient-invitations', { method: 'POST', body: { email: 'patient.a2@canna.test' } })
  log('inviting a patient already in this clinic → 409 explained', same.status === 409 && /כבר רשום/.test(same.body?.error || ''), same.body?.error)
  const staff = await a.call('/api/patient-invitations', { method: 'POST', body: { email: 'staff.a@canna.test' } })
  log('inviting own staff member → 409', staff.status === 409)
  const bad = await a.call('/api/patient-invitations', { method: 'POST', body: { email: 'not-an-email' } })
  log('invalid email → 400', bad.status === 400)
  await a.close(); await a2.close()
}

S.doctorInvitesAndScopes = async (browser) => {
  const email = mail('bydoc'); const since = Date.now() - 1000
  const d = await session(browser, 'doctor.a1@canna.test', 'shaked-qa')
  const r = await d.call('/api/patient-invitations', { method: 'POST', body: { email } })
  const m = await waitOutbox(email, since)
  const inv = r.body?.invitationId && await invRow(r.body.invitationId)
  log('doctor invites new patient → 201, own clinic, email sent', r.status === 201 && inv?.organization_id === ORG_A && inv.invited_by === D.a1 && !!m?.link, JSON.stringify(r.body))
  log('doctor\'s email names the doctor as inviter', m?.html?.includes('ד"ר') || m?.html?.includes('ד&quot;ר'))
  shared.doctorInvite = { email, id: inv.id, link: m.link, token: inv.token }

  const list = await d.call('/api/patient-invitations')
  const emails = (list.body?.invitations || []).map(i => i.email)
  log('doctor list: only invitations the doctor sent', emails.includes(email) && !emails.includes(shared.newInvite.email), emails.length)
  log('list never returns tokens', !JSON.stringify(list.body).includes(inv.token))
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  const al = (await a.call('/api/patient-invitations')).body?.invitations || []
  log('admin list: every patient invitation of the clinic', al.some(i => i.email === email) && al.some(i => i.email === shared.newInvite.email) && al.every(i => i.status))
  log('admin list shows who invited', al.find(i => i.email === email)?.invited_by_name?.includes('ד"ר'))
  const b = await session(browser, 'admin.b@canna.test', 'oren-qa')
  const bl = (await b.call('/api/patient-invitations')).body?.invitations || []
  log('other clinic\'s admin sees none of these invitations', !bl.some(i => i.email === email || i.email === shared.newInvite.email))

  // Cross-clinic management attempts
  const xr = await b.call(`/api/patient-invitations/${inv.id}`, { method: 'POST', body: { action: 'revoke' } })
  log('other clinic\'s admin cannot revoke → 404', xr.status === 404)
  const xs = await b.call(`/api/patient-invitations/${inv.id}`, { method: 'POST', body: { action: 'resend' } })
  log('other clinic\'s admin cannot resend → 404', xs.status === 404)
  const d2 = await session(browser, 'doctor.a2@canna.test', 'shaked-qa')
  const dr = await d2.call(`/api/patient-invitations/${inv.id}`, { method: 'POST', body: { action: 'revoke' } })
  log('another doctor of the same clinic cannot revoke it → 404', dr.status === 404)
  log('invitation untouched by those attempts', (await invRow(inv.id)).revoked_at === null)
  await d.close(); await a.close(); await b.close(); await d2.close()
}

S.unauthorized = async (browser) => {
  const api = await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, extraHTTPHeaders: { host: `shaked-qa.canna.localhost:${PORT}` } })
  log('anonymous: create → 401', (await api.post('/api/patient-invitations', { data: { email: mail('x') } })).status() === 401)
  log('anonymous: list → 401', (await api.get('/api/patient-invitations')).status() === 401)
  await api.dispose()
  for (const [who, sub] of [['patient.a@canna.test', 'shaked-qa'], ['staff.a@canna.test', 'shaked-qa']]) {
    const s = await session(browser, who, sub)
    const r = await s.call('/api/patient-invitations', { method: 'POST', body: { email: mail('nope') } })
    const l = await s.call('/api/patient-invitations')
    log(`${who}: cannot invite or list (403)`, r.status === 403 && l.status === 403)
    await s.close()
  }
  // Doctor of clinic A on clinic B's site
  const d = await session(browser, 'doctor.a1@canna.test', 'oren-qa')
  const r = await d.call('/api/patient-invitations', { method: 'POST', body: { email: mail('xsite') } })
  log('doctor of clinic A on clinic B\'s site → 403', r.status === 403)
  const { count } = await admin.from('invitations').select('id', { count: 'exact', head: true }).ilike('email', mail('xsite'))
  log('…and no invitation was created', count === 0)
  await d.close()
  // Body cannot choose the clinic
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  const e = mail('spoof')
  await a.call('/api/patient-invitations', { method: 'POST', body: { email: e, organization_id: ORG_B, organizationId: ORG_B } })
  const { data: sp } = await admin.from('invitations').select('organization_id').ilike('email', e)
  log('client-supplied organization_id ignored (invitation in inviter\'s clinic)', sp?.length === 1 && sp[0].organization_id === ORG_A)
  await a.close()

  // Direct database access
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
  const rpc = await anon.rpc('accept_patient_invitation', { p_token: shared.newInvite.token, p_user: D.a1 })
  log('anon cannot call accept_patient_invitation', !!rpc.error, rpc.error?.code)
  const rpc2 = await anon.rpc('claim_patient_clinic', { p_user: D.a1, p_org: ORG_B })
  log('anon cannot call claim_patient_clinic', !!rpc2.error, rpc2.error?.code)
  for (const who of ['patient.a@canna.test', 'doctor.a1@canna.test']) {
    const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
    await sb.auth.signInWithPassword({ email: who, password: PW })
    const sel = await sb.from('invitations').select('token').eq('role', 'patient')
    log(`${who}: cannot read invitation tokens directly`, (sel.data || []).length === 0)
    const ac = await sb.rpc('accept_patient_invitation', { p_token: shared.newInvite.token, p_user: (await sb.auth.getUser()).data.user.id })
    log(`${who}: cannot call accept_patient_invitation directly`, !!ac.error, ac.error?.code)
    const tr = await sb.rpc('transfer_patient_clinic', { p_patient: D.a1, p_to_org: ORG_B, p_actor: D.a1, p_reason: 'attack' })
    log(`${who}: cannot call transfer_patient_clinic`, !!tr.error, tr.error?.code)
    const ins = await sb.from('invitations').insert({ organization_id: ORG_A, email: 'x@y.z', role: 'patient' })
    log(`${who}: cannot insert invitations directly`, !!ins.error)
  }
  const svcTr = await admin.rpc('transfer_patient_clinic', { p_patient: D.a1, p_to_org: ORG_B, p_actor: D.a1, p_reason: 'service role attempt' })
  log('even the API service role cannot run the transfer function', !!svcTr.error, svcTr.error?.code)
}

S.newPatientCompletesRegistration = async (browser) => {
  const { email, link, id } = shared.newInvite
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(link)
  log('invite page: new email → registration form', await page.getByLabel('שם פרטי').waitFor({ timeout: 15000 }).then(() => true, () => false))
  log('invite page shows the clinic name', await has(page, 'מרפאת שקד'))
  await registerViaInvite(page, link, 'דנה', 'מוזמנת')
  await page.getByText('כמעט סיימנו — אמת את האימייל').waitFor({ timeout: 15000 })
  log('registration → asked to verify email', true)
  const before = await userRow(email)
  log('before verification: patient exists but in no clinic', before.length === 1 && before[0].organization_id === DEFAULT_ORG && before[0].role === 'patient', JSON.stringify(before))
  log('before verification: invitation still pending', (await invRow(id)).used_at === null)
  const conf = await confirmationLink(email)
  log('verification email delivered (auth)', !!conf)
  await openConfirmation(page, conf, H('shaked-qa'), `&invite=${shared.newInvite.token}`)
  console.log('   after confirmation →', page.url())
  await page.getByTestId('invite-result').waitFor({ state: 'attached', timeout: 20000 })
  log('after verification: back on the invitation, joined', await has(page, 'ההצטרפות הושלמה'), page.url())
  log('stays on the clinic subdomain', page.url().startsWith(H('shaked-qa')))
  const after = await userRow(email)
  log('patient now belongs to the inviting clinic', after.length === 1 && after[0].organization_id === ORG_A && after[0].role === 'patient')
  const inv = await invRow(id)
  log('invitation accepted (used_at, accepted_by)', !!inv.used_at && inv.accepted_by === after[0].id)
  const { data: aud } = await admin.from('audit_logs').select('id').eq('resource_id', id).eq('action', 'patient_invite_accepted')
  log('audit: patient_invite_accepted recorded', aud?.length === 1)
  await page.getByRole('link', { name: 'מעבר לאזור האישי' }).click()
  await page.waitForURL(/\/dashboard\/patient\//, { timeout: 15000 })
  log('patient dashboard on the clinic subdomain', page.url().startsWith(`${H('shaked-qa')}/dashboard/patient/`), page.url())
  const docs = await page.evaluate(async () => (await (await fetch('/api/doctors')).json()).doctors.map(d => d.id))
  log('doctor directory: only the clinic\'s doctors', docs.includes(D.a1) && docs.includes(D.a2) && !docs.includes(D.b1), docs.length)
  await book(page, H('shaked-qa'), D.a1)
  const { data: apt } = await admin.from('appointments').select('organization_id, doctor_id').eq('patient_id', after[0].id).maybeSingle()
  log('booking after acceptance: appointment with the clinic\'s doctor', apt?.doctor_id === D.a1 && apt.organization_id === ORG_A, JSON.stringify(apt))
  // Replay: the same link again
  await page.goto(link)
  log('replay by the same patient: shows already accepted, no change', await has(page, 'ההצטרפות הושלמה'))
  const again = await page.evaluate(async (t) => { const r = await fetch('/api/auth/invite-accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) }); return { s: r.status, b: await r.json() } }, shared.newInvite.token)
  log('replay accept → already member, still one clinic', again.s === 200 && again.b.outcome === 'already_member' && (await userRow(email))[0].organization_id === ORG_A)
  shared.newPatientId = after[0].id
  await ctx.close()

  // Central-site directory for this clinic patient
  const c = await session(browser, email, null)
  const cd = (await c.call('/api/doctors')).body
  log('central site: clinic patient sees only own clinic\'s doctors', cd.scope === 'clinic' && cd.doctors.every(d => d.organization_id === ORG_A))
  await c.close()
}

S.replayByOtherUser = async (browser) => {
  const s = await session(browser, 'patient.a2@canna.test', 'shaked-qa')
  const r = await s.call('/api/auth/invite-accept', { method: 'POST', body: { token: shared.newInvite.token } })
  log('used invitation replayed by another account → refused', r.status === 409 && r.body?.outcome === 'used', JSON.stringify(r.body))
  // Email mismatch on a live invitation
  const r2 = await s.call('/api/auth/invite-accept', { method: 'POST', body: { token: shared.doctorInvite.token } })
  log('someone else\'s live invitation → email mismatch, refused', r2.status === 403 && r2.body?.outcome === 'email_mismatch')
  log('…and it stays pending', (await invRow(shared.doctorInvite.id)).used_at === null)
  await s.page.goto(shared.doctorInvite.link)
  log('invite page for a different signed-in account explains the mismatch', await has(s.page, 'מחובר/ת בחשבון אחר'))
  const r3 = await s.call('/api/auth/invite-accept', { method: 'POST', body: { token: '11111111-2222-4333-8444-555555555555' } })
  log('unknown token → 404', r3.status === 404)
  await s.close()
}

S.existingMarketplacePatient = async (browser) => {
  const email = mail('existing'); const uid = await createMarketplacePatient(email)
  log('existing marketplace patient starts in no clinic', (await userRow(email))[0]?.organization_id === DEFAULT_ORG)
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa'); const since = Date.now() - 1000
  const r = await a.call('/api/patient-invitations', { method: 'POST', body: { email } })
  const m = await waitOutbox(email, since)
  log('invitation to an existing account → same response as a new email', r.status === 201 && r.body.outcome === 'sent' && !!m?.link)
  await a.close()
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(m.link)
  const offered = await page.getByTestId('invite-existing-account').waitFor({ state: 'attached', timeout: 15000 }).then(() => true, () => false)
  log('logged out: offered sign-in, NOT registration', offered && !(await page.getByLabel('שם פרטי').isVisible().catch(() => false)))
  await page.getByRole('link', { name: 'התחברות ואישור ההזמנה' }).click()
  await page.fill('input[type=email]', email); await page.fill('input[type=password]', PW)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/auth\/invite\//, { timeout: 20000 })
  log('after sign-in: back on the invitation to review it', await has(page, 'אישור ההזמנה והצטרפות'))
  log('no change before clicking accept', (await userRow(email))[0].organization_id === DEFAULT_ORG)
  await page.getByRole('button', { name: /אישור ההזמנה והצטרפות/ }).click()
  await page.waitForURL(/\/dashboard\/patient\//, { timeout: 20000 })
  log('accept → patient dashboard on the clinic subdomain', page.url().startsWith(`${H('shaked-qa')}/dashboard/patient/`), page.url())
  const rows = await userRow(email)
  log('same account kept (no duplicate user, same id)', rows.length === 1 && rows[0].id === uid)
  log('existing patient joined the inviting clinic', rows[0].organization_id === ORG_A)
  const { data: au } = await admin.auth.admin.getUserById(uid)
  log('auth identity unchanged (same email, still confirmed)', au.user?.email === email && !!au.user?.email_confirmed_at)
  await ctx.close()
}

S.existingPatientSameClinic = async (browser) => {
  // Invitation rows for an existing member can only come from before they
  // joined; create one directly to exercise the acceptance path.
  const { data: inv } = await admin.from('invitations').insert({ organization_id: ORG_A, email: 'patient.a2@canna.test', role: 'patient', send_count: 1 }).select('id, token').single()
  const s = await session(browser, 'patient.a2@canna.test', 'shaked-qa')
  await s.page.goto(`${H('shaked-qa')}/auth/invite/${inv.token}`)
  await s.page.getByRole('button', { name: /אישור ההזמנה והצטרפות/ }).click()
  await s.page.getByTestId('invite-result').waitFor({ state: 'attached', timeout: 15000 })
  log('existing patient of the same clinic → "already a member"', await has(s.page, 'כבר חבר/ה במרפאה הזו'))
  log('membership unchanged', (await userRow('patient.a2@canna.test'))[0].organization_id === ORG_A)
  await s.close()
}

S.existingPatientOtherClinic = async (browser) => {
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa'); const since = Date.now() - 1000
  const r = await a.call('/api/patient-invitations', { method: 'POST', body: { email: 'patient.b@canna.test' } })
  log('inviting another clinic\'s patient → generic "sent" (no leak)', r.status === 201 && r.body.outcome === 'sent' && !JSON.stringify(r.body).includes('אחרת'), JSON.stringify(r.body))
  const m = await waitOutbox('patient.b@canna.test', since)
  const s = await session(browser, 'patient.b@canna.test', 'shaked-qa')
  await s.page.goto(m.link)
  await s.page.getByRole('button', { name: /אישור ההזמנה והצטרפות/ }).click()
  await s.page.getByTestId('invite-result').waitFor({ state: 'attached', timeout: 15000 })
  const html = await s.page.content()
  log('patient of another clinic → blocked with clear explanation', html.includes('כבר משויך למרפאה אחרת') && html.includes('תהליך העברה'))
  log('…and given a support/transfer path', html.includes('medical@cannaforyou.net'))
  log('patient NOT moved (still clinic B)', (await userRow('patient.b@canna.test'))[0].organization_id === ORG_B)
  const inv = await invRow(r.body.invitationId)
  log('invitation stays pending (not consumed)', inv.used_at === null)
  const list = (await a.call('/api/patient-invitations')).body.invitations
  log('inviting clinic sees only "pending" — not that the patient is elsewhere', list.find(i => i.id === inv.id)?.status === 'pending')
  const { data: aud } = await admin.from('audit_logs').select('organization_id, action').eq('resource_id', inv.id)
  log('no audit entry about the other clinic in either clinic', !aud.some(x => x.action !== 'patient_invited'))
  // Other blocked paths for the same patient
  const j = await s.call('/api/patient/join-clinic', { method: 'POST', body: { doctorId: D.a1 } })
  log('join-clinic (marketplace booking) cannot move a clinic patient', j.status !== 200 && (await userRow('patient.b@canna.test'))[0].organization_id === ORG_B, `${j.status}`)
  const c = await createClient(URL_, ANON, { auth: { persistSession: false } })
  await c.auth.signInWithPassword({ email: 'patient.b@canna.test', password: PW })
  const self = await c.from('users').update({ organization_id: ORG_A }).eq('id', (await c.auth.getUser()).data.user.id).select('id')
  log('patient cannot change own clinic directly', !!self.error || (self.data || []).length === 0)
  const pid = (await userRow('patient.b@canna.test'))[0].id
  const svc = await admin.from('users').update({ organization_id: ORG_A }).eq('id', pid).select('id')
  log('DB trigger: even a service-role write cannot move a clinic patient', svc.error?.code === '23514', svc.error?.code)
  const svc2 = await admin.from('users').update({ organization_id: DEFAULT_ORG }).eq('id', pid).select('id')
  log('DB trigger: cannot silently detach a clinic patient either', svc2.error?.code === '23514')
  log('patient B still in clinic B', (await userRow('patient.b@canna.test'))[0].organization_id === ORG_B)
  await a.close(); await s.close()
}

S.concurrentInvitations = async (browser) => {
  let ok = 0, both = 0
  for (let i = 0; i < 4; i++) {
    const email = mail(`race${i}`); await createMarketplacePatient(email)
    const [ia, ib] = await Promise.all([
      admin.from('invitations').insert({ organization_id: ORG_A, email, role: 'patient', send_count: 1 }).select('token').single(),
      admin.from('invitations').insert({ organization_id: ORG_B, email, role: 'patient', send_count: 1 }).select('token').single(),
    ])
    const s = await session(browser, email, null)
    const [ra, rb] = await Promise.all([
      s.call('/api/auth/invite-accept', { method: 'POST', body: { token: ia.data.token } }),
      s.call('/api/auth/invite-accept', { method: 'POST', body: { token: ib.data.token } }),
    ])
    const joined = [ra, rb].filter(r => r.body?.outcome === 'joined').length
    const blocked = [ra, rb].filter(r => r.body?.outcome === 'other_clinic').length
    const org = (await userRow(email))[0].organization_id
    const winner = ra.body?.outcome === 'joined' ? ORG_A : ORG_B
    if (joined === 1 && blocked === 1 && org === winner) ok++
    if (joined === 2) both++
    await s.close()
  }
  log('concurrent acceptance of two clinics\' invitations: exactly one wins (4/4 runs)', ok === 4 && both === 0, `ok=${ok} both=${both}`)

  // Database-level race (two transactions at once)
  const email = mail('dbrace'); const uid = await createMarketplacePatient(email)
  const [ta, tb] = await Promise.all([
    admin.from('invitations').insert({ organization_id: ORG_A, email, role: 'patient', send_count: 1 }).select('token').single(),
    admin.from('invitations').insert({ organization_id: ORG_B, email, role: 'patient', send_count: 1 }).select('token').single(),
  ])
  const out = await Promise.all([
    admin.rpc('accept_patient_invitation', { p_token: ta.data.token, p_user: uid }),
    admin.rpc('accept_patient_invitation', { p_token: tb.data.token, p_user: uid }),
  ])
  const outcomes = out.map(o => o.data?.[0]?.outcome).sort()
  log('DB-level race: one joined, one other_clinic', JSON.stringify(outcomes) === '["joined","other_clinic"]', JSON.stringify(outcomes))

  // Two invitations at once from the same clinic → one row
  const e2 = mail('dupe-race')
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  await Promise.all([1, 2, 3].map(() => a.call('/api/patient-invitations', { method: 'POST', body: { email: e2 } })))
  const { count } = await admin.from('invitations').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_A).ilike('email', e2)
  log('three simultaneous invitations to one email → one invitation', count === 1, `${count}`)
  await a.close()
}

S.expiredAndResend = async (browser) => {
  const email = mail('expired'); const since = Date.now() - 1000
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  const r = await a.call('/api/patient-invitations', { method: 'POST', body: { email } })
  const m = await waitOutbox(email, since)
  await admin.from('invitations').update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq('id', r.body.invitationId)
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(m.link)
  log('expired invitation: page explains it', await has(page, 'הזמנה פגה'))
  const uid = await createMarketplacePatient(email)
  const s = await session(browser, email, 'shaked-qa')
  const acc = await s.call('/api/auth/invite-accept', { method: 'POST', body: { token: m.token } })
  log('expired invitation: accept refused (410), no membership', acc.status === 410 && (await userRow(email))[0].organization_id === DEFAULT_ORG)
  const list = (await a.call('/api/patient-invitations')).body.invitations
  log('admin list shows "expired"', list.find(i => i.id === r.body.invitationId)?.status === 'expired')
  const since2 = Date.now() - 1000
  const rs = await a.call(`/api/patient-invitations/${r.body.invitationId}`, { method: 'POST', body: { action: 'resend' } })
  const m2 = await waitOutbox(email, since2)
  log('resend → new email with a NEW link', rs.status === 200 && rs.body.emailSent && m2?.token && m2.token !== m.token)
  const inv = await invRow(r.body.invitationId)
  log('resend → pending again, send count 2', new Date(inv.expires_at) > new Date() && inv.send_count === 2)
  const old = await s.call('/api/auth/invite-accept', { method: 'POST', body: { token: m.token } })
  log('old link dead after resend (404)', old.status === 404)
  const fresh = await s.call('/api/auth/invite-accept', { method: 'POST', body: { token: m2.token } })
  log('new link works → joined', fresh.body?.outcome === 'joined' && (await userRow(email))[0].organization_id === ORG_A && (await userRow(email))[0].id === uid)
  const { data: aud } = await admin.from('audit_logs').select('action').eq('resource_id', r.body.invitationId)
  log('audit: invited, resent, accepted', ['patient_invited', 'patient_invite_resent', 'patient_invite_accepted'].every(x => aud.some(y => y.action === x)))
  // Re-inviting an expired invitation via "invite" refreshes it instead of duplicating
  const e3 = mail('expired2')
  const r3 = await a.call('/api/patient-invitations', { method: 'POST', body: { email: e3 } })
  await admin.from('invitations').update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq('id', r3.body.invitationId)
  const r4 = await a.call('/api/patient-invitations', { method: 'POST', body: { email: e3 } })
  const { count } = await admin.from('invitations').select('id', { count: 'exact', head: true }).ilike('email', e3)
  log('inviting again after expiry → same invitation refreshed', r4.body.outcome === 'refreshed' && r4.body.invitationId === r3.body.invitationId && count === 1)
  await a.close(); await s.close(); await ctx.close()
}

S.revoked = async (browser) => {
  const email = mail('revoked'); const since = Date.now() - 1000
  const d = await session(browser, 'doctor.a1@canna.test', 'shaked-qa')
  const r = await d.call('/api/patient-invitations', { method: 'POST', body: { email } })
  const m = await waitOutbox(email, since)
  const rv = await d.call(`/api/patient-invitations/${r.body.invitationId}`, { method: 'POST', body: { action: 'revoke' } })
  log('doctor revokes own invitation', rv.status === 200 && !!(await invRow(r.body.invitationId)).revoked_at)
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(m.link)
  log('revoked invitation: page explains it', await has(page, 'ההזמנה בוטלה'))
  await createMarketplacePatient(email)
  const s = await session(browser, email, 'shaked-qa')
  const acc = await s.call('/api/auth/invite-accept', { method: 'POST', body: { token: m.token } })
  log('revoked invitation: accept refused, no membership', acc.status === 410 && (await userRow(email))[0].organization_id === DEFAULT_ORG)
  const rs = await d.call(`/api/patient-invitations/${r.body.invitationId}`, { method: 'POST', body: { action: 'resend' } })
  log('revoked invitation cannot be resent (409)', rs.status === 409)
  const list = (await d.call('/api/patient-invitations')).body.invitations
  log('list shows "revoked"', list.find(i => i.id === r.body.invitationId)?.status === 'revoked')
  const n = await d.call('/api/patient-invitations', { method: 'POST', body: { email } })
  log('a new invitation can be sent after revoking', n.status === 201 && n.body.invitationId !== r.body.invitationId)
  const acc2 = await d.call(`/api/patient-invitations/${shared.newInvite.id}`, { method: 'POST', body: { action: 'revoke' } })
  log('doctor cannot revoke an invitation they did not send (admin\'s) → 404', acc2.status === 404)
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  const ra = await a.call(`/api/patient-invitations/${shared.newInvite.id}`, { method: 'POST', body: { action: 'revoke' } })
  log('accepted invitation cannot be revoked (409)', ra.status === 409)
  const { data: aud } = await admin.from('audit_logs').select('action').eq('resource_id', r.body.invitationId).eq('action', 'patient_invite_revoked')
  log('audit: patient_invite_revoked recorded', aud?.length === 1)
  await d.close(); await s.close(); await ctx.close(); await a.close()
}

S.historicalRecordsNotExposed = async (browser) => {
  const email = mail('history'); const uid = await createMarketplacePatient(email)
  const { error: de } = await admin.from('documents').insert({ organization_id: DEFAULT_ORG, patient_id: uid, uploaded_by: uid, file_name: 'old-record.pdf', storage_path: `${uid}/old.pdf`, file_type: 'application/pdf', file_size_bytes: 10 })
  const { data: inv } = await admin.from('invitations').insert({ organization_id: ORG_A, email, role: 'patient', send_count: 1 }).select('token').single()
  const p = await session(browser, email, 'shaked-qa')
  const acc = await p.call('/api/auth/invite-accept', { method: 'POST', body: { token: inv.token } })
  log('patient with an earlier document joins the clinic', acc.body?.outcome === 'joined', de?.message || '')
  await p.close()
  for (const who of ['admin.a@canna.test', 'staff.a@canna.test', 'doctor.a1@canna.test']) {
    const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
    await sb.auth.signInWithPassword({ email: who, password: PW })
    const { data } = await sb.from('documents').select('id').eq('patient_id', uid)
    log(`${who}: cannot see the patient's earlier records`, (data || []).length === 0)
  }
}

S.publicRegistration = async (browser) => {
  // Forged signup metadata no longer chooses a clinic.
  const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
  const e1 = mail('forged')
  await sb.auth.signUp({ email: e1, password: PW, options: { data: { first_name: 'x', organization_id: ORG_B, role: 'admin' } } })
  const f = await userRow(e1)
  log('signup with forged organization_id/role → no clinic, patient', f[0]?.organization_id === DEFAULT_ORG && f[0].role === 'patient', JSON.stringify(f))
  // Claim from central or another clinic's site does nothing
  await admin.auth.admin.updateUserById(f[0].id, { email_confirm: true })
  const c = await session(browser, e1, 'oren-qa')
  const cl = await c.call('/api/patient/claim-clinic', { method: 'POST' })
  log('claim-clinic on a site the account did not register on → no change', cl.body?.outcome === 'not_signup_site' && (await userRow(e1))[0].organization_id === DEFAULT_ORG)
  await c.close()
  // Real registration on a clinic site with email verification → that clinic
  const e2 = mail('subreg')
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(`${H('oren-qa')}/auth/register`)
  await page.getByLabel('שם פרטי').fill('רשומה'); await page.getByLabel('שם משפחה').fill('באתר')
  await page.getByLabel('אימייל').fill(e2); await page.getByLabel('טלפון').fill('0501234567')
  const fillIf = async (label, v) => { const l = page.getByLabel(label, { exact: true }); if (await l.isVisible().catch(() => false)) await l.fill(v) }
  await fillIf('סיסמה', PW); await fillIf('אימות סיסמה', PW)
  const next = page.getByRole('button', { name: 'המשך לשלב הבא' })
  if (await next.isVisible().catch(() => false)) await next.click()
  await page.waitForTimeout(500)
  await fillIf('סיסמה', PW); await fillIf('אימות סיסמה', PW)
  await page.locator('input[type=checkbox]').last().evaluate(el => el.click())
  await page.getByRole('button', { name: 'צור חשבון' }).click()
  await page.getByText('בדוק את תיבת הדואר').waitFor({ timeout: 15000 })
  log('clinic-site registration: before verification, no clinic', (await userRow(e2))[0]?.organization_id === DEFAULT_ORG)
  await openConfirmation(page, await confirmationLink(e2), H('oren-qa'))
  await sleep(1000)
  log('clinic-site registration: after verification → that clinic (host-derived)', (await userRow(e2))[0]?.organization_id === ORG_B, page.url())
  await ctx.close()
  // Central registration stays marketplace even after verification + login
  const e3 = mail('centralreg')
  const sb3 = createClient(URL_, ANON, { auth: { persistSession: false } })
  await sb3.auth.signUp({ email: e3, password: PW })
  await admin.auth.admin.updateUserById((await userRow(e3))[0].id, { email_confirm: true })
  const c3 = await session(browser, e3, null)
  await c3.page.goto(`${H('shaked-qa')}/auth/login`)
  await c3.page.fill('input[type=email]', e3); await c3.page.fill('input[type=password]', PW); await c3.page.click('button[type=submit]')
  await sleep(2500)
  log('central registration: never silently assigned (even after visiting a clinic site)', (await userRow(e3))[0].organization_id === DEFAULT_ORG)
  await c3.close()
  // ?org= share link moves to the clinic's own site
  const ctx4 = await browser.newContext(); const p4 = await ctx4.newPage()
  await p4.goto(`${H(null)}/auth/register?org=${ORG_A}`)
  await p4.waitForURL(new RegExp(`shaked-qa\\.canna\\.localhost:${PORT}/auth/register`), { timeout: 15000 }).catch(() => {})
  log('?org= share link continues on the clinic\'s own site', p4.url().startsWith(`${H('shaked-qa')}/auth/register`), p4.url())
  await ctx4.close()
}

S.uiAdminAndDoctor = async (browser) => {
  // Admin: Users → Patients tab → invite
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  await a.page.goto(`${H('shaked-qa')}/dashboard/admin/users`)
  await a.page.getByRole('button', { name: /מטופלים/ }).first().click()
  const panel = a.page.getByTestId('patient-invitations')
  await panel.waitFor({ timeout: 15000 })
  await panel.getByRole('button', { name: '+ הזמנת מטופל' }).click()
  const email = mail('ui-admin')
  await panel.getByLabel('אימייל המטופל/ת').fill(email)
  await panel.getByRole('button', { name: 'שליחת הזמנה' }).click()
  await panel.getByTestId('invite-notice').waitFor({ timeout: 15000 })
  log('admin UI: invite → success message', (await panel.getByTestId('invite-notice').innerText()).includes(`ההזמנה נשלחה ל-${email}`))
  const row = panel.locator(`li[data-email="${email}"]`)
  log('admin UI: new invitation listed as pending', (await row.getAttribute('data-status')) === 'pending')
  await row.getByRole('button', { name: /שליחה חוזרת/ }).click()
  await a.page.waitForTimeout(1500)
  log('admin UI: resend → message', (await panel.getByTestId('invite-notice').innerText()).includes('נשלחה שוב'))
  await row.getByRole('button', { name: /ביטול ההזמנה/ }).click()
  await a.page.waitForTimeout(1500)
  log('admin UI: revoke → status revoked', (await panel.locator(`li[data-email="${email}"]`).getAttribute('data-status')) === 'revoked')
  await panel.getByRole('tab', { name: /אושרו/ }).click()
  log('admin UI: "accepted" filter shows accepted invitations', (await panel.locator('li[data-status="accepted"]').count()) > 0 && (await panel.locator('li[data-status="pending"]').count()) === 0)
  await panel.getByRole('tab', { name: /פג תוקף/ }).click()
  log('admin UI: "expired" filter works', (await panel.locator('li[data-status]').evaluateAll(els => els.every(e => e.dataset.status === 'expired'))))
  await panel.getByRole('button', { name: '+ הזמנת מטופל' }).click().catch(() => {})
  await panel.getByLabel('אימייל המטופל/ת').fill(shared.doctorInvite.email).catch(() => {})
  await panel.getByRole('button', { name: 'שליחת הזמנה' }).click().catch(() => {})
  await a.page.waitForTimeout(1500)
  log('admin UI: duplicate → clear message', (await panel.getByTestId('invite-notice').innerText()).includes('כבר קיימת הזמנה ממתינה'))
  await a.close()
  // Doctor: Patients → invite
  const d = await session(browser, 'doctor.a1@canna.test', 'shaked-qa')
  await d.page.goto(`${H('shaked-qa')}/dashboard/doctor/patients`)
  const dp = d.page.getByTestId('patient-invitations')
  await dp.waitFor({ timeout: 15000 })
  await dp.getByRole('button', { name: '+ הזמנת מטופל' }).click()
  const e2 = mail('ui-doctor')
  await dp.getByLabel('אימייל המטופל/ת').fill(e2)
  await dp.getByRole('button', { name: 'שליחת הזמנה' }).click()
  await dp.getByTestId('invite-notice').waitFor({ timeout: 15000 })
  log('doctor UI: invite → success', (await dp.getByTestId('invite-notice').innerText()).includes(`ההזמנה נשלחה ל-${e2}`))
  await dp.locator(`li[data-email="${e2}"]`).waitFor({ timeout: 10000 }).catch(() => {})
  log('doctor UI: lists own invitations only', (await dp.locator(`li[data-email="${shared.newInvite.email}"]`).count()) === 0 && (await dp.locator(`li[data-email="${e2}"]`).count()) === 1)
  await dp.getByLabel('אימייל המטופל/ת').fill('patient.a@canna.test')
  await dp.getByRole('button', { name: 'שליחת הזמנה' }).click()
  await d.page.waitForTimeout(1500)
  log('doctor UI: existing clinic patient → clear error', (await dp.getByTestId('invite-notice').innerText()).includes('כבר רשום במרפאה'))
  await d.close()
}

S.teamInviteUnaffected = async (browser) => {
  // A team invitation to the same address as a pending patient invitation keeps its own token.
  const email = shared.doctorInvite.email
  const a = await session(browser, 'admin.a@canna.test', 'shaked-qa')
  const r = await a.call('/api/admin/invite', { method: 'POST', body: { email, role: 'staff', name: 'צוות' } })
  const { data: rows } = await admin.from('invitations').select('role, token').eq('organization_id', ORG_A).ilike('email', email)
  const staffRow = rows.find(x => x.role === 'staff'), patRow = rows.find(x => x.role === 'patient')
  log('team invite to same email → separate staff invitation, patient one untouched', r.status === 200 && staffRow && patRow && staffRow.token !== patRow.token, `${r.status}`)
  await a.close()
}

;(async () => {
  // Fixed QA accounts: clear live patient invitations left by earlier runs.
  await admin.from('invitations').update({ revoked_at: new Date().toISOString() })
    .eq('role', 'patient').is('used_at', null).is('revoked_at', null).in('email', ['patient.b@canna.test', 'patient.a2@canna.test'])
  const browser = await chromium.launch()
  for (const [name, fn] of Object.entries(S)) {
    if (ONLY.length && !ONLY.includes(name)) continue
    try { await fn(browser) } catch (e) { log(`${name}: threw`, false, String(e.message).split('\n')[0]) }
  }
  await browser.close()
  const failed = results.filter(r => !r.ok)
  console.log(`== ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) console.log('FAILED:', failed.map(f => f.name).join(' | '))
  process.exit(failed.length ? 1 : 0)
})()
