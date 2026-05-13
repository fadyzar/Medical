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
        let { data: profile } = await admin.from('users')
          .select('role, first_name, last_name, organization_id')
          .eq('id', user.id).single()
        let isNewProfile = false

        if (!profile) {
          isNewProfile = true
          // Profile missing — create it now using metadata from auth
          const meta = user.user_metadata || {}
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
          if (safeRole === 'doctor') {
            if (meta.license_number) profileData.license_number = meta.license_number
            if (Array.isArray(meta.specialties) && meta.specialties.length > 0) {
              profileData.specialties = meta.specialties
            }
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
