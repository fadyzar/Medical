import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { resolveTenantFromHost } from '@/lib/tenant/server'
import { evaluateVideoAccess, type VideoAccess, type VideoAppointment, type VideoUser } from '@/lib/video/access'

export type VideoCheck =
  | { kind: 'unauthenticated' }
  | { kind: 'not_found' }
  | { kind: 'checked'; access: VideoAccess; apt: VideoAppointment; user: VideoUser & { first_name: string | null; last_name: string | null }; now: Date }

/**
 * Server-side video authorization for one appointment: authenticated identity
 * (getUser, verified with Supabase Auth), the participant's role and clinic,
 * the appointment's status and the access window on the server's clock.
 * Data is read with the service role so RLS visibility never decides access.
 */
export async function checkVideoAccess(host: string | null, appointmentId: string): Promise<VideoCheck> {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { kind: 'unauthenticated' }

  const admin = createServiceRole()
  const [{ data: apt }, { data: profile }, tenant] = await Promise.all([
    admin.from('appointments')
      .select('id, organization_id, patient_id, doctor_id, status, scheduled_at, duration_minutes, approved_at, appointment_type')
      .eq('id', appointmentId).maybeSingle(),
    admin.from('users').select('id, role, organization_id, first_name, last_name').eq('id', user.id).maybeSingle(),
    resolveTenantFromHost(host),
  ])
  if (!apt || !profile) return { kind: 'not_found' }

  const a = apt as VideoAppointment
  const u = profile as VideoUser & { first_name: string | null; last_name: string | null }
  // Hide the existence of appointments the caller is not part of.
  if (u.id !== a.patient_id && u.id !== a.doctor_id) return { kind: 'not_found' }

  const now = new Date()
  const access = tenant.kind === 'unknown'
    ? { allowed: false as const, code: 'wrong_clinic' as const }
    : evaluateVideoAccess({ apt: a, user: u, now, tenantOrgId: tenant.kind === 'clinic' ? tenant.orgId : null })
  return { kind: 'checked', access, apt: a, user: u, now }
}
