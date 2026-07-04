'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, EmptyState, PageLoading } from '@/components/ui'
import { ChartCard, AreaTrend, MED } from '@/components/ui/medical'
import { STATUS_LABELS, formatDateTime, formatDate, cn, getInitials } from '@/lib/utils'
import type { Appointment, User, Document } from '@/types/database'

type DoctorInfo = Pick<User, 'id' | 'first_name' | 'last_name' | 'specialties' | 'avatar_url' | 'average_rating' | 'total_ratings'>
type PatientAppointment = Appointment & { doctor: DoctorInfo | null }

// ── Helpers ────────────────────────────────────────────────

function getTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'עכשיו'
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `בעוד ${d} ${d === 1 ? 'יום' : 'ימים'}`
  if (h > 0) return `בעוד ${h} ${h === 1 ? 'שעה' : 'שעות'}`
  return `בעוד ${m} דקות`
}

function getProfileCompletion(p: User): { percent: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!p.first_name, 'שם פרטי'], [!!p.last_name, 'שם משפחה'],
    [!!p.phone, 'טלפון'], [!!p.date_of_birth, 'תאריך לידה'],
    [!!p.gender, 'מגדר'], [!!p.avatar_url, 'תמונת פרופיל'],
    [(p.medical_history?.allergies?.length ?? 0) > 0, 'אלרגיות'],
    [!!p.emergency_contact?.name, 'איש קשר לחירום'],
    [!!p.insurance_info?.provider, 'פרטי ביטוח'],
  ]
  const done = checks.filter(([ok]) => ok).length
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([ok]) => !ok).map(([, l]) => l) }
}

function DoctorAvatar({ doc }: { doc: DoctorInfo | null }) {
  if (!doc) return <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 shrink-0">?</div>
  if (doc.avatar_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={doc.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white" />
  )
  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0 ring-2 ring-white">
      {getInitials(doc.first_name, doc.last_name)}
    </div>
  )
}

// ── Quick action card ────────────────────────────────────

function QuickActionCard({ icon, label, description, onClick, color }: {
  icon: React.ReactNode; label: string; description: string; onClick: () => void
  color: 'blue' | 'purple' | 'emerald' | 'gray'
}) {
  const colors = {
    blue:    'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700 hover:bg-blue-100',
    purple:  'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-700 hover:bg-purple-100',
    emerald: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-700 hover:bg-emerald-100',
    gray:    'bg-slate-50 border-slate-200 hover:border-slate-400 text-slate-700 hover:bg-slate-100',
  }
  return (
    <button onClick={onClick} className={cn('rounded-xl border p-4 text-right transition-all hover:shadow-sm active:scale-[0.98]', colors[color])}>
      <div className="mb-2">{icon}</div>
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs opacity-70 mt-0.5">{description}</p>
    </button>
  )
}

// ── Notifications Banner ──────────────────────────────────

