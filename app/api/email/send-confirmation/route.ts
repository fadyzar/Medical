import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendAppointmentConfirmation } from '@/lib/email'
import { sendAppointmentConfirmationWhatsApp } from '@/lib/whatsapp'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })

    const admin = createServiceRole()
    await sendAppointmentConfirmation({ appointmentId, admin })

    // WhatsApp confirmation (best-effort)
    try {
      await sendAppointmentConfirmationWhatsApp({ appointmentId, admin })
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Email Confirmation]', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
