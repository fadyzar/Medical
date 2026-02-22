import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { RESERVED_SUBDOMAINS } from '@/lib/config/plans'
import { rateLimit } from '@/lib/security/rate-limit'

export async function GET(req: Request) {
  try {
    // Rate limit: 20 per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const limit = rateLimit(`subdomain-check:${ip}`, { maxRequests: 20, windowMs: 60_000 })
    if (!limit.allowed) {
      return NextResponse.json({ available: false }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const subdomain = searchParams.get('subdomain')

    if (!subdomain || subdomain.length < 3) {
      return NextResponse.json({ available: false })
    }

    // Check reserved list
    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return NextResponse.json({ available: false })
    }

    // Check format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
      return NextResponse.json({ available: false })
    }

    const admin = createServiceRole()
    const { data } = await admin.from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle()

    return NextResponse.json({ available: !data })
  } catch {
    return NextResponse.json({ available: false }, { status: 500 })
  }
}
