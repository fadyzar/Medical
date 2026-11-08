/**
 * Clinic-controlled patient invitations (admin and doctor).
 *
 * Every decision is made here, server-side, from the verified session:
 *   * the inviting clinic is the inviter's own clinic — never a client value —
 *     and on a clinic site it must also be the clinic of that site;
 *   * a doctor manages only the invitations they sent, an admin every patient
 *     invitation of the clinic;
 *   * nothing here tells an inviter whether an email belongs to ANOTHER clinic:
 *     only "already in your clinic" is ever reported.
 * Acceptance is accept_patient_invitation() (migration 031): one transaction
 * with row locks, enforcing the single-clinic rule.
 */

import { randomUUID } from 'node:crypto'
import { createServiceRole } from '@/lib/supabase/server'
import { sendPatientInvite } from '@/lib/email'
import { DEFAULT_ORG_ID } from '@/lib/tenant'
import type { RequestTenant } from '@/lib/tenant/server'
import type { ServiceResult } from '@/lib/services/appointments'
import { ACCEPT_MESSAGES, clinicBaseUrl, ilikeExact, inviteStatus, type AcceptOutcome, type PatientInviteStatus } from '@/lib/invitations/patient-core'

export { ACCEPT_MESSAGES, clinicBaseUrl, inviteStatus, type AcceptOutcome, type PatientInviteStatus }

export const PATIENT_INVITE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000


export type Inviter = { id: string; role: 'admin' | 'doctor'; organizationId: string; name: string }

export type PatientInvitationRow = {
  id: string
  email: string
  first_name: string | null
  status: PatientInviteStatus
  created_at: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
  last_sent_at: string | null
  send_count: number
  invited_by: string | null
  invited_by_name: string | null
}

type RawInvite = {
  id: string; email: string; first_name: string | null; created_at: string; expires_at: string
  used_at: string | null; revoked_at: string | null; last_sent_at: string | null; send_count: number | null
  invited_by: string | null; organization_id: string; token: string
}

const INVITE_COLS = 'id, email, first_name, created_at, expires_at, used_at, revoked_at, last_sent_at, send_count, invited_by, organization_id, token'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const invitations = (admin: ReturnType<typeof createServiceRole>) => (admin as any).from('invitations')

/** The verified inviter, or why not. Only an admin or doctor of a real clinic,
 *  and on a clinic site only for that site's clinic. */
export async function resolveInviter(userId: string, tenant: RequestTenant): Promise<ServiceResult<Inviter>> {
  const admin = createServiceRole()
  const { data } = await admin.from('users')
    .select('id, role, organization_id, first_name, last_name, is_active').eq('id', userId).maybeSingle()
  const me = data as { id: string; role: string; organization_id: string | null; first_name: string; last_name: string; is_active: boolean } | null
  if (!me || !me.is_active || (me.role !== 'admin' && me.role !== 'doctor')) {
    return { ok: false, status: 403, error: 'רק מנהל מרפאה או רופא יכולים להזמין מטופלים' }
  }
  if (!me.organization_id || me.organization_id === DEFAULT_ORG_ID) {
    return { ok: false, status: 403, error: 'החשבון אינו משויך למרפאה' }
  }
  if (tenant.kind === 'unknown' || (tenant.kind === 'clinic' && tenant.orgId !== me.organization_id)) {
    return { ok: false, status: 403, error: 'אין הרשאה לפעולה זו באתר זה' }
  }
  const name = `${me.role === 'doctor' ? 'ד"ר ' : ''}${me.first_name || ''} ${me.last_name || ''}`.trim()
  return { ok: true, data: { id: me.id, role: me.role, organizationId: me.organization_id, name } }
}

async function loadOrg(orgId: string) {
  const admin = createServiceRole()
  const { data } = await admin.from('organizations')
    .select('id, name, subdomain, domain_status, custom_domain, primary_color').eq('id', orgId).single()
  return data as { id: string; name: string; subdomain: string | null; domain_status: string | null; custom_domain: string | null; primary_color: string | null }
}

async function audit(orgId: string, userId: string, action: string, invitationId: string, description: string, metadata: Record<string, unknown> = {}) {
  try {
    await createServiceRole().from('audit_logs').insert({
      organization_id: orgId, user_id: userId, action, resource_type: 'invitation', resource_id: invitationId, description, metadata,
    })
  } catch { /* audit is best-effort */ }
}

async function deliver(inviter: Inviter, row: { email: string; first_name: string | null; token: string }, baseUrl: string) {
  const org = await loadOrg(inviter.organizationId)
  const inviteUrl = `${baseUrl}/auth/invite/${row.token}`
  const sent = await sendPatientInvite({
    email: row.email, patientName: row.first_name, organizationId: org.id, organizationName: org.name,
    primaryColor: org.primary_color, inviterName: inviter.name, inviterUserId: inviter.id,
    inviteUrl, expiresDays: PATIENT_INVITE_DAYS, admin: createServiceRole(),
  })
  return { sent, inviteUrl }
}

