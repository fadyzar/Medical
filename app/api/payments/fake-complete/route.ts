import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { appointmentIdSchema } from '@/lib/validation/schemas'
import { paymentMode } from '@/lib/payments/mode'
import { markPaymentVerified } from '@/lib/appointments/lifecycle'

/**
 * LOCAL QA payment simulator. Refuses unless paymentMode() is 'simulated',
 * which requires PAYMENTS_SIMULATION=enabled, a non-production environment and
 * a localhost Supabase — so production can never record a payment that did
 * not happen. A simulated payment moves the booking to pending_approval (the
 * doctor still has to approve); it never confirms or schedules it.
 */
export async function POST(req: NextRequest) {
  if (paymentMode() !== 'simulated') {
    return NextResponse.json({ error: 'תשלום מדומה אינו זמין בסביבה זו' }, { status: 404 })
  }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = appointmentIdSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })
  const { appointmentId } = parsed.data

  const admin = createServiceRole()
  const { data: apt } = await admin.from('appointments')
    .select('id, patient_id, status, payment_status, payment_collection')
    .eq('id', appointmentId).maybeSingle()
  if (!apt || apt.patient_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (apt.payment_status === 'completed') return NextResponse.json({ ok: true, alreadyPaid: true, status: apt.status })
  if (apt.status !== 'payment_pending' || apt.payment_collection !== 'online') {
    return NextResponse.json({ error: 'התור אינו ממתין לתשלום' }, { status: 409 })
  }

  const { transitioned } = await markPaymentVerified({
    appointmentId, transactionId: `sim-${appointmentId.slice(0, 8)}-${Date.now()}`, method: 'simulated', admin,
  })
  return NextResponse.json({ ok: true, transitioned, status: 'pending_approval' })
}
