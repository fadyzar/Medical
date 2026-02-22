import { createServerSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/patient/dashboard'

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Determine correct redirect based on user role
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
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
