'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Textarea, Card, CardContent, Spinner } from '@/components/ui'
import { SPECIALTIES, formatPrice, cn } from '@/lib/utils'
import { newAppointmentSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import type { User } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────
type Step = 'specialty' | 'doctor' | 'details' | 'documents' | 'confirm'
type AppointmentType = 'video' | 'clinic'

// ── Specialty icons ────────────────────────────────────────────────
const SPECIALTY_ICONS: Record<string, string> = {
  general:         '🩺',
  dermatology:     '🔬',
  orthopedics:     '🦴',
  cardiology:      '❤️',
  ent:             '👂',
  neurology:       '🧠',
  gastro:          '🫁',
  urology:         '💊',
  gynecology:      '🌸',
  ophthalmology:   '👁️',
  psychiatry:      '🧘',
  endocrinology:   '⚗️',
  pulmonology:     '🫀',
  pediatrics:      '👶',
  pain:            '🩹',
  oncology:        '🔬',
}

// ── Steps config ──────────────────────────────────────────────────
const STEPS: { key: Step; label: string; num: number }[] = [
  { key: 'specialty', label: 'התמחות', num: 1 },
  { key: 'doctor',    label: 'רופא',   num: 2 },
  { key: 'details',   label: 'פרטים',  num: 3 },
  { key: 'documents', label: 'מסמכים', num: 4 },
  { key: 'confirm',   label: 'אישור',  num: 5 },
]

const URGENCY_OPTIONS = [
  { value: 'routine', label: 'רגיל',   desc: 'תוך מספר ימים',  color: 'emerald' },
  { value: 'soon',    label: 'בהקדם',  desc: 'תוך 24–48 שעות', color: 'amber' },
  { value: 'urgent',  label: 'דחוף',   desc: 'בהקדם האפשרי',   color: 'red' },
]

// ── Component ─────────────────────────────────────────────────────
export default function NewAppointmentPage() {
  const router   = useRouter()
  const supabase = getClient()

  const [step, setStep]           = useState<Step>('specialty')
  const [loading, setLoading]     = useState(false)
  const [doctors, setDoctors]     = useState<User[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [success, setSuccess]     = useState(false)

  const [form, setForm] = useState({
    specialty: '',
    doctor_id: '',
    chief_complaint: '',
    complaint_description: '',
    urgency_level: 'routine',
    appointment_type: 'video' as AppointmentType,
  })
  const [files, setFiles]   = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!form.specialty) return
    setLoadingDocs(true)
    setForm(p => ({ ...p, doctor_id: '' }))
    setDoctors([])
    const load = async () => {
      try {
        const { data } = await supabase.from('users')
          .select('id, first_name, last_name, specialties, bio, consultation_price, average_rating, total_ratings, avatar_url, languages')
          .eq('role', 'doctor').eq('is_active', true)
          .contains('specialties', [form.specialty])
        setDoctors((data || []) as unknown as User[])
      } catch {
        // Prevents infinite spinner on error
      } finally {
        setLoadingDocs(false)
      }
    }
    load()
  }, [form.specialty])

  const selectedDoctor = doctors.find(d => d.id === form.doctor_id)

  const handleSubmit = async () => {
    const result = newAppointmentSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message })
      setErrors(fieldErrors)
      return
    }
    setLoading(true)
    setErrors({})
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) { setErrors({ submit: 'לא ניתן לזהות את הפרופיל' }); toast.error('שגיאה בזיהוי פרופיל'); setLoading(false); return }

      const { data: apt, error } = await supabase.from('appointments').insert({
        organization_id: profile.organization_id,
        patient_id: user.id,
        doctor_id: form.doctor_id || null,
        requested_specialty: form.specialty,
        chief_complaint: form.chief_complaint,
        complaint_description: form.complaint_description || null,
        urgency_level: form.urgency_level,
        appointment_type: form.appointment_type,
        payment_amount: selectedDoctor?.consultation_price || null,
        status: 'pending',
      }).select('id').single()

      if (error || !apt) throw error

      if (files.length > 0) {
        for (const file of files) {
          const path = `${profile.organization_id}/${user.id}/${apt.id}/${Date.now()}-${file.name}`
          const { error: uploadErr } = await supabase.storage.from('medical-documents').upload(path, file)
          if (!uploadErr) {
            await supabase.from('documents').insert({
              organization_id: profile.organization_id, patient_id: user.id, appointment_id: apt.id,
              uploaded_by: user.id, file_name: file.name, file_type: file.type,
              file_size_bytes: file.size, storage_path: path, document_type: 'patient_upload',
            })
          }
        }
      }

      try { await fetch('/api/ai-triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: apt.id }) }) } catch { /* non-critical */ }
      // Notify patient (confirmation) + doctor (new request) via WhatsApp + in-app
      try {
        await fetch('/api/notifications/trigger-patient-created', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: apt.id }),
        })
      } catch { /* non-critical */ }

      setSuccess(true)
      toast.success('הבקשה נשלחה בהצלחה!')
      setTimeout(() => {
        router.push(selectedDoctor?.consultation_price ? `/dashboard/patient/payment?id=${apt.id}` : '/dashboard/patient/dashboard')
      }, 1800)
    } catch {
      setErrors({ submit: 'שגיאה ביצירת התור. נסה שוב.' })
      toast.error('שגיאה ביצירת התור')
    } finally {
      setLoading(false)
    }
  }

  const currentIdx = STEPS.findIndex(s => s.key === step)

  // ── Success screen ─────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="text-center space-y-5">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-12 h-12 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">הבקשה נשלחה!</h2>
            <p className="text-gray-500 mt-2">
              {selectedDoctor?.consultation_price
                ? 'מעביר אותך לדף התשלום...'
                : 'התור נוצר. נעדכן אותך ברגע שהרופא יאשר.'
              }
            </p>
          </div>
          <Spinner className="mx-auto" />
        </div>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">קביעת תור חדש</h1>
        <p className="text-sm text-gray-500 mt-1">ייעוץ רפואי אונליין עם מומחה — מהבית, ללא המתנה</p>
      </div>

      {/* ── Stepper ── */}
      <div className="flex items-center" role="list" aria-label="שלבי קביעת תור">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none" role="listitem">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                i < currentIdx  ? 'bg-blue-600 border-blue-600 text-white' :
                i === currentIdx ? 'bg-white border-blue-600 text-blue-600 shadow-md shadow-blue-100' :
                                   'bg-white border-gray-200 text-gray-400'
              )}>
                {i < currentIdx
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : s.num
                }
              </div>
              <span className={cn('text-xs hidden sm:block font-medium', i === currentIdx ? 'text-blue-600' : i < currentIdx ? 'text-blue-400' : 'text-gray-400')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-2 mt-[-12px] transition-all', i < currentIdx ? 'bg-blue-500' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">

          {/* ── Step 1: Specialty ── */}
          {step === 'specialty' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">בחר התמחות</h2>
                <p className="text-sm text-gray-500 mt-1">איזה מומחה אתה מחפש?</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SPECIALTIES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setForm(p => ({ ...p, specialty: s.id })); setStep('doctor') }}
                    className={cn(
                      'p-4 rounded-2xl border-2 text-right transition-all hover:shadow-sm active:scale-[0.98]',
                      form.specialty === s.id
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                    )}
                  >
                    <div className="text-2xl mb-2">{SPECIALTY_ICONS[s.id] || '🏥'}</div>
                    <p className={cn('text-sm font-semibold', form.specialty === s.id ? 'text-blue-700' : 'text-gray-800')}>
                      {s.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Doctor ── */}
          {step === 'doctor' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">בחר רופא</h2>
                <p className="text-sm text-gray-500 mt-1">
                  רופאים זמינים ב{SPECIALTIES.find(s => s.id === form.specialty)?.label}
                </p>
              </div>

              {loadingDocs ? (
                <div className="flex flex-col items-center py-10 gap-3 text-gray-400">
                  <Spinner />
                  <p className="text-sm">מחפש רופאים זמינים...</p>
                </div>
              ) : doctors.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center space-y-3">
                  <div className="text-4xl">🔍</div>
                  <p className="font-medium text-gray-700">אין רופאים זמינים בהתמחות זו כרגע</p>
                  <p className="text-sm text-gray-400">ניתן להמשיך ולהגיש בקשה — נשבץ לך רופא</p>
                  <Button variant="outline" onClick={() => { setForm(p => ({ ...p, doctor_id: '' })); setStep('details') }}>
                    המשך ללא בחירת רופא
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {doctors.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => { setForm(p => ({ ...p, doctor_id: doc.id })); setStep('details') }}
                      className={cn(
                        'w-full p-4 rounded-2xl border-2 text-right transition-all hover:shadow-sm active:scale-[0.99]',
                        form.doctor_id === doc.id
                          ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xl font-bold text-white shrink-0">
                          {doc.avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={doc.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                            : `${doc.first_name.charAt(0)}${doc.last_name.charAt(0)}`
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">ד&quot;ר {doc.first_name} {doc.last_name}</p>
                          {doc.specialties?.length && (
                            <p className="text-xs text-blue-600 font-medium mt-0.5">{doc.specialties.slice(0,3).join(' · ')}</p>
                          )}
                          {doc.bio && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{doc.bio}</p>}
                          <div className="flex items-center gap-4 mt-2">
                            {doc.average_rating != null && (
                              <span className="flex items-center gap-1 text-sm">
                                <span className="text-yellow-400">★</span>
                                <span className="font-medium text-gray-700">{doc.average_rating.toFixed(1)}</span>
                                <span className="text-gray-400">({doc.total_ratings})</span>
                              </span>
                            )}
                            {doc.consultation_price && (
                              <span className="text-sm font-bold text-emerald-600">{formatPrice(doc.consultation_price)}</span>
                            )}
                            {doc.languages?.length && (
                              <span className="text-xs text-gray-400">{doc.languages.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        {form.doctor_id === doc.id && (
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setForm(p => ({ ...p, doctor_id: '' })); setStep('details') }}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all"
                  >
                    המשך ללא בחירת רופא ← יושבץ אוטומטית
                  </button>
                </div>
              )}

              <Button variant="outline" onClick={() => setStep('specialty')}>← חזור</Button>
            </div>
          )}

          {/* ── Step 3: Details ── */}
          {step === 'details' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">תאר את הבעיה</h2>
                <p className="text-sm text-gray-500 mt-1">פרט כמה שיותר — הרופא יראה זאת לפני הייעוץ</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    תלונה עיקרית <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="למשל: כאב ראש חזק כבר שבוע"
                    value={form.chief_complaint}
                    onChange={e => { setForm(p => ({ ...p, chief_complaint: e.target.value })); setErrors(p => ({ ...p, chief_complaint: '' })) }}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2',
                      errors.chief_complaint
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                        : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'
                    )}
                    aria-required="true"
                    aria-invalid={!!errors.chief_complaint}
                  />
                  {errors.chief_complaint && (
                    <p className="text-xs text-red-600 mt-1" role="alert">{errors.chief_complaint}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">פירוט נוסף (אופציונלי)</label>
                  <Textarea
                    placeholder="מתי התחיל? מה מקל/מחמיר? תסמינים נוספים?"
                    value={form.complaint_description}
                    onChange={e => setForm(p => ({ ...p, complaint_description: e.target.value }))}
                    rows={4}
                  />
                </div>

                {/* Appointment type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">סוג ייעוץ</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'video',  label: 'וידאו אונליין', desc: 'מהבית, בלי נסיעה', icon: '📹' },
                      { value: 'clinic', label: 'במרפאה',         desc: 'ביקור פיזי',       icon: '🏥' },
                    ] as { value: AppointmentType; label: string; desc: string; icon: string }[]).map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, appointment_type: t.value }))}
                        className={cn(
                          'p-4 rounded-2xl border-2 text-right transition-all',
                          form.appointment_type === t.value
                            ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-100'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        )}
                      >
                        <div className="text-2xl mb-1.5">{t.icon}</div>
                        <p className={cn('font-semibold text-sm', form.appointment_type === t.value ? 'text-blue-700' : 'text-gray-800')}>
                          {t.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">דחיפות</label>
                  <div className="grid grid-cols-3 gap-2">
                    {URGENCY_OPTIONS.map(u => (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, urgency_level: u.value }))}
                        className={cn(
                          'p-3 rounded-xl border-2 text-center transition-all',
                          form.urgency_level === u.value
                            ? u.color === 'red'     ? 'border-red-500 bg-red-50' :
                              u.color === 'amber'   ? 'border-amber-500 bg-amber-50' :
                                                      'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        )}
                      >
                        <p className={cn('font-bold text-sm',
                          form.urgency_level === u.value
                            ? u.color === 'red' ? 'text-red-700' : u.color === 'amber' ? 'text-amber-700' : 'text-emerald-700'
                            : 'text-gray-700'
                        )}>{u.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{u.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('doctor')}>← חזור</Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (form.chief_complaint.trim().length < 5) {
                      setErrors({ chief_complaint: 'יש להזין לפחות 5 תווים' })
                    } else {
                      setErrors({})
                      setStep('documents')
                    }
                  }}
                >
                  המשך →
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Documents ── */}
          {step === 'documents' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">העלאת מסמכים</h2>
                <p className="text-sm text-gray-500 mt-1">בדיקות, תמונות, הפניות — הרופא יצפה בהם לפני הייעוץ</p>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
                onClick={() => document.getElementById('apt-file-upload')?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50') }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50') }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                  const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.size <= 10 * 1024 * 1024)
                  setFiles(prev => [...prev, ...droppedFiles])
                }}
              >
                <input
                  type="file" id="apt-file-upload" multiple accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files).filter(f => {
                        if (f.size > 10 * 1024 * 1024) { setErrors(p => ({ ...p, files: `${f.name} גדול מ-10MB` })); return false }
                        return true
                      })
                      setFiles(prev => [...prev, ...newFiles])
                    }
                  }}
                />
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="font-semibold text-gray-700">גרור ושחרר, או לחץ לבחירת קבצים</p>
                <p className="text-xs text-gray-400 mt-1">PDF, תמונות, Word — עד 10MB לקובץ</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{files.length} קבצים נבחרו</p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
                      <svg className="w-5 h-5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 shrink-0"
                        aria-label={`הסר ${f.name}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {errors.files && <p className="text-sm text-red-600" role="alert">{errors.files}</p>}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('details')}>← חזור</Button>
                <Button className="flex-1" onClick={() => { setErrors({}); setStep('confirm') }}>המשך →</Button>
              </div>
            </div>
          )}

          {/* ── Step 5: Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">אישור ושליחה</h2>
                <p className="text-sm text-gray-500 mt-1">בדוק את הפרטים לפני שליחת הבקשה</p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 divide-y">
                <SummaryRow label="התמחות" value={SPECIALTIES.find(s => s.id === form.specialty)?.label || ''} icon="🏥" />
                {selectedDoctor && (
                  <SummaryRow label="רופא" value={`ד"ר ${selectedDoctor.first_name} ${selectedDoctor.last_name}`} icon="👨‍⚕️" />
                )}
                <SummaryRow label="תלונה עיקרית" value={form.chief_complaint} icon="📋" />
                <SummaryRow
                  label="דחיפות"
                  value={URGENCY_OPTIONS.find(u => u.value === form.urgency_level)?.label || ''}
                  icon={form.urgency_level === 'urgent' ? '🔴' : form.urgency_level === 'soon' ? '🟡' : '🟢'}
                />
                {files.length > 0 && (
                  <SummaryRow label="מסמכים" value={`${files.length} קבצים`} icon="📎" />
                )}
                {selectedDoctor?.consultation_price && (
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="font-bold text-gray-900">סה&quot;כ לתשלום</span>
                    <span className="text-2xl font-bold text-emerald-600">{formatPrice(selectedDoctor.consultation_price)}</span>
                  </div>
                )}
              </div>

              {errors.submit && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {errors.submit}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('documents')}>← חזור</Button>
                <Button loading={loading} onClick={handleSubmit} size="lg" className="flex-1">
                  שלח בקשה
                </Button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                {selectedDoctor?.consultation_price
                  ? 'התשלום יתבצע בשלב הבא לאחר אישור הרופא'
                  : 'לאחר שהרופא יאשר, ניצור איתך קשר לתיאום מועד'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Summary row helper ────────────────────────────────────────────
function SummaryRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex items-center justify-between flex-1 min-w-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="font-semibold text-gray-900 text-sm truncate mr-4">{value}</span>
      </div>
    </div>
  )
}
