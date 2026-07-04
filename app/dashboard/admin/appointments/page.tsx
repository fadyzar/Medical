'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Card, CardHeader, Badge, PageLoading, EmptyState } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatDate, formatPrice, getInitials, cn } from '@/lib/utils'
import type { Appointment, User, AppointmentStatus } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────

type FullAppointment = Appointment & {
  patient: Pick<User, 'first_name' | 'last_name' | 'phone' | 'email'> | null
  doctor:  Pick<User, 'first_name' | 'last_name' | 'specialties'> | null
}

type FilterKey = 'all' | 'pending' | 'active' | 'completed' | 'cancelled' | 'today'

// ── Helpers ────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string; color?: string }[] = [
  { key: 'all',       label: 'הכל' },
  { key: 'today',     label: 'היום' },
  { key: 'pending',   label: 'ממתינים' },
  { key: 'active',    label: 'פעילים' },
  { key: 'completed', label: 'הושלמו' },
  { key: 'cancelled', label: 'בוטלו' },
]

const CANCELLED_STATUSES = ['cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor']
const ACTIVE_STATUSES    = ['doctor_confirmed', 'time_selected', 'payment_pending', 'paid', 'scheduled', 'ready', 'in_progress']

function isToday(apt: FullAppointment): boolean {
  const date = apt.scheduled_at || apt.created_at
  return new Date(date).toDateString() === new Date().toDateString()
}

function statusBadge(s: string): 'success' | 'danger' | 'warning' | 'info' | 'default' {
  if (s === 'completed') return 'success'
  if (CANCELLED_STATUSES.includes(s)) return 'danger'
  if (s === 'pending') return 'warning'
  if (['ready', 'in_progress'].includes(s)) return 'success'
  return 'info'
}

function statusBar(s: string) {
  if (s === 'completed') return 'bg-emerald-400'
  if (s === 'in_progress' || s === 'ready') return 'bg-blue-500'
  if (s === 'pending') return 'bg-amber-400'
  if (CANCELLED_STATUSES.includes(s)) return 'bg-red-400'
  return 'bg-indigo-400'
}

// Admin can update some statuses
const ADMIN_ACTIONS: Partial<Record<AppointmentStatus, { label: string; next: AppointmentStatus; variant: 'primary' | 'outline' | 'danger' }[]>> = {
  pending: [
    { label: 'בטל תור', next: 'cancelled_patient', variant: 'danger' },
  ],
  doctor_confirmed: [
    { label: 'קבע מועד', next: 'time_selected', variant: 'primary' },
    { label: 'בטל', next: 'cancelled_patient', variant: 'danger' },
  ],
  time_selected: [
    { label: 'סמן שולם', next: 'paid', variant: 'primary' },
    { label: 'בטל', next: 'cancelled_patient', variant: 'danger' },
  ],
  paid: [
    { label: 'תזמן', next: 'scheduled', variant: 'primary' },
  ],
  scheduled: [
    { label: 'מוכן לכניסה', next: 'ready', variant: 'primary' },
    { label: 'לא הגיע', next: 'no_show_patient', variant: 'danger' },
  ],
}

// ── Main Component ─────────────────────────────────────────────────

