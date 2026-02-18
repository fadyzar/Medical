'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, StatCard, Badge, PageLoading, EmptyState } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatDate, formatPrice, cn, getInitials } from '@/lib/utils'
import type { Appointment, User, Organization } from '@/types/database'

// ── Types ──────────────────────────────────────────────

type DashAppointment = {
  id: string; status: string; chief_complaint: string
  scheduled_at: string | null; created_at: string
  payment_amount: number | null; payment_status: string | null
  ai_triage_score: number | null
  patient: { first_name: string; last_name: string } | null
  doctor: { first_name: string; last_name: string } | null
}

type DashDoctor = {
  id: string; first_name: string; last_name: string
  specialties: string[] | null; avatar_url: string | null
  average_rating: number | null; total_ratings: number
  is_active: boolean
}

type AuditEntry = {
  id: string; action: string; description: string | null
  created_at: string; user_id: string | null
  user?: { first_name: string; last_name: string } | null
}

// ── Component ──────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter()
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<Organization | null>(null)

  // Stats
  const [stats, setStats] = useState({
    users: 0, doctors: 0, patients: 0, staff: 0,
    totalAppointments: 0, completedAppointments: 0,
    pendingAppointments: 0, activeAppointments: 0,
    revenue: 0, aiUsage: 0,
  })

  // Lists
  const [recentApts, setRecentApts] = useState<DashAppointment[]>([])
  const [doctors, setDoctors] = useState<DashDoctor[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [todayApts, setTodayApts] = useState<DashAppointment[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('users')
        .select('organization_id, role')
        .eq('id', user.id)
        .single()

      if (!profile) return
      const typedProfile = profile as unknown as { organization_id: string; role: string }
      if (typedProfile.role !== 'admin') { router.push('/dashboard'); return }

      const orgId = typedProfile.organization_id

      // Parallel queries
      const [
        orgRes,
        usersCount, doctorsCount, patientsCount, staffCount,
        totalAptsCount, completedApts, pendingAptsCount,
        aiCount,
        recentRes, doctorsRes, auditRes,
      ] = await Promise.all([
        // Organization
        supabase.from('organizations').select('*').eq('id', orgId).single(),

        // Counts
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'doctor'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'patient'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'staff'),

        // Appointments
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('appointments').select('payment_amount').eq('organization_id', orgId).eq('status', 'completed'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),

        // AI
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),

        // Lists
        supabase.from('appointments')
          .select('id, status, chief_complaint, scheduled_at, created_at, payment_amount, payment_status, ai_triage_score, patient:patient_id(first_name, last_name), doctor:doctor_id(first_name, last_name)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase.from('users')
          .select('id, first_name, last_name, specialties, avatar_url, average_rating, total_ratings, is_active')
          .eq('organization_id', orgId)
          .eq('role', 'doctor')
          .order('average_rating', { ascending: false, nullsFirst: false }),
        supabase.from('audit_logs')
          .select('id, action, description, created_at, user_id')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      if (orgRes.data) setOrg(orgRes.data as unknown as Organization)

      const completedData = completedApts.data || []
      const revenue = completedData.reduce((sum: number, a: Record<string, unknown>) => sum + ((a.payment_amount as number) || 0), 0)

      // Active = everything that's not completed, cancelled, or no-show
      const activeStatuses = ['doctor_confirmed', 'time_selected', 'paid', 'scheduled', 'ready', 'in_progress']
      const allApts = (recentRes.data || []) as unknown as DashAppointment[]
      const activeCount = allApts.filter(a => activeStatuses.includes(a.status)).length

      setStats({
        users: usersCount.count || 0,
        doctors: doctorsCount.count || 0,
        patients: patientsCount.count || 0,
        staff: staffCount.count || 0,
        totalAppointments: totalAptsCount.count || 0,
        completedAppointments: completedData.length,
        pendingAppointments: pendingAptsCount.count || 0,
        activeAppointments: activeCount,
        revenue,
        aiUsage: aiCount.count || 0,
      })

      setRecentApts(allApts)
      setDoctors((doctorsRes.data || []) as unknown as DashDoctor[])
      setAuditLog((auditRes.data || []) as unknown as AuditEntry[])

      // Filter today's appointments
      const today = new Date().toDateString()
      setTodayApts(allApts.filter(a => {
        const d = a.scheduled_at || a.created_at
        return new Date(d).toDateString() === today
      }))
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageLoading />

  // ── Derived data ─────────────────────────────────────

  const getBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (status === 'completed') return 'success'
    if (status === 'pending') return 'warning'
    if (status.startsWith('cancelled') || status.startsWith('no_show')) return 'danger'
    return 'info'
  }

  // Usage percentages
  const doctorsPercent = org ? Math.min(Math.round((org.current_doctors / org.max_doctors) * 100), 100) : 0
  const aptsPercent = org ? Math.min(Math.round((org.current_month_appointments / org.max_appointments_per_month) * 100), 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">ניהול מרפאה</h2>
          <p className="text-sm text-gray-500">{org?.name || 'מרפאה'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/admin/reports')}>
            דוחות
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/admin/settings')}>
            הגדרות
          </Button>
        </div>
      </div>

      {/* Subscription alert */}
      {org && (org.subscription_status === 'suspended' || org.subscription_status === 'cancelled') && (
        <div className={cn(
          'p-4 rounded-lg border',
          org.subscription_status === 'suspended'
            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
            : 'bg-red-50 border-red-200 text-red-800'
        )}>
          <div className="flex items-center justify-between">
            <p className="font-medium">
              {org.subscription_status === 'suspended'
                ? 'המנוי מושעה — יש לעדכן את אמצעי התשלום'
                : 'המנוי בוטל — חלק מהתכונות אינן זמינות'}
            </p>
            <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/admin/billing')}>
              ניהול חיוב
            </Button>
          </div>
        </div>
      )}

      {/* KPI Stats - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="משתמשים" value={stats.users} icon="👥" color="blue" />
        <StatCard label="רופאים" value={stats.doctors} icon="👨‍⚕️" color="purple" />
        <StatCard label="מטופלים" value={stats.patients} icon="🧑" color="blue" />
        <StatCard label="תורים" value={stats.totalAppointments} icon="📋" color="orange" />
        <StatCard label="הכנסות" value={formatPrice(stats.revenue)} icon="💰" color="green" />
        <StatCard label="AI שימושים" value={stats.aiUsage} icon="🤖" color="purple" />
      </div>

      {/* KPI Stats - Row 2: Operational */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ממתינים לאישור" value={stats.pendingAppointments} icon="⏳" color="orange" />
        <StatCard label="תורים פעילים" value={stats.activeAppointments} icon="🩺" color="blue" />
        <StatCard label="הושלמו" value={stats.completedAppointments} icon="✅" color="green" />
        <StatCard label="היום" value={todayApts.length} icon="📅" color="purple" />
      </div>

      {/* Usage meters + Today's schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan usage */}
        {org && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">שימוש בתוכנית</h3>
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/billing')}>
                  פרטים
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Doctors usage */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">רופאים</span>
                  <span className="font-medium">{org.current_doctors} / {org.max_doctors}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      doctorsPercent >= 90 ? 'bg-red-500' : doctorsPercent >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${doctorsPercent}%` }}
                  />
                </div>
              </div>

              {/* Appointments usage */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">תורים החודש</span>
                  <span className="font-medium">{org.current_month_appointments.toLocaleString()} / {org.max_appointments_per_month.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      aptsPercent >= 90 ? 'bg-red-500' : aptsPercent >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${aptsPercent}%` }}
                  />
                </div>
              </div>

              {/* Storage */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">אחסון</span>
                  <span className="font-medium">{org.current_storage_gb} GB / {org.max_storage_gb} GB</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-blue-500"
                    style={{ width: `${Math.min(Math.round((org.current_storage_gb / org.max_storage_gb) * 100), 100)}%` }}
                  />
                </div>
              </div>

              {/* Trial notice */}
              {org.subscription_status === 'trial' && org.trial_ends_at && (
                <p className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                  תקופת הניסיון מסתיימת ב-{new Date(org.trial_ends_at).toLocaleDateString('he-IL')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Today's schedule */}
        <Card>
          <CardHeader>
            <h3 className="font-bold text-lg">לוח זמנים להיום ({todayApts.length})</h3>
          </CardHeader>
          {todayApts.length === 0 ? (
            <EmptyState icon="📅" title="אין תורים היום" />
          ) : (
            <div className="divide-y max-h-64 overflow-y-auto">
              {todayApts.map(apt => (
                <div key={apt.id} className="px-6 py-3 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {apt.patient?.first_name} {apt.patient?.last_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {apt.doctor ? `ד"ר ${apt.doctor.first_name} ${apt.doctor.last_name}` : 'ללא רופא'}
                      {apt.scheduled_at && ` · ${new Date(apt.scheduled_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <Badge variant={getBadgeVariant(apt.status)}>
                    {STATUS_LABELS[apt.status] || apt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Doctors + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctors overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">רופאים ({doctors.length})</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/users')}>
                ניהול
              </Button>
            </div>
          </CardHeader>
          {doctors.length === 0 ? (
            <EmptyState icon="👨‍⚕️" title="אין רופאים" description="הזמינו רופאים דרך ניהול משתמשים" />
          ) : (
            <div className="divide-y max-h-72 overflow-y-auto">
              {doctors.map(doc => (
                <div key={doc.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {doc.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                        {getInitials(doc.first_name, doc.last_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">ד&quot;ר {doc.first_name} {doc.last_name}</p>
                      {doc.specialties && doc.specialties.length > 0 && (
                        <p className="text-xs text-gray-400 truncate">{doc.specialties.join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.average_rating ? (
                      <span className="text-xs text-yellow-600 font-medium">
                        ⭐ {doc.average_rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">ללא דירוג</span>
                    )}
                    {!doc.is_active && (
                      <Badge variant="danger">לא פעיל</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">פעילות אחרונה</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/audit-log')}>
                יומן מלא
              </Button>
            </div>
          </CardHeader>
          <div className="divide-y max-h-72 overflow-y-auto">
            {recentApts.slice(0, 10).map(apt => (
              <div key={apt.id} className="px-6 py-3 text-sm hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="font-medium">{apt.patient?.first_name} {apt.patient?.last_name}</span>
                    <span className="text-gray-400 mx-1.5">→</span>
                    <span className="text-gray-600">
                      {apt.doctor ? `ד"ר ${apt.doctor.first_name} ${apt.doctor.last_name}` : 'ממתין לרופא'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {apt.ai_triage_score != null && (
                      <span className={cn(
                        'text-xs px-1 py-0.5 rounded',
                        apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                        apt.ai_triage_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {apt.ai_triage_score}
                      </span>
                    )}
                    <Badge variant={getBadgeVariant(apt.status)}>
                      {STATUS_LABELS[apt.status] || apt.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{formatDateTime(apt.created_at)}</span>
                  {apt.payment_amount != null && apt.payment_amount > 0 && (
                    <span className="text-xs text-green-600">{formatPrice(apt.payment_amount)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Audit log */}
      {auditLog.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">יומן פעילות</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/audit-log')}>
                הכל
              </Button>
            </div>
          </CardHeader>
          <div className="divide-y">
            {auditLog.map(entry => (
              <div key={entry.id} className="px-6 py-3 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-gray-700 truncate">{entry.description || entry.action}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {formatDateTime(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'משתמשים', icon: '👥', href: '/dashboard/admin/users' },
          { label: 'שאלונים', icon: '📝', href: '/dashboard/admin/questionnaires' },
          { label: 'דוחות', icon: '📊', href: '/dashboard/admin/reports' },
          { label: 'יומן פעילות', icon: '📜', href: '/dashboard/admin/audit-log' },
          { label: 'הגדרות', icon: '⚙️', href: '/dashboard/admin/settings' },
          { label: 'חיוב ומנוי', icon: '💳', href: '/dashboard/admin/billing' },
        ].map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
          >
            <span className="text-2xl block mb-1" aria-hidden="true">{item.icon}</span>
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
