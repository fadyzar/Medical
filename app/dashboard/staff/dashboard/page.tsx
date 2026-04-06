'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Input, Badge, PageLoading, EmptyState, StatCard } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatTime, cn, getInitials } from '@/lib/utils'
import type { Appointment, User, AppointmentStatus } from '@/types/database'

// ── Types ──────────────────────────────────────────────

type StaffAppointment = Appointment & {
  patient: Pick<User, 'first_name' | 'last_name' | 'phone' | 'email'> | null
  doctor: Pick<User, 'first_name' | 'last_name'> | null
}

// ── Status actions for staff ───────────────────────────

const STAFF_ACTIONS: Record<string, { label: string; next: AppointmentStatus; variant: 'primary' | 'outline' | 'danger' }[]> = {
  pending: [
    { label: 'בטל תור', next: 'cancelled_patient', variant: 'danger' },
  ],
  doctor_confirmed: [
    { label: 'קבע זמן', next: 'time_selected', variant: 'primary' },
    { label: 'בטל', next: 'cancelled_patient', variant: 'danger' },
  ],
  time_selected: [
    { label: 'סמן כשולם', next: 'paid', variant: 'primary' },
    { label: 'בטל', next: 'cancelled_patient', variant: 'danger' },
  ],
  paid: [
    { label: 'תזמן', next: 'scheduled', variant: 'primary' },
  ],
  scheduled: [
    { label: 'מוכן לכניסה', next: 'ready', variant: 'primary' },
    { label: 'לא הגיע', next: 'no_show_patient', variant: 'danger' },
  ],
  ready: [
    { label: 'לא הגיע', next: 'no_show_patient', variant: 'danger' },
  ],
}

// ── Filter tabs ────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all', label: 'הכל' },
  { key: 'today', label: 'היום' },
  { key: 'pending', label: 'ממתינים' },
  { key: 'active', label: 'פעילים' },
  { key: 'completed', label: 'הושלמו' },
  { key: 'cancelled', label: 'בוטלו' },
] as const

type FilterKey = typeof FILTER_TABS[number]['key']

// ── Triage badge helper ────────────────────────────────

const TriageBadge = ({ score }: { score: number }) => (
  <span className={cn(
    'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold tabular-nums shrink-0',
    score >= 7 ? 'bg-red-100 text-red-700' :
    score >= 4 ? 'bg-amber-100 text-amber-700' :
    'bg-emerald-100 text-emerald-700'
  )}>
    {score}
  </span>
)

// ── Status color bar helper ────────────────────────────

const statusBar = (status: string) => cn(
  'w-1 h-9 rounded-full shrink-0',
  status === 'completed' ? 'bg-emerald-400' :
  status === 'in_progress' ? 'bg-blue-500' :
  status === 'pending' ? 'bg-amber-400' :
  status.startsWith('cancelled') || status.startsWith('no_show') ? 'bg-red-400' :
  'bg-indigo-400'
)

// ── Component ──────────────────────────────────────────

