import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { decideAppointment } from '@/lib/appointments/lifecycle'
import { resolveTenantFromHost, trustedOrigin } from '@/lib/tenant/server'

const schema = z.object({
  appointmentId: z.string().uuid('מזהה תור לא תקין'),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(500).optional(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
})

/**
 * POST /api/appointments/decision — the assigned doctor (or the clinic admin)
 * approves or rejects a pending request. Authorization, the state check, the
 * overlap check and the update happen in one locked database transaction
 * (approve_appointment / reject_appointment, migration 033).
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`apt-decision:${user.id}`, { maxRequests: 120, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 })

    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400 })
    }

    // A clinic's site may only act on that clinic's appointments; the database
    // function re-checks the actor's role and clinic against the row itself.
    const tenant = await resolveTenantFromHost(req.headers.get('host'))
    if (tenant.kind === 'unknown') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (tenant.kind === 'clinic') {
      const { data: apt } = await supabase.from('appointments')
        .select('organization_id').eq('id', parsed.data.appointmentId).maybeSingle()
      if (apt && apt.organization_id !== tenant.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const res = await decideAppointment({
      ...parsed.data,
      actorId: user.id,
      origin: trustedOrigin(req.headers, tenant),
    })
    if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: res.status })
    return NextResponse.json(res.data)
  } catch (err) {
    console.error('[appointments/decision]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
