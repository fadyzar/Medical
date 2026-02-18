import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { summaryAgent, prescriptionAgent } from '@/lib/ai/agents'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('role, organization_id').eq('id', user.id).single()
    if (!profile || profile.role !== 'doctor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { appointmentId, action = 'summary' } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

    const admin = createServiceRole()
    const { data: apt } = await admin.from('appointments')
      .select('id, chief_complaint, complaint_description, subjective_notes, objective_notes, assessment, plan, diagnosis, organization_id, patient_id, video_duration_seconds')
      .eq('id', appointmentId).single()
    if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let result
    const agentType = action === 'prescription_draft' ? 'prescription_draft' : 'summary'

    if (action === 'prescription_draft') {
      const { data: patient } = await admin.from('users').select('date_of_birth, medical_history').eq('id', apt.patient_id).single()
      const age = patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000) : undefined
      const mh = patient?.medical_history as Record<string, string[]> | undefined
      result = await prescriptionAgent({ diagnosis: apt.diagnosis || apt.chief_complaint, age, allergies: mh?.allergies, medications: mh?.current_medications })
      if (result.success) await admin.from('appointments').update({ ai_prescription_draft: result.content, ai_used: true }).eq('id', appointmentId)
    } else {
      result = await summaryAgent({
        complaint: apt.chief_complaint,
        notes: [apt.subjective_notes, apt.objective_notes].filter(Boolean).join('\n'),
        assessment: apt.assessment || undefined,
        plan: apt.plan || undefined,
        duration: apt.video_duration_seconds ? Math.round(apt.video_duration_seconds / 60) : undefined,
      })
      if (result.success) {
        const p = result.parsed as { soap?: { subjective?: string; assessment?: string; plan?: string } } | undefined
        await admin.from('appointments').update({
          ai_summary: result.content, ai_summary_generated_at: new Date().toISOString(), ai_used: true,
          ...(!apt.subjective_notes && p?.soap?.subjective ? { subjective_notes: p.soap.subjective } : {}),
          ...(!apt.assessment && p?.soap?.assessment ? { assessment: p.soap.assessment } : {}),
          ...(!apt.plan && p?.soap?.plan ? { plan: p.soap.plan } : {}),
        }).eq('id', appointmentId)
      }
    }

    await admin.from('ai_conversations').insert({
      organization_id: apt.organization_id, user_id: user.id, appointment_id: appointmentId,
      agent_type: agentType, messages: [{ role: 'user', content: apt.chief_complaint }],
      result: result?.parsed || { raw: result?.content }, is_complete: true,
      input_tokens: result?.tokens?.input || 0, output_tokens: result?.tokens?.output || 0,
      model_used: 'claude-sonnet-4-20250514',
    })

    return NextResponse.json({ success: result?.success, data: result?.parsed || result?.content })
  } catch (err) {
    console.error('[AI Summary API]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
