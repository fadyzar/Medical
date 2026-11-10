import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { paymentMode } from '@/lib/payments/mode'
import { appointmentIdSchema } from '@/lib/validation/schemas'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    if (paymentMode() !== 'tranzila') {
      return NextResponse.json({ error: 'תשלום מקוון אינו פעיל' }, { status: 409 })
    }
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = appointmentIdSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'נתונים לא תקינים', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { appointmentId } = parsed.data

    // Load appointment — RLS ensures patient can only see their own
    const { data: apt } = await supabase.from('appointments')
      .select('id, patient_id, doctor_id, chief_complaint, payment_amount, payment_status, payment_idempotency_key, status, organization_id, payment_collection')
      .eq('id', appointmentId)
      .single()

    if (!apt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

    // Validate ownership
    if (apt.patient_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate payment is needed
    if (apt.payment_status === 'completed') {
      return NextResponse.json({ error: 'Already paid' }, { status: 400 })
    }

    // Only a submitted booking that is waiting for online payment (the price was
    // set by the server from the doctor's profile in /api/appointments/submit).
    if (apt.status !== 'payment_pending' || apt.payment_collection !== 'online') {
      return NextResponse.json({ error: 'התור אינו ממתין לתשלום' }, { status: 409 })
    }

    if (!apt.payment_amount || apt.payment_amount <= 0) {
      return NextResponse.json({ error: 'No payment amount set' }, { status: 400 })
    }

    // Generate idempotency key if not exists
    let idempotencyKey = apt.payment_idempotency_key
    if (!idempotencyKey) {
      idempotencyKey = `pay_${apt.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      // Payment fields are server-managed (migration 033): write with the service role.
      const { data: keyed } = await createServiceRole().from('appointments').update({
        payment_idempotency_key: idempotencyKey,
      }).eq('id', apt.id).is('payment_idempotency_key', null).select('payment_idempotency_key')
      if (!keyed?.length) {
        const { data: again } = await createServiceRole().from('appointments')
          .select('payment_idempotency_key').eq('id', apt.id).single()
        idempotencyKey = (again as { payment_idempotency_key: string }).payment_idempotency_key
      }
    }

    // Build Tranzila iframe URL
    const terminalName = process.env.TRANZILA_TERMINAL_NAME as string
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const tranzilaParams = new URLSearchParams({
      sum: apt.payment_amount.toFixed(2),
      currency: '1', // 1 = ILS
      cred_type: '1', // 1 = regular charge
      order_id: idempotencyKey,
      pdesc: 'ייעוץ רפואי', // no medical details to the payment provider
      contact: user.email || '',
      notify_url: `${appUrl}/api/payments/webhook`,
      success_url_address: `${appUrl}/dashboard/patient/payment?id=${apt.id}&status=success`,
      fail_url_address: `${appUrl}/dashboard/patient/payment?id=${apt.id}&status=failed`,
      nologo: '1',
      lang: 'il', // Hebrew
      trButtonColor: '2563eb', // blue-600
    })

    const iframeUrl = `https://direct.tranzila.com/${terminalName}/iframenew.php?${tranzilaParams.toString()}`

    return NextResponse.json({
      iframeUrl,
      idempotencyKey,
      amount: apt.payment_amount,
    })
  } catch (err) {
    console.error('[Payment Session]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
