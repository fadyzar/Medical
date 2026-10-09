/**
 * Clinic team invitations — one implementation for the admin Users screen
 * (/api/admin/invite) and the AI assistant's invite_member action.
 *
 * The invitation row is the source of truth; the email is delivery. If the
 * email cannot be sent the invitation still exists and the admin gets the link
 * to share by hand, instead of a dead "failed" with nothing created.
 */

import { createServiceRole } from '@/lib/supabase/server'
import { sendDoctorInvite, sendStaffInvite } from '@/lib/email'
import type { Caller, ServiceResult } from '@/lib/services/appointments'

export type InviteRole = 'doctor' | 'staff' | 'admin'

export const INVITE_ROLE_LABELS: Record<InviteRole, string> = { doctor: 'רופא', staff: 'צוות', admin: 'מנהל' }

export type InviteOutcome = {
  email: string
  role: InviteRole
  name: string
  inviteUrl: string | null
  emailSent: boolean
  emailError?: string
}

/** First name without a title: "ד"ר רון כהן" -> "רון", "Dr. Ron Cohen" -> "Ron". */
export function firstNameOf(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/).filter(p => !/^(ד["״']?ר['׳]?|דר['׳]|פרופ['׳]?|dr\.?|prof\.?)$/i.test(p))
  return parts[0] || null
}

export async function inviteMember(params: {
  caller: Caller
  email: string
  role: InviteRole
  name?: string
  baseUrl: string
}): Promise<ServiceResult<InviteOutcome>> {
  const { caller, role } = params
  if (caller.role !== 'admin' || !caller.organizationId) {
    return { ok: false, status: 403, error: 'רק מנהל מרפאה יכול להזמין משתמשים' }
  }
  const email = params.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, status: 400, error: 'כתובת אימייל לא תקינה' }

  const admin = createServiceRole()
  const orgId = caller.organizationId

  // Already a member of this clinic? Nothing to invite.
  const { data: member } = await admin.from('users')
    .select('id, role').eq('organization_id', orgId).ilike('email', email).maybeSingle()
  if (member && (member as { role: string }).role !== 'patient') {
    return { ok: false, status: 409, error: 'המשתמש כבר חבר בצוות המרפאה' }
  }

  const [{ data: org }, { data: inviter }] = await Promise.all([
    admin.from('organizations').select('name, settings').eq('id', orgId).single(),
    admin.from('users').select('first_name, last_name').eq('id', caller.id).single(),
  ])
  const orgName = (org as { name?: string } | null)?.name || 'מרפאה'
  const orgSettings = ((org as { settings?: Record<string, unknown> } | null)?.settings) || {}
  const inviterRow = inviter as { first_name: string; last_name: string } | null
  const inviterName = inviterRow ? `${inviterRow.first_name} ${inviterRow.last_name}` : 'מנהל המרפאה'
  const name = params.name?.trim() || email.split('@')[0]

  // Reuse a live invitation for the same address, otherwise create one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitations = () => (admin as any).from('invitations')
  let token: string | undefined
  const { data: existing } = await invitations()
    .select('token')
    .eq('organization_id', orgId).eq('email', email)
    .is('used_at', null).gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (existing) {
    token = (existing as { token: string }).token
  } else {
    const { data: created, error } = await invitations()
      .insert({ organization_id: orgId, email, role, invited_by: caller.id, first_name: firstNameOf(name) })
      .select('token').single()
    if (error) return { ok: false, status: 500, error: 'יצירת ההזמנה נכשלה' }
    token = (created as { token: string }).token
  }

  const sent = role === 'doctor'
    ? await sendDoctorInvite({
        doctorName: name, doctorEmail: email, organizationId: orgId, organizationName: orgName,
        inviterName, inviterUserId: caller.id, inviteToken: token, baseUrl: params.baseUrl, admin,
      })
    : await sendStaffInvite({
        name, email, role, organizationId: orgId, organizationName: orgName,
        inviterName, inviterUserId: caller.id, inviteToken: token, baseUrl: params.baseUrl, admin,
      })

  const pending = (orgSettings.pending_invites as Array<{ name: string; email: string; role: string }>) || []
  if (!pending.some(i => i.email === email)) {
    await admin.from('organizations').update({
      settings: { ...orgSettings, pending_invites: [...pending, { name, email, role }] },
    }).eq('id', orgId)
  }

  try {
    await admin.from('audit_logs').insert({
      organization_id: orgId,
      user_id: caller.id,
      action: 'user_invited',
      resource_type: 'user',
      description: `הזמנת ${INVITE_ROLE_LABELS[role]}: ${name} (${email})`,
      metadata: { name, email, role, email_sent: sent.success },
    })
  } catch { /* audit is best-effort */ }

  return {
    ok: true,
    data: {
      email, role, name,
      inviteUrl: token ? `${params.baseUrl}/auth/invite/${token}` : null,
      emailSent: sent.success,
      emailError: sent.success ? undefined : sent.error,
    },
  }
}
