'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Card, CardContent, CardHeader, StatCard, Badge, PageLoading, EmptyState } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatPrice, cn, getInitials } from '@/lib/utils'
import type { Organization } from '@/types/database'

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

// ── Helpers ────────────────────────────────────────────

const getBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (status === 'completed') return 'success'
  if (status === 'pending') return 'warning'
  if (status.startsWith('cancelled') || status.startsWith('no_show')) return 'danger'
  return 'info'
}

const AUDIT_ICON: Record<string, string> = {
  create: '＋',
  update: '✎',
  delete: '✕',
  login: '→',
  logout: '←',
}

const getAuditIcon = (action: string) => {
  const key = Object.keys(AUDIT_ICON).find(k => action.toLowerCase().includes(k))
  return key ? AUDIT_ICON[key] : '•'
}

const getAuditDotColor = (action: string) => {
  if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('cancel')) return 'bg-red-400'
  if (action.toLowerCase().includes('create') || action.toLowerCase().includes('add')) return 'bg-green-400'
  if (action.toLowerCase().includes('update') || action.toLowerCase().includes('edit')) return 'bg-blue-400'
  return 'bg-gray-400'
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'ניסיון',
  free: 'חינמי',
  basic: 'בסיסי',
  pro: 'מקצועי',
  enterprise: 'ארגוני',
}

// ── Icons (inline SVGs) ────────────────────────────────

const IconUsers = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
)
const IconDoctor = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1" />
    <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" />
  </svg>
)
const IconPatient = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)
const IconCalendar = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const IconMoney = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
)
const IconAI = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" />
    <circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
  </svg>
)
const IconClock = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)
const IconCheck = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)
const IconStar = ({ filled }: { filled?: boolean }) => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

