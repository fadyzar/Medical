'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, StatCard, Badge, PageLoading, EmptyState, Spinner } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatTime, getInitials, cn } from '@/lib/utils'
import type { Appointment, User } from '@/types/database'

// ── small helpers ──────────────────────────────────────────────────
function PatientAvatar({ first, last, size = 'md' }: { first: string; last: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' }
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-semibold text-white shrink-0', s[size])}>
      {getInitials(first || '?', last || '?')}
    </div>
  )
}

function TriageBadge({ score }: { score: number }) {
  if (score >= 7) return <Badge variant="danger">דחיפות גבוהה {score}/10</Badge>
  if (score >= 4) return <Badge variant="warning">דחיפות בינונית {score}/10</Badge>
  return <Badge variant="success">דחיפות נמוכה {score}/10</Badge>
}

// ── quick-action card ──────────────────────────────────────────────
function QuickAction({ icon, label, description, onClick, accent = 'blue' }: {
  icon: React.ReactNode; label: string; description: string; onClick: () => void; accent?: 'blue' | 'indigo' | 'emerald'
}) {
  const colors = {
    blue:    'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400 text-blue-700',
    indigo:  'from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-400 text-indigo-700',
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200 hover:border-emerald-400 text-emerald-700',
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-right rounded-xl border bg-gradient-to-br p-4 transition-all hover:shadow-md active:scale-[0.98]',
        colors[accent]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs mt-0.5 opacity-70">{description}</p>
        </div>
      </div>
    </button>
  )
}

