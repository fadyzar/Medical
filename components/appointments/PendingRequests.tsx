'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, CardHeader } from '@/components/ui'
import { cn, formatPrice } from '@/lib/utils'
import type { Appointment, User } from '@/types/database'

const TZ = 'Asia/Jerusalem'

/** Requests the doctor decides on: paid/verified (or clinic-settled) bookings
 *  waiting for approval, bookings still waiting for the patient's payment,
 *  and open requests coordinated through the older scheduling flow. */
export function pendingRequestsOf(appointments: Appointment[], nowMs: number): Appointment[] {
  // A request whose requested time has already passed can no longer be
  // approved (the server refuses it); it stays visible in the full list.
  const live = (a: Appointment) => !a.scheduled_at || new Date(a.scheduled_at).getTime() > nowMs
  return appointments.filter(a => live(a) && (
    a.status === 'pending_approval' ||
    a.status === 'payment_pending' ||
    (!a.payment_collection && ['pending', 'doctor_confirmed', 'time_selected'].includes(a.status))),
  ).sort((a, b) => (a.scheduled_at || '9').localeCompare(b.scheduled_at || '9'))
}

function paymentLabel(a: Appointment): { text: string; tone: 'ok' | 'wait' | 'muted' } {
  if (a.payment_collection === 'online') {
    return a.payment_status === 'completed'
      ? { text: `שולם ואומת${a.payment_amount ? ` · ${formatPrice(a.payment_amount)}` : ''}`, tone: 'ok' }
      : { text: 'ממתין לתשלום המטופל', tone: 'wait' }
  }
  if (a.payment_collection === 'clinic') return { text: `יוסדר מול המרפאה${a.payment_amount ? ` · ${formatPrice(a.payment_amount)}` : ''}`, tone: 'muted' }
  if (a.payment_collection === 'none') return { text: 'ללא תשלום', tone: 'muted' }
  return { text: 'טרם נשלחה לאישור', tone: 'muted' }
}

function when(iso: string | null): string {
  if (!iso) return 'מועד טרם נקבע'
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)) + ' (שעון ישראל)'
}

export function PendingRequests({ appointments, onChanged, onOpen }: {
  appointments: Appointment[]
  onChanged: () => void
  onOpen: (id: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id)
    try {
      const res = await fetch('/api/appointments/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, decision, ...(decision === 'reject' && reason.trim() ? { reason: reason.trim() } : {}) }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; refundRequired?: boolean }
      if (!res.ok) {
        toast.error(data.error || 'הפעולה נכשלה')
      } else if (decision === 'approve') {
        toast.success('התור אושר. המטופל קיבל אישור במייל.')
      } else {
        toast.success(data.refundRequired ? 'הבקשה נדחתה ונפתחה בקשת החזר.' : 'הבקשה נדחתה. המטופל עודכן במייל.')
        setRejecting(null); setReason('')
      }
    } catch {
      toast.error('הפעולה נכשלה')
    } finally {
      setBusy(null)
      onChanged()
    }
  }

  return (
    <Card id="pending-requests" className="border-orange-300 shadow-orange-100 shadow-md scroll-mt-24">
      <CardHeader className="bg-gradient-to-l from-orange-50 to-amber-50 border-b border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-orange-900">בקשות תור ממתינות</h2>
            <p className="text-xs text-orange-700">תור נקבע רק לאחר אישורך. עד אז המטופל אינו יכול להיכנס לשיחה.</p>
          </div>
          <span className="bg-orange-500 text-white text-sm font-bold min-w-7 h-7 px-2 rounded-full flex items-center justify-center shrink-0" aria-label={`${appointments.length} בקשות`}>
            {appointments.length}
          </span>
        </div>
      </CardHeader>

      {appointments.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">אין בקשות ממתינות.</p>
      ) : (
        <ul className="divide-y divide-orange-100">
          {appointments.map(apt => {
            const patient = apt.patient as unknown as User | undefined
            const pay = paymentLabel(apt)
            const awaitingPayment = apt.status === 'payment_pending'
            const canApprove = !awaitingPayment && !!apt.scheduled_at
            const canReject = apt.status === 'pending_approval'
            return (
              <li key={apt.id} className="px-5 py-4" data-testid="pending-request" data-appointment-id={apt.id}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-slate-900">{patient ? `${patient.first_name} ${patient.last_name}` : 'מטופל/ת'}</p>
                    <p className="text-sm text-slate-700">{when(apt.scheduled_at)}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {apt.appointment_type === 'clinic' ? 'ביקור במרפאה' : 'ייעוץ וידאו'}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded-full',
                        pay.tone === 'ok' ? 'bg-emerald-100 text-emerald-800' : pay.tone === 'wait' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}>
                        תשלום: {pay.text}
                      </span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    {canApprove ? (
                      <Button size="sm" loading={busy === apt.id && rejecting !== apt.id} disabled={!!busy}
                        onClick={() => decide(apt.id, 'approve')} className="bg-emerald-600 hover:bg-emerald-700">
                        אשר
                      </Button>
                    ) : !awaitingPayment ? (
                      <Button size="sm" variant="outline" onClick={() => onOpen(apt.id)}>קבע מועד</Button>
                    ) : null}
                    {canReject && (
                      <Button size="sm" variant="outline" disabled={!!busy}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => { setRejecting(rejecting === apt.id ? null : apt.id); setReason('') }}
                        aria-expanded={rejecting === apt.id}>
                        דחה
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onOpen(apt.id)}>פרטים</Button>
                  </div>
                </div>
                {rejecting === apt.id && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                    <label htmlFor={`reject-${apt.id}`} className="block text-sm font-medium text-red-900">
                      סיבת הדחייה (לא תישלח במייל; תוצג למטופל באתר)
                    </label>
                    <textarea id={`reject-${apt.id}`} value={reason} maxLength={500} rows={2}
                      onChange={e => setReason(e.target.value)}
                      className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" loading={busy === apt.id} disabled={!!busy && busy !== apt.id}
                        onClick={() => decide(apt.id, 'reject')}>
                        אישור דחייה
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>ביטול</Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
