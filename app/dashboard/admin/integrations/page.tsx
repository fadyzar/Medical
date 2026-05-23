'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, type ReactNode } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Card, CardHeader, CardContent, Badge, PageLoading } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Organization } from '@/types/database'

// ── DomainCard (inline) ────────────────────────────────
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

  useEffect(() => { checkStatus() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

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
    } catch { /* non-critical */ } finally { setChecking(false) }
  }

  async function provision() {
    if (!subdomain || subdomain.length < 3) { toast.error('יש להזין סאבדומיין (לפחות 3 תווים)'); return }
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
        if (data.status === 'active') toast.success('הדומיין מוכן ופעיל!')
        else if (data.dnsManual) toast.success('נוסף ל-Vercel! יש להוסיף את רשומת DNS ידנית.')
        else toast.success('הדומיין בתהליך הגדרה — בדוק שוב בעוד כמה דקות')
      } else {
        toast.error(data.error || 'שגיאה בהגדרת הדומיין')
      }
    } catch { toast.error('שגיאת רשת') } finally { setLoading(false) }
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    none:         { label: 'לא הוגדר',      color: 'bg-gray-100 text-gray-600' },
    pending:      { label: 'מגדיר...',       color: 'bg-yellow-100 text-yellow-700' },
    vercel_added: { label: 'ממתין ל-DNS',    color: 'bg-blue-100 text-blue-700' },
    active:       { label: 'פעיל',           color: 'bg-green-100 text-green-700' },
    failed:       { label: 'שגיאה',          color: 'bg-red-100 text-red-700' },
  }
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.none
  const canEdit = status === 'none' || status === 'failed'

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>
        {checking && <span className="text-xs text-gray-400">בודק...</span>}
      </div>

      {/* Active */}
      {status === 'active' && result?.url && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">הדומיין פעיל</p>
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 hover:underline font-mono truncate block">{result.url}</a>
          </div>
        </div>
      )}

      {/* Input */}
      {canEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">סאבדומיין</label>
          <div className="flex items-center gap-0">
            <input
              type="text"
              value={subdomain}
              onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="shalom"
              className="flex-1 rounded-r-xl border border-l-0 border-gray-300 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              dir="ltr"
            />
            <span className="bg-gray-100 border border-gray-300 rounded-l-xl px-3 py-2.5 text-sm text-gray-500 font-mono whitespace-nowrap">.cannaforyou.net</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">אותיות קטנות באנגלית, מספרים ומקף בלבד</p>
        </div>
      )}

      {/* Show subdomain when not editing */}
      {!canEdit && subdomain && status !== 'active' && (
        <div className="flex items-center gap-2 font-mono text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
          <span className="text-gray-500">URL:</span>
          <span className="text-gray-800">{subdomain}.cannaforyou.net</span>
        </div>
      )}

      {/* vercel_added — waiting DNS */}
      {status === 'vercel_added' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <p className="font-semibold mb-1">נוסף ל-Vercel — ממתין לאימות DNS</p>
          <p className="text-xs text-blue-600">לאחר שה-DNS מתפשט (עד 5 דקות) לחץ ״בדוק סטטוס״.</p>
        </div>
      )}

      {/* Manual DNS */}
      {result?.manualDns && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <p className="font-semibold mb-2">הוסף רשומת DNS ידנית בהוסטינגר:</p>
          <div className="font-mono text-xs bg-white border border-amber-200 rounded-lg p-3 space-y-1">
            <div><span className="text-gray-500">סוג:</span> {result.manualDns.type}</div>
            <div><span className="text-gray-500">שם:</span> {result.manualDns.name}</div>
            <div><span className="text-gray-500">ערך:</span> {result.manualDns.value}</div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 flex-wrap pt-1">
        {canEdit && (
          <button
            onClick={provision}
            disabled={loading || !subdomain}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'מגדיר...' : 'הפעל דומיין'}
          </button>
        )}
        <button
          onClick={checkStatus}
          disabled={checking}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {checking ? 'בודק...' : 'בדוק סטטוס'}
        </button>
      </div>
    </div>
  )
}

