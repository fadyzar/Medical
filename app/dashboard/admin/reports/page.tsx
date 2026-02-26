'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardHeader, CardContent, StatCard, PageLoading, Select } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

type Period = '7d' | '30d' | '90d' | '12m'

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 ימים אחרונים' },
  { value: '30d', label: '30 ימים אחרונים' },
  { value: '90d', label: '90 ימים אחרונים' },
  { value: '12m', label: '12 חודשים אחרונים' },
]

const AI_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981']
const STATUS_COLORS_MAP: Record<string, string> = {
  completed: '#10B981', cancelled_patient: '#EF4444', cancelled_doctor: '#F97316',
  pending: '#F59E0B', scheduled: '#3B82F6', in_progress: '#8B5CF6',
}

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30d')
  const [orgId, setOrgId] = useState('')
  const [totals, setTotals] = useState({ revenue: 0, appointments: 0, completed: 0, aiCalls: 0, avgRating: 0 })
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([])
  const [appointmentData, setAppointmentData] = useState<{ date: string; count: number }[]>([])
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([])
  const [aiData, setAiData] = useState<{ name: string; value: number }[]>([])
  const [aiTokensData, setAiTokensData] = useState<{ date: string; tokens: number }[]>([])
  const supabase = getClient()

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (orgId) loadData(orgId)
  }, [period, orgId])

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return
      setOrgId(profile.organization_id)
    } catch {
      toast.error('שגיאה בטעינת נתוני הדוחות')
      setLoading(false)
    }
  }

  function getStartDate(): string {
    const now = new Date()
    switch (period) {
      case '7d': now.setDate(now.getDate() - 7); break
      case '30d': now.setDate(now.getDate() - 30); break
      case '90d': now.setDate(now.getDate() - 90); break
      case '12m': now.setMonth(now.getMonth() - 12); break
    }
    return now.toISOString()
  }

  async function loadData(oid: string) {
    setLoading(true)
    try {
    const startDate = getStartDate()

    const [aptsRes, aiRes] = await Promise.all([
      supabase.from('appointments')
        .select('id, status, payment_amount, payment_status, patient_rating, created_at, scheduled_at')
        .eq('organization_id', oid)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true }),
      supabase.from('ai_conversations')
        .select('id, agent_type, input_tokens, output_tokens, created_at')
        .eq('organization_id', oid)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true }),
    ])

    const apts = (aptsRes.data || []) as Array<{
      id: string; status: string; payment_amount: number | null
      payment_status: string | null; patient_rating: number | null
      created_at: string; scheduled_at: string | null
    }>
    const aiConvs = (aiRes.data || []) as Array<{
      id: string; agent_type: string; input_tokens: number
      output_tokens: number; created_at: string
    }>

    // Totals
    const completedApts = apts.filter(a => a.status === 'completed')
    const revenue = apts
      .filter(a => a.payment_status === 'completed' && a.payment_amount)
      .reduce((s, a) => s + (a.payment_amount || 0), 0)
    const ratings = completedApts.filter(a => a.patient_rating).map(a => a.patient_rating!)
    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0

    setTotals({
      revenue,
      appointments: apts.length,
      completed: completedApts.length,
      aiCalls: aiConvs.length,
      avgRating: Math.round(avgRating * 10) / 10,
    })

    // Revenue by date
    const revByDate = new Map<string, number>()
    apts.filter(a => a.payment_status === 'completed' && a.payment_amount).forEach(a => {
      const d = formatGroupDate(a.created_at)
      revByDate.set(d, (revByDate.get(d) || 0) + (a.payment_amount || 0))
    })
    setRevenueData(Array.from(revByDate.entries()).map(([date, revenue]) => ({ date, revenue })))

    // Appointments by date
    const aptByDate = new Map<string, number>()
    apts.forEach(a => {
      const d = formatGroupDate(a.created_at)
      aptByDate.set(d, (aptByDate.get(d) || 0) + 1)
    })
    setAppointmentData(Array.from(aptByDate.entries()).map(([date, count]) => ({ date, count })))

    // Status distribution
    const statusCounts = new Map<string, number>()
    apts.forEach(a => { statusCounts.set(a.status, (statusCounts.get(a.status) || 0) + 1) })
    const STATUS_LABELS: Record<string, string> = {
      completed: 'הושלם', cancelled_patient: 'בוטל ע"י מטופל', cancelled_doctor: 'בוטל ע"י רופא',
      pending: 'ממתין', scheduled: 'מתוזמן', in_progress: 'בתהליך',
      paid: 'שולם', doctor_confirmed: 'רופא אישר', ready: 'מוכן',
    }
    setStatusData(
      Array.from(statusCounts.entries())
        .map(([name, value]) => ({ name: STATUS_LABELS[name] || name, value, key: name }))
        .sort((a, b) => b.value - a.value)
    )

    // AI by agent type
    const aiTypeCounts = new Map<string, number>()
    const AI_LABELS: Record<string, string> = {
      triage: 'מיון דחיפות', summary: 'סיכום ייעוץ', prescription: 'טיוטת מרשם', intake: 'שאלון קליטה',
    }
    aiConvs.forEach(c => { aiTypeCounts.set(c.agent_type, (aiTypeCounts.get(c.agent_type) || 0) + 1) })
    setAiData(
      Array.from(aiTypeCounts.entries()).map(([name, value]) => ({ name: AI_LABELS[name] || name, value }))
    )

    // AI tokens over time
    const tokensByDate = new Map<string, number>()
    aiConvs.forEach(c => {
      const d = formatGroupDate(c.created_at)
      tokensByDate.set(d, (tokensByDate.get(d) || 0) + c.input_tokens + c.output_tokens)
    })
    setAiTokensData(Array.from(tokensByDate.entries()).map(([date, tokens]) => ({ date, tokens })))
    } catch {
      toast.error('שגיאה בטעינת נתוני הדוחות')
    } finally {
      setLoading(false)
    }
  }

  function formatGroupDate(dateStr: string): string {
    const d = new Date(dateStr)
    if (period === '12m') {
      return `${d.getMonth() + 1}/${d.getFullYear()}`
    }
    return `${d.getDate()}/${d.getMonth() + 1}`
  }

  if (loading && !orgId) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">דוחות וסטטיסטיקות</h2>
        <div className="w-48">
          <Select
            options={PERIOD_OPTIONS}
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="הכנסות" value={formatPrice(totals.revenue)} icon={<svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>} color="green" />
        <StatCard label="תורים" value={totals.appointments} icon={<svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} color="blue" />
        <StatCard label="הושלמו" value={totals.completed} icon={<svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} color="green" />
        <StatCard label="שימושי AI" value={totals.aiCalls} icon={<svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></svg>} color="purple" />
        <StatCard label="דירוג ממוצע" value={totals.avgRating || '-'} icon={<svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>} color="orange" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600" />
        </div>
      ) : (
        <>
          {/* Revenue Chart */}
          <Card>
            <CardHeader><h3 className="font-bold">הכנסות לפי תאריך</h3></CardHeader>
            <CardContent>
              {revenueData.length === 0 ? (
                <p className="text-center text-gray-400 py-8">אין נתוני הכנסות לתקופה זו</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₪${v}`} />
                    <Tooltip
                      formatter={(value: number) => [formatPrice(value), 'הכנסות']}
                      labelFormatter={l => `תאריך: ${l}`}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="הכנסות" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Appointments Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="font-bold">תורים לפי תאריך</h3></CardHeader>
              <CardContent>
                {appointmentData.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">אין נתוני תורים לתקופה זו</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={appointmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => [value, 'תורים']}
                        labelFormatter={l => `תאריך: ${l}`}
                      />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="תורים" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader><h3 className="font-bold">התפלגות סטטוסים</h3></CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">אין נתונים</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={STATUS_COLORS_MAP[(entry as { key?: string }).key || ''] || `hsl(${i * 45}, 70%, 60%)`}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'תורים']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="font-bold">שימוש ב-AI לפי סוג</h3></CardHeader>
              <CardContent>
                {aiData.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">אין נתוני AI לתקופה זו</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={aiData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {aiData.map((_, i) => (
                          <Cell key={i} fill={AI_COLORS[i % AI_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'קריאות']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-bold">צריכת טוקנים (AI)</h3></CardHeader>
              <CardContent>
                {aiTokensData.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">אין נתוני טוקנים לתקופה זו</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={aiTokensData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), 'טוקנים']}
                        labelFormatter={l => `תאריך: ${l}`}
                      />
                      <Line type="monotone" dataKey="tokens" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} name="טוקנים" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
