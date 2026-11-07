// LOCAL_QA tenant-isolation tests (local stack only). Env from .env.development.local.
const { chromium, request } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const PORT = 3105, PW = 'CannaQA-Local-2026!'
const H = (sub) => sub ? `http://${sub}.canna.localhost:${PORT}` : `http://localhost:${PORT}`
const ORG_A = '11111111-1111-4111-8111-111111111111', ORG_B = '22222222-2222-4222-8222-222222222222'
const D = { a1: '7642d2c1-1466-44b0-bd26-ad5bdc19ad74', a2: '2578f361-8918-47cc-be34-f7f2adb49f48',
  b1: '9643928b-e735-4f23-b565-cb630e1c3a55', avi: '2785b39d-4d14-4eae-bdeb-7948d52494ff' }
const results = []
const log = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`) }
const ids = (html) => [...new Set([...html.matchAll(/\/doctors\/([0-9a-f-]{36})/g)].map(m => m[1]))].sort()
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const inPage = (page, url, init) => page.evaluate(async ([u, i]) => {
  const r = await fetch(u, i); let body = null; try { body = await r.json() } catch {}
  return { status: r.status, body }
}, [url, init || {}])

async function loginCtx(browser, base, email) {
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(`${base}/auth/login`)
  await page.fill('input[type=email]', email); await page.fill('input[type=password]', PW)
  await page.click('button[type=submit]'); await page.waitForURL(/\/dashboard\//, { timeout: 20000 })
  return { ctx, page }
}

;(async () => {
  // ── 1. Public pages (no session) ─────────────────────────────
  const expect = {
    'shaked-qa': [D.a1, D.a2], 'oren-qa': [D.b1], 'gefen-qa': [D.avi], 'alon-qa': [], 'no-such-clinic': [],
  }
  for (const [sub, want] of Object.entries(expect)) {
    const api = await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, extraHTTPHeaders: { host: `${sub}.canna.localhost:${PORT}` } })
    const got = ids(await (await api.get('/doctors')).text())
    log(`public /doctors on ${sub} lists only its doctors`, same(got, want), JSON.stringify(got))
    await api.dispose()
  }
  {
    const api = await request.newContext({ baseURL: H(null) })
    const got = ids(await (await api.get('/doctors')).text())
    log('public /doctors on central site (marketplace) still lists all clinics', [D.a1, D.a2, D.b1, D.avi].every(i => got.includes(i)), `${got.length} doctors`)
    log('central doctor profile still opens', (await api.get(`/doctors/${D.b1}`)).status() === 200)
    await api.dispose()
  }
  {
    const s = await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, extraHTTPHeaders: { host: `${'shaked-qa'}.canna.localhost:${PORT}` } })
    { const t = await (await s.get(`/doctors/${D.b1}`)).text()
      log('foreign doctor profile on clinic site → not found, no doctor data', t.includes('לא נמצא') && !t.includes('שירה') && !t.includes('QA-2001')) }
    { const t = await (await s.get(`/doctors/${D.a1}`)).text()
      log('own doctor profile on clinic site shows the doctor', t.includes('נועה') && t.includes('QA-1001')) }
    const card = ids(await (await s.get('/specialties/cardiology')).text())
    log('specialty page on clinic site excludes foreign doctors', !card.includes(D.b1), JSON.stringify(card))
    const gen = ids(await (await s.get('/specialties/general')).text())
    log('specialty page on clinic site shows its own doctor', gen.includes(D.a1) && !gen.includes(D.avi), JSON.stringify(gen))
    await s.dispose()
    const u = await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, extraHTTPHeaders: { host: `${'no-such-clinic'}.canna.localhost:${PORT}` } })
    { const t = await (await u.get(`/doctors/${D.a1}`)).text()
      log('unknown clinic host: doctor profile → not found, no doctor data', t.includes('לא נמצא') && !t.includes('נועה') && !t.includes('QA-1001')) }
    await u.dispose()
    const o = await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, extraHTTPHeaders: { host: `${'oren-qa'}.canna.localhost:${PORT}` } })
    log('oren clinic: own doctor profile → 200', (await o.get(`/doctors/${D.b1}`)).status() === 200)
    await o.dispose()
  }

  const browser = await chromium.launch()
  // ── 2. Server-side API enforcement ───────────────────────────
  {
    const { ctx, page } = await loginCtx(browser, H('shaked-qa'), 'patient.a@canna.test')
    const slots = async (org) => (await inPage(page, `/api/appointments/available-slots?orgId=${org}&days=14`)).body?.slots?.length ?? -1
    const own = await slots(ORG_A), foreign = await slots(ORG_B)
    log('slots: own clinic on own site returns slots', own > 0, `n=${own}`)
    log('slots: foreign clinic on own site returns none', foreign === 0, `n=${foreign}`)
    const r = await inPage(page, '/api/patient/join-clinic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorId: D.b1 }) })
    const { data: me } = await admin.from('users').select('organization_id').eq('email', 'patient.a@canna.test').single()
    log('join-clinic: foreign doctor from clinic site refused', r.status === 404, `status=${r.status}`)
    log('join-clinic: patient stays in own clinic', me.organization_id === ORG_A)
    await ctx.close()
  }
  {
    const { ctx, page } = await loginCtx(browser, H(null), 'patient.a@canna.test')
    const n = (await inPage(page, `/api/appointments/available-slots?orgId=${ORG_B}&days=14`)).body?.slots?.length ?? -1
    log('slots: clinic patient on central site cannot read another clinic', n === 0, `n=${n}`)
    await ctx.close()
  }
  {
    const { ctx, page } = await loginCtx(browser, H(null), 'staff.a@canna.test')
    const own = (await inPage(page, `/api/appointments/available-slots?orgId=${ORG_A}&days=14`)).body?.slots?.length ?? -1
    const other = (await inPage(page, `/api/appointments/available-slots?orgId=${ORG_B}&days=14`)).body?.slots?.length ?? -1
    log('slots: staff sees own clinic', own > 0, `n=${own}`)
    log('slots: staff cannot read another clinic', other === 0, `n=${other}`)
    await ctx.close()
  }
  await browser.close()

  // ── 3. Database guard (migration 029) under RLS as the patient ─
  {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: s } = await sb.auth.signInWithPassword({ email: 'patient.a@canna.test', password: PW })
    const base = { organization_id: ORG_A, patient_id: s.user.id, requested_specialty: 'general', chief_complaint: 'QA 029', status: 'pending' }
    const bad = await sb.from('appointments').insert({ ...base, doctor_id: D.b1 }).select('id')
    log('db: patient cannot book another clinic\'s doctor (insert)', !!bad.error && bad.error.code === '42501', bad.error?.code)
    const good = await sb.from('appointments').insert({ ...base, doctor_id: D.a1 }).select('id').single()
    log('db: patient can still book own clinic\'s doctor', !good.error && !!good.data?.id, good.error?.message || '')
    if (good.data?.id) {
      const upd = await sb.from('appointments').update({ doctor_id: D.b1 }).eq('id', good.data.id).select('id')
      log('db: patient cannot switch to another clinic\'s doctor (update)', !!upd.error && upd.error.code === '42501', upd.error?.code)
      const st = await admin.from('appointments').update({ status: 'cancelled_patient' }).eq('id', good.data.id).select('id')
      log('db: status updates on existing rows unaffected', !st.error, st.error?.message || '')
      await admin.from('appointments').delete().eq('id', good.data.id) // local QA cleanup
    }
  }

  const failed = results.filter(r => !r.ok).length
  console.log(`== ${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
