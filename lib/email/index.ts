import { Resend } from 'resend'
import { formatDateTime, SPECIALTIES } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────

type SendEmailParams = {
  to: string
  subject: string
  html: string
  organizationId: string
  userId: string
  appointmentId: string | null
  templateName: string
  organizationName?: string
  variables?: Record<string, unknown>
}

type SendEmailResult = {
  success: boolean
  externalId?: string
  error?: string
}

type ConfirmationData = {
  patientName: string
  doctorName: string | null
  specialty: string | null
  complaint: string
  organizationName: string
  dashboardUrl: string
}

type ReminderData = {
  patientName: string
  doctorName: string
  specialty: string | null
  scheduledAt: string
  organizationName: string
  dashboardUrl: string
}

type Reminder1hData = ReminderData & {
  videoCallUrl: string
}

type SummaryData = {
  patientName: string
  doctorName: string
  specialty: string | null
  scheduledAt: string
  diagnosis: string | null
  followUpInstructions: string | null
  organizationName: string
  dashboardUrl: string
}

// ── Resend Singleton ─────────────────────────────────

let _resend: Resend | null = null

function getResendClient(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not configured')
    _resend = new Resend(key)
  }
  return _resend
}

// ── Specialty Label Lookup ───────────────────────────

function getSpecialtyLabel(id: string | null): string {
  if (!id) return ''
  return SPECIALTIES.find(s => s.id === id)?.label || id
}

// ── HTML Base Wrapper ────────────────────────────────

function wrapEmailHtml(params: {
  content: string
  ctaUrl: string
  ctaText: string
  organizationName: string
  primaryColor?: string
}): string {
  const color = params.primaryColor || '#0EA5E9'
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:${color};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">${params.organizationName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;text-align:right;line-height:1.7;color:#1f2937;font-size:15px;">
              ${params.content}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${params.ctaUrl}" style="display:inline-block;padding:14px 32px;background-color:${color};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">
                ${params.ctaText}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">${params.organizationName} | ייעוץ רפואי מקוון</p>
              <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">הודעה זו נשלחה אוטומטית. אין להשיב להודעה זו.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Template Builders ────────────────────────────────

function buildAppointmentConfirmationHtml(data: ConfirmationData): string {
  const specialtyLabel = getSpecialtyLabel(data.specialty)
  const doctorLine = data.doctorName
    ? `<p style="margin:0 0 8px;">🩺 <strong>רופא:</strong> ד"ר ${data.doctorName}</p>`
    : `<p style="margin:0 0 8px;">🩺 <strong>רופא:</strong> ישובץ בהקדם</p>`

  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.dashboardUrl,
    ctaText: 'צפה בתור',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.patientName},</h2>
      <p style="margin:0 0 20px;">בקשת התור שלך התקבלה בהצלחה! הנה הפרטים:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          ${specialtyLabel ? `<p style="margin:0 0 8px;">📋 <strong>התמחות:</strong> ${specialtyLabel}</p>` : ''}
          ${doctorLine}
          <p style="margin:0 0 8px;">💬 <strong>תלונה:</strong> ${data.complaint}</p>
        </td></tr>
      </table>
      <p style="margin:0;color:#6b7280;font-size:14px;">תקבל הודעה נוספת כשהרופא יאשר את התור ויקבע מועד.</p>
    `,
  })
}

function buildReminder24hHtml(data: ReminderData): string {
  const specialtyLabel = getSpecialtyLabel(data.specialty)

  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.dashboardUrl,
    ctaText: 'צפה בפרטי התור',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.patientName},</h2>
      <p style="margin:0 0 20px;">זוהי תזכורת שיש לך תור מחר:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">📅 <strong>מועד:</strong> ${data.scheduledAt}</p>
          <p style="margin:0 0 8px;">🩺 <strong>רופא:</strong> ד"ר ${data.doctorName}</p>
          ${specialtyLabel ? `<p style="margin:0;">📋 <strong>התמחות:</strong> ${specialtyLabel}</p>` : ''}
        </td></tr>
      </table>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">📌 ודא שיש לך חיבור אינטרנט יציב, מצלמה ומיקרופון תקינים.</p>
      <p style="margin:0;color:#6b7280;font-size:14px;">שעה לפני התור תקבל הודעה עם קישור לשיחת הווידאו.</p>
    `,
  })
}

