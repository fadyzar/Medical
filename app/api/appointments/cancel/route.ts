import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'

// Cancel an appointment (status-based, never a hard delete — medical history preserved).
// Patient may cancel their OWN appointment; clinic admin/staff may cancel any
// appointment in their OWN organization.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointmentId, reason } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

    const admin = createServiceRole()

    const { data: apt } = await admin
      .from('appointments')
      .select('id, patient_id, doctor_id, status, organization_id, scheduled_at')
      .eq('id', appointmentId)
      .single()
    if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Resolve caller role/org
    const { data: profile } = await admin
      .from('users').select('role, organization_id').eq('id', user.id).single()
    const role = (profile as { role?: string } | null)?.role
    const orgId = (profile as { organization_id?: string } | null)?.organization_id

    const isPatientOwner = apt.patient_id === user.id
    const isOrgAdmin = (role === 'admin' || role === 'staff') && orgId === apt.organization_id

    if (!isPatientOwner && !isOrgAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cannot cancel already-finished/cancelled appointments
    const terminal = ['completed', 'cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor']
    if (terminal.includes(apt.status)) {
      return NextResponse.json({ error: 'התור כבר אינו פעיל' }, { status: 409 })
    }

    const newStatus = isPatientOwner ? 'cancelled_patient' : 'cancelled_doctor'
    const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : ''

    await admin.from('appointments').update({
      status: newStatus,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: trimmedReason || null,
    }).eq('id', appointmentId)

    // Audit log (best-effort)
    try {
      await admin.from('audit_logs').insert({
        organization_id: apt.organization_id,
        user_id: user.id,
        action: 'APPOINTMENT_CANCELLED',
        resource_type: 'appointment',
        resource_id: appointmentId,
        description: isPatientOwner ? 'המטופל ביטל תור' : 'המרפאה ביטלה תור',
        metadata: { by_role: role, reason: trimmedReason || null, previous_status: apt.status },
      })
    } catch { /* audit is best-effort */ }

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err) {
    console.error('[appointments/cancel]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
