'use client'

import { useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { forgotPasswordSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) { setError(result.error.errors[0].message); return }

    setLoading(true)
    setError('')
    try {
      const { error: err } = await getClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (err) {
        setError('שגיאה בשליחת האימייל. נסה שוב.')
        toast.error('שגיאה בשליחת האימייל')
      } else {
        setSent(true)
        toast.success('קישור לאיפוס סיסמה נשלח לאימייל שלך')
      }
    } catch {
      setError('שגיאה לא צפויה')
      toast.error('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={sent ? 'בדוק את האימייל' : 'שכחת סיסמה?'}
      subtitle={sent ? 'שלחנו קישור לאיפוס סיסמה' : 'הזן את האימייל שלך ונשלח קישור לאיפוס'}
    >
      {/* Success state */}
      <div className={cn(
        'transition-all duration-500',
        sent ? 'opacity-100 translate-y-0' : 'hidden'
      )}>
        <div className="text-center py-4">
          {/* Email sent illustration */}
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">נשלח בהצלחה!</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            שלחנו קישור לאיפוס סיסמה אל:
          </p>
          <p className="text-blue-600 font-medium text-sm mb-6 ltr" dir="ltr">{email}</p>

          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 mb-6 text-right">
            <p className="font-medium mb-1">לא קיבלת את האימייל?</p>
            <ul className="text-blue-600 space-y-1 text-xs">
              <li>בדוק את תיקיית הספאם/דואר זבל</li>
              <li>ודא שכתובת האימייל שהזנת נכונה</li>
              <li>
                <button
                  onClick={() => setSent(false)}
                  className="text-blue-700 font-medium hover:underline"
                >
                  נסה שוב עם אימייל אחר
                </button>
              </li>
            </ul>
          </div>

          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
            <span>חזרה להתחברות</span>
          </Link>
        </div>
      </div>

      {/* Form state */}
      <div className={cn(
        'transition-all duration-500',
        !sent ? 'opacity-100 translate-y-0' : 'hidden'
      )}>
        {/* Info banner */}
        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>הזן את כתובת האימייל שנרשמת איתה. נשלח לך קישור מאובטח לאיפוס הסיסמה.</span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            label="כתובת אימייל"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="doctor@clinic.co.il"
            autoComplete="email"
            error={error && !email ? 'שדה חובה' : undefined}
            required
          />

          <Button type="submit" loading={loading} className="w-full" size="lg">
            שלח קישור לאיפוס
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
      </div>
    </AuthLayout>
  )
}
