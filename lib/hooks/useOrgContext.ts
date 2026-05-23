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
  name: 'טלמדיסן',
  logoUrl: null,
  primaryColor: null,
  subdomain: null,
  isMarketplace: true,
}

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
        // Priority 1: patient already has an org
        if (patientOrgId) {
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
