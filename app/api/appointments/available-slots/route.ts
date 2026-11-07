import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { addDays, format, parseISO, isAfter, addMinutes } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { APP_TIMEZONE } from '@/lib/utils'
import type { AvailabilitySlot } from '@/types/database'
import { resolveTenantFromHost } from '@/lib/tenant/server'
import { DEFAULT_ORG_ID } from '@/lib/tenant'

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
    // This route reads with the service role, so it must do its own authorization:
    // middleware treats every /api/ path as public. Without this, anyone could pass
    // an arbitrary orgId and enumerate a clinic's doctors and working hours.
    const auth = await createServerSupabase()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orgId    = searchParams.get('orgId')
    const doctorId = searchParams.get('doctorId')
    const days     = Math.min(parseInt(searchParams.get('days') || '30'), 60)

    if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

    const admin = createServiceRole()

    // Tenant isolation, enforced here rather than trusted from the browser:
    //  * on a clinic's site, only that clinic's doctors;
    //  * clinic members (staff/doctor/admin) and patients who already belong to
    //    a real clinic, only their own clinic. Marketplace patients (no clinic
    //    yet, or the placeholder default org) may browse any clinic from the
    //    central site — that is the marketplace booking flow.
    const tenant = await resolveTenantFromHost(req.headers.get('host'))
    if (tenant.kind === 'unknown' || (tenant.kind === 'clinic' && tenant.orgId !== orgId)) {
      return NextResponse.json({ slots: [] })
    }
    const { data: me } = await admin.from('users').select('role, organization_id').eq('id', user.id).maybeSingle()
    const caller = me as { role: string; organization_id: string | null } | null
    if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const marketplacePatient = caller.role === 'patient' && (!caller.organization_id || caller.organization_id === DEFAULT_ORG_ID)
    if (!marketplacePatient && caller.organization_id !== orgId) {
      return NextResponse.json({ slots: [] })
    }

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

    // ── All wall-clock maths happens in Israel time ──────────────────────────
    // availability.start/end are bare "HH:mm" strings meaning Israel local time,
    // but this ran through date-fns setHours/getDay, which use the *server's*
    // timezone. Locally (Asia/Jerusalem) that looked right; on Vercel, which runs
    // UTC, every slot came out 2-3 hours late — a doctor available 09:00-17:00
    // was offered to patients as 12:00-20:00. Build each slot as an Israel
    // wall-clock string and let fromZonedTime resolve the real instant (DST-aware).
    const zonedKey = (d: Date) => format(toZonedTime(d, APP_TIMEZONE), 'yyyy-MM-dd_HH:mm')

    const bookedSlots = new Set<string>()
    for (const apt of (existingApts as unknown as AptRow[] || [])) {
      if (apt.scheduled_at) {
        // Block the 30-min slot of each existing appointment
        bookedSlots.add(`${apt.doctor_id}_${zonedKey(parseISO(apt.scheduled_at))}`)
      }
    }

    const slots: Slot[] = []
    const now = new Date()
    const earliest = addMinutes(now, 30) // booking buffer
    const nowInIsrael = toZonedTime(now, APP_TIMEZONE)
    const pad = (n: number) => String(n).padStart(2, '0')

    for (const doctor of typedDoctors) {
      const availability: AvailabilitySlot[] = doctor.availability || []
      const vacations = doctor.metadata?.vacations || []

      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        // Calendar day as seen in Israel, not on the server.
        const day = addDays(nowInIsrael, dayOffset)
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayOfWeek = day.getDay() // 0=Sunday

        // Check vacation
        const isVacation = vacations.some(v => dayStr >= v.start && dayStr <= v.end)
        if (isVacation) continue

        // Find availability for this day
        const avail = availability.find(a => a.day === dayOfWeek)
        if (!avail) continue

        // Working hours as minutes past midnight, Israel time
        const [startH, startM] = avail.start.split(':').map(Number)
        const [endH,   endM]   = avail.end.split(':').map(Number)
        if ([startH, startM, endH, endM].some(Number.isNaN)) continue

        const startMinutes = startH * 60 + startM
        const endMinutes   = endH * 60 + endM

        for (let m = startMinutes; m < endMinutes; m += 30) {
          const wallClock = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
          const slotTime = fromZonedTime(`${dayStr}T${wallClock}:00`, APP_TIMEZONE)

          if (!isAfter(slotTime, earliest)) continue

          const key = `${doctor.id}_${dayStr}_${wallClock}`
          if (!bookedSlots.has(key)) {
            slots.push({
              datetime: slotTime.toISOString(),
              doctorId: doctor.id,
              doctorName: `ד"ר ${doctor.first_name} ${doctor.last_name}`,
            })
          }
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
