import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { createServerSupabase } from '@/lib/supabase/server'
import { appointmentIdSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = appointmentIdSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'נתונים לא תקינים', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { appointmentId } = parsed.data

    // Verify user is patient or doctor of this appointment
    const { data: apt } = await supabase.from('appointments')
      .select('id, patient_id, doctor_id, organization_id, status')
      .eq('id', appointmentId)
      .single()

    if (!apt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
    if (apt.patient_id !== user.id && apt.doctor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cannot join a cancelled / finished appointment's room
    if (['cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor', 'completed'].includes(apt.status)) {
      return NextResponse.json({ error: 'התור אינו פעיל' }, { status: 409 })
    }

    // Get user profile for display name
    const { data: profile } = await supabase.from('users')
      .select('first_name, last_name, role')
      .eq('id', user.id)
      .single()

    const displayName = profile
      ? profile.role === 'doctor'
        ? `ד"ר ${profile.first_name} ${profile.last_name}`
        : `${profile.first_name} ${profile.last_name}`
      : 'משתתף'

    const roomName = `apt-${appointmentId}`

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    // Generate LiveKit JWT token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: displayName,
      ttl: '2h',
    })

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const token = await at.toJwt()

    // Update appointment with room info
    await supabase.from('appointments').update({
      video_room_name: roomName,
      video_room_id: roomName,
    }).eq('id', appointmentId)

    return NextResponse.json({ token, room: roomName })
  } catch (err) {
    console.error('[livekit/token]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
