'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  startOfWeek, endOfWeek, eachDayOfInterval, format, addWeeks, subWeeks,
  addDays, isSameDay, isToday, isBefore, startOfDay, parseISO
} from 'date-fns'
import { he } from 'date-fns/locale'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardHeader, CardContent, Badge, PageLoading, EmptyState, Input } from '@/components/ui'
import { STATUS_LABELS, cn, formatTime } from '@/lib/utils'
import type { Appointment, User, AvailabilitySlot } from '@/types/database'

type ViewMode = 'week' | 'day'
type TabMode = 'calendar' | 'availability' | 'vacations'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 07:00-20:00

export default function DoctorCalendarPage() {
  const router = useRouter()
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<User | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [tab, setTab] = useState<TabMode>('calendar')

  // Availability editing state
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [savingAvailability, setSavingAvailability] = useState(false)

  // Vacation state
  const [vacations, setVacations] = useState<Array<{ start: string; end: string; note?: string }>>([])
  const [newVacStart, setNewVacStart] = useState('')
  const [newVacEnd, setNewVacEnd] = useState('')
  const [newVacNote, setNewVacNote] = useState('')
  const [savingVacation, setSavingVacation] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: prof } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!prof) return

    const typedProf = prof as unknown as User
    setProfile(typedProf)
    setAvailability(typedProf.availability || [])

    // Load vacations from metadata
    const vacs = (typedProf.metadata?.vacations as Array<{ start: string; end: string; note?: string }>) || []
    setVacations(vacs)

    // Load appointments for a wide range (current month ±1)
    const rangeStart = format(subWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), 4), 'yyyy-MM-dd')
    const rangeEnd = format(addWeeks(endOfWeek(new Date(), { weekStartsOn: 0 }), 8), 'yyyy-MM-dd')

    const { data: apts } = await supabase.from('appointments')
      .select('*, patient:patient_id(first_name, last_name, phone)')
      .eq('doctor_id', user.id)
      .gte('scheduled_at', rangeStart)
      .lte('scheduled_at', rangeEnd)
      .not('status', 'in', '("cancelled_patient","cancelled_doctor")')
      .order('scheduled_at', { ascending: true })

    if (apts) setAppointments(apts as unknown as Appointment[])
    setLoading(false)
  }

  // Week view dates
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 })
    const end = endOfWeek(currentDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  // Filter appointments for current view
  const getAppointmentsForDay = useCallback((day: Date): Appointment[] => {
    return appointments.filter(apt => {
      if (!apt.scheduled_at) return false
      return isSameDay(parseISO(apt.scheduled_at), day)
    })
  }, [appointments])

  // Check if a day has availability
  const getDayAvailability = useCallback((day: Date): AvailabilitySlot | undefined => {
    const dayOfWeek = day.getDay() // 0=Sunday
    return availability.find(s => s.day === dayOfWeek)
  }, [availability])

  // Check if a day is a vacation day
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

  // Save availability
  const saveAvailability = async () => {
    if (!profile) return
    setSavingAvailability(true)
    await supabase.from('users').update({ availability }).eq('id', profile.id)
    setSavingAvailability(false)
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
    setSavingVacation(true)
    const updatedVacs = [...vacations, { start: newVacStart, end: newVacEnd, note: newVacNote || undefined }]
    await supabase.from('users').update({
      metadata: { ...profile.metadata, vacations: updatedVacs }
    }).eq('id', profile.id)
    setVacations(updatedVacs)
    setNewVacStart('')
    setNewVacEnd('')
    setNewVacNote('')
    setSavingVacation(false)
  }

  const removeVacation = async (index: number) => {
    if (!profile) return
    const updatedVacs = vacations.filter((_, i) => i !== index)
    await supabase.from('users').update({
      metadata: { ...profile.metadata, vacations: updatedVacs }
    }).eq('id', profile.id)
    setVacations(updatedVacs)
  }

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
        <CalendarView
          viewMode={viewMode}
          setViewMode={setViewMode}
          currentDate={currentDate}
          weekDays={weekDays}
          navigateWeek={navigateWeek}
          navigateDay={navigateDay}
          setCurrentDate={setCurrentDate}
          getAppointmentsForDay={getAppointmentsForDay}
          getDayAvailability={getDayAvailability}
          isVacationDay={isVacationDay}
          router={router}
        />
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

// ─── Calendar View ────────────────────────────────────────
function CalendarView({
  viewMode, setViewMode, currentDate, weekDays, navigateWeek, navigateDay,
  setCurrentDate, getAppointmentsForDay, getDayAvailability, isVacationDay, router,
}: {
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  currentDate: Date
  weekDays: Date[]
  navigateWeek: (dir: number) => void
  navigateDay: (dir: number) => void
  setCurrentDate: (d: Date) => void
  getAppointmentsForDay: (d: Date) => Appointment[]
  getDayAvailability: (d: Date) => AvailabilitySlot | undefined
  isVacationDay: (d: Date) => boolean
  router: ReturnType<typeof useRouter>
}) {
  return (
    <>
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
        <WeekView
          weekDays={weekDays}
          getAppointmentsForDay={getAppointmentsForDay}
          getDayAvailability={getDayAvailability}
          isVacationDay={isVacationDay}
          setCurrentDate={setCurrentDate}
          setViewMode={setViewMode}
          router={router}
        />
      ) : (
        <DayView
          date={currentDate}
          appointments={getAppointmentsForDay(currentDate)}
          availability={getDayAvailability(currentDate)}
          isVacation={isVacationDay(currentDate)}
          router={router}
        />
      )}
    </>
  )
}

