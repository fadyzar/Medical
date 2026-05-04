import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'

// Called immediately after patient creates an appointment.
// Sends:
//  1. Patient → appointment_created (confirmation)
//  2. Doctor  → doctor_new_request  (if a doctor was selected)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appointmentId } = await req.json()
  if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

  const admin = createServiceRole()

  // Send both notifications concurrently (non-blocking)
  await Promise.allSettled([
    notify('appointment_created', appointmentId, admin),
    notify('doctor_new_request', appointmentId, admin),
  ])

  return NextResponse.json({ ok: true })
}
