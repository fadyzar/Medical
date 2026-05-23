// Uses env vars: HOSTINGER_API_KEY
// Zone is always: cannaforyou.net
// CNAME target: cname.vercel-dns.com

const HOSTINGER_API = 'https://api.hostinger.com/v1'
const DNS_ZONE = 'cannaforyou.net'
const VERCEL_CNAME_TARGET = process.env.VERCEL_DNS_TARGET || 'cname.vercel-dns.com'

export async function addCnameToHostinger(subdomain: string): Promise<{ ok: boolean; error?: string; notConfigured?: boolean }> {
  const apiKey = process.env.HOSTINGER_API_KEY

  if (!apiKey) return { ok: false, notConfigured: true, error: 'HOSTINGER_API_KEY not configured' }

  try {
    const res = await fetch(`${HOSTINGER_API}/dns/zones/${DNS_ZONE}/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: subdomain,
        content: VERCEL_CNAME_TARGET,
        ttl: 3600,
      }),
    })

    if (res.ok) return { ok: true }

    const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
    // Already exists = fine
    if (res.status === 409 || res.status === 422) return { ok: true }
    return { ok: false, error: data.message || data.error || `Hostinger API ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export function getManualDnsInstructions(subdomain: string) {
  const target = process.env.VERCEL_DNS_TARGET || 'cname.vercel-dns.com'
  return {
    type: 'CNAME',
    name: subdomain,
    value: target,
    ttl: 3600,
    instructions: `In Hostinger DNS Manager for cannaforyou.net, add:\nType: CNAME\nName: ${subdomain}\nPoints to: ${target}\nTTL: 3600`,
  }
}
