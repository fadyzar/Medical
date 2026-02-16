'use client'

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
  const supabase = getClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
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
    setLoading(false)
  }

  const confirmAppointment = async (id: string) => {
    await supabase.from('appointments').update({ status: 'doctor_confirmed', doctor_accepted_at: new Date().toISOString() }).eq('id', id)
    loadData()
  }

  const generateAISummary = async (id: string) => {
    setAiLoading(id)
    try {
      const res = await fetch('/api/ai-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: id, action: 'summary' }) })
      if (res.ok) loadData()
    } catch { /* */ }
    finally { setAiLoading(null) }
  }

  if (loading) return <PageLoading />

  const pending = appointments.filter(a => a.status === 'pending')
  const active = appointments.filter(a => ['doctor_confirmed', 'scheduled', 'ready', 'in_progress'].includes(a.status))
  const today = appointments.filter(a => a.scheduled_at && new Date(a.scheduled_at).toDateString() === new Date().toDateString())
  const completed = appointments.filter(a => a.status === 'completed')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">שלום, ד"ר {profile?.first_name} 👋</h2>
        <p className="text-gray-500 text-sm">{profile?.specialties?.join(', ')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ממתינים" value={pending.length} icon="⏳" color="orange" />
        <StatCard label="היום" value={today.length} icon="📅" color="blue" />
        <StatCard label="פעילים" value={active.length} icon="🩺" color="green" />
        <StatCard label="דירוג" value={profile?.average_rating ? `⭐ ${profile.average_rating.toFixed(1)}` : '—'} icon="⭐" color="purple" />
      </div>

      {/* Pending Appointments */}
      {pending.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="bg-orange-50"><h3 className="font-bold text-orange-800">⏳ ממתינים לאישור ({pending.length})</h3></CardHeader>
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
                      <Button size="sm" onClick={() => confirmAppointment(apt.id)}>✅ אשר</Button>
                      <Button size="sm" variant="outline" onClick={() => router.push(`/doctor/appointments?id=${apt.id}`)}>פרטים</Button>
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
          <EmptyState icon="📋" title="אין תורים פעילים" />
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
                      <Button size="sm" onClick={() => router.push(`/video-call?id=${apt.id}`)} className="bg-green-600 hover:bg-green-700">🎥 וידאו</Button>
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
          <CardHeader><h3 className="font-bold text-lg">🤖 ממתינים לסיכום AI</h3></CardHeader>
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
