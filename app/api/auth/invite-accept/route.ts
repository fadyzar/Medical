import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { resolveTenantFromHost, trustedOrigin } from '@/lib/tenant/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { ACCEPT_MESSAGES, acceptPatientInvitation, clinicBaseUrl, type AcceptOutcome } from '@/lib/services/patient-invitations'

const bodySchema = z.object({ token: z.string().uuid() })

const PATIENT_STATUS: Record<AcceptOutcome, number> = {
  joined: 200, already_member: 200, other_clinic: 409, not_found: 404, revoked: 410, used: 409,
  expired: 410, email_mismatch: 403, email_unverified: 403, not_patient: 409, no_profile: 404,
}

/**
 * POST /api/auth/invite-accept { token }
 *
 * Completes an invitation for the signed-in user.
 *   * patient invitations → accept_patient_invitation() (031): atomic, single
 *     clinic per patient, never moves a patient who belongs to another clinic;
 *   * team invitations (doctor/staff/admin) → token claimed atomically (single
 *     use), then role + clinic applied.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`invite-accept:${user.id}`, { maxRequests: 20, windowMs: 60 * 60 * 1000 }).allowed) {
    return NextResponse.json({ error: 'יותר מדי ניסיונות. נסה שוב מאוחר יותר.' }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 })
  const { token } = parsed.data

  const admin = createServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitationsTable = () => (admin as any).from('invitations')
  const { data: invite } = await invitationsTable()
    .select('id, organization_id, email, role, expires_at, used_at, revoked_at')
    .eq('token', token)
    .maybeSingle()
  const inv = invite as { id: string; organization_id: string; email: string; role: string; expires_at: string; used_at: string | null; revoked_at: string | null } | null
  if (!inv) return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 })

  // ── Patient invitation ───────────────────────────────
  if (inv.role === 'patient') {
    const { outcome, organizationId } = await acceptPatientInvitation(token, user.id)
    let redirect: string | null = null
    if (organizationId) {
      const { data: org } = await admin.from('organizations')
        .select('subdomain, domain_status, custom_domain').eq('id', organizationId).single()
      const tenant = await resolveTenantFromHost(req.headers.get('host'))
      const here = trustedOrigin(req.headers, tenant)
      const base = clinicBaseUrl(org as { subdomain: string | null; domain_status: string | null; custom_domain: string | null }, here, tenant)
      redirect = base === here
        ? '/dashboard/patient/dashboard'
        // Session cookies are per host: sign in on the clinic's own site.
        : `${base}/auth/login?redirect=${encodeURIComponent('/dashboard/patient/dashboard')}`
    }
    const ok = outcome === 'joined' || outcome === 'already_member'
    return NextResponse.json(
      ok ? { ok: true, outcome, role: 'patient', message: ACCEPT_MESSAGES[outcome], redirect }
         : { error: ACCEPT_MESSAGES[outcome], outcome },
      { status: PATIENT_STATUS[outcome] },
    )
  }

  // ── Team invitation (doctor / staff / admin) ─────────
  if (inv.revoked_at) return NextResponse.json({ error: 'ההזמנה בוטלה' }, { status: 410 })
  if (inv.used_at) return NextResponse.json({ error: 'הזמנה כבר נוצלה' }, { status: 409 })
  if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: 'הזמנה פגה' }, { status: 410 })
  if (inv.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'האימייל אינו תואם להזמנה' }, { status: 403 })
  }

  // Claim the token first, atomically: a replayed or concurrent request finds
  // it already used and stops here.
  const { data: claimed } = await invitationsTable()
    .update({ used_at: new Date().toISOString(), accepted_by: user.id })
    .eq('id', inv.id).is('used_at', null).is('revoked_at', null)
    .select('id').maybeSingle()
  if (!claimed) return NextResponse.json({ error: 'הזמנה כבר נוצלה' }, { status: 409 })

  type UserRole = 'patient' | 'doctor' | 'staff' | 'admin'
  const { error: updateErr } = await admin
    .from('users')
    .update({ role: inv.role as UserRole, organization_id: inv.organization_id })
    .eq('id', user.id)

  if (updateErr) {
    console.error('[invite-accept] profile update error', updateErr.code)
    await invitationsTable().update({ used_at: null, accepted_by: null }).eq('id', inv.id)
    return NextResponse.json({ error: 'שגיאה בעדכון פרופיל' }, { status: 500 })
  }

  await admin.from('audit_logs').insert({
    organization_id: inv.organization_id,
    user_id: user.id,
    action: 'invite_accepted',
    resource_type: 'user',
    description: `השלמת הרשמה מהזמנה — role: ${inv.role}`,
    metadata: { invite_id: inv.id, role: inv.role },
  }) // non-critical, ignore error

  return NextResponse.json({ ok: true, role: inv.role, organization_id: inv.organization_id })
}
