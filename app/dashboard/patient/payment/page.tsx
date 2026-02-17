'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, Spinner, EmptyState } from '@/components/ui'
import { formatPrice, cn } from '@/lib/utils'
import type { Appointment, User } from '@/types/database'

type PaymentState = 'loading' | 'summary' | 'paying' | 'success' | 'failed' | 'error' | 'already_paid'

export default function PaymentPage() {
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('id')
  const urlStatus = searchParams.get('status') // from Tranzila redirect
  const router = useRouter()
  const supabase = getClient()

  const [state, setState] = useState<PaymentState>('loading')
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [doctor, setDoctor] = useState<User | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    if (!appointmentId) {
      setError('חסר מזהה תור')
      setState('error')
      return
    }
    loadAppointment(appointmentId)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [appointmentId])

  // If Tranzila redirected back with status, check payment
  useEffect(() => {
    if (urlStatus && appointmentId) {
      setState('loading')
      // Give webhook a moment to process
      setTimeout(() => loadAppointment(appointmentId), 2000)
    }
  }, [urlStatus])

  const loadAppointment = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: apt } = await supabase.from('appointments')
      .select('*, doctor:doctor_id(id, first_name, last_name, specialties, avatar_url, consultation_price)')
      .eq('id', id)
      .single()

    if (!apt) {
      setError('תור לא נמצא')
      setState('error')
      return
    }

    const typedApt = apt as unknown as Appointment
    setAppointment(typedApt)

    if (typedApt.doctor) {
      setDoctor(typedApt.doctor as unknown as User)
    }
    if (typedApt.invoice_url) {
      setInvoiceUrl(typedApt.invoice_url)
    }

    // Determine state based on payment status
    if (typedApt.payment_status === 'completed') {
      setState('already_paid')
    } else if (urlStatus === 'success') {
      // Tranzila redirected with success but webhook hasn't processed yet
      setState('success')
    } else if (urlStatus === 'failed') {
      setState('failed')
    } else {
      setState('summary')
    }
  }

  const startPayment = async () => {
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
        if (data.error === 'Already paid') {
          setState('already_paid')
          return
        }
        throw new Error(data.error || 'Failed to create payment session')
      }

      const { iframeUrl: url } = await res.json()
      setIframeUrl(url)
      setState('paying')

      // Start polling for payment completion
      startPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת תשלום')
      setState('error')
    }
  }

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      if (!appointmentId) return

      const { data } = await supabase.from('appointments')
        .select('payment_status')
        .eq('id', appointmentId)
        .single()

      if (data?.payment_status === 'completed') {
        if (pollRef.current) clearInterval(pollRef.current)
        setState('success')
        refreshInvoiceUrl(appointmentId)
      } else if (data?.payment_status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current)
        setState('failed')
      }
    }, 3000) // Poll every 3 seconds
  }, [appointmentId])

  const retryPayment = () => {
    setIframeUrl(null)
    setState('summary')
  }

  const refreshInvoiceUrl = async (id: string) => {
    const { data } = await supabase.from('appointments')
      .select('invoice_url')
      .eq('id', id)
      .single()
    if (data?.invoice_url) setInvoiceUrl(data.invoice_url as string)
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-500">טוען פרטי תשלום...</p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">&#x274C;</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">שגיאה</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button onClick={() => router.push('/dashboard/patient/dashboard')}>
              חזור לדשבורד
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">תשלום עבור ייעוץ</h2>

      {/* Payment Summary */}
      {appointment && (state === 'summary' || state === 'paying') && (
        <Card>
          <CardHeader>
            <h3 className="font-bold text-lg">פרטי התשלום</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Doctor info */}
            {doctor && (
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700">
                  {doctor.first_name.charAt(0)}{doctor.last_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">
                    ד&quot;ר {doctor.first_name} {doctor.last_name}
                  </p>
                  {doctor.specialties && (
                    <p className="text-sm text-gray-500">{doctor.specialties.join(', ')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Appointment details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">תלונה</span>
                <span className="font-medium">{appointment.chief_complaint}</span>
              </div>
              {appointment.requested_specialty && (
                <div className="flex justify-between">
                  <span className="text-gray-500">התמחות</span>
                  <span>{appointment.requested_specialty}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">משך ייעוץ</span>
                <span>{appointment.duration_minutes} דקות</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <span className="text-lg font-bold">סה&quot;כ לתשלום</span>
              <span className="text-2xl font-bold text-blue-600">
                {appointment.payment_amount ? formatPrice(appointment.payment_amount) : '—'}
              </span>
            </div>

            {/* Security note */}
            <p className="text-xs text-gray-400 text-center">
              התשלום מאובטח ומעובד על ידי Tranzila. פרטי כרטיס האשראי שלך לא נשמרים אצלנו.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pay button (before iframe) */}
      {state === 'summary' && (
        <Button onClick={startPayment} size="lg" className="w-full">
          עבור לתשלום — {appointment?.payment_amount ? formatPrice(appointment.payment_amount) : ''}
        </Button>
      )}

      {/* Tranzila iframe */}
      {state === 'paying' && iframeUrl && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">הזן פרטי תשלום</h3>
              <Badge variant="info">מאובטח</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <iframe
                src={iframeUrl}
                className="w-full border-0"
                style={{ height: '500px' }}
                title="טופס תשלום מאובטח"
                sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {state === 'success' && (
        <Card className="border-green-200">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">&#x2705;</span>
            </div>
            <h2 className="text-xl font-bold text-green-800">התשלום בוצע בהצלחה!</h2>
            <p className="text-gray-500">
              התור שלך אושר. תקבל הודעה עם פרטי השיחה.
            </p>
            {appointment?.payment_amount && (
              <p className="text-lg font-semibold text-green-700">
                {formatPrice(appointment.payment_amount)}
              </p>
            )}
            {invoiceUrl && (
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium"
              >
                <span>📄</span>
                הורד קבלה
              </a>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <Button onClick={() => router.push('/dashboard/patient/dashboard')}>
                חזור לדשבורד
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already Paid */}
      {state === 'already_paid' && (
        <Card className="border-blue-200">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">&#x2705;</span>
            </div>
            <h2 className="text-xl font-bold text-blue-800">תור זה כבר שולם</h2>
            <p className="text-gray-500">התשלום עבור תור זה כבר בוצע.</p>
            <Button onClick={() => router.push('/dashboard/patient/dashboard')}>
              חזור לדשבורד
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {state === 'failed' && (
        <Card className="border-red-200">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">&#x274C;</span>
            </div>
            <h2 className="text-xl font-bold text-red-800">התשלום נכשל</h2>
            <p className="text-gray-500">
              אירעה שגיאה בעיבוד התשלום. ניתן לנסות שוב.
            </p>
            <div className="flex gap-3 justify-center pt-4">
              <Button onClick={retryPayment}>נסה שוב</Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/patient/dashboard')}>
                חזור לדשבורד
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
