import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { PLANS } from '@/lib/config/plans'
import { z } from 'zod'

const upgradeSchema = z.object({
  plan: z.enum(['basic', 'pro', 'enterprise']),
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase.from('users')
      .select('role, organization_id, email')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const typedProfile = profile as unknown as { role: string; organization_id: string; email: string }
    const body = await req.json()
    const parsed = upgradeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'תוכנית לא תקינה' }, { status: 400 })
    }

    const targetPlan = PLANS.find(p => p.id === parsed.data.plan)
    if (!targetPlan || !targetPlan.stripe_price_id) {
      return NextResponse.json({ error: 'תוכנית לא זמינה לרכישה' }, { status: 400 })
    }

    const admin = createServiceRole()

    // Get current org
    const { data: org } = await admin.from('organizations')
      .select('id, plan, stripe_customer_id')
      .eq('id', typedProfile.organization_id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'מרפאה לא נמצאה' }, { status: 404 })
    }

    const typedOrg = org as unknown as { id: string; plan: string; stripe_customer_id: string | null }

    if (typedOrg.plan === parsed.data.plan) {
      return NextResponse.json({ error: 'זו כבר התוכנית הנוכחית שלכם' }, { status: 400 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      line_items: [{ price: targetPlan.stripe_price_id, quantity: 1 }],
      success_url: `${appUrl}/dashboard/admin/billing?upgraded=true`,
      cancel_url: `${appUrl}/dashboard/admin/billing`,
      metadata: { organization_id: typedOrg.id, plan: parsed.data.plan },
    }

    // If existing customer, attach to their account
    if (typedOrg.stripe_customer_id) {
      sessionParams.customer = typedOrg.stripe_customer_id
    } else {
      sessionParams.customer_email = typedProfile.email
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    )

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/create-checkout]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה ביצירת דף תשלום' }, { status: 500 })
  }
}
