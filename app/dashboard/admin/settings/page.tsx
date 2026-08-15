'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardHeader, CardContent, PageLoading, Spinner } from '@/components/ui'
import { uploadLogo } from '@/lib/supabase/storage'
import { adminSettingsSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import type { Organization } from '@/types/database'

type WorkingHours = {
  day: number
  label: string
  enabled: boolean
  start: string
  end: string
}

const DEFAULT_HOURS: WorkingHours[] = [
  { day: 0, label: 'ראשון', enabled: true, start: '08:00', end: '17:00' },
  { day: 1, label: 'שני', enabled: true, start: '08:00', end: '17:00' },
  { day: 2, label: 'שלישי', enabled: true, start: '08:00', end: '17:00' },
  { day: 3, label: 'רביעי', enabled: true, start: '08:00', end: '17:00' },
  { day: 4, label: 'חמישי', enabled: true, start: '08:00', end: '17:00' },
  { day: 5, label: 'שישי', enabled: true, start: '08:00', end: '13:00' },
  { day: 6, label: 'שבת', enabled: false, start: '08:00', end: '17:00' },
]

function DomainCard({ orgId, currentSubdomain }: { orgId: string; currentSubdomain: string | null }) {
  const [subdomain, setSubdomain] = useState(currentSubdomain || '')
  const [status, setStatus] = useState<string>('none')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{
    url?: string
    vercelVerified?: boolean
    error?: string | null
    manualDns?: { type: string; name: string; value: string; instructions: string }
    lastChecked?: string
  } | null>(null)

  useEffect(() => {
    checkStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkStatus() {
    setChecking(true)
    try {
      const res = await fetch('/api/admin/domain/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data.status || 'none')
        setResult(data)
        if (data.subdomain) setSubdomain(data.subdomain)
      }
    } catch { /* non-critical */ } finally {
      setChecking(false)
    }
  }

  async function provision() {
    if (!subdomain || subdomain.length < 3) {
      toast.error('יש להזין סאבדומיין (לפחות 3 תווים)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/domain/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.toLowerCase().trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus(data.status)
        setResult(data)
        if (data.status === 'active') {
          toast.success('הדומיין מוכן ופעיל!')
        } else if (data.dnsManual) {
          toast.success('נוסף ל-Vercel! יש להוסיף את רשומת DNS ידנית.')
        } else {
          toast.success('הדומיין בתהליך הגדרה — בדוק שוב בעוד כמה דקות')
        }
      } else {
        toast.error(data.error || 'שגיאה בהגדרת הדומיין')
      }
    } catch {
      toast.error('שגיאת רשת')
    } finally {
      setLoading(false)
    }
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    none:        { label: 'לא הוגדר', color: 'bg-slate-100 text-slate-600' },
    pending:     { label: 'מוגדר...', color: 'bg-yellow-100 text-yellow-700' },
    vercel_added:{ label: 'ממתין ל-DNS', color: 'bg-teal-100 text-teal-700' },
    active:      { label: 'פעיל', color: 'bg-green-100 text-green-700' },
    failed:      { label: 'שגיאה', color: 'bg-red-100 text-red-700' },
  }
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.none
  const canEdit = status === 'none' || status === 'failed'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            <h3 className="font-bold">דומיין המרפאה</h3>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          הגדר כתובת ייחודית למרפאה: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">שם.cannaforyou.net</code>
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">

          {/* Active domain */}
          {status === 'active' && result?.url && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <svg className="w-5 h-5 text-green-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">הדומיין פעיל</p>
                <a href={result.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-green-700 hover:underline font-mono truncate block">
                  {result.url}
                </a>
              </div>
            </div>
          )}

          {/* Subdomain input */}
          {canEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">סאבדומיין</label>
              <div className="flex items-center gap-0">
                <input
                  type="text"
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="shalom"
                  className="flex-1 rounded-r-xl border border-l-0 border-slate-300 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                  dir="ltr"
                />
                <span className="bg-slate-100 border border-slate-300 rounded-l-xl px-3 py-2.5 text-sm text-slate-500 font-mono whitespace-nowrap">
                  .cannaforyou.net
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">אותיות קטנות באנגלית, מספרים ומקף בלבד</p>
            </div>
          )}

          {/* Show current subdomain when not editing */}
          {!canEdit && subdomain && status !== 'active' && (
            <div className="flex items-center gap-2 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
              <span className="text-slate-500">URL:</span>
              <span className="text-slate-800">{subdomain}.cannaforyou.net</span>
            </div>
          )}

          {/* Waiting for DNS — vercel_added */}
          {status === 'vercel_added' && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
              <p className="font-semibold mb-1">נוסף ל-Vercel — ממתין לאימות DNS</p>
              <p className="text-xs text-teal-600">לאחר שה-DNS מתפשט (עד 5 דקות) לחץ ״בדוק סטטוס״.</p>
            </div>
          )}

          {/* Manual DNS instructions */}
          {result?.manualDns && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-sm font-semibold text-amber-800">יש להוסיף רשומת DNS ידנית בהוסטינגר</p>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-3 font-mono text-xs space-y-1">
                <div className="flex gap-4">
                  <span className="text-slate-400 w-16 shrink-0">Type:</span>
                  <span className="text-slate-900 font-semibold">{result.manualDns.type}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-400 w-16 shrink-0">Name:</span>
                  <span className="text-slate-900 font-semibold">{result.manualDns.name}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-400 w-16 shrink-0">Value:</span>
                  <span className="text-slate-900 font-semibold break-all">{result.manualDns.value}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-400 w-16 shrink-0">TTL:</span>
                  <span className="text-slate-900">3600</span>
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`Type: CNAME\nName: ${result.manualDns!.name}\nValue: ${result.manualDns!.value}\nTTL: 3600`).then(() => toast.success('הועתק!'))}
                className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                העתק פרטי DNS
              </button>
            </div>
          )}

          {/* Error */}
          {status === 'failed' && result?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <p className="font-semibold mb-0.5">שגיאה בהגדרת הדומיין</p>
              <p className="text-xs text-red-600 font-mono">{result.error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {canEdit && (
              <Button onClick={provision} loading={loading} className="flex-1">
                {status === 'failed' ? 'נסה שוב' : 'הפעל דומיין'}
              </Button>
            )}
            {!canEdit && (
              <Button onClick={provision} loading={loading} variant="outline" className="flex-1">
                שנה דומיין
              </Button>
            )}
            <Button onClick={checkStatus} loading={checking} variant="outline">
              {checking ? 'בודק...' : 'בדוק סטטוס'}
            </Button>
          </div>

          {result?.lastChecked && (
            <p className="text-xs text-slate-400 text-center">
              בדיקה אחרונה: {new Date(result.lastChecked).toLocaleTimeString('he-IL')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [org, setOrg] = useState<Organization | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form state
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [primaryColor, setPrimaryColor] = useState('#2563EB')
  const [secondaryColor, setSecondaryColor] = useState('#7C3AED')
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>(DEFAULT_HOURS)
  const [cancellationHours, setCancellationHours] = useState('24')
  const [cancellationFeePercent, setCancellationFeePercent] = useState('0')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [autoReminder24h, setAutoReminder24h] = useState(true)
  const [autoReminder1h, setAutoReminder1h] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)

  const supabase = getClient()

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return

      const { data } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
      if (!data) return

      const organization = data as unknown as Organization
      setOrg(organization)

      // Populate form
      setName(organization.name)
      setContactEmail(organization.contact_email || '')
      setContactPhone(organization.contact_phone || '')
      setLogoUrl(organization.logo_url || '')
      setPrimaryColor(organization.primary_color || '#2563EB')
      setSecondaryColor(organization.secondary_color || '#7C3AED')

      // Settings from JSON
      const settings = organization.settings || {}
      if (settings.working_hours && Array.isArray(settings.working_hours)) {
        setWorkingHours(settings.working_hours as WorkingHours[])
      }
      setCancellationHours(String(settings.cancellation_hours || '24'))
      setCancellationFeePercent(String(settings.cancellation_fee_percent || '0'))
      setDefaultPrice(String(settings.default_consultation_price || ''))
      setAutoReminder24h(settings.auto_reminder_24h !== false)
      setAutoReminder1h(settings.auto_reminder_1h !== false)

      // Features
      const features = organization.features || {}
      setEmailNotifications(features.email_notifications !== false)
    } catch {
      toast.error('שגיאה בטעינת ההגדרות')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !org) return

    setUploadingLogo(true)

    const { publicUrl, error: uploadErr } = await uploadLogo(supabase, file, { orgId: org.id })

    if (uploadErr || !publicUrl) {
      toast.error(uploadErr || 'שגיאה בהעלאת הלוגו')
      setUploadingLogo(false)
      return
    }

    setLogoUrl(publicUrl)
    setUploadingLogo(false)
  }

  async function handleSave() {
    if (!org) return

    const result = adminSettingsSchema.safeParse({
      name,
      contact_email: contactEmail || undefined,
      contact_phone: contactPhone || undefined,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      default_price: defaultPrice || undefined,
    })
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.errors.forEach(e => {
        const key = e.path[0] as string
        errors[key] = e.message
      })
      setFieldErrors(errors)
      return
    }

    setSaving(true)
    setFieldErrors({})

    const settings: Record<string, unknown> = {
      ...(org.settings || {}),
      working_hours: workingHours,
      cancellation_hours: Number(cancellationHours),
      cancellation_fee_percent: Number(cancellationFeePercent),
      default_consultation_price: defaultPrice ? Number(defaultPrice) : null,
      auto_reminder_24h: autoReminder24h,
      auto_reminder_1h: autoReminder1h,
    }

    const features: Record<string, boolean> = {
      ...(org.features || {}),
      email_notifications: emailNotifications,
    }

    try {
      const { error: err } = await supabase.from('organizations').update({
        name,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        logo_url: logoUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        settings,
        features,
      }).eq('id', org.id)

      if (err) {
        toast.error('שגיאה בשמירה: ' + err.message)
      } else {
        toast.success('ההגדרות נשמרו בהצלחה')
      }
    } catch {
      toast.error('שגיאת רשת בשמירת ההגדרות')
    }
    setSaving(false)
  }

  function updateHour(dayIndex: number, field: keyof WorkingHours, value: string | boolean) {
    setWorkingHours(prev => prev.map((h, i) => i === dayIndex ? { ...h, [field]: value } : h))
  }

  if (loading) return <PageLoading />

  // Build patient registration URLs
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const subdomainUrl = org?.subdomain
    ? `https://${org.subdomain}.cannaforyou.net/auth/register`
    : null
  const orgLinkUrl = org ? `${appOrigin}/auth/register?org=${org.id}` : ''

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => toast.success('הקישור הועתק!'))
  }

  function whatsappShare(url: string) {
    const text = encodeURIComponent(`היי! הירשם כמטופל ב${org?.name || 'המרפאה'} דרך הקישור הבא:\n${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">הגדרות מרפאה</h2>

      {/* ── Patient Invite Links ───────────────────────────── */}
      <Card className="border-teal-200 bg-teal-50/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            <h3 className="font-bold text-teal-900">הזמנת מטופלים</h3>
          </div>
          <p className="text-sm text-teal-700 mt-1">שתף קישור זה עם מטופלים — הם יירשמו ישירות תחת המרפאה שלך</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">

            {/* Subdomain link — primary */}
            {subdomainUrl && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  קישור מרפאה (מומלץ)
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-teal-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-700 truncate select-all">
                    {subdomainUrl}
                  </div>
                  <button
                    onClick={() => copyLink(subdomainUrl)}
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors flex items-center gap-1.5"
                    title="העתק קישור"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    העתק
                  </button>
                  <button
                    onClick={() => whatsappShare(subdomainUrl)}
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors flex items-center gap-1.5"
                    title="שתף ב-WhatsApp"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                </div>
                <p className="text-xs text-slate-400">מטופלים שנרשמים דרך קישור זה מקבלים ישירות את חווית המרפאה שלך</p>
              </div>
            )}

            {/* Fallback / universal link */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {subdomainUrl ? 'קישור חלופי (ללא subdomain)' : 'קישור הרשמת מטופלים'}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-700 truncate select-all">
                  {orgLinkUrl}
                </div>
                <button
                  onClick={() => copyLink(orgLinkUrl)}
                  className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  title="העתק קישור"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  העתק
                </button>
                <button
                  onClick={() => whatsappShare(orgLinkUrl)}
                  className="shrink-0 px-3 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors flex items-center gap-1.5"
                  title="שתף ב-WhatsApp"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Domain Management ─────────────────────────────── */}
      <DomainCard orgId={org?.id ?? ''} currentSubdomain={org?.subdomain ?? null} />

      {/* Basic Info */}
      <Card>
        <CardHeader><h3 className="font-bold">פרטי המרפאה</h3></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input label="שם המרפאה" value={name} onChange={e => { setName(e.target.value); setFieldErrors(p => { const n = { ...p }; delete n.name; return n }) }} error={fieldErrors.name} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="אימייל ליצירת קשר" type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); setFieldErrors(p => { const n = { ...p }; delete n.contact_email; return n }) }} error={fieldErrors.contact_email} />
              <Input label="טלפון" type="tel" value={contactPhone} onChange={e => { setContactPhone(e.target.value); setFieldErrors(p => { const n = { ...p }; delete n.contact_phone; return n }) }} error={fieldErrors.contact_phone} placeholder="03-1234567" />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">לוגו המרפאה</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="לוגו" className="h-16 w-auto rounded-lg border border-slate-200" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    {uploadingLogo ? <Spinner size="sm" /> : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
                    {uploadingLogo ? 'מעלה...' : 'העלה לוגו'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="text-xs text-slate-400">PNG, JPG, SVG או WebP — עד 2MB</p>
                </div>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')}>הסר</Button>
                )}
              </div>
              <Input
                label="או הזן כתובת URL"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://..."
                hint="הזן קישור ישיר לתמונת הלוגו"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader><h3 className="font-bold">מיתוג וצבעים</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="primary-color" className="block text-sm font-medium text-slate-700">צבע ראשי</label>
              <div className="flex items-center gap-3">
                <input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                  aria-label="צבע ראשי"
                />
                <Input value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); setFieldErrors(p => { const n = { ...p }; delete n.primary_color; return n }) }} error={fieldErrors.primary_color} className="flex-1" aria-label="קוד צבע ראשי" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="secondary-color" className="block text-sm font-medium text-slate-700">צבע משני</label>
              <div className="flex items-center gap-3">
                <input
                  id="secondary-color"
                  type="color"
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                  aria-label="צבע משני"
                />
                <Input value={secondaryColor} onChange={e => { setSecondaryColor(e.target.value); setFieldErrors(p => { const n = { ...p }; delete n.secondary_color; return n }) }} error={fieldErrors.secondary_color} className="flex-1" aria-label="קוד צבע משני" />
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg border border-slate-200" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)` }}>
            <p className="text-sm text-slate-600">תצוגה מקדימה של הצבעים:</p>
            <div className="flex gap-3 mt-2">
              <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>כפתור ראשי</div>
              <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: secondaryColor }}>כפתור משני</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card>
        <CardHeader><h3 className="font-bold">שעות פעילות</h3></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workingHours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-24 shrink-0">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={e => updateHour(i, 'enabled', e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium">{h.label}</span>
                </label>
                {h.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.start}
                      onChange={e => updateHour(i, 'start', e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                    <span className="text-slate-400">—</span>
                    <input
                      type="time"
                      value={h.end}
                      onChange={e => updateHour(i, 'end', e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">סגור</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Cancellation */}
      <Card>
        <CardHeader><h3 className="font-bold">מחירים ומדיניות ביטול</h3></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              label="מחיר ייעוץ ברירת מחדל (₪)"
              type="number"
              value={defaultPrice}
              onChange={e => { setDefaultPrice(e.target.value); setFieldErrors(p => { const n = { ...p }; delete n.default_price; return n }) }}
              error={fieldErrors.default_price}
              placeholder="300"
              hint="ניתן לעדכן מחיר בנפרד לכל רופא"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="זמן מינימלי לביטול (שעות)"
                type="number"
                value={cancellationHours}
                onChange={e => setCancellationHours(e.target.value)}
                hint="ביטול לפני הזמן הזה ללא חיוב"
              />
              <Input
                label="עמלת ביטול מאוחר (%)"
                type="number"
                min="0"
                max="100"
                value={cancellationFeePercent}
                onChange={e => setCancellationFeePercent(e.target.value)}
                hint="אחוז מהמחיר שייגבה בביטול מאוחר"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader><h3 className="font-bold">התראות</h3></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={e => setEmailNotifications(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium">התראות אימייל</span>
                <p className="text-xs text-slate-500">שליחת אימייל אישור, תזכורות וסיכומים</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReminder24h}
                onChange={e => setAutoReminder24h(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium">תזכורת 24 שעות לפני תור</span>
                <p className="text-xs text-slate-500">שליחת תזכורת אוטומטית יום לפני התור</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReminder1h}
                onChange={e => setAutoReminder1h(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium">תזכורת שעה לפני תור</span>
                <p className="text-xs text-slate-500">שליחת תזכורת אוטומטית עם קישור וידאו</p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Plan Info (read-only) */}
      {org && (
        <Card>
          <CardHeader><h3 className="font-bold">תוכנית ומנוי</h3></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">תוכנית</p>
                <p className="font-bold text-lg capitalize">{org.plan}</p>
              </div>
              <div>
                <p className="text-slate-500">סטטוס מנוי</p>
                <p className="font-bold text-lg">{org.subscription_status === 'active' ? 'פעיל' : org.subscription_status}</p>
              </div>
              <div>
                <p className="text-slate-500">מקסימום רופאים</p>
                <p className="font-bold text-lg">{org.max_doctors}</p>
              </div>
              <div>
                <p className="text-slate-500">מקסימום תורים/חודש</p>
                <p className="font-bold text-lg">{org.max_appointments_per_month}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} loading={saving} size="lg">שמור הגדרות</Button>
      </div>
    </div>
  )
}
