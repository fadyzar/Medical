'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Input, Badge, PageLoading, EmptyState, Select } from '@/components/ui'
import { STATUS_LABELS, formatDateTime } from '@/lib/utils'
import type { AppointmentStatus } from '@/types/database'

export default function StaffDashboard() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = getClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    if (!profile) return

    const { data } = await supabase.from('appointments')
      .select('*, patient:patient_id(first_name, last_name, phone, email), doctor:doctor_id(first_name, last_name)')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }).limit(50)

    setAppointments(data || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    await supabase.from('appointments').update({ status }).eq('id', id)
    loadData()
  }

  if (loading) return <PageLoading />

  const filtered = search
    ? appointments.filter(a => {
        const p = a.patient
        const q = search.toLowerCase()
        return p?.first_name?.toLowerCase().includes(q) || p?.last_name?.toLowerCase().includes(q) || p?.phone?.includes(q)
      })
    : appointments

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">פאנל שירות</h2>
      <Input placeholder="🔍 חפש מטופל (שם/טלפון)" value={search} onChange={e => setSearch(e.target.value)} />
      <Card>
        <CardHeader><h3 className="font-bold">תורים ({filtered.length})</h3></CardHeader>
        {filtered.length === 0 ? <EmptyState icon="📋" title="אין תוצאות" /> : (
          <div className="divide-y">
            {filtered.map(apt => (
              <div key={apt.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{apt.patient?.first_name} {apt.patient?.last_name}</p>
                  <p className="text-sm text-gray-500">{apt.chief_complaint}</p>
                  <p className="text-xs text-gray-400">{apt.patient?.phone} · {formatDateTime(apt.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={apt.status === 'completed' ? 'success' : 'info'}>{STATUS_LABELS[apt.status] || apt.status}</Badge>
                  {apt.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(apt.id, 'cancelled_patient')}>ביטול</Button>
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
