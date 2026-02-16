import { formatDateTime, formatPrice, SPECIALTIES } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────

type SendWhatsAppParams = {
  to: string
  message: string
  organizationId: string
  userId: string
  appointmentId: string | null
  templateName: string
  variables?: Record<string, unknown>
}

type SendWhatsAppResult = {
  success: boolean
  messageId?: string
  error?: string
}

type AppointmentContext = {
  apt: {
    id: string
    organization_id: string
    patient_id: string
    doctor_id: string | null
    chief_complaint: string
    requested_specialty: string | null
    scheduled_at: string | null
    diagnosis: string | null
    follow_up_instructions: string | null
    payment_amount: number | null
    payment_status: string | null
    status: string
    created_at: string
  }
  patient: { id: string; email: string; first_name: string; last_name: string; phone: string | null; metadata: Record<string, unknown> }
  doctor: { id: string; first_name: string; last_name: string } | null
  org: { name: string; primary_color: string; features: Record<string, boolean>; settings: Record<string, unknown> } | null
}

// ── Helpers ──────────────────────────────────────────

function getSpecialtyLabel(id: string | null): string {
  if (!id) return ''
  return SPECIALTIES.find(s => s.id === id)?.label || id
}

/**
 * Convert Israeli phone number to international format for Infobip.
 * 0521234567 → 972521234567
 * +972521234567 → 972521234567
 */
function toInfobipPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  if (cleaned.startsWith('+972')) return cleaned.slice(1)
  if (cleaned.startsWith('972')) return cleaned
  if (cleaned.startsWith('0')) return `972${cleaned.slice(1)}`
  return cleaned
}

// ── Core Send Function ───────────────────────────────

export async function sendWhatsApp(
  params: SendWhatsAppParams,
  admin: SupabaseClient,
): Promise<SendWhatsAppResult> {
  const apiKey = process.env.INFOBIP_API_KEY
  const baseUrl = process.env.INFOBIP_BASE_URL
  const fromNumber = process.env.INFOBIP_WHATSAPP_NUMBER

  if (!apiKey || !baseUrl) {
    return { success: false, error: 'Infobip not configured' }
  }

  try {
    const res = await fetch(`${baseUrl}/whatsapp/1/message/text`, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to: toInfobipPhone(params.to),
        content: { text: params.message },
      }),
      signal: AbortSignal.timeout(15000),
    })

    const result = await res.json()
    const messageId = result?.messages?.[0]?.messageId || null

    // Record notification
    await admin.from('notifications').insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      appointment_id: params.appointmentId,
      type: 'whatsapp',
      template_name: params.templateName,
      content: params.message,
      variables: params.variables || null,
      recipient_phone: params.to,
      status: res.ok ? 'sent' : 'failed',
      sent_at: res.ok ? new Date().toISOString() : null,
      error_message: res.ok ? null : (result?.requestError?.serviceException?.text || 'Send failed'),
      provider: 'infobip',
      external_id: messageId,
    })

    if (!res.ok) {
      const errMsg = result?.requestError?.serviceException?.text || `HTTP ${res.status}`
      console.error('[WhatsApp]', errMsg)
      return { success: false, error: errMsg }
    }

    return { success: true, messageId }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'WhatsApp send failed'
    console.error('[WhatsApp]', errorMessage)

    try {
      await admin.from('notifications').insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        appointment_id: params.appointmentId,
        type: 'whatsapp',
        template_name: params.templateName,
        content: params.message,
        recipient_phone: params.to,
        status: 'failed',
        error_message: errorMessage,
        provider: 'infobip',
      })
    } catch { /* ignore audit failure */ }

    return { success: false, error: errorMessage }
  }
}

// ── Idempotency Check ────────────────────────────────

