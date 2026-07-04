'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, Spinner } from '@/components/ui'
import { formatPrice, formatDateTime, cn } from '@/lib/utils'
import type { Appointment, User } from '@/types/database'

// ── Payment mode detection ────────────────────────────────────────
// If TRANZILA terminal is configured → real payment, otherwise → fake card form
const USE_FAKE_PAYMENT = !process.env.NEXT_PUBLIC_TRANZILA_TERMINAL

type PaymentState = 'loading' | 'summary' | 'card_form' | 'paying' | 'tranzila' | 'success' | 'failed' | 'error' | 'already_paid'

// ── Fake card form state ─────────────────────────────────────────
type CardForm = { number: string; name: string; expiry: string; cvv: string }

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

// ── Icon components ───────────────────────────────────────────────
function IconCheck() {
  return (
    <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function IconX() {
  return (
    <svg className="w-8 h-8 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}
function IconLock() {
  return (
    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}

export default function PaymentPage() {
  const searchParams   = useSearchParams()
  const appointmentId  = searchParams.get('id')
  const urlStatus      = searchParams.get('status')
  const router         = useRouter()
  const supabase       = getClient()

  const [state, setState]           = useState<PaymentState>('loading')
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [doctor, setDoctor]         = useState<User | null>(null)
  const [iframeUrl, setIframeUrl]   = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [card, setCard]             = useState<CardForm>({ number: '', name: '', expiry: '', cvv: '' })
  const [cardErrors, setCardErrors] = useState<Partial<CardForm>>({})
  const [processing, setProcessing] = useState(false)

  const pollRef      = useRef<ReturnType<typeof setInterval>>(undefined)
  const pollStartRef = useRef<number>(0)

  useEffect(() => {
    if (!appointmentId) { setError('חסר מזהה תור'); setState('error'); return }
    loadAppointment(appointmentId)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [appointmentId])

  useEffect(() => {
    if (urlStatus && appointmentId) {
      setState('loading')
      setTimeout(() => loadAppointment(appointmentId), 2000)
    }
  }, [urlStatus])

  const loadAppointment = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: apt } = await supabase
        .from('appointments')
        .select('*, doctor:doctor_id(id, first_name, last_name, specialties, avatar_url, consultation_price)')
        .eq('id', id)
        .single()

      if (!apt) { setError('תור לא נמצא'); setState('error'); return }

      const typedApt = apt as unknown as Appointment
      setAppointment(typedApt)
      if (typedApt.doctor) setDoctor(typedApt.doctor as unknown as User)
      if (typedApt.invoice_url) setInvoiceUrl(typedApt.invoice_url as string)

      if (typedApt.payment_status === 'completed') {
        setState('already_paid')
      } else if (urlStatus === 'success') {
        setState('success')
      } else if (urlStatus === 'failed') {
        setState('failed')
      } else {
        setState('summary')
      }
    } catch {
      setError('שגיאה בטעינת פרטי התור')
      setState('error')
    }
  }

  // ── Fake payment flow ────────────────────────────────────────────
  const validateCard = (): boolean => {
    const errs: Partial<CardForm> = {}
    const digits = card.number.replace(/\s/g, '')
    if (digits.length < 13) errs.number = 'מספר כרטיס לא תקין'
    if (!card.name.trim()) errs.name = 'שם חובה'
    const expParts = card.expiry.split('/')
    if (expParts.length !== 2 || expParts[0].length !== 2 || expParts[1].length !== 2) errs.expiry = 'תוקף לא תקין (MM/YY)'
    if (card.cvv.length < 3) errs.cvv = 'CVV לא תקין'
    setCardErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submitFakePayment = async () => {
    if (!validateCard()) return
    setProcessing(true)
    try {
      const res = await fetch('/api/payments/fake-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      const data = await res.json()
      if (res.ok) {
        setState('success')
        if (appointmentId) refreshInvoiceUrl(appointmentId)
      } else {
        setError(data.error || 'שגיאה בעיבוד התשלום')
        setState('failed')
      }
    } catch {
      setError('שגיאה בעיבוד התשלום')
      setState('failed')
    } finally {
      setProcessing(false)
    }
  }

  // ── Real Tranzila flow ───────────────────────────────────────────
  const startTranzilaPayment = async () => {
    if (!appointmentId) return
    setState('loading')
    try {
      const res = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'Already paid') { setState('already_paid'); return }
        throw new Error(data.error || 'Failed to create payment session')
      }
      const { iframeUrl: url } = await res.json()
      setIframeUrl(url)
      setState('tranzila')
      startPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת תשלום')
      setState('error')
    }
  }

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollStartRef.current = Date.now()
    const TIMEOUT = 5 * 60 * 1000
    pollRef.current = setInterval(async () => {
      if (!appointmentId) return
      if (Date.now() - pollStartRef.current > TIMEOUT) {
        clearInterval(pollRef.current)
        setError('התשלום לא אושר תוך 5 דקות. אנא נסה שוב.')
        setState('failed')
        return
      }
      try {
        const { data } = await supabase.from('appointments').select('payment_status').eq('id', appointmentId).single()
        if (data?.payment_status === 'completed') {
          clearInterval(pollRef.current)
          setState('success')
          if (appointmentId) refreshInvoiceUrl(appointmentId)
        } else if (data?.payment_status === 'failed') {
          clearInterval(pollRef.current)
          setState('failed')
        }
      } catch { /* silently retry */ }
    }, 3000)
  }, [appointmentId, supabase])

  const refreshInvoiceUrl = async (id: string) => {
    const { data } = await supabase.from('appointments').select('invoice_url').eq('id', id).single()
    if (data?.invoice_url) setInvoiceUrl(data.invoice_url as string)
  }

  // ── Screens ──────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Spinner size="lg" className="mx-auto" />
          <p className="text-slate-500 text-sm">טוען פרטי תשלום...</p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto"><IconX /></div>
            <h2 className="text-xl font-bold text-slate-900">שגיאה</h2>
            <p className="text-slate-500">{error}</p>
            <Button onClick={() => router.push('/dashboard/patient/dashboard')}>חזור לדשבורד</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'already_paid') {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card className="border-blue-200">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-blue-800">תור זה כבר שולם</h2>
            <p className="text-slate-500">התשלום עבור תור זה כבר בוצע.</p>
            <Button onClick={() => router.push('/dashboard/patient/appointments')}>לתורים שלי</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card className="border-green-200">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-800">התשלום בוצע בהצלחה!</h2>
            <p className="text-slate-500">התור שלך אושר ומוכן. תתחבר לשיחת הווידאו בזמן הנקוב.</p>
            {appointment?.payment_amount && (
              <p className="text-xl font-bold text-green-700">{formatPrice(appointment.payment_amount)}</p>
            )}
            {invoiceUrl && (
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                הורד קבלה
              </a>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => router.push('/dashboard/patient/appointments')}>
                לתורים שלי
              </Button>
              {appointment && (
                <Button variant="outline" onClick={() => router.push(`/video-call?id=${appointment.id}`)}>
                  כניסה לשיחת וידאו
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card className="border-red-200">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto"><IconX /></div>
            <h2 className="text-xl font-bold text-red-800">התשלום נכשל</h2>
            <p className="text-slate-500">{error || 'אירעה שגיאה בעיבוד התשלום. ניתן לנסות שוב.'}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => { setError(''); setState('summary') }}>נסה שוב</Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/patient/dashboard')}>חזור לדשבורד</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Summary + payment form ────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">תשלום עבור ייעוץ</h1>
        <p className="text-sm text-slate-500 mt-1">בצע תשלום מאובטח כדי לאשר את הייעוץ</p>
      </div>

      {/* Appointment summary card */}
      {appointment && (
        <Card>
          <CardHeader className="border-b border-slate-100">
            <h3 className="font-bold text-base">פרטי הייעוץ</h3>
          </CardHeader>
          <CardContent className="py-4 space-y-3">
            {doctor && (
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 shrink-0">
                  {doctor.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={doctor.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    : `${doctor.first_name.charAt(0)}${doctor.last_name.charAt(0)}`
                  }
                </div>
                <div>
                  <p className="font-semibold text-slate-900">ד&quot;ר {doctor.first_name} {doctor.last_name}</p>
                  {doctor.specialties && (
                    <p className="text-sm text-slate-500">{(doctor.specialties as string[]).join(' · ')}</p>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-0.5">תלונה</p>
                <p className="font-medium text-slate-800">{appointment.chief_complaint}</p>
              </div>
              {appointment.requested_specialty && (
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">התמחות</p>
                  <p className="font-medium text-slate-800">{appointment.requested_specialty}</p>
                </div>
              )}
              {appointment.scheduled_at && (
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">מועד</p>
                  <p className="font-medium text-slate-800">{formatDateTime(appointment.scheduled_at)}</p>
                </div>
              )}
              <div>
                <p className="text-slate-400 text-xs mb-0.5">משך</p>
                <p className="font-medium text-slate-800">{appointment.duration_minutes || 30} דקות</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="font-bold text-slate-900">סה&quot;כ לתשלום</span>
              <span className="text-2xl font-bold text-blue-600">
                {appointment.payment_amount ? formatPrice(appointment.payment_amount) : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Fake credit card form ── */}
      {USE_FAKE_PAYMENT && (state === 'summary' || state === 'card_form') && (
        <Card>
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">פרטי כרטיס אשראי</h3>
              <div className="flex items-center gap-1.5">
                <IconLock />
                <span className="text-xs text-slate-400">תשלום מאובטח SSL</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-5 space-y-4">
            {/* Demo notice */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-amber-700">מצב פיתוח — תשלום מדומה</p>
                <p className="text-xs text-amber-600 mt-0.5">הזן כל מספר כרטיס 13+ ספרות. תשלום יאושר אוטומטית.</p>
              </div>
            </div>

            {/* Card number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="card-number">
                מספר כרטיס
              </label>
              <div className="relative">
                <input
                  id="card-number"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={card.number}
                  onChange={e => setCard(p => ({ ...p, number: formatCardNumber(e.target.value) }))}
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2',
                    cardErrors.number
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                  )}
                  aria-describedby={cardErrors.number ? 'card-number-error' : undefined}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-1">
                  {['💳'].map((icon, i) => <span key={i} className="text-base">{icon}</span>)}
                </div>
              </div>
              {cardErrors.number && <p id="card-number-error" className="mt-1 text-xs text-red-500">{cardErrors.number}</p>}
            </div>

            {/* Cardholder name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="card-name">
                שם בעל הכרטיס
              </label>
              <input
                id="card-name"
                type="text"
                placeholder="ישראל ישראלי"
                value={card.name}
                onChange={e => setCard(p => ({ ...p, name: e.target.value }))}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2',
                  cardErrors.name
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                )}
              />
              {cardErrors.name && <p className="mt-1 text-xs text-red-500">{cardErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="card-expiry">
                  תוקף (MM/YY)
                </label>
                <input
                  id="card-expiry"
                  type="text"
                  inputMode="numeric"
                  placeholder="12/26"
                  value={card.expiry}
                  onChange={e => setCard(p => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2',
                    cardErrors.expiry
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                  )}
                />
                {cardErrors.expiry && <p className="mt-1 text-xs text-red-500">{cardErrors.expiry}</p>}
              </div>
              {/* CVV */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="card-cvv">
                  CVV
                </label>
                <input
                  id="card-cvv"
                  type="text"
                  inputMode="numeric"
                  placeholder="123"
                  maxLength={4}
                  value={card.cvv}
                  onChange={e => setCard(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2',
                    cardErrors.cvv
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                  )}
                />
                {cardErrors.cvv && <p className="mt-1 text-xs text-red-500">{cardErrors.cvv}</p>}
              </div>
            </div>

            <Button
              onClick={submitFakePayment}
              loading={processing}
              size="lg"
              className="w-full mt-2"
              aria-label={`שלם ${appointment?.payment_amount ? formatPrice(appointment.payment_amount) : ''}`}
            >
              {processing ? (
                'מעבד תשלום...'
              ) : (
                `שלם ${appointment?.payment_amount ? formatPrice(appointment.payment_amount) : ''}`
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Real Tranzila flow ── */}
      {!USE_FAKE_PAYMENT && state === 'summary' && (
        <div className="space-y-4">
          <p className="text-xs text-center text-slate-400">
            התשלום מאובטח ומעובד על ידי Tranzila. פרטי הכרטיס שלך לא נשמרים אצלנו.
          </p>
          <Button onClick={startTranzilaPayment} size="lg" className="w-full">
            עבור לתשלום — {appointment?.payment_amount ? formatPrice(appointment.payment_amount) : ''}
          </Button>
        </div>
      )}

      {!USE_FAKE_PAYMENT && state === 'tranzila' && iframeUrl && (
        <Card>
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">הזן פרטי תשלום</h3>
              <Badge variant="info">מאובטח</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              src={iframeUrl}
              className="w-full border-0"
              style={{ height: '500px' }}
              title="טופס תשלום מאובטח"
              sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