export type InviteResult = {
  invitationId: string
  outcome: 'sent' | 'duplicate' | 'refreshed'
  emailSent: boolean
  /** Returned only when the email could not be sent, so the inviter can share it by hand. */
  inviteUrl?: string
}

export async function createPatientInvitation(params: {
  inviter: Inviter
  email: string
  name?: string
  requestOrigin: string
  tenant: RequestTenant
}): Promise<ServiceResult<InviteResult>> {
  const { inviter } = params
  const email = params.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, status: 400, error: 'כתובת אימייל לא תקינה' }
  const admin = createServiceRole()
  const orgId = inviter.organizationId

  // Only facts about the inviter's OWN clinic are ever reported.
  const { data: member } = await admin.from('users')
    .select('role').eq('organization_id', orgId).ilike('email', ilikeExact(email)).maybeSingle()
  if (member) {
    const role = (member as { role: string }).role
    return { ok: false, status: 409, error: role === 'patient' ? 'המטופל כבר רשום במרפאה שלך' : 'כתובת זו שייכת לחבר צוות במרפאה' }
  }

  const firstName = params.name?.trim().slice(0, 60) || null
  const org = await loadOrg(orgId)
  const baseUrl = clinicBaseUrl(org, params.requestOrigin, params.tenant)

  const { data: live } = await invitations(admin)
    .select(INVITE_COLS).eq('organization_id', orgId).eq('role', 'patient').ilike('email', ilikeExact(email))
    .is('used_at', null).is('revoked_at', null).maybeSingle()
  const existing = live as RawInvite | null

  if (existing && inviteStatus(existing) === 'pending') {
    return { ok: true, data: { invitationId: existing.id, outcome: 'duplicate', emailSent: false } }
  }

  let row: RawInvite
  let outcome: InviteResult['outcome'] = 'sent'
  const now = new Date()
  const expires = new Date(now.getTime() + PATIENT_INVITE_DAYS * DAY_MS).toISOString()
  if (existing) {
    // Expired: refresh in place with a new token, so the old link is dead.
    const { data, error } = await invitations(admin)
      .update({ token: randomUUID(), expires_at: expires, last_sent_at: now.toISOString(), send_count: (existing.send_count || 1) + 1, invited_by: inviter.id, first_name: firstName ?? existing.first_name })
      .eq('id', existing.id).is('used_at', null).is('revoked_at', null).select(INVITE_COLS).single()
    if (error || !data) return { ok: false, status: 500, error: 'יצירת ההזמנה נכשלה' }
    row = data as RawInvite
    outcome = 'refreshed'
  } else {
    const { data, error } = await invitations(admin)
      .insert({ organization_id: orgId, email, role: 'patient', invited_by: inviter.id, first_name: firstName, expires_at: expires, last_sent_at: now.toISOString(), send_count: 1 })
      .select(INVITE_COLS).single()
    if (error?.code === '23505') {
      // A concurrent request created it first.
      const { data: again } = await invitations(admin).select('id').eq('organization_id', orgId).eq('role', 'patient')
        .ilike('email', ilikeExact(email)).is('used_at', null).is('revoked_at', null).maybeSingle()
      return { ok: true, data: { invitationId: (again as { id: string } | null)?.id || '', outcome: 'duplicate', emailSent: false } }
    }
    if (error || !data) return { ok: false, status: 500, error: 'יצירת ההזמנה נכשלה' }
    row = data as RawInvite
  }

  const { sent, inviteUrl } = await deliver(inviter, row, baseUrl)
  await audit(orgId, inviter.id, 'patient_invited', row.id, `הזמנת מטופל: ${email}`, { email, email_sent: sent.success, by_role: inviter.role, refreshed: outcome === 'refreshed' })
  return { ok: true, data: { invitationId: row.id, outcome, emailSent: sent.success, inviteUrl: sent.success ? undefined : inviteUrl } }
}

async function loadManaged(inviter: Inviter, id: string): Promise<ServiceResult<RawInvite>> {
  const admin = createServiceRole()
  const { data } = await invitations(admin).select(INVITE_COLS)
    .eq('id', id).eq('organization_id', inviter.organizationId).eq('role', 'patient').maybeSingle()
  const row = data as RawInvite | null
  // Same answer for "other clinic's" and "someone else's" invitation: not found.
  if (!row || (inviter.role === 'doctor' && row.invited_by !== inviter.id)) return { ok: false, status: 404, error: 'ההזמנה לא נמצאה' }
  return { ok: true, data: row }
}