async function alreadySent(
  appointmentId: string,
  templateName: string,
  admin: SupabaseClient,
): Promise<boolean> {
  const { data } = await admin.from('notifications')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('template_name', templateName)
    .eq('type', 'whatsapp')
    .eq('status', 'sent')
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ── Fetch appointment context ────────────────────────

async function fetchContext(
  appointmentId: string,
  admin: SupabaseClient,
): Promise<AppointmentContext> {
  const { data: apt } = await admin.from('appointments')
    .select('id, organization_id, patient_id, doctor_id, chief_complaint, requested_specialty, scheduled_at, diagnosis, follow_up_instructions, payment_amount, payment_status, status, created_at')
    .eq('id', appointmentId)
    .single()

  if (!apt) throw new Error('Appointment not found')

  const { data: patient } = await admin.from('users')
    .select('id, email, first_name, last_name, phone, metadata')
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

  return {
    apt: apt as AppointmentContext['apt'],
    patient: patient as AppointmentContext['patient'],
    doctor,
    org: org as AppointmentContext['org'],
  }
}

// ── Check WhatsApp eligibility ───────────────────────

function isWhatsAppEligible(context: AppointmentContext): { eligible: boolean; phone: string | null } {
  const { patient, org } = context
  const features = (org?.features || {}) as Record<string, boolean>

  // Org must have whatsapp_notifications enabled
  if (!features.whatsapp_notifications) return { eligible: false, phone: null }

  // Patient must have a phone number
  if (!patient.phone) return { eligible: false, phone: null }

  // Patient must have opted in
  const metadata = (patient.metadata || {}) as Record<string, unknown>
  if (metadata.whatsapp_opt_in !== true) return { eligible: false, phone: null }

  return { eligible: true, phone: patient.phone }
}

// ── Message Templates (Hebrew) ───────────────────────

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function buildAppointmentConfirmation(context: AppointmentContext): string {
  const { apt, patient, doctor, org } = context
  const orgName = org?.name || 'טלמדיסן'
  const specialtyLabel = getSpecialtyLabel(apt.requested_specialty)
  const doctorLine = doctor
    ? `ד"ר ${doctor.first_name} ${doctor.last_name}`
    : 'ישובץ בהקדם'

  return [
    `שלום ${patient.first_name},`,
    ``,
    `בקשת התור שלך ב${orgName} התקבלה בהצלחה!`,
    ``,
    specialtyLabel ? `התמחות: ${specialtyLabel}` : null,
    `רופא: ${doctorLine}`,
    `תלונה: ${apt.chief_complaint}`,
    ``,
    `תקבל/י הודעה נוספת כשהרופא יאשר את התור.`,
    ``,
    `לצפייה בפרטי התור:`,
    `${APP_URL()}/dashboard/patient/dashboard`,
  ].filter(Boolean).join('\n')
}

function buildReminder1h(context: AppointmentContext): string {
  const { apt, patient, doctor, org } = context
  const orgName = org?.name || 'טלמדיסן'
  const specialtyLabel = getSpecialtyLabel(apt.requested_specialty)

  return [
    `שלום ${patient.first_name},`,
    ``,
    `התור שלך ב${orgName} מתחיל בעוד שעה!`,
    ``,
    `מועד: ${formatDateTime(apt.scheduled_at!)}`,
    doctor ? `רופא: ד"ר ${doctor.first_name} ${doctor.last_name}` : null,
    specialtyLabel ? `התמחות: ${specialtyLabel}` : null,
    ``,
    `לפני השיחה:`,
    `- ודא/י חיבור אינטרנט יציב`,
    `- בדוק/י שהמצלמה והמיקרופון עובדים`,
    `- שב/י במקום שקט ומואר`,
    ``,
    `קישור לשיחת הווידאו:`,
    `${APP_URL()}/video-call?id=${apt.id}`,
  ].filter(Boolean).join('\n')
}

function buildVideoCallLink(context: AppointmentContext): string {
  const { apt, patient, doctor, org } = context
  const orgName = org?.name || 'טלמדיסן'

  return [
    `שלום ${patient.first_name},`,
    ``,
    `שיחת הווידאו שלך ב${orgName} מוכנה!`,
    doctor ? `רופא: ד"ר ${doctor.first_name} ${doctor.last_name}` : null,
    ``,
    `הצטרף/י עכשיו:`,
    `${APP_URL()}/video-call?id=${apt.id}`,
  ].filter(Boolean).join('\n')
}

function buildPaymentConfirmation(context: AppointmentContext): string {
  const { apt, patient, org } = context
  const orgName = org?.name || 'טלמדיסן'
  const amount = apt.payment_amount ? formatPrice(apt.payment_amount) : ''

  return [
    `שלום ${patient.first_name},`,
    ``,
    `התשלום שלך ב${orgName} התקבל בהצלחה!`,
    amount ? `סכום: ${amount}` : null,
    ``,
    `התור שלך אושר ומתוזמן.`,
    apt.scheduled_at ? `מועד: ${formatDateTime(apt.scheduled_at)}` : null,
    ``,
    `לצפייה בפרטים:`,
    `${APP_URL()}/dashboard/patient/dashboard`,
  ].filter(Boolean).join('\n')
}

// ── High-Level Send Functions ────────────────────────

export async function sendAppointmentConfirmationWhatsApp(params: {
  appointmentId: string
  admin: SupabaseClient
}): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'wa_appointment_confirmation'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const context = await fetchContext(appointmentId, admin)
  const { eligible, phone } = isWhatsAppEligible(context)
  if (!eligible || !phone) return

  const message = buildAppointmentConfirmation(context)

  await sendWhatsApp({
    to: phone,
    message,
    organizationId: context.apt.organization_id,
    userId: context.patient.id,
    appointmentId,
    templateName,
    variables: {
      specialty: context.apt.requested_specialty,
      complaint: context.apt.chief_complaint,
    },
  }, admin)
}

