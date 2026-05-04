import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { notify, type NotificationEvent } from '@/lib/notifications'

const ALLOWED_EVENTS: NotificationEvent[] = [
  'appointment_confirmed',
  'appointment_scheduled',
  'payment_reminder',
  'appointment_completed',
  'consultation_summary',
  'appointment_cancelled',
]

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!profile || !['doctor', 'staff', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { appointmentId, event, extraContent } = await req.json() as {
    appointmentId: string
    event: NotificationEvent
    extraContent?: string
  }

  if (!appointmentId || !event) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!ALLOWED_EVENTS.includes(event)) {
    return NextResponse.json({ error: 'Event not allowed' }, { status: 400 })
  }

  const admin = createServiceRole()
  const result = await notify(event, appointmentId, admin, { extraContent })

  return NextResponse.json(result)
}