function buildReminder1hHtml(data: Reminder1hData): string {
  const specialtyLabel = getSpecialtyLabel(data.specialty)

  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.videoCallUrl,
    ctaText: 'הצטרף לשיחת וידאו',
    primaryColor: '#16a34a',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.patientName},</h2>
      <p style="margin:0 0 20px;font-size:17px;"><strong>התור שלך מתחיל בעוד שעה!</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">📅 <strong>מועד:</strong> ${data.scheduledAt}</p>
          <p style="margin:0 0 8px;">🩺 <strong>רופא:</strong> ד"ר ${data.doctorName}</p>
          ${specialtyLabel ? `<p style="margin:0;">📋 <strong>התמחות:</strong> ${specialtyLabel}</p>` : ''}
        </td></tr>
      </table>
      <p style="margin:0 0 12px;color:#1f2937;font-size:14px;"><strong>לפני השיחה:</strong></p>
      <ul style="margin:0 0 16px;padding:0 20px 0 0;color:#4b5563;font-size:14px;">
        <li style="margin:0 0 4px;">ודא חיבור אינטרנט יציב</li>
        <li style="margin:0 0 4px;">בדוק שהמצלמה והמיקרופון עובדים</li>
        <li style="margin:0 0 4px;">שב במקום שקט ומואר</li>
        <li style="margin:0;">הכן מסמכים רפואיים רלוונטיים</li>
      </ul>
    `,
  })
}

function buildConsultationSummaryHtml(data: SummaryData): string {
  const specialtyLabel = getSpecialtyLabel(data.specialty)

  const diagnosisSection = data.diagnosis
    ? `<p style="margin:0 0 8px;">🔍 <strong>אבחנה:</strong> ${data.diagnosis}</p>`
    : ''

  const followUpSection = data.followUpInstructions
    ? `<p style="margin:0;">📝 <strong>הוראות מעקב:</strong> ${data.followUpInstructions}</p>`
    : ''

  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.dashboardUrl,
    ctaText: 'צפה בסיכום המלא',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.patientName},</h2>
      <p style="margin:0 0 20px;">הייעוץ הרפואי שלך הסתיים. הנה סיכום קצר:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">📅 <strong>תאריך:</strong> ${data.scheduledAt}</p>
          <p style="margin:0 0 8px;">🩺 <strong>רופא:</strong> ד"ר ${data.doctorName}</p>
          ${specialtyLabel ? `<p style="margin:0 0 8px;">📋 <strong>התמחות:</strong> ${specialtyLabel}</p>` : ''}
          ${diagnosisSection}
          ${followUpSection}
        </td></tr>
      </table>
      <p style="margin:0;color:#6b7280;font-size:14px;">לפרטים המלאים, כולל הוראות הרופא, היכנס לדשבורד שלך.</p>
    `,
  })
}

// ── Core Send Function ───────────────────────────────

export async function sendEmail(params: SendEmailParams, admin: SupabaseClient): Promise<SendEmailResult> {
  try {
    const resend = getResendClient()
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'noreply@cannaforyou.net'
    const fromName = params.organizationName || 'CANNA'

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })

    if (error) throw new Error(error.message)

    // Record successful send
    await admin.from('notifications').insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      appointment_id: params.appointmentId,
      type: 'email',
      template_name: params.templateName,
      content: params.subject,
      variables: params.variables || null,
      recipient_email: params.to,
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider: 'resend',
      external_id: data?.id || null,
    })

    return { success: true, externalId: data?.id }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Email send failed'
    console.error('[Email]', errorMessage)

    // Record failure — don't throw on audit failure
    try {
      await admin.from('notifications').insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        appointment_id: params.appointmentId,
        type: 'email',
        template_name: params.templateName,
        content: params.subject,
        recipient_email: params.to,
        status: 'failed',
        error_message: errorMessage,
        provider: 'resend',
      })
    } catch { /* ignore audit failure */ }

    return { success: false, error: errorMessage }
  }
}

// ── Helper: Fetch appointment with patient, doctor, org ──