// ─── Week View ────────────────────────────────────────────
function WeekView({
  weekDays, getAppointmentsForDay, getDayAvailability, isVacationDay,
  setCurrentDate, setViewMode, router,
}: {
  weekDays: Date[]
  getAppointmentsForDay: (d: Date) => Appointment[]
  getDayAvailability: (d: Date) => AvailabilitySlot | undefined
  isVacationDay: (d: Date) => boolean
  setCurrentDate: (d: Date) => void
  setViewMode: (v: ViewMode) => void
  router: ReturnType<typeof useRouter>
}) {
  return (
    <Card>
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map((day, i) => {
          const avail = getDayAvailability(day)
          const isVac = isVacationDay(day)
          const dayApts = getAppointmentsForDay(day)
          const isPast = isBefore(startOfDay(day), startOfDay(new Date()))
          const today = isToday(day)

          return (
            <div
              key={i}
              className={cn(
                'border-l border-gray-200 first:border-l-0 min-h-[140px]',
                isPast && 'opacity-60',
                isVac && 'bg-orange-50',
                today && 'bg-blue-50/50'
              )}
            >
              {/* Day header */}
              <button
                onClick={() => { setCurrentDate(day); setViewMode('day') }}
                className="w-full px-2 py-2 text-center hover:bg-gray-50 transition-colors border-b border-gray-100"
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

              {/* Appointments */}
              <div className="px-1 py-1 space-y-1">
                {dayApts.slice(0, 4).map(apt => {
                  const patient = apt.patient as unknown as User | undefined
                  return (
                    <button
                      key={apt.id}
                      onClick={() => router.push(`/dashboard/doctor/appointments?id=${apt.id}`)}
                      className={cn(
                        'w-full text-right px-1.5 py-1 rounded text-[11px] truncate transition-colors',
                        apt.status === 'completed'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : apt.status === 'in_progress'
                          ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      )}
                    >
                      <span className="font-medium">
                        {apt.scheduled_at ? format(parseISO(apt.scheduled_at), 'HH:mm') : ''}
                      </span>{' '}
                      {patient?.first_name} {patient?.last_name}
                    </button>
                  )
                })}
                {dayApts.length > 4 && (
                  <p className="text-[10px] text-gray-500 text-center">
                    +{dayApts.length - 4} נוספים
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Day View ─────────────────────────────────────────────
function DayView({
  date, appointments, availability, isVacation, router,
}: {
  date: Date
  appointments: Appointment[]
  availability: AvailabilitySlot | undefined
  isVacation: boolean
  router: ReturnType<typeof useRouter>
}) {
  return (
    <Card>
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

      <div className="divide-y divide-gray-100">
        {HOURS.map(hour => {
          const hourStr = `${hour.toString().padStart(2, '0')}:00`
          const hourApts = appointments.filter(apt => {
            if (!apt.scheduled_at) return false
            const aptHour = parseISO(apt.scheduled_at).getHours()
            return aptHour === hour
          })
          const isWorkingHour = availability && !isVacation
            ? hourStr >= availability.start && hourStr < availability.end
            : false

          return (
            <div key={hour} className={cn('flex min-h-[64px]', !isWorkingHour && 'bg-gray-50/50')}>
              {/* Time label */}
              <div className="w-16 shrink-0 px-2 py-2 text-left text-xs text-gray-400 border-l border-gray-200">
                {hourStr}
              </div>

              {/* Appointments in this hour */}
              <div className="flex-1 p-1 space-y-1">
                {hourApts.map(apt => {
                  const patient = apt.patient as unknown as User | undefined
                  return (
                    <button
                      key={apt.id}
                      onClick={() => router.push(`/dashboard/doctor/appointments?id=${apt.id}`)}
                      className={cn(
                        'w-full text-right px-3 py-2 rounded-lg transition-colors',
                        apt.status === 'completed'
                          ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                          : apt.status === 'in_progress'
                          ? 'bg-purple-50 border border-purple-200 hover:bg-purple-100'
                          : 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {patient?.first_name} {patient?.last_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{apt.chief_complaint}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={apt.status === 'completed' ? 'success' : apt.status === 'in_progress' ? 'info' : 'default'}>
                            {STATUS_LABELS[apt.status]}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {apt.scheduled_at ? format(parseISO(apt.scheduled_at), 'HH:mm') : ''}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {appointments.length === 0 && (
        <EmptyState icon="📅" title="אין תורים ליום זה" />
      )}
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
          <EmptyState icon="🏖️" title="אין ימי חופשה מתוכננים" />
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
