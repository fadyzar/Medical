'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

type Status = 'pending' | 'accepted' | 'expired' | 'revoked'
type Invitation = {
  id: string
  email: string
  first_name: string | null
  status: Status
  created_at: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
  send_count: number
  invited_by_name: string | null
}

const STATUS_LABEL: Record<Status, string> = { pending: 'ממתינה', accepted: 'אושרה', expired: 'פג תוקף', revoked: 'בוטלה' }
const STATUS_STYLE: Record<Status, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  revoked: 'bg-red-50 text-red-700 border-red-200',
}
const FILTERS: Array<{ id: 'all' | Status; label: string }> = [
  { id: 'all', label: 'הכל' }, { id: 'pending', label: 'ממתינות' }, { id: 'accepted', label: 'אושרו' },
  { id: 'expired', label: 'פג תוקף' }, { id: 'revoked', label: 'בוטלו' },
]

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

/**
 * "Invite patient" + invitation management, for clinic admins (all of the
 * clinic's patient invitations) and doctors (the ones they sent). All scope and
 * permission checks are on the server (/api/patient-invitations).
 */
export function PatientInvitations({ scopeLabel }: { scopeLabel: string }) {
  const [items, setItems] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string; link?: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/patient-invitations', { cache: 'no-store' })
      const body = await res.json().catch(() => ({})) as { invitations?: Invitation[]; error?: string }
      if (res.ok) setItems(body.invitations || [])
      else setNotice({ type: 'error', text: body.error || 'טעינת ההזמנות נכשלה' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const report = (res: Response, body: { error?: string; outcome?: string; emailSent?: boolean; inviteUrl?: string }, target: string, okText: string) => {
    if (!res.ok) { setNotice({ type: 'error', text: body.error || 'הפעולה נכשלה' }); return false }
    if (body.outcome === 'duplicate') {
      setNotice({ type: 'error', text: `כבר קיימת הזמנה ממתינה ל-${target}. אפשר לשלוח אותה שוב מהרשימה.` })
      return true
    }
    if (body.emailSent === false) {
      setNotice({ type: 'error', text: `ההזמנה נוצרה, אבל האימייל לא נשלח. אפשר להעביר ל-${target} את הקישור האישי:`, link: body.inviteUrl })
      return true
    }
    setNotice({ type: 'success', text: okText })
    return true
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)
    const target = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { setNotice({ type: 'error', text: 'כתובת אימייל לא תקינה' }); return }
    setSending(true)
    try {
      const res = await fetch('/api/patient-invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target, name: name.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (report(res, body, target, `ההזמנה נשלחה ל-${target}`) && body.outcome !== 'duplicate') { setEmail(''); setName('') }
      await load()
    } catch {
      setNotice({ type: 'error', text: 'שגיאת רשת. נסה/י שוב.' })
    } finally {
      setSending(false)
    }
  }

  const act = async (inv: Invitation, action: 'resend' | 'revoke') => {
    setNotice(null)
    setBusyId(inv.id)
    try {
      const res = await fetch(`/api/patient-invitations/${inv.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      })
      const body = await res.json().catch(() => ({}))
      report(res, body, inv.email, action === 'resend' ? `ההזמנה נשלחה שוב ל-${inv.email}` : `ההזמנה ל-${inv.email} בוטלה`)
      await load()
    } catch {
      setNotice({ type: 'error', text: 'שגיאת רשת. נסה/י שוב.' })
    } finally {
      setBusyId(null)
    }
  }

  const shown = filter === 'all' ? items : items.filter(i => i.status === filter)
  const count = (s: Status) => items.filter(i => i.status === s).length

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-6" aria-labelledby="patient-invites-title" data-testid="patient-invitations">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 id="patient-invites-title" className="text-base font-bold text-slate-900">הזמנת מטופלים</h2>
          <p className="text-xs text-slate-500 mt-0.5">{scopeLabel}</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(v => !v); setNotice(null) }} aria-expanded={showForm}>
          {showForm ? 'סגירה' : '+ הזמנת מטופל'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end mb-4 p-4 bg-slate-50 rounded-xl" noValidate>
          <Input label="אימייל המטופל/ת" type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" required />
          <Input label="שם (אופציונלי)" value={name} onChange={e => setName(e.target.value)} placeholder="שם פרטי" maxLength={60} />
          <Button type="submit" loading={sending}>שליחת הזמנה</Button>
          <p className="sm:col-span-3 text-xs text-slate-500">
            המטופל/ת יקבל/ו אימייל עם קישור אישי וחד-פעמי, בתוקף 7 ימים. מטופל יכול להיות משויך למרפאה אחת בלבד.
          </p>
        </form>
      )}

      {notice && (
        <div role={notice.type === 'error' ? 'alert' : 'status'} data-testid="invite-notice"
          className={cn('mb-4 rounded-xl border p-3 text-sm', notice.type === 'success' ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-amber-50 border-amber-200 text-amber-900')}>
          {notice.text}
          {notice.link && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code dir="ltr" className="text-xs break-all bg-white/70 rounded px-2 py-1">{notice.link}</code>
              <button type="button" className="text-xs font-semibold text-teal-700 hover:underline" onClick={() => navigator.clipboard?.writeText(notice.link || '')}>העתקת קישור</button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label="סינון לפי סטטוס">
        {FILTERS.map(f => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500',
              filter === f.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
            {f.label}{f.id !== 'all' && ` (${count(f.id)})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-4">טוען הזמנות…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">{items.length === 0 ? 'עדיין לא נשלחו הזמנות.' : 'אין הזמנות בסטטוס זה.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100" data-testid="invite-list">
          {shown.map(inv => (
            <li key={inv.id} className="py-3 flex flex-wrap items-center gap-3 justify-between" data-email={inv.email} data-status={inv.status}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate" dir="ltr">{inv.email}</p>
                <p className="text-xs text-slate-500">
                  {inv.first_name ? `${inv.first_name} · ` : ''}נשלחה {fmt(inv.created_at)}
                  {inv.invited_by_name ? ` · ע"י ${inv.invited_by_name}` : ''}
                  {inv.status === 'pending' && ` · בתוקף עד ${fmt(inv.expires_at)}`}
                  {inv.status === 'accepted' && ` · אושרה ${fmt(inv.used_at)}`}
                  {inv.send_count > 1 && ` · נשלחה ${inv.send_count} פעמים`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[inv.status])}>{STATUS_LABEL[inv.status]}</span>
                {(inv.status === 'pending' || inv.status === 'expired') && (
                  <>
                    <Button size="sm" variant="outline" loading={busyId === inv.id} onClick={() => act(inv, 'resend')} aria-label={`שליחה חוזרת ל-${inv.email}`}>שליחה חוזרת</Button>
                    <Button size="sm" variant="ghost" disabled={busyId === inv.id} onClick={() => act(inv, 'revoke')} aria-label={`ביטול ההזמנה ל-${inv.email}`}>ביטול</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
