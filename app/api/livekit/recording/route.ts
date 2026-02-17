import { NextRequest, NextResponse } from 'next/server'
import { EgressClient, EncodedFileOutput, EncodingOptionsPreset } from 'livekit-server-sdk'
import { createServerSupabase } from '@/lib/supabase/server'

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

    const { roomName, appointmentId } = await req.json()
    if (!roomName || !appointmentId) {
      return NextResponse.json({ error: 'Missing roomName or appointmentId' }, { status: 400 })
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

    const { egressId } = await req.json()
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[livekit/recording] DELETE:', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Failed to stop recording' }, { status: 500 })
  }
}
