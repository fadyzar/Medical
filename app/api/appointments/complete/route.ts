import { NextRequest, NextResponse, after } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { generateConsultationSummary } from '@/lib/ai/summary'
import { notify } from '@/lib/notifications'

// The summary is a ~30s Claude call plus notifications; the default limit is too tight.
export const maxDuration = 60

// Called when a consultation ends: by either participant when a video call ends,
// and by the doctor's "end consultation" button. Marks the appointment completed
// and generates the clinic summary automatically.
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

    const TERMINAL = ['cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor']
    if (TERMINAL.includes(apt.status)) {
      return NextResponse.json({ error: 'התור אינו פעיל' }, { status: 409 })
    }

    // Atomic claim: only the request that actually moves the appointment to
    // `completed` runs the summary pipeline. Both video participants call this
    // route when the call ends, and the doctor can also end it from the
    // appointments screen — exactly one of those wins.
    const now = new Date().toISOString()
    const { data: claimed } = await admin
      .from('appointments')
      .update({
        status: 'completed',
        completed_at: now,
        ...(apt.video_ended_at ? {} : { video_ended_at: now }),
      })
      .eq('id', appointmentId)
      .neq('status', 'completed')
      .select('id')

    const transitioned = (claimed?.length ?? 0) > 0

    if (transitioned) {
      try {
        await admin.from('audit_logs').insert({
          organization_id: apt.organization_id,
          user_id: user.id,
          action: 'APPOINTMENT_COMPLETED',
          resource_type: 'appointment',
          resource_id: appointmentId,
          description: isDoctor ? 'הרופא סיים את הייעוץ' : 'הייעוץ הסתיים (המטופל סגר את השיחה)',
          metadata: { by_role: isDoctor ? 'doctor' : 'patient' },
        })
      } catch { /* audit is best-effort */ }
    }

    // Automatic clinic summary, run through after(): Vercel keeps the function
    // alive until it finishes. (The previous un-awaited fetch to /api/ai-summary
    // was frozen with the function — and sent an action the route rejected.)
    // The patient gets exactly one message: the summary, or a plain
    // "consultation ended" if the summary could not be generated.
    if (transitioned && apt.doctor_id) {
      const doctorId = apt.doctor_id
      after(async () => {
        const outcome = await generateConsultationSummary({
          appointmentId, userId: doctorId, admin, notifyPatient: true,
        })
        if (!outcome.ok) {
          console.error('[appointments/complete] summary failed', appointmentId)
          await notify('appointment_completed', appointmentId, admin)
        }
      })
    }

    return NextResponse.json({ ok: true, completed: transitioned })
  } catch (err) {
    console.error('[appointments/complete]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
