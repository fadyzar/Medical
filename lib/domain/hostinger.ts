// Hostinger DNS API v1
// Docs: https://developers.hostinger.com/api/dns/v1
// Zone: cannaforyou.net

const HOSTINGER_API = 'https://developers.hostinger.com/api/dns/v1'
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

// Add a CNAME record — PUT /zones/{zone} with overwrite:false merges records
export async function addCnameToHostinger(
  subdomain: string,
): Promise<{ ok: boolean; error?: string; notConfigured?: boolean }> {
  const apiKey = getApiKey()
  if (!apiKey) return { ok: false, notConfigured: true, error: 'HOSTINGER_API_KEY not configured' }

  const url = `${HOSTINGER_API}/zones/${DNS_ZONE}`
  const target = getVercelTarget()
  const content = target.endsWith('.') ? target : `${target}.`

  const body = {
    overwrite: false,
    zone: [
      {
        name: subdomain,
        type: 'CNAME',
        ttl: 14400,
        records: [{ content }],
      },
    ],
  }

  console.log('[Hostinger] PUT →', url)
  console.log('[Hostinger] body →', JSON.stringify(body))

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: headers(apiKey),
      body: JSON.stringify(body),
    })

    const text = await res.text()
    console.log('[Hostinger] status →', res.status)
    console.log('[Hostinger] response →', text)

    if (res.ok) return { ok: true }

    let data: { message?: string; errors?: unknown } = {}
    try { data = JSON.parse(text) } catch { /* raw text */ }
    return { ok: false, error: data.message || `Hostinger API ${res.status}: ${text}` }
  } catch (err) {
    console.error('[Hostinger] network error →', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// Delete a CNAME record
export async function deleteCnameFromHostinger(
  subdomain: string,
): Promise<{ ok: boolean; error?: string; notConfigured?: boolean }> {
  const apiKey = getApiKey()
  if (!apiKey) return { ok: false, notConfigured: true }

  const url = `${HOSTINGER_API}/zones/${DNS_ZONE}`

  try {
    // GET current zone records
    const listRes = await fetch(url, { headers: headers(apiKey) })
    if (!listRes.ok) return { ok: false, error: `Hostinger list ${listRes.status}` }

    const zone = await listRes.json() as { zone?: { records?: Array<{ id?: string; name: string; type: string }> } }
    const records = zone?.zone?.records || []
    const record = records.find(r => r.name === subdomain && r.type === 'CNAME')
    if (!record) return { ok: true } // already gone

    // Re-PUT the zone without this record
    const remaining = records.filter(r => !(r.name === subdomain && r.type === 'CNAME'))
    const delRes = await fetch(url, {
      method: 'PUT',
      headers: headers(apiKey),
      body: JSON.stringify({ overwrite: true, zone: { records: remaining } }),
    })
    if (delRes.ok) return { ok: true }
    const data = await delRes.json().catch(() => ({})) as { message?: string }
    return { ok: false, error: data.message || `Hostinger DELETE ${delRes.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// Check if CNAME already exists
export async function checkCnameExists(subdomain: string): Promise<boolean> {
  const apiKey = getApiKey()
  if (!apiKey) return false

  try {
    const res = await fetch(`${HOSTINGER_API}/zones/${DNS_ZONE}`, { headers: headers(apiKey) })
    if (!res.ok) return false
    const zone = await res.json() as { zone?: { records?: Array<{ name: string; type: string }> } }
    return (zone?.zone?.records || []).some(r => r.name === subdomain && r.type === 'CNAME')
  } catch {
    return false
  }
}

export function getManualDnsInstructions(subdomain: string) {
  const target = getVercelTarget()
  return {
    type: 'CNAME',
    name: subdomain,
    value: target.endsWith('.') ? target : `${target}.`,
    ttl: 14400,
    instructions: `In Hostinger DNS Manager for ${DNS_ZONE}, add:\nType: CNAME\nName: ${subdomain}\nPoints to: ${target}.\nTTL: 14400`,
  }
}
