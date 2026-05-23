// Hostinger DNS API v1
// Docs: https://developers.hostinger.com
// Zone: cannaforyou.net

const HOSTINGER_API = 'https://api.hostinger.com/api/dns/v1'
const DNS_ZONE = 'cannaforyou.net'

function getApiKey() {
  return process.env.HOSTINGER_API_KEY
}

function getVercelTarget() {
  return process.env.VERCEL_DNS_TARGET || 'cname.vercel-dns.com'
}

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

// Add a CNAME record (merge — does not overwrite existing records)
export async function addCnameToHostinger(
  subdomain: string,
): Promise<{ ok: boolean; error?: string; notConfigured?: boolean }> {
  const apiKey = getApiKey()
  if (!apiKey) return { ok: false, notConfigured: true, error: 'HOSTINGER_API_KEY not configured' }

  try {
    const res = await fetch(`${HOSTINGER_API}/zones/${DNS_ZONE}`, {
      method: 'PUT',
      headers: headers(apiKey),
      body: JSON.stringify({
        overwrite: false,
        zone: [
          {
            name: subdomain,
            type: 'CNAME',
            ttl: 3600,
            records: [{ content: `${getVercelTarget()}.` }],
          },
        ],
      }),
    })

    if (res.ok) return { ok: true }

    const data = await res.json().catch(() => ({})) as { message?: string; errors?: unknown }
    return { ok: false, error: (data.message) || `Hostinger API ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// Delete a CNAME record (by name + type)
export async function deleteCnameFromHostinger(
  subdomain: string,
): Promise<{ ok: boolean; error?: string; notConfigured?: boolean }> {
  const apiKey = getApiKey()
  if (!apiKey) return { ok: false, notConfigured: true }

  try {
    const res = await fetch(`${HOSTINGER_API}/zones/${DNS_ZONE}`, {
      method: 'DELETE',
      headers: headers(apiKey),
      body: JSON.stringify({
        filters: [{ name: subdomain, type: 'CNAME' }],
      }),
    })

    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({})) as { message?: string }
    return { ok: false, error: data.message || `Hostinger DELETE ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// Check if CNAME already exists (returns true if found)
export async function checkCnameExists(subdomain: string): Promise<boolean> {
  const apiKey = getApiKey()
  if (!apiKey) return false

  try {
    const res = await fetch(`${HOSTINGER_API}/zones/${DNS_ZONE}`, {
      headers: headers(apiKey),
    })
    if (!res.ok) return false

    const records = await res.json() as Array<{ name: string; type: string }>
    return records.some(r => r.name === subdomain && r.type === 'CNAME')
  } catch {
    return false
  }
}

export function getManualDnsInstructions(subdomain: string) {
  const target = getVercelTarget()
  return {
    type: 'CNAME',
    name: subdomain,
    value: `${target}.`,
    ttl: 3600,
    instructions: `In Hostinger DNS Manager for ${DNS_ZONE}, add:\nType: CNAME\nName: ${subdomain}\nPoints to: ${target}.\nTTL: 3600`,
  }
}
