import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 10 refunds per hour per admin
    const limit = rateLimit(`refund:${user.id}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'חריגה ממגבלת בקשות. נסה שוב מאוחר יותר.' }, { status: 429 })
    }

    // Only admins can process refunds
    const { data: profile } = await supabase.from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admins only' }, { status: 403 })
    }

    const userOrgId = (profile as unknown as { organization_id: string }).organization_id

    const { appointmentId, reason } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })
    }

    const admin = createServiceRole()

    // Fetch appointment with payment info
    const { data: apt } = await admin.from('appointments')
      .select('id, payment_status, payment_amount, payment_transaction_id, organization_id, patient_id')
      .eq('id', appointmentId)
      .single()

    if (!apt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const typedApt = apt as unknown as {
      id: string; payment_status: string; payment_amount: number
      payment_transaction_id: string | null; organization_id: string; patient_id: string
    }

    // Verify appointment belongs to admin's organization
    if (typedApt.organization_id !== userOrgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (typedApt.payment_status !== 'completed') {
      return NextResponse.json({ error: 'Only completed payments can be refunded' }, { status: 400 })
    }

    // Use optimistic locking: only update if still 'completed'
    const { error: aptError, data: aptData } = await admin.from('appointments').update({
      payment_status: 'refunded',
    }).eq('id', appointmentId).eq('payment_status', 'completed').select('id')

    if (aptError) {
      return NextResponse.json({ error: 'Refund failed — database error' }, { status: 500 })
    }

    if (!aptData || aptData.length === 0) {
      return NextResponse.json({ error: 'Refund failed — payment status may have changed' }, { status: 409 })
    }

    // Update payment record — if this fails, revert appointment
    const { error: payError } = await admin.from('payments').update({
      status: 'refunded',
    }).eq('appointment_id', appointmentId).eq('status', 'completed')

    if (payError) {
      // Rollback: revert appointment back to completed
      await admin.from('appointments').update({
        payment_status: 'completed',
      }).eq('id', appointmentId)
      return NextResponse.json({ error: 'Failed to update payment record — refund rolled back' }, { status: 500 })
    }

    // Create audit log entry
    await admin.from('audit_logs').insert({
      organization_id: typedApt.organization_id,
      user_id: user.id,
      action: 'PAYMENT_REFUNDED',
      resource_type: 'appointment',
      resource_id: appointmentId,
      metadata: {
        amount: typedApt.payment_amount,
        transaction_id: typedApt.payment_transaction_id,
        reason: reason || 'No reason provided',
        refunded_by: user.id,
        refunded_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Payment marked as refunded',
      amount: typedApt.payment_amount,
    })
  } catch (err) {
    console.error('[payments/refund]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 })
  }
}
