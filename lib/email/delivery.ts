/**
 * Email delivery tracking — what happened to a message after Resend accepted it.
 *
 * "Accepted by the provider" is not "delivered": in October 2026 most CANNA
 * demo emails were accepted and then *suppressed* by Resend (the demo
 * mailboxes bounced once, and Resend blocks them since). Without these events
 * the app recorded every one of them as "sent".
 *
 * Dependency-free (node:crypto only) so it can be unit-tested directly.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export type DeliveryUpdate = {
  status: 'sent' | 'delivered' | 'failed'
  /** Human-readable Hebrew reason for failures, shown to clinic admins. */
  reason?: string
}

/** Resend event type (or last_event value) → our notification status. */
export function mapResendEvent(event: string): DeliveryUpdate | null {
  const e = event.replace(/^email\./, '')
  switch (e) {
    case 'delivered':
    case 'opened':
    case 'clicked':
      return { status: 'delivered' }
    case 'sent':
    case 'queued':
    case 'scheduled':
    case 'delivery_delayed':
      return { status: 'sent' }
    case 'bounced':
      return { status: 'failed', reason: 'ההודעה חזרה (bounce) — כתובת האימייל אינה קיימת או שהתיבה דוחה דואר' }
    case 'suppressed':
      return { status: 'failed', reason: 'הכתובת חסומה אצל ספק האימייל כי הודעה קודמת אליה חזרה או סומנה כספאם' }
    case 'complained':
      return { status: 'failed', reason: 'הנמען סימן את ההודעה כספאם' }
    case 'failed':
    case 'canceled':
      return { status: 'failed', reason: 'ספק האימייל לא הצליח לשלוח את ההודעה' }
    default:
      return null
  }
}

/**
 * Verifies a Resend (Svix) webhook signature.
 * signed content = `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256 with the
 * base64 secret after the `whsec_` prefix; the header holds one or more `v1,<b64>`.
 * Rejects timestamps more than 5 minutes off (replay protection).
 */
export function verifyResendSignature(params: {
  secret: string
  id: string | null
  timestamp: string | null
  signatureHeader: string | null
  body: string
  nowSeconds?: number
}): boolean {
  const { secret, id, timestamp, signatureHeader, body } = params
  if (!secret || !id || !timestamp || !signatureHeader) return false
  const ts = Number(timestamp)
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()
  return signatureHeader.split(' ').some(part => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
