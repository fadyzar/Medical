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
 * Convert Israeli phone number to Green API chatId format.
 * 0521234567  → 972521234567@c.us
 * +972521234567 → 972521234567@c.us
 */
function toGreenApiChatId(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  let number: string
  if (cleaned.startsWith('+972')) number = cleaned.slice(1)
  else if (cleaned.startsWith('972')) number = cleaned
  else if (cleaned.startsWith('0')) number = `972${cleaned.slice(1)}`
  else number = cleaned
  return `${number}@c.us`
}

// ── Green API response handling ──────────────────────
// Green API answers bad credentials with HTTP 401 and an EMPTY body, so a bare
// res.json() threw and the clinic saw "internal error" instead of the cause.

export function greenApiErrorMessage(status: number, body: { message?: string } | null): string {
  if (status === 401 || status === 403) {
    return 'Green API דחה את הפרטים: ה-Instance ID או ה-Token שגויים, או שה-instance לא מחובר ל-WhatsApp (יש לסרוק QR)'
  }
  if (status === 466) return 'מכסת ההודעות של חשבון ה-Green API הסתיימה'
  if (status === 429) return 'Green API מגביל כרגע את קצב השליחה. נסה שוב בעוד דקה'
  if (status >= 500) return 'שירות Green API אינו זמין כרגע. נסה שוב מאוחר יותר'
  return body?.message || `Green API החזיר שגיאה (${status})`
}

export async function readGreenApiResponse(res: Response): Promise<{ ok: boolean; idMessage: string | null; error: string | null }> {
  const text = await res.text()
  let body: { idMessage?: string; message?: string } | null = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (!res.ok) return { ok: false, idMessage: null, error: greenApiErrorMessage(res.status, body) }
  return { ok: true, idMessage: body?.idMessage ?? null, error: null }
}

// ── Green API endpoint ───────────────────────────────

/**
 * Green API endpoint for an instance. Each instance is served from its own
 * pool host, https://{first 4 digits of the instance id}.api.greenapi.com (the
 * apiUrl shown in console.green-api.com). The old api.green-api.com host no
 * longer answers and the general api.greenapi.com host hangs, which made every
 * WhatsApp send fail. GREEN_API_URL overrides the host when set.
 */
export function greenApiUrl(instanceId: string, method: string, apiToken: string): string {
  const id = instanceId.trim()
  const base = (process.env.GREEN_API_URL
    || (/^\d{10}$/.test(id) ? `https://${id.slice(0, 4)}.api.greenapi.com` : 'https://api.greenapi.com')
  ).replace(/\/+$/, '')
  return `${base}/waInstance${id}/${method}/${apiToken}`
}

// ── Fetch Green API credentials for an org ───────────

export async function getOrgGreenApiCredentials(
  organizationId: string,
  admin: SupabaseClient,
): Promise<{ instanceId: string; apiToken: string } | null> {
  // Integration secrets live in organization_integrations (admin-only RLS).
  // Runtime reads them via the service-role client, so behavior is unchanged.
  const { data: row } = await admin
    .from('organization_integrations')
    .select('secrets')
    .eq('organization_id', organizationId)
    .maybeSingle()

  const secrets = (row?.secrets || {}) as Record<string, Record<string, string>>
  const wa = secrets['integration_whatsapp'] || {}
  const instanceId = wa['green_api_instance_id']?.trim()
  const apiToken   = wa['green_api_token']?.trim()

  if (!instanceId || !apiToken) return null
  return { instanceId, apiToken }
}

// ── Core Send Function (Green API) ───────────────────

export async function sendWhatsApp(
  params: SendWhatsAppParams,
  admin: SupabaseClient,
): Promise<SendWhatsAppResult> {
  // Read credentials from org settings (per-clinic)
  const creds = await getOrgGreenApiCredentials(params.organizationId, admin)

  if (!creds) {
    return { success: false, error: 'Green API not configured for this organization' }
  }

  const { instanceId, apiToken } = creds
  const url = greenApiUrl(instanceId, 'sendMessage', apiToken)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: toGreenApiChatId(params.to),
        message: params.message,
      }),
      signal: AbortSignal.timeout(15000),
    })

    const result = await readGreenApiResponse(res)
    const messageId: string | null = result.idMessage

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
      status: result.ok ? 'sent' : 'failed',
      sent_at: result.ok ? new Date().toISOString() : null,
      error_message: result.error,
      provider: 'green-api',
      external_id: messageId,
    })

    if (!result.ok) {
      console.error('[WhatsApp/GreenAPI]', res.status)
      return { success: false, error: result.error ?? `HTTP ${res.status}` }
    }

    return { success: true, messageId: messageId ?? undefined }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'WhatsApp send failed'
    console.error('[WhatsApp/GreenAPI]', errorMessage)

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
        provider: 'green-api',
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
  const orgName = org?.name || 'CANNA'
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
  const orgName = org?.name || 'CANNA'
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
  const orgName = org?.name || 'CANNA'

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
  const orgName = org?.name || 'CANNA'
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