export async function listPatientInvitations(inviter: Inviter): Promise<PatientInvitationRow[]> {
  const admin = createServiceRole()
  let q = invitations(admin).select(INVITE_COLS)
    .eq('organization_id', inviter.organizationId).eq('role', 'patient')
  if (inviter.role === 'doctor') q = q.eq('invited_by', inviter.id)
  const { data } = await q.order('created_at', { ascending: false }).limit(300)
  const rows = (data || []) as RawInvite[]
  const inviterIds = [...new Set(rows.map(r => r.invited_by).filter(Boolean))] as string[]
  const names: Record<string, string> = {}
  if (inviterIds.length) {
    const { data: us } = await admin.from('users').select('id, first_name, last_name, role')
      .in('id', inviterIds).eq('organization_id', inviter.organizationId)
    for (const u of (us || []) as Array<{ id: string; first_name: string; last_name: string; role: string }>) {
      names[u.id] = `${u.role === 'doctor' ? 'ד"ר ' : ''}${u.first_name} ${u.last_name}`.trim()
    }
  }
  // Never the token.
  return rows.map(r => ({
    id: r.id, email: r.email, first_name: r.first_name, status: inviteStatus(r),
    created_at: r.created_at, expires_at: r.expires_at, used_at: r.used_at, revoked_at: r.revoked_at,
    last_sent_at: r.last_sent_at, send_count: r.send_count || 1,
    invited_by: r.invited_by, invited_by_name: r.invited_by ? names[r.invited_by] || null : null,
  }))
}

export async function resendPatientInvitation(params: { inviter: Inviter; id: string; requestOrigin: string; tenant: RequestTenant }): Promise<ServiceResult<InviteResult>> {
  const { inviter } = params
  const found = await loadManaged(inviter, params.id)
  if (!found.ok) return found
  const status = inviteStatus(found.data)
  if (status === 'accepted') return { ok: false, status: 409, error: 'ההזמנה כבר אושרה' }
  if (status === 'revoked') return { ok: false, status: 409, error: 'ההזמנה בוטלה — צור/י הזמנה חדשה' }

  const admin = createServiceRole()
  const now = new Date()
  // New token on every resend: links from earlier emails stop working.
  const { data, error } = await invitations(admin)
    .update({ token: randomUUID(), expires_at: new Date(now.getTime() + PATIENT_INVITE_DAYS * DAY_MS).toISOString(), last_sent_at: now.toISOString(), send_count: (found.data.send_count || 1) + 1 })
    .eq('id', found.data.id).is('used_at', null).is('revoked_at', null).select(INVITE_COLS).single()
  if (error || !data) return { ok: false, status: 409, error: 'לא ניתן לשלוח שוב את ההזמנה' }
  const row = data as RawInvite
  const org = await loadOrg(inviter.organizationId)
  const { sent, inviteUrl } = await deliver(inviter, row, clinicBaseUrl(org, params.requestOrigin, params.tenant))
  await audit(inviter.organizationId, inviter.id, 'patient_invite_resent', row.id, `שליחה חוזרת של הזמנת מטופל: ${row.email}`, { email: row.email, email_sent: sent.success })
  return { ok: true, data: { invitationId: row.id, outcome: 'sent', emailSent: sent.success, inviteUrl: sent.success ? undefined : inviteUrl } }
}

export async function revokePatientInvitation(params: { inviter: Inviter; id: string }): Promise<ServiceResult<{ invitationId: string }>> {
  const { inviter } = params
  const found = await loadManaged(inviter, params.id)
  if (!found.ok) return found
  const status = inviteStatus(found.data)
  if (status === 'accepted') return { ok: false, status: 409, error: 'ההזמנה כבר אושרה ולא ניתן לבטל אותה' }
  if (status === 'revoked') return { ok: true, data: { invitationId: found.data.id } }
  const admin = createServiceRole()
  const { data, error } = await invitations(admin)
    .update({ revoked_at: new Date().toISOString(), revoked_by: inviter.id })
    .eq('id', found.data.id).is('used_at', null).is('revoked_at', null).select('id').maybeSingle()
  if (error) return { ok: false, status: 500, error: 'ביטול ההזמנה נכשל' }
  if (!data) return { ok: false, status: 409, error: 'ההזמנה כבר אושרה' }
  await audit(inviter.organizationId, inviter.id, 'patient_invite_revoked', found.data.id, `ביטול הזמנת מטופל: ${found.data.email}`, { email: found.data.email })
  return { ok: true, data: { invitationId: found.data.id } }
}

/** Accept a patient invitation for a signed-in user (atomic, in the database). */
export async function acceptPatientInvitation(token: string, userId: string): Promise<{ outcome: AcceptOutcome; organizationId: string | null }> {
  const admin = createServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('accept_patient_invitation', { p_token: token, p_user: userId })
  if (error) {
    // Defence in depth: the single-clinic trigger fired.
    if (error.code === '23514') return { outcome: 'other_clinic', organizationId: null }
    throw new Error('accept failed')
  }
  const row = (Array.isArray(data) ? data[0] : data) as { outcome: AcceptOutcome; organization_id: string | null } | undefined
  return { outcome: row?.outcome || 'not_found', organizationId: row?.organization_id || null }
}

/** Patient signed up on a clinic's own site: join that clinic (host-derived only). */
export async function claimClinicFromHost(userId: string, tenant: RequestTenant): Promise<string> {
  if (tenant.kind !== 'clinic') return 'not_clinic_site'
  const admin = createServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('claim_patient_clinic', { p_user: userId, p_org: tenant.orgId })
  if (error) return error.code === '23514' ? 'other_clinic' : 'error'
  return data as string
}
