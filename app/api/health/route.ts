import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {}

  // Supabase connectivity
  try {
    const admin = createServiceRole()
    const { error } = await admin.from('organizations').select('id').limit(1)
    checks.supabase = error ? 'error' : 'ok'
  } catch {
    checks.supabase = 'error'
  }

  // Environment variables
  checks.env = (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) ? 'ok' : 'error'

  const healthy = Object.values(checks).every(v => v === 'ok')

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  )
}
