'use client'

import { useEffect, useState } from 'react'
import { getTenantSubdomain } from '@/lib/tenant'

export interface OrgContext {
  id: string | null       // null = marketplace mode, no org pre-selected
  name: string
  logoUrl: string | null
  primaryColor: string | null
  subdomain: string | null
  isMarketplace: boolean
}

const MARKETPLACE: OrgContext = {
  id: null,
  name: 'CANNA',
  logoUrl: null,
  primaryColor: null,
  subdomain: null,
  isMarketplace: true,
}

// The seed "default" organization is a placeholder, NOT a real clinic.
// Patients sitting in it must be treated as marketplace so they can see
// (and book) doctors across the whole platform.
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

type OrgData = { id: string; name: string; logo_url?: string | null; primary_color?: string | null; subdomain?: string | null }

function toCtx(data: OrgData): OrgContext {
  return {
    id: data.id,
    name: data.name,
    logoUrl: data.logo_url ?? null,
    primaryColor: data.primary_color ?? null,
    subdomain: data.subdomain ?? null,
    isMarketplace: false,
  }
}

/**
 * Resolves the current org context:
 *  1. If patientOrgId is set → clinic mode (patient already belongs to an org)
 *  2. Else if current hostname is a subdomain → clinic mode (fetch org by subdomain)
 *  3. Else → marketplace mode (isMarketplace = true, id = null)
 */
export function useOrgContext(patientOrgId?: string | null): { ctx: OrgContext; loading: boolean } {
  const [ctx, setCtx] = useState<OrgContext>(MARKETPLACE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      try {
        // Priority 1: patient already has a *real* org (not the placeholder default)
        if (patientOrgId && patientOrgId !== DEFAULT_ORG_ID) {
          const r = await fetch(`/api/org/by-id?id=${patientOrgId}`)
          if (!cancelled && r.ok) {
            const data: OrgData = await r.json()
            setCtx(toCtx(data))
          } else if (!cancelled) {
            setCtx(MARKETPLACE)
          }
          return
        }

        // Priority 2: subdomain
        const subdomain = getTenantSubdomain(window.location.hostname)
        if (subdomain) {
          const r = await fetch(`/api/org/by-subdomain?subdomain=${subdomain}`)
          if (!cancelled && r.ok) {
            const data: OrgData = await r.json()
            setCtx(toCtx(data))
          } else if (!cancelled) {
            setCtx(MARKETPLACE)
          }
          return
        }

        // Priority 3: marketplace
        if (!cancelled) setCtx(MARKETPLACE)
      } catch {
        if (!cancelled) setCtx(MARKETPLACE)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [patientOrgId])

  return { ctx, loading }
}
