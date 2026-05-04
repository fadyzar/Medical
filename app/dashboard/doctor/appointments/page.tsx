'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, Textarea, Input, PageLoading, EmptyState, Spinner } from '@/components/ui'
import { STATUS_LABELS, formatDateTime, formatDate, getInitials, cn } from '@/lib/utils'
import type { Appointment, User, QuestionnaireResponse, QuestionItem } from '@/types/database'

type ResponseWithQuest = QuestionnaireResponse & {
  questionnaire?: { id: string; title: string; questions: QuestionItem[] }
}

// ── DocLink: signed URL for medical documents ──────────────────────
function DocLink({ doc }: { doc: { id: string; file_name: string; file_type: string; storage_path: string } }) {
  const supabase = getClient()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    supabase.storage.from('medical-documents').createSignedUrl(doc.storage_path, 3600)
      .then(({ data, error }) => {
        console.log('[DocLink] signed url for', doc.file_name, ':', data?.signedUrl, 'error:', error)
        if (data?.signedUrl) setUrl(data.signedUrl)
      })
  }, [doc.storage_path])

  const isImage = doc.file_type?.startsWith('image/')

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
        {isImage ? (
          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-700 flex-1 truncate">{doc.file_name}</span>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline font-medium shrink-0">
          פתח
        </a>
      ) : (
        <span className="text-xs text-gray-400 shrink-0">טוען...</span>
      )}
    </div>
  )
}

