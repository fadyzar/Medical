import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { sendReminder24h, sendReminder1h } from '@/lib/email'
import { sendReminder1hWhatsApp } from '@/lib/whatsapp'

export async function GET(req: Request) {
  try {
    // ── Auth: CRON_SECRET ────────────────────────────
    const secret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createServiceRole()
    const now = new Date()
    const results = { reminders24h: 0, reminders1h: 0, whatsapp1h: 0, errors: 0 }

    // ── 24h reminders: 23-25 hours from now ──────────
    const h23 = new Date(now.getTime() + 23 * 3600000).toISOString()
    const h25 = new Date(now.getTime() + 25 * 3600000).toISOString()

    const { data: apts24h } = await admin
      .from('appointments')
      .select('id, organization_id')
      .in('status', ['scheduled', 'paid', 'ready'])
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', h23)
      .lte('scheduled_at', h25)
      .is('reminder_24h_sent_at', null)

    for (const apt of apts24h || []) {
      // Check org settings
      const { data: org } = await admin.from('organizations')
        .select('features, settings')
        .eq('id', apt.organization_id)
        .single()

      const features = (org?.features || {}) as Record<string, boolean>
      const settings = (org?.settings || {}) as Record<string, unknown>
      // default: send unless explicitly disabled
      if (features.email_notifications === false || settings.auto_reminder_24h === false) continue

      // Optimistic lock
      const { data: locked } = await admin
        .from('appointments')
        .update({ reminder_24h_sent_at: now.toISOString() })
        .eq('id', apt.id)
        .is('reminder_24h_sent_at', null)
        .select('id')
        .single()

      if (!locked) continue

      try {
        await sendReminder24h({ appointmentId: apt.id, admin })
        results.reminders24h++
      } catch {
        // Revert stamp so it can be retried next run
        await admin.from('appointments')
          .update({ reminder_24h_sent_at: null })
          .eq('id', apt.id)
        results.errors++
      }
    }

    // ── 1h reminders: 45-75 minutes from now ─────────
    const m45 = new Date(now.getTime() + 45 * 60000).toISOString()
    const m75 = new Date(now.getTime() + 75 * 60000).toISOString()

    const { data: apts1h } = await admin
      .from('appointments')
      .select('id, organization_id')
      .in('status', ['scheduled', 'paid', 'ready'])
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', m45)
      .lte('scheduled_at', m75)
      .is('reminder_1h_sent_at', null)

    for (const apt of apts1h || []) {
      const { data: org } = await admin.from('organizations')
        .select('features, settings')
        .eq('id', apt.organization_id)
        .single()

      const features = (org?.features || {}) as Record<string, boolean>
      const settings = (org?.settings || {}) as Record<string, unknown>
      if (features.email_notifications === false || settings.auto_reminder_1h === false) continue

      const { data: locked } = await admin
        .from('appointments')
        .update({ reminder_1h_sent_at: now.toISOString() })
        .eq('id', apt.id)
        .is('reminder_1h_sent_at', null)
        .select('id')
        .single()

      if (!locked) continue

      try {
        await sendReminder1h({ appointmentId: apt.id, admin })
        results.reminders1h++
      } catch {
        await admin.from('appointments')
          .update({ reminder_1h_sent_at: null })
          .eq('id', apt.id)
        results.errors++
      }

      // WhatsApp 1h reminder (best-effort, doesn't affect email flow)
      if (features.whatsapp_notifications) {
        try {
          await sendReminder1hWhatsApp({ appointmentId: apt.id, admin })
          results.whatsapp1h++
        } catch {
          // WhatsApp failure is non-critical — don't revert the email lock
          results.errors++
        }
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    console.error('[Cron Reminders]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
