import { NextRequest, NextResponse } from 'next/server'
import { appointmentIdSchema } from '@/lib/validation/schemas'
import { checkVideoAccess } from '@/lib/video/server'
import { VIDEO_DENY_MESSAGES } from '@/lib/video/access'

export const dynamic = 'force-dynamic'

/**
 * GET /api/video/access?appointmentId=… — may the caller enter the waiting room
 * now, and when does the consultation open? Uses the server clock; the browser
 * only renders the answer. The LiveKit token route re-checks independently.
 */
export async function GET(req: NextRequest) {
  const parsed = appointmentIdSchema.safeParse({ appointmentId: req.nextUrl.searchParams.get('appointmentId') })
  if (!parsed.success) return NextResponse.json({ error: 'נתונים לא תקינים' }, { status: 400 })

  const check = await checkVideoAccess(req.headers.get('host'), parsed.data.appointmentId)
  if (check.kind === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (check.kind === 'not_found') return NextResponse.json({ error: 'התור לא נמצא' }, { status: 404 })

  const { access, now } = check
  const serverNow = now.toISOString()
  if (!access.allowed) {
    return NextResponse.json({
      allowed: false, code: access.code, error: VIDEO_DENY_MESSAGES[access.code],
      opensAt: access.opensAt ?? null, startsAt: access.startsAt ?? null, closesAt: access.closesAt ?? null, serverNow,
    }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ ...access, serverNow }, { headers: { 'Cache-Control': 'no-store' } })
}
