'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Select, Card, CardContent, Badge, PageLoading, EmptyState } from '@/components/ui'
import { formatDateTime, cn } from '@/lib/utils'
import type { AuditLog } from '@/types/database'

// ── Labels ──────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  user_login: 'התחברות',
  user_logout: 'התנתקות',
  user_created: 'יצירת משתמש',
  user_updated: 'עדכון משתמש',
  user_invited: 'הזמנת משתמש',
  user_deactivated: 'השבתת משתמש',
  user_activated: 'הפעלת משתמש',
  appointment_created: 'יצירת תור',
  appointment_updated: 'עדכון תור',
  appointment_cancelled: 'ביטול תור',
  appointment_completed: 'השלמת תור',
  payment_completed: 'תשלום התקבל',
  payment_failed: 'תשלום נכשל',
  settings_updated: 'עדכון הגדרות',
  questionnaire_created: 'יצירת שאלון',
  questionnaire_updated: 'עדכון שאלון',
  questionnaire_deleted: 'מחיקת שאלון',
  document_uploaded: 'העלאת מסמך',
  document_deleted: 'מחיקת מסמך',
  ai_triage: 'מיון AI',
  ai_summary: 'סיכום AI',
  video_started: 'שיחת וידאו התחילה',
  video_ended: 'שיחת וידאו הסתיימה',
  email_sent: 'אימייל נשלח',
  whatsapp_sent: 'WhatsApp נשלח',
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  user: 'משתמש',
  appointment: 'תור',
  organization: 'מרפאה',
  questionnaire: 'שאלון',
  document: 'מסמך',
  notification: 'התראה',
  payment: 'תשלום',
  ai_conversation: 'שיחת AI',
  video: 'שיחת וידאו',
}

const ACTION_OPTIONS = [
  { value: '', label: 'כל הפעולות' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
]

const RESOURCE_OPTIONS = [
  { value: '', label: 'כל הסוגים' },
  ...Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const PAGE_SIZE = 25

// ── Component ───────────────────────────────────────

export default function AuditLogPage() {
  const router = useRouter()
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [orgId, setOrgId] = useState<string>('')

  // ── Load org ────────────────────────────────────────

  useEffect(() => {
    loadOrg()
  }, [])

  const loadOrg = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
      if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
        router.push('/dashboard/admin/dashboard'); return
      }

      setOrgId((profile as unknown as { organization_id: string }).organization_id)
    } catch {
      setLoading(false)
    }
  }

  // ── Load logs when org or filters change ────────────

  useEffect(() => {
    if (orgId) loadLogs()
  }, [orgId, page, search, actionFilter, resourceFilter, dateFrom, dateTo])

  const loadLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (actionFilter) query = query.eq('action', actionFilter)
      if (resourceFilter) query = query.eq('resource_type', resourceFilter)
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
      if (search) query = query.or(`description.ilike.%${search}%,action.ilike.%${search}%`)

      const { data, count } = await query

      const typedLogs = (data || []) as unknown as AuditLog[]
      setLogs(typedLogs)
      setTotalCount(count || 0)

      // Fetch user names for this page
      const userIds = [...new Set(typedLogs.map(l => l.user_id).filter(Boolean))] as string[]
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', userIds)

        if (users) {
          const names: Record<string, string> = {}
          for (const u of users as unknown as Array<{ id: string; first_name: string; last_name: string }>) {
            names[u.id] = `${u.first_name} ${u.last_name}`
          }
          setUserNames(prev => ({ ...prev, ...names }))
        }
      }
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  // ── Helpers ─────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const resetFilters = () => {
    setSearch('')
    setActionFilter('')
    setResourceFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }

  const hasFilters = search || actionFilter || resourceFilter || dateFrom || dateTo

  const getActionBadgeVariant = (action: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    if (action.includes('created') || action.includes('completed') || action.includes('activated')) return 'success'
    if (action.includes('cancelled') || action.includes('deleted') || action.includes('deactivated') || action.includes('failed')) return 'danger'
    if (action.includes('updated') || action.includes('settings')) return 'warning'
    if (action.includes('login') || action.includes('logout')) return 'info'
    return 'default'
  }

  // ── Render ──────────────────────────────────────────

  if (!orgId) return <PageLoading />

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">יומן פעילות</h2>
          <p className="text-gray-500 text-sm">צפה בכל הפעולות שבוצעו במערכת</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Input
                placeholder="חיפוש..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
              />
              <Select
                value={actionFilter}
                onChange={e => { setActionFilter(e.target.value); setPage(0) }}
                options={ACTION_OPTIONS}
              />
              <Select
                value={resourceFilter}
                onChange={e => { setResourceFilter(e.target.value); setPage(0) }}
                options={RESOURCE_OPTIONS}
              />
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(0) }}
                placeholder="מתאריך"
              />
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(0) }}
                  placeholder="עד תאריך"
                  className="flex-1"
                />
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="shrink-0">
                    איפוס
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{totalCount} רשומות{hasFilters ? ' (מסונן)' : ''}</span>
          {totalPages > 1 && (
            <span>עמוד {page + 1} מתוך {totalPages}</span>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <PageLoading />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="📜"
            title="אין רשומות"
            description={hasFilters ? 'נסה לשנות את הסינון' : 'עדיין אין פעילות ביומן'}
            action={hasFilters ? <Button variant="outline" onClick={resetFilters}>איפוס סינון</Button> : undefined}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">זמן</th>
                    <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">משתמש</th>
                    <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">פעולה</th>
                    <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">סוג</th>
                    <th className="text-right p-3 font-medium text-gray-600">תיאור</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <LogRow
                      key={log.id}
                      log={log}
                      userName={log.user_id ? userNames[log.user_id] || '...' : null}
                      expanded={expandedId === log.id}
                      onToggle={() => setExpandedId(prev => prev === log.id ? null : log.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              → הקודם
            </Button>
            <span className="text-sm text-gray-500 px-3">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              הבא ←
            </Button>
          </div>
        )}
    </div>
  )
}

