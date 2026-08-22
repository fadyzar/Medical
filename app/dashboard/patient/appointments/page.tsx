'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardHeader, Badge, PageLoading, EmptyState } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatDate, getInitials, cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Appointment, User } from '@/types/database'

type AptWithDoctor = Appointment & {
  doctor: Pick<User, 'id' | 'first_name' | 'last_name' | 'specialties' | 'avatar_url'> | null
}

type FilterKey = 'all' | 'active' | 'upcoming' | 'completed' | 'cancelled'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'הכל' },
  { key: 'active',    label: 'פעילים' },
  { key: 'upcoming',  label: 'מתוזמנים' },
  { key: 'completed', label: 'הושלמו' },
  { key: 'cancelled', label: 'בוטלו' },
]

const CANCELLED_STATUSES = ['cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor']
const ACTIVE_STATUSES    = ['pending', 'doctor_confirmed', 'time_selected', 'payment_pending', 'paid']
const UPCOMING_STATUSES  = ['scheduled', 'ready', 'in_progress']

function statusBadgeVariant(s: string): 'success' | 'danger' | 'warning' | 'info' | 'default' {
  if (s === 'completed') return 'success'
  if (CANCELLED_STATUSES.includes(s)) return 'danger'
  if (s === 'pending') return 'warning'
  if (UPCOMING_STATUSES.includes(s)) return 'success'
  return 'info'
}

function statusBar(s: string) {
  if (s === 'completed') return 'bg-emerald-400'
  if (s === 'in_progress' || s === 'ready') return 'bg-teal-500'
  if (s === 'pending') return 'bg-amber-400'
  if (CANCELLED_STATUSES.includes(s)) return 'bg-red-400'
  return 'bg-indigo-400'
}

function DoctorAvatar({ doc }: { doc: AptWithDoctor['doctor'] }) {
  if (!doc) return (
    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 shrink-0">?</div>
  )
  if (doc.avatar_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={doc.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
  )
  return (
    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-700 shrink-0">
      {getInitials(doc.first_name, doc.last_name)}
    </div>
  )
}

function StarRating({ rating, onRate }: { rating: number | null; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => onRate && setHover(s)}
          onMouseLeave={() => onRate && setHover(0)}
          onClick={() => onRate?.(s)}
          disabled={!onRate || rating != null}
          className={cn(
            'text-xl leading-none transition-colors',
            !onRate ? 'cursor-default' : 'cursor-pointer',
            s <= (hover || rating || 0) ? 'text-yellow-400' : 'text-slate-200'
          )}
          aria-label={`${s} כוכבים`}
        >★</button>
      ))}
    </div>
  )
}

