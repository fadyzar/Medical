import { createServiceRole } from '@/lib/supabase/server'
import { addDomainToVercel } from './vercel'
import { addCnameToHostinger, getManualDnsInstructions } from './hostinger'

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

  // Mark as pending
  await admin.from('organizations').update({ domain_status: 'pending', domain_error: null }).eq('id', orgId)

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

  let finalStatus: 'active' | 'vercel_added'
  let dnsManual = false

  if (dnsResult.ok) {
    finalStatus = 'vercel_added' // DNS added, but SSL needs time to propagate
  } else {
    finalStatus = 'vercel_added' // Vercel is set; DNS needs to be manual
    dnsManual = true
  }

  await admin.from('organizations').update({
    domain_status: finalStatus,
    subdomain,
    domain_error: dnsManual ? (dnsResult.error || 'DNS needs manual setup') : null,
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