async function fetchAppointmentContext(appointmentId: string, admin: SupabaseClient) {
  const { data: apt } = await admin.from('appointments')
    .select('id, organization_id, patient_id, doctor_id, chief_complaint, requested_specialty, scheduled_at, diagnosis, follow_up_instructions, status, created_at, payment_amount')
    .eq('id', appointmentId)
    .single()

  if (!apt) throw new Error('Appointment not found')

  const { data: patient } = await admin.from('users')
    .select('id, email, first_name, last_name')
    .eq('id', apt.patient_id)
    .single()

  if (!patient) throw new Error('Patient not found')

  let doctor: { id: string; first_name: string; last_name: string } | null = null
  if (apt.doctor_id) {
    const { data: doc } = await admin.from('users')
      .select('id, first_name, last_name')
      .eq('id', apt.doctor_id)
      .single()
    doctor = doc
  }

  const { data: org } = await admin.from('organizations')
    .select('name, primary_color, features, settings')
    .eq('id', apt.organization_id)
    .single()

  return { apt, patient, doctor, org }
}

// ── Helper: Check idempotency ────────────────────────

async function alreadySent(appointmentId: string, templateName: string, admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from('notifications')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('template_name', templateName)
    .eq('type', 'email')
    .eq('status', 'sent')
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ── High-Level Send Functions ────────────────────────

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function sendAppointmentConfirmation(params: { appointmentId: string; admin: SupabaseClient }): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'appointment_confirmation'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const { apt, patient, doctor, org } = await fetchAppointmentContext(appointmentId, admin)
  const orgName = org?.name || 'CANNA'

  const html = buildAppointmentConfirmationHtml({
    patientName: `${patient.first_name} ${patient.last_name}`,
    doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
    specialty: apt.requested_specialty,
    complaint: apt.chief_complaint,
    organizationName: orgName,
    dashboardUrl: `${APP_URL()}/dashboard/patient/dashboard`,
  })

  await sendEmail({
    to: patient.email,
    subject: `אישור קביעת תור - ${orgName}`,
    html,
    organizationId: apt.organization_id,
    userId: patient.id,
    appointmentId,
    templateName,
    organizationName: orgName,
    variables: { specialty: apt.requested_specialty, complaint: apt.chief_complaint },
  }, admin)
}

export async function sendReminder24h(params: { appointmentId: string; admin: SupabaseClient }): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'reminder_24h'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const { apt, patient, doctor, org } = await fetchAppointmentContext(appointmentId, admin)
  if (!doctor || !apt.scheduled_at) return

  const orgName = org?.name || 'CANNA'

  const html = buildReminder24hHtml({
    patientName: `${patient.first_name} ${patient.last_name}`,
    doctorName: `${doctor.first_name} ${doctor.last_name}`,
    specialty: apt.requested_specialty,
    scheduledAt: formatDateTime(apt.scheduled_at),
    organizationName: orgName,
    dashboardUrl: `${APP_URL()}/dashboard/patient/dashboard`,
  })

  await sendEmail({
    to: patient.email,
    subject: `תזכורת: תור מחר - ${orgName}`,
    html,
    organizationId: apt.organization_id,
    userId: patient.id,
    appointmentId,
    templateName,
    organizationName: orgName,
    variables: { scheduled_at: apt.scheduled_at },
  }, admin)
}

export async function sendReminder1h(params: { appointmentId: string; admin: SupabaseClient }): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'reminder_1h'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const { apt, patient, doctor, org } = await fetchAppointmentContext(appointmentId, admin)
  if (!doctor || !apt.scheduled_at) return

  const orgName = org?.name || 'CANNA'

  const html = buildReminder1hHtml({
    patientName: `${patient.first_name} ${patient.last_name}`,
    doctorName: `${doctor.first_name} ${doctor.last_name}`,
    specialty: apt.requested_specialty,
    scheduledAt: formatDateTime(apt.scheduled_at),
    organizationName: orgName,
    dashboardUrl: `${APP_URL()}/dashboard/patient/dashboard`,
    videoCallUrl: `${APP_URL()}/video-call?id=${appointmentId}`,
  })

  await sendEmail({
    to: patient.email,
    subject: `התור שלך בעוד שעה! - ${orgName}`,
    html,
    organizationId: apt.organization_id,
    userId: patient.id,
    appointmentId,
    templateName,
    organizationName: orgName,
    variables: { scheduled_at: apt.scheduled_at, video_url: `${APP_URL()}/video-call?id=${appointmentId}` },
  }, admin)
}

