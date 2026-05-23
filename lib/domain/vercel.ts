// Uses env vars: VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID (optional)

export async function addDomainToVercel(subdomain: string): Promise<{ ok: boolean; alreadyExists?: boolean; error?: string }> {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token || !projectId) return { ok: false, error: 'VERCEL_TOKEN or VERCEL_PROJECT_ID not configured' }

  const domain = `${subdomain}.cannaforyou.net`
  const teamQuery = teamId ? `?teamId=${teamId}` : ''
  const url = `https://api.vercel.com/v10/projects/${projectId}/domains${teamQuery}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: domain }),
  })

  const data = await res.json() as { error?: { code?: string; message?: string } }

  if (res.ok) return { ok: true }
  // Already in project = success
  if (data.error?.code === 'domain_already_in_project') return { ok: true, alreadyExists: true }
  return { ok: false, error: data.error?.message || `Vercel API error ${res.status}` }
}

export async function removeDomainFromVercel(subdomain: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token || !projectId) return { ok: false, error: 'VERCEL_TOKEN or VERCEL_PROJECT_ID not configured' }

  const domain = `${subdomain}.cannaforyou.net`
  const teamQuery = teamId ? `?teamId=${teamId}` : ''
  const url = `https://api.vercel.com/v10/projects/${projectId}/domains/${domain}${teamQuery}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  return { ok: res.ok || res.status === 404 }
}

export async function checkVercelDomainStatus(subdomain: string): Promise<{ verified: boolean; configured: boolean; error?: string }> {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token || !projectId) return { verified: false, configured: false, error: 'Not configured' }

  const domain = `${subdomain}.cannaforyou.net`
  const teamQuery = teamId ? `?teamId=${teamId}` : ''
  const url = `https://api.vercel.com/v10/projects/${projectId}/domains/${domain}${teamQuery}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return { verified: false, configured: false, error: `Vercel API ${res.status}` }
  const data = await res.json() as { verified?: boolean; misconfigured?: boolean }
  return { verified: !!data.verified, configured: !data.misconfigured }
}