export default function StaffDashboard() {
  const supabase = getClient()

  const [appointments, setAppointments] = useState<StaffAppointment[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('today')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const orgId = (profile as unknown as { organization_id: string }).organization_id

      const { data } = await supabase.from('appointments')
        .select('*, patient:patient_id(first_name, last_name, phone, email), doctor:doctor_id(first_name, last_name)')
        .eq('organization_id', orgId)
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200)

      setAppointments((data || []) as unknown as StaffAppointment[])
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setActionLoading(id)
    setMessage(null)
    try {
      const updates: Record<string, unknown> = { status }

      if (status === 'cancelled_patient') {
        updates.cancelled_at = new Date().toISOString()
      }
      if (status === 'no_show_patient') {
        updates.no_show_recorded_at = new Date().toISOString()
      }

      const { error } = await supabase.from('appointments').update(updates).eq('id', id)
      if (error) {
        setMessage({ type: 'error', text: 'שגיאה בעדכון הסטטוס' })
      } else {
        setMessage({ type: 'success', text: `הסטטוס עודכן ל-${STATUS_LABELS[status]}` })
        setTimeout(() => setMessage(null), 3000)
      }
      loadData()
    } catch {
      setMessage({ type: 'error', text: 'שגיאת רשת בעדכון הסטטוס' })
    } finally {
      setActionLoading(null)
    }
  }

  // ── Filtering ────────────────────────────────────────

  const today = new Date().toDateString()

  const isToday = (apt: StaffAppointment) => {
    const date = apt.scheduled_at || apt.created_at
    return new Date(date).toDateString() === today
  }

  const isActive = (apt: StaffAppointment) =>
    ['doctor_confirmed', 'time_selected', 'paid', 'scheduled', 'ready', 'in_progress'].includes(apt.status)

  const isCancelled = (apt: StaffAppointment) =>
    apt.status.startsWith('cancelled') || apt.status.startsWith('no_show')

  const applyFilter = (apt: StaffAppointment): boolean => {
    switch (filter) {
      case 'today': return isToday(apt)
      case 'pending': return apt.status === 'pending'
      case 'active': return isActive(apt)
      case 'completed': return apt.status === 'completed'
      case 'cancelled': return isCancelled(apt)
      default: return true
    }
  }

  const applySearch = (apt: StaffAppointment): boolean => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const p = apt.patient
    const d = apt.doctor
    return Boolean(
      p?.first_name?.toLowerCase().includes(q) ||
      p?.last_name?.toLowerCase().includes(q) ||
      p?.phone?.includes(q) ||
      p?.email?.toLowerCase().includes(q) ||
      d?.first_name?.toLowerCase().includes(q) ||
      d?.last_name?.toLowerCase().includes(q) ||
      apt.chief_complaint?.toLowerCase().includes(q)
    )
  }

  const filtered = appointments.filter(a => applyFilter(a) && applySearch(a))

  // ── Stats ────────────────────────────────────────────

  const todayApts = appointments.filter(isToday)
  const pendingCount = appointments.filter(a => a.status === 'pending').length
  const activeCount = appointments.filter(isActive).length
  const todayCompleted = todayApts.filter(a => a.status === 'completed').length

  const getBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (status === 'completed') return 'success'
    if (status === 'pending') return 'warning'
    if (status.startsWith('cancelled') || status.startsWith('no_show')) return 'danger'
    return 'info'
  }

  const greetingHour = new Date().getHours()
  const greeting =
    greetingHour < 12 ? 'בוקר טוב' :
    greetingHour < 17 ? 'צהריים טובים' :
    'ערב טוב'

  const todayStr = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{greeting} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayStr} · פאנל שירות ותפעול</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
            רענן
          </Button>
        </div>
      </div>

      {/* ── Status message ───────────────────────────── */}
      {message && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border',
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-700'
        )} role="status">
          <div className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold',
            message.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'
          )}>
            {message.type === 'success' ? '✓' : '✕'}
          </div>
          {message.text}
        </div>
      )}

      {/* ── KPI Stats ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="תורים היום"
          value={todayApts.length}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
          color="blue"
        />
        <StatCard
          label="ממתינים לאישור"
          value={pendingCount}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
          color="orange"
        />
        <StatCard
          label="תורים פעילים"
          value={activeCount}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
          color="green"
        />
        <StatCard
          label="הושלמו היום"
          value={todayCompleted}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
          color="purple"
        />
      </div>

      {/* ── Search ──────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </div>
        <input
          type="search"
          placeholder="חיפוש לפי שם מטופל, רופא, טלפון, אימייל או תלונה..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={cn(
            'w-full rounded-xl border border-gray-200 bg-white py-3 pr-10 pl-4 text-sm transition-all',
            'placeholder:text-gray-400 shadow-sm',
            'focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none'
          )}
          aria-label="חיפוש תורים"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute inset-y-0 left-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label="נקה חיפוש"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* ── Filter tabs ─────────────────────────────── */}
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="סינון תורים">
        {FILTER_TABS.map(tab => {
          let count = 0
          switch (tab.key) {
            case 'all': count = appointments.length; break
            case 'today': count = todayApts.length; break
            case 'pending': count = pendingCount; break
            case 'active': count = activeCount; break
            case 'completed': count = appointments.filter(a => a.status === 'completed').length; break
            case 'cancelled': count = appointments.filter(isCancelled).length; break
          }
          const isActive = filter === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
              )}
            >
              {tab.label}
              <span className={cn(
                'text-xs tabular-nums px-1.5 py-0.5 rounded-full font-semibold',
                isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Appointments list ────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
              </div>
              <h3 className="font-bold text-gray-900">
                רשימת תורים
                {filtered.length > 0 && (
                  <span className="text-gray-400 font-normal mr-1.5 text-sm">({filtered.length})</span>
                )}
              </h3>
            </div>
            {search && (
              <p className="text-xs text-gray-400">
                מוצגים {filtered.length} תוצאות עבור &quot;{search}&quot;
              </p>
            )}
          </div>
        </CardHeader>

        {filtered.length === 0 ? (
          <EmptyState
            icon={
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" />
                </svg>
              </div>
            }
            title={search ? 'לא נמצאו תורים' : 'אין תורים להצגה'}
            description={search ? `לא נמצאו תורים עבור "${search}"` : 'לא נמצאו תורים לפי הסינון הנוכחי'}
            action={search ? (
              <Button size="sm" variant="outline" onClick={() => setSearch('')}>נקה חיפוש</Button>
            ) : undefined}
          />
        ) : (
          <div className="divide-y">
            {filtered.map(apt => {
              const isExpanded = expanded === apt.id
              const actions = STAFF_ACTIONS[apt.status] || []

              return (
                <div key={apt.id} className="hover:bg-gray-50/60 transition-colors">
                  {/* Main row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : apt.id)}
                    className="w-full px-5 py-4 text-right"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status color bar */}
                      <div className={statusBar(apt.status)} />

                      {/* Avatar initials */}
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 border border-gray-100">
                        {apt.patient ? getInitials(apt.patient.first_name, apt.patient.last_name) : '?'}
                      </div>

                      {/* Patient + details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">
                            {apt.patient?.first_name} {apt.patient?.last_name}
                          </p>
                          {apt.scheduled_at && isToday(apt) && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold shrink-0">
                              {formatTime(apt.scheduled_at)}
                            </span>
                          )}
                          {apt.status === 'in_progress' && (
                            <span className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                              בשיחה
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{apt.chief_complaint}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 flex-wrap">
                          {apt.doctor ? (
                            <span className="font-medium text-gray-500">ד&quot;ר {apt.doctor.first_name} {apt.doctor.last_name}</span>
                          ) : (
                            <span className="text-amber-500 font-medium">ללא שיבוץ רופא</span>
                          )}
                          <span className="text-gray-200">·</span>
                          <span>{formatDateTime(apt.scheduled_at || apt.created_at)}</span>
                          {apt.patient?.phone && (
                            <>
                              <span className="text-gray-200">·</span>
                              <span className="font-medium text-gray-500">{apt.patient.phone}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right side: triage + badge + chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        {apt.ai_triage_score != null && (
                          <TriageBadge score={apt.ai_triage_score} />
                        )}
                        <Badge variant={getBadgeVariant(apt.status)}>
                          {STATUS_LABELS[apt.status] || apt.status}
                        </Badge>
                        <svg
                          className={cn(
                            'w-4 h-4 text-gray-400 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-3">
                      <div className="h-px bg-gray-100 mb-4" />

                      {/* Info grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {/* Patient info */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 border border-gray-100">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">פרטי מטופל</p>
                          <p className="font-semibold text-gray-900">{apt.patient?.first_name} {apt.patient?.last_name}</p>
                          {apt.patient?.phone && (
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 7.18a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8a16 16 0 006.09 6.09l1.27-.63a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0121.5 16c.082.482.082.968 0 1.45l.5-.53z" /></svg>
                              <span>{apt.patient.phone}</span>
                            </div>
                          )}
                          {apt.patient?.email && (
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                              <span className="truncate text-xs">{apt.patient.email}</span>
                            </div>
                          )}
                        </div>

                        {/* Appointment info */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 border border-gray-100">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">פרטי תור</p>
                          <div className="space-y-1.5 text-gray-600">
                            <p><span className="text-gray-400 text-xs">תלונה:</span> <span className="font-medium text-gray-800">{apt.chief_complaint}</span></p>
                            {apt.requested_specialty && (
                              <p><span className="text-gray-400 text-xs">התמחות:</span> <span>{apt.requested_specialty}</span></p>
                            )}
                            {apt.scheduled_at && (
                              <p><span className="text-gray-400 text-xs">מועד:</span> <span className="font-medium">{formatDateTime(apt.scheduled_at)}</span></p>
                            )}
                            {apt.doctor && (
                              <p><span className="text-gray-400 text-xs">רופא:</span> <span className="font-medium">ד&quot;ר {apt.doctor.first_name} {apt.doctor.last_name}</span></p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Complaint description */}
                      {apt.complaint_description && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">תיאור התלונה</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{apt.complaint_description}</p>
                        </div>
                      )}

                      {/* AI triage */}
                      {apt.ai_triage_reasoning && (
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></svg>
                            <p className="text-xs text-indigo-600 font-semibold">מיון AI</p>
                            {apt.ai_triage_score != null && (
                              <TriageBadge score={apt.ai_triage_score} />
                            )}
                          </div>
                          <p className="text-sm text-indigo-700 leading-relaxed">{apt.ai_triage_reasoning}</p>
                        </div>
                      )}

                      {/* Payment info */}
                      {apt.payment_amount != null && apt.payment_amount > 0 && (
                        <div className="flex items-center gap-2.5">
                          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                          <span className="text-sm text-gray-600">תשלום:</span>
                          <Badge variant={apt.payment_status === 'completed' ? 'success' : 'warning'}>
                            {apt.payment_status === 'completed' ? 'שולם' : 'ממתין לתשלום'} — {apt.payment_amount} ₪
                          </Badge>
                        </div>
                      )}

                      {/* Diagnosis (completed) */}
                      {apt.status === 'completed' && (apt.diagnosis || apt.follow_up_instructions) && (
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-1.5">
                          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-2">סיכום ייעוץ</p>
                          {apt.diagnosis && (
                            <p className="text-sm"><span className="font-semibold text-emerald-700">אבחנה:</span> <span className="text-emerald-600">{apt.diagnosis}</span></p>
                          )}
                          {apt.follow_up_instructions && (
                            <p className="text-sm"><span className="font-semibold text-emerald-700">מעקב:</span> <span className="text-emerald-600">{apt.follow_up_instructions}</span></p>
                          )}
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
        )}
      </Card>
    </div>
  )
}
