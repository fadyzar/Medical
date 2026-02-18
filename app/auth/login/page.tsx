'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validation/schemas'
import { Button, Input, Card, CardContent } from '@/components/ui'
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
  const [serverError, setServerError] = useState(errorParam === 'suspended' ? 'החשבון שלך הושעה. פנה למנהל.' : '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setServerError('')

    // Client validation
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
        setServerError(error.message === 'Invalid login credentials' ? 'אימייל או סיסמה שגויים' : 'שגיאה בהתחברות')
        setLoading(false)
        return
      }

      // Check is_active
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('role, is_active').eq('id', user.id).single()
        if (profile && !profile.is_active) {
          await supabase.auth.signOut()
          setServerError('החשבון שלך הושעה. פנה למנהל.')
          setLoading(false)
          return
        }

        // Update last login
        await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)

        // Redirect
        if (redirect) { router.push(redirect); return }
        const roleHome: Record<string, string> = { doctor: '/dashboard/doctor/dashboard', admin: '/dashboard/admin/dashboard', staff: '/dashboard/staff/dashboard' }
        router.push(roleHome[profile?.role || ''] || '/patient/dashboard')
      }
    } catch {
      setServerError('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">טלמדיסן</h1>
          <p className="text-gray-500 mt-2">ייעוץ רפואי אונליין</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-6">התחברות</h2>

            {onboardingSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" role="alert">
                המרפאה נוצרה בהצלחה! התחברו כדי להתחיל להשתמש במערכת.
              </div>
            )}

            {serverError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{serverError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

              <div className="flex justify-between items-center text-sm">
                <Link href="/forgot-password" className="text-blue-600 hover:underline">שכחת סיסמה?</Link>
              </div>

              <Button type="submit" loading={loading} className="w-full" size="lg">התחבר</Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              אין לך חשבון?{' '}
              <Link href="/register" className="text-blue-600 hover:underline font-medium">הירשם עכשיו</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
