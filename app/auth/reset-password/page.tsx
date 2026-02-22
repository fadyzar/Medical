'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => getClient(), [])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  // Listen for the PASSWORD_RECOVERY event from the auth link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if we already have a session (user clicked the link and landed here)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setSessionReady(true)
    }).catch(() => {
      // Network error — timeout fallback will handle this
    })

    // After a few seconds, if still no session, show error
    const timeout = setTimeout(() => {
      setSessionReady(prev => {
        if (!prev) setSessionError(true)
        return prev
      })
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים')
      return
    }
    if (!/[a-z]/.test(password)) {
      setError('הסיסמה חייבת להכיל אות קטנה')
      return
    }
    if (!/[A-Z]/.test(password)) {
      setError('הסיסמה חייבת להכיל אות גדולה')
      return
    }
    if (!/\d/.test(password)) {
      setError('הסיסמה חייבת להכיל מספר')
      return
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות לא תואמות')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        if (updateError.message.includes('same password')) {
          setError('הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית')
        } else {
          setError('שגיאה בעדכון הסיסמה. נסה שוב.')
        }
        return
      }

      setSuccess(true)

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/patient/dashboard')
      }, 2000)
    } catch {
      setError('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  // ── Session error: invalid or expired link ──────────────
  if (sessionError && !sessionReady) {
    return (
      <AuthLayout title="קישור לא תקין" subtitle="הקישור לאיפוס הסיסמה פג תוקף או שאינו תקין">
        <div className="text-center py-4">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">הקישור פג תוקף</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            קישורי איפוס סיסמה תקפים לזמן מוגבל. בקש קישור חדש.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            בקש קישור חדש
          </Link>
          <div className="mt-4">
            <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              חזרה להתחברות
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // ── Success state ───────────────────────────────────────
  if (success) {
    return (
      <AuthLayout title="הסיסמה שונתה" subtitle="הסיסמה החדשה נשמרה בהצלחה">
        <div className="text-center py-4">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">סיסמה עודכנה!</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            הסיסמה שלך שונתה בהצלחה. מעביר אותך לדשבורד...
          </p>
          <Link
            href="/dashboard/patient/dashboard"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            עבור לדשבורד
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Loading session state ───────────────────────────────
  if (!sessionReady) {
    return (
      <AuthLayout title="איפוס סיסמה" subtitle="מאמת את הקישור...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600" />
        </div>
      </AuthLayout>
    )
  }

  // ── Reset form ──────────────────────────────────────────
  return (
    <AuthLayout title="איפוס סיסמה" subtitle="הזן סיסמה חדשה לחשבון שלך">
      {/* Error */}
      {error && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>הסיסמה חייבת להכיל לפחות 8 תווים, אות קטנה, אות גדולה ומספר.</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="relative">
          <Input
            label="סיסמה חדשה"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-[38px] text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
          >
            {showPassword ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* Password strength hints */}
        {password.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {[
              { label: 'לפחות 8 תווים', met: password.length >= 8 },
              { label: 'אות קטנה (a-z)', met: /[a-z]/.test(password) },
              { label: 'אות גדולה (A-Z)', met: /[A-Z]/.test(password) },
              { label: 'מספר (0-9)', met: /\d/.test(password) },
            ].map((check, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {check.met ? (
                  <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
                <span className={cn('text-xs', check.met ? 'text-green-600' : 'text-gray-400')}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <Input
          label="אימות סיסמה חדשה"
          type="password"
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setError('') }}
          placeholder="••••••••"
          autoComplete="new-password"
          error={confirmPassword && password !== confirmPassword ? 'הסיסמאות לא תואמות' : undefined}
          required
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          עדכן סיסמה
        </Button>
      </form>

      <div className="text-center mt-6">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
          <span>חזרה להתחברות</span>
        </Link>
      </div>
    </AuthLayout>
  )
}
