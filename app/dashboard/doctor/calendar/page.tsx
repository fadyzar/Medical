'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  startOfWeek, endOfWeek, eachDayOfInterval, format, addWeeks, subWeeks,
  addDays, subDays, isSameDay, isToday, isBefore, startOfDay, parseISO
} from 'date-fns'
import { he } from 'date-fns/locale'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardHeader, CardContent, Badge, PageLoading, EmptyState, Input } from '@/components/ui'
import { STATUS_LABELS, STATUS_COLORS, cn } from '@/lib/utils'
import type { Appointment, User, AvailabilitySlot } from '@/types/database'

type ViewMode = 'week' | 'day'
type TabMode = 'calendar' | 'availability' | 'vacations'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HOUR_HEIGHT = 64
const START_HOUR = 7
const END_HOUR = 21
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)

function minutesFromStart(dateStr: string): number {
  const d = parseISO(dateStr)
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes()
}

function topPx(minutes: number): number {
  return minutes * (HOUR_HEIGHT / 60)
}

function heightPx(durationMinutes: number): number {
  return Math.max(durationMinutes * (HOUR_HEIGHT / 60), 24) // min 24px for visibility
}

export default function DoctorCalendarPage() {
  const router = useRouter()
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<User | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [tab, setTab] = useState<TabMode>('calendar')
  const [now, setNow] = useState(new Date())

  // Availability editing state
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [savingAvailability, setSavingAvailability] = useState(false)

  // Vacation state
  const [vacations, setVacations] = useState<Array<{ start: string; end: string; note?: string }>>([])
  const [newVacStart, setNewVacStart] = useState('')
  const [newVacEnd, setNewVacEnd] = useState('')
  const [newVacNote, setNewVacNote] = useState('')
  const [savingVacation, setSavingVacation] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Load profile + availability + vacations (once)
  useEffect(() => {
    loadProfile()
  }, [])

  // Load appointments when date or viewMode changes
  useEffect(() => {
    if (profile) loadAppointments(profile.id)
  }, [currentDate, viewMode, profile?.id])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!prof) return

      const typedProf = prof as unknown as User
      setProfile(typedProf)
      setAvailability(typedProf.availability || [])
      const vacs = (typedProf.metadata?.vacations as Array<{ start: string; end: string; note?: string }>) || []
      setVacations(vacs)
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  const loadAppointments = async (doctorId: string) => {
    try {
      let rangeStart: string
      let rangeEnd: string

      if (viewMode === 'week') {
        const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
        rangeStart = format(subWeeks(ws, 2), 'yyyy-MM-dd')
        rangeEnd = format(addWeeks(endOfWeek(currentDate, { weekStartsOn: 0 }), 2), 'yyyy-MM-dd')
      } else {
        rangeStart = format(subDays(currentDate, 7), 'yyyy-MM-dd')
        rangeEnd = format(addDays(currentDate, 7), 'yyyy-MM-dd')
      }

      const { data: apts } = await supabase.from('appointments')
        .select('*, patient:patient_id(first_name, last_name, phone)')
        .eq('doctor_id', doctorId)
        .gte('scheduled_at', rangeStart)
        .lte('scheduled_at', rangeEnd)
        .not('status', 'in', '("cancelled_patient","cancelled_doctor")')
        .order('scheduled_at', { ascending: true })

      if (apts) setAppointments(apts as unknown as Appointment[])
    } catch {
      // Calendar appointments fail silently — data will refresh on next navigation
    }
  }

  // Week view dates
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 })
    const end = endOfWeek(currentDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  const getAppointmentsForDay = useCallback((day: Date): Appointment[] => {
    return appointments.filter(apt => {
      if (!apt.scheduled_at) return false
      return isSameDay(parseISO(apt.scheduled_at), day)
    })
  }, [appointments])

  const getDayAvailability = useCallback((day: Date): AvailabilitySlot | undefined => {
    return availability.find(s => s.day === day.getDay())
  }, [availability])

  const isVacationDay = useCallback((day: Date): boolean => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return vacations.some(v => dayStr >= v.start && dayStr <= v.end)
  }, [vacations])

  // Navigate
  const navigateWeek = (dir: number) => {
    setCurrentDate(prev => dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1))
  }
  const navigateDay = (dir: number) => {
    setCurrentDate(prev => addDays(prev, dir))
  }

  // Save feedback
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Save availability
  const saveAvailability = async () => {
    if (!profile) return
    setSavingAvailability(true)
    setSaveMessage(null)
    const { error } = await supabase.from('users').update({ availability }).eq('id', profile.id)
    setSavingAvailability(false)
    if (error) {
      setSaveMessage({ type: 'error', text: 'שגיאה בשמירת שעות הפעילות' })
    } else {
      setSaveMessage({ type: 'success', text: 'שעות הפעילות נשמרו בהצלחה' })
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const toggleDayAvailability = (dayIndex: number) => {
    setAvailability(prev => {
      const existing = prev.find(s => s.day === dayIndex)
      if (existing) return prev.filter(s => s.day !== dayIndex)
      return [...prev, { day: dayIndex, start: '09:00', end: '17:00' }]
    })
  }

  const updateSlotTime = (dayIndex: number, field: 'start' | 'end', value: string) => {
    setAvailability(prev => prev.map(s => s.day === dayIndex ? { ...s, [field]: value } : s))
  }

  // Add vacation
  const addVacation = async () => {
    if (!profile || !newVacStart || !newVacEnd) return
    if (newVacEnd < newVacStart) {
      setSaveMessage({ type: 'error', text: 'תאריך סיום חייב להיות אחרי תאריך התחלה' })
      return
    }
    setSavingVacation(true)
    setSaveMessage(null)
    const updatedVacs = [...vacations, { start: newVacStart, end: newVacEnd, note: newVacNote || undefined }]
    const { error } = await supabase.from('users').update({
      metadata: { ...profile.metadata, vacations: updatedVacs }
    }).eq('id', profile.id)
    if (error) {
      setSaveMessage({ type: 'error', text: 'שגיאה בהוספת החופשה' })
    } else {
      setVacations(updatedVacs)
      setNewVacStart('')
      setNewVacEnd('')
      setNewVacNote('')
      setSaveMessage({ type: 'success', text: 'החופשה נוספה בהצלחה' })
      setTimeout(() => setSaveMessage(null), 3000)
    }
    setSavingVacation(false)
  }

  const removeVacation = async (index: number) => {
    if (!profile) return
    setSaveMessage(null)
    const updatedVacs = vacations.filter((_, i) => i !== index)
    const { error } = await supabase.from('users').update({
      metadata: { ...profile.metadata, vacations: updatedVacs }
    }).eq('id', profile.id)
    if (error) {
      setSaveMessage({ type: 'error', text: 'שגיאה במחיקת החופשה' })
    } else {
      setVacations(updatedVacs)
      setSaveMessage({ type: 'success', text: 'החופשה נמחקה' })
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  // Stats
  const stats = useMemo(() => {
    const viewApts = viewMode === 'week'
      ? weekDays.flatMap(d => getAppointmentsForDay(d))
      : getAppointmentsForDay(currentDate)
    const todayApts = getAppointmentsForDay(new Date())
    const todayAvail = getDayAvailability(new Date())
    const nextApt = todayApts.find(a => a.scheduled_at && parseISO(a.scheduled_at) > now)
    return { total: viewApts.length, todayWorking: todayAvail ? `${todayAvail.start}–${todayAvail.end}` : null, nextApt }
  }, [viewMode, weekDays, currentDate, getAppointmentsForDay, getDayAvailability, now])

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (tab === 'calendar' && gridRef.current) {
      const currentHour = new Date().getHours()
      if (currentHour >= START_HOUR && currentHour < END_HOUR) {
        const scrollTo = topPx((currentHour - START_HOUR - 1) * 60)
        gridRef.current.scrollTop = Math.max(0, scrollTo)
      }
    }
  }, [tab, loading])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">יומן</h2>
        <div className="flex gap-2">
          {(['calendar', 'availability', 'vacations'] as TabMode[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {t === 'calendar' ? 'לוח שנה' : t === 'availability' ? 'שעות פעילות' : 'ימי חופשה'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'calendar' && (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-6 text-sm text-gray-600 bg-white rounded-lg border border-gray-200 px-4 py-2.5">
            <div>
              <span className="font-medium text-gray-900">{stats.total}</span>{' '}
              {viewMode === 'week' ? 'תורים השבוע' : 'תורים היום'}
            </div>
            {stats.todayWorking && (
              <div>
                שעות עבודה היום: <span className="font-medium text-gray-900">{stats.todayWorking}</span>
              </div>
            )}
            {stats.nextApt && stats.nextApt.scheduled_at && (
              <div>
                תור הבא: <span className="font-medium text-gray-900">
                  {format(parseISO(stats.nextApt.scheduled_at), 'HH:mm')}
                </span>
                {' '}
                <span className="text-gray-400">
                  ({(stats.nextApt.patient as unknown as User)?.first_name})
                </span>
              </div>
            )}
          </div>

          {/* Navigation bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => viewMode === 'week' ? navigateWeek(-1) : navigateDay(-1)}>
                ←
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
                היום
              </Button>
              <Button variant="outline" size="sm" onClick={() => viewMode === 'week' ? navigateWeek(1) : navigateDay(1)}>
                →
              </Button>
              <h3 className="text-lg font-semibold mr-2">
                {viewMode === 'week'
                  ? `${format(weekDays[0], 'd MMM', { locale: he })} — ${format(weekDays[6], 'd MMM yyyy', { locale: he })}`
                  : format(currentDate, 'EEEE, d MMMM yyyy', { locale: he })
                }
              </h3>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(['week', 'day'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={cn(
                    'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                    viewMode === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {v === 'week' ? 'שבועי' : 'יומי'}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'week' ? (
            <WeekTimeGrid
              gridRef={gridRef}
              weekDays={weekDays}
              now={now}
              getAppointmentsForDay={getAppointmentsForDay}
              getDayAvailability={getDayAvailability}
              isVacationDay={isVacationDay}
              setCurrentDate={setCurrentDate}
              setViewMode={setViewMode}
              router={router}
            />
          ) : (
            <DayTimeGrid
              gridRef={gridRef}
              date={currentDate}
              now={now}
              appointments={getAppointmentsForDay(currentDate)}
              availability={getDayAvailability(currentDate)}
              isVacation={isVacationDay(currentDate)}
              router={router}
            />
          )}
        </>
      )}

      {/* Save message */}
      {saveMessage && (
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg text-sm',
          saveMessage.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        )} role="status">
          {saveMessage.text}
        </div>
      )}

      {tab === 'availability' && (
        <AvailabilityEditor
          availability={availability}
          toggleDayAvailability={toggleDayAvailability}
          updateSlotTime={updateSlotTime}
          saveAvailability={saveAvailability}
          saving={savingAvailability}
        />
      )}

      {tab === 'vacations' && (
        <VacationManager
          vacations={vacations}
          newVacStart={newVacStart}
          newVacEnd={newVacEnd}
          newVacNote={newVacNote}
          setNewVacStart={setNewVacStart}
          setNewVacEnd={setNewVacEnd}
          setNewVacNote={setNewVacNote}
          addVacation={addVacation}
          removeVacation={removeVacation}
          saving={savingVacation}
        />
      )}
    </div>
  )
}

// ─── Week Time Grid ──────────────────────────────────────
function WeekTimeGrid({
  gridRef, weekDays, now, getAppointmentsForDay, getDayAvailability, isVacationDay,
  setCurrentDate, setViewMode, router,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>
  weekDays: Date[]
  now: Date
  getAppointmentsForDay: (d: Date) => Appointment[]
  getDayAvailability: (d: Date) => AvailabilitySlot | undefined
  isVacationDay: (d: Date) => boolean
  setCurrentDate: (d: Date) => void
  setViewMode: (v: ViewMode) => void
  router: ReturnType<typeof useRouter>
}) {
  const totalHeight = HOURS.length * HOUR_HEIGHT

  return (
    <Card className="overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="border-l border-gray-200" />
        {weekDays.map((day, i) => {
          const avail = getDayAvailability(day)
          const isVac = isVacationDay(day)
          const today = isToday(day)

          return (
            <button
              key={i}
              onClick={() => { setCurrentDate(day); setViewMode('day') }}
              className={cn(
                'border-l border-gray-200 px-1 py-2 text-center hover:bg-gray-50 transition-colors',
                today && 'bg-blue-50/60'
              )}
            >
              <p className="text-xs text-gray-500">{DAY_NAMES[i]}</p>
              <p className={cn(
                'text-lg font-bold mt-0.5',
                today ? 'text-blue-600' : 'text-gray-900'
              )}>
                {format(day, 'd')}
              </p>
              {avail && !isVac && (
                <p className="text-[10px] text-green-600">{avail.start}–{avail.end}</p>
              )}
              {isVac && <p className="text-[10px] text-orange-600 font-medium">חופשה</p>}
            </button>
          )
        })}
      </div>

      {/* Time grid */}
      <div ref={gridRef} className="overflow-y-auto max-h-[calc(100vh-300px)]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: totalHeight }}>
          {/* Time labels column */}
          <div className="relative border-l border-gray-200">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="absolute w-full text-left px-1.5 text-[11px] text-gray-400 -translate-y-1/2"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              >
                {`${hour.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => {
            const avail = getDayAvailability(day)
            const isVac = isVacationDay(day)
            const isPast = isBefore(startOfDay(day), startOfDay(new Date()))
            const today = isToday(day)
            const dayApts = getAppointmentsForDay(day)

            return (
              <div
                key={dayIdx}
                className={cn(
                  'relative border-l border-gray-200',
                  isPast && 'opacity-60',
                  isVac && 'bg-orange-50/40',
                  today && !isVac && 'bg-blue-50/30'
                )}
              >
                {/* Hour gridlines */}
                {HOURS.map(hour => {
                  const hourStr = `${hour.toString().padStart(2, '0')}:00`
                  const isWorking = avail && !isVac && hourStr >= avail.start && hourStr < avail.end
                  return (
                    <div
                      key={hour}
                      className={cn(
                        'absolute w-full border-t border-gray-100',
                        isWorking ? 'bg-white' : 'bg-gray-50/50'
                      )}
                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    />
                  )
                })}

                {/* Appointment blocks */}
                {dayApts.map(apt => {
                  if (!apt.scheduled_at) return null
                  const mins = minutesFromStart(apt.scheduled_at)
                  if (mins < 0) return null
                  const patient = apt.patient as unknown as User | undefined
                  const statusColor = STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-800'
                  const top = topPx(mins)
                  const height = heightPx(apt.duration_minutes || 30)

                  return (
                    <button
                      key={apt.id}
                      onClick={() => router.push(`/dashboard/doctor/appointments?id=${apt.id}`)}
                      className={cn(
                        'absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] leading-tight overflow-hidden cursor-pointer transition-opacity hover:opacity-80 z-[1] border border-white/50',
                        statusColor
                      )}
                      style={{ top, height }}
                      title={`${patient?.first_name || ''} ${patient?.last_name || ''} — ${apt.chief_complaint || ''}`}
                    >
                      <p className="font-semibold truncate">
                        {format(parseISO(apt.scheduled_at), 'HH:mm')}{' '}
                        {patient?.first_name}
                      </p>
                      {height >= 40 && (
                        <p className="truncate opacity-75">{apt.chief_complaint}</p>
                      )}
                    </button>
                  )
                })}

                {/* Current time indicator */}
                {today && now.getHours() >= START_HOUR && now.getHours() < END_HOUR && (
                  <div
                    className="absolute left-0 right-0 z-[2] pointer-events-none"
                    style={{ top: topPx((now.getHours() - START_HOUR) * 60 + now.getMinutes()) }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                      <div className="h-[2px] bg-red-500 flex-1" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// ─── Day Time Grid ──────────────────────────────────────
function DayTimeGrid({
  gridRef, date, now, appointments, availability, isVacation, router,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>
  date: Date
  now: Date
  appointments: Appointment[]
  availability: AvailabilitySlot | undefined
  isVacation: boolean
  router: ReturnType<typeof useRouter>
}) {
  const totalHeight = HOURS.length * HOUR_HEIGHT
  const today = isToday(date)

  return (
    <Card className="overflow-hidden">
      {isVacation && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-sm text-orange-700 font-medium">
          יום חופשה — אין קבלת מטופלים
        </div>
      )}
      {availability && !isVacation && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-700">
          שעות פעילות: {availability.start} – {availability.end}
        </div>
      )}
      {!availability && !isVacation && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-sm text-gray-500">
          לא הוגדרו שעות פעילות ליום זה
        </div>
      )}

      <div ref={gridRef} className="overflow-y-auto max-h-[calc(100vh-320px)]">
        <div className="grid grid-cols-[56px_1fr]" style={{ height: totalHeight }}>
          {/* Time labels */}
          <div className="relative border-l border-gray-200">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="absolute w-full text-left px-1.5 text-[11px] text-gray-400 -translate-y-1/2"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              >
                {`${hour.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Main column */}
          <div className={cn('relative border-l border-gray-200', isVacation && 'bg-orange-50/40')}>
            {/* Hour gridlines */}
            {HOURS.map(hour => {
              const hourStr = `${hour.toString().padStart(2, '0')}:00`
              const isWorking = availability && !isVacation && hourStr >= availability.start && hourStr < availability.end
              return (
                <div
                  key={hour}
                  className={cn(
                    'absolute w-full border-t border-gray-100',
                    isWorking ? 'bg-white' : 'bg-gray-50/50'
                  )}
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                />
              )
            })}

            {/* Appointment blocks */}
            {appointments.map(apt => {
              if (!apt.scheduled_at) return null
              const mins = minutesFromStart(apt.scheduled_at)
              if (mins < 0) return null
              const patient = apt.patient as unknown as User | undefined
              const statusColor = STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-800'
              const top = topPx(mins)
              const height = heightPx(apt.duration_minutes || 30)

              return (
                <button
                  key={apt.id}
                  onClick={() => router.push(`/dashboard/doctor/appointments?id=${apt.id}`)}
                  className={cn(
                    'absolute left-1 right-1 rounded-lg px-3 py-1.5 text-right overflow-hidden cursor-pointer transition-opacity hover:opacity-80 z-[1] border',
                    statusColor
                  )}
                  style={{ top, height }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {patient?.first_name} {patient?.last_name}
                      </p>
                      {height >= 48 && (
                        <p className="text-xs opacity-75 truncate mt-0.5">{apt.chief_complaint}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={apt.status === 'completed' ? 'success' : apt.status === 'in_progress' ? 'info' : 'default'}>
                        {STATUS_LABELS[apt.status]}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {format(parseISO(apt.scheduled_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Current time indicator */}
            {today && now.getHours() >= START_HOUR && now.getHours() < END_HOUR && (
              <div
                className="absolute left-0 right-0 z-[2] pointer-events-none"
                style={{ top: topPx((now.getHours() - START_HOUR) * 60 + now.getMinutes()) }}
              >
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                  <div className="h-[2px] bg-red-500 flex-1" />
                </div>
              </div>
            )}
          </div>
        </div>

        {appointments.length === 0 && (
          <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} title="אין תורים ליום זה" />
        )}
      </div>
    </Card>
  )
}

// ─── Availability Editor ──────────────────────────────────
function AvailabilityEditor({
  availability, toggleDayAvailability, updateSlotTime, saveAvailability, saving,
}: {
  availability: AvailabilitySlot[]
  toggleDayAvailability: (day: number) => void
  updateSlotTime: (day: number, field: 'start' | 'end', value: string) => void
  saveAvailability: () => void
  saving: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">שעות פעילות</h3>
          <Button onClick={saveAvailability} loading={saving} size="sm">שמור שינויים</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-500">הגדר את הימים והשעות בהם אתה זמין לייעוץ</p>
        {DAY_NAMES.map((name, i) => {
          const slot = availability.find(s => s.day === i)
          return (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <button
                onClick={() => toggleDayAvailability(i)}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative',
                  slot ? 'bg-blue-600' : 'bg-gray-300'
                )}
                role="switch"
                aria-checked={!!slot}
                aria-label={`${name} — ${slot ? 'פעיל' : 'לא פעיל'}`}
              >
                <span className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  slot ? 'right-0.5' : 'left-0.5'
                )} />
              </button>
              <span className={cn('w-16 text-sm font-medium', slot ? 'text-gray-900' : 'text-gray-400')}>
                {name}
              </span>
              {slot ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start}
                    onChange={e => updateSlotTime(i, 'start', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    aria-label={`שעת התחלה - ${name}`}
                  />
                  <span className="text-gray-400">—</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={e => updateSlotTime(i, 'end', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    aria-label={`שעת סיום - ${name}`}
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400">לא פעיל</span>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Vacation Manager ─────────────────────────────────────
function VacationManager({
  vacations, newVacStart, newVacEnd, newVacNote,
  setNewVacStart, setNewVacEnd, setNewVacNote,
  addVacation, removeVacation, saving,
}: {
  vacations: Array<{ start: string; end: string; note?: string }>
  newVacStart: string
  newVacEnd: string
  newVacNote: string
  setNewVacStart: (v: string) => void
  setNewVacEnd: (v: string) => void
  setNewVacNote: (v: string) => void
  addVacation: () => void
  removeVacation: (i: number) => void
  saving: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Add vacation */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">הוסף חופשה</h3>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                label="מתאריך"
                type="date"
                value={newVacStart}
                onChange={e => setNewVacStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                label="עד תאריך"
                type="date"
                value={newVacEnd}
                onChange={e => setNewVacEnd(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                label="הערה (אופציונלי)"
                value={newVacNote}
                onChange={e => setNewVacNote(e.target.value)}
                placeholder="למשל: חופשת פסח"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={addVacation}
                loading={saving}
                disabled={!newVacStart || !newVacEnd}
              >
                הוסף
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vacation list */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">ימי חופשה מתוכננים ({vacations.length})</h3>
        </CardHeader>
        {vacations.length === 0 ? (
          <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} title="אין ימי חופשה מתוכננים" />
        ) : (
          <div className="divide-y">
            {vacations.map((vac, i) => {
              const start = parseISO(vac.start)
              const end = parseISO(vac.end)
              const isPast = isBefore(end, startOfDay(new Date()))
              return (
                <div key={i} className={cn('px-6 py-3 flex items-center justify-between', isPast && 'opacity-50')}>
                  <div>
                    <p className="text-sm font-medium">
                      {format(start, 'd MMMM', { locale: he })} — {format(end, 'd MMMM yyyy', { locale: he })}
                    </p>
                    {vac.note && <p className="text-xs text-gray-500 mt-0.5">{vac.note}</p>}
                    {isPast && <Badge variant="default" className="mt-1">עבר</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeVacation(i)} aria-label="מחק חופשה">
                    מחק
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
