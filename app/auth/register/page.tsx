'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { registerSchema, doctorRegisterSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import { Button, Input, Select } from '@/components/ui'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { cn } from '@/lib/utils'
import { SPECIALTIES } from '@/lib/utils'
import Link from 'next/link'

// ── Password strength calculator ─────────────────────────

interface PasswordStrength {
  score: number       // 0-4
  label: string
  color: string
  checks: { label: string; met: boolean }[]
}

function getPasswordStrength(password: string): PasswordStrength {
  const checks = [
    { label: 'לפחות 8 תווים', met: password.length >= 8 },
    { label: 'אות קטנה (a-z)', met: /[a-z]/.test(password) },
    { label: 'אות גדולה (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'מספר (0-9)', met: /\d/.test(password) },
    { label: 'תו מיוחד (!@#$)', met: /[^a-zA-Z0-9]/.test(password) },
  ]

  const score = checks.filter(c => c.met).length

  const levels: Record<number, { label: string; color: string }> = {
    0: { label: '', color: '' },
    1: { label: 'חלשה מאוד', color: 'bg-red-500' },
    2: { label: 'חלשה', color: 'bg-orange-500' },
    3: { label: 'בינונית', color: 'bg-yellow-500' },
    4: { label: 'חזקה', color: 'bg-blue-500' },
    5: { label: 'חזקה מאוד', color: 'bg-green-500' },
  }

  return { score, checks, ...levels[score] }
}

// ── Step indicator ───────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <div key={step} className="flex items-center gap-3 flex-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shrink-0',
              isDone
                ? 'bg-green-500 text-white'
                : isActive
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-500'
            )}>
              {isDone ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : step}
            </div>
            {step < total && (
              <div className={cn(
                'flex-1 h-0.5 rounded-full transition-colors duration-300',
                isDone ? 'bg-green-500' : 'bg-gray-200'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Role labels ──────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  patient: 'מטופל',
  doctor: 'רופא',
  admin: 'מנהל',
  staff: 'צוות',
}

// ── Component ────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Invite params
  const isInvite = searchParams.get('invite') === 'true'
  const inviteOrg = searchParams.get('org') || ''
  const inviteEmail = searchParams.get('email') || ''
  const inviteRole = searchParams.get('role') || ''

  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor'>(
    isInvite && (inviteRole === 'doctor' || inviteRole === 'admin' || inviteRole === 'staff') ? inviteRole as 'doctor' : 'patient'
  )
  const [form, setForm] = useState({
    first_name: '', last_name: '',
    email: isInvite ? inviteEmail : '',
    phone: '',
    password: '', confirm_password: '',
    id_number: '', date_of_birth: '', gender: '' as string,
    agree_terms: false,
    // Doctor fields
    license_number: '',
    specialties: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password])

  // Determine actual role (invite overrides selection for admin/staff)
  const effectiveRole = isInvite && (inviteRole === 'admin' || inviteRole === 'staff')
    ? inviteRole
    : selectedRole

  const isDoctor = effectiveRole === 'doctor'

  const updateField = (field: string, value: string | boolean | string[]) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => { const n = { ...p }; delete n[field]; return n })
  }

  const toggleSpecialty = (id: string) => {
    setForm(p => {
      const specs = p.specialties.includes(id)
        ? p.specialties.filter(s => s !== id)
        : [...p.specialties, id]
      return { ...p, specialties: specs }
    })
    setErrors(p => { const n = { ...p }; delete n.specialties; return n })
  }

  const validateStep1 = () => {
    const errs: Record<string, string> = {}
    if (form.first_name.length < 2) errs.first_name = 'שם פרטי חייב להכיל לפחות 2 תווים'
    if (form.last_name.length < 2) errs.last_name = 'שם משפחה חייב להכיל לפחות 2 תווים'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'אימייל לא תקין'
    if (!/^0[2-9]\d{7,8}$/.test(form.phone)) errs.phone = 'מספר טלפון לא תקין (לדוגמה: 0501234567)'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    // Validate using appropriate schema
    const schema = isDoctor ? doctorRegisterSchema : registerSchema
    const dataToValidate = isDoctor
      ? form
      : { ...form, license_number: undefined, specialties: undefined }
    const result = schema.safeParse(dataToValidate)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => { if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const supabase = getClient()
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            role: effectiveRole,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) {
        const msg = error.message.includes('already registered') ? 'משתמש עם אימייל זה כבר קיים. נסה להתחבר.' : 'שגיאה בהרשמה: ' + error.message
        setServerError(msg)
        toast.error(msg)
        setLoading(false)
        return
      }

      // Supabase returns user with empty identities array for duplicate emails
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setServerError('משתמש עם אימייל זה כבר קיים. נסה להתחבר.')
        toast.error('משתמש עם אימייל זה כבר קיים')
        setLoading(false)
        return
      }

      // If email confirmation is required, user won't have a session yet
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // User is logged in (email confirmation disabled) — update profile
        await new Promise(resolve => setTimeout(resolve, 500))
        try {
          const profileUpdate: Record<string, unknown> = {
            phone: form.phone,
            id_number: form.id_number || null,
            date_of_birth: form.date_of_birth || null,
            gender: (form.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say') || null,
            role: effectiveRole,
          }

          // Doctor-specific fields
          if (isDoctor) {
            profileUpdate.license_number = form.license_number
            profileUpdate.specialties = form.specialties
          }

          // Invite: set organization
          if (isInvite && inviteOrg) {
            profileUpdate.organization_id = inviteOrg
          }

          await supabase.from('users').update(profileUpdate).eq('id', user.id)
        } catch {
          // Non-critical — user can complete profile later
        }

        toast.success('נרשמת בהצלחה!')
        const roleHome: Record<string, string> = {
          doctor: '/dashboard/doctor/dashboard',
          admin: '/dashboard/admin/dashboard',
          staff: '/dashboard/staff/dashboard',
        }
        router.push(roleHome[effectiveRole] || '/dashboard/patient/dashboard')
      } else {
        // Email confirmation is required — show success message
        setEmailSent(true)
        toast.success('נרשמת בהצלחה! בדוק את האימייל לאימות.')
      }
    } catch {
      setServerError('שגיאה לא צפויה')
      toast.error('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  // ── Email confirmation sent state ─────────────────────
  if (emailSent) {
    return (
      <AuthLayout title="בדוק את האימייל" subtitle="שלחנו לך קישור לאימות">
        <div className="text-center py-4">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,7 12,13 2,7" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">בדוק את תיבת הדואר</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            שלחנו קישור אימות לכתובת:
          </p>
          <p className="font-medium text-gray-900 mb-6">{form.email}</p>
          <p className="text-gray-400 text-xs leading-relaxed mb-6">
            לא קיבלת? בדוק בתיקיית הספאם או נסה להירשם שוב.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            עבור להתחברות
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={isInvite ? 'השלמת הרשמה' : 'הרשמה'}
      subtitle={isInvite ? `הוזמנת להצטרף כ${ROLE_LABELS[effectiveRole] || effectiveRole}` : 'צור חשבון חדש תוך דקה'}
    >
      {/* Step indicator */}
      <StepIndicator current={step} total={2} />

      {/* Invite banner */}
      {isInvite && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700" role="status">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>הוזמנת להצטרף כ<strong>{ROLE_LABELS[effectiveRole] || effectiveRole}</strong> למרפאה. השלם את ההרשמה כדי להתחיל.</span>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Step 1: Personal details ─────────────────── */}
        <div className={cn(
          'transition-all duration-300',
          step === 1 ? 'opacity-100 translate-x-0' : 'hidden'
        )}>
          <div className="space-y-4">
            {/* Role selector — only show for self-registration */}
            {!isInvite && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">אני נרשם בתור</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('patient')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                      selectedRole === 'patient'
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}
                  >
                    <svg className={cn('w-8 h-8', selectedRole === 'patient' ? 'text-blue-600' : 'text-gray-400')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className={cn('text-sm font-semibold', selectedRole === 'patient' ? 'text-blue-700' : 'text-gray-600')}>מטופל</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('doctor')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                      selectedRole === 'doctor'
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}
                  >
                    <svg className={cn('w-8 h-8', selectedRole === 'doctor' ? 'text-blue-600' : 'text-gray-400')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3" />
                      <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" />
                    </svg>
                    <span className={cn('text-sm font-semibold', selectedRole === 'doctor' ? 'text-blue-700' : 'text-gray-600')}>רופא</span>
                  </button>
                </div>
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-900 mb-1">פרטים אישיים</h2>
            <p className="text-sm text-gray-500 mb-4">מלא את הפרטים הבסיסיים להרשמה</p>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="שם פרטי"
                value={form.first_name}
                onChange={e => updateField('first_name', e.target.value)}
                error={errors.first_name}
                placeholder="ישראל"
                autoComplete="given-name"
                required
              />
              <Input
                label="שם משפחה"
                value={form.last_name}
                onChange={e => updateField('last_name', e.target.value)}
                error={errors.last_name}
                placeholder="ישראלי"
                autoComplete="family-name"
                required
              />
            </div>

            <Input
              label="אימייל"
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              error={errors.email}
              placeholder="israel@example.co.il"
              autoComplete="email"
              required
              readOnly={isInvite && !!inviteEmail}
              className={isInvite && inviteEmail ? 'bg-gray-100 cursor-not-allowed' : ''}
            />

            <Input
              label="טלפון"
              type="tel"
              placeholder="0501234567"
              value={form.phone}
              onChange={e => updateField('phone', e.target.value)}
              error={errors.phone}
              autoComplete="tel"
              required
            />

            <Button
              type="button"
              onClick={() => { if (validateStep1()) setStep(2) }}
              className="w-full"
              size="lg"
            >
              המשך לשלב הבא
            </Button>
          </div>
        </div>

        {/* ── Step 2: Security & extras ────────────────── */}
        <div className={cn(
          'transition-all duration-300',
          step === 2 ? 'opacity-100 translate-x-0' : 'hidden'
        )}>
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">אבטחה ופרטים נוספים</h2>
            <p className="text-sm text-gray-500 mb-4">הגדר סיסמה והשלם את הפרופיל</p>

            {/* Password with strength indicator */}
            <div>
              <div className="relative">
                <Input
                  label="סיסמה"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => updateField('password', e.target.value)}
                  error={errors.password}
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

              {/* Strength bar */}
              {form.password.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-all duration-300',
                          i <= passwordStrength.score ? passwordStrength.color : 'bg-gray-200'
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-xs font-medium',
                      passwordStrength.score <= 2 ? 'text-red-600' :
                      passwordStrength.score <= 3 ? 'text-yellow-600' :
                      'text-green-600'
                    )}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  {/* Checklist */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {passwordStrength.checks.slice(0, 4).map((check, i) => (
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
                </div>
              )}
            </div>

            <Input
              label="אימות סיסמה"
              type="password"
              value={form.confirm_password}
              onChange={e => updateField('confirm_password', e.target.value)}
              error={errors.confirm_password}
              autoComplete="new-password"
              required
            />

            {/* Doctor-specific fields */}
            {isDoctor && (
              <div className="border-t border-blue-100 pt-4">
                <p className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3" />
                    <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" />
                  </svg>
                  פרטים מקצועיים
                </p>

                <Input
                  label="מספר רישיון רופא"
                  value={form.license_number}
                  onChange={e => updateField('license_number', e.target.value)}
                  error={errors.license_number}
                  placeholder="12345"
                  required
                />

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    התמחויות <span className="text-red-500">*</span>
                  </label>
                  {errors.specialties && <p className="text-sm text-red-600 mb-2">{errors.specialties}</p>}
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {SPECIALTIES.map(spec => (
                      <label
                        key={spec.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm',
                          form.specialties.includes(spec.id)
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={form.specialties.includes(spec.id)}
                          onChange={() => toggleSpecialty(spec.id)}
                          className="sr-only"
                        />
                        <div className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                          form.specialties.includes(spec.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        )}>
                          {form.specialties.includes(spec.id) && (
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        {spec.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Optional fields (patient) */}
            {!isDoctor && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-3">שדות אופציונליים — ניתן להשלים אחר כך</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="תעודת זהות"
                    value={form.id_number}
                    onChange={e => updateField('id_number', e.target.value)}
                    placeholder="000000000"
                  />
                  <Input
                    label="תאריך לידה"
                    type="date"
                    value={form.date_of_birth}
                    onChange={e => updateField('date_of_birth', e.target.value)}
                  />
                </div>
                <div className="mt-3">
                  <Select
                    label="מגדר"
                    value={form.gender}
                    onChange={e => updateField('gender', e.target.value)}
                    placeholder="בחר"
                    options={[
                      { value: 'male', label: 'זכר' },
                      { value: 'female', label: 'נקבה' },
                      { value: 'other', label: 'אחר' },
                      { value: 'prefer_not_to_say', label: 'מעדיף/ה לא לציין' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Terms checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={form.agree_terms}
                  onChange={e => updateField('agree_terms', e.target.checked)}
                  className="peer sr-only"
                />
                <div className={cn(
                  'w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center',
                  form.agree_terms
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 group-hover:border-blue-400',
                  errors.agree_terms && 'border-red-400'
                )}>
                  {form.agree_terms && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-600 leading-relaxed">
                אני מסכים/ה ל<Link href="/terms" className="text-blue-600 font-medium hover:underline" target="_blank">תנאי השימוש</Link>{' '}
                ול<Link href="/privacy" className="text-blue-600 font-medium hover:underline" target="_blank">מדיניות הפרטיות</Link>
              </span>
            </label>
            {errors.agree_terms && <p className="text-sm text-red-600 -mt-2">{errors.agree_terms}</p>}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1" size="lg">
                חזור
              </Button>
              <Button type="submit" loading={loading} className="flex-1" size="lg">
                צור חשבון
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Login link */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          כבר יש לך חשבון?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors">
            התחבר
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
