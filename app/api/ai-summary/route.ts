import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { prescriptionAgent } from '@/lib/ai/agents'
import { generateConsultationSummary } from '@/lib/ai/summary'
import { aiSummarySchema } from '@/lib/validation/schemas'
import { rateLimit } from '@/lib/security/rate-limit'
import { orchestrate } from '@/lib/ai/orchestrator'

// The summary is a ~30s Claude call plus notifications; the default limit is too tight.
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: 20 AI calls per hour per user
    const limit = rateLimit(`ai-summary:${user.id}`, { maxRequests: 20, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'חריגה ממגבלת בקשות AI. נסה שוב מאוחר יותר.' }, { status: 429 })
    }

    const { data: profile } = await supabase.from('users').select('role, organization_id').eq('id', user.id).single()
    if (!profile || profile.role !== 'doctor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = aiSummarySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'נתונים לא תקינים', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { appointmentId, action } = parsed.data

    const admin = createServiceRole()
    const { data: apt } = await admin.from('appointments')
      .select('id, chief_complaint, complaint_description, subjective_notes, objective_notes, assessment, plan, diagnosis, organization_id, patient_id, doctor_id, video_duration_seconds')
      .eq('id', appointmentId).single()
    if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Same rule as RLS (apt_doctor_select): a doctor works only on appointments
    // assigned to them — not on a colleague's patients in the same clinic.
    if (apt.organization_id !== (profile as unknown as { organization_id: string }).organization_id
      || apt.doctor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Handle 'brief' action via orchestrator
    if (action === 'brief') {
      const { data: patient } = await admin.from('users')
        .select('first_name, last_name, date_of_birth, medical_history')
        .eq('id', apt.patient_id).single()

      const { data: qrList } = await admin.from('questionnaire_responses')
        .select('responses')
        .eq('appointment_id', appointmentId)
        .eq('is_complete', true)
        .limit(1)

      const mh = (patient?.medical_history || {}) as Record<string, string[]>
      const briefResult = await orchestrate(
        'brief',
        {
          userId: user.id,
          organizationId: apt.organization_id,
          role: 'doctor',
          appointmentId,
          patientProfile: {
            name: patient ? `${patient.first_name} ${patient.last_name}` : 'לא ידוע',
            dateOfBirth: patient?.date_of_birth || undefined,
            allergies: mh.allergies || [],
            chronicConditions: mh.chronic_conditions || [],
            currentMedications: mh.current_medications || [],
          },
          payload: {
            chiefComplaint: apt.chief_complaint,
            questionnaireResponses: qrList?.[0]?.responses,
            triageReasoning: (apt as Record<string, unknown>).ai_triage_reasoning as string | undefined,
          },
        },
        `צור בריף לפני ביקור עבור מטופל עם תלונה: ${apt.chief_complaint}`,
        { maxTokens: 900 }
      )

      await admin.from('ai_conversations').insert({
        organization_id: apt.organization_id, user_id: user.id, appointment_id: appointmentId,
        agent_type: 'brief', messages: [{ role: 'user', content: apt.chief_complaint }],
        result: { brief: briefResult.output.substring(0, 100) }, is_complete: true,
        input_tokens: briefResult.tokensUsed.input, output_tokens: briefResult.tokensUsed.output,
        model_used: briefResult.modelUsed,
      })

      return NextResponse.json({
        success: briefResult.success,
        brief: briefResult.output,
        redFlags: briefResult.redFlags,
      })
    }

    if (action === 'summary') {
      // Explicit doctor request: regenerate even if one exists, and tell the patient.
      const outcome = await generateConsultationSummary({
        appointmentId, userId: user.id, admin, force: true, notifyPatient: true,
      })
      if (!outcome.ok) {
        return NextResponse.json({ success: false, error: 'יצירת סיכום AI נכשלה. נסה שוב.' }, { status: 502 })
      }
      return NextResponse.json({ success: true, data: outcome.data })
    }

    // action === 'prescription_draft'
    const { data: patient } = await admin.from('users').select('date_of_birth, medical_history').eq('id', apt.patient_id).single()
    const age = patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000) : undefined
    const mh = patient?.medical_history as Record<string, string[]> | undefined
    const result = await prescriptionAgent({ diagnosis: apt.diagnosis || apt.chief_complaint, age, allergies: mh?.allergies, medications: mh?.current_medications })
    if (result.success) await admin.from('appointments').update({ ai_prescription_draft: result.content, ai_used: true }).eq('id', appointmentId)

    await admin.from('ai_conversations').insert({
      organization_id: apt.organization_id, user_id: user.id, appointment_id: appointmentId,
      agent_type: 'prescription_draft', messages: [{ role: 'user', content: apt.chief_complaint }],
      result: result.parsed || { raw: result.content }, is_complete: true,
      input_tokens: result.tokens?.input || 0, output_tokens: result.tokens?.output || 0,
      model_used: 'claude-sonnet-4-20250514',
    })

    return NextResponse.json({ success: result.success, data: result.parsed || result.content })
  } catch (err) {
    console.error('[AI Summary API]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
