import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveTenantFromHost, trustedOrigin } from '@/lib/tenant/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { resendPatientInvitation, resolveInviter, revokePatientInvitation } from '@/lib/services/patient-invitations'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'private, no-store' }
const bodySchema = z.object({ action: z.enum(['resend', 'revoke']) })

/** POST /api/patient-invitations/:id { action: 'resend' | 'revoke' } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'ההזמנה לא נמצאה' }, { status: 404, headers: NO_STORE })
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'פעולה לא תקינה' }, { status: 400, headers: NO_STORE })

    const tenant = await resolveTenantFromHost(req.headers.get('host'))
    const inviter = await resolveInviter(user.id, tenant)
    if (!inviter.ok) return NextResponse.json({ error: inviter.error }, { status: inviter.status, headers: NO_STORE })

    if (parsed.data.action === 'resend') {
      if (!rateLimit(`patient-invite:${inviter.data.id}`, { maxRequests: 100, windowMs: 60 * 60 * 1000 }).allowed) {
        return NextResponse.json({ error: 'חריגה ממגבלת הזמנות. נסה שוב מאוחר יותר.' }, { status: 429, headers: NO_STORE })
      }
      const r = await resendPatientInvitation({ inviter: inviter.data, id, requestOrigin: trustedOrigin(req.headers, tenant), tenant })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE })
      return NextResponse.json(r.data, { headers: NO_STORE })
    }
    const r = await revokePatientInvitation({ inviter: inviter.data, id })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE })
    return NextResponse.json(r.data, { headers: NO_STORE })
  } catch (err) {
    console.error('[patient-invitations/id]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500, headers: NO_STORE })
  }
}
