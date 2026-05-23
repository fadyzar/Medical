import { createServiceRole } from '@/lib/supabase/server'
import { addDomainToVercel, removeDomainFromVercel, checkVercelDomainStatus } from './vercel'
import { addCnameToHostinger, deleteCnameFromHostinger, getManualDnsInstructions } from './hostinger'

export type ProvisionResult = {
  ok: boolean
  status: 'active' | 'vercel_added' | 'failed'
  vercelOk: boolean
  dnsOk: boolean
  dnsManual: boolean
  manualInstructions?: ReturnType<typeof getManualDnsInstructions>
  error?: string
}

export async function provisionSubdomain(orgId: string, subdomain: string): Promise<ProvisionResult> {
  const admin = createServiceRole()

  // Get current subdomain (to clean up old one if replacing)
  const { data: org } = await admin
    .from('organizations')
    .select('subdomain, domain_status')
    .eq('id', orgId)
    .single()

  const oldSubdomain = org?.subdomain

  // Mark as pending
  await admin.from('organizations').update({
    domain_status: 'pending',
    domain_error: null,
  }).eq('id', orgId)

  // Clean up old subdomain if different
  if (oldSubdomain && oldSubdomain !== subdomain) {
    await Promise.allSettled([
      removeDomainFromVercel(oldSubdomain),
      deleteCnameFromHostinger(oldSubdomain),
    ])
  }

  // Step 1: Add to Vercel
  const vercelResult = await addDomainToVercel(subdomain)

  if (!vercelResult.ok) {
    const errMsg = vercelResult.error || 'Failed to add domain to Vercel'
    await admin.from('organizations').update({
      domain_status: 'failed',
      domain_error: errMsg,
      domain_last_checked_at: new Date().toISOString(),
    }).eq('id', orgId)

    return { ok: false, status: 'failed', vercelOk: false, dnsOk: false, dnsManual: false, error: errMsg }
  }

  // Step 2: Add CNAME to Hostinger DNS
  const dnsResult = await addCnameToHostinger(subdomain)

  const dnsManual = !dnsResult.ok
  const finalStatus: 'vercel_added' = 'vercel_added'

  await admin.from('organizations').update({
    domain_status: finalStatus,
    subdomain,
    domain_error: dnsManual
      ? (dnsResult.notConfigured ? 'HOSTINGER_API_KEY not configured — add DNS manually' : dnsResult.error || 'DNS setup failed')
      : null,
    domain_last_checked_at: new Date().toISOString(),
  }).eq('id', orgId)

  return {
    ok: true,
    status: finalStatus,
    vercelOk: true,
    dnsOk: dnsResult.ok,
    dnsManual,
    manualInstructions: dnsManual ? getManualDnsInstructions(subdomain) : undefined,
  }
}

// Check if Vercel has verified the domain and upgrade status to 'active'
export async function checkAndActivateDomain(orgId: string, subdomain: string): Promise<{
  status: string
  verified: boolean
}> {
  const admin = createServiceRole()

  const vercelStatus = await checkVercelDomainStatus(subdomain)

  if (vercelStatus.verified && vercelStatus.configured) {
    await admin.from('organizations').update({
      domain_status: 'active',
      domain_error: null,
      domain_last_checked_at: new Date().toISOString(),
    }).eq('id', orgId)
    return { status: 'active', verified: true }
  }

  await admin.from('organizations').update({
    domain_last_checked_at: new Date().toISOString(),
  }).eq('id', orgId)

  return { status: 'vercel_added', verified: false }
}