// ── WhatsApp Test Panel ────────────────────────────────
function WhatsAppTestPanel({ isConfigured }: { isConfigured: boolean }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function sendTest() {
    if (!phone) return
    setLoading(true)
    setResult('idle')
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult('success')
      } else {
        setResult('error')
        setErrorMsg(data.error || 'שגיאה בשליחה')
      }
    } catch {
      setResult('error')
      setErrorMsg('שגיאת רשת')
    } finally {
      setLoading(false)
    }
  }

  if (!isConfigured) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 text-center">
        שמור את פרטי Green API תחילה כדי לשלוח הודעת טסט
      </div>
    )
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-600">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.09.543 4.05 1.49 5.752L0 24l6.417-1.471A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.006-1.369l-.36-.213-3.71.851.89-3.617-.234-.372A9.796 9.796 0 012.182 12C2.182 6.584 6.584 2.182 12 2.182S21.818 6.584 21.818 12 17.416 21.818 12 21.818z"/>
        </svg>
        <p className="text-sm font-semibold text-green-800">שלח הודעת טסט</p>
      </div>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={e => { setPhone(e.target.value); setResult('idle') }}
          placeholder="0521234567"
          className="flex-1 rounded-lg border border-green-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          dir="ltr"
        />
        <button
          onClick={sendTest}
          disabled={loading || !phone}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? 'שולח...' : 'שלח טסט'}
        </button>
      </div>
      {result === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          ההודעה נשלחה בהצלחה! בדוק את ה-WhatsApp של המספר שהזנת.
        </div>
      )}
      {result === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {errorMsg}
        </div>
      )}
    </div>
  )
}

// ── Types ──────────────────────────────────────────────

// Integrations provided by the platform — no config needed by clinic
const PLATFORM_PROVIDED: IntegrationKey[] = ['email', 'video']

type IntegrationKey =
  | 'whatsapp'
  | 'email'
  | 'video'
  | 'payment'
  | 'subdomain'
  | 'invoice'

type IntegrationConfig = {
  key: IntegrationKey
  title: string
  description: string
  icon: ReactNode
  color: string
  fields: {
    id: string
    label: string
    type: 'text' | 'password' | 'url'
    placeholder: string
    hint?: string
    required?: boolean
  }[]
  docsUrl?: string
  providerNote?: string
}

// ── Integration definitions ────────────────────────────

const INTEGRATIONS: IntegrationConfig[] = [
  {
    key: 'whatsapp',
    title: 'WhatsApp (Green API)',
    description: 'שליחת אישורים, תזכורות ועדכונים ישירות ל-WhatsApp של המטופלים ממספר המרפאה שלך',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.09.543 4.05 1.49 5.752L0 24l6.417-1.471A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.006-1.369l-.36-.213-3.71.851.89-3.617-.234-.372A9.796 9.796 0 012.182 12C2.182 6.584 6.584 2.182 12 2.182S21.818 6.584 21.818 12 17.416 21.818 12 21.818z"/>
      </svg>
    ),
    color: 'text-green-600',
    fields: [
      { id: 'green_api_instance_id', label: 'Instance ID', type: 'text', placeholder: '1234567890', required: true, hint: 'נמצא ב-console.green-api.com תחת "My instances"' },
      { id: 'green_api_token', label: 'API Token', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, hint: 'ה-Token של ה-instance שלך ב-Green API' },
    ],
    providerNote: 'נדרש חשבון Green API עצמאי בכתובת green-api.com. חבר את ה-WhatsApp שלך ל-instance, העתק את ה-ID וה-Token והזן כאן.',
  },
  {
    key: 'email',
    title: 'אימייל (Resend)',
    description: 'שליחת אישורי תורים, תזכורות וסיכומים למטופלים',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    color: 'text-blue-600',
    fields: [
      { id: 'resend_api_key', label: 'Resend API Key', type: 'password', placeholder: 're_xxxxxxxxxxxxxxxx', required: true },
      { id: 'email_from', label: 'כתובת שולח', type: 'text', placeholder: 'noreply@clinic.co.il', hint: 'חייב להיות מוגדר ב-Resend תחת דומיין מאומת' },
      { id: 'email_from_name', label: 'שם השולח', type: 'text', placeholder: 'מרפאת שלום' },
    ],
    providerNote: 'נדרש חשבון Resend עצמאי בכתובת resend.com. המרפאה אחראית לאימות הדומיין ותשלום לספק.',
  },
  {
    key: 'video',
    title: 'שיחות וידאו (LiveKit)',
    description: 'ייעוצים רפואיים מאובטחים בוידאו בזמן אמת',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
    color: 'text-purple-600',
    fields: [
      { id: 'livekit_url', label: 'LiveKit URL', type: 'url', placeholder: 'wss://your-project.livekit.cloud', required: true },
      { id: 'livekit_api_key', label: 'LiveKit API Key', type: 'text', placeholder: 'APIxxxxxxxxxxxxxxxx', required: true },
      { id: 'livekit_api_secret', label: 'LiveKit API Secret', type: 'password', placeholder: 'xxxxxxxxxxxxxxxx', required: true },
    ],
    providerNote: 'נדרש חשבון LiveKit Cloud עצמאי בכתובת livekit.io. המרפאה אחראית לפתיחת הפרויקט ותשלום לספק.',
  },
  {
    key: 'payment',
    title: 'תשלומים (Tranzila)',
    description: 'קבלת תשלומים מאובטחים מהמטופלים לפני הייעוץ',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
    color: 'text-orange-600',
    fields: [
      { id: 'tranzila_supplier', label: 'Tranzila Supplier', type: 'text', placeholder: 'myClinic', required: true, hint: 'שם המסוף שלך ב-Tranzila' },
      { id: 'tranzila_api_key', label: 'Tranzila TranzilaToken', type: 'password', placeholder: 'xxxxxxxx' },
      { id: 'payment_currency', label: 'מטבע', type: 'text', placeholder: 'ILS', hint: 'ILS לשקל ישראלי' },
    ],
    providerNote: 'נדרש חשבון Tranzila עצמאי. המרפאה אחראית לפתיחת מסוף סליקה ותשלום עמלות לספק.',
  },
  {
    key: 'invoice',
    title: 'חשבוניות (Green Invoice)',
    description: 'הפקת חשבוניות וקבלות דיגיטליות בהתאם לחוקי ישראל',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    color: 'text-green-700',
    fields: [
      { id: 'green_invoice_id', label: 'Green Invoice ID', type: 'text', placeholder: 'xxxxxxx', required: true },
      { id: 'green_invoice_secret', label: 'Green Invoice Secret', type: 'password', placeholder: 'xxxxxxxxxxxxxxxx', required: true },
      { id: 'invoice_business_name', label: 'שם העסק לחשבונית', type: 'text', placeholder: 'מרפאת שלום בע"מ' },
    ],
    providerNote: 'נדרש חשבון Green Invoice עצמאי. המרפאה אחראית לניהול ספר החשבוניות ועמידה בדרישות מע"מ.',
  },
  {
    key: 'subdomain',
    title: 'דומיין / כתובת אישית',
    description: 'הגדרת subdomain ייחודי או חיבור דומיין מותאם אישית',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    ),
    color: 'text-indigo-600',
    fields: [
      { id: 'subdomain', label: 'Subdomain', type: 'text', placeholder: 'my-clinic', hint: 'כתובת הגישה: my-clinic.cannaforyou.net' },
      { id: 'custom_domain', label: 'דומיין מותאם אישית (אופציונלי)', type: 'text', placeholder: 'portal.my-clinic.co.il', hint: 'דורש הגדרת CNAME בספק הדומיין שלך' },
    ],
  },
]

