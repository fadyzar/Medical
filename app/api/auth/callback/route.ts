import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import { acceptPatientInvitation, claimClinicFromHost } from '@/lib/services/patient-invitations'
import { resolveTenantFromHost, trustedOrigin } from '@/lib/tenant/server'
import { DEFAULT_ORG_ID } from '@/lib/tenant'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // Redirect back to the host the user is actually on (a clinic site keeps its
  // own session cookies), not to whatever host the server process thinks it has.
  const origin = trustedOrigin(request.headers, await resolveTenantFromHost(request.headers.get('host')))
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/patient/dashboard'
  // Set by the invite form. When the confirmation link fails (already used,
  // expired, opened in another browser) the invitee is sent to sign in and is
  // brought back to the invitation to complete it, instead of a dead end.
  const inviteParam = searchParams.get('invite')
  const inviteRetry = inviteParam && /^[0-9a-f-]{36}$/i.test(inviteParam)
    ? `/auth/login?error=confirm_link&redirect=${encodeURIComponent(`/auth/invite/${inviteParam}`)}`
    : null

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = createServiceRole()
        const meta = user.user_metadata || {}
        const inviteToken = meta.invite_token as string | undefined

        // ── Process invite token if present ──────────────
        // The token is secret and is re-validated here against this exact email;
        // the role and clinic always come from the invitation row, never from
        // the signup metadata (written by the browser).
        if (inviteToken && /^[0-9a-f-]{36}$/i.test(inviteToken)) {
          type UserRole = 'patient' | 'doctor' | 'staff' | 'admin'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const invitationsTable = () => (admin as any).from('invitations')
          const { data: inv } = await invitationsTable()
            .select('id, organization_id, email, role, expires_at, used_at, revoked_at')
            .eq('token', inviteToken)
            .maybeSingle()
          type InvRow = { id: string; organization_id: string; email: string; role: UserRole; expires_at: string; used_at: string | null; revoked_at: string | null }
          const invite = inv as InvRow | null

          if (invite?.role === 'patient') {
            // Atomic, single-clinic (migration 031). Whatever the outcome, the
            // invitation page explains it.
            await acceptPatientInvitation(inviteToken, user.id).catch(() => null)
            return NextResponse.redirect(`${origin}/auth/invite/${inviteToken}`)
          }

          if (
            invite &&
            !invite.used_at &&
            !invite.revoked_at &&
            new Date(invite.expires_at) > new Date() &&
            invite.email.toLowerCase() === user.email?.toLowerCase()
          ) {
            // Claim atomically (single use), then apply role + clinic.
            const { data: claimed } = await invitationsTable()
              .update({ used_at: new Date().toISOString(), accepted_by: user.id })
              .eq('id', invite.id).is('used_at', null).is('revoked_at', null)
              .select('id').maybeSingle()
            if (claimed) {
              await admin.from('users').update({ role: invite.role, organization_id: invite.organization_id }).eq('id', user.id)
            }
          }
        } else if (meta.signup_host && meta.signup_host === request.headers.get('host')) {
          // Registered on a clinic's own site and confirmed on that same site:
          // join that clinic. The clinic is resolved from the host server-side.
          await claimClinicFromHost(user.id, await resolveTenantFromHost(request.headers.get('host'))).catch(() => null)
        }

        let { data: profile } = await admin.from('users')
          .select('role, first_name, last_name, organization_id')
          .eq('id', user.id).single()
        let isNewProfile = false

        if (!profile) {
          isNewProfile = true
          // Self-service profiles are always patients (see the invite rule above).
          const safeRole = 'patient'

          // Never a fallback clinic: the user starts outside any clinic.
          const profileData: Record<string, unknown> = {
            id: user.id,
            organization_id: DEFAULT_ORG_ID,
            email: user.email!,
            first_name: (meta.first_name as string) || '',
            last_name: (meta.last_name as string) || '',
            role: safeRole,
          }

          const { data: created } = await admin.from('users').upsert(profileData, { onConflict: 'id' }).select('role, first_name, last_name, organization_id').single()
          profile = created
        }

        const typedProfile = profile as { role?: string; first_name?: string; last_name?: string; organization_id?: string } | null
        const role = typedProfile?.role || 'patient'

        // Send welcome email for new users (fire-and-forget, idempotent)
        if (user.email && typedProfile?.organization_id) {
          const { count } = await admin.from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('template_name', 'welcome')

          if ((count ?? 0) === 0 || isNewProfile) {
            const { data: org } = await admin.from('organizations')
              .select('name')
              .eq('id', typedProfile.organization_id)
              .maybeSingle()

            sendWelcomeEmail({
              userId: user.id,
              email: user.email,
              firstName: typedProfile.first_name || '',
              lastName: typedProfile.last_name || '',
              role,
              organizationId: typedProfile.organization_id,
              organizationName: (org as { name?: string } | null)?.name || 'המרפאה',
              admin,
            }).catch(() => {})
          }
        }

        const roleHome: Record<string, string> = {
          doctor: '/dashboard/doctor/dashboard',
          admin: '/dashboard/admin/dashboard',
          staff: '/dashboard/staff/dashboard',
        }
        const destination = next !== '/dashboard/patient/dashboard'
          ? next
          : roleHome[role] || '/dashboard/patient/dashboard'
        return NextResponse.redirect(`${origin}${destination}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}${inviteRetry ?? '/auth/login?error=auth_failed'}`)
}