export async function sendReminder1hWhatsApp(params: {
  appointmentId: string
  admin: SupabaseClient
}): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'wa_reminder_1h'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const context = await fetchContext(appointmentId, admin)
  if (!context.doctor || !context.apt.scheduled_at) return

  const { eligible, phone } = isWhatsAppEligible(context)
  if (!eligible || !phone) return

  const message = buildReminder1h(context)

  await sendWhatsApp({
    to: phone,
    message,
    organizationId: context.apt.organization_id,
    userId: context.patient.id,
    appointmentId,
    templateName,
    variables: {
      scheduled_at: context.apt.scheduled_at,
      video_url: `${APP_URL()}/video-call?id=${appointmentId}`,
    },
  }, admin)
}

export async function sendVideoCallLinkWhatsApp(params: {
  appointmentId: string
  admin: SupabaseClient
}): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'wa_video_call_link'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const context = await fetchContext(appointmentId, admin)
  const { eligible, phone } = isWhatsAppEligible(context)
  if (!eligible || !phone) return

  const message = buildVideoCallLink(context)

  await sendWhatsApp({
    to: phone,
    message,
    organizationId: context.apt.organization_id,
    userId: context.patient.id,
    appointmentId,
    templateName,
    variables: {
      video_url: `${APP_URL()}/video-call?id=${appointmentId}`,
    },
  }, admin)
}

export async function sendPaymentConfirmationWhatsApp(params: {
  appointmentId: string
  admin: SupabaseClient
}): Promise<void> {
  const { appointmentId, admin } = params
  const templateName = 'wa_payment_confirmation'

  if (await alreadySent(appointmentId, templateName, admin)) return

  const context = await fetchContext(appointmentId, admin)
  const { eligible, phone } = isWhatsAppEligible(context)
  if (!eligible || !phone) return

  const message = buildPaymentConfirmation(context)

  await sendWhatsApp({
    to: phone,
    message,
    organizationId: context.apt.organization_id,
    userId: context.patient.id,
    appointmentId,
    templateName,
    variables: {
      amount: context.apt.payment_amount,
    },
  }, admin)
}
