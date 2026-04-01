'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Input, Badge, PageLoading, EmptyState, Select } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatTime, cn, getInitials, SPECIALTIES } from '@/lib/utils'
import type { Appointment, User, AppointmentStatus } from '@/types/database'

// ── Types ──────────────────────────────────────────────

type StaffAppointment = Appointment & {
  patient: Pick<User, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'date_of_birth' | 'gender' | 'medical_history' | 'insurance_info' | 'avatar_url'> | null
  doctor: Pick<User, 'id' | 'first_name' | 'last_name' | 'specialties'> | null
}

type DoctorOption = {
  id: string
  first_name: string
  last_name: string
  specialties: string[] | null
}

// ── Status flow for staff ──────────────────────────────

const STAFF_ACTIONS: Record<string, { label: string; next: AppointmentStatus; variant: 'primary' | 'outline' | 'danger' }[]> = {
  pending: [
    { label: 'בטל תור', next: 'cancelled_patient', variant: 'danger' },
  ],
  doctor_confirmed: [
    { label: 'סמן כשולם', next: 'paid', variant: 'primary' },
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
    { label: 'מוכן לשיחה', next: 'ready', variant: 'primary' },
    { label: 'לא הגיע', next: 'no_show_patient', variant: 'danger' },
  ],
  ready: [
    { label: 'לא הגיע', next: 'no_show_patient', variant: 'danger' },
  ],
}

