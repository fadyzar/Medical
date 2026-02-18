import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  // Gate: skip if Stripe is not configured
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 })
  }

  try {
    const StripeLib = (await import('stripe')).default
    const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY)

    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch {
      console.error('[Stripe Webhook] Signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const admin = createServiceRole()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as unknown as {
          metadata?: { organization_id?: string }
          customer?: string
          subscription?: string
        }
        const orgId = session.metadata?.organization_id
        if (orgId) {
          // Store Stripe IDs as top-level columns (not inside settings JSONB)
          await admin.from('organizations').update({
            subscription_status: 'active',
            stripe_customer_id: session.customer || null,
            stripe_subscription_id: session.subscription || null,
          }).eq('id', orgId)

          await admin.from('audit_logs').insert({
            organization_id: orgId,
            action: 'SUBSCRIPTION_ACTIVATED',
            resource_type: 'organization',
            resource_id: orgId,
            metadata: {
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown as { customer?: string }
        if (invoice.customer) {
          // Look up org by top-level stripe_customer_id column
          const { data: orgs } = await admin.from('organizations')
            .select('id')
            .eq('stripe_customer_id', String(invoice.customer))

          if (orgs && orgs.length > 0) {
            await admin.from('organizations').update({
              subscription_status: 'suspended',
            }).eq('id', orgs[0].id)

            await admin.from('audit_logs').insert({
              organization_id: orgs[0].id,
              action: 'SUBSCRIPTION_SUSPENDED',
              resource_type: 'organization',
              resource_id: orgs[0].id,
              description: 'תשלום נכשל — המנוי הושעה',
              metadata: { stripe_customer_id: invoice.customer },
            })
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as unknown as { customer?: string }
        if (subscription.customer) {
          // Look up org by top-level stripe_customer_id column
          const { data: orgs } = await admin.from('organizations')
            .select('id')
            .eq('stripe_customer_id', String(subscription.customer))

          if (orgs && orgs.length > 0) {
            await admin.from('organizations').update({
              subscription_status: 'cancelled',
            }).eq('id', orgs[0].id)

            await admin.from('audit_logs').insert({
              organization_id: orgs[0].id,
              action: 'SUBSCRIPTION_CANCELLED',
              resource_type: 'organization',
              resource_id: orgs[0].id,
              description: 'המנוי בוטל',
              metadata: { stripe_customer_id: subscription.customer },
            })
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Stripe Webhook]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
