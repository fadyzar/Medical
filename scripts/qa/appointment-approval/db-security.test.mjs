// LOCAL QA — database rules of the approval lifecycle (migrations 032/033).
// Every case runs in its own transaction and is rolled back.
//
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
//     node --test scripts/qa/appointment-approval/db-security.test.mjs
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error('LOCAL QA only')
const pool = new pg.Pool({ connectionString: url, max: 6 })
after(() => pool.end())

const db = async () => {
  const c = await pool.connect()
  const ids = Object.fromEntries((await c.query(
    `select split_part(email,'@',1) k, id from users where email like '%@canna.test'`)).rows.map(r => [r.k, r.id]))
  return { c, ids }
}
const ORG_A = '11111111-1111-4111-8111-111111111111'

/** Run `fn` as a browser session of `uid` (PostgREST: role authenticated + JWT sub). */
async function asUser(c, uid, fn) {
  await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
    [JSON.stringify({ sub: uid, role: 'authenticated' }), uid])
  await c.query('set local role authenticated')
  try { return await fn() } finally { await c.query('reset role') }
}
async function expectError(c, sql, params, re) {
  await c.query('savepoint s')
  try {
    await c.query(sql, params)
    await c.query('release savepoint s')
    assert.fail(`expected error ${re} for: ${sql}`)
  } catch (e) {
    if (e.code === 'ERR_ASSERTION') throw e
    await c.query('rollback to savepoint s')
    assert.match(String(e.message), re)
  }
}
const future = (h) => new Date(Math.ceil((Date.now() + h * 3600e3) / 1800e3) * 1800e3).toISOString()