function NotificationsBanner({
  notifications,
  onMarkRead,
}: {
  notifications: { id: string; title: string; content: string; created_at: string; read_at: string | null }[]
  onMarkRead: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 bg-blue-100/50 border-b border-blue-200">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <p className="text-sm font-semibold text-blue-800">
          {notifications.length === 1 ? 'הודעה חדשה מהרופא שלך' : `${notifications.length} הודעות חדשות מהרופא שלך`}
        </p>
      </div>
      <div className="divide-y divide-blue-100">
        {notifications.map(n => (
          <div key={n.id} className="px-4 py-3">
            <button
              className="w-full text-right flex items-start justify-between gap-3"
              onClick={() => setExpanded(prev => prev === n.id ? null : n.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{n.title || 'הודעה חדשה'}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {n.content?.split('\n')[0] || ''}
                </p>
              </div>
              <svg className={cn('w-4 h-4 text-blue-400 shrink-0 mt-0.5 transition-transform', expanded === n.id && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expanded === n.id && (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-white border border-blue-100 p-3">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                </div>
                <button
                  onClick={() => onMarkRead(n.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  סמן כנקרא
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────

export default function PatientDashboard() {
  const router   = useRouter()
  const supabase = getClient()

  const [profile, setProfile]         = useState<User | null>(null)
  const [appointments, setAppointments] = useState<PatientAppointment[]>([])
  const [recentDocs, setRecentDocs]   = useState<Document[]>([])
  const [loading, setLoading]         = useState(true)
  const [ratedMap, setRatedMap]       = useState<Record<string, number>>({})
  const [notifications, setNotifications] = useState<{ id: string; title: string; content: string; created_at: string; read_at: string | null }[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }
        const [{ data: prof }, { data: apts }, { data: docs }, { data: notifs }] = await Promise.all([
          supabase.from('users').select('*').eq('id', user.id).single(),
          supabase.from('appointments')
            .select('*, doctor:doctor_id(id, first_name, last_name, specialties, avatar_url, average_rating, total_ratings)')
            .eq('patient_id', user.id)
            .order('created_at', { ascending: false }).limit(50),
          supabase.from('documents').select('*').eq('patient_id', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('notifications')
            .select('id, title, content, created_at, read_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(10),
        ])
        if (prof) setProfile(prof as unknown as User)
        if (apts) setAppointments(apts as unknown as PatientAppointment[])
        if (docs) setRecentDocs(docs as unknown as Document[])
        if (notifs) setNotifications(notifs as typeof notifications)
      } catch { /* Error boundary will handle rendering errors */ }
      finally { setLoading(false) }
    }
    load()
  }, [router, supabase])

  if (loading) return <PageLoading />
  if (!profile) return null

  const now = new Date()
  const DONE = ['completed', 'cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor']
  const active    = appointments.filter(a => !DONE.includes(a.status))
  const completed = appointments.filter(a => a.status === 'completed')
  const upcoming  = active
    .filter(a => a.scheduled_at && new Date(a.scheduled_at) > now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
  const nextApt    = upcoming[0] || null
  const proposedByDoctor = active.filter(a => a.doctor_proposed_at && !a.patient_confirmed_proposed_at)
  const needsAction = active.filter(a => a.status === 'payment_pending' || a.payment_status === 'failed')
  const unrated     = completed.filter(a => a.patient_rating == null && !ratedMap[a.id]).slice(0, 2)
  const inProgress  = active.find(a => a.status === 'in_progress')
  const { percent: profilePercent, missing: profileMissing } = getProfileCompletion(profile)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'
  const firstName = profile.first_name || ''

  // Real 6-month activity (consultations per month)
  const activityData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      month: d.toLocaleDateString('he-IL', { month: 'short' }),
      count: appointments.filter(a => {
        const ad = new Date(a.scheduled_at || a.created_at)
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth()
      }).length,
    }
  })

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Hero greeting ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0',
            'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200'
          )}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
              : getInitials(profile.first_name, profile.last_name)
            }
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
            </p>
          </div>
        </div>
        <Button
          size="lg"
          className="gap-2 shadow-sm shadow-blue-200"
          onClick={() => router.push('/dashboard/patient/new-appointment')}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          קבע תור חדש
        </Button>
      </div>

      {/* ── In-app notifications from doctor ── */}
      {notifications.filter(n => !n.read_at).length > 0 && (
        <NotificationsBanner
          notifications={notifications.filter(n => !n.read_at)}
          onMarkRead={async (id) => {
            const { createClient } = await import('@supabase/supabase-js')
            void createClient // unused — use existing supabase
            await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
          }}
        />
      )}

      {/* ── Doctor proposed alternative time alerts ── */}
      {proposedByDoctor.map(apt => {
        const doc = apt.doctor as { first_name: string; last_name: string } | null
        const d = new Date(apt.scheduled_at!)
        const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
        const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
        const t = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
        const proposed = `יום ${days[d.getDay()]}, ${d.getDate()} ב${months[d.getMonth()]} — ${t}`
        return (
          <div key={apt.id} className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {doc ? `ד"ר ${doc.first_name} ${doc.last_name}` : 'הרופא'} הציע מועד חלופי לתור שלך
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  <strong>{proposed}</strong> — עבור: {apt.chief_complaint}
                </p>
                <p className="text-xs text-amber-600 mt-1">יש לאשר או לדחות את המועד המוצע</p>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-amber-600 hover:bg-amber-700"
              onClick={() => router.push('/dashboard/patient/appointments')}
            >
              לאישור →
            </Button>
          </div>
        )
      })}

      {/* ── Active video call banner ── */}
      {inProgress && (
        <div className="rounded-2xl bg-gradient-to-l from-green-600 to-emerald-700 p-4 text-white shadow-lg shadow-green-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-base">הייעוץ שלך מתקיים עכשיו!</p>
                <p className="text-sm text-green-100">{inProgress.chief_complaint}</p>
              </div>
            </div>
            <Button
              onClick={() => router.push(`/video-call?id=${inProgress.id}`)}
              className="bg-white text-green-700 hover:bg-green-50 font-bold shrink-0"
              size="sm"
            >
              הצטרף עכשיו
            </Button>
          </div>
        </div>
      )}

      {/* ── Payment needed ── */}
      {needsAction.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="font-bold text-orange-900">נדרשת פעולה — {needsAction.length} תור{needsAction.length > 1 ? 'ים' : ''} ממתינ{needsAction.length > 1 ? 'ים' : ''} לתשלום</p>
          </div>
          <div className="space-y-2">
            {needsAction.map(apt => (
              <div key={apt.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-orange-100">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{apt.chief_complaint}</p>
                  <p className="text-xs text-orange-600 mt-0.5">{apt.payment_status === 'failed' ? 'התשלום נכשל — יש לנסות שוב' : 'ממתין לתשלום'}</p>
                </div>
                <Button size="sm" className={apt.payment_status === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
                  onClick={() => router.push(`/dashboard/patient/payment?id=${apt.id}`)}>
                  {apt.payment_status === 'failed' ? 'נסה שוב' : 'שלם'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'תורים פעילים',  value: active.length,    color: 'blue',   icon: 'M8 4h8M3 8h18M3 16h18M8 20h8' },
          { label: 'ייעוצים הושלמו', value: completed.length, color: 'green',  icon: 'M22 11.08V12a10 10 0 11-5.93-9.14 M22 4 12 14.01 9 11.01' },
          { label: 'מסמכים',        value: recentDocs.length,  color: 'purple', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
          { label: 'התור הבא',      value: nextApt ? getTimeUntil(nextApt.scheduled_at!) : 'אין', color: 'orange', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
        ].map(s => (
          <div key={s.label} className={cn(
            'rounded-2xl p-4 border',
            s.color === 'blue'   && 'bg-blue-50 border-blue-100',
            s.color === 'green'  && 'bg-emerald-50 border-emerald-100',
            s.color === 'purple' && 'bg-purple-50 border-purple-100',
            s.color === 'orange' && 'bg-orange-50 border-orange-100',
          )}>
            <p className={cn('text-xs font-medium mb-1',
              s.color === 'blue'   && 'text-blue-600',
              s.color === 'green'  && 'text-emerald-600',
              s.color === 'purple' && 'text-purple-600',
              s.color === 'orange' && 'text-orange-600',
            )}>{s.label}</p>
            <p className={cn('text-2xl font-bold',
              s.color === 'blue'   && 'text-blue-800',
              s.color === 'green'  && 'text-emerald-800',
              s.color === 'purple' && 'text-purple-800',
              s.color === 'orange' && 'text-orange-800',
            )}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Profile completion ── */}
      {profilePercent < 100 && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-indigo-50 p-4">
          <div className="flex items-center gap-4">
            {/* Donut */}
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="16" fill="none" stroke="#dbeafe" strokeWidth="4" />
                <circle cx="21" cy="21" r="16" fill="none" stroke="#3b82f6" strokeWidth="4"
                  strokeDasharray={`${profilePercent} 100`} strokeLinecap="round"
                  style={{ strokeDasharray: `${profilePercent * 1.005} 100` }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-blue-700">{profilePercent}%</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900">השלם את הפרופיל הרפואי שלך</p>
              <p className="text-sm text-slate-500 mt-0.5">
                חסר: {profileMissing.slice(0, 3).join(', ')}{profileMissing.length > 3 ? ` ועוד ${profileMissing.length - 3}` : ''}
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 border-blue-300 text-blue-700" onClick={() => router.push('/dashboard/patient/profile')}>
              השלם
            </Button>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-blue-100">
            <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${profilePercent}%` }} />
          </div>
        </div>
      )}

      {/* ── Next appointment hero ── */}
      {nextApt && (
        <Card className="overflow-hidden border-blue-200 shadow-sm shadow-blue-100">
          <div className="bg-gradient-to-l from-blue-600 to-indigo-700 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">התור הבא שלך</p>
                <p className="text-xl font-bold">{nextApt.chief_complaint}</p>
                <p className="text-blue-200 text-sm mt-1">{formatDateTime(nextApt.scheduled_at!)}</p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/20 text-sm font-semibold text-white">
                  {getTimeUntil(nextApt.scheduled_at!)}
                </span>
              </div>
            </div>
          </div>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <DoctorAvatar doc={nextApt.doctor as DoctorInfo | null} />
                <div className="min-w-0">
                  {nextApt.doctor ? (
                    <>
                      <p className="font-semibold text-slate-900 text-sm">
                        ד&quot;ר {(nextApt.doctor as DoctorInfo).first_name} {(nextApt.doctor as DoctorInfo).last_name}
                      </p>
                      {(nextApt.doctor as DoctorInfo).specialties?.length && (
                        <p className="text-xs text-slate-500">{(nextApt.doctor as DoctorInfo).specialties!.slice(0,2).join(', ')}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">ממתין לשיוך רופא</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {nextApt.status === 'payment_pending' && (
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => router.push(`/dashboard/patient/payment?id=${nextApt.id}`)}>
                    שלם עכשיו
                  </Button>
                )}
                {(nextApt.status === 'in_progress' ||
                  (['ready', 'scheduled', 'paid'].includes(nextApt.status) &&
                    nextApt.scheduled_at &&
                    (new Date(nextApt.scheduled_at).getTime() - Date.now()) <= 15 * 60 * 1000)
                ) && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={() => router.push(`/video-call?id=${nextApt.id}`)}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    הצטרף לשיחה
                  </Button>
                )}
                <Badge variant={nextApt.status === 'pending' ? 'warning' : 'info'}>{STATUS_LABELS[nextApt.status]}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── More upcoming ── */}
      {upcoming.length > 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">תורים קרובים נוספים</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/patient/appointments')}>
                הכל ←
              </Button>
            </div>
          </CardHeader>
          <div className="divide-y">
            {upcoming.slice(1).map(apt => (
              <div key={apt.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <DoctorAvatar doc={apt.doctor as DoctorInfo | null} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{apt.chief_complaint}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {apt.doctor ? `ד"ר ${(apt.doctor as DoctorInfo).first_name} ${(apt.doctor as DoctorInfo).last_name}` : 'ממתין לרופא'}
                    {' · '}{formatDateTime(apt.scheduled_at!)}
                  </p>
                </div>
                <Badge variant="info">{STATUS_LABELS[apt.status]}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── In-process appointments (not scheduled yet) ── */}
      {active.filter(a => !a.scheduled_at || new Date(a.scheduled_at) <= now).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <h3 className="font-bold text-base">בטיפול</h3>
            </div>
          </CardHeader>
          <div className="divide-y">
            {active.filter(a => !a.scheduled_at || new Date(a.scheduled_at) <= now).map(apt => (
              <div key={apt.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <div className={cn('w-2 h-8 rounded-full shrink-0',
                  apt.status === 'pending' ? 'bg-amber-400' :
                  apt.status === 'doctor_confirmed' ? 'bg-blue-400' : 'bg-indigo-400'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{apt.chief_complaint}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {apt.doctor ? `ד"ר ${(apt.doctor as DoctorInfo).first_name} ${(apt.doctor as DoctorInfo).last_name}` : 'ממתין לשיוך רופא'}
                    {' · '}{formatDate(apt.created_at)}
                  </p>
                </div>
                <Badge variant={apt.status === 'pending' ? 'warning' : 'info'}>{STATUS_LABELS[apt.status]}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Rate visits ── */}
      {unrated.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="bg-gradient-to-l from-yellow-50 to-amber-50 border-b border-yellow-100">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <h3 className="font-bold text-yellow-800">איך היה הייעוץ?</h3>
            </div>
          </CardHeader>
          <div className="divide-y divide-yellow-100">
            {unrated.map(apt => (
              <div key={apt.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{apt.chief_complaint}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {apt.doctor ? `ד"ר ${(apt.doctor as DoctorInfo).first_name} ${(apt.doctor as DoctorInfo).last_name}` : ''}
                    {apt.completed_at ? ` · ${formatDate(apt.completed_at)}` : ''}
                  </p>
                </div>
                <RateButtons appointmentId={apt.id} onRated={(id, r) => setRatedMap(p => ({ ...p, [id]: r }))} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Recent completed ── */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">ביקורים אחרונים</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/patient/appointments')}>
                הכל ←
              </Button>
            </div>
          </CardHeader>
          <div className="divide-y">
            {completed.slice(0, 4).map(apt => (
              <div key={apt.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">{apt.chief_complaint}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {apt.doctor ? `ד"ר ${(apt.doctor as DoctorInfo).first_name} ${(apt.doctor as DoctorInfo).last_name}` : ''}
                        {apt.completed_at ? ` · ${formatDate(apt.completed_at)}` : ''}
                      </p>
                      {apt.diagnosis && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                          <span className="font-medium">אבחנה:</span> {apt.diagnosis}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="success">הושלם</Badge>
                    {apt.patient_rating && (
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={cn('text-sm', s <= apt.patient_rating! ? 'text-yellow-400' : 'text-slate-200')}>★</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Recent documents ── */}
      {recentDocs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">מסמכים אחרונים</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/patient/my-documents')}>
                כל המסמכים ←
              </Button>
            </div>
          </CardHeader>
          <div className="divide-y">
            {recentDocs.map(doc => (
              <div key={doc.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  doc.file_type?.startsWith('image/') ? 'bg-purple-50' :
                  doc.file_type === 'application/pdf' ? 'bg-red-50' : 'bg-blue-50'
                )}>
                  <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-slate-400">{formatDate(doc.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Empty state ── */}
      {appointments.length === 0 && (
        <Card>
          <EmptyState
            icon={
              <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
                <svg className="w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3" />
                  <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" />
                </svg>
              </div>
            }
            title={`ברוך הבא, ${firstName || 'לCANNA'}!`}
            description="קבע את הייעוץ הרפואי הראשון שלך עם מומחה — מהבית, ללא המתנה"
            action={
              <Button size="lg" onClick={() => router.push('/dashboard/patient/new-appointment')}>
                קבע תור ראשון
              </Button>
            }
          />
        </Card>
      )}

      {/* ── Activity summary (real data) ── */}
      {completed.length > 0 && (
        <ChartCard
          title="הפעילות שלי"
          subtitle="ייעוצים ב-6 החודשים האחרונים"
          hasData={activityData.some(d => d.count > 0)}
        >
          <AreaTrend data={activityData} dataKey="count" xKey="month" color={MED.blue} />
        </ChartCard>
      )}

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickActionCard
          color="blue"
          label="תור חדש"
          description="ייעוץ עם מומחה"
          onClick={() => router.push('/dashboard/patient/new-appointment')}
          icon={<svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" /></svg>}
        />
        <QuickActionCard
          color="emerald"
          label="התורים שלי"
          description="היסטוריה מלאה"
          onClick={() => router.push('/dashboard/patient/appointments')}
          icon={<svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>}
        />
        <QuickActionCard
          color="purple"
          label="המסמכים שלי"
          description="בדיקות ומסמכים"
          onClick={() => router.push('/dashboard/patient/my-documents')}
          icon={<svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
        />
        <QuickActionCard
          color="gray"
          label="הפרופיל שלי"
          description="נתונים רפואיים"
          onClick={() => router.push('/dashboard/patient/profile')}
          icon={<svg className="w-6 h-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
        />
      </div>
    </div>
  )
}

// ── Rate buttons ──────────────────────────────────────────

function RateButtons({ appointmentId, onRated }: { appointmentId: string; onRated: (id: string, r: number) => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = getClient()

  const rate = async (r: number) => {
    setSubmitting(true)
    await supabase.from('appointments').update({ patient_rating: r }).eq('id', appointmentId)
    onRated(appointmentId, r)
    setDone(true)
    setSubmitting(false)
  }

  if (done) return <span className="text-xs text-green-600 font-medium">תודה!</span>

  return (
    <div className="flex gap-1 shrink-0">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          disabled={submitting}
          onClick={() => rate(s)}
          className="text-xl text-slate-300 hover:text-yellow-400 transition-colors disabled:opacity-50"
          aria-label={`דרג ${s} כוכבים`}
        >★</button>
      ))}
    </div>
  )
}