export async function sendConsultationSummary(params: { appointmentId: string; admin: SupabaseClient }): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'consultation_summary'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const { apt, patient, doctor, org } = await fetchAppointmentContext(appointmentId, admin)
  if (!doctor) return

  const orgName = org?.name || 'CANNA'

  const html = buildConsultationSummaryHtml({
    patientName: `${patient.first_name} ${patient.last_name}`,
    doctorName: `${doctor.first_name} ${doctor.last_name}`,
    specialty: apt.requested_specialty,
    scheduledAt: formatDateTime(apt.scheduled_at || apt.created_at),
    diagnosis: apt.diagnosis,
    followUpInstructions: apt.follow_up_instructions,
    organizationName: orgName,
    dashboardUrl: `${APP_URL()}/dashboard/patient/dashboard`,
  })

  await sendEmail({
    to: patient.email,
    subject: `סיכום ייעוץ - ${orgName}`,
    html,
    organizationId: apt.organization_id,
    userId: patient.id,
    appointmentId,
    templateName,
    organizationName: orgName,
  }, admin)
}

// ── Payment Receipt Email ───────────────────────────

type PaymentReceiptData = {
  patientName: string
  doctorName: string | null
  specialty: string | null
  amount: string
  organizationName: string
  dashboardUrl: string
  invoiceUrl: string | null
}

function buildPaymentReceiptHtml(data: PaymentReceiptData): string {
  const specialtyLabel = getSpecialtyLabel(data.specialty)
  const doctorLine = data.doctorName
    ? `<p style="margin:0 0 8px;">🩺 <strong>רופא:</strong> ד"ר ${data.doctorName}</p>`
    : ''
  const invoiceLine = data.invoiceUrl
    ? `<p style="margin:16px 0 0;"><a href="${data.invoiceUrl}" style="color:#0EA5E9;text-decoration:none;font-weight:bold;">📄 הורד קבלה (PDF)</a></p>`
    : ''

  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.dashboardUrl,
    ctaText: 'צפה בתור',
    primaryColor: '#16a34a',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.patientName},</h2>
      <p style="margin:0 0 20px;">התשלום שלך התקבל בהצלחה!</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">💳 <strong>סכום שחויב:</strong> ${data.amount}</p>
          ${doctorLine}
          ${specialtyLabel ? `<p style="margin:0 0 8px;">📋 <strong>התמחות:</strong> ${specialtyLabel}</p>` : ''}
          ${invoiceLine}
        </td></tr>
      </table>
      <p style="margin:0;color:#6b7280;font-size:14px;">תקבל הודעה נוספת עם קישור לשיחת הווידאו לפני מועד התור.</p>
    `,
  })
}

export async function sendPaymentReceipt(params: {
  appointmentId: string
  invoiceUrl: string | null
  admin: SupabaseClient
}): Promise<void> {
  const { appointmentId, invoiceUrl, admin } = params
  const templateName = 'payment_receipt'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const { apt, patient, doctor, org } = await fetchAppointmentContext(appointmentId, admin)
  if (!apt.payment_amount) return

  const orgName = org?.name || 'CANNA'

  const html = buildPaymentReceiptHtml({
    patientName: `${patient.first_name} ${patient.last_name}`,
    doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
    specialty: apt.requested_specialty,
    amount: `₪${apt.payment_amount}`,
    organizationName: orgName,
    dashboardUrl: `${APP_URL()}/dashboard/patient/dashboard`,
    invoiceUrl,
  })

  await sendEmail({
    to: patient.email,
    subject: `אישור תשלום — ${orgName}`,
    html,
    organizationId: apt.organization_id,
    userId: patient.id,
    appointmentId,
    templateName,
    organizationName: orgName,
    variables: { amount: apt.payment_amount, invoice_url: invoiceUrl },
  }, admin)
}

// ── Staff/Admin Invite Email ────────────────────────

type StaffInviteData = {
  name: string
  email: string
  role: 'staff' | 'admin'
  organizationName: string
  inviterName: string
  organizationId: string
  registrationUrl: string
}

const ROLE_LABELS_EMAIL: Record<string, string> = {
  staff: 'איש צוות',
  admin: 'מנהל',
  doctor: 'רופא',
}

function buildStaffInviteHtml(data: StaffInviteData): string {
  const roleLabel = ROLE_LABELS_EMAIL[data.role] || data.role
  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.registrationUrl,
    ctaText: 'הירשם למערכת',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.name},</h2>
      <p style="margin:0 0 20px;">${data.inviterName} מזמין אותך להצטרף כ<strong>${roleLabel}</strong> ל<strong>${data.organizationName}</strong> בפלטפורמת CANNA.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">🏥 <strong>מרפאה:</strong> ${data.organizationName}</p>
          <p style="margin:0 0 8px;">👤 <strong>תפקיד:</strong> ${roleLabel}</p>
          <p style="margin:0 0 8px;">📧 <strong>אימייל:</strong> ${data.email}</p>
          <p style="margin:0;">🔑 <strong>הזמנה מאת:</strong> ${data.inviterName}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">לחץ על הכפתור למטה כדי להשלים את ההרשמה שלך במערכת.</p>
      <p style="margin:0;color:#6b7280;font-size:13px;">אם אינך מכיר את השולח, ניתן להתעלם מהודעה זו.</p>
    `,
  })
}

