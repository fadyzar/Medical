'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, StatCard, PageLoading, Badge } from '@/components/ui'
import { formatDateTime, formatPrice } from '@/lib/utils'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, doctors: 0, appointments: 0, completed: 0, revenue: 0, aiUsage: 0 })
  const [recentApts, setRecentApts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return
      const orgId = profile.organization_id

      const [users, doctors, apts, completedApts, aiConvs, recent] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'doctor'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('appointments').select('payment_amount').eq('organization_id', orgId).eq('status', 'completed'),
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('appointments')
          .select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(first_name, last_name)')
          .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(10),
      ])

      const revenue = (completedApts.data || []).reduce((s: number, a: any) => s + (a.payment_amount || 0), 0)

      setStats({
        users: users.count || 0,
        doctors: doctors.count || 0,
        appointments: apts.count || 0,
        completed: (completedApts.data || []).length,
        revenue,
        aiUsage: aiConvs.count || 0,
      })
      setRecentApts(recent.data || [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ניהול מרפאה</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="משתמשים" value={stats.users} icon="👥" color="blue" />
        <StatCard label="רופאים" value={stats.doctors} icon="👨‍⚕️" color="purple" />
        <StatCard label="תורים" value={stats.appointments} icon="📋" color="orange" />
        <StatCard label="הושלמו" value={stats.completed} icon="✅" color="green" />
        <StatCard label="הכנסות" value={formatPrice(stats.revenue)} icon="💰" color="green" />
        <StatCard label="AI שימושים" value={stats.aiUsage} icon="🤖" color="purple" />
      </div>

      <Card>
        <CardHeader><h3 className="font-bold">פעילות אחרונה</h3></CardHeader>
        <div className="divide-y">
          {recentApts.map((apt: any) => (
            <div key={apt.id} className="px-6 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{apt.patient?.first_name} {apt.patient?.last_name}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span>{apt.doctor ? `ד"ר ${apt.doctor.first_name} ${apt.doctor.last_name}` : 'ממתין לרופא'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={apt.status === 'completed' ? 'success' : 'info'}>{apt.status}</Badge>
                <span className="text-xs text-gray-400">{formatDateTime(apt.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
