'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, Badge, PageLoading } from '@/components/ui'
import { formatPrice, cn } from '@/lib/utils'
import { PLANS, FEATURE_LABELS } from '@/lib/config/plans'
import type { Organization } from '@/types/database'

// ── Status Labels ────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: 'פעיל',
  trial: 'תקופת ניסיון',
  suspended: 'מושעה',
  cancelled: 'בוטל',
}

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  active: 'success',
  trial: 'info',
  suspended: 'warning',
  cancelled: 'danger',
}

// ── Component ────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter()
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<Organization | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Invite form state
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadOrg()
  }, [])

  const loadOrg = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profile } = await supabase.from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
      router.push('/dashboard/admin/dashboard')
      return
    }

    const orgId = (profile as unknown as { organization_id: string }).organization_id
    const { data: orgData } = await supabase.from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (orgData) setOrg(orgData as unknown as Organization)
    setLoading(false)
  }

  const openStripePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'שגיאה בפתיחת פורטל התשלומים')
      }
    } catch {
      alert('שגיאה בחיבור לשרת')
    } finally {
      setPortalLoading(false)
    }
  }

  const sendInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteMessage(null)
    try {
      const res = await fetch('/api/admin/invite-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setInviteMessage({ type: 'success', text: `הזמנה נשלחה ל-${inviteEmail}` })
        setInviteName('')
        setInviteEmail('')
        // Refresh org to get updated pending_invites
        loadOrg()
      } else {
        setInviteMessage({ type: 'error', text: data.error || 'שליחת ההזמנה נכשלה' })
      }
    } catch {
      setInviteMessage({ type: 'error', text: 'שגיאה בחיבור לשרת' })
    } finally {
      setInviteLoading(false)
    }
  }

  // ── Helpers ────────────────────────────────────────

  const currentPlan = org ? PLANS.find(p => p.id === org.plan) : null
  const pendingInvites = (org?.settings?.pending_invites as Array<{ name: string; email: string }>) || []

  const getUsagePercent = (current: number, max: number) => {
    if (max === 0) return 0
    return Math.min(Math.round((current / max) * 100), 100)
  }

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 70) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  // ── Render ─────────────────────────────────────────

  if (loading || !org) {
    return <PageLoading />
  }

  const doctorsPercent = getUsagePercent(org.current_doctors, org.max_doctors)
  const appointmentsPercent = getUsagePercent(org.current_month_appointments, org.max_appointments_per_month)
  const storagePercent = getUsagePercent(org.current_storage_gb, org.max_storage_gb)

  return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">חיוב ומנוי</h2>
          <p className="text-gray-500 text-sm">ניהול התוכנית, תשלומים והזמנת רופאים</p>
        </div>

        {/* Subscription Status Alert */}
        {(org.subscription_status === 'suspended' || org.subscription_status === 'cancelled') && (
          <div className={cn(
            'p-4 rounded-lg border',
            org.subscription_status === 'suspended'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-red-50 border-red-200 text-red-800'
          )}>
            <p className="font-medium">
              {org.subscription_status === 'suspended'
                ? 'התשלום נכשל — המנוי מושעה. אנא עדכנו את אמצעי התשלום.'
                : 'המנוי בוטל. חלק מהתכונות אינן זמינות.'}
            </p>
          </div>
        )}

        {/* Current Plan + Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Info */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">התוכנית שלך</h3>
                  <p className="text-gray-500 text-sm">{currentPlan?.description}</p>
                </div>
                <Badge variant={STATUS_VARIANTS[org.subscription_status] || 'default'}>
                  {STATUS_LABELS[org.subscription_status] || org.subscription_status}
                </Badge>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600">
                  {currentPlan?.price_monthly === 0 ? 'חינם' : formatPrice(currentPlan?.price_monthly || 0)}
                </span>
                {(currentPlan?.price_monthly || 0) > 0 && (
                  <span className="text-gray-400 text-sm">/חודש</span>
                )}
              </div>

              {org.subscription_status === 'trial' && org.trial_ends_at && (
                <p className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                  תקופת הניסיון מסתיימת ב-{new Date(org.trial_ends_at).toLocaleDateString('he-IL')}
                </p>
              )}

              {Boolean(org.settings?.stripe_customer_id) && (
                <Button
                  onClick={openStripePortal}
                  loading={portalLoading}
                  variant="outline"
                  className="w-full"
                >
                  ניהול תשלומים ב-Stripe
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Usage */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="font-bold text-lg">שימוש נוכחי</h3>

              {/* Doctors */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">רופאים</span>
                  <span className="font-medium">{org.current_doctors} / {org.max_doctors}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getUsageColor(doctorsPercent))}
                    style={{ width: `${doctorsPercent}%` }}
                  />
                </div>
              </div>

              {/* Appointments */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">תורים החודש</span>
                  <span className="font-medium">{org.current_month_appointments.toLocaleString()} / {org.max_appointments_per_month.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getUsageColor(appointmentsPercent))}
                    style={{ width: `${appointmentsPercent}%` }}
                  />
                </div>
              </div>

              {/* Storage */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">אחסון</span>
                  <span className="font-medium">{org.current_storage_gb} GB / {org.max_storage_gb} GB</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getUsageColor(storagePercent))}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Comparison */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold text-lg mb-4">השוואת תוכניות</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-3 font-medium text-gray-600">תוכנית</th>
                    {PLANS.map(p => (
                      <th key={p.id} className={cn(
                        'p-3 text-center font-medium',
                        p.id === org.plan ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                      )}>
                        <div>{p.name}</div>
                        <div className="text-xs font-normal mt-0.5">
                          {p.price_monthly === 0 ? 'חינם' : `${formatPrice(p.price_monthly)}/חודש`}
                        </div>
                        {p.id === org.plan && (
                          <Badge variant="info" className="mt-1">נוכחי</Badge>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 text-gray-600">מקסימום רופאים</td>
                    {PLANS.map(p => (
                      <td key={p.id} className={cn('p-3 text-center', p.id === org.plan && 'bg-blue-50/50')}>
                        {p.max_doctors}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 text-gray-600">תורים/חודש</td>
                    {PLANS.map(p => (
                      <td key={p.id} className={cn('p-3 text-center', p.id === org.plan && 'bg-blue-50/50')}>
                        {p.max_appointments_per_month.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 text-gray-600">אחסון</td>
                    {PLANS.map(p => (
                      <td key={p.id} className={cn('p-3 text-center', p.id === org.plan && 'bg-blue-50/50')}>
                        {p.max_storage_gb} GB
                      </td>
                    ))}
                  </tr>
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <tr key={key} className="border-b last:border-b-0">
                      <td className="p-3 text-gray-600">{label}</td>
                      {PLANS.map(p => (
                        <td key={p.id} className={cn('p-3 text-center', p.id === org.plan && 'bg-blue-50/50')}>
                          {p.features[key] ? (
                            <span className="text-green-600 font-bold">V</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Doctor Invites */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">הזמנת רופאים</h3>
                <p className="text-gray-500 text-sm">שלחו הזמנה לרופאים להצטרף למרפאה</p>
              </div>
              <span className="text-sm text-gray-500">
                {org.current_doctors} / {org.max_doctors} רופאים
              </span>
            </div>

            {/* Invite Form */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="שם הרופא"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                className="flex-1"
              />
              <Input
                type="email"
                placeholder="אימייל"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={sendInvite}
                loading={inviteLoading}
                disabled={!inviteName.trim() || !inviteEmail.trim() || org.current_doctors >= org.max_doctors}
                className="shrink-0"
              >
                שלח הזמנה
              </Button>
            </div>

            {org.current_doctors >= org.max_doctors && (
              <p className="text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                הגעת למקסימום הרופאים בתוכנית שלך. שדרגו את התוכנית כדי להוסיף עוד רופאים.
              </p>
            )}

            {inviteMessage && (
              <div className={cn(
                'p-3 rounded-lg text-sm',
                inviteMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              )} role="alert">
                {inviteMessage.text}
              </div>
            )}

            {/* Pending Invites List */}
            {pendingInvites.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">הזמנות ממתינות ({pendingInvites.length})</p>
                <div className="space-y-2">
                  {pendingInvites.map((inv, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                      <div>
                        <span className="text-sm font-medium">{inv.name}</span>
                        <span className="text-sm text-gray-500 mr-2">{inv.email}</span>
                      </div>
                      <Badge variant="warning">ממתין</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}