export async function sendStaffInvite(params: {
  name: string
  email: string
  role: 'staff' | 'admin'
  organizationId: string
  organizationName: string
  inviterName: string
  inviterUserId: string
  inviteToken?: string
  baseUrl?: string
  admin: SupabaseClient
}): Promise<{ success: boolean; error?: string }> {
  const { admin, ...data } = params
  const appUrl = data.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const registrationUrl = data.inviteToken
    ? `${appUrl}/auth/invite/${data.inviteToken}`
    : `${appUrl}/auth/register?invite=true&org=${data.organizationId}&email=${encodeURIComponent(data.email)}&role=${data.role}`

  const html = buildStaffInviteHtml({
    ...data,
    registrationUrl,
  })

  const roleLabel = ROLE_LABELS_EMAIL[data.role] || data.role
  return sendEmail({
    to: data.email,
    subject: `הוזמנת להצטרף כ${roleLabel} ל${data.organizationName} בCANNA`,
    html,
    organizationId: data.organizationId,
    userId: data.inviterUserId,
    appointmentId: null,
    templateName: 'staff_invite',
    organizationName: data.organizationName,
    variables: { name: data.name, email: data.email, role: data.role },
  }, admin)
}

// ── Doctor Invite Email ─────────────────────────────

type DoctorInviteData = {
  doctorName: string
  doctorEmail: string
  organizationName: string
  inviterName: string
  organizationId: string
  registrationUrl: string
}

function buildDoctorInviteHtml(data: DoctorInviteData): string {
  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.registrationUrl,
    ctaText: 'הירשם כרופא',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.doctorName},</h2>
      <p style="margin:0 0 20px;">${data.inviterName} מזמין אותך להצטרף לצוות הרפואי של <strong>${data.organizationName}</strong> בפלטפורמת CANNA.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">🏥 <strong>מרפאה:</strong> ${data.organizationName}</p>
          <p style="margin:0 0 8px;">👤 <strong>הזמנה מאת:</strong> ${data.inviterName}</p>
          <p style="margin:0;">📧 <strong>אימייל:</strong> ${data.doctorEmail}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">לחץ על הכפתור למטה כדי להשלים את ההרשמה שלך כרופא במערכת.</p>
      <p style="margin:0;color:#6b7280;font-size:13px;">אם אינך מכיר את השולח, ניתן להתעלם מהודעה זו.</p>
    `,
  })
}

export async function sendDoctorInvite(params: {
  doctorName: string
  doctorEmail: string
  organizationId: string
  organizationName: string
  inviterName: string
  inviterUserId: string
  inviteToken?: string
  baseUrl?: string
  admin: SupabaseClient
}): Promise<{ success: boolean; error?: string }> {
  const { admin, ...data } = params
  const appUrl = data.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const registrationUrl = data.inviteToken
    ? `${appUrl}/auth/invite/${data.inviteToken}`
    : `${appUrl}/auth/register?invite=true&org=${data.organizationId}&email=${encodeURIComponent(data.doctorEmail)}&role=doctor`

  const html = buildDoctorInviteHtml({
    ...data,
    registrationUrl,
  })

  return sendEmail({
    to: data.doctorEmail,
    subject: `הוזמנת להצטרף ל${data.organizationName} בCANNA`,
    html,
    organizationId: data.organizationId,
    userId: data.inviterUserId,
    appointmentId: null,
    templateName: 'doctor_invite',
    organizationName: data.organizationName,
    variables: { doctor_name: data.doctorName, doctor_email: data.doctorEmail },
  }, admin)
}

// ── Welcome Email ───────────────────────────────────

type WelcomeData = {
  userName: string
  userRole: string
  organizationName: string
  dashboardUrl: string
}

const ROLE_LABELS_WELCOME: Record<string, string> = {
  patient: 'מטופל',
  doctor: 'רופא',
  admin: 'מנהל מרפאה',
  staff: 'איש צוות',
}

function buildWelcomeHtml(data: WelcomeData): string {
  const roleLabel = ROLE_LABELS_WELCOME[data.userRole] || data.userRole

  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.dashboardUrl,
    ctaText: 'היכנס למערכת',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">ברוך הבא, ${data.userName}!</h2>
      <p style="margin:0 0 20px;">ההרשמה שלך ל<strong>${data.organizationName}</strong> הושלמה בהצלחה.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">🏥 <strong>מרפאה:</strong> ${data.organizationName}</p>
          <p style="margin:0;">👤 <strong>תפקיד:</strong> ${roleLabel}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 12px;color:#1f2937;font-size:14px;"><strong>מה תוכל לעשות במערכת:</strong></p>
      <ul style="margin:0 0 16px;padding:0 20px 0 0;color:#4b5563;font-size:14px;">
        <li style="margin:0 0 4px;">📅 קביעת תורים לייעוץ רפואי מקוון</li>
        <li style="margin:0 0 4px;">📹 שיחות וידאו מאובטחות עם רופאים</li>
        <li style="margin:0 0 4px;">📄 העלאת מסמכים רפואיים</li>
        <li style="margin:0;">💬 סיכום ייעוץ מפורט לאחר כל פגישה</li>
      </ul>
      <p style="margin:0;color:#6b7280;font-size:14px;">לחץ על הכפתור למטה כדי להיכנס לדשבורד שלך ולהתחיל.</p>
    `,
  })
}

