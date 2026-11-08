import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveTenantFromHost } from '@/lib/tenant/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { claimClinicFromHost } from '@/lib/services/patient-invitations'

/**
 * POST /api/patient/claim-clinic — a patient who just registered on a clinic's
 * own site joins THAT clinic. The clinic comes only from the request host
 * (server-resolved), never from the body; a patient who already belongs to a
 * clinic is never moved (claim_patient_clinic + the single-clinic trigger).
 * Only for an account that registered on this very site (signup_host): simply
 * signing in or browsing a clinic's site never changes anyone's clinic.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`claim-clinic:${user.id}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 }).allowed) {
    return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 })
  }
  const host = req.headers.get('host')
  if (!host || user.user_metadata?.signup_host !== host) return NextResponse.json({ outcome: 'not_signup_site' })
  const tenant = await resolveTenantFromHost(host)
  const outcome = await claimClinicFromHost(user.id, tenant)
  return NextResponse.json({ outcome }, { status: outcome === 'error' ? 500 : 200 })
}
