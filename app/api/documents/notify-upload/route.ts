import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

// Called by patient after uploading a document.
// Finds the patient's doctor from their most recent active appointment
// and sends an in-app + email notification.

type AptRow = {
  id: string
  doctor: { id: string; first_name: string; last_name: string; email: string | null } | null
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileName } = await req.json()

  const admin = createServiceRole()

  // Get patient profile
  const { data: patient } = await admin.from('users')
    .select('first_name, last_name, organization_id')
    .eq('id', user.id)
    .single()

  if (!patient) return NextResponse.json({ ok: false })

  const typedPatient = patient as { first_name: string; last_name: string; organization_id: string }
  const patientName = `${typedPatient.first_name} ${typedPatient.last_name}`

  // Find the most recent appointment with a doctor (pending/confirmed/scheduled)
  const { data: aptRaw } = await admin.from('appointments')
    .select('id, doctor:doctor_id(id, first_name, last_name, email)')
    .eq('patient_id', user.id)
    .eq('organization_id', typedPatient.organization_id)
    .not('doctor_id', 'is', null)
    .in('status', ['pending', 'doctor_confirmed', 'scheduled', 'paid', 'ready'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const apt = aptRaw as unknown as AptRow | null
  const doctor = apt?.doctor

  if (!apt || !doctor) return NextResponse.json({ ok: true })

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const title = 'מסמך חדש הועלה על ידי מטופל'
  const body = `${patientName} העלה/ה מסמך חדש: ${fileName || 'מסמך רפואי'}`

  // In-app notification for doctor
  try {
    await admin.from('notifications').insert({
      organization_id: typedPatient.organization_id,
      user_id: doctor.id,
      appointment_id: apt.id,
      type: 'in_app' as const,
      title,
      content: body,
      status: 'sent',
      sent_at: new Date().toISOString(),
      template_name: 'document_uploaded',
      recipient_email: doctor.email || null,
    })
  } catch { /* non-critical */ }

  // Email to doctor (best-effort)
  if (doctor.email && process.env.RESEND_API_KEY) {
    const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#0EA5E9;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:20px;">מסמך חדש ממטופל</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#1f2937;font-size:15px;line-height:1.7;">
          <p>שלום ד"ר ${doctor.first_name} ${doctor.last_name},</p>
          <p><strong>${patientName}</strong> העלה/ה מסמך חדש: <strong>${fileName || 'מסמך רפואי'}</strong></p>
          <p style="color:#6b7280;font-size:14px;">ניתן לצפות במסמך בדף התור.</p>
        </td></tr>
        <tr><td style="padding:0 32px 28px;text-align:center;">
          <a href="${base}/dashboard/doctor/appointments" style="display:inline-block;padding:12px 28px;background:#0EA5E9;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
            לניהול תורים
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">הודעה אוטומטית — אין להשיב.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    sendEmail({
      to: doctor.email,
      subject: `מסמך חדש ממטופל — ${patientName}`,
      html,
      organizationId: typedPatient.organization_id,
      userId: doctor.id,
      appointmentId: apt.id,
      templateName: 'document_uploaded',
      organizationName: '',
    }, admin).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
