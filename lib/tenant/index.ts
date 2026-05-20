/**
 * Tenant / Subdomain helpers
 *
 * Architecture:
 *  - Main platform:  app.cannaforyou.net  (or localhost)
 *  - Clinic tenant:  {subdomain}.cannaforyou.net
 *
 * Reserved subdomains that are NOT tenants:
 *   app, www, mail, api, admin
 */

const RESERVED_SUBDOMAINS = new Set(['app', 'www', 'mail', 'api', 'admin'])
const ROOT_DOMAINS = ['localhost', 'cannaforyou.net', 'vercel.app']

/**
 * Given a hostname, return the clinic subdomain if one is present.
 * Returns null for the main platform (app.*, www.*, localhost, etc.)
 *
 * Examples:
 *   "clinic-haifa.cannaforyou.net"  → "clinic-haifa"
 *   "app.cannaforyou.net"           → null  (reserved)
 *   "localhost:3000"                → null  (root)
 *   "cannaforyou.net"               → null  (root, no subdomain)
 */
export function getTenantSubdomain(hostname: string): string | null {
  // Strip port if present
  const host = hostname.split(':')[0]

  // Check if it's a plain root domain or localhost
  if (ROOT_DOMAINS.some(r => host === r || host === `www.${r}`)) return null

  const parts = host.split('.')

  // Need at least 3 parts to have a subdomain: sub.domain.tld
  if (parts.length < 3) return null

  const sub = parts[0].toLowerCase()

  if (RESERVED_SUBDOMAINS.has(sub)) return null

  return sub
}

/**
 * Returns true if the request comes from the main platform (not a tenant).
 */
export function isMainPlatform(hostname: string): boolean {
  return getTenantSubdomain(hostname) === null
}

/**
 * Build the full URL for a clinic's subdomain (for generating invite links etc.)
 */
export function buildClinicUrl(subdomain: string, path = ''): string {
  const baseHost = process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')
    ? 'http://localhost:3000'
    : `https://${subdomain}.cannaforyou.net`
  return `${baseHost}${path}`
}
