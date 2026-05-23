import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'

// Called when a video call ends (by either participant).
// Marks the appointment completed and triggers AI summary generation.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

    const admin = createServiceRole()

    // Verify caller is the doctor or patient of this appointment
    const { data: apt } = await admin
      .from('appointments')
      .select('id, patient_id, doctor_id, status, video_ended_at, organization_id')
      .eq('id', appointmentId)
      .single()

    if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isDoctor  = apt.doctor_id  === user.id
    const isPatient = apt.patient_id === user.id
    if (!isDoctor && !isPatient) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Mark appointment completed (idempotent)
    const updates: Record<string, unknown> = { status: 'completed' }
    if (!apt.video_ended_at) updates.video_ended_at = new Date().toISOString()

    await admin.from('appointments').update(updates).eq('id', appointmentId)

    // Doctor ends call → trigger AI summary in background (fire and forget)
    if (isDoctor) {
      const origin = req.nextUrl.origin
      fetch(`${origin}/api/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward the auth cookie so the doctor's session is validated
          cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({ appointmentId, action: 'summarize' }),
      }).catch(() => { /* non-critical — doctor can regenerate manually */ })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[appointments/complete]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
