/**
 * How online payment works in this deployment, decided on the SERVER only.
 *
 *  tranzila  — TRANZILA_TERMINAL_NAME + TRANZILA_API_KEY are configured. The
 *              patient pays in Tranzila's iframe; only the signed webhook marks
 *              a payment as completed.
 *  simulated — LOCAL QA only. Requires PAYMENTS_SIMULATION=enabled, a non-
 *              production Vercel environment AND a Supabase on localhost, so it
 *              can never mark a production appointment as paid.
 *  none      — no provider. Bookings are not charged online; the clinic settles
 *              payment directly ("clinic" collection). Nothing is ever shown as
 *              paid.
 */
export type PaymentMode = 'tranzila' | 'simulated' | 'none'

type Env = Record<string, string | undefined>

function isLocalSupabase(url: string | undefined): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost'
  } catch {
    return false
  }
}

export function paymentMode(env: Env = process.env): PaymentMode {
  if (env.TRANZILA_TERMINAL_NAME && env.TRANZILA_API_KEY) return 'tranzila'
  if (
    env.PAYMENTS_SIMULATION === 'enabled' &&
    env.VERCEL_ENV !== 'production' &&
    isLocalSupabase(env.NEXT_PUBLIC_SUPABASE_URL)
  ) return 'simulated'
  return 'none'
}

/** Whether a booking with this price is paid online before the doctor reviews it. */
export function collectionFor(price: number | null | undefined, mode: PaymentMode): 'online' | 'clinic' | 'none' {
  if (!price || price <= 0) return 'none'
  return mode === 'none' ? 'clinic' : 'online'
}
