'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Input, Badge, PageLoading, EmptyState, StatCard } from '@/components/ui'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime, formatTime, cn } from '@/lib/utils'
import type { Appointment, User, AppointmentStatus } from '@/types/database'

// ── Types ──────────────────────────────────────────────

type StaffAppointment = Appointment & {
  patient: Pick<User, 'first_name' | 'last_name' | 'phone' | 'email'> | null
  doctor: Pick<User, 'first_name' | 'last_name'> | null
}

// ── Status actions for staff ───────────────────────────

const STAFF_ACTIONS: Record<string, { label: string; next: AppointmentStatus; variant: 'primary' | 'outline' | 'danger' }[]> = {
  pending: [
    { label: 'בטל', next: 'cancelled_patient', variant: 'danger' },
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
    { label: 'מוכן', next: 'ready', variant: 'primary' },
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

// ── Component ──────────────────────────────────────────

export default function StaffDashboard() {
  const supabase = getClient()

  const [appointments, setAppointments] = useState<StaffAppointment[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('today')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
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
    setLoading(false)
  }

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setActionLoading(id)
    const updates: Record<string, unknown> = { status }

    if (status === 'cancelled_patient') {
      updates.cancelled_at = new Date().toISOString()
    }
    if (status === 'no_show_patient') {
      updates.no_show_recorded_at = new Date().toISOString()
    }

    await supabase.from('appointments').update(updates).eq('id', id)
    setActionLoading(null)
    loadData()
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

  // ── Badge variant helper ─────────────────────────────

  const getBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (status === 'completed') return 'success'
    if (status === 'pending') return 'warning'
    if (status.startsWith('cancelled') || status.startsWith('no_show')) return 'danger'
    return 'info'
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">פאנל שירות</h2>
        <p className="text-sm text-gray-500">ניהול תורים, מטופלים ותפעול יומיומי</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="תורים היום" value={todayApts.length} icon="📅" color="blue" />
        <StatCard label="ממתינים לאישור" value={pendingCount} icon="⏳" color="orange" />
        <StatCard label="תורים פעילים" value={activeCount} icon="🩺" color="green" />
        <StatCard label="הושלמו היום" value={todayCompleted} icon="✅" color="purple" />
      </div>

      {/* Search */}
      <Input
        placeholder="חיפוש לפי שם מטופל, רופא, טלפון או תלונה..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
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
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {tab.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Appointments list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">תורים ({filtered.length})</h3>
            <Button variant="ghost" size="sm" onClick={loadData}>רענן</Button>
          </div>
        </CardHeader>
        {filtered.length === 0 ? (
          <EmptyState icon="📋" title="אין תורים" description="לא נמצאו תורים לפי הסינון הנוכחי" />
        ) : (
          <div className="divide-y">
            {filtered.map(apt => {
              const isExpanded = expanded === apt.id
              const actions = STAFF_ACTIONS[apt.status] || []

              return (
                <div key={apt.id} className="hover:bg-gray-50 transition-colors">
                  {/* Main row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : apt.id)}
                    className="w-full px-6 py-4 text-right"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {apt.patient?.first_name} {apt.patient?.last_name}
                          </p>
                          {apt.scheduled_at && isToday(apt) && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                              {formatTime(apt.scheduled_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{apt.chief_complaint}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          {apt.doctor && (
                            <span>ד&quot;ר {apt.doctor.first_name} {apt.doctor.last_name}</span>
                          )}
                          {!apt.doctor && <span className="text-orange-500">ללא רופא</span>}
                          <span>·</span>
                          <span>{formatDateTime(apt.scheduled_at || apt.created_at)}</span>
                          {apt.patient?.phone && (
                            <>
                              <span>·</span>
                              <span>{apt.patient.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {apt.ai_triage_score != null && (
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded font-medium',
                            apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                            apt.ai_triage_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          )}>
                            {apt.ai_triage_score}
                          </span>
                        )}
                        <Badge variant={getBadgeVariant(apt.status)}>
                          {STATUS_LABELS[apt.status] || apt.status}
                        </Badge>
                        <span className={cn(
                          'text-gray-400 transition-transform text-sm',
                          isExpanded && 'rotate-180'
                        )}>
                          ▼
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-6 pb-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {/* Patient info */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          <p className="text-xs text-gray-400 font-medium">פרטי מטופל</p>
                          <p className="font-medium">{apt.patient?.first_name} {apt.patient?.last_name}</p>
                          {apt.patient?.phone && <p className="text-gray-500">📱 {apt.patient.phone}</p>}
                          {apt.patient?.email && <p className="text-gray-500 truncate">📧 {apt.patient.email}</p>}
                        </div>

                        {/* Appointment info */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          <p className="text-xs text-gray-400 font-medium">פרטי תור</p>
                          <p><span className="text-gray-500">תלונה:</span> {apt.chief_complaint}</p>
                          {apt.requested_specialty && (
                            <p><span className="text-gray-500">התמחות:</span> {apt.requested_specialty}</p>
                          )}
                          {apt.scheduled_at && (
                            <p><span className="text-gray-500">מועד:</span> {formatDateTime(apt.scheduled_at)}</p>
                          )}
                          {apt.doctor && (
                            <p><span className="text-gray-500">רופא:</span> ד&quot;ר {apt.doctor.first_name} {apt.doctor.last_name}</p>
                          )}
                        </div>
                      </div>

                      {/* Complaint description */}
                      {apt.complaint_description && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">תיאור התלונה</p>
                          <p className="text-sm text-gray-700">{apt.complaint_description}</p>
                        </div>
                      )}

                      {/* AI triage */}
                      {apt.ai_triage_reasoning && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs text-purple-600 font-medium mb-1">מיון AI (ציון: {apt.ai_triage_score})</p>
                          <p className="text-sm text-purple-700">{apt.ai_triage_reasoning}</p>
                        </div>
                      )}

                      {/* Payment info */}
                      {apt.payment_amount != null && apt.payment_amount > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">תשלום:</span>
                          <Badge variant={apt.payment_status === 'completed' ? 'success' : 'warning'}>
                            {apt.payment_status === 'completed' ? 'שולם' : 'ממתין'} — {apt.payment_amount} ₪
                          </Badge>
                        </div>
                      )}

                      {/* Actions */}
                      {actions.length > 0 && (
                        <div className="flex gap-2 pt-2 border-t border-gray-100">
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

                      {/* Diagnosis for completed */}
                      {apt.status === 'completed' && (apt.diagnosis || apt.follow_up_instructions) && (
                        <div className="bg-green-50 rounded-lg p-3 space-y-1 text-sm">
                          {apt.diagnosis && <p><span className="font-medium text-green-700">אבחנה:</span> <span className="text-green-600">{apt.diagnosis}</span></p>}
                          {apt.follow_up_instructions && <p><span className="font-medium text-green-700">מעקב:</span> <span className="text-green-600">{apt.follow_up_instructions}</span></p>}
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
