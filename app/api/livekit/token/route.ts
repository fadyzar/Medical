import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { createServiceRole } from '@/lib/supabase/server'
import { appointmentIdSchema } from '@/lib/validation/schemas'
import { rateLimit } from '@/lib/security/rate-limit'
import { checkVideoAccess } from '@/lib/video/server'
import { tokenTtlSeconds, VIDEO_DENY_MESSAGES } from '@/lib/video/access'

/**
 * POST /api/livekit/token — the only place a LiveKit token is minted.
 *
 * Issued only to the appointment's own patient or assigned doctor, in the
 * appointment's clinic, for a doctor-approved appointment, from its start time
 * until the end of its window (see lib/video/access.ts). The token is bound to
 * this appointment's room, carries the user's id as identity, and lives at most
 * 10 minutes (only long enough to connect).
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = appointmentIdSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'נתונים לא תקינים' }, { status: 400 })
    }
    const { appointmentId } = parsed.data

    const check = await checkVideoAccess(req.headers.get('host'), appointmentId)
    if (check.kind === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (check.kind === 'not_found') return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

    const limit = rateLimit(`livekit-token:${check.user.id}`, { maxRequests: 30, windowMs: 10 * 60 * 1000 })
    if (!limit.allowed) return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 })

    const { access, now, user } = check
    if (!access.allowed) {
      return NextResponse.json({ error: VIDEO_DENY_MESSAGES[access.code], code: access.code }, { status: 403 })
    }
    if (access.phase !== 'open') {
      // Waiting room: the consultation itself opens at the scheduled time.
      return NextResponse.json({
        error: 'הייעוץ טרם התחיל — ניתן להמתין בחדר ההמתנה', code: 'waiting_room',
        startsAt: access.startsAt, serverNow: now.toISOString(),
      }, { status: 425 })
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    const displayName = access.role === 'doctor'
      ? `ד"ר ${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
      : `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'משתתף'

    const roomName = `apt-${appointmentId}`
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: displayName,
      ttl: tokenTtlSeconds(access.closesAt, now),
      metadata: JSON.stringify({ role: access.role }),
    })
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    const token = await at.toJwt()

    const admin = createServiceRole()
    await admin.from('appointments').update({ video_room_name: roomName, video_room_id: roomName })
      .eq('id', appointmentId).is('video_room_name', null)

    return NextResponse.json({ token, room: roomName, expiresInSeconds: tokenTtlSeconds(access.closesAt, now) })
  } catch (err) {
    console.error('[livekit/token]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
