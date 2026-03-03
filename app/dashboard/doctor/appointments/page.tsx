'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, Textarea, Input, PageLoading, EmptyState } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, cn } from '@/lib/utils'
import type { Appointment, User, QuestionnaireResponse, QuestionItem } from '@/types/database'

type ResponseWithQuest = QuestionnaireResponse & {
  questionnaire?: { id: string; title: string; questions: QuestionItem[] }
}

export default function DoctorAppointmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [soapForm, setSoapForm] = useState({ subjective_notes: '', objective_notes: '', assessment: '', plan: '', diagnosis: '', follow_up_instructions: '' })
  const [questResponses, setQuestResponses] = useState<ResponseWithQuest[]>([])
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = getClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('appointments')
        .select('*, patient:patient_id(id, first_name, last_name, date_of_birth, phone, email, medical_history, insurance_info)')
        .eq('doctor_id', user.id).order('created_at', { ascending: false })
      if (data) {
        const apts = data as unknown as Appointment[]
        setAppointments(apts)
        if (selectedId) {
          const apt = apts.find(a => a.id === selectedId)
          if (apt) selectAppointment(apt)
        }
      }
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  const selectAppointment = async (apt: Appointment) => {
    setSelected(apt)
    setShowQuestionnaire(false)
    setSoapForm({
      subjective_notes: apt.subjective_notes || '',
      objective_notes: apt.objective_notes || '',
      assessment: apt.assessment || '',
      plan: apt.plan || '',
      diagnosis: apt.diagnosis || '',
      follow_up_instructions: apt.follow_up_instructions || '',
    })

    // Fetch questionnaire responses for this appointment
    try {
      const { data: qr } = await supabase.from('questionnaire_responses')
        .select('*, questionnaire:questionnaire_id(id, title, questions)')
        .eq('appointment_id', apt.id)
        .eq('is_complete', true)
        .order('created_at', { ascending: false })

      setQuestResponses((qr || []) as unknown as ResponseWithQuest[])
    } catch {
      setQuestResponses([])
    }
  }

  const saveSOAP = async () => {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('appointments').update(soapForm).eq('id', selected.id)
    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: 'שגיאה בשמירת הערות SOAP' })
    } else {
      setMessage({ type: 'success', text: 'הערות SOAP נשמרו בהצלחה' })
      setTimeout(() => setMessage(null), 3000)
    }
    loadData()
  }

  const completeAppointment = async () => {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('appointments').update({ ...soapForm, status: 'completed', completed_at: new Date().toISOString() }).eq('id', selected.id)

    if (error) {
      setMessage({ type: 'error', text: 'שגיאה בסיום הייעוץ' })
      setSaving(false)
      return
    }

    // Send consultation summary email to patient
    try {
      await fetch('/api/email/send-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: selected.id }),
      })
    } catch { /* non-critical */ }

    setSaving(false)
    setSelected(null)
    setMessage({ type: 'success', text: 'הייעוץ הסתיים בהצלחה' })
    setTimeout(() => setMessage(null), 3000)
    loadData()
  }

  if (loading) return <PageLoading />

  const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter)

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">ניהול תורים</h2>

      {/* Messages */}
      {message && (
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg text-sm',
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        )} role="status">
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'doctor_confirmed', 'scheduled', 'in_progress', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}>{f === 'all' ? 'הכל' : STATUS_LABELS[f]} ({f === 'all' ? appointments.length : appointments.filter(a => a.status === f).length})</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <Card className="max-h-[75vh] overflow-y-auto">
          {filtered.length === 0 ? <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>} title="אין תורים" /> : (
            <div className="divide-y">
              {filtered.map(apt => {
                const patient = apt.patient as unknown as User
                const isSelected = selected?.id === apt.id
                return (
                  <button key={apt.id} onClick={() => selectAppointment(apt)}
                    className={cn('w-full px-4 py-3 text-right hover:bg-gray-50 transition-colors', isSelected && 'bg-blue-50 border-r-4 border-blue-600')}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{patient?.first_name} {patient?.last_name}</p>
                        <p className="text-sm text-gray-500 truncate">{apt.chief_complaint}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(apt.scheduled_at || apt.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={apt.status === 'completed' ? 'success' : apt.status.startsWith('cancelled') ? 'danger' : 'info'}>
                          {STATUS_LABELS[apt.status]}
                        </Badge>
                        {apt.ai_triage_score != null && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium',
                            apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' : apt.ai_triage_score >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                          )}>דחיפות {apt.ai_triage_score}</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* Detail panel */}
        <Card className="max-h-[75vh] overflow-y-auto">
          {selected ? (() => {
            const patient = selected.patient as unknown as User
            return (
              <CardContent className="p-5 space-y-5">
                {/* Patient info */}
                <div>
                  <h3 className="font-bold text-lg">{patient?.first_name} {patient?.last_name}</h3>
                  <div className="text-sm text-gray-500 space-y-0.5 mt-1">
                    {patient?.phone && <p>טל׳: {patient.phone}</p>}
                    {patient?.date_of_birth && <p>ת.לידה: {patient.date_of_birth}</p>}
                    {patient?.medical_history?.allergies?.length > 0 && (
                      <p className="text-red-600 font-medium">אלרגיות: {patient.medical_history.allergies.join(', ')}</p>
                    )}
                    {patient?.medical_history?.current_medications?.length > 0 && (
                      <p>תרופות: {patient.medical_history.current_medications.join(', ')}</p>
                    )}
                  </div>
                </div>

                {/* Complaint */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-700">תלונה: {selected.chief_complaint}</p>
                  {selected.complaint_description && <p className="text-sm text-gray-500 mt-1">{selected.complaint_description}</p>}
                  {selected.ai_triage_reasoning && (
                    <div className="mt-2 p-2 bg-purple-50 rounded text-sm">
                      <p className="font-medium text-purple-700">מיון AI</p>
                      <p className="text-purple-600 text-xs mt-0.5">{selected.ai_triage_reasoning}</p>
                    </div>
                  )}
                </div>

                {/* AI Summary if exists */}
                {selected.ai_summary && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="font-medium text-blue-700 text-sm">סיכום AI</p>
                    <p className="text-sm text-blue-600 mt-1 whitespace-pre-wrap">{selected.ai_summary}</p>
                  </div>
                )}

                {/* Questionnaire Responses */}
                {questResponses.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <button onClick={() => setShowQuestionnaire(!showQuestionnaire)}
                      className="w-full flex items-center justify-between text-sm font-medium text-green-700">
                      <span>שאלון מטופל ({questResponses.length})</span>
                      <span className="text-xs">{showQuestionnaire ? '▲ הסתר' : '▼ הצג'}</span>
                    </button>
                    {showQuestionnaire && questResponses.map(qr => {
                      const quest = qr.questionnaire
                      const answers = (qr.responses || {}) as Record<string, string | string[]>
                      return (
                        <div key={qr.id} className="mt-3 space-y-3">
                          {quest && <p className="text-xs text-green-600 font-medium">{quest.title}</p>}
                          {(quest?.questions || []).filter(q => q.text.trim()).map((q, idx) => {
                            const answer = answers[q.id]
                            const hasAnswer = answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim().length > 0)
                            if (!hasAnswer) return null
                            return (
                              <div key={q.id} className="text-xs">
                                <p className="text-gray-600 font-medium">{idx + 1}. {q.text}</p>
                                <p className="text-gray-800 mt-0.5 bg-white rounded px-2 py-1">
                                  {Array.isArray(answer) ? answer.join(', ') : String(answer)}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* SOAP Notes */}
                <div className="space-y-3">
                  <h4 className="font-bold">SOAP Notes</h4>
                  <Textarea label="S — Subjective (תלונת המטופל)" value={soapForm.subjective_notes}
                    onChange={e => setSoapForm(p => ({ ...p, subjective_notes: e.target.value }))} />
                  <Textarea label="O — Objective (ממצאים)" value={soapForm.objective_notes}
                    onChange={e => setSoapForm(p => ({ ...p, objective_notes: e.target.value }))} />
                  <Textarea label="A — Assessment (הערכה)" value={soapForm.assessment}
                    onChange={e => setSoapForm(p => ({ ...p, assessment: e.target.value }))} />
                  <Textarea label="P — Plan (תוכנית)" value={soapForm.plan}
                    onChange={e => setSoapForm(p => ({ ...p, plan: e.target.value }))} />
                  <Input label="אבחנה" value={soapForm.diagnosis}
                    onChange={e => setSoapForm(p => ({ ...p, diagnosis: e.target.value }))} />
                  <Textarea label="הוראות מעקב" value={soapForm.follow_up_instructions}
                    onChange={e => setSoapForm(p => ({ ...p, follow_up_instructions: e.target.value }))} />
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={saveSOAP} loading={saving} variant="outline">שמור</Button>
                  {['ready', 'in_progress', 'scheduled'].includes(selected.status) && (
                    <Button onClick={() => router.push(`/video-call?id=${selected.id}`)} className="bg-green-600 hover:bg-green-700">שיחת וידאו</Button>
                  )}
                  {selected.status !== 'completed' && (
                    <Button onClick={completeAppointment} loading={saving}>סיים ייעוץ</Button>
                  )}
                </div>
              </CardContent>
            )
          })() : (
            <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>} title="בחר תור מהרשימה" />
          )}
        </Card>
      </div>
    </div>
  )
}
