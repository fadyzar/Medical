import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { resolveTenantFromHost } from '@/lib/tenant/server'
import { DEFAULT_ORG_ID } from '@/lib/tenant'
import { rateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  specialty: z.string().regex(/^[a-z_-]{2,40}$/).optional(),
  id: z.string().uuid().optional(),
})

// Display fields only — never licence/ID numbers, phone, email or availability.
const COLUMNS = 'id, organization_id, first_name, last_name, avatar_url, specialties, bio, languages, consultation_price, average_rating, total_ratings'

/**
 * GET /api/doctors?specialty=<id>&id=<uuid>
 *
 * The only way a browser lists bookable doctors (direct access to the
 * public_doctors view was revoked in migration 030). The clinic scope is decided
 * HERE, from the request host and the verified session — never from a
 * client-supplied organization id:
 *   * clinic site (subdomain / custom domain) → that clinic's doctors only;
 *   * unknown clinic host                     → none;
 *   * central site: clinic members and patients who already belong to a clinic
 *     → their own clinic; everyone else (anonymous, marketplace patients)
 *     → the cross-clinic marketplace.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`doctors:${ip}`, { maxRequests: 120, windowMs: 60 * 1000 }).allowed) {
    return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 })
  }

  const parsed = querySchema.safeParse({
    specialty: req.nextUrl.searchParams.get('specialty') || undefined,
    id: req.nextUrl.searchParams.get('id') || undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'פרמטרים לא תקינים' }, { status: 400 })

  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Host, Cookie' }
  const tenant = await resolveTenantFromHost(req.headers.get('host'))
  if (tenant.kind === 'unknown') return NextResponse.json({ doctors: [], scope: 'none' }, { headers })

  const admin = createServiceRole()
  let orgId: string | null = null

  if (tenant.kind === 'clinic') {
    orgId = tenant.orgId
  } else {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await admin.from('users').select('role, organization_id').eq('id', user.id).maybeSingle()
      const me = data as { role: string; organization_id: string | null } | null
      const marketplacePatient = !me || (me.role === 'patient' && (!me.organization_id || me.organization_id === DEFAULT_ORG_ID))
      if (!marketplacePatient) orgId = me!.organization_id
      if (!marketplacePatient && !orgId) return NextResponse.json({ doctors: [], scope: 'none' }, { headers })
    }
  }

  let q = admin.from('users').select(COLUMNS).eq('role', 'doctor').eq('is_active', true)
  if (orgId) q = q.eq('organization_id', orgId)
  if (parsed.data.specialty) q = q.contains('specialties', [parsed.data.specialty])
  if (parsed.data.id) q = q.eq('id', parsed.data.id)

  const { data, error } = await q.order('average_rating', { ascending: false, nullsFirst: false }).limit(200)
  if (error) return NextResponse.json({ error: 'שגיאה בטעינת הרופאים' }, { status: 500, headers })

  return NextResponse.json({ doctors: data || [], scope: orgId ? 'clinic' : 'marketplace' }, { headers })
}
