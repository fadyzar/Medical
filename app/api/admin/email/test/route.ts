import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { rateLimit } from '@/lib/security/rate-limit'

/**
 * POST /api/admin/email/test
 *
 * Sends one test email to the signed-in admin's OWN address and returns what
 * Resend answered — the message id, or the provider's exact error. Email is
 * CANNA-managed, so without this a clinic has no way to tell "not sent" from
 * "sent but not delivered".
 */
export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`email-test:${user.id}`, { maxRequests: 5, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'יותר מדי בדיקות. נסה שוב בעוד שעה.' }, { status: 429 })
    }

    const { data: profile } = await supabase.from('users')
      .select('role, organization_id, email')
      .eq('id', user.id)
      .single()
    const p = profile as { role: string; organization_id: string; email: string | null } | null
    if (!p || p.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const to = p.email || user.email
    if (!to) return NextResponse.json({ error: 'לחשבון שלך אין כתובת אימייל' }, { status: 400 })

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY לא מוגדר בשרת — אימיילים אינם נשלחים' }, { status: 503 })
    }

    const admin = createServiceRole()
    const { data: org } = await admin.from('organizations').select('name').eq('id', p.organization_id).single()
    const orgName = (org as { name?: string } | null)?.name || 'CANNA'
    const sentAt = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })

    const result = await sendEmail({
      to,
      subject: `בדיקת אימייל — ${orgName}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1f2937">
        <h2 style="margin:0 0 12px">בדיקת שליחת אימייל</h2>
        <p>אם הודעה זו הגיעה אליך — שליחת האימיילים של ${orgName} פעילה.</p>
        <p style="color:#6b7280;font-size:13px">נשלח: ${sentAt} (שעון ישראל)</p>
      </div>`,
      organizationId: p.organization_id,
      userId: user.id,
      appointmentId: null,
      templateName: 'admin_email_test',
      organizationName: orgName,
    }, admin)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'השליחה נכשלה' }, { status: 502 })
    }

    const from = process.env.RESEND_FROM_EMAIL || 'noreply@cannaforyou.net'
    return NextResponse.json({
      ok: true,
      messageId: result.externalId,
      to,
      fromDomain: from.split('@')[1] || null,
    })
  } catch (err) {
    console.error('[email/test]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
