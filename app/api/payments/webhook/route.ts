import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { sendPaymentConfirmationWhatsApp } from '@/lib/whatsapp'
import crypto from 'crypto'

/**
 * Verify Tranzila webhook HMAC signature.
 * Tranzila signs the raw body with HMAC-SHA256 using the shared secret.
 */
function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex')
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)

    // ── Signature validation ──────────────────────────────
    const secret = process.env.TRANZILA_WEBHOOK_SECRET
    if (secret) {
      const signature = req.headers.get('x-tranzila-signature')
      if (!signature) {
        console.error('[Payment Webhook] Missing signature header')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }
      if (!verifySignature(body, signature, secret)) {
        console.error('[Payment Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // ── Parse parameters ──────────────────────────────────
    const transactionId = params.get('transaction_id')
    const idempotencyKey = params.get('order_id')
    const responseCode = params.get('response') // '000' = success
    const amount = params.get('sum')

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
    // Verify the paid amount matches the expected amount to prevent tampering
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
          metadata: { transaction_id: transactionId, paid: amount, expected: String(expectedAmount) },
        })
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
      }
    }

    // ── Process payment result ────────────────────────────
    if (responseCode === '000') {
      // Success — update appointment status atomically
      const { error: updateError } = await admin.from('appointments').update({
        payment_status: 'completed',
        payment_transaction_id: transactionId,
        payment_completed_at: new Date().toISOString(),
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
          amount,
          idempotency_key: idempotencyKey,
        },
      })

      // WhatsApp payment confirmation (best-effort)
      try {
        await sendPaymentConfirmationWhatsApp({ appointmentId: apt.id, admin })
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
