/**
 * Central Notification Hub
 * Sends WhatsApp (Green API) + in-app notification for every system event.
 * Email is also sent if RESEND_API_KEY is configured.
 *
 * Usage:
 *   import { notify } from '@/lib/notifications'
 *   await notify('appointment_scheduled', appointmentId, adminClient)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDateTime, formatPrice, SPECIALTIES } from '@/lib/utils'

// ── Event types ───────────────────────────────────────────────────

export type NotificationEvent =
  | 'appointment_created'       // patient created appointment
  | 'appointment_confirmed'     // doctor accepted the request
  | 'appointment_scheduled'     // doctor set date + time
  | 'payment_reminder'          // appointment awaiting payment
  | 'payment_success'           // patient paid
  | 'reminder_24h'              // 24h before appointment
  | 'reminder_1h'               // 1h before appointment (with video link)
  | 'appointment_completed'     // doctor ended consultation
  | 'consultation_summary'      // doctor sends SOAP/AI summary
  | 'appointment_cancelled'     // appointment was cancelled
  | 'doctor_new_request'        // doctor gets notified of new patient request

// ── Appointment context (loaded once per notify call) ─────────────

type AptContext = {
  id: string
  organization_id: string
  patient_id: string
  doctor_id: string | null
  chief_complaint: string
  requested_specialty: string | null
  scheduled_at: string | null
  payment_amount: number | null
  payment_status: string | null
  status: string
  ai_summary: string | null
  subjective_notes: string | null
  assessment: string | null
  plan: string | null
  diagnosis: string | null
  follow_up_instructions: string | null
  appointment_type: string | null
  patient: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null } | null
  doctor: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null } | null
  org: { name: string; settings: Record<string, unknown> } | null
}

async function loadContext(appointmentId: string, admin: SupabaseClient): Promise<AptContext | null> {
  const { data } = await admin
    .from('appointments')
    .select(`
      id, organization_id, patient_id, doctor_id, chief_complaint,
      requested_specialty, scheduled_at, payment_amount, payment_status,
      status, ai_summary, subjective_notes, assessment, plan,
      diagnosis, follow_up_instructions, appointment_type,
      patient:patient_id(id, first_name, last_name, phone, email),
      doctor:doctor_id(id, first_name, last_name, phone, email),
      org:organization_id(name, settings)
    `)
    .eq('id', appointmentId)
    .single()

  return data as unknown as AptContext | null
}

function specialtyLabel(id: string | null): string {
  if (!id) return ''
  return SPECIALTIES.find(s => s.id === id)?.label || id
}

function videoUrl(appointmentId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/video-call?id=${appointmentId}`
}

function dashboardUrl(role: 'patient' | 'doctor'): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/dashboard/${role}/appointments`
}

// ── Template builder ──────────────────────────────────────────────

type Template = {
  whatsapp: string
  inAppTitle: string
  inAppBody: string
  emailSubject?: string
  recipientRole: 'patient' | 'doctor'
}

function buildTemplate(event: NotificationEvent, ctx: AptContext): Template | null {
  const p = ctx.patient
  const d = ctx.doctor
  const org = ctx.org?.name || 'המרפאה'
  const specialty = specialtyLabel(ctx.requested_specialty)
  const scheduledStr = ctx.scheduled_at ? formatDateTime(ctx.scheduled_at) : ''
  const price = ctx.payment_amount ? formatPrice(ctx.payment_amount) : ''
  const aptType = ctx.appointment_type === 'clinic' ? 'ביקור במרפאה' : 'ייעוץ וידאו'

  const patientName = p ? `${p.first_name} ${p.last_name}` : 'המטופל'
  const doctorName  = d ? `ד"ר ${d.first_name} ${d.last_name}` : 'הרופא'

  switch (event) {

    case 'appointment_created':
      return {
        recipientRole: 'patient',
        inAppTitle: 'הבקשה נשלחה בהצלחה',
        inAppBody: `בקשת ${aptType} בהתמחות ${specialty || 'כללי'} נשלחה. נעדכן אותך ברגע שהרופא יאשר.`,
        emailSubject: `אישור קבלת בקשה — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! 👋\n\n` +
          `✅ *בקשת ${aptType} התקבלה*\n` +
          `📋 תלונה: ${ctx.chief_complaint}\n` +
          `🏥 התמחות: ${specialty || 'כללי'}\n\n` +
          `נעדכן אותך ברגע שהרופא יאשר.\n` +
          `📲 לצפייה: ${dashboardUrl('patient')}`,
      }

    case 'appointment_confirmed':
      return {
        recipientRole: 'patient',
        inAppTitle: 'הרופא אישר את הבקשה',
        inAppBody: `${doctorName} אישר את בקשת הייעוץ שלך. ${price ? `יש לשלם ${price} לאישור מועד.` : 'בקרוב יתאם מועד.'}`,
        emailSubject: `הרופא אישר את הבקשה — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! 🎉\n\n` +
          `✅ *${doctorName} אישר את בקשתך*\n` +
          `📋 ${ctx.chief_complaint}\n` +
          (price ? `💳 יש לשלם ${price} לאישור מועד\n` : '') +
          `\n📲 לפרטים: ${dashboardUrl('patient')}`,
      }

    case 'appointment_scheduled':
      return {
        recipientRole: 'patient',
        inAppTitle: 'נקבע מועד לייעוץ שלך',
        inAppBody: `${doctorName} קבע את הייעוץ ל${scheduledStr}. ${price ? `יש לשלם ${price} לאישור.` : ''}`,
        emailSubject: `מועד הייעוץ נקבע — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! 📅\n\n` +
          `*מועד ${aptType} נקבע!*\n\n` +
          `👨‍⚕️ רופא: ${doctorName}\n` +
          `📅 מועד: ${scheduledStr}\n` +
          `💊 תלונה: ${ctx.chief_complaint}\n` +
          (price ? `💳 לתשלום: ${price}\n` : '') +
          `\n📲 ${dashboardUrl('patient')}`,
      }

    case 'payment_reminder':
      return {
        recipientRole: 'patient',
        inAppTitle: 'נדרש תשלום לאישור הייעוץ',
        inAppBody: `יש לשלם ${price} כדי לאשר את הייעוץ עם ${doctorName}.`,
        emailSubject: `נדרש תשלום — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! ⏰\n\n` +
          `💳 *נדרש תשלום לאישור הייעוץ*\n\n` +
          `👨‍⚕️ ${doctorName}\n` +
          `💰 לתשלום: ${price}\n\n` +
          `📲 לתשלום: ${dashboardUrl('patient')}`,
      }

    case 'payment_success':
      return {
        recipientRole: 'patient',
        inAppTitle: 'התשלום בוצע — הייעוץ מאושר! ✅',
        inAppBody: `שולם ${price} בהצלחה. הייעוץ עם ${doctorName} מאושר ב${scheduledStr || 'תאריך שייקבע'}.`,
        emailSubject: `אישור תשלום — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! 🎉\n\n` +
          `✅ *התשלום בוצע בהצלחה!*\n` +
          `💰 שולם: ${price}\n` +
          `👨‍⚕️ ${doctorName}\n` +
          (scheduledStr ? `📅 מועד: ${scheduledStr}\n` : '') +
          `\n📲 לפרטי הייעוץ: ${dashboardUrl('patient')}`,
      }

    case 'reminder_24h':
      return {
        recipientRole: 'patient',
        inAppTitle: 'תזכורת: ייעוץ מחר',
        inAppBody: `תזכורת: ${aptType} עם ${doctorName} מחר ב${scheduledStr}.`,
        emailSubject: `תזכורת לייעוץ מחר — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! ⏰\n\n` +
          `*תזכורת: ${aptType} מחר!*\n\n` +
          `👨‍⚕️ ${doctorName}\n` +
          `📅 ${scheduledStr}\n\n` +
          (ctx.appointment_type !== 'clinic'
            ? `🎥 מחר לפני הייעוץ תקבל קישור כניסה.\n`
            : '') +
          `📲 ${dashboardUrl('patient')}`,
      }

    case 'reminder_1h':
      return {
        recipientRole: 'patient',
        inAppTitle: 'ייעוץ בעוד שעה! 🕐',
        inAppBody: `הייעוץ עם ${doctorName} בעוד שעה. לחץ להצטרפות.`,
        emailSubject: `הייעוץ שלך בעוד שעה — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! 🕐\n\n` +
          `*הייעוץ שלך בעוד שעה!*\n\n` +
          `👨‍⚕️ ${doctorName}\n` +
          `📅 ${scheduledStr}\n\n` +
          (ctx.appointment_type !== 'clinic'
            ? `🎥 *קישור לשיחה:*\n${videoUrl(ctx.id)}\n`
            : '') +
          `\nהיה מוכן מראש 💪`,
      }

    case 'appointment_completed':
      return {
        recipientRole: 'patient',
        inAppTitle: 'הייעוץ הסתיים',
        inAppBody: `הייעוץ עם ${doctorName} הסתיים. ${ctx.diagnosis ? `אבחנה: ${ctx.diagnosis}.` : ''} ${ctx.follow_up_instructions ? ctx.follow_up_instructions : ''}`,
        emailSubject: `סיכום הייעוץ — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! ✅\n\n` +
          `*הייעוץ עם ${doctorName} הסתיים*\n\n` +
          (ctx.diagnosis ? `📋 אבחנה: ${ctx.diagnosis}\n` : '') +
          (ctx.follow_up_instructions ? `📌 המשך טיפול: ${ctx.follow_up_instructions}\n` : '') +
          `\n📲 לסיכום מלא: ${dashboardUrl('patient')}`,
      }

    case 'consultation_summary': {
      const summaryText = buildSummaryNaturalText(ctx)
      return {
        recipientRole: 'patient',
        inAppTitle: `סיכום ייעוץ מ${doctorName}`,
        inAppBody: summaryText,
        emailSubject: `סיכום ייעוץ רפואי — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}! 📋\n\n` +
          `*סיכום הייעוץ שלך מ${doctorName}:*\n\n` +
          summaryText.slice(0, 900) +
          (summaryText.length > 900 ? '...\n\n📲 לסיכום מלא: ' + dashboardUrl('patient') : ''),
      }
    }

    case 'appointment_cancelled':
      return {
        recipientRole: 'patient',
        inAppTitle: 'הייעוץ בוטל',
        inAppBody: `הייעוץ ב${scheduledStr || 'תאריך שנקבע'} עם ${doctorName} בוטל.`,
        emailSubject: `הייעוץ בוטל — ${org}`,
        whatsapp:
          `שלום ${p?.first_name || ''}!\n\n` +
          `❌ *הייעוץ בוטל*\n\n` +
          `👨‍⚕️ ${doctorName}\n` +
          (scheduledStr ? `📅 ${scheduledStr}\n` : '') +
          `\nלקביעת תור חדש: ${dashboardUrl('patient')}`,
      }

    case 'doctor_new_request':
      return {
        recipientRole: 'doctor',
        inAppTitle: 'בקשת ייעוץ חדשה',
        inAppBody: `${patientName} ביקש ${aptType} בנושא: ${ctx.chief_complaint}`,
        emailSubject: `בקשת ייעוץ חדשה — ${org}`,
        whatsapp:
          `שלום ${d?.first_name || ''}! 🩺\n\n` +
          `*בקשת ${aptType} חדשה!*\n\n` +
          `👤 מטופל: ${patientName}\n` +
          `📋 תלונה: ${ctx.chief_complaint}\n` +
          (specialty ? `🏥 התמחות: ${specialty}\n` : '') +
          `\n📲 לפרטים: ${dashboardUrl('doctor')}`,
      }

    default:
      return null
  }
}

// ── Summary text builder ──────────────────────────────────────────

function buildSummaryNaturalText(ctx: AptContext): string {
  const lines: string[] = []
  if (ctx.diagnosis) lines.push(`אבחנה: ${ctx.diagnosis}`)
  if (ctx.assessment) lines.push(`הערכה: ${ctx.assessment}`)
  if (ctx.plan) lines.push(`תוכנית טיפול: ${ctx.plan}`)
  if (ctx.follow_up_instructions) lines.push(`המשך טיפול: ${ctx.follow_up_instructions}`)

  // Try AI summary (may be JSON)
  if (ctx.ai_summary) {
    try {
      const parsed = JSON.parse(ctx.ai_summary)
      if (parsed.summary && !lines.length) lines.push(parsed.summary)
      if (parsed.diagnosis && !ctx.diagnosis) lines.push(`אבחנה: ${parsed.diagnosis}`)
      if (parsed.treatment_plan && !ctx.plan) lines.push(`תוכנית: ${parsed.treatment_plan}`)
      if (parsed.follow_up && !ctx.follow_up_instructions) lines.push(`המשך: ${parsed.follow_up}`)
      if (parsed.medications?.length) lines.push(`תרופות: ${(parsed.medications as string[]).join(', ')}`)
    } catch {
      if (!lines.length) lines.push(ctx.ai_summary)
    }
  }

  if (ctx.subjective_notes && !lines.length) lines.push(ctx.subjective_notes)
  return lines.join('\n') || 'הייעוץ הסתיים. פנה לרופא לפרטים נוספים.'
}

// ── Core: notify() ────────────────────────────────────────────────

export async function notify(
  event: NotificationEvent,
  appointmentId: string,
  admin: SupabaseClient,
  options?: { extraContent?: string }
): Promise<{ ok: boolean; whatsapp?: boolean; inApp?: boolean; email?: boolean }> {
  try {
    const ctx = await loadContext(appointmentId, admin)
    if (!ctx) return { ok: false }

    const tpl = buildTemplate(event, ctx)
    if (!tpl) return { ok: false }

    const isForPatient = tpl.recipientRole === 'patient'
    const recipient = isForPatient ? ctx.patient : ctx.doctor
    if (!recipient) return { ok: false }

    const content = options?.extraContent
      ? `${tpl.inAppBody}\n\n${options.extraContent}`
      : tpl.inAppBody

    const results = { ok: true, whatsapp: false, inApp: false, email: false }

    // 1. In-app notification (always)
    const { error: notifErr } = await admin.from('notifications').insert({
      organization_id: ctx.organization_id,
      user_id: recipient.id,
      appointment_id: appointmentId,
      type: 'in_app',
      title: tpl.inAppTitle,
      content,
      status: 'sent',
      sent_at: new Date().toISOString(),
      template_name: event,
      recipient_email: recipient.email || null,
    })
    results.inApp = !notifErr

    // 2. WhatsApp (if phone available)
    if (recipient.phone) {
      try {
        const { sendWhatsApp } = await import('@/lib/whatsapp')
        const waResult = await sendWhatsApp({
          to: recipient.phone,
          message: tpl.whatsapp,
          organizationId: ctx.organization_id,
          userId: recipient.id,
          appointmentId,
          templateName: event,
        }, admin)
        results.whatsapp = waResult.success
      } catch {
        // WhatsApp failure is non-critical
      }
    }

    // 3. Email (if RESEND_API_KEY configured + email available)
    if (recipient.email && process.env.RESEND_API_KEY && tpl.emailSubject) {
      try {
        const emailFn = isForPatient
          ? (await import('@/lib/email')).sendConsultationSummary
          : null

        // Use generic email for events that don't have dedicated email functions
        const { sendEmail } = await import('@/lib/email')
        await sendEmail({
          to: recipient.email,
          subject: tpl.emailSubject,
          html: buildSimpleEmailHtml(tpl.inAppTitle, content, appointmentId, isForPatient),
          organizationId: ctx.organization_id,
          userId: recipient.id,
          appointmentId,
          templateName: event,
          organizationName: ctx.org?.name || 'הפלטפורמה',
        }, admin)

        void emailFn // suppress unused warning
        results.email = true
      } catch {
        // Email failure is non-critical
      }
    }

    return results
  } catch (err) {
    console.error('[notify]', event, err)
    return { ok: false }
  }
}

// ── Batch: notify multiple events at once ────────────────────────

export async function notifyBatch(
  events: NotificationEvent[],
  appointmentId: string,
  admin: SupabaseClient
) {
  return Promise.all(events.map(e => notify(e, appointmentId, admin)))
}

// ── Simple email HTML ─────────────────────────────────────────────

function buildSimpleEmailHtml(title: string, body: string, appointmentId: string, isPatient: boolean): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = `${base}/dashboard/${isPatient ? 'patient' : 'doctor'}/appointments`
  return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${title}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#1f2937;font-size:15px;line-height:1.7;">
          <pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:0;">${body}</pre>
        </td></tr>
        <tr><td style="padding:0 32px 28px;text-align:center;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
            ${isPatient ? 'לתורים שלי' : 'לניהול תורים'}
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">הודעה אוטומטית — אין להשיב להודעה זו.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
