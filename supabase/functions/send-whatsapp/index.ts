import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || ''
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: corsHeaders(origin) })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders(origin) })

    const { phone, message, organizationId, userId, appointmentId } = await req.json()
    if (!phone || !message) return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders(origin) })

    const API_KEY = Deno.env.get('INFOBIP_API_KEY')
    const BASE_URL = Deno.env.get('INFOBIP_BASE_URL')
    const FROM = Deno.env.get('INFOBIP_WHATSAPP_NUMBER')

    if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), { status: 503, headers: corsHeaders(origin) })

    const res = await fetch(`${BASE_URL}/whatsapp/1/message/text`, {
      method: 'POST',
      headers: { Authorization: `App ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: phone.replace(/^0/, '972'), content: { text: message } }),
    })

    const result = await res.json()

    // Save notification
    if (organizationId && userId) {
      await supabase.from('notifications').insert({
        organization_id: organizationId, user_id: userId, appointment_id: appointmentId || null,
        type: 'whatsapp', content: message, recipient_phone: phone,
        status: res.ok ? 'sent' : 'failed', sent_at: res.ok ? new Date().toISOString() : null,
        external_id: result?.messages?.[0]?.messageId, provider: 'infobip',
      })
    }

    return new Response(JSON.stringify({ success: res.ok }), { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[send-whatsapp]', err instanceof Error ? err.message : 'error')
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders(origin) })
  }
})
