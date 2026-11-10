/**
 * Transactional messages for the approval lifecycle.
 *
 * Deliberately free of medical content: no complaint, no description, no
 * diagnosis, no rejection reason (free text a doctor may write clinically).
 * Only clinic, doctor, patient name, date, time, timezone, visit type and
 * payment state.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatInTimeZone } from 'date-fns-tz'
import { sendEmail, wrapEmailHtml, alreadySent } from '@/lib/email'
import { WAITING_ROOM_OPENS_MIN } from '@/lib/video/access'

export type LifecycleTemplate =
  | 'appointment_request_doctor'     // doctor: a request awaits approval
  | 'appointment_request_received'   // patient: request received, awaiting doctor
  | 'appointment_approved'           // patient: confirmed
  | 'appointment_rejected'           // patient: rejected
  | 'appointment_refund_initiated'   // patient: refund in process
  | 'appointment_refund_completed'   // patient: refund done

type Ctx = {
  apt: {
    id: string; organization_id: string; patient_id: string; doctor_id: string | null
    scheduled_at: string | null; duration_minutes: number | null; timezone: string | null
    appointment_type: string | null; payment_amount: number | null; payment_status: string | null
    payment_collection: string | null; refund_status: string | null
  }
  patient: { id: string; email: string | null; first_name: string; last_name: string } | null
  doctor: { id: string; email: string | null; first_name: string; last_name: string } | null
  org: { name: string; primary_color: string | null } | null
}

async function loadCtx(appointmentId: string, admin: SupabaseClient): Promise<Ctx | null> {
  const { data: apt } = await admin.from('appointments')
    .select('id, organization_id, patient_id, doctor_id, scheduled_at, duration_minutes, timezone, appointment_type, payment_amount, payment_status, payment_collection, refund_status')
    .eq('id', appointmentId).maybeSingle()
  if (!apt) return null
  const a = apt as Ctx['apt']
  const ids = [a.patient_id, a.doctor_id].filter(Boolean) as string[]
  const [{ data: people }, { data: org }] = await Promise.all([
    admin.from('users').select('id, email, first_name, last_name').in('id', ids),
    admin.from('organizations').select('name, primary_color').eq('id', a.organization_id).maybeSingle(),
  ])
  const list = (people || []) as Array<NonNullable<Ctx['patient']>>
  return {
    apt: a,
    patient: list.find(p => p.id === a.patient_id) || null,
    doctor: a.doctor_id ? list.find(p => p.id === a.doctor_id) || null : null,
    org: (org as Ctx['org']) || null,
  }
}

export function formatAppointmentTime(iso: string, timezone: string | null) {
  const tz = timezone || 'Asia/Jerusalem'
  return {
    date: formatInTimeZone(new Date(iso), tz, 'dd/MM/yyyy'),
    time: formatInTimeZone(new Date(iso), tz, 'HH:mm'),
    tzLabel: tz === 'Asia/Jerusalem' ? 'שעון ישראל' : tz,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function paymentLine(c: Ctx['apt']): string {
  if (c.payment_collection === 'online') {
    return c.payment_status === 'completed' ? 'שולם ואומת' : 'ממתין לתשלום'
  }
  if (c.payment_collection === 'clinic') return 'יוסדר מול המרפאה (לא נגבה תשלום מקוון)'
  if (c.payment_collection === 'none') return 'ללא תשלום'
  return '—'
}

function rows(items: Array<[string, string]>): string {
  return items.map(([k, v]) => `<p style="margin:0 0 8px;"><strong>${k}:</strong> ${escapeHtml(v)}</p>`).join('')
}

function build(template: LifecycleTemplate, ctx: Ctx, origin: string) {
  const orgName = ctx.org?.name || 'המרפאה'
  const doctorName = ctx.doctor ? `ד"ר ${ctx.doctor.first_name} ${ctx.doctor.last_name}` : 'הרופא'
  const patientName = ctx.patient ? `${ctx.patient.first_name} ${ctx.patient.last_name}` : 'מטופל/ת'
  const when = ctx.apt.scheduled_at ? formatAppointmentTime(ctx.apt.scheduled_at, ctx.apt.timezone) : null
  const visitType = ctx.apt.appointment_type === 'clinic' ? 'ביקור במרפאה' : 'ייעוץ וידאו'
  const timeRows: Array<[string, string]> = when
    ? [['תאריך', when.date], ['שעה', `${when.time} (${when.tzLabel})`]]
    : [['מועד', 'טרם נקבע']]

  switch (template) {
    case 'appointment_request_doctor':
      return {
        to: ctx.doctor, subject: `בקשת תור חדשה ממתינה לאישורך — ${orgName}`,
        cta: { url: `${origin}/dashboard/doctor/dashboard#pending-requests`, text: 'לבקשות הממתינות' },
        body: `<p style="margin:0 0 16px;">שלום ${escapeHtml(doctorName)},</p>
          <p style="margin:0 0 16px;">התקבלה בקשת תור חדשה הממתינה לאישורך.</p>
          ${rows([['מרפאה', orgName], ['מטופל/ת', patientName], ...timeRows, ['סוג', visitType], ['תשלום', paymentLine(ctx.apt)]])}
          <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">התור ייקבע רק לאחר אישורך בלוח הבקרה.</p>`,
      }
    case 'appointment_request_received':
      return {
        to: ctx.patient, subject: `בקשתך התקבלה וממתינה לאישור הרופא — ${orgName}`,
        cta: { url: `${origin}/dashboard/patient/appointments`, text: 'לתורים שלי' },
        body: `<p style="margin:0 0 16px;">שלום ${escapeHtml(patientName)},</p>
          <p style="margin:0 0 16px;">בקשת התור שלך התקבלה והועברה לאישור הרופא. נעדכן אותך במייל ברגע שתאושר.</p>
          ${rows([['מרפאה', orgName], ['רופא/ה', doctorName], ...timeRows, ['סוג', visitType], ['תשלום', paymentLine(ctx.apt)]])}
          <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">התור אינו סופי עד לאישור הרופא.</p>`,
      }
    case 'appointment_approved':
      return {
        to: ctx.patient, subject: `התור שלך אושר — ${orgName}`,
        cta: { url: `${origin}/dashboard/patient/appointments`, text: 'לפרטי התור' },
        body: `<p style="margin:0 0 16px;">שלום ${escapeHtml(patientName)},</p>
          <p style="margin:0 0 16px;">${escapeHtml(doctorName)} אישר/ה את התור שלך.</p>
          ${rows([['מרפאה', orgName], ['רופא/ה', doctorName], ...timeRows, ['סוג', visitType]])}
          ${ctx.apt.appointment_type === 'clinic' ? '' : `<p style="margin:16px 0 0;">חדר ההמתנה לשיחת הווידאו ייפתח ${WAITING_ROOM_OPENS_MIN} דקות לפני מועד התור, דרך עמוד "התורים שלי".</p>`}`,
      }
    case 'appointment_rejected': {
      const refund = ctx.apt.refund_status === 'pending'
      return {
        to: ctx.patient, subject: `בקשת התור לא אושרה — ${orgName}`,
        cta: { url: `${origin}/dashboard/patient/new-appointment`, text: 'לקביעת תור חדש' },
        body: `<p style="margin:0 0 16px;">שלום ${escapeHtml(patientName)},</p>
          <p style="margin:0 0 16px;">לצערנו בקשת התור שלך לא אושרה על ידי ${escapeHtml(doctorName)}. המועד שוחרר.</p>
          ${rows([['מרפאה', orgName], ...timeRows])}
          ${refund ? '<p style="margin:16px 0 0;">התשלום שבוצע יוחזר אליך. תקבל/י הודעה נפרדת על תהליך ההחזר.</p>' : ''}
          <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">פרטים נוספים זמינים בעמוד "התורים שלי". ניתן לקבוע תור במועד אחר.</p>`,
      }
    }
    case 'appointment_refund_initiated':
      return {
        to: ctx.patient, subject: `החזר כספי בטיפול — ${orgName}`,
        cta: { url: `${origin}/dashboard/patient/appointments`, text: 'לתורים שלי' },
        body: `<p style="margin:0 0 16px;">שלום ${escapeHtml(patientName)},</p>
          <p style="margin:0 0 16px;">נפתחה בקשת החזר עבור התשלום על התור שלא אושר. המרפאה תבצע את ההחזר לאמצעי התשלום המקורי.</p>
          ${rows([['מרפאה', orgName], ...timeRows])}
          <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">זמן הופעת ההחזר בחשבון תלוי בחברת האשראי.</p>`,
      }
    case 'appointment_refund_completed':
      return {
        to: ctx.patient, subject: `ההחזר הכספי בוצע — ${orgName}`,
        cta: { url: `${origin}/dashboard/patient/appointments`, text: 'לתורים שלי' },
        body: `<p style="margin:0 0 16px;">שלום ${escapeHtml(patientName)},</p>
          <p style="margin:0 0 16px;">המרפאה ביצעה החזר לאמצעי התשלום המקורי עבור התור${ctx.apt.payment_amount ? ` (₪${ctx.apt.payment_amount})` : ''}.</p>
          ${rows([['מרפאה', orgName], ...timeRows])}
          <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">זמן הופעת ההחזר בחשבון תלוי בחברת האשראי.</p>`,
      }
  }
}

/**
 * Send one lifecycle email (and an in-app notification). Best-effort: never
 * throws. Idempotent per appointment + template once a send is recorded.
 */
