import { NextResponse } from 'next/server'
import { paymentMode } from '@/lib/payments/mode'

export const dynamic = 'force-dynamic'

/** GET /api/payments/mode — which payment UI to show. Decided on the server. */
export async function GET() {
  return NextResponse.json({ mode: paymentMode() })
}