// ── timeline item ──────────────────────────────────────────────────
function TimelineItem({ apt, isLast }: { apt: Appointment; isLast: boolean }) {
  const patient = apt.patient as unknown as User
  const isActive = ['in_progress'].includes(apt.status)
  const isReady  = apt.status === 'ready'

  return (
    <div className="flex gap-3 relative">
      {/* timeline spine */}
      {!isLast && <div className="absolute right-[18px] top-10 bottom-0 w-px bg-gray-200" />}

      {/* dot */}
      <div className={cn(
        'relative z-10 mt-1 w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold',
        isActive ? 'bg-green-500 border-green-500 text-white animate-pulse' :
        isReady  ? 'bg-blue-500 border-blue-500 text-white' :
                   'bg-white border-gray-300 text-gray-500'
      )}>
        {apt.scheduled_at ? formatTime(apt.scheduled_at).split(':')[0] : '—'}
      </div>

      <div className={cn(
        'flex-1 mb-4 rounded-xl border p-3 bg-white transition-shadow hover:shadow-sm',
        isActive ? 'border-green-300 bg-green-50' : isReady ? 'border-blue-200' : 'border-gray-200'
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <PatientAvatar first={patient?.first_name || ''} last={patient?.last_name || ''} size="sm" />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{patient?.first_name} {patient?.last_name}</p>
              <p className="text-xs text-gray-500 truncate">{apt.chief_complaint}</p>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <Badge variant={isActive ? 'success' : isReady ? 'info' : 'default'}>{STATUS_LABELS[apt.status]}</Badge>
            {apt.scheduled_at && <span className="text-xs text-gray-400">{formatTime(apt.scheduled_at)}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────
export default function DoctorDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<User | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = getClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const [{ data: prof }, { data: apts }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('appointments')
          .select('*, patient:patient_id(id, first_name, last_name, date_of_birth, phone, medical_history)')
          .eq('doctor_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (prof) setProfile(prof as unknown as User)
      if (apts) setAppointments(apts as unknown as Appointment[])
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  const confirmAppointment = async (id: string) => {
    setConfirmingId(id)
    setMessage(null)
    try {
      const { error } = await supabase.from('appointments').update({ status: 'doctor_confirmed', doctor_accepted_at: new Date().toISOString() }).eq('id', id)
      if (error) {
        setMessage({ type: 'error', text: 'שגיאה באישור התור' })
      } else {
        setMessage({ type: 'success', text: 'התור אושר בהצלחה' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאה באישור התור' })
    }
    setConfirmingId(null)
    loadData()
  }

  const generateAISummary = async (id: string) => {
    setAiLoading(id)
    setMessage(null)
    try {
      const res = await fetch('/api/ai-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: id, action: 'summary' }) })
      if (res.ok) {
        setMessage({ type: 'success', text: 'סיכום AI נוצר בהצלחה' })
        setTimeout(() => setMessage(null), 3000)
        loadData()
      } else {
        setMessage({ type: 'error', text: 'שגיאה ביצירת סיכום AI' })
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאה ביצירת סיכום AI' })
    } finally { setAiLoading(null) }
  }

  if (loading) return <PageLoading />

  const pending   = appointments.filter(a => ['pending', 'payment_pending'].includes(a.status))
  const active    = appointments.filter(a => ['doctor_confirmed', 'scheduled', 'ready', 'in_progress'].includes(a.status))
  const today     = appointments.filter(a => a.scheduled_at && new Date(a.scheduled_at).toDateString() === new Date().toDateString())
  const completed = appointments.filter(a => a.status === 'completed')
  const needSummary = completed.filter(a => !a.ai_summary)

  const todaySorted = [...today].sort((a, b) => {
    if (!a.scheduled_at) return 1
    if (!b.scheduled_at) return -1
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  })

  // greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'
  const doctorName = profile ? `ד"ר ${profile.first_name} ${profile.last_name}` : ''

  return (
    <div className="space-y-7">

      {/* ── hero greeting ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}{doctorName ? `, ${doctorName}` : ''}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profile?.specialties?.length ? profile.specialties.join(' · ') : 'לוח בקרה רופא'}
            {' · '}
            {new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
        </div>
        <div className="flex gap-2">
          {active.some(a => ['ready', 'in_progress', 'scheduled'].includes(a.status)) && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => {
                const next = active.find(a => ['ready', 'in_progress', 'scheduled'].includes(a.status))
                if (next) router.push(`/video-call?id=${next.id}`)
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              התחל ייעוץ
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/doctor/appointments')}>
            כל התורים
          </Button>
        </div>
      </div>

      {/* ── toast message ── */}
      {message && (
        <div className={cn(
          'flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium border',
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        )} role="status">
          <div className={cn('w-2 h-2 rounded-full shrink-0', message.type === 'success' ? 'bg-green-500' : 'bg-red-500')} />
          {message.text}
        </div>
      )}

      {/* ── stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="ממתינים לאישור"
          value={pending.length}
          color="orange"
          icon={
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <StatCard
          label="ביקורים היום"
          value={today.length}
          color="blue"
          icon={
            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          label="תורים פעילים"
          value={active.length}
          color="green"
          icon={
            <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />
        <StatCard
          label="דירוג ממוצע"
          value={profile?.average_rating ? `${profile.average_rating.toFixed(1)} ★` : '—'}
          color="purple"
          icon={
            <svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />
      </div>

      {/* ── quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          accent="blue"
          label="יומן רופא"
          description="תצוגה שבועית ויומית של תורים"
          onClick={() => router.push('/dashboard/doctor/calendar')}
          icon={
            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <QuickAction
          accent="indigo"
          label="קבע שעות פעילות"
          description="הגדר זמינות, הפסקות וחופשות"
          onClick={() => router.push('/dashboard/doctor/availability')}
          icon={
            <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <QuickAction
          accent="emerald"
          label="כל התורים"
          description="חיפוש, סינון וניהול מלא"
          onClick={() => router.push('/dashboard/doctor/appointments')}
          icon={
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          }
        />
      </div>

      {/* ── today's schedule ── */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h3 className="font-bold text-base">לוח הזמנים להיום</h3>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">{today.length} ביקורים</span>
        </CardHeader>
        <CardContent className="pt-5">
          {todaySorted.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
              title="אין ביקורים מתוזמנים להיום"
              description="תורים שיתוזמנו להיום יופיעו כאן בציר הזמן"
              action={<Button size="sm" variant="outline" onClick={() => router.push('/dashboard/doctor/appointments')}>צפה בכל התורים</Button>}
            />
          ) : (
            <div className="pr-1">
              {todaySorted.map((apt, idx) => (
                <TimelineItem key={apt.id} apt={apt} isLast={idx === todaySorted.length - 1} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── pending approval — urgent ── */}
      {pending.length > 0 && (
        <Card className="border-orange-300 shadow-orange-100 shadow-md">
          <CardHeader className="bg-gradient-to-l from-orange-50 to-amber-50 border-b border-orange-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-orange-900">בקשות ממתינות לאישורך</h3>
                  <p className="text-xs text-orange-600">מטופלים אלו מחכים לאישורך כדי לקבוע מועד</p>
                </div>
              </div>
              <span className="bg-orange-500 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                {pending.length}
              </span>
            </div>
          </CardHeader>

          <div className="divide-y divide-orange-100">
            {pending.map(apt => {
              const patient = apt.patient as unknown as User
              return (
                <div key={apt.id} className="px-5 py-4 hover:bg-orange-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <PatientAvatar first={patient?.first_name || ''} last={patient?.last_name || ''} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{patient?.first_name} {patient?.last_name}</p>
                        {apt.ai_triage_score != null && <TriageBadge score={apt.ai_triage_score} />}
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 font-medium">{apt.chief_complaint}</p>
                      {apt.complaint_description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{apt.complaint_description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {apt.ai_triage_category && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{apt.ai_triage_category}</span>
                        )}
                        <span className="text-xs text-gray-400">התקבל {formatDateTime(apt.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        loading={confirmingId === apt.id}
                        onClick={() => confirmAppointment(apt.id)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        אשר תור
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                        onClick={() => router.push(`/dashboard/doctor/appointments?id=${apt.id}`)}
                      >
                        פרטים
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── active appointments ── */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h3 className="font-bold text-base">תורים פעילים</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/doctor/appointments')}>
            כל התורים ←
          </Button>
        </CardHeader>

        {active.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            }
            title="אין תורים פעילים כרגע"
            description="תורים מאושרים ומתוזמנים יופיעו כאן"
          />
        ) : (
          <div className="divide-y">
            {active.map(apt => {
              const patient = apt.patient as unknown as User
              const canVideo = ['ready', 'in_progress', 'scheduled'].includes(apt.status)
              const isInProgress = apt.status === 'in_progress'

              return (
                <div
                  key={apt.id}
                  className={cn(
                    'px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors',
                    isInProgress && 'bg-green-50 hover:bg-green-50'
                  )}
                >
                  <PatientAvatar first={patient?.first_name || ''} last={patient?.last_name || ''} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{patient?.first_name} {patient?.last_name}</p>
                      {isInProgress && (
                        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          בשיחה עכשיו
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-0.5">{apt.chief_complaint}</p>
                    {apt.scheduled_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(apt.scheduled_at))}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant={isInProgress ? 'success' : apt.status === 'ready' ? 'info' : 'default'}>
                      {STATUS_LABELS[apt.status]}
                    </Badge>
                    {canVideo && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 gap-1.5 text-xs"
                        onClick={() => router.push(`/video-call?id=${apt.id}`)}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                        וידאו
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── recently completed — need AI summary ── */}
      {needSummary.length > 0 && (
        <Card className="border-purple-200">
          <CardHeader className="bg-gradient-to-l from-purple-50 to-violet-50 border-b border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" />
                    <circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-purple-900">ממתינים לסיכום AI</h3>
                  <p className="text-xs text-purple-600">ייעוצים שהסתיימו ועדיין לא קיבלו סיכום אוטומטי</p>
                </div>
              </div>
              <span className="bg-purple-500 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                {needSummary.length}
              </span>
            </div>
          </CardHeader>

          <div className="divide-y divide-purple-100">
            {needSummary.slice(0, 5).map(apt => {
              const patient = apt.patient as unknown as User
              return (
                <div key={apt.id} className="px-5 py-4 flex items-center gap-3 hover:bg-purple-50/40 transition-colors">
                  <PatientAvatar first={patient?.first_name || ''} last={patient?.last_name || ''} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{patient?.first_name} {patient?.last_name}</p>
                    <p className="text-sm text-gray-500 truncate">{apt.chief_complaint}</p>
                    {apt.completed_at && (
                      <p className="text-xs text-gray-400 mt-0.5">הסתיים {formatDateTime(apt.completed_at)}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {aiLoading === apt.id ? (
                      <div className="flex items-center gap-2 text-sm text-purple-600">
                        <Spinner size="sm" />
                        <span>מייצר...</span>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-xs"
                          onClick={() => generateAISummary(apt.id)}
                        >
                          צור סיכום AI
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-gray-500"
                          onClick={() => router.push(`/dashboard/doctor/appointments?id=${apt.id}`)}
                        >
                          פרטים
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {needSummary.length > 5 && (
            <div className="px-5 py-3 border-t border-purple-100 text-center">
              <Button variant="ghost" size="sm" className="text-purple-600 text-sm" onClick={() => router.push('/dashboard/doctor/appointments')}>
                ועוד {needSummary.length - 5} ייעוצים נוספים ←
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
