'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Textarea, PageLoading, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Questionnaire, QuestionItem } from '@/types/database'

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'error'

export default function PatientQuestionnairePage() {
  const searchParams = useSearchParams()
  const questionnaireId = searchParams.get('id')
  const appointmentId = searchParams.get('appointment')
  const router = useRouter()
  const supabase = getClient()

  const [state, setState] = useState<FormState>('loading')
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const startedAt = useRef<Date>(new Date())

  useEffect(() => {
    if (!questionnaireId) {
      setError('חסר מזהה שאלון')
      setState('error')
      return
    }
    loadQuestionnaire(questionnaireId)
  }, [questionnaireId])

  const loadQuestionnaire = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase.from('questionnaires')
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .eq('is_active', true)
        .single()

      if (!data) {
        setError('שאלון לא נמצא או שאינו פעיל')
        setState('error')
        return
      }

      setQuestionnaire(data as unknown as Questionnaire)
      startedAt.current = new Date()
      setState('form')
    } catch {
      setError('שגיאה בטעינת השאלון')
      setState('error')
    }
  }

  // ── Conditional visibility ─────────────────────────

  const isVisible = (q: QuestionItem): boolean => {
    if (!q.condition) return true
    const { question_id, value } = q.condition
    const answer = answers[question_id]
    if (Array.isArray(answer)) return answer.includes(value)
    return answer === value
  }

  const visibleQuestions = questionnaire?.questions.filter(q => q.text.trim() && isVisible(q)) || []

  // ── Step-based navigation ──────────────────────────

  const QUESTIONS_PER_STEP = 5
  const totalSteps = Math.max(1, Math.ceil(visibleQuestions.length / QUESTIONS_PER_STEP))
  const stepQuestions = visibleQuestions.slice(
    currentStep * QUESTIONS_PER_STEP,
    (currentStep + 1) * QUESTIONS_PER_STEP
  )

  // ── Answer management ──────────────────────────────

  const setAnswer = (id: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
    setErrors(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  // ── Validation ─────────────────────────────────────

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {}
    for (const q of stepQuestions) {
      if (!q.required) continue
      const answer = answers[q.id]
      if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === 'string' && !answer.trim())) {
        newErrors[q.id] = 'שדה חובה'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Navigation ─────────────────────────────────────

  const goNext = () => {
    if (!validateStep()) return
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // ── Submit ─────────────────────────────────────────

  const handleSubmit = async () => {
    // Validate and get the error map directly (don't rely on async state)
    const newErrors: Record<string, string> = {}
    for (const q of visibleQuestions) {
      if (!q.required) continue
      const answer = answers[q.id]
      if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === 'string' && !answer.trim())) {
        newErrors[q.id] = 'שדה חובה'
      }
    }
    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      // Navigate to the step with the first error
      const firstErrorId = Object.keys(newErrors)[0]
      if (firstErrorId) {
        const errIdx = visibleQuestions.findIndex(q => q.id === firstErrorId)
        if (errIdx >= 0) setCurrentStep(Math.floor(errIdx / QUESTIONS_PER_STEP))
      }
      return
    }

    setState('submitting')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) { setState('error'); setError('פרופיל לא נמצא'); return }

      const timeTaken = Math.floor((Date.now() - startedAt.current.getTime()) / 1000)

      const { error: insertError } = await supabase.from('questionnaire_responses').insert({
        organization_id: (profile as unknown as { organization_id: string }).organization_id,
        questionnaire_id: questionnaireId!,
        appointment_id: appointmentId || undefined,
        patient_id: user.id,
        responses: answers,
        is_complete: true,
        completed_at: new Date().toISOString(),
        time_taken_seconds: timeTaken,
      })

      if (insertError) throw insertError

      // Increment times_used counter
      if (questionnaireId) {
        await supabase.from('questionnaires')
          .update({ times_used: (questionnaire?.times_used || 0) + 1 })
          .eq('id', questionnaireId)
      }

      setState('success')
    } catch {
      setError('שגיאה בשליחת השאלון')
      setState('error')
    }
  }

  // ── Render states ──────────────────────────────────

  if (state === 'loading') return <PageLoading />

  if (state === 'error') {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">שגיאה</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button onClick={() => router.push('/dashboard/patient/dashboard')}>חזור לדשבורד</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'submitting') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-500">שולח את התשובות...</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card className="border-green-200">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-800">השאלון נשלח בהצלחה!</h2>
            <p className="text-gray-500">תודה על מילוי השאלון. המידע ישמש את הרופא לייעוץ מיטבי.</p>
            <Button onClick={() => router.push('/dashboard/patient/dashboard')}>חזור לדשבורד</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Form render ────────────────────────────────────

  const progress = visibleQuestions.length > 0
    ? Math.round((Object.keys(answers).filter(id => {
        const a = answers[id]
        return a && (Array.isArray(a) ? a.length > 0 : a.trim().length > 0)
      }).length / visibleQuestions.length) * 100)
    : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{questionnaire?.title}</h2>
        {questionnaire?.description && <p className="text-gray-500 text-sm mt-1">{questionnaire.description}</p>}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">התקדמות</span>
          <span className="font-medium text-blue-600">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        {totalSteps > 1 && (
          <p className="text-xs text-gray-400 text-center">
            עמוד {currentStep + 1} מתוך {totalSteps}
          </p>
        )}
      </div>

      {/* Questions */}
      <Card>
        <CardContent className="p-6 space-y-8">
          {stepQuestions.map((q, idx) => {
            const globalIdx = currentStep * QUESTIONS_PER_STEP + idx
            return (
              <div key={q.id} className="space-y-3">
                <label className="block font-medium text-gray-800">
                  <span className="text-gray-400 ml-1">{globalIdx + 1}.</span>
                  {q.text}
                  {q.required && <span className="text-red-500 mr-1">*</span>}
                </label>

                {/* Text */}
                {q.type === 'text' && (
                  <Textarea
                    placeholder="הקלד את תשובתך..."
                    value={(answers[q.id] as string) || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    error={errors[q.id]}
                  />
                )}

                {/* Choice */}
                {q.type === 'choice' && (
                  <div className="space-y-2">
                    {(q.options || []).filter(o => o.trim()).map((opt, i) => (
                      <button key={i} type="button" onClick={() => setAnswer(q.id, opt)}
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all w-full text-right',
                          answers[q.id] === opt
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        )}>
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                          answers[q.id] === opt ? 'border-blue-600' : 'border-gray-300'
                        )}>
                          {answers[q.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                        </div>
                        <span className="text-sm">{opt}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Multi choice */}
                {q.type === 'multi_choice' && (
                  <div className="space-y-2">
                    {(q.options || []).filter(o => o.trim()).map((opt, i) => {
                      const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                      const selected = current.includes(opt)
                      return (
                        <button key={i} type="button"
                          onClick={() => {
                            if (selected) {
                              setAnswer(q.id, current.filter(v => v !== opt))
                            } else {
                              setAnswer(q.id, [...current, opt])
                            }
                          }}
                          className={cn(
                            'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all w-full text-right',
                            selected
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                          )}>
                          <div className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                            selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                          )}>
                            {selected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm">{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Scale */}
                {q.type === 'scale' && (
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Array.from({ length: 10 }, (_, i) => {
                        const val = String(i + 1)
                        const isSelected = answers[q.id] === val
                        return (
                          <button key={i} type="button" onClick={() => setAnswer(q.id, val)}
                            className={cn(
                              'w-11 h-11 rounded-full text-sm font-bold transition-all',
                              isSelected
                                ? 'bg-blue-600 text-white shadow-md scale-110'
                                : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                            )}>
                            {val}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span>נמוך</span>
                      <span>גבוה</span>
                    </div>
                  </div>
                )}

                {/* Yes/No */}
                {q.type === 'yes_no' && (
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setAnswer(q.id, 'כן')}
                      className={cn('flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all',
                        answers[q.id] === 'כן'
                          ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-green-300')}>
                      כן
                    </button>
                    <button type="button" onClick={() => setAnswer(q.id, 'לא')}
                      className={cn('flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all',
                        answers[q.id] === 'לא'
                          ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-red-300')}>
                      לא
                    </button>
                  </div>
                )}

                {/* Image upload */}
                {q.type === 'image' && (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" id={`img_${q.id}`}
                      onChange={e => {
                        if (e.target.files?.[0]) setAnswer(q.id, e.target.files[0].name)
                      }} />
                    <label htmlFor={`img_${q.id}`} className="cursor-pointer">
                      {answers[q.id] ? (
                        <div>
                          <svg className="w-8 h-8 text-green-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          <p className="text-sm text-green-700 font-medium">{answers[q.id] as string}</p>
                          <p className="text-xs text-gray-400 mt-1">לחץ להחלפה</p>
                        </div>
                      ) : (
                        <div>
                          <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
                          </svg>
                          <p className="font-medium text-gray-700">לחץ להעלאת תמונה</p>
                          <p className="text-xs text-gray-400 mt-1">JPG, PNG — עד 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {errors[q.id] && (
                  <p className="text-sm text-red-600">{errors[q.id]}</p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <Button variant="outline" onClick={goPrev}>→ הקודם</Button>
          )}
        </div>
        <div>
          {currentStep < totalSteps - 1 ? (
            <Button onClick={goNext} size="lg">הבא ←</Button>
          ) : (
            <Button onClick={handleSubmit} size="lg">שלח שאלון</Button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        המידע שתמסור ישמש אך ורק למטרת הייעוץ הרפואי שלך ויישמר בצורה מאובטחת.
      </p>
    </div>
  )
}
