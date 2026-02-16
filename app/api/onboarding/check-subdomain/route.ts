import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { RESERVED_SUBDOMAINS } from '@/lib/config/plans'

export async function GET(req: Request) {
  try {
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
