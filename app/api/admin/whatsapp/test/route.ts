import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { getOrgGreenApiCredentials } from '@/lib/whatsapp'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().regex(/^0[2-9]\d{7,8}$/, 'מספר טלפון לא תקין (לדוגמה: 0521234567)'),
})

function toGreenApiChatId(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  let number: string
  if (cleaned.startsWith('+972')) number = cleaned.slice(1)
  else if (cleaned.startsWith('972')) number = cleaned
  else if (cleaned.startsWith('0')) number = `972${cleaned.slice(1)}`
  else number = cleaned
  return `${number}@c.us`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = (profile as { organization_id: string }).organization_id

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    const admin = createServiceRole()
    const creds = await getOrgGreenApiCredentials(orgId, admin)

    if (!creds) {
      return NextResponse.json({
        error: 'לא נמצאו פרטי Green API. הגדר Instance ID ו-Token תחילה.',
      }, { status: 400 })
    }

    const { instanceId, apiToken } = creds
    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`

    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    const orgName = (org as { name?: string } | null)?.name || 'המרפאה'
    const message = `✅ הודעת טסט ממרפאת ${orgName}\n\nחיבור ה-WhatsApp עובד בהצלחה! המטופלים שלך יקבלו התראות מספר זה.`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: toGreenApiChatId(parsed.data.phone),
        message,
      }),
      signal: AbortSignal.timeout(15000),
    })

    const result = await res.json()

    if (!res.ok) {
      const errMsg = result?.message || `Green API error: ${res.status}`
      return NextResponse.json({ error: errMsg }, { status: 502 })
    }

    return NextResponse.json({ ok: true, messageId: result?.idMessage })
  } catch (err) {
    console.error('[whatsapp/test]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
