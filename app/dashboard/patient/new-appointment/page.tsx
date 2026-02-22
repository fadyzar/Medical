'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Textarea, Select, Card, CardContent, Spinner, Badge } from '@/components/ui'
import { SPECIALTIES, formatPrice, cn } from '@/lib/utils'
import type { User } from '@/types/database'

type Step = 'specialty' | 'doctor' | 'details' | 'documents' | 'confirm'

export default function NewAppointmentPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('specialty')
  const [loading, setLoading] = useState(false)
  const [doctors, setDoctors] = useState<User[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)

  const [form, setForm] = useState({
    specialty: '',
    doctor_id: '',
    chief_complaint: '',
    complaint_description: '',
    urgency_level: 'routine' as string,
  })
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)

  const supabase = getClient()

  // Load doctors when specialty changes
  useEffect(() => {
    if (!form.specialty) return
    setLoadingDoctors(true)
    // Clear previously selected doctor when specialty changes
    setForm(p => ({ ...p, doctor_id: '' }))
    setDoctors([])
    const loadDoctors = async () => {
      try {
        const { data } = await supabase.from('users')
          .select('id, first_name, last_name, specialties, bio, consultation_price, average_rating, total_ratings, avatar_url, languages')
          .eq('role', 'doctor').eq('is_active', true)
          .contains('specialties', [form.specialty])
        setDoctors((data || []) as unknown as User[])
      } catch {
        // Prevents infinite spinner on network error
      } finally {
        setLoadingDoctors(false)
      }
    }
    loadDoctors()
  }, [form.specialty])

  const selectedDoctor = doctors.find(d => d.id === form.doctor_id)

  const handleSubmit = async () => {
    if (!form.chief_complaint || form.chief_complaint.length < 5) {
      setErrors({ chief_complaint: 'תאר את הבעיה בלפחות 5 תווים' }); return
    }

    setLoading(true)
    setErrors({})
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) {
        setErrors({ submit: 'לא ניתן לזהות את הפרופיל שלך. נסה לרענן את הדף.' })
        setLoading(false)
        return
      }

      // Create appointment
      const { data: apt, error } = await supabase.from('appointments').insert({
        organization_id: profile.organization_id,
        patient_id: user.id,
        doctor_id: form.doctor_id || null,
        requested_specialty: form.specialty,
        chief_complaint: form.chief_complaint,
        complaint_description: form.complaint_description || null,
        urgency_level: form.urgency_level,
        payment_amount: selectedDoctor?.consultation_price || null,
        status: 'pending',
      }).select('id').single()

      if (error || !apt) throw error

      // Upload documents
      if (files.length > 0) {
        for (const file of files) {
          const path = `${profile.organization_id}/${user.id}/${apt.id}/${Date.now()}-${file.name}`
          const { error: uploadErr } = await supabase.storage.from('medical-documents').upload(path, file)
          if (!uploadErr) {
            await supabase.from('documents').insert({
              organization_id: profile.organization_id,
              patient_id: user.id,
              appointment_id: apt.id,
              uploaded_by: user.id,
              file_name: file.name,
              file_type: file.type,
              file_size_bytes: file.size,
              storage_path: path,
              document_type: 'patient_upload',
            })
          }
        }
      }

      // Trigger AI triage
      try {
        await fetch('/api/ai-triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: apt.id }),
        })
      } catch { /* non-critical */ }

      // Send confirmation email
      try {
        fetch('/api/email/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: apt.id }),
        })
      } catch { /* non-critical */ }

      // Show success, then redirect
      setSuccess(true)

      // Redirect to payment if appointment has a cost, otherwise to dashboard
      setTimeout(() => {
        if (selectedDoctor?.consultation_price) {
          router.push(`/dashboard/patient/payment?id=${apt.id}`)
        } else {
          router.push('/dashboard/patient/dashboard')
        }
      }, 1500)
    } catch {
      setErrors({ submit: 'שגיאה ביצירת התור' })
    } finally {
      setLoading(false)
    }
  }

  const steps: { key: Step; label: string; num: number }[] = [
    { key: 'specialty', label: 'התמחות', num: 1 },
    { key: 'doctor', label: 'רופא', num: 2 },
    { key: 'details', label: 'פרטים', num: 3 },
    { key: 'documents', label: 'מסמכים', num: 4 },
    { key: 'confirm', label: 'אישור', num: 5 },
  ]

  const currentIdx = steps.findIndex(s => s.key === step)

  // Success state
  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-800">הבקשה נשלחה בהצלחה!</h2>
            <p className="text-gray-500">
              {selectedDoctor?.consultation_price
                ? 'מעביר אותך לדף התשלום...'
                : 'התור שלך נוצר. נעדכן אותך כשהרופא יאשר.'
              }
            </p>
            <Spinner className="mx-auto" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">קביעת תור חדש</h2>

      {/* Progress steps */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              i <= currentIdx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            )}>{s.num}</div>
            <span className={cn('text-xs mr-1.5 hidden sm:block', i <= currentIdx ? 'text-blue-600 font-medium' : 'text-gray-400')}>{s.label}</span>
            {i < steps.length - 1 && <div className={cn('h-0.5 flex-1 mx-2', i < currentIdx ? 'bg-blue-600' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Step 1: Specialty */}
          {step === 'specialty' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">בחר התמחות</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SPECIALTIES.map(s => (
                  <button key={s.id} onClick={() => { setForm(p => ({ ...p, specialty: s.id })); setStep('doctor') }}
                    className={cn('p-4 rounded-xl border-2 text-sm font-medium transition-all text-center hover:border-blue-400 hover:bg-blue-50',
                      form.specialty === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200')}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Doctor */}
          {step === 'doctor' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">בחר רופא</h3>
              <p className="text-sm text-gray-500">או השאר ריק לשיבוץ אוטומטי</p>

              {loadingDoctors ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>אין רופאים זמינים בהתמחות זו כרגע</p>
                  <Button variant="outline" onClick={() => { setForm(p => ({ ...p, doctor_id: '' })); setStep('details') }} className="mt-3">המשך ללא בחירת רופא</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {doctors.map(doc => (
                    <button key={doc.id} onClick={() => { setForm(p => ({ ...p, doctor_id: doc.id })); setStep('details') }}
                      className={cn('w-full p-4 rounded-xl border-2 text-right transition-all hover:border-blue-400',
                        form.doctor_id === doc.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200')}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700">
                          {doc.first_name.charAt(0)}{doc.last_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold">ד"ר {doc.first_name} {doc.last_name}</p>
                          {doc.bio && <p className="text-sm text-gray-500 truncate">{doc.bio}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            {doc.average_rating && <span className="text-sm">{doc.average_rating.toFixed(1)} ({doc.total_ratings})</span>}
                            {doc.consultation_price && <span className="text-sm font-medium text-green-700">{formatPrice(doc.consultation_price)}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  <Button variant="ghost" onClick={() => { setForm(p => ({ ...p, doctor_id: '' })); setStep('details') }} className="w-full">המשך ללא בחירת רופא</Button>
                </div>
              )}

              <Button variant="outline" onClick={() => setStep('specialty')}>חזור</Button>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">תאר את הבעיה</h3>
              <Input label="תלונה עיקרית" placeholder="למשל: כאב ראש חזק כבר שבוע" value={form.chief_complaint}
                onChange={e => setForm(p => ({ ...p, chief_complaint: e.target.value }))} error={errors.chief_complaint} required />
              <Textarea label="פירוט (אופציונלי)" placeholder="תאר מתי התחיל, מה מקל/מחמיר, תסמינים נוספים..."
                value={form.complaint_description} onChange={e => setForm(p => ({ ...p, complaint_description: e.target.value }))} />
              <Select label="דחיפות" value={form.urgency_level} onChange={e => setForm(p => ({ ...p, urgency_level: e.target.value }))}
                options={[{ value: 'routine', label: 'רגיל' }, { value: 'soon', label: 'בהקדם' }, { value: 'urgent', label: 'דחוף' }]} />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('doctor')}>חזור</Button>
                <Button onClick={() => { if (form.chief_complaint.length >= 5) setStep('documents'); else setErrors({ chief_complaint: 'לפחות 5 תווים' }) }} className="flex-1">המשך</Button>
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 'documents' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">העלאת מסמכים (אופציונלי)</h3>
              <p className="text-sm text-gray-500">העלה בדיקות מעבדה, תמונות, הפניות</p>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                <input type="file" multiple accept="image/*,.pdf,.doc,.docx" id="file-upload"
                  onChange={e => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files).filter(f => {
                        if (f.size > 10 * 1024 * 1024) {
                          setErrors(prev => ({ ...prev, files: `הקובץ ${f.name} גדול מ-10MB` }))
                          return false
                        }
                        return true
                      })
                      setFiles(prev => [...prev, ...newFiles])
                    }
                  }}
                  className="hidden" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="font-medium text-gray-700">לחץ להעלאת קבצים</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, תמונות, Word — עד 10MB לקובץ</p>
                </label>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                      <span className="text-sm truncate">{f.name}</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 text-sm hover:underline" aria-label={`הסר ${f.name}`}>הסר</button>
                    </div>
                  ))}
                </div>
              )}

              {errors.files && (
                <p className="text-sm text-red-600" role="alert">{errors.files}</p>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('details')}>חזור</Button>
                <Button onClick={() => { setErrors({}); setStep('confirm') }} className="flex-1">המשך</Button>
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">אישור תור</h3>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">התמחות</span>
                  <span className="font-medium">{SPECIALTIES.find(s => s.id === form.specialty)?.label}</span>
                </div>
                {selectedDoctor && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">רופא</span>
                    <span className="font-medium">ד"ר {selectedDoctor.first_name} {selectedDoctor.last_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">תלונה</span>
                  <span className="font-medium">{form.chief_complaint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">דחיפות</span>
                  <span className="font-medium">{
                    form.urgency_level === 'urgent' ? 'דחוף' :
                    form.urgency_level === 'soon' ? 'בהקדם' : 'רגיל'
                  }</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">מסמכים</span>
                  <span className="font-medium">{files.length > 0 ? `${files.length} קבצים` : 'ללא'}</span>
                </div>
                {selectedDoctor?.consultation_price && (
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-gray-500">מחיר</span>
                    <span className="font-bold text-lg text-green-700">{formatPrice(selectedDoctor.consultation_price)}</span>
                  </div>
                )}
              </div>

              {errors.submit && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{errors.submit}</div>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('documents')}>חזור</Button>
                <Button onClick={handleSubmit} loading={loading} className="flex-1" size="lg">שלח בקשה</Button>
              </div>

              <p className="text-xs text-gray-400 text-center">התשלום יתבצע לאחר אישור הרופא</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
