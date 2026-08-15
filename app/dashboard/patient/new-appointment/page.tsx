'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Textarea, Card, CardContent, Spinner } from '@/components/ui'
import { SPECIALTIES, formatPrice, cn } from '@/lib/utils'
import { newAppointmentSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import { useOrgContext } from '@/lib/hooks/useOrgContext'
import type { User } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────
type Step = 'specialty' | 'doctor' | 'datetime' | 'details' | 'documents' | 'confirm'
type AppointmentType = 'video' | 'clinic'

type DoctorRow = User & { organization_id: string }

type Slot = { datetime: string; doctorId: string; doctorName: string }

function formatHebrewDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  return `יום ${days[d.getDay()]}, ${d.getDate()} ב${months[d.getMonth()]}`
}

function formatTime(isoDatetime: string): string {
  const d = new Date(isoDatetime)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function formatHebrewDateTime(isoDatetime: string): string {
  const d = new Date(isoDatetime)
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  return `יום ${days[d.getDay()]}, ${d.getDate()} ב${months[d.getMonth()]} — ${time}`
}

// ── Specialty icons ────────────────────────────────────────────────
const SPECIALTY_ICONS: Record<string, string> = {
  general:       '🩺',
  dermatology:   '🔬',
  orthopedics:   '🦴',
  cardiology:    '❤️',
  ent:           '👂',
  neurology:     '🧠',
  gastro:        '🫁',
  urology:       '💊',
  gynecology:    '🌸',
  ophthalmology: '👁️',
  psychiatry:    '🧘',
  endocrinology: '⚗️',
  pulmonology:   '🫀',
  pediatrics:    '👶',
  pain:          '🩹',
  oncology:      '🔬',
}

const STEPS: { key: Step; label: string; num: number }[] = [
  { key: 'specialty', label: 'התמחות', num: 1 },
  { key: 'doctor',    label: 'רופא',   num: 2 },
  { key: 'datetime',  label: 'מועד',   num: 3 },
  { key: 'details',   label: 'פרטים',  num: 4 },
  { key: 'documents', label: 'מסמכים', num: 5 },
  { key: 'confirm',   label: 'אישור',  num: 6 },
]

const URGENCY_OPTIONS = [
  { value: 'routine', label: 'רגיל',  desc: 'תוך מספר ימים',  color: 'emerald' },
  { value: 'soon',    label: 'בהקדם', desc: 'תוך 24–48 שעות', color: 'amber' },
  { value: 'urgent',  label: 'דחוף',  desc: 'בהקדם האפשרי',   color: 'red' },
]

// ── Component ─────────────────────────────────────────────────────
export default function NewAppointmentPage() {
  const router   = useRouter()
  const supabase = getClient()
  const searchParams = useSearchParams()

  // Doctor deep-link: /new-appointment?doctor=<id> preselects the doctor
  const [pendingDoctorId, setPendingDoctorId] = useState<string | null>(searchParams.get('doctor'))

  const [step, setStep]           = useState<Step>('specialty')
  const [loading, setLoading]     = useState(false)
  const [doctors, setDoctors]     = useState<DoctorRow[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [patientOrgId, setPatientOrgId] = useState<string | null | undefined>(undefined)

  const [slots, setSlots]             = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [form, setForm] = useState({
    specialty: '',
    doctor_id: '',
    scheduled_at: '',
    chief_complaint: '',
    complaint_description: '',
    urgency_level: 'routine',
    appointment_type: 'video' as AppointmentType,
  })
  const [files, setFiles]   = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Resolve org context: clinic subdomain > patient's existing org > marketplace
  const { ctx: orgCtx, loading: orgLoading } = useOrgContext(patientOrgId)

  // Load patient profile to get their org_id
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('organization_id').eq('id', user.id).single()
        .then(({ data }) => {
          setPatientOrgId((data as { organization_id: string | null } | null)?.organization_id ?? null)
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Doctor deep-link: resolve the doctor's specialty so we land directly on their slots
  useEffect(() => {
    if (!pendingDoctorId || form.specialty) return
    supabase.from('users')
      .select('specialties')
      .eq('id', pendingDoctorId)
      .eq('role', 'doctor')
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        const specs = (data as { specialties: string[] | null } | null)?.specialties
        if (specs && specs.length > 0) {
          setForm(p => ({ ...p, specialty: specs[0] }))
        } else {
          setPendingDoctorId(null) // doctor not bookable — fall back to normal flow
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDoctorId])

  // Fetch doctors whenever specialty or org context changes
  useEffect(() => {
    if (!form.specialty || orgLoading || patientOrgId === undefined) return

    setLoadingDocs(true)
    setForm(p => ({ ...p, doctor_id: '' }))
    setDoctors([])

    const load = async () => {
      try {
        let query = supabase
          .from('users')
          .select('id, first_name, last_name, specialties, bio, consultation_price, average_rating, total_ratings, avatar_url, languages, organization_id')
          .eq('role', 'doctor')
          .eq('is_active', true)
          .contains('specialties', [form.specialty])

        // ── Clinic mode: filter by org ──────────────────────────────
        if (orgCtx.id) {
          query = query.eq('organization_id', orgCtx.id)
        }
        // ── Marketplace mode: all active doctors ────────────────────
        // no additional filter

        const { data } = await query
        const loaded = (data || []) as unknown as DoctorRow[]
        setDoctors(loaded)

        // Deep-link: auto-select the requested doctor and skip ahead to slots
        if (pendingDoctorId && loaded.some(d => d.id === pendingDoctorId)) {
          setForm(p => ({ ...p, doctor_id: pendingDoctorId }))
          setStep('datetime')
          setPendingDoctorId(null)
        }
      } catch {
        // Prevents infinite spinner on error
      } finally {
        setLoadingDocs(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.specialty, orgCtx.id, orgLoading, patientOrgId])

  // Fetch available slots when reaching the datetime step
  useEffect(() => {
    if (step !== 'datetime') return

    // Need an orgId to fetch slots
    const orgIdForSlots = form.doctor_id
      ? doctors.find(d => d.id === form.doctor_id)?.organization_id
      : orgCtx.id

    if (!orgIdForSlots) return

    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)

    const params = new URLSearchParams({ orgId: orgIdForSlots, days: '30' })
    if (form.doctor_id) params.set('doctorId', form.doctor_id)

    fetch(`/api/appointments/available-slots?${params}`)
      .then(r => r.ok ? r.json() : { slots: [] })
      .then((d: { slots: Slot[] }) => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.doctor_id, orgCtx.id])

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

      // Resolve appointment org_id:
      // - Clinic mode: use orgCtx.id (patient's clinic or subdomain clinic)
      // - Marketplace: use the selected doctor's org_id, and assign patient to it
      let appointmentOrgId = orgCtx.id

      if (orgCtx.isMarketplace && selectedDoctor?.organization_id) {
        appointmentOrgId = selectedDoctor.organization_id

        // Assign patient to this clinic on their first booking
        await supabase.from('users')
          .update({ organization_id: appointmentOrgId })
          .eq('id', user.id)
      }

      if (!appointmentOrgId) {
        setErrors({ submit: 'לא ניתן לזהות מרפאה. בחר רופא ונסה שוב.' })
        toast.error('יש לבחור רופא')
        setLoading(false)
        return
      }

      const { data: apt, error } = await supabase.from('appointments').insert({
        organization_id: appointmentOrgId,
        patient_id: user.id,
        doctor_id: form.doctor_id || null,
        requested_specialty: form.specialty,
        chief_complaint: form.chief_complaint,
        complaint_description: form.complaint_description || null,
        urgency_level: form.urgency_level,
        appointment_type: form.appointment_type,
        payment_amount: selectedDoctor?.consultation_price || null,
        scheduled_at: selectedSlot || null,
        status: 'pending',
      }).select('id').single()

      if (error || !apt) throw error

      if (files.length > 0) {
        for (const file of files) {
          const path = `${appointmentOrgId}/${user.id}/${apt.id}/${Date.now()}-${file.name}`
          const { error: uploadErr } = await supabase.storage.from('medical-documents').upload(path, file)
          if (!uploadErr) {
            await supabase.from('documents').insert({
              organization_id: appointmentOrgId,
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

      try {
        await fetch('/api/ai-triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: apt.id }),
        })
      } catch { /* non-critical */ }

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
        router.push(selectedDoctor?.consultation_price
          ? `/dashboard/patient/payment?id=${apt.id}`
          : '/dashboard/patient/dashboard')
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
            <h2 className="text-2xl font-bold text-slate-900">הבקשה נשלחה!</h2>
            <p className="text-slate-500 mt-2">
              {selectedDoctor?.consultation_price
                ? 'מעביר אותך לדף התשלום...'
                : 'התור נוצר. נעדכן אותך ברגע שהרופא יאשר.'}
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
        <h1 className="text-2xl font-bold text-slate-900">קביעת תור חדש</h1>
        <p className="text-sm text-slate-500 mt-1">
          {orgCtx.isMarketplace
            ? 'בחר התמחות ורופא — ייעוץ מכל מרפאה בפלטפורמה'
            : `ייעוץ רפואי אונליין — ${orgCtx.name}`}
        </p>
      </div>

      {/* Marketplace badge */}
      {orgCtx.isMarketplace && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>אתה גולש בפלטפורמה הראשית — תוכל לבחור רופא מכל המרפאות. לאחר בחירת רופא תשויך אוטומטית למרפאה שלו.</span>
        </div>
      )}

      {/* Clinic badge */}
      {!orgCtx.isMarketplace && !orgLoading && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>קביעת תור ב<strong className="mx-1">{orgCtx.name}</strong> — תוצג רשימת הרופאים של המרפאה</span>
        </div>
      )}

      {/* ── Stepper ── */}
      <div className="flex items-center" role="list" aria-label="שלבי קביעת תור">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none" role="listitem">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                i < currentIdx   ? 'bg-teal-600 border-teal-600 text-white' :
                i === currentIdx ? 'bg-white border-teal-600 text-teal-600 shadow-md shadow-teal-100' :
                                   'bg-white border-slate-200 text-slate-400'
              )}>
                {i < currentIdx
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : s.num}
              </div>
              <span className={cn('text-xs hidden sm:block font-medium',
                i === currentIdx ? 'text-teal-600' : i < currentIdx ? 'text-teal-400' : 'text-slate-400')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-2 mt-[-12px] transition-all', i < currentIdx ? 'bg-teal-500' : 'bg-slate-200')} />
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
                <h2 className="text-xl font-bold text-slate-900">בחר התמחות</h2>
                <p className="text-sm text-slate-500 mt-1">איזה מומחה אתה מחפש?</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SPECIALTIES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setForm(p => ({ ...p, specialty: s.id })); setStep('doctor') }}
                    className={cn(
                      'p-4 rounded-2xl border-2 text-right transition-all hover:shadow-sm active:scale-[0.98]',
                      form.specialty === s.id
                        ? 'border-teal-500 bg-teal-50 shadow-md shadow-teal-100'
                        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
                    )}
                  >
                    <div className="text-2xl mb-2">{SPECIALTY_ICONS[s.id] || '🏥'}</div>
                    <p className={cn('text-sm font-semibold', form.specialty === s.id ? 'text-teal-700' : 'text-slate-800')}>
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
                <h2 className="text-xl font-bold text-slate-900">בחר רופא</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {orgCtx.isMarketplace
                    ? `רופאים זמינים ב${SPECIALTIES.find(s => s.id === form.specialty)?.label} — מכל המרפאות`
                    : `רופאים של ${orgCtx.name} ב${SPECIALTIES.find(s => s.id === form.specialty)?.label}`}
                </p>
              </div>

              {loadingDocs ? (
                <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
                  <Spinner />
                  <p className="text-sm">מחפש רופאים זמינים...</p>
                </div>
              ) : doctors.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center space-y-3">
                  <div className="text-4xl">🔍</div>
                  <p className="font-medium text-slate-700">אין רופאים זמינים בהתמחות זו כרגע</p>
                  <p className="text-sm text-slate-400">ניתן להמשיך ולהגיש בקשה — נשבץ לך רופא</p>
                  {orgCtx.isMarketplace ? (
                    <p className="text-xs text-amber-600">בקביעת תור ללא רופא ספציפי לא נוכל לשייך אותך למרפאה</p>
                  ) : (
                    <Button variant="outline" onClick={() => { setForm(p => ({ ...p, doctor_id: '' })); setStep('details') }}>
                      המשך ללא בחירת רופא
                    </Button>

                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {doctors.map(doc => (
                    <DoctorCard
                      key={doc.id}
                      doc={doc}
                      selected={form.doctor_id === doc.id}
                      showClinic={orgCtx.isMarketplace}
                      onClick={() => { setForm(p => ({ ...p, doctor_id: doc.id })); setStep('datetime') }}
                    />
                  ))}
                  {!orgCtx.isMarketplace && (
                    <button
                      onClick={() => { setForm(p => ({ ...p, doctor_id: '' })); setStep('datetime') }}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all"
                    >
                      המשך ללא בחירת רופא ← יושבץ אוטומטית
                    </button>
                  )}
                </div>
              )}

              <Button variant="outline" onClick={() => setStep('specialty')}>← חזור</Button>
            </div>
          )}

          {/* ── Step 3: Datetime ── */}
          {step === 'datetime' && (() => {
            const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, s) => {
              const dateKey = s.datetime.slice(0, 10)
              if (!acc[dateKey]) acc[dateKey] = []
              acc[dateKey].push(s)
              return acc
            }, {})
            const hasDoctorOrOrg = !!form.doctor_id || !!orgCtx.id

            return (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">בחר מועד</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedDoctor
                      ? `מועדים פנויים אצל ד"ר ${selectedDoctor.first_name} ${selectedDoctor.last_name}`
                      : 'מועדים פנויים אצל הרופאים הזמינים'}
                  </p>
                </div>

                {!hasDoctorOrOrg ? (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center space-y-3">
                    <div className="text-4xl">📅</div>
                    <p className="font-medium text-slate-700">לא נבחר רופא</p>
                    <p className="text-sm text-slate-500">הרופא יתאם איתך מועד לאחר אישור הבקשה</p>
                  </div>
                ) : slotsLoading ? (
                  <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
                    <Spinner />
                    <p className="text-sm">טוען מועדים פנויים...</p>
                  </div>
                ) : Object.keys(slotsByDate).length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center space-y-3">
                    <div className="text-4xl">📅</div>
                    <p className="font-medium text-slate-700">
                      {form.doctor_id ? 'אין זמינות כרגע לרופא זה' : 'אין מועדים פנויים ב-30 הימים הקרובים'}
                    </p>
                    <p className="text-sm text-slate-400">
                      ניתן להמשיך והרופא יתאם איתך מועד לאחר אישור הבקשה{form.doctor_id ? ', או לבחור רופא אחר' : ''}
                    </p>
                    {form.doctor_id && (
                      <Button variant="outline" onClick={() => setStep('doctor')}>← בחר רופא אחר</Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5 max-h-[380px] overflow-y-auto pl-1 -mr-1">
                    {Object.entries(slotsByDate).map(([dateKey, dateSlots]) => (
                      <div key={dateKey}>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                          {formatHebrewDate(dateKey)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {dateSlots.map(slot => (
                            <button
                              key={slot.datetime}
                              type="button"
                              onClick={() => setSelectedSlot(prev => prev === slot.datetime ? null : slot.datetime)}
                              className={cn(
                                'px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                                selectedSlot === slot.datetime
                                  ? 'border-teal-500 bg-teal-600 text-white shadow-md shadow-teal-100'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                              )}
                            >
                              {formatTime(slot.datetime)}
                              {!form.doctor_id && (
                                <span className={cn('block text-[10px] mt-0.5', selectedSlot === slot.datetime ? 'text-teal-100' : 'text-slate-400')}>
                                  {slot.doctorName.replace('ד"ר ', '')}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedSlot && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>נבחר: <strong>{formatHebrewDateTime(selectedSlot)}</strong></span>
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="mr-auto text-teal-400 hover:text-teal-600"
                      aria-label="בטל בחירה"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep('doctor')}>← חזור</Button>
                  <Button
                    className="flex-1"
                    onClick={() => { setErrors({}); setStep('details') }}
                  >
                    {selectedSlot ? 'המשך →' : 'המשך ללא בחירת מועד →'}
                  </Button>
                </div>
              </div>
            )
          })()}

          {/* ── Step 4: Details ── */}
          {step === 'details' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">תאר את הבעיה</h2>
                <p className="text-sm text-slate-500 mt-1">פרט כמה שיותר — הרופא יראה זאת לפני הייעוץ</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
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
                        : 'border-slate-200 focus:border-teal-400 focus:ring-teal-100'
                    )}
                    aria-required="true"
                    aria-invalid={!!errors.chief_complaint}
                  />
                  {errors.chief_complaint && (
                    <p className="text-xs text-red-600 mt-1" role="alert">{errors.chief_complaint}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">פירוט נוסף (אופציונלי)</label>
                  <Textarea
                    placeholder="מתי התחיל? מה מקל/מחמיר? תסמינים נוספים?"
                    value={form.complaint_description}
                    onChange={e => setForm(p => ({ ...p, complaint_description: e.target.value }))}
                    rows={4}
                  />
                </div>

                {/* Appointment type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">סוג ייעוץ</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'video',  label: 'וידאו אונליין', desc: 'מהבית, בלי נסיעה', icon: '📹' },
                      { value: 'clinic', label: 'במרפאה',        desc: 'ביקור פיזי',       icon: '🏥' },
                    ] as { value: AppointmentType; label: string; desc: string; icon: string }[]).map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, appointment_type: t.value }))}
                        className={cn(
                          'p-4 rounded-2xl border-2 text-right transition-all',
                          form.appointment_type === t.value
                            ? 'border-teal-500 bg-teal-50 shadow-sm shadow-teal-100'
                            : 'border-slate-200 bg-white hover:border-teal-300'
                        )}
                      >
                        <div className="text-2xl mb-1.5">{t.icon}</div>
                        <p className={cn('font-semibold text-sm', form.appointment_type === t.value ? 'text-teal-700' : 'text-slate-800')}>
                          {t.label}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">דחיפות</label>
                  <div className="grid grid-cols-3 gap-2">
                    {URGENCY_OPTIONS.map(u => (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, urgency_level: u.value }))}
                        className={cn(
                          'p-3 rounded-xl border-2 text-center transition-all',
                          form.urgency_level === u.value
                            ? u.color === 'red'   ? 'border-red-500 bg-red-50' :
                              u.color === 'amber' ? 'border-amber-500 bg-amber-50' :
                                                    'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        )}
                      >
                        <p className={cn('font-bold text-sm',
                          form.urgency_level === u.value
                            ? u.color === 'red' ? 'text-red-700' : u.color === 'amber' ? 'text-amber-700' : 'text-emerald-700'
                            : 'text-slate-700'
                        )}>{u.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{u.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('datetime')}>← חזור</Button>
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
                <h2 className="text-xl font-bold text-slate-900">העלאת מסמכים</h2>
                <p className="text-sm text-slate-500 mt-1">בדיקות, תמונות, הפניות — הרופא יצפה בהם לפני הייעוץ</p>
              </div>

              <div
                className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-all cursor-pointer"
                onClick={() => document.getElementById('apt-file-upload')?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-teal-400', 'bg-teal-50') }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-teal-400', 'bg-teal-50') }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-teal-400', 'bg-teal-50')
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
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="font-semibold text-slate-700">גרור ושחרר, או לחץ לבחירת קבצים</p>
                <p className="text-xs text-slate-400 mt-1">PDF, תמונות, Word — עד 10MB לקובץ</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{files.length} קבצים נבחרו</p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                      <svg className="w-5 h-5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
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
                <h2 className="text-xl font-bold text-slate-900">אישור ושליחה</h2>
                <p className="text-sm text-slate-500 mt-1">בדוק את הפרטים לפני שליחת הבקשה</p>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 divide-y">
                <SummaryRow label="התמחות" value={SPECIALTIES.find(s => s.id === form.specialty)?.label || ''} icon="🏥" />
                {selectedDoctor && (
                  <SummaryRow label="רופא" value={`ד"ר ${selectedDoctor.first_name} ${selectedDoctor.last_name}`} icon="👨‍⚕️" />
                )}
                {selectedSlot && (
                  <SummaryRow label="מועד מבוקש" value={formatHebrewDateTime(selectedSlot)} icon="📅" />
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
                    <span className="font-bold text-slate-900">סה&quot;כ לתשלום</span>
                    <span className="text-2xl font-bold text-emerald-600">{formatPrice(selectedDoctor.consultation_price)}</span>
                  </div>
                )}
              </div>

              {orgCtx.isMarketplace && selectedDoctor && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>לאחר שליחת הבקשה תשויך אוטומטית למרפאת הרופא שבחרת.</span>
                </div>
              )}

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

              <p className="text-xs text-slate-400 text-center">
                {selectedDoctor?.consultation_price
                  ? 'התשלום יתבצע בשלב הבא לאחר אישור הרופא'
                  : selectedSlot
                    ? 'הרופא יאשר את המועד שבחרת — נשלח לך אישור'
                    : 'לאחר שהרופא יאשר, ניצור איתך קשר לתיאום מועד'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Doctor card ───────────────────────────────────────────────────
function DoctorCard({
  doc, selected, showClinic, onClick,
}: {
  doc: DoctorRow
  selected: boolean
  showClinic: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-2xl border-2 text-right transition-all hover:shadow-sm active:scale-[0.99]',
        selected
          ? 'border-teal-500 bg-teal-50 shadow-md shadow-teal-100'
          : 'border-slate-200 bg-white hover:border-teal-300'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center text-xl font-bold text-white shrink-0 overflow-hidden">
          {doc.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={doc.avatar_url} alt="" className="w-full h-full object-cover" />
            : `${doc.first_name.charAt(0)}${doc.last_name.charAt(0)}`}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900">ד&quot;ר {doc.first_name} {doc.last_name}</p>
          {doc.specialties?.length && (
            <p className="text-xs text-teal-600 font-medium mt-0.5">{doc.specialties.slice(0, 3).join(' · ')}</p>
          )}
          {showClinic && doc.organization_id && (
            <ClinicName orgId={doc.organization_id} />
          )}
          {doc.bio && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{doc.bio}</p>}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {doc.average_rating != null && (
              <span className="flex items-center gap-1 text-sm">
                <span className="text-yellow-400">★</span>
                <span className="font-medium text-slate-700">{doc.average_rating.toFixed(1)}</span>
                <span className="text-slate-400">({doc.total_ratings})</span>
              </span>
            )}
            {doc.consultation_price && (
              <span className="text-sm font-bold text-emerald-600">{formatPrice(doc.consultation_price)}</span>
            )}
            {doc.languages?.length && (
              <span className="text-xs text-slate-400">{doc.languages.join(', ')}</span>
            )}
          </div>
        </div>
        {selected && (
          <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
    </button>
  )
}

// ── Clinic name fetcher (marketplace mode) ────────────────────────
function ClinicName({ orgId }: { orgId: string }) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    fetch(`/api/org/by-id?id=${orgId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { name?: string } | null) => { if (d?.name) setName(d.name) })
      .catch(() => null)
  }, [orgId])
  if (!name) return null
  return <p className="text-xs text-slate-400 mt-0.5">🏥 {name}</p>
}

// ── Summary row helper ────────────────────────────────────────────
function SummaryRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex items-center justify-between flex-1 min-w-0">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="font-semibold text-slate-900 text-sm truncate mr-4">{value}</span>
      </div>
    </div>
  )
}
