import { createServiceRole } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Public endpoint — returns basic org branding by subdomain (no auth required)
// Used by client components during registration and booking to detect clinic context
export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get('subdomain')
  if (!subdomain || subdomain.length < 2) {
    return NextResponse.json({ error: 'Missing subdomain' }, { status: 400 })
  }

  const admin = createServiceRole()
  const { data } = await admin
    .from('organizations')
    .select('id, name, logo_url, primary_color, secondary_color, contact_email, subdomain')
    .eq('subdomain', subdomain.toLowerCase())
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
