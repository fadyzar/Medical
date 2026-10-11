/**
 * Delivery reconciliation: settles emails still recorded as "sent".
 *
 * Resend accepts a message before it knows whether it will arrive; a webhook
 * normally reports the outcome, but when none is configured every accepted
 * message stays "sent" forever, including ones Resend suppressed. The reminder
 * cron calls this so `notifications` reflects what actually happened either way.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { mapResendEvent } from '@/lib/email/delivery'

/** Per cron run; Resend allows a few requests per second. */
const BATCH = 25
const LOOKBACK_MS = 3 * 24 * 3600 * 1000

export async function reconcileEmailDelivery(admin: SupabaseClient) {
  if (!process.env.RESEND_API_KEY) return null
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Older than a few minutes, so the provider has had time to settle it.
  const { data: rows } = await admin.from('notifications')
    .select('id, external_id')
    .eq('provider', 'resend').eq('status', 'sent').not('external_id', 'is', null)
    .gte('created_at', new Date(Date.now() - LOOKBACK_MS).toISOString())
    .lte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH)

  const tally = { checked: 0, delivered: 0, failed: 0 }
  for (const row of (rows || []) as { id: string; external_id: string }[]) {
    const res = await resend.emails.get(row.external_id)
    await new Promise(r => setTimeout(r, 300))
    if (res.error || !res.data) continue
    tally.checked++
    const update = mapResendEvent(String(res.data.last_event ?? 'sent'))
    if (!update || update.status === 'sent') continue
    const now = new Date().toISOString()
    await admin.from('notifications').update({
      status: update.status,
      ...(update.status === 'delivered' ? { delivered_at: now } : { failed_at: now, error_message: update.reason }),
    }).eq('id', row.id).eq('status', 'sent')
    tally[update.status]++
  }
  return tally
}
