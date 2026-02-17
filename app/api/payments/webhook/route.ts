import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { sendPaymentConfirmationWhatsApp } from '@/lib/whatsapp'
import { generateInvoice } from '@/lib/invoice'
import { sendPaymentReceipt } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)

    // ── Parse Tranzila parameters ─────────────────────
    // Field names are case-sensitive per Tranzila docs
    const responseCode     = params.get('Response')          // '000' = approved
    const confirmationCode = params.get('ConfirmationCode')  // auth code from card network
    const transactionIndex = params.get('index')             // Tranzila log index (primary)
    const transactionId    = transactionIndex || params.get('TransID')
    const idempotencyKey   = params.get('order_id') || params.get('orderid')
    const amount           = params.get('sum')
    const maskedCard       = params.get('credit_card')       // first 4 + last 4 digits

    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
    }

    const admin = createServiceRole()

    // ── Look up appointment by idempotency key ────────────
    const { data: apt, error: lookupError } = await admin.from('appointments')
      .select('id, payment_status, payment_amount, organization_id, patient_id, status')
      .eq('payment_idempotency_key', idempotencyKey)
      .single()

    if (lookupError || !apt) {
      console.error('[Payment Webhook] Appointment not found for order_id:', idempotencyKey)
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // ── Double-payment protection ─────────────────────────
    if (apt.payment_status === 'completed') {
      return NextResponse.json({ status: 'already_processed' })
    }

    // ── Amount verification ───────────────────────────────
    if (responseCode === '000' && amount && apt.payment_amount) {
      const paidAmount = parseFloat(amount)
      const expectedAmount = apt.payment_amount
      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        console.error('[Payment Webhook] Amount mismatch:', { paid: paidAmount, expected: expectedAmount })
        await admin.from('audit_logs').insert({
          organization_id: apt.organization_id,
          user_id: apt.patient_id,
          action: 'PAYMENT_AMOUNT_MISMATCH',
          resource_type: 'appointment',
          resource_id: apt.id,
          metadata: {
            transaction_id: transactionId,
            paid: amount,
            expected: String(expectedAmount),
          },
        })
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
      }
    }

    // ── Process payment result ────────────────────────────
    if (responseCode === '000') {
      // Success — update appointment atomically
      const { error: updateError } = await admin.from('appointments').update({
        payment_status: 'completed',
        payment_transaction_id: transactionId,
        payment_completed_at: new Date().toISOString(),
        payment_method: maskedCard || null,
        status: 'paid',
      }).eq('id', apt.id)
        .eq('payment_status', 'pending') // Extra guard: only update if still pending

      if (updateError) {
        console.error('[Payment Webhook] Update failed:', updateError.message)
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }

      // Audit log
      await admin.from('audit_logs').insert({
        organization_id: apt.organization_id,
        user_id: apt.patient_id,
        action: 'PAYMENT_COMPLETED',
        resource_type: 'appointment',
        resource_id: apt.id,
        metadata: {
          transaction_id: transactionId,
          confirmation_code: confirmationCode,
          amount,
          masked_card: maskedCard,
          idempotency_key: idempotencyKey,
        },
      })

      // ── Post-payment actions (best-effort, non-blocking) ──

      // WhatsApp confirmation
      try {
        await sendPaymentConfirmationWhatsApp({ appointmentId: apt.id, admin })
      } catch { /* non-critical */ }

      // Invoice generation
      let invoiceUrl: string | null = null
      try {
        const { data: patient } = await admin.from('users')
          .select('first_name, last_name, email, phone')
          .eq('id', apt.patient_id)
          .single()

        const { data: org } = await admin.from('organizations')
          .select('name')
          .eq('id', apt.organization_id)
          .single()

        const { data: aptFull } = await admin.from('appointments')
          .select('chief_complaint')
          .eq('id', apt.id)
          .single()

        if (patient && org && aptFull && apt.payment_amount) {
          const typedPatient = patient as unknown as { first_name: string; last_name: string; email: string; phone: string | null }
          const typedOrg = org as unknown as { name: string }
          const typedApt = aptFull as unknown as { chief_complaint: string }

          const result = await generateInvoice({
            appointmentId: apt.id,
            amount: apt.payment_amount,
            patientName: `${typedPatient.first_name} ${typedPatient.last_name}`,
            patientEmail: typedPatient.email,
            patientPhone: typedPatient.phone,
            description: `ייעוץ רפואי — ${typedApt.chief_complaint}`,
            organizationName: typedOrg.name,
            admin,
          })
          invoiceUrl = result.invoiceUrl ?? null
        }
      } catch { /* invoice failure must not block payment confirmation */ }

      // Payment receipt email
      try {
        await sendPaymentReceipt({ appointmentId: apt.id, invoiceUrl, admin })
      } catch { /* non-critical */ }
    } else {
      // Failed
      await admin.from('appointments').update({
        payment_status: 'failed',
        payment_transaction_id: transactionId,
      }).eq('id', apt.id)

      await admin.from('audit_logs').insert({
        organization_id: apt.organization_id,
        user_id: apt.patient_id,
        action: 'PAYMENT_FAILED',
        resource_type: 'appointment',
        resource_id: apt.id,
        metadata: {
          transaction_id: transactionId,
          amount,
          response_code: responseCode,
          idempotency_key: idempotencyKey,
        },
      })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('[Payment Webhook]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
