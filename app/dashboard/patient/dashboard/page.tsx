'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, StatCard, Badge, EmptyState, PageLoading } from '@/components/ui'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime } from '@/lib/utils'
import type { Appointment, User } from '@/types/database'

export default function PatientDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<User | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const [{ data: prof }, { data: apts }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('appointments').select('*, doctor:doctor_id(id, first_name, last_name, specialties, avatar_url)')
          .eq('patient_id', user.id).order('created_at', { ascending: false }).limit(20),
      ])

      if (prof) setProfile(prof as unknown as User)
      if (apts) setAppointments(apts as unknown as Appointment[])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <PageLoading />

  const active = appointments.filter(a => !['completed', 'cancelled_patient', 'cancelled_doctor'].includes(a.status))
  const completed = appointments.filter(a => a.status === 'completed')
  const nextApt = active.find(a => a.scheduled_at)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">שלום, {profile?.first_name} 👋</h2>
          <p className="text-gray-500 text-sm">מה נוכל לעזור לך היום?</p>
        </div>
        <Button onClick={() => router.push('/dashboard/patient/new-appointment')} size="lg">🩺 תור חדש</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="תורים פעילים" value={active.length} icon="📋" color="blue" />
        <StatCard label="הושלמו" value={completed.length} icon="✅" color="green" />
        <StatCard label="התור הבא" value={nextApt ? formatDateTime(nextApt.scheduled_at!) : 'אין'} icon="📅" color="purple" />
      </div>

      {/* Next appointment card */}
      {nextApt && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">התור הבא שלך</p>
              <p className="font-bold text-lg mt-1">{nextApt.chief_complaint}</p>
              {nextApt.doctor && <p className="text-sm text-gray-600">ד"ר {(nextApt.doctor as unknown as User).first_name} {(nextApt.doctor as unknown as User).last_name}</p>}
              <p className="text-sm text-gray-500 mt-1">{formatDateTime(nextApt.scheduled_at!)}</p>
            </div>
            {nextApt.status === 'payment_pending' && (
              <Button onClick={() => router.push(`/dashboard/patient/payment?id=${nextApt.id}`)} size="lg">שלם עכשיו</Button>
            )}
            {['ready', 'in_progress', 'scheduled'].includes(nextApt.status) && (
              <Button onClick={() => router.push(`/video-call?id=${nextApt.id}`)} size="lg" className="bg-green-600 hover:bg-green-700">הצטרף לשיחה</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Appointments list */}
      <Card>
        <CardHeader><h3 className="font-bold text-lg">התורים שלי</h3></CardHeader>
        {appointments.length === 0 ? (
          <EmptyState icon="📋" title="אין תורים עדיין" description="קבע תור חדש לייעוץ רפואי" action={<Button onClick={() => router.push('/dashboard/patient/new-appointment')}>קבע תור</Button>} />
        ) : (
          <div className="divide-y divide-gray-100">
            {appointments.map(apt => (
              <div key={apt.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium truncate">{apt.chief_complaint}</p>
                  {apt.doctor && <p className="text-sm text-gray-500">ד"ר {(apt.doctor as unknown as User).first_name} {(apt.doctor as unknown as User).last_name}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(apt.scheduled_at || apt.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={apt.status === 'completed' ? 'success' : apt.status.startsWith('cancelled') ? 'danger' : 'info'}>
                    {STATUS_LABELS[apt.status] || apt.status}
                  </Badge>
                  {apt.payment_amount && apt.payment_amount > 0 && (
                    <Badge variant={apt.payment_status === 'completed' ? 'success' : apt.payment_status === 'failed' ? 'danger' : 'warning'}>
                      {apt.payment_status === 'completed' ? '💳 שולם' : apt.payment_status === 'failed' ? '💳 נכשל' : '💳 ממתין'}
                    </Badge>
                  )}
                  {apt.status === 'payment_pending' && (
                    <Button size="sm" onClick={() => router.push(`/dashboard/patient/payment?id=${apt.id}`)}>שלם</Button>
                  )}
                  {apt.payment_status === 'failed' && (
                    <Button size="sm" onClick={() => router.push(`/dashboard/patient/payment?id=${apt.id}`)}>נסה שוב</Button>
                  )}
                  {['ready', 'in_progress', 'scheduled'].includes(apt.status) && (
                    <Button size="sm" onClick={() => router.push(`/video-call?id=${apt.id}`)} className="bg-green-600 hover:bg-green-700">הצטרף</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
