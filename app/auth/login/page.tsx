'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import { Button, Input } from '@/components/ui'
import { AuthLayout } from '@/components/layout/AuthLayout'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const errorParam = searchParams.get('error')
  const onboardingSuccess = searchParams.get('onboarding') === 'success'

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(
    errorParam === 'suspended' ? 'החשבון שלך הושעה. פנה למנהל.' :
    errorParam === 'auth_failed' ? 'שגיאה באימות. נסה להתחבר שוב.' : ''
  )

  useEffect(() => {
    if (onboardingSuccess) toast.success('המרפאה נוצרה בהצלחה! התחברו כדי להתחיל.')
  }, [onboardingSuccess])

  const handleSubmit = async (e: React.FormEvent) => {
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

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('role, is_active').eq('id', user.id).single()
        if (profile && !profile.is_active) {
          await supabase.auth.signOut()
          setServerError('החשבון שלך הושעה. פנה למנהל.')
          toast.error('החשבון שלך הושעה')
          setLoading(false)
          return
        }

        await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)

        if (redirect) { router.push(redirect); return }
        const roleHome: Record<string, string> = { doctor: '/dashboard/doctor/dashboard', admin: '/dashboard/admin/dashboard', staff: '/dashboard/staff/dashboard' }
        router.push(roleHome[profile?.role || ''] || '/dashboard/patient/dashboard')
      }
    } catch {
      setServerError('שגיאה לא צפויה')
      toast.error('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
          <div className="flex justify-end mt-1.5">
            <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors">
              שכחת סיסמה?
            </Link>
          </div>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          התחבר
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center"><span className="bg-gray-50/50 px-3 text-xs text-gray-400">או</span></div>
      </div>

      {/* Register link */}
      <div className="text-center">
        <p className="text-sm text-gray-500">
          אין לך חשבון?{' '}
          <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors">
            הירשם עכשיו — חינם
          </Link>
        </p>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-gray-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-xs">SSL מאובטח</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-xs">תקן HIPAA</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-xs">מידע מוצפן</span>
        </div>
      </div>
    </AuthLayout>
  )
}
