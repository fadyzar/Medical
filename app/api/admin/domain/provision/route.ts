import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { provisionSubdomain } from '@/lib/domain/provision'
import { RESERVED_SUBDOMAINS } from '@/lib/config/plans'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

const schema = z.object({
  subdomain: z.string()
    .min(3, 'מינימום 3 תווים')
    .max(30, 'מקסימום 30 תווים')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'רק אותיות קטנות באנגלית, מספרים ומקף'),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: 5 per hour per user (DNS operations are expensive)
    const limit = rateLimit(`domain-provision:${user.id}`, { maxRequests: 5, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) return NextResponse.json({ error: 'יותר מדי בקשות. נסה שוב בעוד שעה.' }, { status: 429 })

    // Must be admin
    const { data: profile } = await supabase.from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = (profile as { organization_id: string }).organization_id
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid subdomain' }, { status: 400 })
    }

    const { subdomain } = parsed.data

    // Check reserved
    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return NextResponse.json({ error: 'סאבדומיין זה שמור ואינו זמין' }, { status: 400 })
    }

    // Check uniqueness (another org can't have it)
    const admin = createServiceRole()
    const { data: existing } = await admin.from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .neq('id', orgId)
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'סאבדומיין זה כבר תפוס' }, { status: 409 })

    const result = await provisionSubdomain(orgId, subdomain)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[domain/provision]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
