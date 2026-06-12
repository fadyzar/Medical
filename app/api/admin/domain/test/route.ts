// Debug route — checks env vars and tests Hostinger/Vercel connectivity
// GET /api/admin/domain/test
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  // Auth check — only admin
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || (profile as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, unknown> = {}

  // 1. Check env vars
  results.env = {
    HOSTINGER_API_KEY: !!process.env.HOSTINGER_API_KEY ? '✅ set' : '❌ missing',
    VERCEL_TOKEN: !!process.env.VERCEL_TOKEN ? '✅ set' : '❌ missing',
    VERCEL_PROJECT_ID: !!process.env.VERCEL_PROJECT_ID ? '✅ set' : '❌ missing',
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID ? '✅ set' : '⚠️ not set (optional)',
  }

  // 2. Test Hostinger API
  if (process.env.HOSTINGER_API_KEY) {
    try {
      const res = await fetch('https://api.hostinger.com/v1/dns/zones/cannaforyou.net', {
        headers: {
          Authorization: `Bearer ${process.env.HOSTINGER_API_KEY}`,
          Accept: 'application/json',
        },
      })
      const text = await res.text()
      let body: unknown
      try { body = JSON.parse(text) } catch { body = text }
      results.hostinger = {
        status: res.status,
        ok: res.ok,
        response: body,
      }
    } catch (err) {
      results.hostinger = { error: err instanceof Error ? err.message : 'Network error' }
    }
  } else {
    results.hostinger = { skipped: 'HOSTINGER_API_KEY not set' }
  }

  // 3. Test Vercel API
  if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
    try {
      const teamQuery = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ''
      const res = await fetch(
        `https://api.vercel.com/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains${teamQuery}`,
        { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` } }
      )
      const data = await res.json() as { domains?: Array<{ name: string }> }
      results.vercel = {
        status: res.status,
        ok: res.ok,
        domainsCount: data.domains?.length,
        recentDomains: data.domains?.slice(0, 5).map(d => d.name),
      }
    } catch (err) {
      results.vercel = { error: err instanceof Error ? err.message : 'Network error' }
    }
  } else {
    results.vercel = { skipped: 'VERCEL_TOKEN or VERCEL_PROJECT_ID not set' }
  }

  return NextResponse.json(results, { status: 200 })
}
