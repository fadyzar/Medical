import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/patient/dashboard'

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
        if (inviteToken) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const invitationsTable = (admin as any).from('invitations')
          const { data: inv } = await invitationsTable
            .select('id, organization_id, email, role, expires_at, used_at')
            .eq('token', inviteToken)
            .maybeSingle()

          type InvRow = { id: string; organization_id: string; email: string; role: string; expires_at: string; used_at: string | null }
          const invite = inv as InvRow | null

          if (
            invite &&
            !invite.used_at &&
            new Date(invite.expires_at) > new Date() &&
            invite.email.toLowerCase() === user.email?.toLowerCase()
          ) {
            type UserRole = 'patient' | 'doctor' | 'staff' | 'admin'
            await admin.from('users').update({
              role: invite.role as UserRole,
              organization_id: invite.organization_id,
            }).eq('id', user.id)

            await invitationsTable
              .update({ used_at: new Date().toISOString() })
              .eq('id', invite.id)
          }
        }

        let { data: profile } = await admin.from('users')
          .select('role, first_name, last_name, organization_id')
          .eq('id', user.id).single()
        let isNewProfile = false

        if (!profile) {
          isNewProfile = true
          const roleFromMeta = (meta.role as string) || 'patient'
          const validRoles = ['patient', 'doctor', 'staff', 'admin']
          const safeRole = validRoles.includes(roleFromMeta) ? roleFromMeta : 'patient'

          // Get first org as fallback
          const { data: org } = await admin.from('organizations').select('id').order('created_at').limit(1).single()

          const profileData: Record<string, unknown> = {
            id: user.id,
            organization_id: org?.id ?? null,
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

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
