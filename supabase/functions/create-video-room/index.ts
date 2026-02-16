import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Base64URL encode helper
function base64url(data: Uint8Array): string {
  const str = btoa(String.fromCharCode(...data))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function textToUint8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

// Generate a LiveKit JWT token using Web Crypto (Deno-compatible)
async function generateLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  identity: string,
  name: string,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: apiKey,
    sub: identity,
    name,
    iat: now,
    nbf: now,
    exp: now + 7200, // 2 hours
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  }

  const encodedHeader = base64url(textToUint8(JSON.stringify(header)))
  const encodedPayload = base64url(textToUint8(JSON.stringify(payload)))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  // Import the secret key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    textToUint8(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, textToUint8(signingInput))
  const encodedSignature = base64url(new Uint8Array(signature))

  return `${signingInput}.${encodedSignature}`
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: corsHeaders(origin) })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders(origin) })

    const { appointmentId } = await req.json()
    if (!appointmentId) return new Response(JSON.stringify({ error: 'Missing appointmentId' }), { status: 400, headers: corsHeaders(origin) })

    // Verify user is doctor or patient of this appointment
    const { data: apt } = await supabase.from('appointments').select('id, patient_id, doctor_id, organization_id')
      .eq('id', appointmentId).single()
    if (!apt || (apt.patient_id !== user.id && apt.doctor_id !== user.id)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders(origin) })
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

    const LIVEKIT_KEY = Deno.env.get('LIVEKIT_API_KEY')!
    const LIVEKIT_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!
    const roomName = `apt-${appointmentId}`

    // Generate proper JWT token
    const livekitToken = await generateLiveKitToken(
      LIVEKIT_KEY,
      LIVEKIT_SECRET,
      roomName,
      user.id,
      displayName,
    )

    // Update appointment with room info
    await supabase.from('appointments').update({
      video_room_name: roomName,
      video_room_id: roomName,
    }).eq('id', appointmentId)

    return new Response(JSON.stringify({ room: roomName, token: livekitToken }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[create-video-room]', err instanceof Error ? err.message : 'error')
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders(origin) })
  }
})
