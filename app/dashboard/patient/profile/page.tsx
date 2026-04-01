'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, Badge, PageLoading } from '@/components/ui'
import { cn, getInitials } from '@/lib/utils'
import { patientProfileSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import type { User, MedicalHistory } from '@/types/database'

// ── Tag input for medical lists ──────────────────────

function TagInput({ label, tags, onChange, placeholder }: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const value = input.trim()
    if (value && !tags.includes(value)) {
      onChange([...tags, value])
    }
    setInput('')
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
        />
        <Button variant="outline" size="sm" type="button" onClick={addTag} disabled={!input.trim()}>
          הוסף
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-sm">
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((_, idx) => idx !== i))}
                className="hover:text-red-600 text-blue-400 font-bold mr-0.5"
                aria-label={`הסר ${tag}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Toggle switch ────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-green-500' : 'bg-gray-300'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform',
        checked ? '-translate-x-5' : 'translate-x-0'
      )} />
    </button>
  )
}

// ── Profile completion calculator ────────────────────

function calcCompletion(profile: User, whatsappOptIn: boolean): { percent: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!profile.first_name, 'שם פרטי'],
    [!!profile.last_name, 'שם משפחה'],
    [!!profile.phone, 'טלפון'],
    [!!profile.date_of_birth, 'תאריך לידה'],
    [!!profile.gender, 'מגדר'],
    [!!profile.avatar_url, 'תמונת פרופיל'],
    [(profile.medical_history?.allergies?.length ?? 0) > 0 || (profile.medical_history?.chronic_conditions?.length ?? 0) > 0 || (profile.medical_history?.current_medications?.length ?? 0) > 0, 'היסטוריה רפואית'],
    [!!profile.emergency_contact?.name && !!profile.emergency_contact?.phone, 'איש קשר לחירום'],
    [!!profile.insurance_info?.provider, 'פרטי ביטוח'],
    [whatsappOptIn, 'הפעלת WhatsApp'],
  ]
  const done = checks.filter(([ok]) => ok).length
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label)
  return { percent: Math.round((done / checks.length) * 100), missing }
}

// ── Main page ────────────────────────────────────────

export default function PatientProfilePage() {
  const router = useRouter()
  const supabase = getClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Personal info
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    id_number: '',
  })

  // Medical history
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({
    allergies: [],
    chronic_conditions: [],
    current_medications: [],
    past_surgeries: [],
  })

  // Emergency contact
  const [emergency, setEmergency] = useState({
    name: '',
    phone: '',
    relationship: '',
  })

  // Insurance
  const [insurance, setInsurance] = useState({
    provider: '',
    policy_number: '',
    group_number: '',
    expiry_date: '',
  })

  // WhatsApp opt-in
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)

  // Avatar URL (local state to show preview immediately)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const { data: prof } = await supabase.from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (prof) {
          const p = prof as unknown as User
          setProfile(p)

          setForm({
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            phone: p.phone || '',
            date_of_birth: p.date_of_birth || '',
            gender: p.gender || '',
            id_number: p.id_number || '',
          })

          setMedicalHistory({
            allergies: p.medical_history?.allergies || [],
            chronic_conditions: p.medical_history?.chronic_conditions || [],
            current_medications: p.medical_history?.current_medications || [],
            past_surgeries: p.medical_history?.past_surgeries || [],
          })

          const ec = p.emergency_contact || {}
          setEmergency({
            name: ec.name || '',
            phone: ec.phone || '',
            relationship: ec.relationship || '',
          })

          const ins = p.insurance_info || {}
          setInsurance({
            provider: ins.provider || '',
            policy_number: ins.policy_number || '',
            group_number: ins.group_number || '',
            expiry_date: ins.expiry_date || '',
          })

          const metadata = (p.metadata || {}) as Record<string, unknown>
          setWhatsappOptIn(metadata.whatsapp_opt_in === true)
          setAvatarUrl(p.avatar_url)
        }
      } catch {
        // Prevents infinite loading on network error
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  // ── Avatar upload ────────────────────────────────────

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    // Validate
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatar: 'יש לבחור קובץ תמונה' }))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatar: 'גודל הקובץ מקסימלי 2MB' }))
      return
    }

    setUploadingAvatar(true)
    setErrors(prev => { const n = { ...prev }; delete n.avatar; return n })

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `avatars/${profile.organization_id}/${profile.id}.${ext}`

      // Delete old avatar if exists
      if (profile.avatar_url && profile.avatar_url.includes('/storage/v1/object/public/avatars/')) {
        const oldPath = profile.avatar_url.split('/storage/v1/object/public/avatars/')[1]
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath])
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Add cache buster
      const avatarWithBuster = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase.from('users')
        .update({ avatar_url: avatarWithBuster })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setAvatarUrl(avatarWithBuster)
      setProfile(prev => prev ? { ...prev, avatar_url: avatarWithBuster } : null)
    } catch {
      setErrors(prev => ({ ...prev, avatar: 'שגיאה בהעלאת התמונה' }))
      toast.error('שגיאה בהעלאת התמונה')
    } finally {
      setUploadingAvatar(false)
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Save ─────────────────────────────────────────────

  const handleSave = async () => {
    if (!profile) return

    const result = patientProfileSchema.safeParse({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      id_number: form.id_number || undefined,
      emergency_phone: emergency.phone || undefined,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => {
        const key = e.path[0] as string
        fieldErrors[key] = e.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    setErrors({})

    const updatedMetadata = {
      ...(profile.metadata || {}),
      whatsapp_opt_in: whatsappOptIn,
    }

    try {
      const { error } = await supabase.from('users').update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        id_number: form.id_number || null,
        medical_history: medicalHistory,
        emergency_contact: emergency,
        insurance_info: insurance,
        metadata: updatedMetadata,
      }).eq('id', profile.id)

      if (error) {
        toast.error('שגיאה בשמירת הפרופיל')
      } else {
        // Update local profile state for completion calc
        setProfile(prev => prev ? {
          ...prev,
          ...form,
          phone: form.phone || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          id_number: form.id_number || null,
          medical_history: medicalHistory,
          emergency_contact: emergency,
          insurance_info: insurance,
          metadata: updatedMetadata,
        } : null)
        toast.success('הפרופיל נשמר בהצלחה')
      }
    } catch {
      toast.error('שגיאת רשת בשמירת הפרופיל')
    } finally {
      setSaving(false)
    }
  }

  const clearError = (field: string) => {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  if (loading) return <PageLoading />
  if (!profile) return null

  const { percent, missing } = calcCompletion(profile, whatsappOptIn)

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <h2 className="text-2xl font-bold">הפרופיל שלי</h2>

      {/* ── Completion indicator ─────────────────────────── */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={percent === 100 ? '#16a34a' : '#2563eb'}
                  strokeWidth="3"
                  strokeDasharray={`${percent}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={cn(
                'absolute inset-0 flex items-center justify-center text-sm font-bold',
                percent === 100 ? 'text-green-600' : 'text-blue-600'
              )}>
                {percent}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">
                {percent === 100 ? 'הפרופיל שלך מלא!' : 'השלם את הפרופיל שלך'}
              </p>
              {missing.length > 0 && (
                <p className="text-sm text-gray-500 mt-0.5">
                  חסר: {missing.slice(0, 3).join(', ')}
                  {missing.length > 3 && ` ועוד ${missing.length - 3}`}
                </p>
              )}
              {/* Progress bar */}
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    percent === 100 ? 'bg-green-500' : 'bg-blue-500'
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Avatar + basic info header ──────────────────── */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="תמונת פרופיל"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-700 border-2 border-gray-200">
                  {getInitials(profile.first_name, profile.last_name)}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
                aria-label="שנה תמונת פרופיל"
              >
                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                  {uploadingAvatar ? 'מעלה...' : 'שנה תמונה'}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{profile.first_name} {profile.last_name}</p>
              <p className="text-sm text-gray-500">{profile.email}</p>
              {profile.phone && <p className="text-sm text-gray-500">{profile.phone}</p>}
              <Badge variant={percent === 100 ? 'success' : 'info'} className="mt-1.5">
                {percent === 100 ? 'פרופיל מלא' : `${percent}% הושלם`}
              </Badge>
            </div>
          </div>
          {errors.avatar && (
            <p className="text-sm text-red-600 mt-2" role="alert">{errors.avatar}</p>
          )}
          <p className="text-xs text-gray-400 mt-3">PNG, JPG או WebP, עד 2MB</p>
        </CardContent>
      </Card>

      {/* ── Personal info ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">פרטים אישיים</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="שם פרטי"
              value={form.first_name}
              onChange={e => { setForm(p => ({ ...p, first_name: e.target.value })); clearError('first_name') }}
              error={errors.first_name}
            />
            <Input
              label="שם משפחה"
              value={form.last_name}
              onChange={e => { setForm(p => ({ ...p, last_name: e.target.value })); clearError('last_name') }}
              error={errors.last_name}
            />
          </div>

          <Input
            label="טלפון"
            type="tel"
            placeholder="0521234567"
            value={form.phone}
            onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); clearError('phone') }}
            error={errors.phone}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="תאריך לידה"
              type="date"
              value={form.date_of_birth}
              onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))}
            />
            <Input
              label="תעודת זהות"
              placeholder="000000000"
              value={form.id_number}
              onChange={e => setForm(p => ({ ...p, id_number: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">מגדר</label>
            <div className="flex gap-3">
              {[
                { value: 'male', label: 'זכר' },
                { value: 'female', label: 'נקבה' },
                { value: 'other', label: 'אחר' },
                { value: 'prefer_not_to_say', label: 'לא לציין' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, gender: option.value }))}
                  className={cn(
                    'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    form.gender === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <span className="font-medium">אימייל:</span> {profile.email}
          </div>
        </CardContent>
      </Card>

      {/* ── Medical history ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">היסטוריה רפואית</h3>
            <Badge variant="info">מידע חסוי</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-500">
            מידע רפואי עוזר לרופא להתכונן לייעוץ ולהימנע מסיכונים. כל המידע מוצפן ומאובטח.
          </p>

          <TagInput
            label="אלרגיות"
            tags={medicalHistory.allergies}
            onChange={allergies => setMedicalHistory(p => ({ ...p, allergies }))}
            placeholder="לדוגמה: פניצילין, אגוזים..."
          />

          <TagInput
            label="מחלות רקע"
            tags={medicalHistory.chronic_conditions}
            onChange={chronic_conditions => setMedicalHistory(p => ({ ...p, chronic_conditions }))}
            placeholder="לדוגמה: סוכרת, לחץ דם גבוה..."
          />

          <TagInput
            label="תרופות קבועות"
            tags={medicalHistory.current_medications}
            onChange={current_medications => setMedicalHistory(p => ({ ...p, current_medications }))}
            placeholder="לדוגמה: מטפורמין 500mg..."
          />

          <TagInput
            label="ניתוחים קודמים"
            tags={medicalHistory.past_surgeries}
            onChange={past_surgeries => setMedicalHistory(p => ({ ...p, past_surgeries }))}
            placeholder="לדוגמה: ניתוח תוספתן 2020..."
          />
        </CardContent>
      </Card>

      {/* ── Emergency contact ───────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">איש קשר לחירום</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="שם מלא"
            placeholder="שם איש הקשר"
            value={emergency.name}
            onChange={e => setEmergency(p => ({ ...p, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="טלפון"
              type="tel"
              placeholder="0521234567"
              value={emergency.phone}
              onChange={e => { setEmergency(p => ({ ...p, phone: e.target.value })); clearError('emergency_phone') }}
              error={errors.emergency_phone}
            />
            <Input
              label="קרבה"
              placeholder="לדוגמה: בן/בת זוג, הורה"
              value={emergency.relationship}
              onChange={e => setEmergency(p => ({ ...p, relationship: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Insurance info ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">פרטי ביטוח בריאות</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="קופת חולים / חברת ביטוח"
            placeholder="לדוגמה: מכבי, כללית, מגדל..."
            value={insurance.provider}
            onChange={e => setInsurance(p => ({ ...p, provider: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="מספר פוליסה"
              placeholder="מספר הפוליסה"
              value={insurance.policy_number}
              onChange={e => setInsurance(p => ({ ...p, policy_number: e.target.value }))}
            />
            <Input
              label="מספר קבוצה"
              placeholder="אופציונלי"
              value={insurance.group_number}
              onChange={e => setInsurance(p => ({ ...p, group_number: e.target.value }))}
            />
          </div>
          <Input
            label="תוקף"
            type="date"
            value={insurance.expiry_date}
            onChange={e => setInsurance(p => ({ ...p, expiry_date: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* ── Notification preferences ────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">העדפות התראות</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
            <div>
              <p className="font-medium text-gray-900">התראות WhatsApp</p>
              <p className="text-sm text-gray-500 mt-0.5">
                קבל תזכורות לתורים, קישורי וידאו ואישורי תשלום בוואטסאפ
              </p>
              {!form.phone && whatsappOptIn && (
                <p className="text-sm text-amber-600 mt-1">
                  יש להזין מספר טלפון כדי לקבל הודעות WhatsApp
                </p>
              )}
            </div>
            <Toggle checked={whatsappOptIn} onChange={setWhatsappOptIn} label="הפעל התראות WhatsApp" />
          </div>

          {whatsappOptIn && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
              <p className="font-medium mb-1">הודעות שתקבל/י:</p>
              <ul className="space-y-0.5 list-disc list-inside text-green-700">
                <li>אישור קביעת תור</li>
                <li>תזכורת שעה לפני התור עם קישור לשיחה</li>
                <li>קישור לשיחת וידאו כשהיא מוכנה</li>
                <li>אישור תשלום</li>
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
            <div>
              <p className="font-medium text-gray-900">התראות אימייל</p>
              <p className="text-sm text-gray-500 mt-0.5">
                תזכורות ועדכונים לכתובת האימייל שלך
              </p>
            </div>
            <div className="text-sm text-gray-400">פעיל תמיד</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} size="lg">
          שמור שינויים
        </Button>
      </div>
    </div>
  )
}