// ── Component ──────────────────────────────────────────

export default function AdminIntegrationsPage() {
  const supabase = getClient()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgId, setOrgId] = useState('')
  const [activeKey, setActiveKey] = useState<IntegrationKey | null>(null)
  const [values, setValues] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})

  const loadOrg = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return
      setOrgId(profile.organization_id)

      const { data } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
      if (!data) return
      const organization = data as unknown as Organization
      setOrg(organization)

      // Populate existing values from settings
      const s = organization.settings || {}
      const initial: Record<string, Record<string, string>> = {}

      INTEGRATIONS.forEach(integ => {
        initial[integ.key] = {}
        integ.fields.forEach(field => {
          const stored = (s as Record<string, Record<string, string>>)[`integration_${integ.key}`]
          initial[integ.key][field.id] = stored?.[field.id] || ''
        })
      })

      // Populate subdomain/custom_domain directly from org
      if (initial.subdomain) {
        initial.subdomain.subdomain = organization.subdomain || ''
        initial.subdomain.custom_domain = organization.custom_domain || ''
      }

      setValues(initial)
    } catch {
      toast.error('שגיאה בטעינת ההגדרות')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadOrg() }, [loadOrg])

  async function handleSave(key: IntegrationKey) {
    if (!org) return
    setSaving(true)
    try {
      const currentSettings = org.settings || {}

      const updatePayload: Record<string, unknown> = {
        settings: {
          ...currentSettings,
          [`integration_${key}`]: values[key] || {},
        },
      }

      // For subdomain integration, also update top-level fields
      if (key === 'subdomain') {
        if (values.subdomain?.subdomain) updatePayload.subdomain = values.subdomain.subdomain
        if (values.subdomain?.custom_domain !== undefined) updatePayload.custom_domain = values.subdomain.custom_domain || null
      }

      const { error } = await supabase.from('organizations').update(updatePayload).eq('id', orgId)
      if (error) throw error

      // Refresh org
      setOrg((prev: Organization | null) => prev ? { ...prev, settings: updatePayload.settings as Record<string, unknown> } : prev)
      toast.success('הגדרות אינטגרציה נשמרו בהצלחה')
    } catch (err) {
      toast.error('שגיאה בשמירת ההגדרות')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function isConfigured(key: IntegrationKey): boolean {
    const integ = INTEGRATIONS.find(i => i.key === key)
    if (!integ) return false
    const required = integ.fields.filter(f => f.required)
    return required.every(f => values[key]?.[f.id]?.trim())
  }

  if (loading) return <PageLoading />

  const activeInteg = INTEGRATIONS.find(i => i.key === activeKey)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">אינטגרציות</h2>
        <p className="text-sm text-gray-500 mt-1">
          חבר את השירותים החיצוניים של המרפאה — כל מרפאה מנהלת את החשבונות והמפתחות שלה באופן עצמאי
        </p>
      </div>

      {/* Platform vs. self-service notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          <div className="flex gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <p className="font-semibold">כלול בתוכנית — עובד מיד</p>
              <p className="mt-0.5">וידאו HD ואימייל מסופקים על ידי הפלטפורמה. לא נדרשת הגדרה נוספת.</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <div className="flex gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="font-semibold">דורש הגדרה עצמאית</p>
              <p className="mt-0.5">WhatsApp, תשלומים וחשבוניות דורשים חשבונות עצמאיים אצל הספקים.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map(integ => {
          const configured = isConfigured(integ.key)
          return (
            <button
              key={integ.key}
              onClick={() => setActiveKey(activeKey === integ.key ? null : integ.key)}
              className={cn(
                'p-5 rounded-xl border text-right transition-all hover:shadow-md',
                activeKey === integ.key
                  ? 'border-blue-400 bg-blue-50 shadow-md'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={integ.color}>{integ.icon}</span>
                {PLATFORM_PROVIDED.includes(integ.key) ? (
                  <Badge variant="success">כלול בפלטפורמה</Badge>
                ) : (
                  <Badge variant={configured ? 'success' : 'default'}>
                    {configured ? 'מחובר' : 'לא מחובר'}
                  </Badge>
                )}
              </div>
              <h3 className="font-bold text-gray-900">{integ.title}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{integ.description}</p>
            </button>
          )
        })}
      </div>

      {/* Expanded settings panel */}
      {activeKey && activeInteg && (
        <Card className="border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={activeInteg.color}>{activeInteg.icon}</span>
                <h3 className="font-bold text-lg">{activeInteg.title}</h3>
              </div>
              <button
                onClick={() => setActiveKey(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="סגור"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Provider note */}
            {activeInteg.providerNote && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  {activeInteg.providerNote}
                </div>
              </div>
            )}

            {/* Subdomain — use DomainCard instead of generic fields */}
            {activeKey === 'subdomain' ? (
              <DomainCard orgId={orgId} currentSubdomain={org?.subdomain ?? null} />
            ) : (
              <>
                {/* Green API setup guide */}
                {activeKey === 'whatsapp' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-900">איך מתחברים ל-Green API?</p>
                    <ol className="space-y-2.5 text-sm text-blue-800">
                      <li className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                        <span>נכנסים לאתר <span className="font-mono font-semibold">green-api.com</span> ונפתחים חשבון חינמי</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                        <span>לוחצים <strong>«Create Instance»</strong> — בוחרים את הסוג <strong>API</strong></span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                        <span>בתוך ה-instance לוחצים <strong>«Scan QR»</strong> וסורקים עם WhatsApp של המרפאה (הגדרות ← מכשירים מקושרים)</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                        <span>מעתיקים את <strong>idInstance</strong> ואת <strong>apiTokenInstance</strong> ומזינים בשדות למטה</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">5</span>
                        <span>שומרים ושולחים הודעת טסט לאימות</span>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Fields */}
                <div className="space-y-4">
                  {activeInteg.fields.map(field => (
                    <div key={field.id} className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        {field.label}
                        {field.required && <span className="text-red-500 mr-1">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={field.type === 'password' && !showSecret[field.id] ? 'password' : 'text'}
                          value={values[activeKey]?.[field.id] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((prev: Record<string, Record<string, string>>) => ({
                            ...prev,
                            [activeKey]: { ...prev[activeKey], [field.id]: e.target.value },
                          }))}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                          dir="ltr"
                        />
                        {field.type === 'password' && (
                          <button
                            type="button"
                            onClick={() => setShowSecret((prev: Record<string, boolean>) => ({ ...prev, [field.id]: !prev[field.id] }))}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label={showSecret[field.id] ? 'הסתר' : 'הצג'}
                          >
                            {showSecret[field.id] ? (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      {field.hint && <p className="text-xs text-gray-400">{field.hint}</p>}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={() => handleSave(activeKey)} loading={saving}>
                    שמור הגדרות {activeInteg.title}
                  </Button>
                </div>

                {/* WhatsApp test panel */}
                {activeKey === 'whatsapp' && (
                  <WhatsAppTestPanel isConfigured={isConfigured('whatsapp')} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
