'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Card, CardContent, Badge, Spinner } from '@/components/ui'
import { cn, formatPrice } from '@/lib/utils'
import { PLANS, FEATURE_LABELS, type PlanId } from '@/lib/config/plans'
import { onboardingClinicSchema, onboardingBrandingSchema, onboardingAdminSchema } from '@/lib/validation/onboarding-schema'

type Step = 'clinic' | 'plan' | 'branding' | 'admin' | 'doctors' | 'complete'

const STEPS: { key: Step; label: string; num: number }[] = [
  { key: 'clinic', label: 'מרפאה', num: 1 },
  { key: 'plan', label: 'תוכנית', num: 2 },
  { key: 'branding', label: 'מיתוג', num: 3 },
  { key: 'admin', label: 'מנהל', num: 4 },
  { key: 'doctors', label: 'רופאים', num: 5 },
  { key: 'complete', label: 'סיום', num: 6 },
]

type DoctorInvite = { name: string; email: string }

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('clinic')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')

  // Form state
  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    subdomain: '',
    plan: 'pro' as PlanId,
    logo_url: '',
    primary_color: '#2563EB',
    secondary_color: '#7C3AED',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [doctors, setDoctors] = useState<DoctorInvite[]>([])

  // Subdomain availability
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)
  const [checkingSubdomain, setCheckingSubdomain] = useState(false)

  // Debounced subdomain check
  useEffect(() => {
    if (form.subdomain.length < 3) {
      setSubdomainAvailable(null)
      return
    }
    setCheckingSubdomain(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/check-subdomain?subdomain=${encodeURIComponent(form.subdomain)}`)
        const data = await res.json()
        setSubdomainAvailable(data.available)
      } catch {
        setSubdomainAvailable(null)
      } finally {
        setCheckingSubdomain(false)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [form.subdomain])

  const updateForm = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const validateStep = (currentStep: Step): boolean => {
    setErrors({})
    if (currentStep === 'clinic') {
      const result = onboardingClinicSchema.safeParse({
        name: form.name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        subdomain: form.subdomain,
      })
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of result.error.issues) {
          const field = issue.path[0] as string
          if (!fieldErrors[field]) fieldErrors[field] = issue.message
        }
        setErrors(fieldErrors)
        return false
      }
      if (subdomainAvailable === false) {
        setErrors({ subdomain: 'תת-דומיין זה לא זמין' })
        return false
      }
      return true
    }
    if (currentStep === 'branding') {
      const result = onboardingBrandingSchema.safeParse({
        logo_url: form.logo_url || undefined,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      })
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of result.error.issues) {
          const field = issue.path[0] as string
          if (!fieldErrors[field]) fieldErrors[field] = issue.message
        }
        setErrors(fieldErrors)
        return false
      }
      return true
    }
    if (currentStep === 'admin') {
      const result = onboardingAdminSchema.safeParse({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
      })
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of result.error.issues) {
          const field = issue.path[0] as string
          if (!fieldErrors[field]) fieldErrors[field] = issue.message
        }
        setErrors(fieldErrors)
        return false
      }
      return true
    }
    return true
  }

  const goNext = () => {
    if (!validateStep(step)) return
    const idx = STEPS.findIndex(s => s.key === step)
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].key)
    }
  }

  const goPrev = () => {
    const idx = STEPS.findIndex(s => s.key === step)
    if (idx > 0) setStep(STEPS[idx - 1].key)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          logo_url: form.logo_url || undefined,
          doctors: doctors.length > 0 ? doctors : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'שגיאה ביצירת המרפאה')
        setLoading(false)
        return
      }

      // Move to complete step
      setStep('complete')

      if (data.stripeCheckoutUrl) {
        // Redirect to Stripe after short delay
        setTimeout(() => {
          window.location.href = data.stripeCheckoutUrl
        }, 2000)
      } else {
        // Redirect to login
        setTimeout(() => {
          router.push(data.redirectUrl || '/auth/login?onboarding=success')
        }, 3000)
      }
    } catch {
      setSubmitError('שגיאה בחיבור לשרת')
    } finally {
      setLoading(false)
    }
  }

  const currentIdx = STEPS.findIndex(s => s.key === step)
  const selectedPlan = PLANS.find(p => p.id === form.plan)

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              i <= currentIdx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            )}>{s.num}</div>
            <span className={cn(
              'text-xs mr-1.5 hidden sm:block',
              i <= currentIdx ? 'text-blue-600 font-medium' : 'text-gray-400'
            )}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <div className={cn('h-0.5 flex-1 mx-2', i < currentIdx ? 'bg-blue-600' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Step 1: Clinic */}
          {step === 'clinic' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">פרטי המרפאה</h3>
              <p className="text-sm text-gray-500">ספרו לנו על המרפאה שלכם</p>

              <Input
                label="שם המרפאה"
                placeholder="לדוגמה: מרפאת שלום"
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                error={errors.name}
              />
              <Input
                label="אימייל ליצירת קשר"
                type="email"
                placeholder="clinic@example.com"
                value={form.contact_email}
                onChange={e => updateForm('contact_email', e.target.value)}
                error={errors.contact_email}
              />
              <Input
                label="טלפון המרפאה"
                type="tel"
                placeholder="03-1234567"
                value={form.contact_phone}
                onChange={e => updateForm('contact_phone', e.target.value)}
                error={errors.contact_phone}
              />

              <div className="space-y-1.5">
                <Input
                  label="תת-דומיין"
                  placeholder="my-clinic"
                  value={form.subdomain}
                  onChange={e => updateForm('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  error={errors.subdomain}
                  hint={form.subdomain.length >= 3 ? undefined : 'לפחות 3 תווים, אותיות קטנות באנגלית ומספרים'}
                />
                {form.subdomain.length >= 3 && (
                  <div className="flex items-center gap-2 text-sm">
                    {checkingSubdomain ? (
                      <><Spinner size="sm" /><span className="text-gray-400">בודק זמינות...</span></>
                    ) : subdomainAvailable === true ? (
                      <span className="text-green-600 font-medium">{form.subdomain}.telemed.co.il — זמין</span>
                    ) : subdomainAvailable === false ? (
                      <span className="text-red-600 font-medium">{form.subdomain}.telemed.co.il — תפוס</span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={goNext}>הבא</Button>
              </div>
            </div>
          )}

          {/* Step 2: Plan */}
          {step === 'plan' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg">בחר תוכנית</h3>
                <p className="text-sm text-gray-500">כל התוכניות כוללות 14 ימי ניסיון חינם</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PLANS.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => updateForm('plan', plan.id)}
                    className={cn(
                      'p-5 rounded-xl border-2 text-right transition-all relative',
                      form.plan === plan.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50',
                    )}
                  >
                    {plan.highlighted && (
                      <Badge variant="info" className="absolute top-3 left-3">מומלץ</Badge>
                    )}
                    <h4 className="font-bold text-lg">{plan.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-blue-600">
                        {plan.price_monthly === 0 ? 'חינם' : formatPrice(plan.price_monthly)}
                      </span>
                      {plan.price_monthly > 0 && <span className="text-sm text-gray-400 mr-1">/חודש</span>}
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-gray-600">
                      <p>עד {plan.max_doctors} רופאים</p>
                      <p>עד {plan.max_appointments_per_month.toLocaleString()} תורים/חודש</p>
                      <p>{plan.max_storage_gb} GB אחסון</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Feature comparison table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-right p-3 font-medium text-gray-700">יכולת</th>
                      {PLANS.map(p => (
                        <th key={p.id} className="p-3 text-center font-medium text-gray-700">{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                      <tr key={key} className="border-b last:border-b-0">
                        <td className="p-3 text-gray-600">{label}</td>
                        {PLANS.map(p => (
                          <td key={p.id} className="p-3 text-center">
                            {p.features[key] ? (
                              <span className="text-green-600 font-bold">V</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goPrev}>הקודם</Button>
                <Button onClick={goNext}>הבא</Button>
              </div>
            </div>
          )}

          {/* Step 3: Branding */}
          {step === 'branding' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">מיתוג המרפאה</h3>
              <p className="text-sm text-gray-500">התאימו את המראה של המערכת למרפאה שלכם</p>

              <Input
                label="לוגו (URL)"
                type="url"
                placeholder="https://example.com/logo.png"
                value={form.logo_url}
                onChange={e => updateForm('logo_url', e.target.value)}
                error={errors.logo_url}
                hint="אופציונלי — ניתן להוסיף גם מאוחר יותר"
              />

              {form.logo_url && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-2">תצוגה מקדימה:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.logo_url}
                    alt="לוגו"
                    className="h-16 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">צבע ראשי</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={e => updateForm('primary_color', e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.primary_color}
                      onChange={e => updateForm('primary_color', e.target.value)}
                      error={errors.primary_color}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">צבע משני</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.secondary_color}
                      onChange={e => updateForm('secondary_color', e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.secondary_color}
                      onChange={e => updateForm('secondary_color', e.target.value)}
                      error={errors.secondary_color}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="border rounded-xl overflow-hidden mt-4">
                <p className="text-xs text-gray-500 p-3 bg-gray-50 border-b">תצוגה מקדימה</p>
                <div className="p-4 space-y-3">
                  <div
                    className="h-12 rounded-lg flex items-center px-4"
                    style={{ backgroundColor: form.primary_color }}
                  >
                    <span className="text-white font-bold">{form.name || 'שם המרפאה'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: form.primary_color }}
                    >
                      כפתור ראשי
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: form.secondary_color }}
                    >
                      כפתור משני
                    </button>
                  </div>
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: form.secondary_color }}
                  >
                    תגית לדוגמה
                  </span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goPrev}>הקודם</Button>
                <Button onClick={goNext}>הבא</Button>
              </div>
            </div>
          )}

          {/* Step 4: Admin */}
          {step === 'admin' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">פרטי מנהל המרפאה</h3>
              <p className="text-sm text-gray-500">פרטי ההתחברות שלך למערכת</p>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="שם פרטי"
                  value={form.first_name}
                  onChange={e => updateForm('first_name', e.target.value)}
                  error={errors.first_name}
                />
                <Input
                  label="שם משפחה"
                  value={form.last_name}
                  onChange={e => updateForm('last_name', e.target.value)}
                  error={errors.last_name}
                />
              </div>

              <Input
                label="אימייל"
                type="email"
                placeholder="admin@clinic.com"
                value={form.email}
                onChange={e => updateForm('email', e.target.value)}
                error={errors.email}
              />

              <Input
                label="סיסמה"
                type="password"
                value={form.password}
                onChange={e => updateForm('password', e.target.value)}
                error={errors.password}
                hint="לפחות 8 תווים, אות גדולה, אות קטנה ומספר"
              />

              <Input
                label="אישור סיסמה"
                type="password"
                value={form.confirm_password}
                onChange={e => updateForm('confirm_password', e.target.value)}
                error={errors.confirm_password}
              />

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goPrev}>הקודם</Button>
                <Button onClick={goNext}>הבא</Button>
              </div>
            </div>
          )}

          {/* Step 5: Doctors */}
          {step === 'doctors' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">הזמנת רופאים</h3>
              <p className="text-sm text-gray-500">
                הוסיפו רופאים שתרצו להזמין למערכת. ההזמנות יישלחו לאחר הגדרת המרפאה.
              </p>

              {doctors.map((doc, i) => (
                <div key={i} className="flex items-end gap-3">
                  <Input
                    label={i === 0 ? 'שם הרופא' : undefined}
                    placeholder="ד״ר ישראל ישראלי"
                    value={doc.name}
                    onChange={e => {
                      const next = [...doctors]
                      next[i] = { ...next[i], name: e.target.value }
                      setDoctors(next)
                    }}
                    className="flex-1"
                  />
                  <Input
                    label={i === 0 ? 'אימייל' : undefined}
                    type="email"
                    placeholder="doctor@example.com"
                    value={doc.email}
                    onChange={e => {
                      const next = [...doctors]
                      next[i] = { ...next[i], email: e.target.value }
                      setDoctors(next)
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDoctors(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label="הסר רופא"
                    className="text-red-500 mb-1"
                  >
                    הסר
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDoctors(prev => [...prev, { name: '', email: '' }])}
                disabled={doctors.length >= (selectedPlan?.max_doctors || 1)}
              >
                + הוסף רופא
              </Button>

              {selectedPlan && (
                <p className="text-xs text-gray-400">
                  התוכנית שבחרת ({selectedPlan.name}) מאפשרת עד {selectedPlan.max_doctors} רופאים
                </p>
              )}

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                  {submitError}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goPrev}>הקודם</Button>
                <Button onClick={handleSubmit} loading={loading} size="lg">
                  סיים הרשמה
                </Button>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="text-sm text-blue-600 hover:underline w-full text-center"
              >
                דלג — אזמין רופאים אחר כך
              </button>
            </div>
          )}

          {/* Step 6: Complete */}
          {step === 'complete' && (
            <div className="text-center space-y-6 py-8">
              <div className="text-6xl">🎉</div>
              <h3 className="text-2xl font-bold text-gray-900">המרפאה נוצרה בהצלחה!</h3>
              <p className="text-gray-500">
                {form.name} מוכנה לשימוש.
                {form.plan !== 'free' && ' מעבירים אתכם לדף התשלום...'}
                {form.plan === 'free' && ' מעבירים אתכם לדף ההתחברות...'}
              </p>

              <div className="bg-gray-50 rounded-xl p-4 max-w-sm mx-auto space-y-2 text-sm text-right">
                <div className="flex justify-between">
                  <span className="text-gray-500">מרפאה</span>
                  <span className="font-medium">{form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">תוכנית</span>
                  <span className="font-medium">{selectedPlan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">דומיין</span>
                  <span className="font-medium">{form.subdomain}.telemed.co.il</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">מנהל</span>
                  <span className="font-medium">{form.first_name} {form.last_name}</span>
                </div>
              </div>

              <div className="flex justify-center">
                <Spinner />
              </div>

              <Button
                onClick={() => router.push('/auth/login?onboarding=success')}
                variant="outline"
              >
                עבור להתחברות
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
