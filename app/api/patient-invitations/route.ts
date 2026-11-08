import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveTenantFromHost, trustedOrigin } from '@/lib/tenant/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { createPatientInvitation, listPatientInvitations, resolveInviter } from '@/lib/services/patient-invitations'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'private, no-store' }

const createSchema = z.object({
  email: z.string().trim().email('כתובת אימייל לא תקינה').max(254),
  name: z.string().trim().max(60).optional(),
})

async function inviterFor(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }) }
  const tenant = await resolveTenantFromHost(req.headers.get('host'))
  const inviter = await resolveInviter(user.id, tenant)
  if (!inviter.ok) return { error: NextResponse.json({ error: inviter.error }, { status: inviter.status, headers: NO_STORE }) }
  return { inviter: inviter.data, tenant }
}

/** GET /api/patient-invitations — admin: all of the clinic's patient invitations; doctor: their own. */
export async function GET(req: NextRequest) {
  const r = await inviterFor(req)
  if ('error' in r) return r.error
  return NextResponse.json({ invitations: await listPatientInvitations(r.inviter) }, { headers: NO_STORE })
}

/** POST /api/patient-invitations { email, name? } — invite a patient to the inviter's own clinic. */
export async function POST(req: NextRequest) {
  try {
    const r = await inviterFor(req)
    if ('error' in r) return r.error
    if (!rateLimit(`patient-invite:${r.inviter.id}`, { maxRequests: 100, windowMs: 60 * 60 * 1000 }).allowed) {
      return NextResponse.json({ error: 'חריגה ממגבלת הזמנות. נסה שוב מאוחר יותר.' }, { status: 429, headers: NO_STORE })
    }
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400, headers: NO_STORE })

    const result = await createPatientInvitation({
      inviter: r.inviter, email: parsed.data.email, name: parsed.data.name || undefined,
      requestOrigin: trustedOrigin(req.headers, r.tenant), tenant: r.tenant,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE })
    return NextResponse.json(result.data, { status: result.data.outcome === 'duplicate' ? 200 : 201, headers: NO_STORE })
  } catch (err) {
    console.error('[patient-invitations]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500, headers: NO_STORE })
  }
}
