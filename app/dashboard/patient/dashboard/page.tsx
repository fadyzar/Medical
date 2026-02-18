'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, StatCard, Badge, EmptyState, PageLoading } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatDate, cn, getInitials } from '@/lib/utils'
import type { Appointment, User, Document } from '@/types/database'

// ── Types ──────────────────────────────────────────────

type DoctorInfo = Pick<User, 'id' | 'first_name' | 'last_name' | 'specialties' | 'avatar_url' | 'average_rating' | 'total_ratings'>

type PatientAppointment = Appointment & {
  doctor: DoctorInfo | null
}

// ── Helpers ────────────────────────────────────────────

function getTimeUntil(dateStr: string): string {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) return 'עכשיו'

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `בעוד ${days} ${days === 1 ? 'יום' : 'ימים'}`
  if (hours > 0) return `בעוד ${hours} ${hours === 1 ? 'שעה' : 'שעות'}`
  return `בעוד ${minutes} דקות`
}

function getProfileCompletion(profile: User): { percent: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!profile.first_name, 'שם פרטי'],
    [!!profile.last_name, 'שם משפחה'],
    [!!profile.phone, 'טלפון'],
    [!!profile.date_of_birth, 'תאריך לידה'],
    [!!profile.gender, 'מגדר'],
    [!!profile.avatar_url, 'תמונת פרופיל'],
    [(profile.medical_history?.allergies?.length ?? 0) > 0 || (profile.medical_history?.chronic_conditions?.length ?? 0) > 0, 'היסטוריה רפואית'],
    [!!profile.emergency_contact?.name && !!profile.emergency_contact?.phone, 'איש קשר לחירום'],
    [!!profile.insurance_info?.provider, 'פרטי ביטוח'],
  ]
  const done = checks.filter(([ok]) => ok).length
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label)
  return { percent: Math.round((done / checks.length) * 100), missing }
}

// ── Component ──────────────────────────────────────────

