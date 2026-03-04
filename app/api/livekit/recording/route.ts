import { NextRequest, NextResponse } from 'next/server'
import { EgressClient, EncodedFileOutput, EncodingOptionsPreset } from 'livekit-server-sdk'
import { createServerSupabase } from '@/lib/supabase/server'

// ── GET: List recordings for an appointment ─────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const appointmentId = req.nextUrl.searchParams.get('appointmentId')
    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })
    }

    // Verify user has access to this appointment (doctor or patient)
    const { data: apt } = await supabase.from('appointments')
      .select('id, doctor_id, patient_id, video_room_name')
      .eq('id', appointmentId)
      .single()

    if (!apt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const typedApt = apt as unknown as { id: string; doctor_id: string; patient_id: string; video_room_name: string | null }
    if (typedApt.doctor_id !== user.id && typedApt.patient_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch recording audit logs for this appointment
    const { data: logs } = await supabase.from('audit_logs')
      .select('action, metadata, created_at')
      .eq('resource_id', appointmentId)
      .in('action', ['RECORDING_CONSENT_GIVEN', 'RECORDING_STOPPED'])
      .order('created_at', { ascending: true })

    type LogEntry = { action: string; metadata: Record<string, string>; created_at: string }
    const typedLogs = (logs || []) as unknown as LogEntry[]

    // Build recording list from audit log pairs
    const recordings: Array<{
      egressId: string
      startedAt: string
      stoppedAt: string | null
      filePath: string
    }> = []

    const startLogs = typedLogs.filter(l => l.action === 'RECORDING_CONSENT_GIVEN' && l.metadata?.egress_id)

    for (const log of startLogs) {
      const egressId = log.metadata.egress_id
      const stopLog = typedLogs.find(
        l => l.action === 'RECORDING_STOPPED' && l.metadata?.egress_id === egressId
      )
      recordings.push({
        egressId,
        startedAt: log.metadata.consented_at || log.created_at,
        stoppedAt: stopLog ? stopLog.metadata?.stopped_at || stopLog.created_at : null,
        filePath: `recordings/${appointmentId}/`,
      })
    }

    return NextResponse.json({ recordings })
  } catch (err) {
    console.error('[livekit/recording] GET:', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a doctor
    const { data: profile } = await supabase.from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as unknown as { role: string }).role !== 'doctor') {
      return NextResponse.json({ error: 'Forbidden — doctors only' }, { status: 403 })
    }

    const { roomName, appointmentId, consentGiven } = await req.json()
    if (!roomName || !appointmentId) {
      return NextResponse.json({ error: 'Missing roomName or appointmentId' }, { status: 400 })
    }

    if (!consentGiven) {
      return NextResponse.json({ error: 'Recording consent not provided' }, { status: 400 })
    }

    // Verify doctor owns this appointment
    const { data: apt } = await supabase.from('appointments')
      .select('id, doctor_id, organization_id')
      .eq('id', appointmentId)
      .single()

    if (!apt || (apt as unknown as { doctor_id: string }).doctor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!livekitUrl || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret)

    const output = new EncodedFileOutput({
      filepath: `recordings/${appointmentId}/{room_name}-{time}.mp4`,
      fileType: 0, // MP4
    })

    const egress = await egressClient.startRoomCompositeEgress(roomName, output, {
      encodingOptions: EncodingOptionsPreset.H264_720P_30,
    })

    // ── Log recording consent in audit_logs ─────────────
    await supabase.from('audit_logs').insert({
      organization_id: (apt as unknown as { organization_id: string }).organization_id,
      user_id: user.id,
      action: 'RECORDING_CONSENT_GIVEN',
      resource_type: 'appointment',
      resource_id: appointmentId,
      metadata: {
        egress_id: egress.egressId,
        room_name: roomName,
        consented_at: new Date().toISOString(),
        consented_by: user.id,
      },
    })

    return NextResponse.json({ egressId: egress.egressId })
  } catch (err) {
    console.error('[livekit/recording] POST:', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Failed to start recording' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { egressId, appointmentId } = await req.json()
    if (!egressId) {
      return NextResponse.json({ error: 'Missing egressId' }, { status: 400 })
    }

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!livekitUrl || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret)
    await egressClient.stopEgress(egressId)

    // Log recording stop and store recording reference
    if (appointmentId) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'RECORDING_STOPPED',
        resource_type: 'appointment',
        resource_id: appointmentId,
        metadata: {
          egress_id: egressId,
          stopped_at: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[livekit/recording] DELETE:', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Failed to stop recording' }, { status: 500 })
  }
}
