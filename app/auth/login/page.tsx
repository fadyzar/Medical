'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import { Button, Input } from '@/components/ui'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const errorParam = searchParams.get('error')
  const onboardingSuccess = searchParams.get('onboarding') === 'success'

  // Login method toggle
  const [loginMethod, setLoginMethod] = useState<'email' | 'otp'>('email')

  // Email+password state
  const [form, setForm] = useState({ email: '', password: '' })
  const [rememberMe, setRememberMe] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(
    errorParam === 'suspended' ? 'החשבון שלך הושעה. פנה למנהל.' :
    errorParam === 'auth_failed' ? 'שגיאה באימות. נסה להתחבר שוב.' : ''
  )

  // OTP state
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone')
  const [otpPhone, setOtpPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  useEffect(() => {
    if (onboardingSuccess) toast.success('המרפאה נוצרה בהצלחה! התחברו כדי להתחיל.')
  }, [onboardingSuccess])

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = setTimeout(() => setOtpCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [otpCooldown])

  // Post-login handler (shared by email + OTP)
  const handlePostLogin = useCallback(async () => {
    const supabase = getClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('users').select('role, is_active').eq('id', user.id).single()
    if (profile && !profile.is_active) {
      await supabase.auth.signOut()
      setServerError('החשבון שלך הושעה. פנה למנהל.')
      toast.error('החשבון שלך הושעה')
      return
    }

    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)

    // Remember me logic
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true')
      localStorage.removeItem('sessionExpiresAt')
    } else {
      localStorage.removeItem('rememberMe')
      localStorage.setItem('sessionExpiresAt', String(Date.now() + 12 * 60 * 60 * 1000))
    }

    if (redirect) { router.push(redirect); return }
    const roleHome: Record<string, string> = { doctor: '/dashboard/doctor/dashboard', admin: '/dashboard/admin/dashboard', staff: '/dashboard/staff/dashboard' }
    router.push(roleHome[profile?.role || ''] || '/dashboard/patient/dashboard')
  }, [redirect, rememberMe, router])

  // ── Email+Password submit ──────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setServerError('')

    const result = loginSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => { if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const supabase = getClient()
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })

      if (error) {
        const msg = error.message === 'Invalid login credentials' ? 'אימייל או סיסמה שגויים' : 'שגיאה בהתחברות'
        setServerError(msg)
        toast.error(msg)
        setLoading(false)
        return
      }

      await handlePostLogin()
    } catch {
      setServerError('שגיאה לא צפויה')
      toast.error('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  // ── OTP: Send code ─────────────────────────────────
  const handleSendOtp = async () => {
    setServerError('')

    if (!/^0[2-9]\d{7,8}$/.test(otpPhone)) {
      setServerError('מספר טלפון לא תקין (לדוגמה: 0501234567)')
      return
    }

    setOtpLoading(true)
    try {
      const supabase = getClient()
      const intlPhone = '+972' + otpPhone.replace(/^0/, '')
      const { error } = await supabase.auth.signInWithOtp({ phone: intlPhone })

      if (error) {
        const msg = error.message.includes('not found') || error.message.includes('Phone')
          ? 'מספר הטלפון לא נמצא במערכת'
          : 'שגיאה בשליחת הקוד. נסה שוב.'
        setServerError(msg)
        toast.error(msg)
        return
      }

      setOtpStep('code')
      setOtpCooldown(60)
      toast.success('קוד אימות נשלח לטלפון שלך')
    } catch {
      setServerError('שגיאה בשליחת הקוד')
      toast.error('שגיאה בשליחת הקוד')
    } finally {
      setOtpLoading(false)
    }
  }

  // ── OTP: Verify code ───────────────────────────────
  const handleVerifyOtp = async () => {
    setServerError('')

    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setServerError('קוד אימות חייב להכיל 6 ספרות')
      return
    }

    setOtpLoading(true)
    try {
      const supabase = getClient()
      const intlPhone = '+972' + otpPhone.replace(/^0/, '')
      const { error } = await supabase.auth.verifyOtp({
        phone: intlPhone,
        token: otpCode,
        type: 'sms',
      })

      if (error) {
        const msg = error.message.includes('expired')
          ? 'הקוד פג תוקף. שלח קוד חדש.'
          : error.message.includes('Invalid') || error.message.includes('invalid')
            ? 'קוד שגוי. נסה שוב.'
            : 'שגיאה באימות הקוד'
        setServerError(msg)
        toast.error(msg)
        return
      }

      await handlePostLogin()
    } catch {
      setServerError('שגיאה באימות הקוד')
      toast.error('שגיאה באימות הקוד')
    } finally {
      setOtpLoading(false)
    }
  }

  // ── OTP: Resend code ───────────────────────────────
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return
    await handleSendOtp()
  }

  return (
    <AuthLayout title="התחברות" subtitle="הזן את פרטי ההתחברות כדי להיכנס לחשבון">
      {/* Server error */}
      {serverError && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* Method toggle tabs */}
      <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
        <button
          type="button"
          onClick={() => { setLoginMethod('email'); setServerError('') }}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
            loginMethod === 'email'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          אימייל וסיסמה
        </button>
        <button
          type="button"
          onClick={() => { setLoginMethod('otp'); setServerError('') }}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
            loginMethod === 'otp'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          קוד SMS
        </button>
      </div>

      {/* ── Email + Password Form ──────────────────────── */}
      {loginMethod === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-5" noValidate>
          <Input
            label="אימייל"
            type="email"
            placeholder="doctor@clinic.co.il"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            error={errors.email}
            autoComplete="email"
            required
          />

          <div>
            <Input
              label="סיסמה"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              error={errors.password}
              autoComplete="current-password"
              required
            />
            <div className="flex items-center justify-between mt-2">
              {/* Remember me */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={cn(
                    'w-4 h-4 rounded border-2 transition-all flex items-center justify-center',
                    rememberMe
                      ? 'bg-teal-600 border-teal-600'
                      : 'border-slate-300 group-hover:border-teal-400'
                  )}>
                    {rememberMe && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-500">זכור אותי</span>
              </label>

              <Link href="/auth/forgot-password" className="text-sm text-teal-600 hover:text-teal-700 hover:underline transition-colors">
                שכחת סיסמה?
              </Link>
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-full" size="lg">
            התחבר
          </Button>
        </form>
      )}

      {/* ── OTP SMS Form ───────────────────────────────── */}
      {loginMethod === 'otp' && (
        <div className="space-y-5">
          {otpStep === 'phone' ? (
            <>
              <Input
                label="מספר טלפון"
                type="tel"
                placeholder="0501234567"
                value={otpPhone}
                onChange={e => { setOtpPhone(e.target.value); setServerError('') }}
                autoComplete="tel"
                required
              />
              <p className="text-xs text-slate-400 -mt-3">נשלח קוד אימות חד-פעמי ב-SMS למספר שלך</p>
              <Button
                type="button"
                onClick={handleSendOtp}
                loading={otpLoading}
                className="w-full"
                size="lg"
              >
                שלח קוד
              </Button>
            </>
          ) : (
            <>
              <div className="text-center mb-2">
                <p className="text-sm text-slate-600">
                  קוד אימות נשלח למספר <span className="font-semibold text-slate-900 direction-ltr inline-block">{otpPhone}</span>
                </p>
                <button
                  type="button"
                  onClick={() => { setOtpStep('phone'); setOtpCode(''); setServerError('') }}
                  className="text-xs text-teal-600 hover:underline mt-1"
                >
                  שנה מספר
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">קוד אימות</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setServerError('') }}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  autoComplete="one-time-code"
                  dir="ltr"
                />
              </div>

              <Button
                type="button"
                onClick={handleVerifyOtp}
                loading={otpLoading}
                className="w-full"
                size="lg"
                disabled={otpCode.length !== 6}
              >
                אמת קוד
              </Button>

              <div className="text-center">
                {otpCooldown > 0 ? (
                  <p className="text-xs text-slate-400">שלח שוב בעוד {otpCooldown} שניות</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-sm text-teal-600 hover:text-teal-700 hover:underline transition-colors"
                  >
                    שלח קוד חדש
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-slate-50/50 px-3 text-xs text-slate-400">או</span></div>
      </div>

      {/* Register link */}
      <div className="text-center">
        <p className="text-sm text-slate-500">
          אין לך חשבון?{' '}
          <Link href="/auth/register" className="text-teal-600 hover:text-teal-700 font-semibold hover:underline transition-colors">
            הירשם עכשיו — חינם
          </Link>
        </p>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-xs">SSL מאובטח</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-xs">תקן HIPAA</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-xs">מידע מוצפן</span>
        </div>
      </div>
    </AuthLayout>
  )
}
