import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * What a patient may know about a doctor: display fields only, from the
 * `appointment_doctors` function (migration 030; it replaced direct reads of
 * the `public_doctors` view, which exposed every clinic). Patients must not read doctor rows in
 * `users` — those hold licence/ID numbers, phone and email (migration 022
 * removed that access). Staff/admin/doctors keep their own RLS paths.
 */
export type PublicDoctor = {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  specialties: string[] | null
  consultation_price: number | null
  average_rating: number | null
  total_ratings: number | null
}

/** Adds `doctor` to each row (one call for all rows). */
export async function withPublicDoctors<T extends { doctor_id?: string | null }>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<Array<T & { doctor: PublicDoctor | null }>> {
  const ids = [...new Set(rows.map(r => r.doctor_id).filter((x): x is string => !!x))]
  let byId = new Map<string, PublicDoctor>()
  if (ids.length) {
    // appointment_doctors (migration 030) returns display fields only for doctors
    // the signed-in caller is related to: their appointments, themselves, their clinic.
    const { data } = await supabase.rpc('appointment_doctors', { doctor_ids: ids })
    byId = new Map(((data || []) as PublicDoctor[]).map(d => [d.id, d]))
  }
  return rows.map(r => ({ ...r, doctor: r.doctor_id ? byId.get(r.doctor_id) ?? null : null }))
}
