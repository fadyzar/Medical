'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, StatCard, Badge, PageLoading, EmptyState } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, cn } from '@/lib/utils'
import type { Appointment, User } from '@/types/database'

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

  const pending = appointments.filter(a => a.status === 'pending')
  const active = appointments.filter(a => ['doctor_confirmed', 'scheduled', 'ready', 'in_progress'].includes(a.status))
  const today = appointments.filter(a => a.scheduled_at && new Date(a.scheduled_at).toDateString() === new Date().toDateString())
  const completed = appointments.filter(a => a.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">סקירה כללית</h2>
          {profile?.specialties && profile.specialties.length > 0 && (
            <p className="text-sm text-gray-500">{profile.specialties.join(', ')}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg text-sm',
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        )} role="status">
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ממתינים" value={pending.length} icon={<svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} color="orange" />
        <StatCard label="היום" value={today.length} icon={<svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} color="blue" />
        <StatCard label="פעילים" value={active.length} icon={<svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>} color="green" />
        <StatCard label="דירוג" value={profile?.average_rating ? profile.average_rating.toFixed(1) : '—'} icon={<svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>} color="purple" />
      </div>

      {/* Pending Appointments */}
      {pending.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="bg-orange-50"><h3 className="font-bold text-orange-800 flex items-center gap-2"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> ממתינים לאישור ({pending.length})</h3></CardHeader>
          <div className="divide-y">
            {pending.map(apt => {
              const patient = apt.patient as unknown as User
              return (
                <div key={apt.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold">{patient?.first_name} {patient?.last_name}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{apt.chief_complaint}</p>
                      {apt.complaint_description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{apt.complaint_description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        {apt.ai_triage_score != null && (
                          <Badge variant={apt.ai_triage_score >= 7 ? 'danger' : apt.ai_triage_score >= 4 ? 'warning' : 'success'}>
                            דחיפות: {apt.ai_triage_score}/10
                          </Badge>
                        )}
                        {apt.ai_triage_category && <span className="text-xs text-gray-500">{apt.ai_triage_category}</span>}
                        <span className="text-xs text-gray-400">{formatDateTime(apt.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" loading={confirmingId === apt.id} onClick={() => confirmAppointment(apt.id)}>אשר</Button>
                      <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/doctor/appointments?id=${apt.id}`)}>פרטים</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Active / Upcoming */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-bold text-lg">תורים פעילים</h3>
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/doctor/appointments')}>הכל →</Button>
        </CardHeader>
        {active.length === 0 ? (
          <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>} title="אין תורים פעילים" />
        ) : (
          <div className="divide-y">
            {active.map(apt => {
              const patient = apt.patient as unknown as User
              return (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{patient?.first_name} {patient?.last_name}</p>
                    <p className="text-sm text-gray-500">{apt.chief_complaint}</p>
                    {apt.scheduled_at && <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(apt.scheduled_at)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{STATUS_LABELS[apt.status]}</Badge>
                    {['ready', 'in_progress', 'scheduled'].includes(apt.status) && (
                      <Button size="sm" onClick={() => router.push(`/video-call?id=${apt.id}`)} className="bg-green-600 hover:bg-green-700">שיחת וידאו</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Recent Completed (need AI summary) */}
      {completed.filter(a => !a.ai_summary).length > 0 && (
        <Card>
          <CardHeader><h3 className="font-bold text-lg">ממתינים לסיכום AI</h3></CardHeader>
          <div className="divide-y">
            {completed.filter(a => !a.ai_summary).slice(0, 5).map(apt => {
              const patient = apt.patient as unknown as User
              return (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{patient?.first_name} {patient?.last_name}</p>
                    <p className="text-sm text-gray-500">{apt.chief_complaint}</p>
                  </div>
                  <Button size="sm" variant="outline" loading={aiLoading === apt.id} onClick={() => generateAISummary(apt.id)}>צור סיכום AI</Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
