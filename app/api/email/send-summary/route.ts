import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendConsultationSummary } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (!profile || (profile as unknown as { role: string }).role !== 'doctor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

    const admin = createServiceRole()
    await sendConsultationSummary({ appointmentId, admin })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Email Summary]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