export default function AdminAppointmentsPage() {
  const supabase = getClient()

  const [loading, setLoading]       = useState(true)
  const [appointments, setAppointments] = useState<FullAppointment[]>([])
  const [filter, setFilter]         = useState<FilterKey>('today')
  const [search, setSearch]         = useState('')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [orgId, setOrgId]           = useState('')

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return
      const oid = (profile as unknown as { organization_id: string }).organization_id
      setOrgId(oid)
      await loadAppointments(oid)
    } catch {
      toast.error('שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }

  const loadAppointments = async (oid: string) => {
    const { data } = await supabase.from('appointments')
      .select('*, patient:patient_id(first_name, last_name, phone, email), doctor:doctor_id(first_name, last_name, specialties)')
      .eq('organization_id', oid)
      .order('created_at', { ascending: false })
      .limit(300)
    setAppointments((data || []) as unknown as FullAppointment[])
  }

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setActionLoading(id)
    const updates: Record<string, unknown> = { status }
    if (status === 'cancelled_patient') updates.cancelled_at = new Date().toISOString()
    if (status === 'no_show_patient')   updates.no_show_recorded_at = new Date().toISOString()

    const { error } = await supabase.from('appointments').update(updates).eq('id', id)
    if (error) {
      toast.error('שגיאה בעדכון הסטטוס')
    } else {
      toast.success(`עודכן ל-${STATUS_LABELS[status]}`)
      loadAppointments(orgId)
    }
    setActionLoading(null)
  }

  // Filtering
  const applyFilter = (a: FullAppointment) => {
    if (filter === 'today')     return isToday(a)
    if (filter === 'pending')   return a.status === 'pending'
    if (filter === 'active')    return ACTIVE_STATUSES.includes(a.status)
    if (filter === 'completed') return a.status === 'completed'
    if (filter === 'cancelled') return CANCELLED_STATUSES.includes(a.status)
    return true
  }

  const applySearch = (a: FullAppointment) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return Boolean(
      a.patient?.first_name?.toLowerCase().includes(q) ||
      a.patient?.last_name?.toLowerCase().includes(q) ||
      a.patient?.phone?.includes(q) ||
      a.patient?.email?.toLowerCase().includes(q) ||
      a.doctor?.first_name?.toLowerCase().includes(q) ||
      a.doctor?.last_name?.toLowerCase().includes(q) ||
      a.chief_complaint?.toLowerCase().includes(q)
    )
  }

  const filtered = appointments.filter(a => applyFilter(a) && applySearch(a))

  const countFor = (k: FilterKey) => {
    if (k === 'all')       return appointments.length
    if (k === 'today')     return appointments.filter(isToday).length
    if (k === 'pending')   return appointments.filter(a => a.status === 'pending').length
    if (k === 'active')    return appointments.filter(a => ACTIVE_STATUSES.includes(a.status)).length
    if (k === 'completed') return appointments.filter(a => a.status === 'completed').length
    if (k === 'cancelled') return appointments.filter(a => CANCELLED_STATUSES.includes(a.status)).length
    return 0
  }

  if (loading) return <PageLoading />

  // Summary stats
  const todayTotal   = appointments.filter(isToday).length
  const pendingTotal = appointments.filter(a => a.status === 'pending').length
  const activeTotal  = appointments.filter(a => ACTIVE_STATUSES.includes(a.status)).length
  const revenue      = appointments.filter(a => a.status === 'completed' && a.payment_amount).reduce((s, a) => s + (a.payment_amount || 0), 0)

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ניהול תורים</h1>
        <p className="text-sm text-slate-500 mt-0.5">צפייה, סינון וניהול כל התורים במרפאה</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'תורים היום',       value: todayTotal,   color: 'blue'   },
          { label: 'ממתינים לאישור',   value: pendingTotal, color: 'orange' },
          { label: 'תורים פעילים',     value: activeTotal,  color: 'green'  },
          { label: 'הכנסות (הושלמו)',  value: formatPrice(revenue), color: 'emerald' },
        ].map(s => (
          <div key={s.label} className={cn(
            'rounded-2xl p-4 border',
            s.color === 'blue'    && 'bg-blue-50 border-blue-100',
            s.color === 'orange'  && 'bg-orange-50 border-orange-100',
            s.color === 'green'   && 'bg-green-50 border-green-100',
            s.color === 'emerald' && 'bg-emerald-50 border-emerald-100',
          )}>
            <p className={cn('text-xs font-medium mb-1',
              s.color === 'blue'    && 'text-blue-600',
              s.color === 'orange'  && 'text-orange-600',
              s.color === 'green'   && 'text-green-600',
              s.color === 'emerald' && 'text-emerald-600',
            )}>{s.label}</p>
            <p className={cn('text-2xl font-bold',
              s.color === 'blue'    && 'text-blue-800',
              s.color === 'orange'  && 'text-orange-800',
              s.color === 'green'   && 'text-green-800',
              s.color === 'emerald' && 'text-emerald-800',
            )}>{s.value}</p>
          </div>
        ))}
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
          placeholder="חיפוש לפי שם מטופל, רופא, טלפון, אימייל או תלונה..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 left-3 flex items-center text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2 flex-wrap" role="tablist">
        {FILTERS.map(f => {
          const count  = countFor(f.key)
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
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

      {/* ── Table ── */}
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
            description={search ? `לא נמצאו תורים עבור "${search}"` : 'אין תורים בסינון הנוכחי'}
            action={search ? <Button variant="outline" onClick={() => setSearch('')}>נקה חיפוש</Button> : undefined}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {filtered.length} תורים
                {search && <span className="text-slate-400 font-normal mr-1.5 text-sm">· &quot;{search}&quot;</span>}
              </h3>
            </div>
          </CardHeader>
          <div className="divide-y">
            {filtered.map(apt => {
              const isExpanded = expanded === apt.id
              const actions = ADMIN_ACTIONS[apt.status] || []

              return (
                <div key={apt.id} className="hover:bg-slate-50/60 transition-colors">

                  {/* Row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : apt.id)}
                    className="w-full px-5 py-4 text-right"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-1 h-10 rounded-full shrink-0', statusBar(apt.status))} />

                      {/* Patient avatar */}
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0',
                        'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-500 border border-slate-100'
                      )}>
                        {apt.patient ? getInitials(apt.patient.first_name, apt.patient.last_name) : '?'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-slate-900">
                            {apt.patient?.first_name} {apt.patient?.last_name}
                          </p>
                          {apt.status === 'in_progress' && (
                            <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />בשיחה
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span className="truncate">{apt.chief_complaint}</span>
                          <span className="text-slate-300">·</span>
                          {apt.doctor
                            ? <span className="font-medium text-slate-600 shrink-0">ד&quot;ר {apt.doctor.first_name} {apt.doctor.last_name}</span>
                            : <span className="text-amber-500 font-medium shrink-0">ללא רופא</span>
                          }
                          <span className="text-slate-300">·</span>
                          <span className="shrink-0">{formatDate(apt.scheduled_at || apt.created_at)}</span>
                          {apt.patient?.phone && (
                            <><span className="text-slate-300">·</span><span className="shrink-0 font-medium">{apt.patient.phone}</span></>
                          )}
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-2 shrink-0">
                        {apt.ai_triage_score != null && (
                          <span className={cn(
                            'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold',
                            apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                            apt.ai_triage_score >= 4 ? 'bg-amber-100 text-amber-700' :
                                                       'bg-emerald-100 text-emerald-700'
                          )}>
                            {apt.ai_triage_score}
                          </span>
                        )}
                        <Badge variant={statusBadge(apt.status)}>{STATUS_LABELS[apt.status] || apt.status}</Badge>
                        <svg className={cn('w-4 h-4 text-slate-400 transition-transform duration-200', isExpanded && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-3">
                      <div className="h-px bg-slate-100 mb-3" />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {/* Patient */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">מטופל</p>
                          <p className="font-semibold text-slate-900">{apt.patient?.first_name} {apt.patient?.last_name}</p>
                          {apt.patient?.phone && (
                            <p className="text-slate-500 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 7.18a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8a16 16 0 006.09 6.09l1.27-.63a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                              {apt.patient.phone}
                            </p>
                          )}
                          {apt.patient?.email && <p className="text-slate-500 text-xs truncate">{apt.patient.email}</p>}
                        </div>

                        {/* Appointment */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">פרטי תור</p>
                          <div className="space-y-1 text-slate-700">
                            <p><span className="text-slate-400 text-xs">תלונה:</span> <span className="font-medium">{apt.chief_complaint}</span></p>
                            {apt.requested_specialty && <p><span className="text-slate-400 text-xs">התמחות:</span> {apt.requested_specialty}</p>}
                            {apt.scheduled_at && <p><span className="text-slate-400 text-xs">מועד:</span> <span className="font-medium">{formatDateTime(apt.scheduled_at)}</span></p>}
                            {apt.payment_amount && (
                              <p><span className="text-slate-400 text-xs">תשלום:</span>
                                <span className={cn('font-medium mr-1', apt.payment_status === 'completed' ? 'text-green-700' : 'text-orange-600')}>
                                  {formatPrice(apt.payment_amount)} — {apt.payment_status === 'completed' ? 'שולם' : 'ממתין'}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Complaint */}
                      {apt.complaint_description && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">תיאור התלונה</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{apt.complaint_description}</p>
                        </div>
                      )}

                      {/* AI Triage */}
                      {apt.ai_triage_reasoning && (
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                          <div className="flex items-center gap-2 mb-1.5">
                            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" /></svg>
                            <p className="text-xs font-semibold text-indigo-600">מיון AI</p>
                            {apt.ai_triage_score != null && (
                              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                                apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                                apt.ai_triage_score >= 4 ? 'bg-amber-100 text-amber-700' :
                                                           'bg-emerald-100 text-emerald-700'
                              )}>
                                {apt.ai_triage_score}/10
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-indigo-700">{apt.ai_triage_reasoning}</p>
                        </div>
                      )}

                      {/* Medical summary */}
                      {apt.status === 'completed' && (apt.diagnosis || apt.follow_up_instructions) && (
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">סיכום רפואי</p>
                          {apt.diagnosis && <p className="text-sm"><span className="font-semibold text-emerald-700">אבחנה:</span> <span className="text-emerald-600">{apt.diagnosis}</span></p>}
                          {apt.follow_up_instructions && <p className="text-sm mt-1"><span className="font-semibold text-emerald-700">מעקב:</span> <span className="text-emerald-600">{apt.follow_up_instructions}</span></p>}
                        </div>
                      )}

                      {/* Actions */}
                      {actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {actions.map(action => (
                            <Button
                              key={action.next}
                              size="sm"
                              variant={action.variant === 'danger' ? 'danger' : action.variant === 'outline' ? 'outline' : 'primary'}
                              loading={actionLoading === apt.id}
                              onClick={() => updateStatus(apt.id, action.next)}
                            >
                              {action.label}
                            </Button>
                          ))}
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
