import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'

// Fake payment endpoint — simulates a successful payment.
// Used during development / before Tranzila credentials are configured.

// Statuses that are "ahead" of scheduled — do NOT downgrade them
const ADVANCED_STATUSES = new Set(['in_progress', 'completed', 'cancelled', 'no_show'])

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appointmentId } = await req.json()
  if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

  // Verify caller is the patient of this appointment (using user client — RLS ensures ownership)
  const { data: apt } = await supabase
    .from('appointments')
    .select('id, patient_id, payment_status, payment_amount, doctor_id, organization_id, status')
    .eq('id', appointmentId)
    .single()

  if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (apt.patient_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (apt.payment_status === 'completed') return NextResponse.json({ ok: true, alreadyPaid: true })

  // Simulate slight processing delay (realistic UX)
  await new Promise(r => setTimeout(r, 800))

  const idempotencyKey = `fake-${appointmentId}-${user.id}`

  // ── Use service role for the update ────────────────────────────────
  // Patients don't have RLS UPDATE permission on payment fields —
  // payment confirmation is a trusted server operation.
  const admin = createServiceRole()

  // Only set status = 'scheduled' if it hasn't moved past that point already
  // (e.g. if doctor already started the call → status = 'in_progress')
  const newStatus = ADVANCED_STATUSES.has(apt.status as string) ? apt.status : 'scheduled'

  const { error } = await admin
    .from('appointments')
    .update({
      payment_status: 'completed',
      payment_idempotency_key: idempotencyKey,
      status: newStatus,
    })
    .eq('id', appointmentId)

  if (error) {
    console.error('[FakePayment] update error:', error.message)
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 })
  }

  // Send notification to patient
  try {
    await notify('payment_success', appointmentId, admin)
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true })
}
