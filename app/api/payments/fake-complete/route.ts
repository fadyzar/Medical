import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'

// Fake payment endpoint — simulates a successful payment.
// Used during development / before Tranzila credentials are configured.
// Marks appointment as paid and updates status to 'scheduled'.

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appointmentId } = await req.json()
  if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

  // Verify caller is the patient of this appointment
  const { data: apt } = await supabase
    .from('appointments')
    .select('id, patient_id, payment_status, payment_amount, doctor_id, organization_id')
    .eq('id', appointmentId)
    .single()

  if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (apt.patient_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (apt.payment_status === 'completed') return NextResponse.json({ ok: true, alreadyPaid: true })

  // Simulate slight processing delay (realistic UX)
  await new Promise(r => setTimeout(r, 800))

  const idempotencyKey = `fake-${appointmentId}-${user.id}`

  const { error } = await supabase
    .from('appointments')
    .update({
      payment_status: 'completed',
      payment_idempotency_key: idempotencyKey,
      status: 'scheduled',
    })
    .eq('id', appointmentId)

  if (error) {
    console.error('[FakePayment] update error:', error)
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 })
  }

  // Send WhatsApp + in-app notification to patient
  try {
    const admin = createServiceRole()
    await notify('payment_success', appointmentId, admin)
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true })
}
