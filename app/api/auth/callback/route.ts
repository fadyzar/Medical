import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
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
        // Ensure profile exists (trigger may have failed silently)
        const admin = createServiceRole()
        let { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()

        if (!profile) {
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

          const { data: created } = await admin.from('users').upsert(profileData, { onConflict: 'id' }).select('role').single()

          profile = created
        }

        const role = (profile as { role?: string } | null)?.role || 'patient'
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