// ── DoctorProposedBanner ──────────────────────────────────────────
function DoctorProposedBanner({ apt, onConfirm }: {
  apt: AptWithDoctor
  onConfirm: (updated: Partial<AptWithDoctor>) => void
}) {
  const supabase = getClient()
  const [saving, setSaving] = useState<'accept' | 'reject' | null>(null)

  const formatProposed = (iso: string) => {
    const d = new Date(iso)
    const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
    const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
    const t = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    return `יום ${days[d.getDay()]}, ${d.getDate()} ב${months[d.getMonth()]} — ${t}`
  }

  const accept = async () => {
    setSaving('accept')
    try {
      const updates = {
        patient_confirmed_proposed_at: new Date().toISOString(),
        status: 'scheduled' as const,
      }
      await supabase.from('appointments').update(updates).eq('id', apt.id)
      onConfirm(updates)
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  const reject = async () => {
    setSaving('reject')
    try {
      const updates = {
        scheduled_at: null,
        doctor_proposed_at: null,
        patient_confirmed_proposed_at: null,
        status: 'pending' as const,
      }
      await supabase.from('appointments').update(updates).eq('id', apt.id)
      onConfirm(updates)
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-amber-800">הרופא הציע מועד חלופי</p>
          <p className="text-sm text-amber-700 mt-0.5">
            {apt.doctor ? `ד"ר ${apt.doctor.first_name} ${apt.doctor.last_name}` : 'הרופא'} מציע:
            {' '}<strong>{formatProposed(apt.scheduled_at!)}</strong>
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 gap-1"
          loading={saving === 'accept'}
          disabled={!!saving}
          onClick={accept}
        >
          ✓ אשר מועד
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={saving === 'reject'}
          disabled={!!saving}
          onClick={reject}
        >
          דחה — הצע מועד אחר
        </Button>
      </div>
    </div>
  )
}

export default function PatientAppointmentsPage() {
  const router  = useRouter()
  const supabase = getClient()

  const [loading, setLoading]       = useState(true)
  const [appointments, setAppointments] = useState<AptWithDoctor[]>([])
  const [filter, setFilter]         = useState<FilterKey>('all')
  const [search, setSearch]         = useState('')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [ratingApt, setRatingApt]   = useState<string | null>(null)
  const [cancelId, setCancelId]     = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)

  useEffect(() => { load() }, [])

  const CANCELLABLE = ['pending', 'doctor_confirmed', 'time_selected', 'payment_pending', 'paid', 'scheduled', 'ready']

  const doCancel = async (id: string) => {
    setCancelBusy(true)
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, reason: cancelReason }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'שגיאה בביטול התור'); return }
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled_patient' } : a))
      toast.success('התור בוטל')
      setCancelId(null); setCancelReason('')
    } catch {
      toast.error('שגיאה בביטול התור')
    } finally {
      setCancelBusy(false)
    }
  }

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('appointments')
        .select('*, doctor:doctor_id(id, first_name, last_name, specialties, avatar_url)')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      setAppointments((data || []) as unknown as AptWithDoctor[])
    } catch {
      // Prevents infinite loading
    } finally {
      setLoading(false)
    }
  }

  const rateAppointment = async (id: string, rating: number) => {
    setRatingApt(id)
    await supabase.from('appointments').update({ patient_rating: rating }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, patient_rating: rating } : a))
    setRatingApt(null)
  }

  const applyFilter = (a: AptWithDoctor) => {
    if (filter === 'active')    return ACTIVE_STATUSES.includes(a.status)
    if (filter === 'upcoming')  return UPCOMING_STATUSES.includes(a.status)
    if (filter === 'completed') return a.status === 'completed'
    if (filter === 'cancelled') return CANCELLED_STATUSES.includes(a.status)
    return true
  }

  const applySearch = (a: AptWithDoctor) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.chief_complaint?.toLowerCase().includes(q) ||
      a.doctor?.first_name?.toLowerCase().includes(q) ||
      a.doctor?.last_name?.toLowerCase().includes(q) ||
      false
    )
  }

  const filtered = appointments.filter(a => applyFilter(a) && applySearch(a))

  const countFor = (k: FilterKey) => {
    if (k === 'all')       return appointments.length
    if (k === 'active')    return appointments.filter(a => ACTIVE_STATUSES.includes(a.status)).length
    if (k === 'upcoming')  return appointments.filter(a => UPCOMING_STATUSES.includes(a.status)).length
    if (k === 'completed') return appointments.filter(a => a.status === 'completed').length
    if (k === 'cancelled') return appointments.filter(a => CANCELLED_STATUSES.includes(a.status)).length
    return 0
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">התורים שלי</h1>
          <p className="text-sm text-slate-500 mt-0.5">היסטוריה מלאה של כל הביקורים והייעוצים</p>
        </div>
        <Button onClick={() => router.push('/dashboard/patient/new-appointment')}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          קבע תור חדש
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          type="search"
          placeholder="חיפוש לפי תלונה או שם רופא..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:outline-none"
          aria-label="חיפוש תורים"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 left-3 flex items-center text-slate-400 hover:text-slate-600" aria-label="נקה חיפוש">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 flex-wrap" role="tablist">
        {FILTERS.map(f => {
          const count = countFor(f.key)
          const active = filter === f.key
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                active
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300 hover:text-teal-600'
              )}
            >
              {f.label}
              <span className={cn('text-xs tabular-nums px-1.5 py-0.5 rounded-full font-semibold', active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
            }
            title={search ? 'לא נמצאו תורים' : 'אין תורים להצגה'}
            description={
              search
                ? `לא נמצאו תורים עבור "${search}"`
                : filter === 'all'
                  ? 'לא קבעת עדיין תורים. קבע את הייעוץ הראשון שלך!'
                  : 'אין תורים בקטגוריה זו'
            }
            action={filter === 'all' ? (
              <Button onClick={() => router.push('/dashboard/patient/new-appointment')}>קבע תור ראשון</Button>
            ) : search ? (
              <Button variant="outline" onClick={() => setSearch('')}>נקה חיפוש</Button>
            ) : undefined}
          />
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {filtered.map(apt => {
              const isExpanded = expanded === apt.id
              const doc = apt.doctor
              const isNearTime = apt.scheduled_at
                ? (new Date(apt.scheduled_at).getTime() - Date.now()) <= 15 * 60 * 1000
                : false
              const canVideo = apt.status === 'in_progress' ||
                ((['ready', 'scheduled', 'paid'].includes(apt.status)) && isNearTime)
              const needsPayment = apt.status === 'payment_pending' || apt.payment_status === 'failed'
              const isCompleted = apt.status === 'completed'
              const doctorProposedPending = !!apt.doctor_proposed_at && !apt.patient_confirmed_proposed_at

              return (
                <div key={apt.id} className="hover:bg-slate-50/60 transition-colors">

                  {/* Main row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : apt.id)}
                    className="w-full px-5 py-4 text-right"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status bar */}
                      <div className={cn('w-1 h-10 rounded-full shrink-0', statusBar(apt.status))} />

                      {/* Doctor avatar */}
                      <DoctorAvatar doc={doc} />

                      {/* Info */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{apt.chief_complaint}</p>
                          {apt.status === 'in_progress' && (
                            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              מתקיים עכשיו
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {doc ? `ד"ר ${doc.first_name} ${doc.last_name}` : 'ממתין לשיוך רופא'}
                          {' · '}
                          {apt.scheduled_at ? formatDateTime(apt.scheduled_at) : formatDate(apt.created_at)}
                        </p>
                        {isCompleted && apt.patient_rating && (
                          <div className="flex gap-0.5 mt-1">
                            {[1,2,3,4,5].map(s => (
                              <span key={s} className={cn('text-sm', s <= apt.patient_rating! ? 'text-yellow-400' : 'text-slate-200')}>★</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right side */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusBadgeVariant(apt.status)}>{STATUS_LABELS[apt.status]}</Badge>
                        <svg className={cn('w-4 h-4 text-slate-400 transition-transform duration-200', isExpanded && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4">
                      <div className="h-px bg-slate-100" />

                      {/* Doctor proposed alternative time banner */}
                      {doctorProposedPending && apt.scheduled_at && (
                        <DoctorProposedBanner
                          apt={apt}
                          onConfirm={updated => setAppointments(prev =>
                            prev.map(a => a.id === apt.id ? { ...a, ...updated } : a)
                          )}
                        />
                      )}

                      {/* Quick actions */}
                      {(canVideo || needsPayment || CANCELLABLE.includes(apt.status)) && (
                        <div className="flex gap-2 flex-wrap">
                          {canVideo && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 gap-1.5"
                              onClick={() => router.push(`/video-call?id=${apt.id}`)}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                              </svg>
                              הצטרף לשיחה
                            </Button>
                          )}
                          {needsPayment && (
                            <Button
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700 gap-1.5"
                              onClick={() => router.push(`/dashboard/patient/payment?id=${apt.id}`)}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
                              </svg>
                              {apt.payment_status === 'failed' ? 'חזור לתשלום' : 'שלם עכשיו'}
                            </Button>
                          )}
                          {CANCELLABLE.includes(apt.status) && cancelId !== apt.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                              onClick={() => { setCancelId(apt.id); setCancelReason('') }}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              ביטול תור
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Cancellation confirm panel */}
                      {cancelId === apt.id && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
                          <p className="text-sm font-semibold text-slate-800">לבטל את התור?</p>
                          <p className="text-xs text-slate-500">הפעולה תבטל את התור. ההיסטוריה הרפואית נשמרת.</p>
                          <textarea
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            placeholder="סיבת ביטול (אופציונלי)"
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" loading={cancelBusy} className="bg-rose-600 hover:bg-rose-700" onClick={() => doCancel(apt.id)}>
                              אשר ביטול
                            </Button>
                            <Button size="sm" variant="outline" disabled={cancelBusy} onClick={() => { setCancelId(null); setCancelReason('') }}>
                              חזור
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Details grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {/* Appointment info */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">פרטי הביקור</p>
                          <div className="space-y-1 text-slate-700">
                            {apt.requested_specialty && (
                              <p><span className="text-slate-400 text-xs">התמחות:</span> <span className="font-medium">{apt.requested_specialty}</span></p>
                            )}
                            {apt.scheduled_at && (
                              <p><span className="text-slate-400 text-xs">מועד:</span> <span className="font-medium">{formatDateTime(apt.scheduled_at)}</span></p>
                            )}
                            {apt.complaint_description && (
                              <p><span className="text-slate-400 text-xs">תיאור:</span> <span className="text-slate-600">{apt.complaint_description}</span></p>
                            )}
                            {apt.payment_amount && (
                              <p><span className="text-slate-400 text-xs">עלות:</span> <span className="font-medium text-green-700">{apt.payment_amount} ₪</span></p>
                            )}
                          </div>
                        </div>

                        {/* Doctor info */}
                        {doc && (
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">הרופא המטפל</p>
                            <div className="flex items-center gap-2">
                              <DoctorAvatar doc={doc} />
                              <div>
                                <p className="font-semibold text-slate-900">ד&quot;ר {doc.first_name} {doc.last_name}</p>
                                {doc.specialties?.length && (
                                  <p className="text-xs text-slate-500">{doc.specialties.slice(0, 2).join(', ')}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Medical summary (completed) */}
                      {isCompleted && (apt.diagnosis || apt.follow_up_instructions || apt.ai_summary) && (
                        <div className="space-y-3">
                          {apt.diagnosis && (
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1.5">סיכום רפואי</p>
                              <p className="text-sm text-emerald-800 font-medium">{apt.diagnosis}</p>
                              {apt.follow_up_instructions && (
                                <p className="text-sm text-emerald-700 mt-2">
                                  <span className="font-semibold">הנחיות מעקב: </span>
                                  {apt.follow_up_instructions}
                                </p>
                              )}
                            </div>
                          )}
                          {apt.ai_summary && (
                            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" /></svg>
                                <p className="text-xs font-semibold text-indigo-600">סיכום מסייע AI</p>
                              </div>
                              <p className="text-sm text-indigo-700 leading-relaxed">{apt.ai_summary}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rating for completed, unrated */}
                      {isCompleted && apt.patient_rating == null && ratingApt !== apt.id && (
                        <div className="flex items-center justify-between bg-yellow-50 rounded-xl px-4 py-3 border border-yellow-100">
                          <p className="text-sm font-medium text-yellow-800">כיצד היה הייעוץ?</p>
                          <StarRating
                            rating={null}
                            onRate={(r) => rateAppointment(apt.id, r)}
                          />
                        </div>
                      )}
                      {isCompleted && apt.patient_rating != null && (
                        <div className="flex items-center gap-2 text-sm text-slate-500 px-1">
                          <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          דירגת ביקור זה: {apt.patient_rating}/5
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
