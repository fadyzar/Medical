const { createClient } = require('@supabase/supabase-js')
const { chromium } = require('playwright')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, PW = 'CannaQA-Local-2026!'
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ORG_A = '11111111-1111-4111-8111-111111111111', D2 = '2578f361-8918-47cc-be34-f7f2adb49f48', PA = '5e834b03-c430-4858-ab4b-baabc4adce55', D1 = '7642d2c1-1466-44b0-bd26-ad5bdc19ad74'
const ids = []; let fails = 0
const log = (n, ok, i = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`) }
const as = async (email) => { const c = createClient(URL_, ANON, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email, password: PW }); return c }
;(async () => {
  try {
    // 1. doctor's client may start a confirmed consultation, and only that
    const { data: a } = await admin.from('appointments').insert({ organization_id: ORG_A, patient_id: PA, doctor_id: D2, chief_complaint: 'QA', scheduled_at: new Date(Date.now() - 60e3).toISOString(), status: 'confirmed', approved_at: new Date().toISOString(), payment_collection: 'none' }).select('id').single(); ids.push(a.id)
    const doc = await as('doctor.a2@canna.test')
    const up = await doc.from('appointments').update({ status: 'in_progress', video_started_at: new Date().toISOString() }).eq('id', a.id).select('status')
    log('doctor client: confirmed → in_progress allowed', !up.error && up.data?.[0]?.status === 'in_progress', up.error?.message || '')
    const soap = await doc.from('appointments').update({ subjective_notes: 'QA note' }).eq('id', a.id).select('id')
    log('doctor client: SOAP notes still writable', !soap.error)
    // 2. open request (no time) → doctor sets time via reschedule → approve
    const pat = await as('patient.a@canna.test')
    const { data: o, error: oe } = await pat.from('appointments').insert({ organization_id: ORG_A, patient_id: PA, doctor_id: D1, chief_complaint: 'QA', status: 'pending' }).select('id').single(); if (oe) throw oe; ids.push(o.id)
    const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage()
    const call = (path, body) => p.evaluate(async ([u, bd]) => { const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bd) }); return { s: r.status, b: await r.json().catch(() => null) } }, [path, body])
    await p.goto('http://shaked-qa.canna.localhost:3105/auth/login'); await p.fill('input[type=email]', 'patient.a@canna.test'); await p.fill('input[type=password]', PW); await p.click('button[type=submit]'); await p.waitForURL(u => !u.toString().includes('/auth/login'))
    const sub = await call('/api/appointments/submit', { appointmentId: o.id })
    log('patient submit without a time → open request (stays pending)', sub.s === 200 && sub.b.next === 'open_request', JSON.stringify(sub.b))
    await ctx.clearCookies(); await p.goto('http://shaked-qa.canna.localhost:3105/auth/login'); await p.fill('input[type=email]', 'doctor.a1@canna.test'); await p.fill('input[type=password]', PW); await p.click('button[type=submit]'); await p.waitForURL(u => !u.toString().includes('/auth/login'))
    const noTime = await call('/api/appointments/decision', { appointmentId: o.id, decision: 'approve' })
    log('approve without a time → 409 asks for a time', noTime.s === 409 && noTime.b.code === 'no_time', JSON.stringify(noTime.b))
    const when = new Date(Math.ceil((Date.now() + 5 * 864e5) / 1800e3) * 1800e3).toISOString()
    const rs = await call('/api/appointments/reschedule', { appointmentId: o.id, scheduledAt: when, durationMinutes: 30 })
    const ap = await call('/api/appointments/decision', { appointmentId: o.id, decision: 'approve' })
    const row = (await admin.from('appointments').select('status, payment_collection, approved_by').eq('id', o.id).single()).data
    log('doctor sets the time, then approves → confirmed', rs.s === 200 && ap.s === 200 && row.status === 'confirmed' && row.approved_by === D1 && row.payment_collection === 'none', `${rs.s}/${ap.s}/${row.status}`)
    // 3. clinic reschedule of a confirmed visit by the doctor keeps it confirmed; patient reschedule → re-approval
    const when2 = new Date(new Date(when).getTime() + 864e5).toISOString()
    const rs2 = await call('/api/appointments/reschedule', { appointmentId: o.id, scheduledAt: when2 })
    log('doctor moves a confirmed visit → stays confirmed', rs2.s === 200 && rs2.b?.status === 'confirmed', JSON.stringify(rs2.b))
    await ctx.clearCookies(); await p.goto('http://shaked-qa.canna.localhost:3105/auth/login'); await p.fill('input[type=email]', 'patient.a@canna.test'); await p.fill('input[type=password]', PW); await p.click('button[type=submit]'); await p.waitForURL(u => !u.toString().includes('/auth/login'))
    const rs3 = await call('/api/appointments/reschedule', { appointmentId: o.id, scheduledAt: new Date(new Date(when2).getTime() + 864e5).toISOString() })
    const r3 = (await admin.from('appointments').select('status, approved_at').eq('id', o.id).single()).data
    log('patient moves a confirmed visit → back to doctor approval, approval cleared', rs3.s === 200 && r3.status === 'pending_approval' && !r3.approved_at, JSON.stringify(r3))
    await b.close()
    // 4. cron releases unpaid online holds after 30 minutes
    const { data: h } = await admin.from('appointments').insert({ organization_id: ORG_A, patient_id: PA, doctor_id: D2, chief_complaint: 'QA', scheduled_at: new Date(Date.now() + 9 * 864e5).toISOString(), status: 'payment_pending', payment_collection: 'online', payment_status: 'pending', created_at: new Date(Date.now() - 40 * 60e3).toISOString() }).select('id').single(); ids.push(h.id)
    const { data: fresh } = await admin.from('appointments').insert({ organization_id: ORG_A, patient_id: PA, doctor_id: D2, chief_complaint: 'QA', scheduled_at: new Date(Date.now() + 9.5 * 864e5).toISOString(), status: 'payment_pending', payment_collection: 'online', payment_status: 'pending' }).select('id').single(); ids.push(fresh.id)
    const cron = await fetch('http://localhost:3105/api/cron/reminders', { headers: { 'x-cron-secret': 'local-qa-cron' } }).then(r => r.json())
    const hs = (await admin.from('appointments').select('status').eq('id', h.id).single()).data.status
    const fs = (await admin.from('appointments').select('status').eq('id', fresh.id).single()).data.status
    log('cron: unpaid hold older than 30 min released; fresh hold kept', hs === 'cancelled_patient' && fs === 'payment_pending' && cron.expiredPaymentHolds >= 1, `${hs}/${fs}/${cron.expiredPaymentHolds}`)
  } catch (e) { fails++; console.log('FAIL uncaught', e.message) }
  finally {
    await admin.from('notifications').delete().in('appointment_id', ids); await admin.from('audit_logs').delete().in('resource_id', ids); await admin.from('appointments').delete().in('id', ids)
    console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0)
  }
})()