// ── SchedulePanel: confirm + set date/time ─────────────────────────
function SchedulePanel({ apt, onScheduled }: {
  apt: Appointment
  onScheduled: (updated: Partial<Appointment>) => void
}) {
  const supabase = getClient()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(apt.scheduled_at ? apt.scheduled_at.slice(0, 16) : '')
  const [duration, setDuration] = useState(apt.duration_minutes ?? 30)
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    setSaving(true)
    try {
      const updates: Record<string, unknown> = {
        status: 'scheduled',
        doctor_accepted_at: new Date().toISOString(),
        duration_minutes: duration,
      }
      if (date) updates.scheduled_at = new Date(date).toISOString()

      const { error } = await supabase.from('appointments').update(updates).eq('id', apt.id)
      if (error) throw error
      onScheduled(updates as Partial<Appointment>)
      setOpen(false)

      // Notify patient: appointment scheduled
      fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: apt.id, event: 'appointment_scheduled' }),
      }).catch(() => {})
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => {
        setOpen(true)
        // Notify patient that doctor opened the scheduling panel (confirmed interest)
        if (!apt.doctor_accepted_at) {
          fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: apt.id, event: 'appointment_confirmed' }),
          }).catch(() => {})
        }
      }} className="bg-blue-600 hover:bg-blue-700 gap-2">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {apt.scheduled_at ? 'עדכן מועד' : 'אשר וקבע מועד'}
      </Button>
    )
  }

  return (
    <div className="w-full border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
      <p className="text-sm font-semibold text-blue-800">קביעת מועד לשיחת וידאו</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">תאריך ושעה</label>
          <input
            type="datetime-local"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">משך (דקות)</label>
          <select
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {[15, 20, 30, 45, 60, 90].map(m => (
              <option key={m} value={m}>{m} דקות</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={confirm} loading={saving} className="bg-blue-600 hover:bg-blue-700">
          אשר תור
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────
function PatientAvatar({ first, last, size = 'md' }: { first: string; last: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shrink-0', s[size])}>
      {getInitials(first || '?', last || '?')}
    </div>
  )
}

function statusBadgeVariant(status: string): 'success' | 'danger' | 'warning' | 'info' | 'default' {
  if (status === 'completed') return 'success'
  if (status.startsWith('cancelled') || status.startsWith('no_show')) return 'danger'
  if (status === 'pending' || status === 'payment_pending') return 'warning'
  if (status === 'in_progress') return 'success'
  return 'info'
}

// ── AI Summary Card ────────────────────────────────────────────────
function parseSummary(raw: string): { natural: string; structured: Record<string, unknown> | null } {
  try {
    const parsed = JSON.parse(raw)
    // Build natural language text from JSON
    const lines: string[] = []
    if (parsed.summary)         lines.push(parsed.summary)
    if (parsed.diagnosis)       lines.push(`**אבחנה:** ${parsed.diagnosis}`)
    if (parsed.treatment_plan)  lines.push(`**תוכנית טיפול:** ${parsed.treatment_plan}`)
    if (parsed.medications?.length) lines.push(`**תרופות:** ${(parsed.medications as string[]).join(', ')}`)
    if (parsed.follow_up)       lines.push(`**המשך טיפול:** ${parsed.follow_up}`)
    if (parsed.red_flags?.length) lines.push(`⚠️ **סימנים לדאגה:** ${(parsed.red_flags as string[]).join(', ')}`)
    return { natural: lines.join('\n\n') || raw, structured: parsed }
  } catch {
    return { natural: raw, structured: null }
  }
}

function AISummaryCard({
  summary, appointmentId, onSend, sending, sendResult, onClearResult,
}: {
  summary: string
  appointmentId: string
  onSend: (channel: 'email' | 'whatsapp' | 'in_app') => void
  sending: boolean
  sendResult: { ok: boolean; error?: string } | null
  onClearResult: () => void
}) {
  const [showJson, setShowJson] = useState(false)
  const { natural, structured } = parseSummary(summary)

  return (
    <Card className="border-blue-200">
      <CardHeader className="py-3 px-4 border-b border-blue-100 bg-blue-50/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
            </svg>
            <p className="text-sm font-semibold text-blue-800">סיכום ייעוץ — AI</p>
          </div>
          {structured && (
            <button
              onClick={() => setShowJson(v => !v)}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
            >
              {showJson ? 'הצג טקסט' : 'הצג JSON'}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-4 px-4 space-y-4">
        {/* Natural language view */}
        {!showJson && (
          <div className="space-y-2">
            {natural.split('\n\n').map((para, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                {para.replace(/\*\*(.*?)\*\*/g, (_, t) => t).split('**').map((seg, j) =>
                  j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg
                )}
              </p>
            ))}
          </div>
        )}

        {/* JSON view */}
        {showJson && structured && (
          <pre className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 overflow-auto max-h-60 border border-gray-200">
            {JSON.stringify(structured, null, 2)}
          </pre>
        )}

        {/* Send summary to patient */}
        <div className="pt-3 border-t border-blue-100 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">שלח סיכום למטופל</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { channel: 'in_app' as const, label: 'בעמוד', icon: '🔔', cls: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
              { channel: 'whatsapp' as const, label: 'WhatsApp', icon: '💬', cls: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200' },
              { channel: 'email' as const, label: 'אימייל', icon: '📧', cls: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200' },
            ].map(opt => (
              <button
                key={opt.channel}
                onClick={() => { onClearResult(); onSend(opt.channel) }}
                disabled={sending}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-40',
                  opt.cls
                )}
              >
                <span className="text-base">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          {sending && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Spinner size="sm" /> שולח...
            </div>
          )}
          {sendResult && (
            <div className={cn(
              'rounded-xl px-3 py-2 text-xs flex items-center gap-2 font-medium',
              sendResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            )}>
              {sendResult.ok ? (
                <><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>נשלח בהצלחה ✓</>
              ) : (
                <><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{sendResult.error || 'שגיאה בשליחה'}</>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── SOAP field definitions ─────────────────────────────────────────
const SOAP_FIELDS = [
  {
    key: 'subjective_notes' as const,
    letter: 'ס',
    letterEn: 'S',
    label: 'סובייקטיבי',
    sublabel: 'תלונת המטופל, תסמינים ותחושות סובייקטיביות',
    color: 'bg-blue-600',
    rows: 3,
  },
  {
    key: 'objective_notes' as const,
    letter: 'א',
    letterEn: 'O',
    label: 'אובייקטיבי',
    sublabel: 'ממצאים, בדיקות ונתונים מדידים',
    color: 'bg-indigo-600',
    rows: 3,
  },
  {
    key: 'assessment' as const,
    letter: 'ה',
    letterEn: 'A',
    label: 'הערכה',
    sublabel: 'אבחנה מבדלת והערכה קלינית',
    color: 'bg-violet-600',
    rows: 3,
  },
  {
    key: 'plan' as const,
    letter: 'ת',
    letterEn: 'P',
    label: 'תוכנית',
    sublabel: 'תוכנית טיפול, תרופות ופעולות',
    color: 'bg-purple-600',
    rows: 3,
  },
]

// ── main component ─────────────────────────────────────────────────
export default function DoctorAppointmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [soapForm, setSoapForm] = useState({ subjective_notes: '', objective_notes: '', assessment: '', plan: '', diagnosis: '', follow_up_instructions: '' })
  const [questResponses, setQuestResponses] = useState<ResponseWithQuest[]>([])
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [brief, setBrief] = useState<string | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [generatedDoc, setGeneratedDoc] = useState<{ content: string; label: string } | null>(null)
  const [docType, setDocType] = useState('medical_letter')
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [patientDocs, setPatientDocs] = useState<{ id: string; file_name: string; file_type: string; storage_path: string; created_at: string }[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [sendingSummary, setSendingSummary] = useState(false)
  const [sendSummaryResult, setSendSummaryResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const supabase = getClient()

  const DOC_TYPES = [
    { value: 'medical_letter',       label: 'מכתב רפואי' },
    { value: 'referral',             label: 'הפניה למומחה' },
    { value: 'sick_leave',           label: 'אישור מחלה' },
    { value: 'prescription_summary', label: 'סיכום טיפול תרופתי' },
    { value: 'discharge_summary',    label: 'סיכום ביקור' },
    { value: 'follow_up_plan',       label: 'תוכנית מעקב' },
  ]

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
    setBrief(null)
    setGeneratedDoc(null)
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

    // Fetch patient documents — by appointment_id OR by patient_id (documents uploaded via my-documents)
    setDocsLoading(true)
    try {
      const patientId = (apt as unknown as { patient_id: string }).patient_id
      const [{ data: aptDocs }, { data: patientAllDocs }] = await Promise.all([
        supabase.from('documents')
          .select('id, file_name, file_type, storage_path, created_at')
          .eq('appointment_id', apt.id)
          .order('created_at', { ascending: false }),
        supabase.from('documents')
          .select('id, file_name, file_type, storage_path, created_at')
          .eq('patient_id', patientId)
          .is('appointment_id', null)
          .order('created_at', { ascending: false }),
      ])
      // Merge and deduplicate
      const all = [...(aptDocs || []), ...(patientAllDocs || [])]
      const seen = new Set<string>()
      const deduped = all.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true })
      setPatientDocs(deduped as typeof patientDocs)
    } catch (e) {
      console.error('[Docs] failed to load:', e)
      setPatientDocs([])
    } finally {
      setDocsLoading(false)
    }
  }

  const sendSummaryToPatient = async (channel: 'email' | 'whatsapp' | 'in_app') => {
    if (!selected) return
    setSendingSummary(true)
    setSendSummaryResult(null)
    try {
      const res = await fetch('/api/notifications/send-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: selected.id, channel }),
      })
      const data = await res.json()
      if (res.ok) {
        const channelResult = data.results?.[channel] || data.results?.in_app
        setSendSummaryResult(channelResult || { ok: true })
      } else {
        setSendSummaryResult({ ok: false, error: data.error || 'שגיאה בשליחה' })
      }
    } catch {
      setSendSummaryResult({ ok: false, error: 'שגיאה בשליחה' })
    } finally {
      setSendingSummary(false)
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

    // Notify patient: appointment completed
    fetch('/api/notifications/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: selected.id, event: 'appointment_completed' }),
    }).catch(() => {})

    setSaving(false)
    setSelected(null)
    setMessage({ type: 'success', text: 'הייעוץ הסתיים בהצלחה' })
    setTimeout(() => setMessage(null), 3000)
    loadData()
  }

  const generateBrief = async (apt: Appointment) => {
    setBriefLoading(true)
    setBrief(null)
    setMessage(null)
    try {
      console.log('[AI Brief] calling for apt:', apt.id)
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: apt.id, action: 'brief' }),
      })
      const data = await res.json()
      console.log('[AI Brief] response status:', res.status, 'data:', data)
      if (res.ok) {
        setBrief(data.brief || data.summary || 'הבריף נוצר בהצלחה')
      } else {
        setMessage({ type: 'error', text: data.error || 'שגיאה ביצירת בריף AI' })
      }
    } catch (e) {
      console.error('[AI Brief] error:', e)
      setMessage({ type: 'error', text: 'שגיאה ביצירת בריף AI' })
    } finally {
      setBriefLoading(false)
    }
  }

  const generateAISummaryLocal = async (apt: Appointment) => {
    setAiSummaryLoading(true)
    setMessage(null)
    try {
      console.log('[AI Summary] calling for apt:', apt.id)
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: apt.id, action: 'summary' }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'סיכום AI נוצר בהצלחה' })
        setTimeout(() => setMessage(null), 3000)
        loadData()
      } else {
        setMessage({ type: 'error', text: 'שגיאה ביצירת סיכום AI' })
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאה ביצירת סיכום AI' })
    } finally {
      setAiSummaryLoading(false)
    }
  }

  const generateDocument = async (apt: Appointment) => {
    setDocLoading(true)
    setGeneratedDoc(null)
    setMessage(null)
    try {
      const res = await fetch('/api/ai-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: apt.id, documentType: docType }),
      })
      if (res.ok) {
        const data = await res.json()
        setGeneratedDoc({ content: data.document, label: data.label })
        setMessage({ type: 'success', text: `${data.label} נוצר ונשמר בתיק המטופל` })
        setTimeout(() => setMessage(null), 4000)
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || 'שגיאה ביצירת המסמך' })
      }
    } catch {
      setMessage({ type: 'error', text: 'שגיאה ביצירת המסמך' })
    } finally {
      setDocLoading(false)
    }
  }

  if (loading) return <PageLoading />

  const FILTER_OPTIONS = [
    { value: 'all',             label: 'הכל' },
    { value: 'pending',         label: 'ממתינים לאישור' },
    { value: 'payment_pending', label: 'ממתינים לתשלום' },
    { value: 'doctor_confirmed',label: 'אושרו' },
    { value: 'scheduled',       label: 'מתוזמנים' },
    { value: 'in_progress',     label: 'בתהליך' },
    { value: 'completed',       label: 'הושלמו' },
  ]

  const filtered = appointments
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => {
      if (!search.trim()) return true
      const patient = a.patient as unknown as User
      const q = search.toLowerCase()
      return (
        patient?.first_name?.toLowerCase().includes(q) ||
        patient?.last_name?.toLowerCase().includes(q) ||
        a.chief_complaint?.toLowerCase().includes(q)
      )
    })

  const selectedPatient = selected?.patient as unknown as User | undefined

  return (
    <div className="space-y-5">

      {/* ── page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול תורים</h1>
          <p className="text-sm text-gray-500 mt-0.5">{appointments.length} תורים בסך הכל</p>
        </div>
      </div>

      {/* ── toast ── */}
      {message && (
        <div className={cn(
          'flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium border',
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        )} role="status">
          <div className={cn('w-2 h-2 rounded-full shrink-0', message.type === 'success' ? 'bg-green-500' : 'bg-red-500')} />
          {message.text}
        </div>
      )}

      {/* ── two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">

        {/* ════ LEFT: appointment list ════ */}
        <div className="flex flex-col gap-3">

          {/* search */}
          <div className="relative">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם מטופל או תלונה..."
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pr-9 pl-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none placeholder:text-gray-400"
            />
          </div>

          {/* filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map(f => {
              const count = f.value === 'all' ? appointments.length : appointments.filter(a => a.status === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  aria-pressed={filter === f.value}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                    filter === f.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {f.label}
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    filter === f.value ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* list card */}
          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                }
                title="לא נמצאו תורים"
                description={search ? 'נסה לשנות את מונחי החיפוש' : 'אין תורים בסטטוס זה'}
              />
            ) : (
              <div className="divide-y max-h-[70vh] overflow-y-auto">
                {filtered.map(apt => {
                  const patient = apt.patient as unknown as User
                  const isSelected = selected?.id === apt.id
                  const isActive = ['in_progress'].includes(apt.status)

                  return (
                    <button
                      key={apt.id}
                      onClick={() => selectAppointment(apt)}
                      className={cn(
                        'w-full px-4 py-3.5 text-right flex gap-3 items-start transition-colors',
                        isSelected
                          ? 'bg-blue-50 border-r-4 border-blue-600'
                          : 'hover:bg-gray-50 border-r-4 border-transparent'
                      )}
                    >
                      <PatientAvatar first={patient?.first_name || ''} last={patient?.last_name || ''} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn('font-semibold text-sm truncate', isSelected ? 'text-blue-900' : 'text-gray-900')}>
                            {patient?.first_name} {patient?.last_name}
                          </p>
                          <Badge variant={statusBadgeVariant(apt.status)} className="text-[10px] shrink-0">
                            {STATUS_LABELS[apt.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{apt.chief_complaint}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-gray-400">
                            {formatDateTime(apt.scheduled_at || apt.created_at)}
                          </p>
                          {apt.ai_triage_score != null && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                              apt.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                              apt.ai_triage_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                                                         'bg-green-100 text-green-700'
                            )}>
                              דחיפות {apt.ai_triage_score}
                            </span>
                          )}
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] text-green-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              פעיל
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ════ RIGHT: detail panel ════ */}
        <Card className="overflow-hidden">
          {!selected ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <EmptyState
                icon={
                  <svg className="w-14 h-14 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                }
                title="בחר תור מהרשימה"
                description="לחץ על תור כדי לצפות בפרטים, לכתוב הערות SOAP וליצור מסמכים רפואיים"
              />
            </div>
          ) : (
            <div className="max-h-[85vh] overflow-y-auto">

              {/* ── patient hero header ── */}
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-l from-slate-50 to-white">
                <div className="flex items-start gap-4">
                  <PatientAvatar first={selectedPatient?.first_name || ''} last={selectedPatient?.last_name || ''} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {selectedPatient?.first_name} {selectedPatient?.last_name}
                        </h2>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-500">
                          {selectedPatient?.phone && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.13 19.79 19.79 0 01.13 4.5 2 2 0 012.09 2.32h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.41A16 16 0 0013.73 17l.47-.47a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2.02z" /></svg>
                              {selectedPatient.phone}
                            </span>
                          )}
                          {selectedPatient?.date_of_birth && (
                            <span>ת.לידה: {selectedPatient.date_of_birth}</span>
                          )}
                          {selectedPatient?.email && (
                            <span className="truncate max-w-[180px]">{selectedPatient.email}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant={statusBadgeVariant(selected.status)} className="text-xs shrink-0">
                        {STATUS_LABELS[selected.status]}
                      </Badge>
                    </div>

                    {/* medical alerts */}
                    {(() => {
                      const allergies: string[] = selectedPatient?.medical_history?.allergies || []
                      const meds: string[] = selectedPatient?.medical_history?.current_medications || []
                      if (!allergies.length && !meds.length) return null
                      return (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {allergies.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-700">
                              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              <span className="font-semibold">אלרגיות:</span> {allergies.join(', ')}
                            </div>
                          )}
                          {meds.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
                              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18.5 2l-15 15" /><path d="M3.5 6.5l4 4 4-4-4-4-4 4z" /><path d="M12.5 15.5l4 4 4-4-4-4-4 4z" />
                              </svg>
                              <span className="font-semibold">תרופות:</span> {meds.join(', ')}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* ── chief complaint card ── */}
                <Card className="border-gray-200">
                  <CardHeader className="py-3 px-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">תלונה עיקרית</p>
                  </CardHeader>
                  <CardContent className="py-3 px-4">
                    <p className="font-semibold text-gray-900">{selected.chief_complaint}</p>
                    {selected.complaint_description && (
                      <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{selected.complaint_description}</p>
                    )}
                    {selected.ai_triage_score != null && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-xs font-semibold px-2.5 py-1 rounded-full',
                          selected.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' :
                          selected.ai_triage_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                                                           'bg-green-100 text-green-700'
                        )}>
                          דחיפות AI: {selected.ai_triage_score}/10
                        </span>
                        {selected.ai_triage_category && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{selected.ai_triage_category}</span>
                        )}
                      </div>
                    )}
                    {selected.ai_triage_reasoning && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                        <p className="text-xs font-semibold text-purple-700 mb-1">נימוק מיון AI</p>
                        <p className="text-xs text-purple-600 leading-relaxed">{selected.ai_triage_reasoning}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── AI summary (if exists) ── */}
                {selected.ai_summary && (
                  <AISummaryCard
                    summary={selected.ai_summary}
                    appointmentId={selected.id}
                    onSend={sendSummaryToPatient}
                    sending={sendingSummary}
                    sendResult={sendSummaryResult}
                    onClearResult={() => setSendSummaryResult(null)}
                  />
                )}

                {/* ── questionnaire responses ── */}
                {questResponses.length > 0 && (
                  <Card className="border-emerald-200">
                    <button
                      onClick={() => setShowQuestionnaire(!showQuestionnaire)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-t-xl"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                        </svg>
                        <span className="text-sm font-semibold text-emerald-800">תשובות לשאלון ({questResponses.length})</span>
                      </div>
                      <svg className={cn('w-4 h-4 text-emerald-600 transition-transform', showQuestionnaire && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {showQuestionnaire && (
                      <CardContent className="py-4 px-4 space-y-5">
                        {questResponses.map(qr => {
                          const quest = qr.questionnaire
                          const answers = (qr.responses || {}) as Record<string, string | string[]>
                          return (
                            <div key={qr.id}>
                              {quest && (
                                <p className="text-xs font-semibold text-emerald-700 mb-3 flex items-center gap-1.5">
                                  <span className="w-1 h-4 rounded-full bg-emerald-500" />
                                  {quest.title}
                                </p>
                              )}
                              <div className="space-y-3">
                                {(quest?.questions || []).filter(q => q.text.trim()).map((q, idx) => {
                                  const answer = answers[q.id]
                                  const hasAnswer = answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim().length > 0)
                                  if (!hasAnswer) return null
                                  return (
                                    <div key={q.id} className="rounded-lg border border-gray-100 overflow-hidden">
                                      <div className="px-3 py-2 bg-gray-50">
                                        <p className="text-xs text-gray-600 font-medium">{idx + 1}. {q.text}</p>
                                      </div>
                                      <div className="px-3 py-2">
                                        <p className="text-sm text-gray-800 font-medium">
                                          {Array.isArray(answer) ? answer.join(', ') : String(answer)}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* ── Patient Documents ── */}
                {(docsLoading || patientDocs.length > 0) && (
                  <Card className="border-gray-200">
                    <CardHeader className="py-3 px-4 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">מסמכים שצורפו ע"י המטופל</p>
                      </div>
                    </CardHeader>
                    <CardContent className="py-3 px-4">
                      {docsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner size="sm" /> טוען מסמכים...</div>
                      ) : (
                        <div className="space-y-2">
                          {patientDocs.map(doc => (
                            <DocLink key={doc.id} doc={doc} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── AI pre-visit brief ── */}
                {['pending', 'payment_pending', 'doctor_confirmed', 'scheduled', 'ready', 'in_progress'].includes(selected.status) && (
                  <Card className="border-purple-300 overflow-hidden">
                    <CardHeader className="bg-gradient-to-l from-purple-600 to-violet-700 py-3 px-4 border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" />
                            <circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
                          </svg>
                          <span className="text-sm font-semibold text-white">בריף AI לפני הביקור</span>
                        </div>
                        <Button
                          size="sm"
                          loading={briefLoading}
                          onClick={() => generateBrief(selected)}
                          className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs h-7"
                        >
                          {brief ? 'רענן' : 'צור בריף'}
                        </Button>
                      </div>
                    </CardHeader>
                    {briefLoading ? (
                      <div className="px-5 py-6 flex items-center justify-center gap-3 text-purple-600 text-sm">
                        <Spinner size="sm" />
                        <span>AI מכין בריף עבורך...</span>
                      </div>
                    ) : brief ? (
                      <CardContent className="py-4 px-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{brief}</p>
                      </CardContent>
                    ) : (
                      <CardContent className="py-3 px-4">
                        <p className="text-xs text-gray-400 leading-relaxed">
                          לחץ "צור בריף" לקבלת סיכום AI של המטופל לפני הביקור — תלונה, היסטוריה, תשובות לשאלון ואזהרות דחיפות.
                        </p>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* ── SOAP notes ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1">
                      {['ס', 'א', 'ה', 'ת'].map((l, i) => (
                        <span key={i} className={cn(
                          'w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center',
                          ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-purple-600'][i]
                        )}>{l}</span>
                      ))}
                    </div>
                    <h3 className="font-bold text-gray-900">הערות SOAP</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      סובייקטיבי · אובייקטיבי · הערכה · תוכנית
                    </span>
                  </div>

                  <div className="space-y-3">
                    {SOAP_FIELDS.map(field => (
                      <div key={field.key} className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                          <span className={cn('w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center shrink-0', field.color)}>
                            {field.letter}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{field.label}</p>
                            <p className="text-[10px] text-gray-400">{field.sublabel}</p>
                          </div>
                        </div>
                        <textarea
                          rows={field.rows}
                          value={soapForm[field.key]}
                          onChange={e => setSoapForm(p => ({ ...p, [field.key]: e.target.value }))}
                          placeholder={`${field.label}...`}
                          className="w-full px-4 py-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none resize-y bg-white leading-relaxed"
                        />
                      </div>
                    ))}

                    {/* diagnosis + follow-up */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="אבחנה סופית"
                        value={soapForm.diagnosis}
                        onChange={e => setSoapForm(p => ({ ...p, diagnosis: e.target.value }))}
                        placeholder="למשל: יתר לחץ דם, URTI..."
                      />
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">הוראות מעקב</label>
                        <textarea
                          rows={2}
                          value={soapForm.follow_up_instructions}
                          onChange={e => setSoapForm(p => ({ ...p, follow_up_instructions: e.target.value }))}
                          placeholder="הוראות מעקב למטופל..."
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── action buttons ── */}
                <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
                  <Button onClick={saveSOAP} loading={saving} variant="outline" className="gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                    </svg>
                    שמור הערות
                  </Button>

                  {/* ── Confirm + Schedule (for pending/payment_pending) ── */}
                  {['pending', 'payment_pending', 'doctor_confirmed', 'time_selected'].includes(selected.status) && (
                    <SchedulePanel apt={selected} onScheduled={apt => {
                      setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, ...apt } : a))
                      setSelected(prev => prev ? { ...prev, ...apt } : prev)
                    }} />
                  )}

                  {['pending', 'payment_pending', 'doctor_confirmed', 'time_selected', 'paid', 'scheduled', 'ready', 'in_progress'].includes(selected.status) && (
                    <Button
                      onClick={() => router.push(`/video-call?id=${selected.id}`)}
                      className="bg-green-600 hover:bg-green-700 gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      שיחת וידאו
                    </Button>
                  )}

                  {selected.status === 'completed' && !selected.ai_summary && (
                    <Button
                      onClick={() => generateAISummaryLocal(selected)}
                      loading={aiSummaryLoading}
                      className="bg-purple-600 hover:bg-purple-700 gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
                      </svg>
                      צור סיכום AI
                    </Button>
                  )}

                  {selected.status !== 'completed' && (
                    <Button onClick={completeAppointment} loading={saving} variant="danger" className="gap-2 mr-auto">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      סיים ייעוץ
                    </Button>
                  )}
                </div>

                {/* ── document generation ── */}
                <Card className="border-gray-200 overflow-hidden">
                  <CardHeader className="bg-gray-50 py-3 px-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">הפקת מסמך רפואי</p>
                        <p className="text-[10px] text-gray-400">AI יצור מסמך מותאם ויישמר בתיק המטופל</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-4 px-4 space-y-3">
                    <div className="flex gap-2">
                      <select
                        value={docType}
                        onChange={e => setDocType(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-white"
                      >
                        {DOC_TYPES.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        loading={docLoading}
                        onClick={() => generateDocument(selected)}
                        variant="outline"
                        className="shrink-0 gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
                        </svg>
                        צור מסמך
                      </Button>
                    </div>

                    {/* document preview */}
                    {docLoading && (
                      <div className="rounded-xl border border-gray-200 py-8 flex items-center justify-center gap-3 text-gray-500 text-sm bg-gray-50">
                        <Spinner size="sm" />
                        <span>AI מייצר את המסמך...</span>
                      </div>
                    )}

                    {generatedDoc && !docLoading && (
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        {/* doc header */}
                        <div className="px-4 py-3 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p className="text-sm font-semibold text-slate-700">{generatedDoc.label}</p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedDoc.content)
                              setMessage({ type: 'success', text: 'הועתק ללוח' })
                              setTimeout(() => setMessage(null), 2000)
                            }}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            העתק
                          </button>
                        </div>
                        {/* doc body */}
                        <div className="p-5 max-h-72 overflow-y-auto">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{generatedDoc.content}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