export async function sendWelcomeEmail(params: {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: string
  organizationId: string
  organizationName: string
  admin: SupabaseClient
}): Promise<void> {
  const { admin, ...data } = params
  const templateName = 'welcome'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const roleHome: Record<string, string> = {
    doctor: '/dashboard/doctor/dashboard',
    admin: '/dashboard/admin/dashboard',
    staff: '/dashboard/staff/dashboard',
    patient: '/dashboard/patient/dashboard',
  }

  const html = buildWelcomeHtml({
    userName: `${data.firstName} ${data.lastName}`,
    userRole: data.role,
    organizationName: data.organizationName,
    dashboardUrl: `${appUrl}${roleHome[data.role] || '/dashboard/patient/dashboard'}`,
  })

  await sendEmail({
    to: data.email,
    subject: `ברוך הבא ל${data.organizationName}!`,
    html,
    organizationId: data.organizationId,
    userId: data.userId,
    appointmentId: null,
    templateName,
    organizationName: data.organizationName,
    variables: { role: data.role },
  }, admin)
}

// ── Password Reset Email ────────────────────────────

type PasswordResetData = {
  userName: string
  resetUrl: string
  organizationName: string
}

function buildPasswordResetHtml(data: PasswordResetData): string {
  return wrapEmailHtml({
    organizationName: data.organizationName,
    ctaUrl: data.resetUrl,
    ctaText: 'איפוס סיסמה',
    primaryColor: '#dc2626',
    content: `
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">שלום ${data.userName},</h2>
      <p style="margin:0 0 20px;">קיבלנו בקשה לאיפוס הסיסמה שלך ב<strong>${data.organizationName}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;">🔒 <strong>לחץ על הכפתור למטה כדי לבחור סיסמה חדשה.</strong></p>
          <p style="margin:0;color:#6b7280;font-size:13px;">הקישור תקף ל-60 דקות בלבד.</p>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם מהודעה זו.</p>
      <p style="margin:0;color:#9ca3af;font-size:13px;">הסיסמה הנוכחית שלך לא תשתנה עד שתבחר סיסמה חדשה.</p>
    `,
  })
}

export async function sendPasswordResetEmail(params: {
  userId: string
  email: string
  firstName: string
  lastName: string
  resetUrl: string
  organizationId: string
  organizationName: string
  admin: SupabaseClient
}): Promise<void> {
  const { admin, ...data } = params

  const html = buildPasswordResetHtml({
    userName: `${data.firstName} ${data.lastName}`,
    resetUrl: data.resetUrl,
    organizationName: data.organizationName,
  })

  await sendEmail({
    to: data.email,
    subject: `איפוס סיסמה — ${data.organizationName}`,
    html,
    organizationId: data.organizationId,
    userId: data.userId,
    appointmentId: null,
    templateName: 'password_reset',
    organizationName: data.organizationName,
  }, admin)
}
