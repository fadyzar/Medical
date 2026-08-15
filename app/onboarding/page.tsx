'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Card, CardContent, Badge, Spinner } from '@/components/ui'
import { cn, formatPrice } from '@/lib/utils'
import { PLANS, FEATURE_LABELS, type PlanId } from '@/lib/config/plans'
import { onboardingClinicSchema, onboardingAdminSchema, onboardingBrandingSchema } from '@/lib/validation/onboarding-schema'
import { toast } from 'sonner'
import { getClient } from '@/lib/supabase/client'

type Step = 'clinic' | 'plan' | 'branding' | 'doctor' | 'complete'

const STEPS: { key: Step; label: string; num: number }[] = [
  { key: 'clinic', label: 'מרפאה', num: 1 },
  { key: 'plan', label: 'תוכנית', num: 2 },
  { key: 'branding', label: 'מיתוג', num: 3 },
  { key: 'doctor', label: 'רופא', num: 4 },
  { key: 'complete', label: 'סיום', num: 5 },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('clinic')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')

  // Form state
  const [form, setForm] = useState({
    // Clinic
    name: '',
    contact_email: '',
    contact_phone: '',
    subdomain: '',
    // Admin
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    // Plan
    plan: 'pro' as PlanId,
    // Branding
    logo_url: '',
    primary_color: '#2563EB',
    secondary_color: '#7C3AED',
  })

  // Doctor invite
  const [doctorName, setDoctorName] = useState('')
  const [doctorEmail, setDoctorEmail] = useState('')

  // Logo file upload
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Logo file handling
  const handleLogoSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, logo: 'יש לבחור קובץ תמונה' }))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, logo: 'הקובץ גדול מדי (מקסימום 2MB)' }))
      return
    }

    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setErrors(prev => { const n = { ...prev }; delete n.logo; return n })

    // Upload to Supabase Storage
    setUploadingLogo(true)
    try {
      const supabase = getClient()
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `onboarding/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { data, error } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { contentType: file.type, upsert: false })

      if (error) {
        // Storage not configured — just use preview, logo will be optional
        console.warn('Logo upload skipped:', error.message)
      } else if (data) {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(data.path)
        if (urlData?.publicUrl) {
          setForm(prev => ({ ...prev, logo_url: urlData.publicUrl }))
        }
      }
    } catch {
      // Non-critical — logo is optional
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleLogoSelect(file)
  }

  const removeLogo = () => {
    setLogoFile(null)
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoPreview(null)
    setForm(prev => ({ ...prev, logo_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validateStep = (currentStep: Step): boolean => {
    setErrors({})

    if (currentStep === 'clinic') {
      // Validate clinic fields
      const clinicResult = onboardingClinicSchema.safeParse({
        name: form.name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        subdomain: form.subdomain,
      })
      // Validate admin fields
      const adminResult = onboardingAdminSchema.safeParse({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
      })

      const fieldErrors: Record<string, string> = {}

      if (!clinicResult.success) {
        for (const issue of clinicResult.error.issues) {
          const field = issue.path[0] as string
          if (!fieldErrors[field]) fieldErrors[field] = issue.message
        }
      }
      if (!adminResult.success) {
        for (const issue of adminResult.error.issues) {
          const field = issue.path[0] as string
          if (!fieldErrors[field]) fieldErrors[field] = issue.message
        }
      }

      if (subdomainAvailable === false) {
        fieldErrors.subdomain = 'תת-דומיין זה לא זמין'
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
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

    if (currentStep === 'doctor') {
      // Doctor invite is optional — validate only if fields are filled
      if (doctorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doctorEmail)) {
        setErrors({ doctorEmail: 'כתובת אימייל לא תקינה' })
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
      const doctors = doctorEmail.trim()
        ? [{ name: doctorName.trim() || 'רופא', email: doctorEmail.trim() }]
        : undefined

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          logo_url: form.logo_url || undefined,
          doctors,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'שגיאה ביצירת המרפאה')
        toast.error(data.error || 'שגיאה ביצירת המרפאה')
        setLoading(false)
        return
      }

      setStep('complete')
      toast.success('המרפאה נוצרה בהצלחה!')

      if (data.stripeCheckoutUrl) {
        setTimeout(() => {
          window.location.href = data.stripeCheckoutUrl
        }, 2000)
      } else {
        setTimeout(() => {
          router.push(data.redirectUrl || '/auth/login?onboarding=success')
        }, 3000)
      }
    } catch {
      setSubmitError('שגיאה בחיבור לשרת')
      toast.error('שגיאה בחיבור לשרת')
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
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors',
              i < currentIdx ? 'bg-green-500 text-white' :
              i === currentIdx ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
            )}>
              {i < currentIdx ? '✓' : s.num}
            </div>
            <span className={cn(
              'text-xs mr-1.5 hidden sm:block',
              i <= currentIdx ? 'text-teal-600 font-medium' : 'text-slate-400'
            )}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <div className={cn('h-0.5 flex-1 mx-2 transition-colors', i < currentIdx ? 'bg-green-500' : 'bg-slate-200')} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Step 1: Clinic + Admin */}
          {step === 'clinic' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg">פרטי המרפאה</h3>
                <p className="text-sm text-slate-500">ספרו לנו על המרפאה ועל מנהל המערכת</p>
              </div>

              {/* Clinic info */}
              <div className="space-y-4">
                <Input
                  label="שם המרפאה"
                  placeholder="לדוגמה: מרפאת שלום"
                  value={form.name}
                  onChange={e => updateForm('name', e.target.value)}
                  error={errors.name}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>

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
                        <><Spinner size="sm" /><span className="text-slate-400">בודק זמינות...</span></>
                      ) : subdomainAvailable === true ? (
                        <span className="text-green-600 font-medium">{form.subdomain}.cannaforyou.net — זמין ✓</span>
                      ) : subdomainAvailable === false ? (
                        <span className="text-red-600 font-medium">{form.subdomain}.cannaforyou.net — תפוס</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-6">
                <h4 className="font-bold text-base mb-1">פרטי מנהל המרפאה</h4>
                <p className="text-sm text-slate-500 mb-4">פרטי ההתחברות שלך למערכת</p>

                <div className="space-y-4">
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
                    label="אימייל מנהל"
                    type="email"
                    placeholder="admin@clinic.com"
                    value={form.email}
                    onChange={e => updateForm('email', e.target.value)}
                    error={errors.email}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={goNext}>המשך לבחירת תוכנית</Button>
              </div>
            </div>
          )}

          {/* Step 2: Plan */}
          {step === 'plan' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg">בחרו תוכנית</h3>
                <p className="text-sm text-slate-500">כל התוכניות כוללות 14 ימי ניסיון חינם</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PLANS.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => updateForm('plan', plan.id)}
                    className={cn(
                      'p-5 rounded-xl border-2 text-right transition-all relative',
                      form.plan === plan.id
                        ? 'border-teal-500 bg-teal-50 shadow-md'
                        : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50',
                    )}
                  >
                    {plan.highlighted && (
                      <Badge variant="info" className="absolute top-3 left-3">מומלץ</Badge>
                    )}
                    <h4 className="font-bold text-lg">{plan.name}</h4>
                    <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-teal-600">
                        {plan.price_monthly === 0 ? 'חינם' : formatPrice(plan.price_monthly)}
                      </span>
                      {plan.price_monthly > 0 && <span className="text-sm text-slate-400 mr-1">/חודש</span>}
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>עד {plan.max_doctors} רופאים</p>
                      <p>עד {plan.max_appointments_per_month.toLocaleString()} תורים/חודש</p>
                      <p>{plan.max_storage_gb} GB אחסון</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Feature comparison */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-right p-3 font-medium text-slate-700">יכולת</th>
                      {PLANS.map(p => (
                        <th key={p.id} className={cn(
                          'p-3 text-center font-medium',
                          form.plan === p.id ? 'text-teal-700 bg-teal-50' : 'text-slate-700'
                        )}>{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                      <tr key={key} className="border-b last:border-b-0">
                        <td className="p-3 text-slate-600">{label}</td>
                        {PLANS.map(p => (
                          <td key={p.id} className={cn(
                            'p-3 text-center',
                            form.plan === p.id ? 'bg-teal-50/50' : ''
                          )}>
                            {p.features[key] ? (
                              <span className="text-green-600 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">—</span>
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
                <Button onClick={goNext}>המשך למיתוג</Button>
              </div>
            </div>
          )}

          {/* Step 3: Branding */}
          {step === 'branding' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg">מיתוג המרפאה</h3>
                <p className="text-sm text-slate-500">התאימו את המראה של המערכת למרפאה שלכם</p>
              </div>

              {/* Logo upload */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">לוגו המרפאה</label>
                {logoPreview ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50">
                    <div className="flex items-center gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="לוגו" className="h-20 w-20 object-contain rounded-lg bg-white p-2 border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{logoFile?.name}</p>
                        <p className="text-xs text-slate-500">
                          {logoFile && (logoFile.size / 1024).toFixed(0)} KB
                          {uploadingLogo && ' — מעלה...'}
                          {!uploadingLogo && form.logo_url && ' — הועלה בהצלחה ✓'}
                          {!uploadingLogo && !form.logo_url && logoFile && ' — שמור מקומית'}
                        </p>
                        <button
                          onClick={removeLogo}
                          className="text-sm text-red-600 hover:text-red-700 mt-1"
                        >
                          הסר לוגו
                        </button>
                      </div>
                      {uploadingLogo && <Spinner size="sm" />}
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                      'hover:border-teal-400 hover:bg-teal-50/50',
                      errors.logo ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                    )}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                    aria-label="העלאת לוגו"
                  >
                    <div className="text-4xl mb-2">🖼️</div>
                    <p className="text-sm font-medium text-slate-700">גררו תמונה לכאן או לחצו לבחירה</p>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG — עד 2MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoSelect(file)
                  }}
                />
                {errors.logo && <p className="text-sm text-red-600">{errors.logo}</p>}
                <p className="text-xs text-slate-500">אופציונלי — ניתן להוסיף גם מאוחר יותר</p>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">צבע ראשי</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={e => updateForm('primary_color', e.target.value)}
                      className="w-12 h-12 rounded-lg border-2 border-slate-200 cursor-pointer"
                    />
                    <Input
                      value={form.primary_color}
                      onChange={e => updateForm('primary_color', e.target.value)}
                      error={errors.primary_color}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">צבע משני</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.secondary_color}
                      onChange={e => updateForm('secondary_color', e.target.value)}
                      className="w-12 h-12 rounded-lg border-2 border-slate-200 cursor-pointer"
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
              <div className="border rounded-xl overflow-hidden">
                <p className="text-xs text-slate-500 p-3 bg-slate-50 border-b">תצוגה מקדימה</p>
                <div className="p-4 space-y-4">
                  {/* Header preview */}
                  <div
                    className="h-14 rounded-lg flex items-center px-4 gap-3"
                    style={{ backgroundColor: form.primary_color }}
                  >
                    {logoPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="" className="h-8 w-8 object-contain rounded bg-white/20 p-0.5" />
                    )}
                    <span className="text-white font-bold">{form.name || 'שם המרפאה'}</span>
                  </div>
                  {/* Buttons preview */}
                  <div className="flex gap-2 flex-wrap">
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
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: form.secondary_color }}
                    >
                      תגית לדוגמה
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goPrev}>הקודם</Button>
                <Button onClick={goNext}>המשך להזמנת רופא</Button>
              </div>
            </div>
          )}

          {/* Step 4: Doctor invite */}
          {step === 'doctor' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg">הזמנת רופא ראשון</h3>
                <p className="text-sm text-slate-500">
                  הזמינו רופא להצטרף למערכת. הזמנה תישלח באימייל לאחר הגדרת המרפאה.
                </p>
              </div>

              <div className="bg-teal-50 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3 text-teal-700 mb-2">
                  <span className="text-2xl">👨‍⚕️</span>
                  <span className="font-medium">פרטי הרופא</span>
                </div>
                <Input
                  label="שם הרופא"
                  placeholder="ד״ר ישראל ישראלי"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                />
                <Input
                  label="אימייל הרופא"
                  type="email"
                  placeholder="doctor@example.com"
                  value={doctorEmail}
                  onChange={e => { setDoctorEmail(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.doctorEmail; return n }) }}
                  error={errors.doctorEmail}
                />
              </div>

              {selectedPlan && (
                <p className="text-xs text-slate-500">
                  התוכנית שבחרת ({selectedPlan.name}) מאפשרת עד {selectedPlan.max_doctors} רופאים. ניתן להזמין רופאים נוספים מהגדרות המרפאה.
                </p>
              )}

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                  {submitError}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goPrev}>הקודם</Button>
                <div className="flex gap-3">
                  <Button onClick={handleSubmit} loading={loading} size="lg">
                    {doctorEmail.trim() ? 'סיים והזמן רופא' : 'סיים הרשמה'}
                  </Button>
                </div>
              </div>

              {doctorEmail.trim() && (
                <button
                  onClick={() => { setDoctorName(''); setDoctorEmail(''); handleSubmit() }}
                  disabled={loading}
                  className="text-sm text-teal-600 hover:underline w-full text-center"
                >
                  דלג — אזמין רופאים אחר כך
                </button>
              )}
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="text-center space-y-6 py-8">
              <div className="text-6xl">🎉</div>
              <h3 className="text-2xl font-bold text-slate-900">המרפאה נוצרה בהצלחה!</h3>
              <p className="text-slate-500">
                {form.name} מוכנה לשימוש.
                {form.plan !== 'free' && ' מעבירים אתכם לדף התשלום...'}
                {form.plan === 'free' && ' מעבירים אתכם לדף ההתחברות...'}
              </p>

              <div className="bg-slate-50 rounded-xl p-5 max-w-sm mx-auto space-y-3 text-sm text-right">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">מרפאה</span>
                  <span className="font-medium">{form.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">תוכנית</span>
                  <Badge variant="info">{selectedPlan?.name}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">דומיין</span>
                  <span className="font-medium text-teal-600">{form.subdomain}.cannaforyou.net</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">מנהל</span>
                  <span className="font-medium">{form.first_name} {form.last_name}</span>
                </div>
                {doctorEmail.trim() && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">הזמנה נשלחה ל</span>
                    <span className="font-medium">{doctorEmail}</span>
                  </div>
                )}
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
