import { createServiceRole } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Public endpoint — returns basic org branding by id (no auth required)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createServiceRole()
  const { data } = await admin
    .from('organizations')
    .select('id, name, logo_url, primary_color, subdomain')
    .eq('id', id)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