// ── Component ──────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter()
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<Organization | null>(null)

  const [stats, setStats] = useState({
    users: 0, doctors: 0, patients: 0, staff: 0,
    totalAppointments: 0, completedAppointments: 0,
    pendingAppointments: 0, activeAppointments: 0,
    revenue: 0, aiUsage: 0,
  })

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
      if (typedProfile.role !== 'admin') {
        const roleHome: Record<string, string> = { doctor: '/dashboard/doctor/dashboard', patient: '/dashboard/patient/dashboard', staff: '/dashboard/staff/dashboard' }
        router.push(roleHome[typedProfile.role] || '/dashboard/patient/dashboard')
        return
      }

      const orgId = typedProfile.organization_id

      const [
        orgRes,
        usersCount, doctorsCount, patientsCount, staffCount,
        totalAptsCount, completedApts, pendingAptsCount, activeAptsCount,
        aiCount,
        recentRes, doctorsRes, auditRes,
      ] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', orgId).single(),

        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'doctor'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'patient'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'staff'),

        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('appointments').select('payment_amount').eq('organization_id', orgId).eq('status', 'completed'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['doctor_confirmed', 'time_selected', 'paid', 'scheduled', 'ready', 'in_progress']),

        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),

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

      const allApts = (recentRes.data || []) as unknown as DashAppointment[]

      setStats({
        users: usersCount.count || 0,
        doctors: doctorsCount.count || 0,
        patients: patientsCount.count || 0,
        staff: staffCount.count || 0,
        totalAppointments: totalAptsCount.count || 0,
        completedAppointments: completedData.length,
        pendingAppointments: pendingAptsCount.count || 0,
        activeAppointments: activeAptsCount.count || 0,
        revenue,
        aiUsage: aiCount.count || 0,
      })

      setRecentApts(allApts)
      setDoctors((doctorsRes.data || []) as unknown as DashDoctor[])
      setAuditLog((auditRes.data || []) as unknown as AuditEntry[])

      const today = new Date().toDateString()
      setTodayApts(allApts.filter(a => {
        const d = a.scheduled_at || a.created_at
        return new Date(d).toDateString() === today
      }))
    } catch {
      toast.error('שגיאה בטעינת נתוני הדשבורד')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageLoading />

  const doctorsPercent = org ? Math.min(Math.round((org.current_doctors / org.max_doctors) * 100), 100) : 0
  const aptsPercent = org ? Math.min(Math.round((org.current_month_appointments / org.max_appointments_per_month) * 100), 100) : 0
  const storagePercent = org ? Math.min(Math.round((org.current_storage_gb / org.max_storage_gb) * 100), 100) : 0

  const todayDateStr = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isFreePlan = org?.plan === 'free' || org?.plan === 'trial'

  return (
    <div className="space-y-7" dir="rtl">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{org?.name || 'ניהול מרפאה'}</h1>
            {org?.plan && (
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                isFreePlan ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              )}>
                {PLAN_LABELS[org.plan] || org.plan}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 pr-10">{todayDateStr}</p>
        </div>
        <div className="flex items-center gap-2 pr-10 sm:pr-0">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/admin/users')}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
            הוסף רופא
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/admin/reports')}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
            דוחות
          </Button>
          <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/admin/settings')}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
            הגדרות
          </Button>
        </div>
      </div>

      {/* ── Subscription alerts ──────────────────────── */}
      {org && (org.subscription_status === 'suspended' || org.subscription_status === 'cancelled') && (
        <div className={cn(
          'flex items-center justify-between gap-4 px-5 py-4 rounded-xl border',
          org.subscription_status === 'suspended'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
              org.subscription_status === 'suspended' ? 'bg-amber-200 text-amber-800' : 'bg-red-200 text-red-800'
            )}>!</div>
            <p className={cn(
              'font-medium text-sm',
              org.subscription_status === 'suspended' ? 'text-amber-800' : 'text-red-800'
            )}>
              {org.subscription_status === 'suspended'
                ? 'המנוי מושעה — יש לעדכן את אמצעי התשלום כדי לשמור על גישה מלאה'
                : 'המנוי בוטל — חלק מהתכונות אינן זמינות יותר'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/admin/billing')}>
            ניהול חיוב
          </Button>
        </div>
      )}

      {/* ── Free/Trial plan notice ───────────────────── */}
      {org && isFreePlan && org.subscription_status !== 'suspended' && org.subscription_status !== 'cancelled' && (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl border border-blue-200 bg-gradient-to-l from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <p className="text-sm text-blue-800 font-medium">
              {org.plan === 'trial' && org.trial_ends_at
                ? `תקופת הניסיון מסתיימת ב-${new Date(org.trial_ends_at).toLocaleDateString('he-IL')} — שדרגו לתוכנית בתשלום`
                : 'אתם בתוכנית החינמית — שדרגו לגישה לכל הפיצ\'רים'}
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => router.push('/dashboard/admin/billing')}>
            שדרוג
          </Button>
        </div>
      )}

      {/* ── Primary KPI Row ──────────────────────────── */}
      {/* Revenue hero + 2 supporting */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Revenue — hero card */}
        <div className="sm:col-span-1">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-100 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <p className="text-emerald-100 text-sm font-medium">סה&quot;כ הכנסות</p>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <IconMoney />
              </div>
            </div>
            <div>
              <p className="text-4xl font-bold tracking-tight">{formatPrice(stats.revenue)}</p>
              <p className="text-emerald-200 text-xs mt-1">מ-{stats.completedAppointments} ייעוצים שהושלמו</p>
            </div>
          </div>
        </div>

        {/* Appointments + Users */}
        <div className="sm:col-span-2 grid grid-cols-2 gap-4">
          <StatCard
            label="סה&quot;כ תורים"
            value={stats.totalAppointments}
            icon={<IconCalendar />}
            color="blue"
          />
          <StatCard
            label="מטופלים פעילים"
            value={stats.patients}
            icon={<IconPatient />}
            color="purple"
          />
          <StatCard
            label="ממתינים לאישור"
            value={stats.pendingAppointments}
            icon={<IconClock />}
            color="orange"
          />
          <StatCard
            label="תורים פעילים"
            value={stats.activeAppointments}
            icon={<IconCheck />}
            color="green"
          />
        </div>
      </div>

      {/* ── Secondary KPI Row ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="רופאים" value={stats.doctors} icon={<IconDoctor />} color="purple" />
        <StatCard label="צוות שירות" value={stats.staff} icon={<IconUsers />} color="blue" />
        <StatCard label="הושלמו" value={stats.completedAppointments} icon={<IconCheck />} color="green" />
        <StatCard label="שימושי AI" value={stats.aiUsage} icon={<IconAI />} color="purple" />
      </div>

      {/* ── Today + Plan usage ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Today's schedule — wider */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  </div>
                  <h3 className="font-bold text-gray-900">פעילות היום</h3>
                  {todayApts.length > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{todayApts.length}</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/appointments')}>
                  כל התורים
                </Button>
              </div>
            </CardHeader>
            {todayApts.length === 0 ? (
              <EmptyState
                icon={
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto">
                    <svg className="w-7 h-7 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  </div>
                }
                title="אין תורים להיום"
                description="כל התורים של היום יופיעו כאן"
              />
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {todayApts.map(apt => (
                  <div key={apt.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-1.5 h-8 rounded-full shrink-0',
                        apt.status === 'completed' ? 'bg-emerald-400' :
                        apt.status === 'in_progress' ? 'bg-blue-500' :
                        apt.status === 'pending' ? 'bg-amber-400' :
                        apt.status.startsWith('cancelled') ? 'bg-red-400' :
                        'bg-indigo-400'
                      )} />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {apt.patient?.first_name} {apt.patient?.last_name}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {apt.doctor ? `ד"ר ${apt.doctor.first_name} ${apt.doctor.last_name}` : 'ממתין לשיבוץ רופא'}
                          {apt.scheduled_at && (
                            <span className="text-blue-500 font-medium mr-1.5">
                              · {new Date(apt.scheduled_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {apt.ai_triage_score != null && (
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded-md font-bold tabular-nums',
                          apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                          apt.ai_triage_score >= 4 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        )}>
                          {apt.ai_triage_score}
                        </span>
                      )}
                      <Badge variant={getBadgeVariant(apt.status)}>
                        {STATUS_LABELS[apt.status] || apt.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Plan usage — narrower */}
        {org && (
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
                    </div>
                    <h3 className="font-bold text-gray-900">שימוש בתוכנית</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/billing')}>
                    פרטים
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  {
                    label: 'רופאים',
                    current: org.current_doctors,
                    max: org.max_doctors,
                    percent: doctorsPercent,
                  },
                  {
                    label: 'תורים החודש',
                    current: org.current_month_appointments,
                    max: org.max_appointments_per_month,
                    percent: aptsPercent,
                  },
                  {
                    label: `אחסון (GB)`,
                    current: org.current_storage_gb,
                    max: org.max_storage_gb,
                    percent: storagePercent,
                  },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600 font-medium">{item.label}</span>
                      <span className={cn(
                        'text-xs font-semibold tabular-nums',
                        item.percent >= 90 ? 'text-red-600' : item.percent >= 70 ? 'text-amber-600' : 'text-gray-500'
                      )}>
                        {typeof item.current === 'number' && item.current % 1 !== 0
                          ? item.current.toFixed(1)
                          : item.current.toLocaleString()
                        } / {typeof item.max === 'number' && item.max % 1 !== 0
                          ? item.max.toFixed(0)
                          : item.max.toLocaleString()
                        }
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          item.percent >= 90 ? 'bg-red-500' : item.percent >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                        )}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    {item.percent >= 90 && (
                      <p className="text-xs text-red-500 mt-1">קרוב למגבלה — שקול שדרוג</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Doctors + Audit log ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active doctors */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1" /><path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" /></svg>
                </div>
                <h3 className="font-bold text-gray-900">רופאים פעילים</h3>
                <span className="text-xs text-gray-400">({doctors.length})</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/users')}>
                ניהול
              </Button>
            </div>
          </CardHeader>
          {doctors.length === 0 ? (
            <EmptyState
              icon={
                <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1" /><path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" /></svg>
                </div>
              }
              title="אין רופאים רשומים"
              description="הזמינו רופאים דרך ניהול משתמשים"
              action={
                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/admin/users')}>
                  הוסף רופא
                </Button>
              }
            />
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {doctors.map(doc => (
                <div key={doc.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    {doc.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 ring-2 ring-gray-100" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-sm font-bold text-purple-700 shrink-0">
                        {getInitials(doc.first_name, doc.last_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">ד&quot;ר {doc.first_name} {doc.last_name}</p>
                      {doc.specialties && doc.specialties.length > 0 && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{doc.specialties.join(' · ')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.average_rating ? (
                      <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                        <span className="text-amber-500"><IconStar filled /></span>
                        <span className="text-xs font-bold text-amber-700">{doc.average_rating.toFixed(1)}</span>
                        {doc.total_ratings > 0 && (
                          <span className="text-xs text-amber-500">({doc.total_ratings})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 bg-gray-50 px-2 py-1 rounded-lg">אין דירוג</span>
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

        {/* Audit log — timeline style */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                </div>
                <h3 className="font-bold text-gray-900">יומן פעילות</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/audit-log')}>
                יומן מלא
              </Button>
            </div>
          </CardHeader>
          {auditLog.length === 0 ? (
            <EmptyState
              icon={
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
              }
              title="אין פעילות ביומן"
            />
          ) : (
            <div className="px-5 py-4 space-y-0 max-h-80 overflow-y-auto">
              {auditLog.map((entry, idx) => (
                <div key={entry.id} className="flex gap-3 group">
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5',
                      getAuditDotColor(entry.action)
                    )}>
                      {getAuditIcon(entry.action)}
                    </div>
                    {idx < auditLog.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-4 min-w-0 flex-1">
                    <p className="text-sm text-gray-700 font-medium leading-snug">
                      {entry.description || entry.action}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent appointments activity ─────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
              <h3 className="font-bold text-gray-900">פעילות אחרונה</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/appointments')}>
              כל התורים
            </Button>
          </div>
        </CardHeader>
        <div className="divide-y">
          {recentApts.slice(0, 8).map(apt => (
            <div key={apt.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 text-xs font-bold text-gray-500">
                  {apt.patient ? getInitials(apt.patient.first_name, apt.patient.last_name) : '?'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">
                      {apt.patient?.first_name} {apt.patient?.last_name}
                    </span>
                    <svg className="w-3 h-3 text-gray-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    <span className="text-sm text-gray-500">
                      {apt.doctor ? `ד"ר ${apt.doctor.first_name} ${apt.doctor.last_name}` : 'ממתין לשיבוץ'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {apt.chief_complaint}
                    <span className="mx-1.5">·</span>
                    {formatDateTime(apt.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {apt.ai_triage_score != null && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-md font-bold tabular-nums',
                    apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                    apt.ai_triage_score >= 4 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  )}>
                    {apt.ai_triage_score}
                  </span>
                )}
                <Badge variant={getBadgeVariant(apt.status)}>
                  {STATUS_LABELS[apt.status] || apt.status}
                </Badge>
                {apt.payment_amount != null && apt.payment_amount > 0 && (
                  <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg">
                    {formatPrice(apt.payment_amount)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Quick actions ────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">פעולות מהירות</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            {
              label: 'הוסף רופא',
              icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
              href: '/dashboard/admin/users',
              color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
            },
            {
              label: 'הזמן מטופל',
              icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /><line x1="12" y1="14" x2="12" y2="20" /><line x1="9" y1="17" x2="15" y2="17" /></svg>,
              href: '/dashboard/admin/users',
              color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
            },
            {
              label: 'שאלונים',
              icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
              href: '/dashboard/admin/questionnaires',
              color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
            },
            {
              label: 'דוחות',
              icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
              href: '/dashboard/admin/reports',
              color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
            },
            {
              label: 'הגדרות מרפאה',
              icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
              href: '/dashboard/admin/settings',
              color: 'text-gray-600 bg-gray-50 hover:bg-gray-100',
            },
            {
              label: 'חיוב ומנוי',
              icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
              href: '/dashboard/admin/billing',
              color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
            },
          ].map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex flex-col items-center gap-2.5 p-4 rounded-xl border border-transparent transition-all text-center',
                'hover:border-gray-200 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-500',
                item.color
              )}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="text-xs font-semibold leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