export async function sendLifecycleEmail(
  template: LifecycleTemplate,
  appointmentId: string,
  admin: SupabaseClient,
  origin?: string,
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (await alreadySent(appointmentId, template, admin)) return { sent: false, reason: 'already_sent' }
    const ctx = await loadCtx(appointmentId, admin)
    if (!ctx) return { sent: false, reason: 'not_found' }
    const base = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cannaforyou.net').replace(/\/$/, '')
    const msg = build(template, ctx, base)
    if (!msg.to) return { sent: false, reason: 'no_recipient' }

    // In-app notification (no medical content either).
    try {
      await admin.from('notifications').insert({
        organization_id: ctx.apt.organization_id,
        user_id: msg.to.id,
        appointment_id: appointmentId,
        type: 'in_app',
        title: msg.subject.split(' — ')[0],
        content: msg.subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
        template_name: template,
        recipient_email: msg.to.email,
      })
    } catch { /* non-critical */ }

    if (!msg.to.email) return { sent: false, reason: 'no_email' }
    const html = wrapEmailHtml({
      content: msg.body,
      ctaUrl: msg.cta.url,
      ctaText: msg.cta.text,
      organizationName: ctx.org?.name || 'CANNA',
      primaryColor: ctx.org?.primary_color || undefined,
    })
    const res = await sendEmail({
      to: msg.to.email,
      subject: msg.subject,
      html,
      organizationId: ctx.apt.organization_id,
      userId: msg.to.id,
      appointmentId,
      templateName: template,
      organizationName: ctx.org?.name || 'CANNA',
    }, admin)
    return { sent: res.success, reason: res.error }
  } catch (err) {
    console.error('[lifecycle-email]', template, err instanceof Error ? err.message : 'error')
    return { sent: false, reason: 'error' }
  }
}
