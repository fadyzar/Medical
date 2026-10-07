import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { mapResendEvent } from '@/lib/email/delivery'

/**
 * GET /api/admin/email/status?id=<resend id> — what happened to an email the
 * admin's clinic sent (delivered / suppressed / bounced…), asked of Resend
 * directly. Used by the "send test email" panel so "sent" is never mistaken
 * for "arrived".
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, organization_id').eq('id', user.id).single()
  const p = profile as { role: string; organization_id: string } | null
  if (!p || p.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 })

  // Only emails this clinic sent.
  const admin = createServiceRole()
  const { data: row } = await admin.from('notifications')
    .select('id').eq('provider', 'resend').eq('external_id', id).eq('organization_id', p.organization_id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email not configured' }, { status: 503 })
  const res = await new Resend(process.env.RESEND_API_KEY).emails.get(id)
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 502 })

  const lastEvent = String(res.data?.last_event ?? 'sent')
  const update = mapResendEvent(lastEvent)
  if (update && update.status !== 'sent') {
    const now = new Date().toISOString()
    await admin.from('notifications').update({
      status: update.status,
      ...(update.status === 'delivered' ? { delivered_at: now } : { failed_at: now, error_message: update.reason }),
    }).eq('id', (row as { id: string }).id)
  }
  return NextResponse.json({ lastEvent, status: update?.status ?? 'sent', reason: update?.reason ?? null })
}
