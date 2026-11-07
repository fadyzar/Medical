// Guards for the three defects from the 7 Nov 2026 production acceptance run:
//  1. a clinic's public doctors page listed every clinic's doctors;
//  2. "התנתקות" did nothing when signOut failed;
//  3. onboarding always sent the clinic to app.cannaforyou.net.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTenantSubdomain, DEFAULT_ORG_ID } from '../lib/tenant/index.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')

test('tenant: clinic hosts resolve, platform hosts do not', () => {
  assert.equal(getTenantSubdomain('testtest.cannaforyou.net'), 'testtest')
  assert.equal(getTenantSubdomain('shaked-qa.canna.localhost:3105'), 'shaked-qa')
  for (const h of ['app.cannaforyou.net', 'cannaforyou.net', 'www.cannaforyou.net', 'localhost:3000',
    'medical-git-main-nfd1.vercel.app', '127.0.0.1']) {
    assert.equal(getTenantSubdomain(h), null, h)
  }
  assert.equal(DEFAULT_ORG_ID, '00000000-0000-0000-0000-000000000001')
})

test('doctors: every public doctor listing is scoped to the request tenant', () => {
  for (const f of ['app/doctors/page.tsx', 'app/specialties/[slug]/page.tsx', 'app/doctors/[id]/page.tsx']) {
    const src = read(f)
    assert.match(src, /getRequestTenant\(\)/, f)
  }
  for (const f of ['app/doctors/page.tsx', 'app/specialties/[slug]/page.tsx']) {
    const src = read(f)
    assert.match(src, /tenant\.kind === 'clinic'\) query = query\.eq\('organization_id', tenant\.orgId\)/, f)
    assert.match(src, /tenant\.kind === 'unknown'\s*\?\s*\{ data: \[\] \}/, f)
  }
  assert.match(read('app/doctors/[id]/page.tsx'), /visibleOnTenant\(await getRequestTenant\(\)/)
})

test('doctors: an unknown clinic host never falls back to the marketplace', () => {
  const src = read('lib/tenant/server.ts')
  assert.match(src, /return id \? \{ kind: 'clinic', orgId: id, host \} : \{ kind: 'unknown', host \}/)
})

test('booking APIs enforce the tenant server-side', () => {
  const join = read('app/api/patient/join-clinic/route.ts')
  assert.match(join, /resolveTenantFromHost\(req\.headers\.get\('host'\)\)/)
  assert.match(join, /tenant\.kind === 'clinic' && tenant\.orgId !== orgId/)
  const slots = read('app/api/appointments/available-slots/route.ts')
  assert.match(slots, /tenant\.kind === 'clinic' && tenant\.orgId !== orgId/)
  assert.match(slots, /!marketplacePatient && caller\.organization_id !== orgId/)
  const ai = read('lib/ai/assistant/executors.ts')
  assert.match(ai, /caller\.role === 'patient' && caller\.organizationId && caller\.organizationId !== DEFAULT_ORG_ID/)
})

test('db: appointment doctor must belong to the appointment clinic (029)', () => {
  const sql = read('supabase/migrations/029_appointment_doctor_same_org.sql')
  assert.match(sql, /before insert or update of doctor_id, organization_id on public\.appointments/)
  assert.match(sql, /u\.organization_id = new\.organization_id/)
  assert.match(read('supabase/rollback/029_down.sql'), /drop trigger if exists t_apt_doctor_same_org/)
})

test('logout: signOut failures are handled and the page always leaves', () => {
  const src = read('lib/auth/logout.ts')
  assert.match(src, /if \(res\.error\)/)
  assert.match(src, /signOut\(\{ scope: 'local' \}\)/)
  assert.match(src, /fetch\('\/api\/auth\/logout'/)
  assert.match(src, /window\.location\.replace\(redirectTo\)/)
  const layout = read('components/layout/DashboardLayout.tsx')
  assert.doesNotMatch(layout, /auth\.signOut\(\)/, 'layout must use lib/auth/logout')
  assert.doesNotMatch(layout, /router\.push\('\/auth\/login'\)/)
  assert.match(layout, /event === 'SIGNED_OUT'/)
  const route = read('app/api/auth/logout/route.ts')
  assert.match(route, /c\.name\.startsWith\('sb-'\)/)
  assert.match(route, /maxAge: 0/)
})

test('onboarding: redirects to the clinic address only once it answers', () => {
  const page = read('app/onboarding/page.tsx')
  assert.match(page, /\/api\/onboarding\/domain-ready\?subdomain=/)
  assert.match(page, /window\.location\.assign\(`\$\{d\.url\}\/auth\/login\?onboarding=success`\)/)
  assert.match(page, /הכתובת של המרפאה עדיין בהקמה/)
  const api = read('app/api/onboarding/domain-ready/route.ts')
  assert.match(api, /const url = `https:\/\/\$\{sub\}\.\$\{ROOT_DOMAIN\}`/)
  assert.match(api, /SUBDOMAIN_RE\.test\(sub\)/)
  assert.doesNotMatch(api, /\.update\(|\.insert\(|\.delete\(/, 'readiness check must be read-only')
})
