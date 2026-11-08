import { cache } from 'react'
import { headers } from 'next/headers'
import { createServiceRole } from '@/lib/supabase/server'
import { getTenantSubdomain } from '@/lib/tenant'

/**
 * Which clinic a request is for, resolved on the SERVER from the Host header.
 *
 *  - platform: the central site (app.cannaforyou.net, localhost, *.vercel.app) —
 *              the cross-clinic marketplace.
 *  - clinic:   a clinic subdomain or custom domain that maps to an organization.
 *  - unknown:  a clinic-looking host with no organization behind it. Callers must
 *              show nothing for it — never fall back to the marketplace.
 *
 * Doctor listings, booking and slot lookups use this so that a clinic's site
 * never shows (or books) another clinic's doctors, whatever the browser sends.
 */
export type RequestTenant =
  | { kind: 'platform' }
  | { kind: 'clinic'; orgId: string; host: string }
  | { kind: 'unknown'; host: string }

const PLATFORM_HOSTS = new Set([
  'localhost', '127.0.0.1', 'cannaforyou.net', 'www.cannaforyou.net', 'app.cannaforyou.net',
])

export async function resolveTenantFromHost(rawHost: string | null | undefined): Promise<RequestTenant> {
  const host = (rawHost || '').split(':')[0].toLowerCase().trim()
  if (!host || PLATFORM_HOSTS.has(host)) return { kind: 'platform' }

  const admin = createServiceRole()
  const sub = getTenantSubdomain(host)

  if (sub && (host.endsWith('.cannaforyou.net') || host.endsWith('.localhost'))) {
    const { data } = await admin.from('organizations')
      .select('id').eq('subdomain', sub).maybeSingle()
    const id = (data as { id: string } | null)?.id
    return id ? { kind: 'clinic', orgId: id, host } : { kind: 'unknown', host }
  }

  // A clinic's own domain (organizations.custom_domain).
  const { data } = await admin.from('organizations')
    .select('id').eq('custom_domain', host).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (id) return { kind: 'clinic', orgId: id, host }

  // Not one of ours and not a clinic: platform-only hosts such as *.vercel.app.
  return { kind: 'platform' }
}

/** Tenant for the current request (Server Components / Route Handlers). */
export const getRequestTenant = cache(async (): Promise<RequestTenant> => {
  const h = await headers()
  return resolveTenantFromHost(h.get('host'))
})

/**
 * The origin to put in links we send (emails, redirects), from the Host header —
 * but only for hosts we recognise (a resolved clinic host or one of the
 * platform hosts), so a forged Host can never point a link elsewhere.
 */
export function trustedOrigin(h: Headers, tenant: RequestTenant): string {
  const rawHost = (h.get('host') || '').toLowerCase().trim()
  const host = rawHost.split(':')[0]
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' || host.endsWith('cannaforyou.net') ? 'https' : 'http'
  if (tenant.kind === 'clinic' || PLATFORM_HOSTS.has(host) || host.endsWith('.vercel.app')) return `${proto}://${rawHost}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://app.cannaforyou.net').replace(/\/$/, '')
}