export default function PatientDashboard() {
  const router = useRouter()
  const supabase = getClient()

  const [profile, setProfile] = useState<User | null>(null)
  const [appointments, setAppointments] = useState<PatientAppointment[]>([])
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const [{ data: prof }, { data: apts }, { data: docs }] = await Promise.all([
          supabase.from('users').select('*').eq('id', user.id).single(),
          supabase.from('appointments')
            .select('*, doctor:doctor_id(id, first_name, last_name, specialties, avatar_url, average_rating, total_ratings)')
            .eq('patient_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('documents')
            .select('*')
            .eq('patient_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        if (prof) setProfile(prof as unknown as User)
        if (apts) setAppointments(apts as unknown as PatientAppointment[])
        if (docs) setRecentDocs(docs as unknown as Document[])
      } catch {
        // Error boundary will handle rendering errors; this prevents infinite loading
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  if (loading) return <PageLoading />
  if (!profile) return null

  const now = new Date()
  const active = appointments.filter(a =>
    !['completed', 'cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor'].includes(a.status)
  )
  const completed = appointments.filter(a => a.status === 'completed')
  const cancelled = appointments.filter(a =>
    a.status.startsWith('cancelled') || a.status.startsWith('no_show')
  )

  // Find the closest upcoming scheduled appointment
  const upcoming = active
    .filter(a => a.scheduled_at && new Date(a.scheduled_at) > now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  const nextApt = upcoming[0] || null

  // Appointments needing action (payment, etc.)
  const needsAction = active.filter(a =>
    a.status === 'payment_pending' || a.payment_status === 'failed'
  )

  // Profile completion
  const { percent: profilePercent, missing: profileMissing } = getProfileCompletion(profile)

  // Recent completed with rating opportunity
  const unrated = completed.filter(a => a.patient_rating == null).slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">שלום, {profile.first_name} 👋</h2>
          <p className="text-gray-500 text-sm">מה נוכל לעזור לך היום?</p>
        </div>
        <Button onClick={() => router.push('/dashboard/patient/new-appointment')} size="lg">
          קבע תור חדש
        </Button>
      </div>

      {/* Profile completion banner */}
      {profilePercent < 100 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#dbeafe" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2563eb" strokeWidth="3"
                    strokeDasharray={`${profilePercent}, 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600">
                  {profilePercent}%
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">השלם את הפרופיל שלך</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  חסר: {profileMissing.slice(0, 3).join(', ')}
                  {profileMissing.length > 3 && ` ועוד ${profileMissing.length - 3}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/patient/profile')}>
                השלם פרופיל
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="תורים פעילים" value={active.length} icon="📋" color="blue" />
        <StatCard label="הושלמו" value={completed.length} icon="✅" color="green" />
        <StatCard label="מסמכים" value={recentDocs.length > 0 ? `${recentDocs.length}+` : '0'} icon="📄" color="purple" />
        <StatCard
          label="התור הבא"
          value={nextApt ? getTimeUntil(nextApt.scheduled_at!) : 'אין'}
          icon="📅"
          color="orange"
        />
      </div>

      {/* Needs action */}
      {needsAction.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="bg-orange-50">
            <h3 className="font-bold text-orange-800">דורש פעולה ({needsAction.length})</h3>
          </CardHeader>
          <div className="divide-y">
            {needsAction.map(apt => (
              <div key={apt.id} className="px-6 py-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{apt.chief_complaint}</p>
                  <p className="text-sm text-gray-500">
                    {apt.payment_status === 'failed' ? 'התשלום נכשל — יש לנסות שוב' : 'ממתין לתשלום'}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push(`/dashboard/patient/payment?id=${apt.id}`)}
                  className={apt.payment_status === 'failed' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  {apt.payment_status === 'failed' ? 'נסה שוב' : 'שלם עכשיו'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Next appointment hero */}
      {nextApt && (
        <Card className="border-blue-200 overflow-hidden">
          <div className="bg-gradient-to-l from-blue-600 to-blue-700 px-6 py-5 text-white">
            <p className="text-sm text-blue-100 font-medium">התור הבא שלך</p>
            <p className="text-xl font-bold mt-1">{nextApt.chief_complaint}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-blue-100">
                {formatDateTime(nextApt.scheduled_at!)}
              </span>
              <Badge variant="info" className="bg-white/20 text-white border-0">
                {getTimeUntil(nextApt.scheduled_at!)}
              </Badge>
            </div>
          </div>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              {nextApt.doctor ? (
                <div className="flex items-center gap-3">
                  {(nextApt.doctor as unknown as DoctorInfo).avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(nextApt.doctor as unknown as DoctorInfo).avatar_url!}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                      {getInitials(
                        (nextApt.doctor as unknown as DoctorInfo).first_name,
                        (nextApt.doctor as unknown as DoctorInfo).last_name
                      )}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">ד&quot;ר {(nextApt.doctor as unknown as DoctorInfo).first_name} {(nextApt.doctor as unknown as DoctorInfo).last_name}</p>
                    {(nextApt.doctor as unknown as DoctorInfo).average_rating && (
                      <p className="text-xs text-gray-400">
                        ⭐ {(nextApt.doctor as unknown as DoctorInfo).average_rating!.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">ממתין לשיוך רופא</p>
              )}
              <div className="flex gap-2">
                {nextApt.status === 'payment_pending' && (
                  <Button onClick={() => router.push(`/dashboard/patient/payment?id=${nextApt.id}`)}>
                    שלם עכשיו
                  </Button>
                )}
                {['ready', 'in_progress', 'scheduled'].includes(nextApt.status) && (
                  <Button
                    onClick={() => router.push(`/video-call?id=${nextApt.id}`)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    הצטרף לשיחה
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming appointments */}
      {upcoming.length > 1 && (
        <Card>
          <CardHeader>
            <h3 className="font-bold text-lg">תורים קרובים</h3>
          </CardHeader>
          <div className="divide-y">
            {upcoming.slice(1).map(apt => {
              const doc = apt.doctor as unknown as DoctorInfo | null
              return (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {doc ? (
                      doc.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={doc.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                          {getInitials(doc.first_name, doc.last_name)}
                        </div>
                      )
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 shrink-0">?</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{apt.chief_complaint}</p>
                      <p className="text-xs text-gray-400">
                        {doc ? `ד"ר ${doc.first_name} ${doc.last_name}` : 'ממתין לרופא'}
                        {' · '}
                        {formatDateTime(apt.scheduled_at!)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="info">{STATUS_LABELS[apt.status]}</Badge>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Active (non-scheduled) appointments */}
      {active.filter(a => !a.scheduled_at || new Date(a.scheduled_at) <= now).length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-bold text-lg">בתהליך</h3>
          </CardHeader>
          <div className="divide-y">
            {active.filter(a => !a.scheduled_at || new Date(a.scheduled_at) <= now).map(apt => {
              const doc = apt.doctor as unknown as DoctorInfo | null
              return (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{apt.chief_complaint}</p>
                    <p className="text-xs text-gray-400">
                      {doc ? `ד"ר ${doc.first_name} ${doc.last_name}` : 'ממתין לרופא'}
                      {' · '}
                      {formatDateTime(apt.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={apt.status === 'pending' ? 'warning' : 'info'}>
                      {STATUS_LABELS[apt.status]}
                    </Badge>
                    {['ready', 'in_progress'].includes(apt.status) && (
                      <Button size="sm" onClick={() => router.push(`/video-call?id=${apt.id}`)} className="bg-green-600 hover:bg-green-700">
                        הצטרף
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Rate your visits */}
      {unrated.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="bg-yellow-50">
            <h3 className="font-bold text-yellow-800">דרג את הביקור שלך</h3>
          </CardHeader>
          <div className="divide-y">
            {unrated.map(apt => {
              const doc = apt.doctor as unknown as DoctorInfo | null
              return (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{apt.chief_complaint}</p>
                    <p className="text-sm text-gray-500">
                      {doc ? `ד"ר ${doc.first_name} ${doc.last_name}` : ''}
                      {apt.completed_at && ` · ${formatDate(apt.completed_at)}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map(star => (
                      <RateButton key={star} appointmentId={apt.id} rating={star} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Recent completed */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">ביקורים אחרונים</h3>
              <span className="text-sm text-gray-400">{completed.length} הושלמו</span>
            </div>
          </CardHeader>
          <div className="divide-y">
            {completed.slice(0, 5).map(apt => {
              const doc = apt.doctor as unknown as DoctorInfo | null
              return (
                <div key={apt.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{apt.chief_complaint}</p>
                      <p className="text-xs text-gray-400">
                        {doc ? `ד"ר ${doc.first_name} ${doc.last_name}` : ''}
                        {apt.completed_at && ` · ${formatDate(apt.completed_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {apt.patient_rating && (
                        <span className="text-sm text-yellow-600">
                          {'★'.repeat(apt.patient_rating)}{'☆'.repeat(5 - apt.patient_rating)}
                        </span>
                      )}
                      <Badge variant="success">הושלם</Badge>
                    </div>
                  </div>
                  {/* Summary highlights */}
                  {(apt.diagnosis || apt.follow_up_instructions) && (
                    <div className="mt-2 text-sm space-y-0.5">
                      {apt.diagnosis && (
                        <p className="text-gray-600"><span className="font-medium text-gray-700">אבחנה:</span> {apt.diagnosis}</p>
                      )}
                      {apt.follow_up_instructions && (
                        <p className="text-gray-600"><span className="font-medium text-gray-700">מעקב:</span> {apt.follow_up_instructions}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Recent documents */}
      {recentDocs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">מסמכים אחרונים</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/patient/my-documents')}>
                כל המסמכים
              </Button>
            </div>
          </CardHeader>
          <div className="divide-y">
            {recentDocs.map(doc => (
              <div key={doc.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0">
                    {doc.file_type?.includes('pdf') ? '📕' : doc.file_type?.includes('image') ? '🖼️' : '📄'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
                  </div>
                </div>
                {doc.category && (
                  <Badge variant="default">{doc.category}</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state when no appointments at all */}
      {appointments.length === 0 && (
        <Card>
          <EmptyState
            icon="🩺"
            title="ברוך הבא לטלמדיסן!"
            description="קבע תור ראשון לייעוץ רפואי אונליין עם רופא מומחה"
            action={
              <Button onClick={() => router.push('/dashboard/patient/new-appointment')} size="lg">
                קבע תור ראשון
              </Button>
            }
          />
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => router.push('/dashboard/patient/new-appointment')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
        >
          <span className="text-2xl block mb-1" aria-hidden="true">🩺</span>
          <span className="text-sm font-medium text-gray-700">תור חדש</span>
        </button>
        <button
          onClick={() => router.push('/dashboard/patient/my-documents')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
        >
          <span className="text-2xl block mb-1" aria-hidden="true">📄</span>
          <span className="text-sm font-medium text-gray-700">המסמכים שלי</span>
        </button>
        <button
          onClick={() => router.push('/dashboard/patient/profile')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
        >
          <span className="text-2xl block mb-1" aria-hidden="true">👤</span>
          <span className="text-sm font-medium text-gray-700">הפרופיל שלי</span>
        </button>
        <button
          onClick={() => router.push('/doctors')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
        >
          <span className="text-2xl block mb-1" aria-hidden="true">👨‍⚕️</span>
          <span className="text-sm font-medium text-gray-700">הרופאים שלנו</span>
        </button>
      </div>
    </div>
  )
}

// ── Rate Button ────────────────────────────────────────

function RateButton({ appointmentId, rating }: { appointmentId: string; rating: number }) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = getClient()

  const handleRate = async () => {
    setSubmitting(true)
    await supabase.from('appointments')
      .update({ patient_rating: rating })
      .eq('id', appointmentId)
    setSubmitting(false)
    setDone(true)
  }

  if (done) return <span className="text-yellow-400 text-lg">★</span>

  return (
    <button
      onClick={handleRate}
      disabled={submitting}
      className="text-gray-300 hover:text-yellow-400 text-lg transition-colors disabled:opacity-50"
      aria-label={`דרג ${rating} כוכבים`}
    >
      ★
    </button>
  )
}
