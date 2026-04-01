'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Input, Textarea, Select, Card, CardContent, CardHeader, Badge, PageLoading, EmptyState, Spinner } from '@/components/ui'
import { SPECIALTIES, cn, formatDateTime } from '@/lib/utils'
import type { Questionnaire, QuestionItem } from '@/types/database'

// ── Types ────────────────────────────────────────────

type View = 'list' | 'editor' | 'preview'
type QuestionType = QuestionItem['type']

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: 'טקסט חופשי',
  choice: 'בחירה יחידה',
  multi_choice: 'בחירה מרובה',
  scale: 'סקאלה (1-10)',
  yes_no: 'כן / לא',
  image: 'העלאת תמונה',
}

const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  text: 'Aa', choice: 'O', multi_choice: '☑', scale: '#', yes_no: '±', image: 'img',
}

function createEmptyQuestion(): QuestionItem {
  return {
    id: crypto.randomUUID(),
    text: '',
    type: 'text',
    required: false,
    options: [],
  }
}

// ── Main Component ───────────────────────────────────

export default function AdminQuestionnairesPage() {
  const router = useRouter()
  const supabase = getClient()

  const [view, setView] = useState<View>('list')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [orgId, setOrgId] = useState<string>('')

  // Editor state
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [specialties, setSpecialties] = useState<string[]>([])
  const [isPublished, setIsPublished] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Drag state
  const dragIdx = useRef<number | null>(null)
  const dragOverIdx = useRef<number | null>(null)

  // ── Load data ──────────────────────────────────────

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
      if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
        router.push('/dashboard/admin/dashboard'); return
      }

      setOrgId((profile as unknown as { organization_id: string }).organization_id)

      const { data } = await supabase.from('questionnaires')
        .select('*')
        .eq('organization_id', (profile as unknown as { organization_id: string }).organization_id)
        .order('created_at', { ascending: false })

      if (data) setQuestionnaires(data as unknown as Questionnaire[])
    } catch {
      toast.error('שגיאה בטעינת השאלונים')
    } finally {
      setLoading(false)
    }
  }

  // ── Editor actions ─────────────────────────────────

  const startNew = () => {
    setEditId(null)
    setTitle('')
    setDescription('')
    setQuestions([createEmptyQuestion()])
    setSpecialties([])
    setIsPublished(false)
    setErrors({})
    setView('editor')
  }

  const startEdit = (q: Questionnaire) => {
    setEditId(q.id)
    setTitle(q.title)
    setDescription(q.description || '')
    setQuestions(q.questions.length > 0 ? q.questions : [createEmptyQuestion()])
    setSpecialties(q.specialties || [])
    setIsPublished(q.is_published)
    setErrors({})
    setView('editor')
  }

  const saveQuestionnaire = async () => {
    if (!title.trim()) { setErrors({ title: 'שם השאלון נדרש' }); return }
    const validQuestions = questions.filter(q => q.text.trim())
    if (validQuestions.length === 0) { setErrors({ questions: 'יש להוסיף לפחות שאלה אחת' }); return }

    // Validate choice questions have options
    for (const q of validQuestions) {
      if (['choice', 'multi_choice'].includes(q.type) && (!q.options || q.options.filter(o => o.trim()).length < 2)) {
        setErrors({ [`q_${q.id}`]: 'יש להוסיף לפחות 2 אפשרויות' }); return
      }
    }

    setSaving(true)
    setErrors({})

    const payload = {
      organization_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      questions: validQuestions,
      specialties: specialties.length > 0 ? specialties : null,
      is_published: isPublished,
      is_active: true,
    }

    if (editId) {
      const { error } = await supabase.from('questionnaires').update(payload).eq('id', editId)
      if (error) { setErrors({ save: 'שגיאה בשמירה' }); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('questionnaires').insert({ ...payload, created_by: user?.id })
      if (error) { setErrors({ save: 'שגיאה ביצירה' }); setSaving(false); return }
    }

    setSaving(false)
    setView('list')
    loadData()
  }

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const deleteQuestionnaire = async (id: string) => {
    const { error } = await supabase.from('questionnaires').delete().eq('id', id)
    setDeleteConfirm(null)
    if (error) {
      setErrors({ save: 'שגיאה במחיקת השאלון' })
    }
    loadData()
  }

  const duplicateQuestionnaire = async (q: Questionnaire) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('questionnaires').insert({
        organization_id: orgId,
        title: `${q.title} (עותק)`,
        description: q.description,
        questions: q.questions,
        specialties: q.specialties,
        is_published: false,
        is_active: true,
        created_by: user?.id,
      })
      if (error) {
        setErrors({ save: 'שגיאה בשכפול השאלון' })
      }
    } catch {
      setErrors({ save: 'שגיאה בשכפול השאלון' })
    }
    loadData()
  }

  // ── Question management ────────────────────────────

  const addQuestion = () => {
    setQuestions(prev => [...prev, createEmptyQuestion()])
  }

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const updateQuestion = (id: string, updates: Partial<QuestionItem>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))
  }

  const moveQuestion = (fromIdx: number, toIdx: number) => {
    setQuestions(prev => {
      const arr = [...prev]
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return arr
    })
  }

  // ── Drag & Drop ────────────────────────────────────

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    dragOverIdx.current = idx
  }

  const handleDrop = () => {
    if (dragIdx.current !== null && dragOverIdx.current !== null && dragIdx.current !== dragOverIdx.current) {
      moveQuestion(dragIdx.current, dragOverIdx.current)
    }
    dragIdx.current = null
    dragOverIdx.current = null
  }

  // ── Option management ──────────────────────────────

  const addOption = (questionId: string) => {
    updateQuestion(questionId, {
      options: [...(questions.find(q => q.id === questionId)?.options || []), ''],
    })
  }

  const updateOption = (questionId: string, optIdx: number, value: string) => {
    const q = questions.find(q => q.id === questionId)
    if (!q) return
    const opts = [...(q.options || [])]
    opts[optIdx] = value
    updateQuestion(questionId, { options: opts })
  }

  const removeOption = (questionId: string, optIdx: number) => {
    const q = questions.find(q => q.id === questionId)
    if (!q) return
    updateQuestion(questionId, { options: (q.options || []).filter((_, i) => i !== optIdx) })
  }

  if (loading) return <PageLoading />

  // ── List View ──────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">שאלונים</h2>
            <p className="text-gray-500 text-sm">צור ונהל שאלונים למטופלים</p>
          </div>
          <Button onClick={startNew} size="lg">שאלון חדש</Button>
        </div>

        {questionnaires.length === 0 ? (
          <EmptyState
            icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
            title="אין שאלונים עדיין"
            description="צור שאלון ראשון כדי להתחיל לאסוף מידע ממטופלים"
            action={<Button onClick={startNew}>צור שאלון</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionnaires.map(q => (
              <Card key={q.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg truncate">{q.title}</h3>
                      {q.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{q.description}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0 mr-3">
                      <Badge variant={q.is_published ? 'success' : 'warning'}>
                        {q.is_published ? 'פורסם' : 'טיוטה'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                    <span>{q.questions.length} שאלות</span>
                    <span>{q.times_used} מילויים</span>
                    <span>{formatDateTime(q.created_at)}</span>
                  </div>

                  {q.specialties && q.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {q.specialties.map(s => (
                        <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {SPECIALTIES.find(sp => sp.id === s)?.label || s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <Button size="sm" variant="outline" onClick={() => startEdit(q)}>ערוך</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setTitle(q.title); setDescription(q.description || ''); setQuestions(q.questions); setSpecialties(q.specialties || []); setIsPublished(q.is_published); setView('preview') }}>תצוגה מקדימה</Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicateQuestionnaire(q)}>שכפל</Button>
                    {deleteConfirm === q.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="danger" onClick={() => deleteQuestionnaire(q.id)}>אישור מחיקה</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>ביטול</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(q.id)}>מחק</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Preview Mode ───────────────────────────────────

  if (view === 'preview') {
    return <PreviewMode
      title={title}
      description={description}
      questions={questions}
      onBack={() => setView(editId !== null ? 'editor' : 'list')}
    />
  }

  // ── Editor View ────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{editId ? 'עריכת שאלון' : 'שאלון חדש'}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setView('list')}>ביטול</Button>
          <Button variant="outline" onClick={() => setView('preview')}>תצוגה מקדימה</Button>
          <Button onClick={saveQuestionnaire} loading={saving}>שמור</Button>
        </div>
      </div>

      {errors.save && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.save}</div>}

      {/* Basic info */}
      <Card>
        <CardHeader><h3 className="font-bold">פרטי שאלון</h3></CardHeader>
        <CardContent className="space-y-4">
          <Input label="שם השאלון" placeholder="למשל: שאלון קליטה ראשוני" value={title}
            onChange={e => setTitle(e.target.value)} error={errors.title} required />
          <Textarea label="תיאור (אופציונלי)" placeholder="תאר את מטרת השאלון" value={description}
            onChange={e => setDescription(e.target.value)} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">התמחויות (אופציונלי)</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map(s => (
                <button key={s.id} type="button" onClick={() => setSpecialties(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                    specialties.includes(s.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400')}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-medium">פרסם שאלון (גלוי למטופלים)</span>
          </label>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">שאלות ({questions.length})</h3>
            <Button size="sm" onClick={addQuestion}>+ הוסף שאלה</Button>
          </div>
          {errors.questions && <p className="text-sm text-red-600 mt-1">{errors.questions}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={handleDrop}
              className="border-2 border-gray-200 rounded-xl p-4 bg-white hover:border-blue-300 transition-colors group"
            >
              {/* Question header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1" title="גרור לשינוי סדר">
                  ⠿
                </div>
                <span className="text-sm font-bold text-gray-400 w-6">{idx + 1}</span>
                <span className="text-lg">{QUESTION_TYPE_ICONS[q.type]}</span>
                <Select
                  value={q.type}
                  onChange={e => {
                    const newType = e.target.value as QuestionType
                    const updates: Partial<QuestionItem> = { type: newType }
                    if (['choice', 'multi_choice'].includes(newType) && (!q.options || q.options.length === 0)) {
                      updates.options = ['', '']
                    }
                    updateQuestion(q.id, updates)
                  }}
                  options={Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  className="w-40 text-sm"
                />
                <div className="flex-1" />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                  חובה
                </label>
                {/* Move buttons */}
                <button type="button" onClick={() => idx > 0 && moveQuestion(idx, idx - 1)} disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-sm px-1" title="הזז למעלה">▲</button>
                <button type="button" onClick={() => idx < questions.length - 1 && moveQuestion(idx, idx + 1)} disabled={idx === questions.length - 1}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-sm px-1" title="הזז למטה">▼</button>
                <button type="button" onClick={() => removeQuestion(q.id)}
                  className="text-red-400 hover:text-red-600 text-sm px-1" title="מחק">✕</button>
              </div>

              {/* Question text */}
              <Input placeholder="טקסט השאלה" value={q.text}
                onChange={e => updateQuestion(q.id, { text: e.target.value })} />

              {/* Options for choice/multi_choice */}
              {['choice', 'multi_choice'].includes(q.type) && (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium text-gray-500">אפשרויות</label>
                  {(q.options || []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{optIdx + 1}.</span>
                      <Input placeholder={`אפשרות ${optIdx + 1}`} value={opt}
                        onChange={e => updateOption(q.id, optIdx, e.target.value)}
                        className="flex-1" />
                      <button type="button" onClick={() => removeOption(q.id, optIdx)}
                        className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => addOption(q.id)}>
                    + הוסף אפשרות
                  </Button>
                  {errors[`q_${q.id}`] && <p className="text-xs text-red-600">{errors[`q_${q.id}`]}</p>}
                </div>
              )}

              {/* Scale preview */}
              {q.type === 'scale' && (
                <div className="mt-3 flex items-center gap-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                      {i + 1}
                    </div>
                  ))}
                </div>
              )}

              {/* Yes/No preview */}
              {q.type === 'yes_no' && (
                <div className="mt-3 flex gap-3">
                  <div className="px-6 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-200">כן</div>
                  <div className="px-6 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-200">לא</div>
                </div>
              )}

              {/* Conditional logic */}
              <ConditionalLogicEditor
                question={q}
                allQuestions={questions}
                currentIdx={idx}
                onUpdate={(condition) => updateQuestion(q.id, { condition })}
              />
            </div>
          ))}

          <Button variant="outline" onClick={addQuestion} className="w-full border-dashed">
            + הוסף שאלה חדשה
          </Button>
        </CardContent>
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setView('list')}>ביטול</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('preview')}>תצוגה מקדימה</Button>
          <Button onClick={saveQuestionnaire} loading={saving} size="lg">שמור שאלון</Button>
        </div>
      </div>
    </div>
  )
}

// ── Conditional Logic Editor ─────────────────────────

function ConditionalLogicEditor({ question, allQuestions, currentIdx, onUpdate }: {
  question: QuestionItem
  allQuestions: QuestionItem[]
  currentIdx: number
  onUpdate: (condition: QuestionItem['condition'] | undefined) => void
}) {
  const [showCondition, setShowCondition] = useState(!!question.condition)
  const previousQuestions = allQuestions.slice(0, currentIdx)

  if (previousQuestions.length === 0) return null

  // Only questions with defined answers can be condition sources
  const conditionSources = previousQuestions.filter(q =>
    ['choice', 'multi_choice', 'yes_no', 'scale'].includes(q.type) && q.text.trim()
  )

  if (conditionSources.length === 0) return null

  const selectedSource = conditionSources.find(q => q.id === question.condition?.question_id)

  const getSourceOptions = (source: QuestionItem): string[] => {
    if (source.type === 'yes_no') return ['כן', 'לא']
    if (source.type === 'scale') return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
    return source.options?.filter(o => o.trim()) || []
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500">
        <input type="checkbox" checked={showCondition}
          onChange={e => {
            setShowCondition(e.target.checked)
            if (!e.target.checked) onUpdate(undefined)
          }}
          className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600" />
        הצג בתנאי (תלוי בתשובה לשאלה קודמת)
      </label>

      {showCondition && (
        <div className="mt-2 p-3 bg-purple-50 rounded-lg space-y-2">
          <Select
            label="הצג כאשר שאלה:"
            value={question.condition?.question_id || ''}
            onChange={e => onUpdate({ question_id: e.target.value, value: question.condition?.value || '' })}
            options={conditionSources.map(q => ({ value: q.id, label: q.text.slice(0, 50) || '(ללא טקסט)' }))}
            placeholder="בחר שאלה"
          />
          {selectedSource && (
            <Select
              label="שווה ל:"
              value={question.condition?.value || ''}
              onChange={e => onUpdate({ question_id: question.condition?.question_id || '', value: e.target.value })}
              options={getSourceOptions(selectedSource).map(v => ({ value: v, label: v }))}
              placeholder="בחר תשובה"
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Preview Mode ─────────────────────────────────────

function PreviewMode({ title, description, questions, onBack }: {
  title: string; description: string; questions: QuestionItem[]; onBack: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})

  const isVisible = (q: QuestionItem): boolean => {
    if (!q.condition) return true
    const { question_id, value } = q.condition
    const answer = answers[question_id]
    if (Array.isArray(answer)) return answer.includes(value)
    return answer === value
  }

  const setAnswer = (id: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const visibleQuestions = questions.filter(q => q.text.trim() && isVisible(q))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">תצוגה מקדימה</h2>
        <Button variant="outline" onClick={onBack}>חזור לעריכה</Button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
        זוהי תצוגה מקדימה — ניתן לענות על השאלות לבדיקת לוגיקה מותנית
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-xl">{title || '(ללא שם)'}</h3>
          {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          {visibleQuestions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">אין שאלות להצגה</p>
          ) : (
            visibleQuestions.map((q, idx) => (
              <QuestionRenderer
                key={q.id}
                question={q}
                index={idx}
                value={answers[q.id]}
                onChange={val => setAnswer(q.id, val)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>חזור לעריכה</Button>
        <Button disabled>שלח (תצוגה מקדימה בלבד)</Button>
      </div>
    </div>
  )
}

// ── Question Renderer (shared) ───────────────────────

function QuestionRenderer({ question, index, value, onChange }: {
  question: QuestionItem; index: number
  value: string | string[] | undefined
  onChange: (val: string | string[]) => void
}) {
  const q = question

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        <span className="text-gray-400 ml-1">{index + 1}.</span>
        {q.text}
        {q.required && <span className="text-red-500 mr-1">*</span>}
      </label>

      {q.type === 'text' && (
        <Textarea
          placeholder="הקלד את תשובתך..."
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {q.type === 'choice' && (
        <div className="space-y-2">
          {(q.options || []).filter(o => o.trim()).map((opt, i) => (
            <label key={i} className={cn(
              'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors',
              value === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
            )}>
              <input type="radio" name={`q_${q.id}`} value={opt} checked={value === opt}
                onChange={() => onChange(opt)}
                className="w-4 h-4 text-blue-600" />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {q.type === 'multi_choice' && (
        <div className="space-y-2">
          {(q.options || []).filter(o => o.trim()).map((opt, i) => {
            const selected = Array.isArray(value) ? value.includes(opt) : false
            return (
              <label key={i} className={cn(
                'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors',
                selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              )}>
                <input type="checkbox" value={opt} checked={selected}
                  onChange={e => {
                    const prev = Array.isArray(value) ? value : []
                    onChange(e.target.checked ? [...prev, opt] : prev.filter(v => v !== opt))
                  }}
                  className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm">{opt}</span>
              </label>
            )
          })}
        </div>
      )}

      {q.type === 'scale' && (
        <div className="flex items-center gap-1 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => {
            const val = String(i + 1)
            return (
              <button key={i} type="button" onClick={() => onChange(val)}
                className={cn(
                  'w-10 h-10 rounded-full text-sm font-bold transition-colors',
                  value === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-blue-100'
                )}>
                {val}
              </button>
            )
          })}
        </div>
      )}

      {q.type === 'yes_no' && (
        <div className="flex gap-3">
          <button type="button" onClick={() => onChange('כן')}
            className={cn('flex-1 py-3 rounded-xl border-2 font-medium transition-colors',
              value === 'כן' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300')}>
            כן
          </button>
          <button type="button" onClick={() => onChange('לא')}
            className={cn('flex-1 py-3 rounded-xl border-2 font-medium transition-colors',
              value === 'לא' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-red-300')}>
            לא
          </button>
        </div>
      )}

      {q.type === 'image' && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
          <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
          <p className="text-sm text-gray-500">לחץ להעלאת תמונה</p>
        </div>
      )}
    </div>
  )
}
