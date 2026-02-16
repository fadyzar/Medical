'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { registerSchema } from '@/lib/validation/schemas'
import { Button, Input, Select, Card, CardContent } from '@/components/ui'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    password: '', confirm_password: '',
    id_number: '', date_of_birth: '', gender: '' as string,
    agree_terms: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const updateField = (field: string, value: string | boolean) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => { const n = { ...p }; delete n[field]; return n })
  }

  const validateStep1 = () => {
    const errs: Record<string, string> = {}
    if (form.first_name.length < 2) errs.first_name = 'שם פרטי חייב להכיל לפחות 2 תווים'
    if (form.last_name.length < 2) errs.last_name = 'שם משפחה חייב להכיל לפחות 2 תווים'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'אימייל לא תקין'
    if (!/^0[2-9]\d{7,8}$/.test(form.phone)) errs.phone = 'מספר טלפון לא תקין'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    const result = registerSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => { if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const supabase = getClient()
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            role: 'patient',
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) {
        if (error.message.includes('already registered')) setServerError('משתמש עם אימייל זה כבר קיים')
        else setServerError('שגיאה בהרשמה: ' + error.message)
        setLoading(false)
        return
      }

      // Update profile with additional fields
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('users').update({
          phone: form.phone,
          id_number: form.id_number || null,
          date_of_birth: form.date_of_birth || null,
          gender: (form.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say') || null,
        }).eq('id', user.id)
      }

      router.push('/dashboard/patient/dashboard')
    } catch {
      setServerError('שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">טלמדיסן</h1>
          <p className="text-gray-500 mt-2">הרשמה לייעוץ רפואי אונליין</p>
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Progress */}
            <div className="flex gap-2 mb-6">
              {[1, 2].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-blue-600' : 'bg-gray-200'}`} />
              ))}
            </div>

            {serverError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{serverError}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold">פרטים אישיים</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="שם פרטי" value={form.first_name} onChange={e => updateField('first_name', e.target.value)} error={errors.first_name} required />
                    <Input label="שם משפחה" value={form.last_name} onChange={e => updateField('last_name', e.target.value)} error={errors.last_name} required />
                  </div>
                  <Input label="אימייל" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} error={errors.email} autoComplete="email" required />
                  <Input label="טלפון" type="tel" placeholder="0501234567" value={form.phone} onChange={e => updateField('phone', e.target.value)} error={errors.phone} autoComplete="tel" required />
                  <Button type="button" onClick={() => { if (validateStep1()) setStep(2) }} className="w-full" size="lg">המשך</Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold">אבטחה ופרטים נוספים</h2>
                  <Input label="סיסמה" type="password" value={form.password} onChange={e => updateField('password', e.target.value)} error={errors.password} hint="לפחות 8 תווים, אות גדולה, אות קטנה ומספר" autoComplete="new-password" required />
                  <Input label="אימות סיסמה" type="password" value={form.confirm_password} onChange={e => updateField('confirm_password', e.target.value)} error={errors.confirm_password} autoComplete="new-password" required />
                  <Input label="תעודת זהות (אופציונלי)" value={form.id_number} onChange={e => updateField('id_number', e.target.value)} />
                  <Input label="תאריך לידה (אופציונלי)" type="date" value={form.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} />
                  <Select label="מגדר (אופציונלי)" value={form.gender} onChange={e => updateField('gender', e.target.value)} placeholder="בחר" options={[
                    { value: 'male', label: 'זכר' }, { value: 'female', label: 'נקבה' },
                    { value: 'other', label: 'אחר' }, { value: 'prefer_not_to_say', label: 'מעדיף/ה לא לציין' },
                  ]} />

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.agree_terms} onChange={e => updateField('agree_terms', e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-600">
                      אני מסכים/ה ל<a href="/terms" className="text-blue-600 underline" target="_blank">תנאי השימוש</a> ול<a href="/privacy" className="text-blue-600 underline" target="_blank">מדיניות הפרטיות</a>
                    </span>
                  </label>
                  {errors.agree_terms && <p className="text-sm text-red-600">{errors.agree_terms}</p>}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1" size="lg">חזור</Button>
                    <Button type="submit" loading={loading} className="flex-1" size="lg">הירשם</Button>
                  </div>
                </div>
              )}
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              כבר יש לך חשבון?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">התחבר</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
