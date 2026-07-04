/**
 * White-label branding model.
 *
 * The public marketplace (main app domain) uses DEFAULT_BRAND (the platform).
 * Clinic-scoped surfaces (a clinic subdomain, an invite link with ?org=,
 * or an authenticated dashboard) resolve the clinic's own brand.
 */

export type Brand = {
  name: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string | null
  supportEmail: string
}

// Platform default — the CANNA marketplace brand.
export const DEFAULT_BRAND: Brand = {
  name: 'CANNA',
  tagline: 'ייעוץ רפואי אונליין',
  primaryColor: '#2563eb',
  secondaryColor: '#0d9488',
  logoUrl: null,
  supportEmail: 'medical@cannaforyou.net',
}

// Minimal org shape returned by the public org endpoints.
export type OrgBrandInput = {
  name?: string | null
  logo_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  support_email?: string | null
  contact_email?: string | null
}

/** Build a Brand from an organization row, falling back to platform defaults. */
export function brandFromOrg(org: OrgBrandInput | null | undefined): Brand {
  if (!org) return DEFAULT_BRAND
  return {
    name: org.name?.trim() || DEFAULT_BRAND.name,
    tagline: DEFAULT_BRAND.tagline,
    primaryColor: org.primary_color || DEFAULT_BRAND.primaryColor,
    secondaryColor: org.secondary_color || DEFAULT_BRAND.secondaryColor,
    logoUrl: org.logo_url || null,
    supportEmail: org.support_email || org.contact_email || DEFAULT_BRAND.supportEmail,
  }
}
