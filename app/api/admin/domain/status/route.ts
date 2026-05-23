import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { checkVercelDomainStatus } from '@/lib/domain/vercel'
import { getManualDnsInstructions } from '@/lib/domain/hostinger'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = (profile as { organization_id: string }).organization_id
    const admin = createServiceRole()

    const { data: org } = await admin.from('organizations')
      .select('id, subdomain, domain_status, domain_error, domain_last_checked_at')
      .eq('id', orgId)
      .single()

    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const orgData = org as { id: string; subdomain: string | null; domain_status: string; domain_error: string | null; domain_last_checked_at: string | null }

    if (!orgData.subdomain || orgData.domain_status === 'none') {
      return NextResponse.json({ status: 'none', subdomain: null })
    }

    // If already active, just return current status
    if (orgData.domain_status === 'active') {
      return NextResponse.json({
        status: 'active',
        subdomain: orgData.subdomain,
        url: `https://${orgData.subdomain}.cannaforyou.net`,
      })
    }

    // Check Vercel verification status
    const vercelStatus = await checkVercelDomainStatus(orgData.subdomain)

    let newStatus = orgData.domain_status
    if (vercelStatus.verified && vercelStatus.configured) {
      newStatus = 'active'
    }

    // Update last checked
    await admin.from('organizations').update({
      domain_status: newStatus,
      domain_last_checked_at: new Date().toISOString(),
    }).eq('id', orgId)

    const needsManualDns = orgData.domain_error?.includes('manual') || orgData.domain_error?.includes('DNS')

    return NextResponse.json({
      status: newStatus,
      subdomain: orgData.subdomain,
      url: `https://${orgData.subdomain}.cannaforyou.net`,
      vercelVerified: vercelStatus.verified,
      vercelConfigured: vercelStatus.configured,
      error: orgData.domain_error,
      manualDns: needsManualDns ? getManualDnsInstructions(orgData.subdomain) : undefined,
      lastChecked: orgData.domain_last_checked_at,
    })
  } catch (err) {
    console.error('[domain/status]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
