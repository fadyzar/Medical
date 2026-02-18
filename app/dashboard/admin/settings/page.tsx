'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardHeader, CardContent, PageLoading, Spinner } from '@/components/ui'
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

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [org, setOrg] = useState<Organization | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

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
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !org) return

    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      setError('הקובץ גדול מדי — מקסימום 2MB')
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('סוג קובץ לא נתמך — PNG, JPG, SVG או WebP בלבד')
      return
    }

    setUploadingLogo(true)
    setError('')

    const ext = file.name.split('.').pop() || 'png'
    const path = `branding/${org.id}/logo.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadErr) {
      setError('שגיאה בהעלאת הלוגו: ' + uploadErr.message)
      setUploadingLogo(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    setLogoUrl(`${urlData.publicUrl}?t=${Date.now()}`)
    setUploadingLogo(false)
  }

  async function handleSave() {
    if (!org) return
    setSaving(true)
    setError('')
    setSuccess('')

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
      setError('שגיאה בשמירה: ' + err.message)
    } else {
      setSuccess('ההגדרות נשמרו בהצלחה')
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  function updateHour(dayIndex: number, field: keyof WorkingHours, value: string | boolean) {
    setWorkingHours(prev => prev.map((h, i) => i === dayIndex ? { ...h, [field]: value } : h))
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">הגדרות מרפאה</h2>

      {/* Basic Info */}
      <Card>
        <CardHeader><h3 className="font-bold">פרטי המרפאה</h3></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input label="שם המרפאה" value={name} onChange={e => setName(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="אימייל ליצירת קשר" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              <Input label="טלפון" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="03-1234567" />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">לוגו המרפאה</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="לוגו" className="h-16 w-auto rounded-lg border border-gray-200" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-2xl">
                    🏥
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    {uploadingLogo ? <Spinner size="sm" /> : '📁'}
                    {uploadingLogo ? 'מעלה...' : 'העלה לוגו'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="text-xs text-gray-400">PNG, JPG, SVG או WebP — עד 2MB</p>
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
              <label htmlFor="primary-color" className="block text-sm font-medium text-gray-700">צבע ראשי</label>
              <div className="flex items-center gap-3">
                <input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                  aria-label="צבע ראשי"
                />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" aria-label="קוד צבע ראשי" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="secondary-color" className="block text-sm font-medium text-gray-700">צבע משני</label>
              <div className="flex items-center gap-3">
                <input
                  id="secondary-color"
                  type="color"
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                  aria-label="צבע משני"
                />
                <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" aria-label="קוד צבע משני" />
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg border border-gray-200" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)` }}>
            <p className="text-sm text-gray-600">תצוגה מקדימה של הצבעים:</p>
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
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">{h.label}</span>
                </label>
                {h.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.start}
                      onChange={e => updateHour(i, 'start', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                    <span className="text-gray-400">—</span>
                    <input
                      type="time"
                      value={h.end}
                      onChange={e => updateHour(i, 'end', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">סגור</span>
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
              onChange={e => setDefaultPrice(e.target.value)}
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
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium">התראות אימייל</span>
                <p className="text-xs text-gray-500">שליחת אימייל אישור, תזכורות וסיכומים</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReminder24h}
                onChange={e => setAutoReminder24h(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium">תזכורת 24 שעות לפני תור</span>
                <p className="text-xs text-gray-500">שליחת תזכורת אוטומטית יום לפני התור</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReminder1h}
                onChange={e => setAutoReminder1h(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium">תזכורת שעה לפני תור</span>
                <p className="text-xs text-gray-500">שליחת תזכורת אוטומטית עם קישור וידאו</p>
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
                <p className="text-gray-500">תוכנית</p>
                <p className="font-bold text-lg capitalize">{org.plan}</p>
              </div>
              <div>
                <p className="text-gray-500">סטטוס מנוי</p>
                <p className="font-bold text-lg">{org.subscription_status === 'active' ? 'פעיל' : org.subscription_status}</p>
              </div>
              <div>
                <p className="text-gray-500">מקסימום רופאים</p>
                <p className="font-bold text-lg">{org.max_doctors}</p>
              </div>
              <div>
                <p className="text-gray-500">מקסימום תורים/חודש</p>
                <p className="font-bold text-lg">{org.max_appointments_per_month}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg" role="alert">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg" role="status">{success}</p>}

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} loading={saving} size="lg">שמור הגדרות</Button>
      </div>
    </div>
  )
}
