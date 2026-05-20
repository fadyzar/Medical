import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_PREFIXES = [
  '/auth/',
  '/api/',
  '/onboarding',
  '/marketing',
  '/for-clinics',
  '/doctors',
  '/specialties',
  '/blog',
  '/terms',
  '/privacy',
  '/accessibility',
  '/video-call',
]

// Role → allowed dashboard prefix
const ROLE_DASHBOARDS: Record<string, string> = {
  patient: '/dashboard/patient',
  doctor: '/dashboard/doctor',
  admin: '/dashboard/admin',
  staff: '/dashboard/staff',
}

// External webhook endpoints that receive cross-origin POST requests
const WEBHOOK_PATHS = [
  '/api/payments/webhook',
  '/api/stripe/webhook',
  '/api/auth/callback',
  '/api/cron/',
]

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  // ── CSRF protection for mutation requests to API routes ──
  const method = req.method
  const path = req.nextUrl.pathname
  if (
    path.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    !WEBHOOK_PATHS.some(wp => path.startsWith(wp))
  ) {
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    if (origin && host) {
      try {
        const originHost = new URL(origin).host
        if (originHost !== host) {
          return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
      }
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          c.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          c.forEach(({ name, value, options }) => res.cookies.set({ name, value, ...options }))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Public routes: no auth needed ──────────────────────
  if (path === '/' || PUBLIC_PREFIXES.some(r => path.startsWith(r))) {
    // If authenticated user visits /auth/login or /auth/register, redirect to dashboard
    if (user && (path === '/auth/login' || path === '/auth/register')) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      const role = (profile as { role?: string } | null)?.role || 'patient'
      const home = ROLE_DASHBOARDS[role] || ROLE_DASHBOARDS.patient
      return NextResponse.redirect(new URL(`${home}/dashboard`, req.url))
    }
    return res
  }

  // ── Protected routes: require auth ─────────────────────
  if (!user) {
    const loginUrl = new URL('/auth/login', req.url)
    // Preserve the intended destination for redirect after login
    if (path !== '/auth/login') {
      loginUrl.searchParams.set('redirect', path)
    }
    return NextResponse.redirect(loginUrl)
  }

  // ── Role-based access for /dashboard/* ─────────────────
  if (path.startsWith('/dashboard/')) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    const role = (profile as { role?: string } | null)?.role || 'patient'
    const allowedPrefix = ROLE_DASHBOARDS[role] || ROLE_DASHBOARDS.patient

    // Check if user is accessing their own dashboard area
    if (!path.startsWith(allowedPrefix)) {
      // Redirect to their correct dashboard
      return NextResponse.redirect(new URL(`${allowedPrefix}/dashboard`, req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
