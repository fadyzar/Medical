// LOCAL_QA security tests for migration 030 + /api/doctors (local stack only).
const { chromium, request } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const PORT = 3105, PW = 'CannaQA-Local-2026!'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ORG_A = '11111111-1111-4111-8111-111111111111', ORG_B = '22222222-2222-4222-8222-222222222222'
const D = { a1: '7642d2c1-1466-44b0-bd26-ad5bdc19ad74', a2: '2578f361-8918-47cc-be34-f7f2adb49f48',
  b1: '9643928b-e735-4f23-b565-cb630e1c3a55', avi: '2785b39d-4d14-4eae-bdeb-7948d52494ff' }
const ALL = Object.values(D)
const results = []
const log = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`) }
const ids = (rows) => (rows || []).map(r => r.id).sort()
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function as(email) {
  const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
  if (email) { const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(`${email}: ${error.message}`) }
  return sb
}
const api = (sub) => request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, extraHTTPHeaders: { host: sub ? `${sub}.canna.localhost:${PORT}` : `localhost:${PORT}` } })

;(async () => {
  const before = (await admin.from('users').select('id, consultation_price, bio, availability').eq('id', D.a1).single()).data

  // ── 1. Direct Supabase, anonymous ─────────────────────────────
  {
    const sb = await as(null)
    const sel = await sb.from('public_doctors').select('id')
    log('anon: SELECT public_doctors denied', !!sel.error && (sel.data == null), sel.error?.code)
    const upd = await sb.from('public_doctors').update({ consultation_price: 1 }).eq('id', D.a1).select('id')
    log('anon: UPDATE public_doctors denied', !!upd.error, upd.error?.code)
    const del = await sb.from('public_doctors').delete().eq('id', D.a2).select('id')
    log('anon: DELETE public_doctors denied', !!del.error, del.error?.code)
    const ins = await sb.from('public_doctors').insert({ id: '00000000-0000-4000-8000-0000000000aa', first_name: 'x' }).select('id')
    log('anon: INSERT public_doctors denied', !!ins.error, ins.error?.code)
    const users = await sb.from('users').select('id').eq('role', 'doctor')
    log('anon: users table returns no doctors (RLS)', !users.error ? (users.data || []).length === 0 : true, `${(users.data || []).length}`)
    const rpc = await sb.rpc('appointment_doctors', { doctor_ids: ALL })
    log('anon: appointment_doctors not executable', !!rpc.error || (rpc.data || []).length === 0, rpc.error?.code)
  }

  // ── 2. Direct Supabase, signed in (each role, two clinics) ─────
  const cases = [
    ['patient.a@canna.test', [D.a1], 'patient A sees only doctors of own appointments'],
    ['patient.b@canna.test', [D.b1], 'patient B sees only doctors of own appointments'],
    ['doctor.a1@canna.test', [D.a1, D.a2], 'doctor A sees self + own-clinic doctors'],
    ['doctor.b1@canna.test', [D.b1], 'doctor B sees only own clinic'],
    ['admin.a@canna.test', [D.a1, D.a2], 'admin A sees only own clinic'],
    ['admin.b@canna.test', [D.b1], 'admin B sees only own clinic'],
    ['staff.a@canna.test', [D.a1, D.a2], 'staff A sees only own clinic'],
  ]
  for (const [email, want, label] of cases) {
    const sb = await as(email)
    const view = await sb.from('public_doctors').select('id')
    log(`${email}: SELECT public_doctors denied`, !!view.error, view.error?.code)
    const upd = await sb.from('public_doctors').update({ bio: 'x' }).eq('id', D.b1).select('id')
    log(`${email}: UPDATE public_doctors denied`, !!upd.error, upd.error?.code)
    const r = await sb.rpc('appointment_doctors', { doctor_ids: ALL })
    log(`rpc: ${label}`, !r.error && same(ids(r.data), want), r.error?.message || JSON.stringify(ids(r.data).map(i => i.slice(0, 4))))
    const cols = r.data?.[0] ? Object.keys(r.data[0]) : []
    log(`rpc: ${email} gets display fields only`, !cols.some(c => /license|id_number|phone|email|availability/.test(c)), cols.join(','))
    const u = await sb.from('users').select('id').eq('role', 'doctor')
    const own = email.endsWith('a@canna.test') || email.includes('.a1@') || email.includes('.a@') ? [D.a1, D.a2] : [D.b1]
    log(`${email}: users table exposes no other clinic's doctors`, (u.data || []).every(x => own.includes(x.id)), JSON.stringify((u.data || []).map(x => x.id.slice(0, 4))))
  }

  // ── 3. /api/doctors scope (server-side, host + session) ────────
  const expectAnon = { 'shaked-qa': [D.a1, D.a2], 'oren-qa': [D.b1], 'gefen-qa': [D.avi], 'alon-qa': [], 'no-such-clinic': [] }
  for (const [sub, want] of Object.entries(expectAnon)) {
    const c = await api(sub)
    const body = await (await c.get('/api/doctors')).json()
    const got = ids(body.doctors).filter(i => ALL.includes(i))
    log(`api anon @${sub}: only that clinic`, same(got, want) && ids(body.doctors).every(i => want.includes(i)), JSON.stringify(ids(body.doctors).map(i => i.slice(0, 4))))
    const spoof = await (await c.get(`/api/doctors?organization_id=${ORG_B}&org=${ORG_B}&orgId=${ORG_B}`)).json()
    log(`api anon @${sub}: client-supplied org ignored`, same(ids(spoof.doctors), ids(body.doctors)))
    await c.dispose()
  }
  {
    const c = await api(null)
    const body = await (await c.get('/api/doctors')).json()
    log('api anon @central: marketplace lists all clinics', ALL.every(i => ids(body.doctors).includes(i)) && body.scope === 'marketplace', `${body.doctors.length}`)
    const one = await (await c.get(`/api/doctors?id=${D.b1}`)).json()
    log('api anon @central: public profile lookup works', ids(one.doctors)[0] === D.b1)
    const keys = Object.keys(body.doctors[0] || {})
    log('api: display fields only', !keys.some(k => /license|id_number|phone|email|availability|metadata/.test(k)), keys.join(','))
    log('api: bad params rejected', (await c.get('/api/doctors?id=not-a-uuid')).status() === 400)
    await c.dispose()
    const s = await api('shaked-qa')
    log('api anon @shaked: foreign doctor by id → none', (await (await s.get(`/api/doctors?id=${D.b1}`)).json()).doctors.length === 0)
    await s.dispose()
  }

  // Signed-in on the central site (browser session cookies)
  const browser = await chromium.launch()
  const central = `http://localhost:${PORT}`
  const signedIn = [
    ['patient.a@canna.test', [D.a1, D.a2], 'clinic patient → own clinic'],
    ['patient.b@canna.test', [D.b1], 'clinic patient B → own clinic'],
    ['admin.a@canna.test', [D.a1, D.a2], 'admin → own clinic'],
    ['doctor.b1@canna.test', [D.b1], 'doctor → own clinic'],
  ]
  for (const [email, want, label] of signedIn) {
    const ctx = await browser.newContext(); const page = await ctx.newPage()
    await page.goto(`${central}/auth/login`)
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', PW)
    await page.click('button[type=submit]'); await page.waitForURL(/\/dashboard\//, { timeout: 20000 })
    const body = await page.evaluate(async () => (await fetch('/api/doctors')).json())
    const got = ids(body.doctors).filter(i => ALL.includes(i))
    log(`api @central as ${email}: ${label}`, same(got, want) && body.scope === 'clinic', JSON.stringify(got.map(i => i.slice(0, 4))))
    if (email === 'patient.a@canna.test') {
      await page.goto(`${central}/dashboard/patient/appointments`)
      await page.waitForTimeout(3000)
      log('UI: patient appointments page still shows the doctor name', (await page.content()).includes('נועה'))
      await page.goto(`${central}/dashboard/patient/dashboard`)
      await page.waitForTimeout(3000)
      log('UI: patient dashboard still shows the doctor name', (await page.content()).includes('נועה'))
    }
    await ctx.close()
  }
  await browser.close()

  const after = (await admin.from('users').select('id, consultation_price, bio, availability').eq('id', D.a1).single()).data
  log('no doctor data was changed by any attempt', JSON.stringify(before) === JSON.stringify(after))
  const a2 = await admin.from('users').select('id').eq('id', D.a2).maybeSingle()
  log('doctor a2 still exists (delete attempts failed)', !!a2.data)

  const failed = results.filter(r => !r.ok).length
  console.log(`== ${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
