import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Send appointment summary to patient:
//  1. Always creates an in-app notification
//  2. Tries email if RESEND_API_KEY is set
//  3. Tries WhatsApp if INFOBIP keys are set

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appointmentId, channel } = await req.json() as {
    appointmentId: string
    channel: 'email' | 'whatsapp' | 'in_app'
  }
  if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

  type AptRow = {
    id: string; ai_summary: string | null; chief_complaint: string
    subjective_notes: string | null; assessment: string | null; plan: string | null
    diagnosis: string | null; follow_up_instructions: string | null
    scheduled_at: string | null; organization_id: string
    patient: { id: string; first_name: string; last_name: string; email: string; phone: string } | null
    doctor:  { first_name: string; last_name: string } | null
  }

  // Load appointment + patient + doctor
  const { data: aptRaw } = await supabase
    .from('appointments')
    .select(`
      id, ai_summary, chief_complaint, subjective_notes, assessment, plan, diagnosis,
      follow_up_instructions, scheduled_at, organization_id,
      patient:patient_id(id, first_name, last_name, email, phone),
      doctor:doctor_id(id, first_name, last_name)
    `)
    .eq('id', appointmentId)
    .single()

  if (!aptRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const apt = aptRaw as unknown as AptRow

  // Only the appointment's doctor (or admin/staff) can send
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = profile?.role
  if (role !== 'doctor' && role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = apt.patient
  const doctor  = apt.doctor

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Build human-readable summary from SOAP + AI
  const summaryText = buildSummaryText({
    ai_summary: apt.ai_summary ?? undefined,
    chief_complaint: apt.chief_complaint,
    subjective_notes: apt.subjective_notes ?? undefined,
    assessment: apt.assessment ?? undefined,
    plan: apt.plan ?? undefined,
    diagnosis: apt.diagnosis ?? undefined,
    follow_up_instructions: apt.follow_up_instructions ?? undefined,
  }, doctor)

  // 1. Always create in-app notification
  const { error: notifError } = await supabase.from('notifications').insert({
    organization_id: apt.organization_id,
    user_id: patient.id,
    appointment_id: apt.id,
    type: 'in_app',
    title: 'סיכום ייעוץ רפואי',
    content: summaryText,
    status: 'sent',
    sent_at: new Date().toISOString(),
    template_name: 'consultation_summary',
    recipient_email: patient.email || null,
  })

  if (notifError) {
    console.error('[SendSummary] notification insert error:', notifError)
  }

  const results: Record<string, { ok: boolean; error?: string }> = {
    in_app: { ok: !notifError },
  }

  // 2. Email (if requested and configured)
  if (channel === 'email') {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      results.email = { ok: false, error: 'שירות האימייל לא מחובר עדיין' }
    } else {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: 'no-reply@telemed.co.il',
          to: patient.email,
          subject: 'סיכום ייעוץ רפואי',
          html: buildEmailHtml(summaryText, patient.first_name, doctor),
        })
        results.email = { ok: true }
      } catch (e) {
        results.email = { ok: false, error: e instanceof Error ? e.message : 'שגיאה בשליחת אימייל' }
      }
    }
  }

  // 3. WhatsApp (if requested and configured)
  if (channel === 'whatsapp') {
    const infobipKey = process.env.INFOBIP_API_KEY
    if (!infobipKey) {
      results.whatsapp = { ok: false, error: 'שירות הוואטסאפ לא מחובר עדיין' }
    } else {
      try {
        const { sendWhatsApp } = await import('@/lib/whatsapp')
        const { createServiceRole } = await import('@/lib/supabase/server')
        const adminClient = createServiceRole()
        await sendWhatsApp({
          to: patient.phone,
          message: `שלום ${patient.first_name},\n\nסיכום הייעוץ שלך:\n\n${summaryText}`,
          organizationId: apt.organization_id,
          userId: patient.id,
          appointmentId: apt.id,
          templateName: 'consultation_summary',
        }, adminClient)
        results.whatsapp = { ok: true }
      } catch (e) {
        results.whatsapp = { ok: false, error: e instanceof Error ? e.message : 'שגיאה בשליחת וואטסאפ' }
      }
    }
  }

  return NextResponse.json({ ok: true, results })
}

function buildSummaryText(
  apt: { ai_summary?: string; chief_complaint?: string; subjective_notes?: string; assessment?: string; plan?: string; diagnosis?: string; follow_up_instructions?: string },
  doctor: { first_name: string; last_name: string } | null
): string {
  const lines: string[] = []

  if (doctor) {
    lines.push(`רופא מטפל: ד"ר ${doctor.first_name} ${doctor.last_name}`)
  }
  if (apt.chief_complaint) {
    lines.push(`תלונה עיקרית: ${apt.chief_complaint}`)
  }

  // Try AI summary first
  if (apt.ai_summary) {
    try {
      const parsed = JSON.parse(apt.ai_summary)
      if (parsed.summary) lines.push(`\nסיכום:\n${parsed.summary}`)
      if (parsed.diagnosis) lines.push(`אבחנה: ${parsed.diagnosis}`)
      if (parsed.treatment_plan) lines.push(`תוכנית טיפול: ${parsed.treatment_plan}`)
      if (parsed.follow_up) lines.push(`המשך טיפול: ${parsed.follow_up}`)
      if (parsed.medications?.length) lines.push(`תרופות: ${parsed.medications.join(', ')}`)
    } catch {
      // Not JSON — use as plain text
      lines.push(`\nסיכום AI:\n${apt.ai_summary}`)
    }
  }

  // SOAP notes
  if (apt.subjective_notes) lines.push(`\nתלונות סובייקטיביות:\n${apt.subjective_notes}`)
  if (apt.assessment) lines.push(`הערכה: ${apt.assessment}`)
  if (apt.plan) lines.push(`תוכנית: ${apt.plan}`)
  if (apt.diagnosis) lines.push(`אבחנה: ${apt.diagnosis}`)
  if (apt.follow_up_instructions) lines.push(`הוראות המשך: ${apt.follow_up_instructions}`)

  return lines.join('\n')
}

function buildEmailHtml(
  summaryText: string,
  patientFirstName: string,
  doctor: { first_name: string; last_name: string } | null
): string {
  return `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
  <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 32px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">סיכום ייעוץ רפואי</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">שלום ${patientFirstName}, הנה סיכום הייעוץ שלך</p>
  </div>
  <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
    <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.7; color: #374151; font-size: 14px;">${summaryText}</pre>
    ${doctor ? `<p style="margin-top: 24px; color: #6b7280; font-size: 12px;">נשלח על ידי ד"ר ${doctor.first_name} ${doctor.last_name}</p>` : ''}
  </div>
</div>`
}
