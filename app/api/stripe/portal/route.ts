import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'

export async function POST() {
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
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = (profile as unknown as { organization_id: string }).organization_id
    const admin = createServiceRole()

    // Get org's Stripe customer ID
    const { data: org } = await admin.from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()

    const settings = (org as unknown as { settings: Record<string, unknown> })?.settings || {}
    const customerId = settings.stripe_customer_id as string | undefined

    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found. Please complete a payment first.' }, { status: 400 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/admin/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/portal]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
