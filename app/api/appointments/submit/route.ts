import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { appointmentIdSchema } from '@/lib/validation/schemas'
import { rateLimit } from '@/lib/security/rate-limit'
import { submitBooking } from '@/lib/appointments/lifecycle'
import { resolveTenantFromHost, trustedOrigin } from '@/lib/tenant/server'

/**
 * POST /api/appointments/submit — the patient's booking row exists; the server
 * sets the price, decides how payment is collected and either asks for payment
 * (online) or puts the request in the doctor's approval queue.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`apt-submit:${user.id}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 })

    const parsed = appointmentIdSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'נתונים לא תקינים' }, { status: 400 })

    const tenant = await resolveTenantFromHost(req.headers.get('host'))
    const res = await submitBooking({
      appointmentId: parsed.data.appointmentId,
      patientId: user.id,
      origin: trustedOrigin(req.headers, tenant),
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json(res.data)
  } catch (err) {
    console.error('[appointments/submit]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
