import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { onboardingFullSchema } from '@/lib/validation/onboarding-schema'
import { PLANS, RESERVED_SUBDOMAINS } from '@/lib/config/plans'
import { sendDoctorInvite, sendWelcomeEmail } from '@/lib/email'
import { onboardingLimiter } from '@/lib/security/rate-limit'

export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const limit = onboardingLimiter(ip)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const body = await req.json()
    const parsed = onboardingFullSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'נתונים לא תקינים', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check reserved subdomains
    if (RESERVED_SUBDOMAINS.includes(data.subdomain)) {
      return NextResponse.json(
        { error: 'תת-דומיין זה שמור ולא זמין לשימוש' },
        { status: 400 }
      )
    }

    const admin = createServiceRole()

    // Check subdomain uniqueness
    const { data: existing } = await admin.from('organizations')
      .select('id')
      .eq('subdomain', data.subdomain)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'תת-דומיין זה כבר תפוס' },
        { status: 409 }
      )
    }

    // Resolve plan
    const plan = PLANS.find(p => p.id === data.plan)
    if (!plan) {
      return NextResponse.json({ error: 'תוכנית לא קיימת' }, { status: 400 })
    }

    // Create organization
    const { data: org, error: orgError } = await admin.from('organizations').insert({
      name: data.name,
      subdomain: data.subdomain,
      slug: data.subdomain,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      logo_url: data.logo_url || null,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      plan: data.plan,
      subscription_status: data.plan === 'free' ? 'active' : 'trial',
      features: plan.features,
      max_doctors: plan.max_doctors,
      max_appointments_per_month: plan.max_appointments_per_month,
      settings: {
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
        cancellation_policy_hours: 24,
        pending_invites: data.doctors || [],
      },
    }).select('id').single()

    if (orgError || !org) {
      console.error('[Onboarding] Org creation failed:', orgError?.message)
      return NextResponse.json({ error: 'שגיאה ביצירת המרפאה' }, { status: 500 })
    }

    // Create admin user via Supabase Auth
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        organization_id: org.id,
        role: 'admin',
        first_name: data.first_name,
        last_name: data.last_name,
      },
    })

    if (authError || !authUser.user) {
      // Rollback: delete orphan org
      await admin.from('organizations').delete().eq('id', org.id)
      console.error('[Onboarding] User creation failed:', authError?.message)

      const message = authError?.message?.includes('already been registered')
        ? 'כתובת אימייל זו כבר רשומה במערכת'
        : 'שגיאה ביצירת המשתמש'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Audit log
    await admin.from('audit_logs').insert({
      organization_id: org.id,
      user_id: authUser.user.id,
      action: 'ORGANIZATION_CREATED',
      resource_type: 'organization',
      resource_id: org.id,
      description: `מרפאה חדשה נוצרה: ${data.name}`,
      metadata: { plan: data.plan, subdomain: data.subdomain },
    })

    // Send welcome email to admin (fire-and-forget)
    sendWelcomeEmail({
      userId: authUser.user.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      role: 'admin',
      organizationId: org.id,
      organizationName: data.name,
      admin,
    }).catch(err => {
      console.error('[Onboarding] Welcome email failed:', err instanceof Error ? err.message : 'Unknown')
    })

    // Send doctor invite emails (fire-and-forget)
    if (data.doctors && data.doctors.length > 0) {
      for (const doc of data.doctors) {
        if (doc.email) {
          sendDoctorInvite({
            doctorName: doc.name || 'רופא',
            doctorEmail: doc.email,
            organizationId: org.id,
            organizationName: data.name,
            inviterName: `${data.first_name} ${data.last_name}`,
            inviterUserId: authUser.user.id,
            admin,
          }).catch(err => {
            console.error('[Onboarding] Invite email failed:', err instanceof Error ? err.message : 'Unknown')
          })
        }
      }
    }

    // Stripe Checkout for paid plans
    if (data.plan !== 'free' && plan.stripe_price_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer_email: data.email,
          line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
          success_url: `${appUrl}/auth/login?onboarding=success`,
          cancel_url: `${appUrl}/onboarding?cancelled=true`,
          metadata: { organization_id: org.id },
        })

        return NextResponse.json({ stripeCheckoutUrl: session.url })
      } catch (stripeErr) {
        console.error('[Onboarding] Stripe error:', stripeErr instanceof Error ? stripeErr.message : 'Unknown')
        // Continue without Stripe — user can pay later
      }
    }

    return NextResponse.json({
      success: true,
      organizationId: org.id,
      redirectUrl: '/auth/login?onboarding=success',
    })
  } catch (err) {
    console.error('[Onboarding]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
