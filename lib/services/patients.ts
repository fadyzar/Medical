/**
 * Patient search service.
 *
 * Shared by GET /api/patients/search (the staff screens) and the assistant's
 * find_patients tool. The scoping rules live here so both can never drift.
 *
 * Scoping, by caller role:
 *   staff / admin — every patient in their own organization.
 *   doctor        — only patients they have or had an appointment with.
 *   patient       — nobody. A patient may never look up another patient.
 */

import { createServiceRole } from '@/lib/supabase/server'
import type { Caller, ServiceResult } from '@/lib/services/appointments'

export type PatientHit = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  lastAppointmentAt: string | null
}

/** Below this, a search is a fishing expedition rather than a lookup. */
export const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 25

/** Escapes PostgREST `or()` metacharacters so a query cannot break out of the filter. */
function sanitizeTerm(raw: string): string {
  return raw.trim().replace(/[,()*\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function searchPatients(params: {
  caller: Caller
  query: string
  limit?: number
}): Promise<ServiceResult<PatientHit[]>> {
  const { caller } = params

  if (caller.role === 'patient') {
    return { ok: false, status: 403, error: 'אין הרשאה לחפש מטופלים' }
  }
  if (!caller.organizationId) {
    return { ok: false, status: 403, error: 'המשתמש אינו משויך למרפאה' }
  }

  const term = sanitizeTerm(params.query || '')
  if (term.length < MIN_QUERY_LENGTH) {
    return { ok: false, status: 400, error: `יש להזין לפחות ${MIN_QUERY_LENGTH} תווים לחיפוש` }
  }

  const limit = Math.min(Math.max(params.limit ?? 10, 1), MAX_RESULTS)
  const admin = createServiceRole()

  // A doctor is limited to the patients they actually treat. Resolve that set
  // first — an empty set short-circuits to no results rather than a wide query.
  let allowedPatientIds: string[] | null = null
  if (caller.role === 'doctor') {
    const { data: apts } = await admin
      .from('appointments').select('patient_id').eq('doctor_id', caller.id).limit(1000)
    const ids = [...new Set(((apts || []) as Array<{ patient_id: string }>).map(a => a.patient_id))]
    if (ids.length === 0) return { ok: true, data: [] }
    allowedPatientIds = ids
  }

  let q = admin
    .from('users')
    .select('id, first_name, last_name, email, phone')
    .eq('organization_id', caller.organizationId)   // tenant scope, always
    .eq('role', 'patient')                          // never returns staff or doctors
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    .limit(limit)

  if (allowedPatientIds) q = q.in('id', allowedPatientIds)

  const { data, error } = await q
  if (error) {
    console.error('[searchPatients]', error.message)
    return { ok: false, status: 500, error: 'שגיאה בחיפוש' }
  }

  const rows = (data || []) as Array<{
    id: string; first_name: string; last_name: string; email: string | null; phone: string | null
  }>
  if (rows.length === 0) return { ok: true, data: [] }

  // Attach the most recent appointment so the caller can tell two similar names apart.
  const { data: recent } = await admin
    .from('appointments')
    .select('patient_id, scheduled_at, created_at')
    .in('patient_id', rows.map(r => r.id))
    .order('created_at', { ascending: false })
    .limit(500)

  const lastSeen = new Map<string, string>()
  for (const a of (recent || []) as Array<{ patient_id: string; scheduled_at: string | null; created_at: string }>) {
    if (!lastSeen.has(a.patient_id)) lastSeen.set(a.patient_id, a.scheduled_at || a.created_at)
  }

  return {
    ok: true,
    data: rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      lastAppointmentAt: lastSeen.get(r.id) ?? null,
    })),
  }
}