async function makeApt(c, over) {
  const o = { status: 'pending_approval', payment_collection: 'online', payment_status: 'completed', payment_amount: 250, duration: 30, ...over }
  const { rows } = await c.query(
    `insert into appointments (organization_id, patient_id, doctor_id, chief_complaint, scheduled_at, duration_minutes, status, payment_collection, payment_status, payment_amount)
     values ($1,$2,$3,'QA',$4,$5,$6,$7,$8,$9) returning id`,
    [o.org ?? ORG_A, o.patient, o.doctor, o.at, o.duration, o.status, o.payment_collection, o.payment_status, o.payment_amount])
  return rows[0].id
}
const rpc = async (c, fn, ...args) => (await c.query(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(',')}) r`, args)).rows[0].r

test('patients cannot write payment, approval or status through the REST role', async () => {
  const { c, ids } = await db()
  try {
    await c.query('begin')
    const apt = await makeApt(c, { patient: ids['patient.a'], doctor: ids['doctor.a2'], at: future(30), status: 'payment_pending', payment_status: 'pending' })
    await asUser(c, ids['patient.a'], async () => {
      await expectError(c, `update appointments set payment_status='completed' where id=$1`, [apt], /managed by the server/)
      await expectError(c, `update appointments set payment_amount=1 where id=$1`, [apt], /managed by the server/)
      await expectError(c, `update appointments set status='confirmed' where id=$1`, [apt], /booking service|set by the server/)
      await expectError(c, `update appointments set approved_at=now() where id=$1`, [apt], /managed by the server/)
      await expectError(c, `update appointments set scheduled_at=$2 where id=$1`, [apt, future(40)], /booking service/)
    })
    // Legacy 'pending' row: a patient still cannot move it to 'scheduled' directly.
    const legacy = await makeApt(c, { patient: ids['patient.a'], doctor: ids['doctor.a2'], at: future(31), status: 'pending', payment_collection: null, payment_status: null })
    await asUser(c, ids['patient.a'], () =>
      expectError(c, `update appointments set status='scheduled' where id=$1`, [legacy], /booking service/))
  } finally { await c.query('rollback'); c.release() }
})

test('a patient booking is priced from the doctor, starts pending, with no payment/approval state', async () => {
  const { c, ids } = await db()
  try {
    await c.query('begin')
    const row = await asUser(c, ids['patient.a'], async () => (await c.query(
      `insert into appointments (organization_id, patient_id, doctor_id, chief_complaint, scheduled_at, status, payment_amount, payment_status, approved_at)
       values ($1,$2,$3,'QA',$4,'pending',1,'completed',now()) returning id, payment_amount, payment_status, approved_at, status`,
      [ORG_A, ids['patient.a'], ids['doctor.a2'], future(26)])).rows[0])
    assert.equal(Number(row.payment_amount), 250)
    assert.equal(row.payment_status, null)
    assert.equal(row.approved_at, null)
    await asUser(c, ids['patient.a'], () => expectError(c,
      `insert into appointments (organization_id, patient_id, doctor_id, chief_complaint, scheduled_at, status) values ($1,$2,$3,'QA',$4,'confirmed')`,
      [ORG_A, ids['patient.a'], ids['doctor.a2'], future(27)], /start as pending/))
  } finally { await c.query('rollback'); c.release() }
})

test('doctors cannot confirm from the browser; approve/reject are not callable by API roles', async () => {
  const { c, ids } = await db()
  try {
    await c.query('begin')
    const apt = await makeApt(c, { patient: ids['patient.a'], doctor: ids['doctor.a2'], at: future(32) })
    await asUser(c, ids['doctor.a2'], async () => {
      await expectError(c, `update appointments set status='confirmed' where id=$1`, [apt], /changed by the server|set by the server/)
      await expectError(c, `select public.approve_appointment($1,$2)`, [apt, ids['doctor.a2']], /permission denied/)
      await expectError(c, `select public.reject_appointment($1,$2)`, [apt, ids['doctor.a2']], /permission denied/)
    })
    for (const role of ['anon']) {
      await c.query(`set local role ${role}`)
      await expectError(c, `select public.approve_appointment($1,$2)`, [apt, ids['doctor.a2']], /permission denied/)
      await c.query('reset role')
    }
  } finally { await c.query('rollback'); c.release() }
})

test('approval: assigned doctor or same-clinic admin only; payment verified; duplicate is a no-op', async () => {
  const { c, ids } = await db()
  try {
    await c.query('begin')
    const apt = await makeApt(c, { patient: ids['patient.a'], doctor: ids['doctor.a2'], at: future(33) })
    assert.equal((await rpc(c, 'approve_appointment', apt, ids['doctor.a1'])).code, 'forbidden')   // other doctor, same clinic
    assert.equal((await rpc(c, 'approve_appointment', apt, ids['doctor.b1'])).code, 'forbidden')   // other clinic
    assert.equal((await rpc(c, 'approve_appointment', apt, ids['admin.b'])).code, 'forbidden')     // other clinic admin
    assert.equal((await rpc(c, 'approve_appointment', apt, ids['staff.a'])).code, 'forbidden')     // staff not authorized
    assert.equal((await rpc(c, 'approve_appointment', apt, ids['patient.a'])).code, 'forbidden')
    const unpaid = await makeApt(c, { patient: ids['patient.a2'], doctor: ids['doctor.a2'], at: future(34), payment_status: 'pending' })
    assert.equal((await rpc(c, 'approve_appointment', unpaid, ids['doctor.a2'])).code, 'payment_not_verified')
    const ok = await rpc(c, 'approve_appointment', apt, ids['doctor.a2'])
    assert.equal(ok.ok, true)
    assert.equal((await rpc(c, 'approve_appointment', apt, ids['doctor.a2'])).code, 'already_confirmed')
    assert.equal((await rpc(c, 'reject_appointment', apt, ids['doctor.a2'])).code, 'invalid_status')
    const row = (await c.query('select status, approved_by, approved_at from appointments where id=$1', [apt])).rows[0]
    assert.equal(row.status, 'confirmed'); assert.equal(row.approved_by, ids['doctor.a2']); assert.ok(row.approved_at)
    const admin = await makeApt(c, { patient: ids['patient.a2'], doctor: ids['doctor.a1'], at: future(35), payment_collection: 'none', payment_status: null, payment_amount: null })
    assert.equal((await rpc(c, 'approve_appointment', admin, ids['admin.a'])).ok, true)              // clinic admin
    const audits = (await c.query(`select count(*)::int n from audit_logs where resource_id=$1 and action='APPOINTMENT_APPROVED'`, [apt])).rows[0].n
    assert.equal(audits, 1)
  } finally { await c.query('rollback'); c.release() }
})

test('approval refuses past, unscheduled and overlapping bookings (no double-booking)', async () => {
  const { c, ids } = await db()
  try {
    await c.query('begin')
    const at = future(36)
    const first = await makeApt(c, { patient: ids['patient.a'], doctor: ids['doctor.a2'], at, duration: 60 })
    const overlapping = await makeApt(c, { patient: ids['patient.a2'], doctor: ids['doctor.a2'], at: new Date(new Date(at).getTime() + 30 * 60e3).toISOString() })
    assert.equal((await rpc(c, 'approve_appointment', first, ids['doctor.a2'])).ok, true)
    assert.equal((await rpc(c, 'approve_appointment', overlapping, ids['doctor.a2'])).code, 'conflict')
    await expectError(c, `insert into appointments (organization_id, patient_id, doctor_id, chief_complaint, scheduled_at, status) values ($1,$2,$3,'QA',$4,'pending_approval')`,
      [ORG_A, ids['patient.a2'], ids['doctor.a2'], at], /appointments_doctor_slot_unique/)
    const past = await makeApt(c, { patient: ids['patient.a2'], doctor: ids['doctor.a1'], at: new Date(Date.now() - 3 * 3600e3).toISOString() })
    assert.equal((await rpc(c, 'approve_appointment', past, ids['doctor.a1'])).code, 'time_passed')
    const noTime = await makeApt(c, { patient: ids['patient.a2'], doctor: ids['doctor.a1'], at: null })
    assert.equal((await rpc(c, 'approve_appointment', noTime, ids['doctor.a1'])).code, 'no_time')
  } finally { await c.query('rollback'); c.release() }
})

test('rejection frees the slot and flags a refund for captured payments', async () => {
  const { c, ids } = await db()
  try {
    await c.query('begin')
    const at = future(37)
    const paid = await makeApt(c, { patient: ids['patient.a'], doctor: ids['doctor.a2'], at })
    const r = await rpc(c, 'reject_appointment', paid, ids['doctor.a2'], 'QA reason')
    assert.equal(r.ok, true); assert.equal(r.refund_required, true)
    const row = (await c.query('select status, refund_status, rejected_by, rejection_reason from appointments where id=$1', [paid])).rows[0]
    assert.deepEqual([row.status, row.refund_status, row.rejected_by, row.rejection_reason], ['rejected', 'pending', ids['doctor.a2'], 'QA reason'])
    assert.equal((await rpc(c, 'reject_appointment', paid, ids['doctor.a2'])).code, 'already_rejected')
    assert.equal((await rpc(c, 'approve_appointment', paid, ids['doctor.a2'])).code, 'invalid_status')
    await makeApt(c, { patient: ids['patient.a2'], doctor: ids['doctor.a2'], at }) // same slot is bookable again
    const clinic = await makeApt(c, { patient: ids['patient.a'], doctor: ids['doctor.a1'], at: future(38), payment_collection: 'clinic', payment_status: null })
    assert.equal((await rpc(c, 'reject_appointment', clinic, ids['doctor.a1'])).refund_required, false)
  } finally { await c.query('rollback'); c.release() }
})

test('concurrent approvals: exactly one wins (same appointment, and overlapping appointments)', async () => {
  const setup = await pool.connect()
  const ids = Object.fromEntries((await setup.query(
    `select split_part(email,'@',1) k, id from users where email like '%@canna.test'`)).rows.map(r => [r.k, r.id]))
  const at = future(39)
  const a = await makeApt(setup, { patient: ids['patient.a'], doctor: ids['doctor.a2'], at, duration: 60 })
  const b = await makeApt(setup, { patient: ids['patient.a2'], doctor: ids['doctor.a2'], at: new Date(new Date(at).getTime() + 30 * 60e3).toISOString() })
  try {
    const same = await Promise.all([1, 2, 3].map(() => pool.query('select public.approve_appointment($1,$2) r', [a, ids['doctor.a2']])))
    const sameCodes = same.map(x => x.rows[0].r.ok ? 'ok' : x.rows[0].r.code).sort()
    assert.deepEqual(sameCodes, ['already_confirmed', 'already_confirmed', 'ok'])
    await setup.query(`update appointments set status='pending_approval', approved_at=null, approved_by=null where id=$1`, [a])
    const both = await Promise.all([a, b].map(id => pool.query('select public.approve_appointment($1,$2) r', [id, ids['doctor.a2']])))
    const codes = both.map(x => x.rows[0].r.ok ? 'ok' : x.rows[0].r.code).sort()
    assert.deepEqual(codes, ['conflict', 'ok'])
  } finally {
    await setup.query('delete from audit_logs where resource_id = any($1)', [[a, b]])
    await setup.query('delete from appointments where id = any($1)', [[a, b]])
    setup.release()
  }
})