// ── Log Row ─────────────────────────────────────────

function LogRow({ log, userName, expanded, onToggle }: {
  log: AuditLog
  userName: string | null
  expanded: boolean
  onToggle: () => void
}) {
  const actionLabel = ACTION_LABELS[log.action] || log.action
  const resourceLabel = RESOURCE_TYPE_LABELS[log.resource_type] || log.resource_type
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0

  const getActionBadgeVariant = (action: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    if (action.includes('created') || action.includes('completed') || action.includes('activated')) return 'success'
    if (action.includes('cancelled') || action.includes('deleted') || action.includes('deactivated') || action.includes('failed')) return 'danger'
    if (action.includes('updated') || action.includes('settings')) return 'warning'
    if (action.includes('login') || action.includes('logout')) return 'info'
    return 'default'
  }

  return (
    <>
      <tr className={cn('border-b hover:bg-gray-50 transition-colors', expanded && 'bg-blue-50/50')}>
        <td className="p-3 whitespace-nowrap text-gray-500 text-xs">
          {formatDateTime(log.created_at)}
        </td>
        <td className="p-3 whitespace-nowrap">
          {userName ? (
            <span className="font-medium text-gray-800">{userName}</span>
          ) : (
            <span className="text-gray-400">מערכת</span>
          )}
        </td>
        <td className="p-3 whitespace-nowrap">
          <Badge variant={getActionBadgeVariant(log.action)}>
            {actionLabel}
          </Badge>
        </td>
        <td className="p-3 whitespace-nowrap text-gray-600">
          {resourceLabel}
        </td>
        <td className="p-3 text-gray-600 max-w-xs truncate">
          {log.description || '—'}
        </td>
        <td className="p-3">
          {hasMetadata && (
            <button
              type="button"
              onClick={onToggle}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
              aria-expanded={expanded}
            >
              {expanded ? 'סגור' : 'פרטים'}
            </button>
          )}
        </td>
      </tr>
      {expanded && hasMetadata && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="p-4">
            <div className="bg-white rounded-lg border p-3 overflow-x-auto">
              <p className="text-xs font-medium text-gray-500 mb-2">מטא-דאטה:</p>
              {log.resource_id && (
                <p className="text-xs text-gray-500 mb-2">
                  <span className="font-medium">מזהה משאב:</span>{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{log.resource_id}</code>
                </p>
              )}
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed" dir="ltr">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
