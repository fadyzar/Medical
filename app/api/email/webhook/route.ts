import { NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { mapResendEvent, verifyResendSignature } from '@/lib/email/delivery'

/**
 * POST /api/email/webhook — Resend delivery events (delivered, bounced,
 * suppressed, complained…). Updates the matching `notifications` row so the
 * clinic sees what actually happened to each email, not just "sent".
 *
 * Configure in Resend → Webhooks with this URL; put the signing secret in
 * RESEND_WEBHOOK_SECRET. Unsigned or stale requests are rejected.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  const body = await req.text()
  const ok = verifyResendSignature({
    secret,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signatureHeader: req.headers.get('svix-signature'),
    body,
  })
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  let event: { type?: string; data?: { email_id?: string } }
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  const emailId = event.data?.email_id
  const update = event.type ? mapResendEvent(event.type) : null
  // Unknown event types are acknowledged so Resend does not retry them forever.
  if (!emailId || !update) return NextResponse.json({ ok: true, ignored: true })

  const now = new Date().toISOString()
  const admin = createServiceRole()
  await admin.from('notifications').update({
    status: update.status,
    ...(update.status === 'delivered' ? { delivered_at: now } : {}),
    ...(update.status === 'failed' ? { failed_at: now, error_message: update.reason ?? event.type } : {}),
  }).eq('provider', 'resend').eq('external_id', emailId)

  return NextResponse.json({ ok: true })
}
