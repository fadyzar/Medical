'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, PageLoading, EmptyState } from '@/components/ui'
import { SPECIALTIES, cn, formatDateTime } from '@/lib/utils'
import type { Questionnaire, QuestionnaireResponse, QuestionItem, User } from '@/types/database'

type View = 'list' | 'responses' | 'response-detail'

type ResponseWithPatient = QuestionnaireResponse & {
  patient?: User
  questionnaire?: Questionnaire
}

export default function DoctorQuestionnairesPage() {
  const router = useRouter()
  const supabase = getClient()

  const [view, setView] = useState<View>('list')
  const [loading, setLoading] = useState(true)
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [responses, setResponses] = useState<ResponseWithPatient[]>([])
  const [selectedResponse, setSelectedResponse] = useState<ResponseWithPatient | null>(null)
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null)
  const [doctorSpecialties, setDoctorSpecialties] = useState<string[]>([])
  const [tab, setTab] = useState<'my' | 'responses'>('my')
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('users')
        .select('organization_id, specialties, role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile as unknown as { role: string }).role !== 'doctor') {
        router.push('/dashboard/doctor/dashboard')
        return
      }

      const specs = (profile as unknown as { specialties: string[] | null }).specialties || []
      setDoctorSpecialties(specs)
      const orgId = (profile as unknown as { organization_id: string }).organization_id

      // Load questionnaires for doctor's org
      const { data: quests } = await supabase.from('questionnaires')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (quests) setQuestionnaires(quests as unknown as Questionnaire[])

      // Load questionnaire responses for doctor's appointments
      const { data: apts } = await supabase.from('appointments')
        .select('id')
        .eq('doctor_id', user.id)

      if (apts && apts.length > 0) {
        const aptIds = apts.map(a => (a as unknown as { id: string }).id)
        const { data: resps } = await supabase.from('questionnaire_responses')
          .select('*, patient:patient_id(id, first_name, last_name), questionnaire:questionnaire_id(id, title, questions)')
          .in('appointment_id', aptIds)
          .order('created_at', { ascending: false })
          .limit(50)

        if (resps) setResponses(resps as unknown as ResponseWithPatient[])
      }
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  const viewResponses = (q: Questionnaire) => {
    setSelectedQuestionnaire(q)
    setView('responses')
  }

  const viewResponseDetail = (r: ResponseWithPatient) => {
    setSelectedResponse(r)
    // If the response has a linked questionnaire, use it; otherwise find it
    if (!r.questionnaire) {
      const q = questionnaires.find(q => q.id === r.questionnaire_id)
      if (q) setSelectedQuestionnaire(q)
    } else {
      setSelectedQuestionnaire(r.questionnaire as unknown as Questionnaire)
    }
    setView('response-detail')
  }

  const copyQuestionnaireLink = async (q: Questionnaire) => {
    const baseUrl = window.location.origin
    const url = `${baseUrl}/dashboard/patient/questionnaire?id=${q.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyMessage('הקישור הועתק ללוח')
      setTimeout(() => setCopyMessage(null), 2000)
    } catch {
      setCopyMessage('שגיאה בהעתקת הקישור')
      setTimeout(() => setCopyMessage(null), 2000)
    }
  }

  // ── Filter questionnaires by doctor's specialties ───
  const myQuestionnaires = questionnaires.filter(q => {
    if (!q.specialties || q.specialties.length === 0) return true
    return q.specialties.some(s => doctorSpecialties.includes(s))
  })

  const questResponses = selectedQuestionnaire
    ? responses.filter(r => r.questionnaire_id === selectedQuestionnaire.id)
    : []

  if (loading) return <PageLoading />

  // ── Response Detail View ──────────────────────────
  if (view === 'response-detail' && selectedResponse && selectedQuestionnaire) {
    const patient = selectedResponse.patient as unknown as User | undefined
    const questions = selectedQuestionnaire.questions || []
    const answers = (selectedResponse.responses || {}) as Record<string, string | string[]>

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">תשובות שאלון</h2>
            <p className="text-slate-500 text-sm">{selectedQuestionnaire.title}</p>
          </div>
          <Button variant="outline" onClick={() => setView(selectedQuestionnaire ? 'responses' : 'list')}>חזור</Button>
        </div>

        {/* Patient info */}
        {patient && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-700">
                {patient.first_name?.charAt(0)}{patient.last_name?.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                <p className="text-xs text-slate-500">
                  מולא ב-{formatDateTime(selectedResponse.completed_at || selectedResponse.created_at)}
                  {selectedResponse.time_taken_seconds && (
                    <> · {Math.round(selectedResponse.time_taken_seconds / 60)} דקות</>
                  )}
                </p>
              </div>
              {selectedResponse.risk_level && (
                <Badge variant={selectedResponse.risk_level === 'high' ? 'danger' : selectedResponse.risk_level === 'medium' ? 'warning' : 'success'}
                  className="mr-auto">
                  {selectedResponse.risk_level === 'high' ? 'סיכון גבוה' : selectedResponse.risk_level === 'medium' ? 'סיכון בינוני' : 'סיכון נמוך'}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Responses */}
        <Card>
          <CardContent className="p-6 space-y-6">
            {questions.filter(q => q.text.trim()).map((q, idx) => {
              const answer = answers[q.id]
              const hasAnswer = answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim().length > 0)

              return (
                <div key={q.id} className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">
                    <span className="text-slate-400 ml-1">{idx + 1}.</span>
                    {q.text}
                    {q.required && <span className="text-red-500 mr-1">*</span>}
                  </p>

                  {hasAnswer ? (
                    <div className="text-sm">
                      {q.type === 'text' && (
                        <p className="bg-slate-50 p-3 rounded-lg text-slate-800 whitespace-pre-wrap">{answer as string}</p>
                      )}
                      {q.type === 'choice' && (
                        <Badge variant="info">{answer as string}</Badge>
                      )}
                      {q.type === 'multi_choice' && Array.isArray(answer) && (
                        <div className="flex flex-wrap gap-1.5">
                          {answer.map((a, i) => <Badge key={i} variant="info">{a}</Badge>)}
                        </div>
                      )}
                      {q.type === 'scale' && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 10 }, (_, i) => {
                              const val = String(i + 1)
                              const isSelected = answer === val
                              return (
                                <div key={i} className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                                  isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'
                                )}>{val}</div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {q.type === 'yes_no' && (
                        <Badge variant={answer === 'כן' ? 'success' : 'danger'}>{answer as string}</Badge>
                      )}
                      {q.type === 'image' && (
                        <p className="text-slate-600">תמונה: {answer as string}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">לא נענתה</p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* AI Analysis */}
        {selectedResponse.ai_analysis && (
          <Card className="border-purple-200">
            <CardHeader><h3 className="font-bold text-purple-700">ניתוח AI</h3></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{selectedResponse.ai_analysis}</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ── Responses List View ───────────────────────────
  if (view === 'responses' && selectedQuestionnaire) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">תשובות</h2>
            <p className="text-slate-500 text-sm">{selectedQuestionnaire.title}</p>
          </div>
          <Button variant="outline" onClick={() => { setView('list'); setSelectedQuestionnaire(null) }}>חזור</Button>
        </div>

        {questResponses.length === 0 ? (
          <EmptyState icon={<svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>} title="אין תשובות עדיין" description="עדיין לא נשלחו תשובות לשאלון זה" />
        ) : (
          <div className="space-y-3">
            {questResponses.map(r => {
              const patient = r.patient as unknown as User | undefined
              return (
                <Card key={r.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => viewResponseDetail(r)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                        {patient?.first_name?.charAt(0)}{patient?.last_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{patient?.first_name} {patient?.last_name}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(r.completed_at || r.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.is_complete ? 'success' : 'warning'}>
                        {r.is_complete ? 'הושלם' : 'חלקי'}
                      </Badge>
                      {r.risk_level && (
                        <Badge variant={r.risk_level === 'high' ? 'danger' : r.risk_level === 'medium' ? 'warning' : 'success'}>
                          {r.risk_level === 'high' ? 'גבוה' : r.risk_level === 'medium' ? 'בינוני' : 'נמוך'}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Main List View ────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">שאלונים</h2>
          <p className="text-slate-500 text-sm">צפה בשאלונים ותשובות מטופלים</p>
        </div>
      </div>

      {/* Copy message */}
      {copyMessage && (
        <div className="bg-teal-50 border border-teal-200 text-teal-700 p-3 rounded-lg text-sm" role="status">
          {copyMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b" role="tablist">
        <button onClick={() => setTab('my')} role="tab" aria-selected={tab === 'my'} className={cn(
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
          tab === 'my' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
        )}>
          שאלונים ({myQuestionnaires.length})
        </button>
        <button onClick={() => setTab('responses')} role="tab" aria-selected={tab === 'responses'} className={cn(
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
          tab === 'responses' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
        )}>
          תשובות אחרונות ({responses.length})
        </button>
      </div>

      {/* My Questionnaires Tab */}
      {tab === 'my' && (
        <>
          {myQuestionnaires.length === 0 ? (
            <EmptyState
              icon={<svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
              title="אין שאלונים זמינים"
              description="שאלונים מנוהלים על ידי מנהל המערכת. פנה למנהל להוספת שאלונים להתמחויות שלך."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myQuestionnaires.map(q => {
                const responseCount = responses.filter(r => r.questionnaire_id === q.id).length
                return (
                  <Card key={q.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-lg truncate">{q.title}</h3>
                          {q.description && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{q.description}</p>}
                        </div>
                        <Badge variant={q.is_published ? 'success' : 'warning'}>
                          {q.is_published ? 'פורסם' : 'טיוטה'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                        <span>{q.questions.length} שאלות</span>
                        <span>{q.times_used} מילויים</span>
                        <span>{responseCount} תשובות</span>
                      </div>

                      {q.specialties && q.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {q.specialties.map(s => (
                            <span key={s} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                              {SPECIALTIES.find(sp => sp.id === s)?.label || s}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-3 border-t border-slate-100">
                        {responseCount > 0 && (
                          <Button size="sm" variant="outline" onClick={() => viewResponses(q)}>
                            תשובות ({responseCount})
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => copyQuestionnaireLink(q)}>
                          העתק קישור
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Recent Responses Tab */}
      {tab === 'responses' && (
        <>
          {responses.length === 0 ? (
            <EmptyState
              icon={<svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>}
              title="אין תשובות עדיין"
              description="כשמטופלים ימלאו שאלונים עבור תורים שלך, התשובות יופיעו כאן."
            />
          ) : (
            <div className="space-y-3">
              {responses.map(r => {
                const patient = r.patient as unknown as User | undefined
                const quest = r.questionnaire as unknown as Questionnaire | undefined
                return (
                  <Card key={r.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => viewResponseDetail(r)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                          {patient?.first_name?.charAt(0)}{patient?.last_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{patient?.first_name} {patient?.last_name}</p>
                          <p className="text-xs text-slate-500">
                            {quest?.title || 'שאלון'} · {formatDateTime(r.completed_at || r.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.is_complete ? 'success' : 'warning'}>
                          {r.is_complete ? 'הושלם' : 'חלקי'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
