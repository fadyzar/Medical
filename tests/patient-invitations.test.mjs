// Patient invitations + single-clinic membership (migration 031).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inviteStatus, clinicBaseUrl, ACCEPT_MESSAGES } from '../lib/invitations/patient-core.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')
const future = new Date(Date.now() + 3600e3).toISOString(), past = new Date(Date.now() - 1000).toISOString()

test('invitation status: accepted > revoked > expired > pending', () => {
  assert.equal(inviteStatus({ used_at: past, revoked_at: null, expires_at: past }), 'accepted')
  assert.equal(inviteStatus({ used_at: null, revoked_at: past, expires_at: future }), 'revoked')
  assert.equal(inviteStatus({ used_at: null, revoked_at: null, expires_at: past }), 'expired')
  assert.equal(inviteStatus({ used_at: null, revoked_at: null, expires_at: future }), 'pending')
})

test('invite links land on the clinic\'s own site when it exists', () => {
  const platform = { kind: 'platform' }
  const org = { subdomain: 'testtest', domain_status: 'active' }
  assert.equal(clinicBaseUrl(org, 'https://app.cannaforyou.net', platform), 'https://testtest.cannaforyou.net')
  assert.equal(clinicBaseUrl({ ...org, domain_status: 'pending' }, 'https://app.cannaforyou.net', platform), 'https://app.cannaforyou.net')
  assert.equal(clinicBaseUrl(org, 'http://localhost:3105', platform), 'http://testtest.canna.localhost:3105')
  assert.equal(clinicBaseUrl(org, 'https://testtest.cannaforyou.net', { kind: 'clinic', orgId: 'x', host: 'testtest.cannaforyou.net' }), 'https://testtest.cannaforyou.net')
  assert.equal(clinicBaseUrl({ subdomain: null }, 'https://app.cannaforyou.net', platform), 'https://app.cannaforyou.net')
})

test('blocked acceptance explains the one-clinic rule and offers a transfer path, without naming a clinic', () => {
  assert.match(ACCEPT_MESSAGES.other_clinic, /מרפאה אחת בלבד/)
  assert.match(ACCEPT_MESSAGES.other_clinic, /העברה/)
  assert.match(ACCEPT_MESSAGES.other_clinic, /medical@cannaforyou\.net/)
  assert.match(ACCEPT_MESSAGES.already_member, /כבר חבר/)
})

test('migration 031: single-clinic trigger, atomic acceptance, no metadata-chosen clinic', () => {
  const sql = read('supabase/migrations/031_patient_invitations.sql')
  assert.match(sql, /create trigger t_patient_single_clinic/)
  assert.match(sql, /before update of organization_id, role on public\.users/)
  assert.match(sql, /accept_patient_invitation[\s\S]*for update[\s\S]*from public\.users u where u\.id = p_user for update/)
  assert.match(sql, /revoke all on function public\.accept_patient_invitation\(uuid, uuid\) from public, anon, authenticated/)
  assert.match(sql, /revoke all on function public\.transfer_patient_clinic\(uuid, uuid, uuid, text\) from public, anon, authenticated, service_role/)
  assert.match(sql, /create unique index if not exists invitations_one_live_patient/)
  const fn = sql.slice(sql.indexOf('create or replace function public.handle_new_user'))
  assert.doesNotMatch(fn, /raw_user_meta_data->>'organization_id'/)
})

test('APIs: inviter clinic comes from the session, never from the request body', () => {
  const src = read('lib/services/patient-invitations.ts')
  assert.match(src, /organizationId: me\.organization_id/)
  for (const f of ['app/api/patient-invitations/route.ts', 'app/api/patient-invitations/[id]/route.ts']) {
    const r = read(f)
    assert.match(r, /resolveInviter\(user\.id, tenant\)|resolveInviter\(user\.id, tenant\)/, f)
    assert.doesNotMatch(r, /organization_id|organizationId/, f)
  }
  const list = src.slice(src.indexOf('export async function listPatientInvitations'), src.indexOf('export async function resendPatientInvitation'))
  assert.doesNotMatch(list.slice(list.indexOf('return rows.map')), /token/, 'list never returns tokens')
})

test('public registration and booking cannot assign a clinic from the browser', () => {
  const reg = read('app/auth/register/page.tsx')
  assert.doesNotMatch(reg, /organization_id: resolvedOrgId/)
  const join = read('app/api/patient/join-clinic/route.ts')
  assert.match(join, /claim_patient_clinic/)
  assert.doesNotMatch(join, /update\(\{ organization_id: orgId \}\)/)
  const claim = read('app/api/patient/claim-clinic/route.ts')
  assert.match(claim, /signup_host !== host/)
  const cb = read('app/api/auth/callback/route.ts')
  assert.doesNotMatch(cb, /order\('created_at'\)\.limit\(1\)/, 'no "first clinic" fallback')
})

test('email lookups escape ilike wildcards', async () => {
  const { ilikeExact } = await import('../lib/invitations/patient-core.ts')
  assert.equal(ilikeExact('a_b%c@x.com'), 'a\\_b\\%c@x.com')
  assert.equal(ilikeExact('plain@x.com'), 'plain@x.com')
})
