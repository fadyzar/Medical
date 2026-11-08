// LOCAL_QA regression: onboarding (+redirect), doctor invitation, patient
// registration, auth per role, appointment booking. Local stack only.
const { chromium, request } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const PORT = 3105, PW = 'CannaQA-Local-2026!'
const H = (sub) => sub ? `http://${sub}.canna.localhost:${PORT}` : `http://localhost:${PORT}`
const ORG_A = '11111111-1111-4111-8111-111111111111', ORG_B = '22222222-2222-4222-8222-222222222222'
const D = { a1: '7642d2c1-1466-44b0-bd26-ad5bdc19ad74', b1: '9643928b-e735-4f23-b565-cb630e1c3a55' }
const RUN = Date.now().toString(36)
const ONLY = process.argv.slice(2)
const results = []
const log = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`) }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function login(page, base, email, pw = PW) {
  await page.goto(`${base}/auth/login`)
  await page.fill('input[type=email]', email); await page.fill('input[type=password]', pw)
  await page.click('button[type=submit]'); await page.waitForURL(/\/dashboard\//, { timeout: 20000 })
}

async function runWizard(page, sub, opts = {}) {
  await page.goto(`${H(null)}/onboarding`)
  await page.getByLabel('שם המרפאה').fill(`מרפאת בדיקה ${sub}`)
  await page.getByLabel('אימייל ליצירת קשר').fill(`clinic+${sub}@qa-onb.test`)
  await page.getByLabel('טלפון המרפאה').fill('031234567')
  await page.getByLabel('תת-דומיין').fill(sub)
  await page.getByText(`${sub}.cannaforyou.net — זמין`).waitFor({ timeout: 10000 })
  await page.getByLabel('שם פרטי').fill('מנהלת')
  await page.getByLabel('שם משפחה').fill('בדיקה')
  await page.getByLabel('אימייל מנהל').fill(`admin+${sub}@qa-onb.test`)
  await page.getByLabel('סיסמה', { exact: true }).fill(PW)
  await page.getByLabel('אישור סיסמה').fill(PW)
  await page.getByRole('button', { name: 'המשך לבחירת תוכנית' }).click()
  await page.getByRole('button', { name: 'המשך למיתוג' }).click()
  await page.getByRole('button', { name: 'המשך להזמנת רופא' }).click()
  if (opts.doctorEmail) {
    await page.getByLabel('שם הרופא').fill('ד״ר מוזמן')
    await page.getByLabel('אימייל הרופא').fill(opts.doctorEmail)
    await page.getByRole('button', { name: 'סיים והזמן רופא' }).click()
  } else {
    await page.getByRole('button', { name: 'סיים הרשמה' }).click()
  }
  await page.getByText('המרפאה נוצרה בהצלחה!').first().waitFor({ timeout: 20000 })
}

async function confirmEmail(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = data.users.find(x => x.email === email)
  if (u) await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
  return u?.id
}

async function register(page, base, email) {
  await page.goto(`${base}/auth/register`)
  await page.getByLabel('שם פרטי').fill('מטופלת')
  await page.getByLabel('שם משפחה').fill('בדיקה')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('טלפון').fill('0501234567')
  // Two-step form: fields may live on either step.
  const fillIf = async (label, v) => { const l = page.getByLabel(label, { exact: true }); if (await l.isVisible().catch(() => false)) await l.fill(v) }
  await fillIf('סיסמה', PW); await fillIf('אימות סיסמה', PW)
  const next = page.getByRole('button', { name: 'המשך לשלב הבא' })
  if (await next.isVisible().catch(() => false)) await next.click()
  await page.waitForTimeout(500)
  await fillIf('סיסמה', PW); await fillIf('אימות סיסמה', PW)
  await page.locator('input[type=checkbox]').last().evaluate(el => el.click())
  await page.getByRole('button', { name: 'צור חשבון' }).click()
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.from('users').select('id, organization_id, role').eq('email', email).maybeSingle()
    if (data) return data
    await sleep(500)
  }
  return null
}

async function book(page, base, doctorId) {
  await page.goto(`${base}/dashboard/patient/new-appointment?doctor=${doctorId}`)
  const slot = page.locator('main button', { hasText: /^\d{2}:\d{2}$/ }).nth(3)
  await slot.waitFor({ timeout: 20000 }); await slot.click()
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByPlaceholder('למשל: כאב ראש חזק כבר שבוע').fill('כאב ראש מתמשך — בדיקת QA')
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByRole('button', { name: 'המשך →' }).click()
  await page.getByRole('button', { name: 'שלח בקשה' }).click()
  await page.waitForURL(u => !u.toString().includes('new-appointment'), { timeout: 20000 })
}

const T = {
  async onboardingCentral(browser) {
    const sub = `qa-c-${RUN}`, doc = `doc+${RUN}@qa-onb.test`
    const ctx = await browser.newContext(); const page = await ctx.newPage()
    await runWizard(page, sub, { doctorEmail: doc })
    // Local stack has no clinic domains → explained central login, as before.
    await page.waitForURL(/\/auth\/login\?onboarding=success/, { timeout: 15000 })
    log('onboarding (no clinic domain in env) → central login', true, page.url())
    const { data: org } = await admin.from('organizations').select('id, subdomain').eq('subdomain', sub).single()
    const { data: adm } = await admin.from('users').select('role, organization_id').eq('email', `admin+${sub}@qa-onb.test`).single()
    log('onboarding: clinic + admin created', !!org && adm?.role === 'admin' && adm.organization_id === org.id)
    await login(page, H(null), `admin+${sub}@qa-onb.test`)
    log('onboarding: new admin can log in', page.url().includes('/dashboard/admin/'), page.url())
    // Doctor invitation (sent from the wizard)
    let inv = null
    for (let i = 0; i < 20 && !inv; i++) {
      const { data } = await admin.from('invitations').select('token, role, organization_id').eq('email', doc).maybeSingle()
      inv = data; if (!inv) await sleep(500)
    }
    log('invite: doctor invitation created for the new clinic', !!inv && inv.role === 'doctor' && inv.organization_id === org.id)
    if (inv) {
      const p2 = await (await browser.newContext()).newPage()
      await p2.goto(`${H(null)}/auth/invite/${inv.token}`)
      await p2.getByLabel('שם פרטי').fill('רופא'); await p2.getByLabel('שם משפחה').fill('מוזמן')
      await p2.getByLabel('סיסמה', { exact: true }).fill(PW); await p2.getByLabel('אימות סיסמה').fill(PW)
      await p2.getByRole('button', { name: /הצטרפ|צור|הרשמ|אשר/ }).first().click()
      await sleep(3000)
      // Email-confirmation stand-in (local mail is off): confirm, sign in, accept on the invite page.
      await confirmEmail(doc)
      await login(p2, H(null), doc).catch(() => {})
      await p2.goto(`${H(null)}/auth/invite/${inv.token}`)
      await p2.locator('button[type=button]').filter({ hasText: /הצטרפ|קבל|אשר/ }).first().click().catch(() => {})
      let u = null
      for (let i = 0; i < 30; i++) {
        const { data } = await admin.from('users').select('role, organization_id').eq('email', doc).maybeSingle()
        if (data?.role === 'doctor') { u = data; break }
        await sleep(500)
      }
      log('invite: invited doctor joins the right clinic as doctor', !!u && u.organization_id === org.id, JSON.stringify(u))
      await confirmEmail(doc)
      await login(p2, H(null), doc).catch(() => {})
      log('invite: invited doctor can log in to doctor dashboard', p2.url().includes('/dashboard/doctor/'), p2.url())
      // Isolation: the new doctor appears on its own clinic only
      const dId = (await admin.from('users').select('id').eq('email', doc).single()).data.id
      const ids = async (s) => (await (await (await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, extraHTTPHeaders: { host: `${s}.canna.localhost:${PORT}` } })).get('/doctors')).text()).includes(dId)
      log('isolation: new doctor listed on its own clinic site', await ids(sub))
      log('isolation: new doctor NOT listed on another clinic site', !(await ids('shaked-qa')))
    }
    await ctx.close()
  },

  async onboardingReady(browser) {
    const sub = `qa-r-${RUN}`
    const ctx = await browser.newContext(); const page = await ctx.newPage()
    let calls = 0
    await page.route('**/api/onboarding/domain-ready**', route => {
      calls++
      route.fulfill({ json: calls < 2 ? { ready: false, reason: 'unreachable', url: H(sub) } : { ready: true, reason: 'ok', url: H(sub) } })
    })
    await runWizard(page, sub)
    await page.waitForURL(new RegExp(`${sub}\\.canna\\.localhost:${PORT}/auth/login\\?onboarding=success`), { timeout: 30000 })
    log('onboarding: redirects to the clinic subdomain once it is ready', true, page.url())
    await login(page, H(sub), `admin+${sub}@qa-onb.test`)
    log('onboarding: admin lands on dashboard on the clinic subdomain', page.url().startsWith(H(sub)) && page.url().includes('/dashboard/admin/'), page.url())
    await page.getByText(`מרפאת בדיקה ${sub}`).first().waitFor({ timeout: 10000 }).then(() => log('onboarding: clinic branding/name loaded on subdomain', true), () => log('onboarding: clinic branding/name loaded on subdomain', false))
    await ctx.close()
  },

  async onboardingPending(browser) {
    const sub = `qa-p-${RUN}`
    const ctx = await browser.newContext(); const page = await ctx.newPage()
    await page.route('**/api/onboarding/domain-ready**', route => route.fulfill({ json: { ready: false, reason: 'unreachable', url: `https://${sub}.cannaforyou.net` } }))
    await runWizard(page, sub)
    await page.getByText('הכתובת של המרפאה עדיין בהקמה').waitFor({ timeout: 80000 })
    log('onboarding: DNS pending → clear explanation shown', true)
    log('onboarding: pending → no automatic redirect', page.url().includes('/onboarding'))
    await page.getByRole('button', { name: 'התחברו עכשיו דרך האתר הראשי' }).click()
    await page.waitForURL(/\/auth\/login\?onboarding=success/, { timeout: 15000 })
    log('onboarding: pending → central login fallback works', page.url().startsWith(H(null)))
    await ctx.close()
  },

  async domainReadyApi() {
    const api = await request.newContext({ baseURL: H(null) })
    const ok = await api.get('/api/onboarding/domain-ready?subdomain=shaked-qa')
    log('domain-ready API: existing clinic, non-production host → not_production', (await ok.json()).reason === 'not_production')
    log('domain-ready API: invalid subdomain → 400', (await api.get('/api/onboarding/domain-ready?subdomain=..evil')).status() === 400)
    log('domain-ready API: unknown clinic → 404', (await api.get('/api/onboarding/domain-ready?subdomain=no-such-clinic-zz')).status() === 404)
    await api.dispose()
  },

  async registrationAndBooking(browser) {
    // Clinic patient: registers on the clinic subdomain, books its doctor.
    const email = `pat+${RUN}@qa-reg.test`
    const ctx = await browser.newContext(); const page = await ctx.newPage()
    const u = await register(page, H('shaked-qa'), email)
    // 031: the clinic is granted server-side (host-derived) once the email is
    // verified — never from signup metadata.
    log('register on clinic subdomain → not in a clinic before email verification', u?.role === 'patient' && u.organization_id === '00000000-0000-0000-0000-000000000001', JSON.stringify(u))
    await confirmEmail(email)
    await login(page, H('shaked-qa'), email)
    log('patient login on clinic subdomain', page.url().includes('/dashboard/patient/'))
    await sleep(1000)
    const { data: joined } = await admin.from('users').select('organization_id').eq('id', u.id).single()
    log('register on clinic subdomain → patient of that clinic after verification', joined?.organization_id === ORG_A, JSON.stringify(joined))
    await page.goto(`${H('shaked-qa')}/dashboard/patient/new-appointment`)
    await page.getByText('רפואה כללית').first().click()
    await page.waitForTimeout(2500)
    const body = await page.content()
    log('booking UI: own clinic doctor offered', body.includes('נועה'))
    log('booking UI: other clinics\' doctors not offered', !body.includes('ד"ר אבי') && !body.includes('שירה'))
    await book(page, H('shaked-qa'), D.a1)
    const { data: apt } = await admin.from('appointments').select('organization_id, doctor_id, status').eq('patient_id', u.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    log('booking: appointment created with own-clinic doctor', apt?.doctor_id === D.a1 && apt.organization_id === ORG_A, JSON.stringify(apt))
    await ctx.close()

    // Marketplace patient: registers on the central site, books another clinic's doctor.
    const email2 = `mkt+${RUN}@qa-reg.test`
    const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage()
    const u2 = await register(p2, H(null), email2)
    log('register on central site → marketplace (default org) patient', u2?.organization_id === '00000000-0000-0000-0000-000000000001', JSON.stringify(u2))
    await confirmEmail(email2)
    await login(p2, H(null), email2)
    await book(p2, H(null), D.b1)
    const { data: apt2 } = await admin.from('appointments').select('organization_id, doctor_id').eq('patient_id', u2.id).maybeSingle()
    const { data: me2 } = await admin.from('users').select('organization_id').eq('id', u2.id).single()
    log('marketplace booking still works (joins the doctor\'s clinic)', apt2?.doctor_id === D.b1 && apt2.organization_id === ORG_B && me2.organization_id === ORG_B, JSON.stringify(apt2))
    await ctx2.close()
  },

  async loginRoles(browser) {
    for (const [email, want] of [['admin.a@canna.test', 'admin'], ['staff.a@canna.test', 'staff'], ['doctor.a1@canna.test', 'doctor'], ['patient.a@canna.test', 'patient'], ['admin.b@canna.test', 'admin']]) {
      for (const base of [H(null), H('shaked-qa')]) {
        const ctx = await browser.newContext(); const page = await ctx.newPage()
        await login(page, base, email).catch(() => {})
        log(`login ${email} @ ${base.replace('http://', '')} → ${want} dashboard`, page.url().includes(`/dashboard/${want}/`), page.url())
        await ctx.close()
      }
    }
  },
}

;(async () => {
  const browser = await chromium.launch()
  for (const [name, fn] of Object.entries(T)) {
    if (ONLY.length && !ONLY.includes(name)) continue
    try { await fn(browser) } catch (e) { log(`${name}: threw`, false, String(e.message).split('\n')[0]) }
  }
  await browser.close()
  const failed = results.filter(r => !r.ok).length
  console.log(`== ${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
})()
