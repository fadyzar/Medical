import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

    const { appointmentId, rating } = parsed.data
    const admin = createServiceRole()

    // Verify this patient owns the appointment
    const { data: apt } = await admin
      .from('appointments')
      .select('id, patient_id, doctor_id, patient_rating')
      .eq('id', appointmentId)
      .single()

    if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (apt.patient_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (apt.patient_rating) return NextResponse.json({ ok: true, alreadyRated: true })

    // Save rating on appointment
    await admin.from('appointments').update({ patient_rating: rating }).eq('id', appointmentId)

    // Update doctor's aggregate rating
    if (apt.doctor_id) {
      const { data: doctor } = await admin
        .from('users')
        .select('average_rating, total_ratings')
        .eq('id', apt.doctor_id)
        .single()

      if (doctor) {
        const total = (doctor.total_ratings || 0) + 1
        const avg   = ((doctor.average_rating || 0) * (total - 1) + rating) / total
        await admin.from('users').update({
          average_rating: Math.round(avg * 10) / 10,
          total_ratings: total,
        }).eq('id', apt.doctor_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[appointments/rate]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
