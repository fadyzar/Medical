'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getTenantSubdomain } from '@/lib/tenant'
import { DEFAULT_BRAND, brandFromOrg, type Brand } from '@/lib/branding'

const BrandContext = createContext<Brand>(DEFAULT_BRAND)

export function useBrand(): Brand {
  return useContext(BrandContext)
}

/**
 * Resolves the active clinic brand for pre-auth surfaces (login, register,
 * 404, etc.) and exposes it via context + CSS variables.
 *
 * Resolution order:
 *   1. clinic subdomain  (clinic.cannaforyou.net)
 *   2. ?org=<id> param   (invite / clinic deep-links)
 *   3. platform default  (CANNA marketplace)
 */
export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      try {
        const sub = getTenantSubdomain(window.location.hostname)
        const orgParam = new URLSearchParams(window.location.search).get('org')

        let url: string | null = null
        if (sub) url = `/api/org/by-subdomain?subdomain=${encodeURIComponent(sub)}`
        else if (orgParam) url = `/api/org/by-id?id=${encodeURIComponent(orgParam)}`
        if (!url) return

        const res = await fetch(url)
        if (!res.ok || cancelled) return
        const org = await res.json()
        setBrand(brandFromOrg(org))
      } catch {
        /* keep default brand */
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [])

  // Expose brand colors as CSS variables for any component that opts in.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--brand-primary', brand.primaryColor)
    root.style.setProperty('--brand-secondary', brand.secondaryColor)
  }, [brand])

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

/** Inline brand name — usable inside server components as a client island. */
export function BrandName() {
  return <>{useBrand().name}</>
}

/** Inline brand support email link — usable inside server components. */
export function BrandSupportEmail({ className }: { className?: string }) {
  const email = useBrand().supportEmail
  return <a href={`mailto:${email}`} className={className}>{email}</a>
}
