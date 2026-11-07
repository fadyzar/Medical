import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/logout
 *
 * Server half of logout. The browser's supabase.auth.signOut() can fail or hang
 * (network error, auth lock held by another tab) and then leaves the session
 * cookies in place, so the middleware kept treating the user as signed in. This
 * route revokes the session (all devices, like the client default) and deletes
 * every Supabase auth cookie on this host, whatever happened in the browser.
 * Same-origin only (middleware CSRF check applies to /api POSTs).
 */
export async function POST() {
  try {
    const supabase = await createServerSupabase()
    await supabase.auth.signOut({ scope: 'global' })
  } catch {
    // Revocation is best-effort; the cookies below are cleared regardless.
  }

  const store = await cookies()
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  for (const c of store.getAll()) {
    if (c.name.startsWith('sb-')) {
      res.cookies.set({ name: c.name, value: '', path: '/', maxAge: 0 })
    }
  }
  return res
}
