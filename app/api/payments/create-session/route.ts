import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

    // Load appointment — RLS ensures patient can only see their own
    const { data: apt } = await supabase.from('appointments')
      .select('id, patient_id, doctor_id, chief_complaint, payment_amount, payment_status, payment_idempotency_key, status, organization_id')
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

    if (!apt.payment_amount || apt.payment_amount <= 0) {
      return NextResponse.json({ error: 'No payment amount set' }, { status: 400 })
    }

    // Generate idempotency key if not exists
    let idempotencyKey = apt.payment_idempotency_key
    if (!idempotencyKey) {
      idempotencyKey = `pay_${apt.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      await supabase.from('appointments').update({
        payment_idempotency_key: idempotencyKey,
        payment_status: 'pending',
        status: 'payment_pending',
      }).eq('id', apt.id)
    }

    // Build Tranzila iframe URL
    const terminalName = process.env.TRANZILA_TERMINAL_NAME || 'demo'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const tranzilaParams = new URLSearchParams({
      sum: apt.payment_amount.toFixed(2),
      currency: '1', // 1 = ILS
      cred_type: '1', // 1 = regular charge
      order_id: idempotencyKey,
      pdesc: `ייעוץ רפואי — ${apt.chief_complaint}`.slice(0, 50),
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
