import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendAppointmentConfirmation } from '@/lib/email'
import { sendAppointmentConfirmationWhatsApp } from '@/lib/whatsapp'
import { appointmentIdSchema } from '@/lib/validation/schemas'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = appointmentIdSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'נתונים לא תקינים', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { appointmentId } = parsed.data

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