const FILTER_STATUSES = ['all', 'pending', 'doctor_confirmed', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled'] as const
type FilterStatus = typeof FILTER_STATUSES[number]

// ── Component ──────────────────────────────────────────

export default function StaffAppointmentsPage() {
  const searchParams = useSearchParams()
  const initialId = searchParams.get('id')
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<StaffAppointment[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [selected, setSelected] = useState<StaffAppointment | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')

  // Detail panel state
  const [actionLoading, setActionLoading] = useState(false)
  const [assignDoctor, setAssignDoctor] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [staffNote, setStaffNote] = useState('')
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

      const oid = (profile as unknown as { organization_id: string }).organization_id
      setOrgId(oid)

      const [aptsRes, docsRes] = await Promise.all([
        supabase.from('appointments')
          .select('*, patient:patient_id(id, first_name, last_name, phone, email, date_of_birth, gender, medical_history, insurance_info, avatar_url), doctor:doctor_id(id, first_name, last_name, specialties)')
          .eq('organization_id', oid)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('users')
          .select('id, first_name, last_name, specialties')
          .eq('organization_id', oid)
          .eq('role', 'doctor')
          .eq('is_active', true)
          .order('first_name'),
      ])

      const apts = (aptsRes.data || []) as unknown as StaffAppointment[]
      setAppointments(apts)
      setDoctors((docsRes.data || []) as unknown as DoctorOption[])

      // Auto-select from URL
      if (initialId && !selected) {
        const found = apts.find(a => a.id === initialId)
        if (found) selectAppointment(found)
      }
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  const selectAppointment = (apt: StaffAppointment) => {
    setSelected(apt)
    setAssignDoctor(apt.doctor_id || '')
    setMessage(null)
    setStaffNote('')

    if (apt.scheduled_at) {
      const d = new Date(apt.scheduled_at)
      setScheduleDate(d.toISOString().split('T')[0])
      setScheduleTime(d.toTimeString().slice(0, 5))
    } else {
      setScheduleDate('')
      setScheduleTime('')
    }
  }

  // ── Actions ──────────────────────────────────────────

  const updateStatus = async (status: AppointmentStatus) => {
    if (!selected) return
    setActionLoading(true)
    try {
      const updates: Record<string, unknown> = { status }

      if (status === 'cancelled_patient') updates.cancelled_at = new Date().toISOString()
      if (status === 'no_show_patient') updates.no_show_recorded_at = new Date().toISOString()

      const { error } = await supabase.from('appointments').update(updates).eq('id', selected.id)

      if (error) {
        setMessage({ type: 'error', text: 'שגיאה בעדכון הסטטוס' })
      } else {
        setMessage({ type: 'success', text: `סטטוס עודכן ל-${STATUS_LABELS[status]}` })
        loadData()
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאת רשת בעדכון הסטטוס' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssignDoctor = async () => {
    if (!selected || !assignDoctor) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('appointments')
        .update({ doctor_id: assignDoctor, status: selected.status === 'pending' ? 'doctor_confirmed' : selected.status })
        .eq('id', selected.id)

      if (error) {
        setMessage({ type: 'error', text: 'שגיאה בשיוך הרופא' })
      } else {
        setMessage({ type: 'success', text: 'רופא שויך בהצלחה' })
        loadData()
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאת רשת בשיוך הרופא' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (!selected || !scheduleDate || !scheduleTime) return
    setActionLoading(true)
    try {
      const scheduled_at = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
      const newStatus: AppointmentStatus = ['pending', 'doctor_confirmed', 'time_selected', 'paid'].includes(selected.status) ? 'scheduled' : selected.status

      const { error } = await supabase.from('appointments')
        .update({ scheduled_at, status: newStatus })
        .eq('id', selected.id)

      if (error) {
        setMessage({ type: 'error', text: 'שגיאה בתזמון התור' })
      } else {
        setMessage({ type: 'success', text: 'התור תוזמן בהצלחה' })
        loadData()
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאת רשת בתזמון התור' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!selected || !staffNote.trim()) return
    setActionLoading(true)
    try {
      const existing = (selected.doctor_notes || '')
      const timestamp = new Date().toLocaleString('he-IL')
      const updated = existing
        ? `${existing}\n\n[${timestamp} — צוות שירות]\n${staffNote.trim()}`
        : `[${timestamp} — צוות שירות]\n${staffNote.trim()}`

      const { error } = await supabase.from('appointments')
        .update({ doctor_notes: updated })
        .eq('id', selected.id)

      if (error) {
        setMessage({ type: 'error', text: 'שגיאה בשמירת ההערה' })
      } else {
        setStaffNote('')
        setMessage({ type: 'success', text: 'הערה נוספה' })
        loadData()
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאת רשת בשמירת ההערה' })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Filtering ────────────────────────────────────────

  const applyFilter = (apt: StaffAppointment): boolean => {
    if (statusFilter === 'cancelled') {
      return apt.status.startsWith('cancelled') || apt.status.startsWith('no_show')
    }
    return statusFilter === 'all' || apt.status === statusFilter
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

  // ── Helpers ──────────────────────────────────────────

  const getBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (status === 'completed') return 'success'
    if (status === 'pending') return 'warning'
    if (status.startsWith('cancelled') || status.startsWith('no_show')) return 'danger'
    return 'info'
  }

  const getFilterLabel = (f: FilterStatus) => {
    if (f === 'all') return 'הכל'
    if (f === 'cancelled') return 'בוטלו'
    return STATUS_LABELS[f] || f
  }

  const getFilterCount = (f: FilterStatus) => {
    if (f === 'all') return appointments.length
    if (f === 'cancelled') return appointments.filter(a => a.status.startsWith('cancelled') || a.status.startsWith('no_show')).length
    return appointments.filter(a => a.status === f).length
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">ניהול תורים</h2>
        <p className="text-sm text-gray-500">{appointments.length} תורים במערכת</p>
      </div>

      {/* Search */}
      <Input
        placeholder="חיפוש לפי שם מטופל, רופא, טלפון או תלונה..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_STATUSES.map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              statusFilter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {getFilterLabel(f)} ({getFilterCount(f)})
          </button>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* List */}
        <div className="lg:col-span-2">
          <Card className="max-h-[75vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>} title="אין תורים" description="לא נמצאו תורים לפי הסינון" />
            ) : (
              <div className="divide-y">
                {filtered.map(apt => {
                  const isSelected = selected?.id === apt.id
                  return (
                    <button
                      key={apt.id}
                      onClick={() => selectAppointment(apt)}
                      className={cn(
                        'w-full px-4 py-3 text-right hover:bg-gray-50 transition-colors',
                        isSelected && 'bg-blue-50 border-r-4 border-blue-600'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {apt.patient?.first_name} {apt.patient?.last_name}
                            </p>
                            {apt.scheduled_at && (
                              <span className="text-xs text-gray-400 shrink-0">
                                {formatTime(apt.scheduled_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{apt.chief_complaint}</p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                            {apt.doctor ? (
                              <span>ד&quot;ר {apt.doctor.first_name} {apt.doctor.last_name}</span>
                            ) : (
                              <span className="text-orange-500 font-medium">ללא רופא</span>
                            )}
                            <span>·</span>
                            <span>{new Date(apt.scheduled_at || apt.created_at).toLocaleDateString('he-IL')}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={getBadgeVariant(apt.status)}>
                            {STATUS_LABELS[apt.status] || apt.status}
                          </Badge>
                          {apt.ai_triage_score != null && (
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded',
                              apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                              apt.ai_triage_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            )}>
                              {apt.ai_triage_score}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          <Card className="max-h-[75vh] overflow-y-auto">
            {selected ? (
              <DetailPanel
                apt={selected}
                doctors={doctors}
                assignDoctor={assignDoctor}
                setAssignDoctor={setAssignDoctor}
                scheduleDate={scheduleDate}
                setScheduleDate={setScheduleDate}
                scheduleTime={scheduleTime}
                setScheduleTime={setScheduleTime}
                staffNote={staffNote}
                setStaffNote={setStaffNote}
                actionLoading={actionLoading}
                message={message}
                onUpdateStatus={updateStatus}
                onAssignDoctor={handleAssignDoctor}
                onSchedule={handleSchedule}
                onAddNote={handleAddNote}
              />
            ) : (
              <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>} title="בחר תור מהרשימה" description="לחץ על תור כדי לראות פרטים ולבצע פעולות" />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Detail Panel ───────────────────────────────────────

function DetailPanel({
  apt, doctors, assignDoctor, setAssignDoctor,
  scheduleDate, setScheduleDate, scheduleTime, setScheduleTime,
  staffNote, setStaffNote, actionLoading, message,
  onUpdateStatus, onAssignDoctor, onSchedule, onAddNote,
}: {
  apt: StaffAppointment
  doctors: DoctorOption[]
  assignDoctor: string
  setAssignDoctor: (v: string) => void
  scheduleDate: string
  setScheduleDate: (v: string) => void
  scheduleTime: string
  setScheduleTime: (v: string) => void
  staffNote: string
  setStaffNote: (v: string) => void
  actionLoading: boolean
  message: { type: 'success' | 'error'; text: string } | null
  onUpdateStatus: (status: AppointmentStatus) => void
  onAssignDoctor: () => void
  onSchedule: () => void
  onAddNote: () => void
}) {
  const patient = apt.patient
  const doctor = apt.doctor
  const medHistory = (patient as unknown as User)?.medical_history
  const actions = STAFF_ACTIONS[apt.status] || []

  return (
    <CardContent className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {patient?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={patient.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700">
              {patient ? getInitials(patient.first_name, patient.last_name) : '?'}
            </div>
          )}
          <div>
            <h3 className="font-bold text-lg">{patient?.first_name} {patient?.last_name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {patient?.phone && <span>טל׳: {patient.phone}</span>}
              {patient?.email && <span>{patient.email}</span>}
            </div>
          </div>
        </div>
        <Badge variant={apt.status === 'completed' ? 'success' : apt.status.startsWith('cancelled') ? 'danger' : apt.status === 'pending' ? 'warning' : 'info'}>
          {STATUS_LABELS[apt.status] || apt.status}
        </Badge>
      </div>

      {/* Patient details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {patient?.date_of_birth && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400">תאריך לידה</p>
            <p className="font-medium">{new Date(patient.date_of_birth).toLocaleDateString('he-IL')}</p>
          </div>
        )}
        {patient?.gender && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400">מגדר</p>
            <p className="font-medium">{patient.gender === 'male' ? 'זכר' : patient.gender === 'female' ? 'נקבה' : 'אחר'}</p>
          </div>
        )}
      </div>

      {/* Medical alerts */}
      {medHistory && (
        (medHistory.allergies?.length > 0 || medHistory.current_medications?.length > 0 || medHistory.chronic_conditions?.length > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-red-700">מידע רפואי חשוב</p>
            {medHistory.allergies?.length > 0 && (
              <p className="text-sm text-red-700">
                <span className="font-medium">אלרגיות:</span> {medHistory.allergies.join(', ')}
              </p>
            )}
            {medHistory.chronic_conditions?.length > 0 && (
              <p className="text-sm text-red-700">
                <span className="font-medium">מחלות רקע:</span> {medHistory.chronic_conditions.join(', ')}
              </p>
            )}
            {medHistory.current_medications?.length > 0 && (
              <p className="text-sm text-red-600">
                <span className="font-medium">תרופות:</span> {medHistory.current_medications.join(', ')}
              </p>
            )}
          </div>
        )
      )}

      {/* Complaint */}
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-400 font-medium mb-1">תלונה</p>
        <p className="text-sm font-medium text-gray-900">{apt.chief_complaint}</p>
        {apt.complaint_description && (
          <p className="text-sm text-gray-600 mt-1">{apt.complaint_description}</p>
        )}
        {apt.requested_specialty && (
          <p className="text-xs text-gray-500 mt-1">
            התמחות: {SPECIALTIES.find(s => s.id === apt.requested_specialty)?.label || apt.requested_specialty}
          </p>
        )}
      </div>

      {/* AI Triage */}
      {apt.ai_triage_reasoning && (
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs text-purple-600 font-medium">מיון AI</p>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded font-medium',
              (apt.ai_triage_score || 0) >= 7 ? 'bg-red-100 text-red-700' :
              (apt.ai_triage_score || 0) >= 4 ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            )}>
              ציון: {apt.ai_triage_score}
            </span>
          </div>
          <p className="text-sm text-purple-700">{apt.ai_triage_reasoning}</p>
        </div>
      )}

      {/* Doctor assignment */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">שיוך רופא</p>
        {doctor ? (
          <p className="text-sm text-gray-600">
            ד&quot;ר {doctor.first_name} {doctor.last_name}
            {doctor.specialties && doctor.specialties.length > 0 && (
              <span className="text-gray-400"> — {doctor.specialties.map(s => SPECIALTIES.find(sp => sp.id === s)?.label || s).join(', ')}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-orange-600 font-medium">לא שויך רופא</p>
        )}
        <div className="flex gap-2">
          <select
            value={assignDoctor}
            onChange={e => setAssignDoctor(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="">בחר רופא...</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                ד&quot;ר {d.first_name} {d.last_name}
                {d.specialties && d.specialties.length > 0 ? ` (${d.specialties.map(s => SPECIALTIES.find(sp => sp.id === s)?.label || s).join(', ')})` : ''}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={onAssignDoctor}
            loading={actionLoading}
            disabled={!assignDoctor}
          >
            שייך
          </Button>
        </div>
      </div>

      {/* Scheduling */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">תזמון תור</p>
        {apt.scheduled_at && (
          <p className="text-sm text-gray-600">
            מתוזמן ל: <span className="font-medium">{formatDateTime(apt.scheduled_at)}</span>
          </p>
        )}
        <div className="flex gap-2">
          <Input
            type="date"
            value={scheduleDate}
            onChange={e => setScheduleDate(e.target.value)}
            className="flex-1"
          />
          <Input
            type="time"
            value={scheduleTime}
            onChange={e => setScheduleTime(e.target.value)}
            className="w-32"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onSchedule}
            loading={actionLoading}
            disabled={!scheduleDate || !scheduleTime}
          >
            קבע
          </Button>
        </div>
      </div>

      {/* Payment info */}
      {apt.payment_amount != null && apt.payment_amount > 0 && (
        <div className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg p-3">
          <span className="text-gray-500">תשלום:</span>
          <Badge variant={apt.payment_status === 'completed' ? 'success' : 'warning'}>
            {apt.payment_status === 'completed' ? 'שולם' : 'ממתין'} — {apt.payment_amount} ₪
          </Badge>
          {apt.payment_completed_at && (
            <span className="text-xs text-gray-400">({new Date(apt.payment_completed_at).toLocaleDateString('he-IL')})</span>
          )}
        </div>
      )}

      {/* SOAP / Diagnosis (read-only for staff) */}
      {apt.status === 'completed' && (apt.diagnosis || apt.assessment || apt.follow_up_instructions) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5 text-sm">
          <p className="text-xs font-bold text-green-700">סיכום רפואי</p>
          {apt.diagnosis && <p><span className="font-medium text-green-700">אבחנה:</span> <span className="text-green-600">{apt.diagnosis}</span></p>}
          {apt.assessment && <p><span className="font-medium text-green-700">הערכה:</span> <span className="text-green-600">{apt.assessment}</span></p>}
          {apt.follow_up_instructions && <p><span className="font-medium text-green-700">מעקב:</span> <span className="text-green-600">{apt.follow_up_instructions}</span></p>}
        </div>
      )}

      {/* AI Summary */}
      {apt.ai_summary && (
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">סיכום AI</p>
          <p className="text-sm text-blue-600 whitespace-pre-wrap">{apt.ai_summary}</p>
        </div>
      )}

      {/* Internal notes */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">הערות פנימיות</p>
        {apt.doctor_notes && (
          <div className="bg-yellow-50 rounded-lg p-2.5 text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {apt.doctor_notes}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={staffNote}
            onChange={e => setStaffNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && staffNote.trim()) { e.preventDefault(); onAddNote() } }}
            placeholder="הוסף הערה פנימית..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onAddNote}
            loading={actionLoading}
            disabled={!staffNote.trim()}
          >
            הוסף
          </Button>
        </div>
      </div>

      {/* Status actions */}
      {actions.length > 0 && (
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          {actions.map(action => (
            <Button
              key={action.next}
              size="sm"
              variant={action.variant === 'danger' ? 'danger' : action.variant === 'outline' ? 'outline' : 'primary'}
              loading={actionLoading}
              onClick={() => onUpdateStatus(action.next)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={cn(
          'p-3 rounded-lg text-sm',
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        )} role="alert">
          {message.text}
        </div>
      )}
    </CardContent>
  )
}
