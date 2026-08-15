'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Input } from '@/components/ui'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  doctor: 'רופא',
  staff: 'איש צוות',
  admin: 'מנהל',
}

const ROLE_COLORS: Record<string, string> = {
  doctor:  'bg-teal-100 text-teal-700 border-teal-200',
  staff:   'bg-purple-100 text-purple-700 border-purple-200',
  admin:   'bg-amber-100 text-amber-700 border-amber-200',
}

interface Props {
  token: string
  email: string
  role: string
  orgName: string
  orgId: string
}

export default function InviteForm({ token, email, role, orgName, orgId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (field: string, value: string) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => { const n = { ...p }; delete n[field]; return n })
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (form.first_name.length < 2) errs.first_name = 'שם פרטי חייב להכיל לפחות 2 תווים'
    if (form.last_name.length < 2) errs.last_name = 'שם משפחה חייב להכיל לפחות 2 תווים'
    if (form.password.length < 8) errs.password = 'סיסמה חייבת להכיל לפחות 8 תווים'
    if (form.password !== form.confirm_password) errs.confirm_password = 'הסיסמאות אינן תואמות'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const supabase = getClient()

      // Register with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            role,
            invite_token: token,
            organization_id: orgId,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) {
        const msg = error.message.includes('already registered')
          ? 'משתמש עם אימייל זה כבר קיים. נסה להתחבר.'
          : 'שגיאה בהרשמה: ' + error.message
        toast.error(msg)
        setLoading(false)
        return
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error('משתמש עם אימייל זה כבר קיים. נסה להתחבר.')
        setLoading(false)
        return
      }

      // Check if user is immediately logged in (no email confirmation)
      const { data: { user: loggedIn } } = await supabase.auth.getUser()
      if (loggedIn) {
        // Update profile fields not set by trigger
        await supabase.from('users').update({
          phone: null,
          first_name: form.first_name,
          last_name: form.last_name,
        }).eq('id', loggedIn.id)

        // Accept the invite → sets role + org
        const res = await fetch('/api/auth/invite-accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        if (!res.ok) {
          const body = await res.json() as { error?: string }
          toast.error(body.error || 'שגיאה בעיבוד ההזמנה')
          setLoading(false)
          return
        }

        toast.success('ברוך הבא! ההרשמה הושלמה.')

        // Redirect based on role
        const dashboards: Record<string, string> = {
          doctor: '/dashboard/doctor/dashboard',
          staff:  '/dashboard/staff/dashboard',
          admin:  '/dashboard/admin/dashboard',
        }
        router.push(dashboards[role] || '/dashboard/patient/dashboard')
      } else {
        // Email confirmation required — show message
        toast.success('נרשמת! בדוק את האימייל לאימות החשבון.')
        router.push('/auth/login')
      }
    } catch {
      toast.error('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Invite badge */}
      <div className={`inline-flex items-center gap-2 border text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-6 ${ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
        {ROLE_LABELS[role] ?? role} — {orgName}
      </div>

      <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 leading-relaxed">
        <p>האימייל <strong>{email}</strong> מוגדר להזמנה זו ולא ניתן לשינוי.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="שם פרטי"
            value={form.first_name}
            onChange={e => update('first_name', e.target.value)}
            error={errors.first_name}
            placeholder="ישראל"
            autoComplete="given-name"
            required
          />
          <Input
            label="שם משפחה"
            value={form.last_name}
            onChange={e => update('last_name', e.target.value)}
            error={errors.last_name}
            placeholder="ישראלי"
            autoComplete="family-name"
            required
          />
        </div>

        <div className="relative">
          <Input
            label="סיסמה"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={e => update('password', e.target.value)}
            error={errors.password}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-[38px] text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
          >
            {showPassword ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        <Input
          label="אימות סיסמה"
          type="password"
          value={form.confirm_password}
          onChange={e => update('confirm_password', e.target.value)}
          error={errors.confirm_password}
          autoComplete="new-password"
          required
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          השלם הרשמה
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        כבר יש לך חשבון?{' '}
        <Link href="/auth/login" className="text-teal-600 font-semibold hover:underline">התחבר</Link>
      </p>
    </div>
  )
}
