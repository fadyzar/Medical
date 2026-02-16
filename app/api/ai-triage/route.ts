import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { triageAgent } from '@/lib/ai/agents'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

    // Use service role to read appointment regardless of RLS
    const admin = createServiceRole()
    const { data: apt } = await admin.from('appointments').select('id, chief_complaint, complaint_description, organization_id, patient_id')
      .eq('id', appointmentId).single()

    if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Get patient age
    const { data: patient } = await admin.from('users').select('date_of_birth, gender').eq('id', apt.patient_id).single()
    const age = patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined

    const result = await triageAgent({
      complaint: apt.chief_complaint,
      description: apt.complaint_description || undefined,
      age,
      gender: patient?.gender || undefined,
    })

    if (!result.success) return NextResponse.json({ error: 'AI failed' }, { status: 500 })

    // Update appointment
    const parsed = result.parsed as Record<string, unknown> | undefined
    await admin.from('appointments').update({
      ai_triage_score: parsed?.urgency_score as number || null,
      ai_triage_category: parsed?.category as string || null,
      ai_triage_reasoning: parsed?.reasoning as string || null,
      ai_triage_at: new Date().toISOString(),
    }).eq('id', appointmentId)

    // Track AI usage
    await admin.from('ai_conversations').insert({
      organization_id: apt.organization_id,
      user_id: user.id,
      appointment_id: appointmentId,
      agent_type: 'triage',
      messages: [{ role: 'user', content: apt.chief_complaint }],
      result: result.parsed || { raw: result.content },
      is_complete: true,
      input_tokens: result.tokens?.input || 0,
      output_tokens: result.tokens?.output || 0,
      model_used: 'claude-sonnet-4-20250514',
    })

    return NextResponse.json({ success: true, triage: result.parsed })
  } catch (err) {
    // CHECKLIST: No PHI in error logs
    console.error('[AI Triage API]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
