import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveCaller } from '@/lib/services/appointments'
import { searchPatients } from '@/lib/services/patients'
import { rateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/patients/search?q=...&limit=10
 *
 * Patient lookup used to be `array.filter()` in the browser over whatever page of
 * appointments happened to be loaded — so it silently missed anyone outside the
 * last 200 rows. Scoping and role rules live in lib/services/patients.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`patient-search:${user.id}`, { maxRequests: 120, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'יותר מדי בקשות חיפוש' }, { status: 429 })
    }

    const caller = await resolveCaller(user.id)
    if (!caller) return NextResponse.json({ error: 'פרופיל לא נמצא' }, { status: 404 })

    const q = req.nextUrl.searchParams.get('q') || ''
    const rawLimit = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10)

    const result = await searchPatients({
      caller,
      query: q,
      limit: Number.isNaN(rawLimit) ? 10 : rawLimit,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({ patients: result.data })
  } catch (err) {
    console.error('[patients/search]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
