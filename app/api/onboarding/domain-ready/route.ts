import { NextRequest, NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/
const ROOT_DOMAIN = 'cannaforyou.net'

/**
 * GET /api/onboarding/domain-ready?subdomain=<sub>
 *
 * Used by the onboarding wizard after a clinic is created: is
 * https://<sub>.cannaforyou.net already serving this app (DNS + TLS + Vercel)?
 * The wizard redirects there only when it is, and otherwise explains the delay
 * and offers the central site. Read-only; it never writes to the database.
 *
 * SSRF-safe: the probed URL is always https://<validated-sub>.cannaforyou.net,
 * and only for a subdomain that belongs to an existing clinic.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`domain-ready:${ip}`, { maxRequests: 60, windowMs: 10 * 60 * 1000 }).allowed) {
    return NextResponse.json({ ready: false, reason: 'rate_limited' }, { status: 429 })
  }

  const sub = (req.nextUrl.searchParams.get('subdomain') || '').toLowerCase()
  if (!SUBDOMAIN_RE.test(sub)) return NextResponse.json({ ready: false, reason: 'invalid' }, { status: 400 })

  const admin = createServiceRole()
  const { data: org } = await admin.from('organizations').select('id').eq('subdomain', sub).maybeSingle()
  if (!org) return NextResponse.json({ ready: false, reason: 'not_found' }, { status: 404 })

  const url = `https://${sub}.${ROOT_DOMAIN}`
  const host = req.headers.get('host') || ''
  // Local / preview environments have no clinic subdomains to probe.
  if (!host.endsWith(ROOT_DOMAIN)) return NextResponse.json({ ready: false, reason: 'not_production', url })

  try {
    const res = await fetch(`${url}/api/health`, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
    })
    // Our own health endpoint answering on that host = DNS, certificate and
    // routing are all in place.
    const body = res.ok ? await res.json().catch(() => null) as { status?: string } | null : null
    const ready = !!body?.status
    return NextResponse.json({ ready, reason: ready ? 'ok' : `http_${res.status}`, url })
  } catch {
    return NextResponse.json({ ready: false, reason: 'unreachable', url })
  }
}
