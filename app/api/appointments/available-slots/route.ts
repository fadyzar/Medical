import { NextRequest, NextResponse } from 'next/server'
import { createServiceRole } from '@/lib/supabase/server'
import { addDays, format, parseISO, setHours, setMinutes, isBefore, isAfter, addMinutes } from 'date-fns'
import type { AvailabilitySlot } from '@/types/database'

export const dynamic = 'force-dynamic'

// Returns available 30-min slots for a doctor (or all org doctors) for the next N days
// GET /api/appointments/available-slots?orgId=xxx&doctorId=xxx&days=30

type Slot = {
  datetime: string   // ISO
  doctorId: string
  doctorName: string
}

type DoctorRow = {
  id: string
  first_name: string
  last_name: string
  availability: AvailabilitySlot[]
  metadata: { vacations?: Array<{ start: string; end: string }> } | null
}

type AptRow = {
  doctor_id: string
  scheduled_at: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId    = searchParams.get('orgId')
    const doctorId = searchParams.get('doctorId')
    const days     = Math.min(parseInt(searchParams.get('days') || '30'), 60)

    if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

    const admin = createServiceRole()

    // Fetch doctors
    const query = admin
      .from('users')
      .select('id, first_name, last_name, availability, metadata')
      .eq('organization_id', orgId)
      .eq('role', 'doctor')
      .eq('is_active', true)

    if (doctorId) query.eq('id', doctorId)

    const { data: doctors } = await query
    if (!doctors?.length) return NextResponse.json({ slots: [] })

    const typedDoctors = doctors as unknown as DoctorRow[]
    const doctorIds = typedDoctors.map(d => d.id)

    // Fetch existing scheduled appointments for these doctors in the date range
    const rangeStart = new Date()
    const rangeEnd   = addDays(rangeStart, days)

    const { data: existingApts } = await admin
      .from('appointments')
      .select('doctor_id, scheduled_at')
      .in('doctor_id', doctorIds)
      .not('scheduled_at', 'is', null)
      .in('status', ['pending', 'scheduled', 'paid', 'ready', 'in_progress', 'doctor_confirmed', 'time_selected'])
      .gte('scheduled_at', rangeStart.toISOString())
      .lte('scheduled_at', rangeEnd.toISOString())

    const bookedSlots = new Set<string>()
    for (const apt of (existingApts as unknown as AptRow[] || [])) {
      if (apt.scheduled_at) {
        // Block the 30-min slot of each existing appointment
        const d = parseISO(apt.scheduled_at)
        const key = `${apt.doctor_id}_${format(d, 'yyyy-MM-dd_HH:mm')}`
        bookedSlots.add(key)
      }
    }

    const slots: Slot[] = []
    const now = new Date()

    for (const doctor of typedDoctors) {
      const availability: AvailabilitySlot[] = doctor.availability || []
      const vacations = doctor.metadata?.vacations || []

      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const day = addDays(now, dayOffset)
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayOfWeek = day.getDay() // 0=Sunday

        // Check vacation
        const isVacation = vacations.some(v => dayStr >= v.start && dayStr <= v.end)
        if (isVacation) continue

        // Find availability for this day
        const avail = availability.find(a => a.day === dayOfWeek)
        if (!avail) continue

        // Parse working hours
        const [startH, startM] = avail.start.split(':').map(Number)
        const [endH,   endM]   = avail.end.split(':').map(Number)

        let slotTime = setMinutes(setHours(day, startH), startM)
        const endTime = setMinutes(setHours(day, endH), endM)

        while (isBefore(slotTime, endTime)) {
          // Skip past slots (with 30-min buffer)
          if (!isAfter(slotTime, addMinutes(now, 30))) {
            slotTime = addMinutes(slotTime, 30)
            continue
          }

          const key = `${doctor.id}_${format(slotTime, 'yyyy-MM-dd_HH:mm')}`
          if (!bookedSlots.has(key)) {
            slots.push({
              datetime: slotTime.toISOString(),
              doctorId: doctor.id,
              doctorName: `ד"ר ${doctor.first_name} ${doctor.last_name}`,
            })
          }

          slotTime = addMinutes(slotTime, 30)
        }
      }
    }

    // Sort by datetime
    slots.sort((a, b) => a.datetime.localeCompare(b.datetime))

    return NextResponse.json({ slots })
  } catch (err) {
    console.error('[available-slots]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
