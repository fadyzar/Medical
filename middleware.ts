import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getTenantSubdomain } from '@/lib/tenant'

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

// Build the base URL for a given subdomain (respects dev vs prod)
function buildSubdomainUrl(subdomain: string, path: string, req: NextRequest): string {
  const host = req.headers.get('host') || ''
  // In development (localhost) — stay on localhost, just change path
  if (host.includes('localhost')) {
    return `${req.nextUrl.origin}${path}`
  }
  // In production — switch to the subdomain
  const rootDomain = host.split('.').slice(-2).join('.') // e.g. cannaforyou.net
  return `https://${subdomain}.${rootDomain}${path}`
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const method = req.method
  const path = req.nextUrl.pathname
  const host = req.headers.get('host') || ''

  // ── Detect tenant subdomain ────────────────────────────
  const tenantSubdomain = getTenantSubdomain(host)

  // ── CSRF protection ───────────────────────────────────
  if (
    path.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    !WEBHOOK_PATHS.some(wp => path.startsWith(wp))
  ) {
    const origin = req.headers.get('origin')
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

  // ── Public routes: no auth needed ─────────────────────
  if (path === '/' || PUBLIC_PREFIXES.some(r => path.startsWith(r))) {
    // Authenticated user on /auth/login or /auth/register → send to dashboard
    if (user && (path === '/auth/login' || path === '/auth/register')) {
      const { data: profile } = await supabase
        .from('users')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      const role = (profile as { role?: string } | null)?.role || 'patient'
      const dashPath = `${ROLE_DASHBOARDS[role] ?? ROLE_DASHBOARDS.patient}/dashboard`

      // If user belongs to a clinic with a subdomain, redirect there
      if (role !== 'patient' && profile) {
        const orgId = (profile as { organization_id?: string }).organization_id
        if (orgId) {
          const { data: org } = await supabase
            .from('organizations')
            .select('subdomain')
            .eq('id', orgId)
            .single()
          const sub = (org as { subdomain?: string } | null)?.subdomain
          if (sub && !host.startsWith(`${sub}.`)) {
            const dest = buildSubdomainUrl(sub, dashPath, req)
            return NextResponse.redirect(dest)
          }
        }
      }

      return NextResponse.redirect(new URL(dashPath, req.url))
    }
    return res
  }

  // ── Protected routes: require auth ────────────────────
  if (!user) {
    const loginUrl = new URL('/auth/login', req.url)
    if (path !== '/auth/login') loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  // ── Role-based access for /dashboard/* ────────────────
  if (path.startsWith('/dashboard/')) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    const role = (profile as { role?: string } | null)?.role || 'patient'
    const allowedPrefix = ROLE_DASHBOARDS[role] ?? ROLE_DASHBOARDS.patient

    // Wrong dashboard section → redirect to correct one
    if (!path.startsWith(allowedPrefix)) {
      return NextResponse.redirect(new URL(`${allowedPrefix}/dashboard`, req.url))
    }

    // If clinic staff/doctor/admin on main platform → redirect to their subdomain
    if (role !== 'patient' && !tenantSubdomain && profile) {
      const orgId = (profile as { organization_id?: string }).organization_id
      if (orgId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('subdomain')
          .eq('id', orgId)
          .single()
        const sub = (org as { subdomain?: string } | null)?.subdomain
        if (sub) {
          const dest = buildSubdomainUrl(sub, path, req)
          return NextResponse.redirect(dest)
        }
      }
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
