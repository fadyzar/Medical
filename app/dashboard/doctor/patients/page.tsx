'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, Badge, PageLoading, EmptyState } from '@/components/ui'
import { cn, formatDateTime, STATUS_LABELS, getInitials } from '@/lib/utils'
import type { User, Appointment, Document } from '@/types/database'

// ── Types ──────────────────────────────────────────────

type PatientWithStats = User & {
  appointment_count: number
  last_visit: string | null
  next_visit: string | null
}

type PatientAppointment = Appointment & {
  doctor?: User
}

// ── Main page ──────────────────────────────────────────

export default function DoctorPatientsPage() {
  const router = useRouter()
  const supabase = getClient()

  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<PatientWithStats[]>([])
  const [selected, setSelected] = useState<PatientWithStats | null>(null)
  const [search, setSearch] = useState('')

  // Detail panel state
  const [detailTab, setDetailTab] = useState<'info' | 'visits' | 'documents'>('info')
  const [visits, setVisits] = useState<PatientAppointment[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => { loadPatients() }, [])

  const loadPatients = async () => {
    try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Get all appointments for this doctor with patient info
    const { data: appointments } = await supabase.from('appointments')
      .select('patient_id, scheduled_at, status, created_at, patient:patient_id(id, first_name, last_name, email, phone, date_of_birth, gender, avatar_url, medical_history, insurance_info, languages, organization_id)')
      .eq('doctor_id', user.id)
      .order('created_at', { ascending: false })

    if (!appointments) { setLoading(false); return }

    // Group by patient and compute stats
    const patientMap = new Map<string, PatientWithStats>()

    for (const apt of appointments as unknown as Array<{ patient_id: string; scheduled_at: string | null; status: string; created_at: string; patient: User | null }>) {
      if (!apt.patient) continue
      const pid = apt.patient_id

      if (!patientMap.has(pid)) {
        patientMap.set(pid, {
          ...apt.patient,
          appointment_count: 0,
          last_visit: null,
          next_visit: null,
        })
      }

      const p = patientMap.get(pid)!
      p.appointment_count++

      // Track last completed visit
      if (apt.status === 'completed' && apt.scheduled_at) {
        if (!p.last_visit || apt.scheduled_at > p.last_visit) {
          p.last_visit = apt.scheduled_at
        }
      }

      // Track next upcoming visit
      if (['scheduled', 'ready', 'doctor_confirmed', 'paid'].includes(apt.status) && apt.scheduled_at) {
        const now = new Date().toISOString()
        if (apt.scheduled_at > now) {
          if (!p.next_visit || apt.scheduled_at < p.next_visit) {
            p.next_visit = apt.scheduled_at
          }
        }
      }
    }

    // Sort by most recent interaction
    const sorted = Array.from(patientMap.values()).sort((a, b) => {
      const aDate = a.last_visit || a.next_visit || ''
      const bDate = b.last_visit || b.next_visit || ''
      return bDate.localeCompare(aDate)
    })

    setPatients(sorted)
    } catch {
      // Prevents infinite loading on network error
    } finally {
      setLoading(false)
    }
  }

  const selectPatient = async (patient: PatientWithStats) => {
    setSelected(patient)
    setDetailTab('info')
    setDetailLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load visits and documents in parallel
      const [visitsRes, docsRes] = await Promise.all([
        supabase.from('appointments')
          .select('*')
          .eq('doctor_id', user.id)
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false }),
        supabase.from('documents')
          .select('*')
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      setVisits((visitsRes.data || []) as unknown as PatientAppointment[])
      setDocuments((docsRes.data || []) as unknown as Document[])
    } catch {
      setVisits([])
      setDocuments([])
    } finally {
      setDetailLoading(false)
    }
  }

  // Filter patients by search
  const filtered = patients.filter(p => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.id_number?.includes(q)
    )
  })

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">המטופלים שלי</h2>
          <p className="text-sm text-gray-500">{patients.length} מטופלים</p>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="חיפוש לפי שם, אימייל, טלפון או ת.ז..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {patients.length === 0 ? (
        <EmptyState
          icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>}
          title="אין מטופלים עדיין"
          description="כשמטופלים יקבעו תורים, הם יופיעו כאן."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Patient list */}
          <div className="lg:col-span-2">
            <Card className="max-h-[75vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>} title="לא נמצאו תוצאות" description="נסה לחפש מחדש" />
              ) : (
                <div className="divide-y">
                  {filtered.map(patient => {
                    const isSelected = selected?.id === patient.id
                    return (
                      <button
                        key={patient.id}
                        onClick={() => selectPatient(patient)}
                        className={cn(
                          'w-full px-4 py-3 text-right hover:bg-gray-50 transition-colors',
                          isSelected && 'bg-blue-50 border-r-4 border-blue-600'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {patient.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={patient.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                              {getInitials(patient.first_name, patient.last_name)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{patient.first_name} {patient.last_name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              <span>{patient.appointment_count} תורים</span>
                              {patient.last_visit && (
                                <>
                                  <span>·</span>
                                  <span>ביקור אחרון: {new Date(patient.last_visit).toLocaleDateString('he-IL')}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {patient.next_visit && (
                            <Badge variant="info" className="shrink-0">תור קרוב</Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-3">
            <Card className="max-h-[75vh] overflow-y-auto">
              {selected ? (
                <div>
                  {/* Patient header */}
                  <div className="px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      {selected.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selected.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
                          {getInitials(selected.first_name, selected.last_name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg">{selected.first_name} {selected.last_name}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          {selected.email && <span>{selected.email}</span>}
                          {selected.phone && <span>טל׳: {selected.phone}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/dashboard/doctor/appointments?search=${encodeURIComponent(selected.first_name + ' ' + selected.last_name)}`)}
                      >
                        צפה בתורים
                      </Button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-100">
                    {([
                      { key: 'info' as const, label: 'פרטים', count: null },
                      { key: 'visits' as const, label: 'היסטוריית ביקורים', count: visits.length },
                      { key: 'documents' as const, label: 'מסמכים', count: documents.length },
                    ]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setDetailTab(tab.key)}
                        className={cn(
                          'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                          detailTab === tab.key
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                      >
                        {tab.label}
                        {tab.count !== null && tab.count > 0 && (
                          <span className="mr-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="p-6">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 h-6 w-6" />
                      </div>
                    ) : (
                      <>
                        {detailTab === 'info' && <PatientInfo patient={selected} />}
                        {detailTab === 'visits' && <PatientVisits visits={visits} />}
                        {detailTab === 'documents' && <PatientDocuments documents={documents} supabase={supabase} />}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>} title="בחר מטופל מהרשימה" description="לחץ על מטופל כדי לראות את הפרטים שלו" />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Patient Info Tab ───────────────────────────────────

function PatientInfo({ patient }: { patient: PatientWithStats }) {
  const medHistory = patient.medical_history || { allergies: [], chronic_conditions: [], current_medications: [], past_surgeries: [] }
  const insurance = patient.insurance_info || {}

  return (
    <div className="space-y-6">
      {/* Personal Details */}
      <section>
        <h4 className="font-bold text-gray-900 mb-3">פרטים אישיים</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="שם מלא" value={`${patient.first_name} ${patient.last_name}`} />
          <InfoRow label="אימייל" value={patient.email} />
          <InfoRow label="טלפון" value={patient.phone} />
          <InfoRow label="תאריך לידה" value={patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('he-IL') : null} />
          <InfoRow label="מגדר" value={patient.gender === 'male' ? 'זכר' : patient.gender === 'female' ? 'נקבה' : patient.gender === 'other' ? 'אחר' : null} />
          <InfoRow label="ת.ז" value={patient.id_number} />
        </div>
      </section>

      {/* Medical History */}
      <section>
        <h4 className="font-bold text-gray-900 mb-3">היסטוריה רפואית</h4>
        <div className="space-y-3">
          <MedicalList
            label="אלרגיות"
            items={medHistory.allergies}
            variant="danger"
          />
          <MedicalList
            label="מחלות רקע"
            items={medHistory.chronic_conditions}
            variant="warning"
          />
          <MedicalList
            label="תרופות קבועות"
            items={medHistory.current_medications}
            variant="info"
          />
          <MedicalList
            label="ניתוחים קודמים"
            items={medHistory.past_surgeries}
            variant="default"
          />
        </div>
      </section>

      {/* Insurance */}
      {insurance.provider && (
        <section>
          <h4 className="font-bold text-gray-900 mb-3">ביטוח בריאות</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="קופה/חברה" value={insurance.provider} />
            <InfoRow label="מספר פוליסה" value={insurance.policy_number} />
          </div>
        </section>
      )}

      {/* Stats */}
      <section>
        <h4 className="font-bold text-gray-900 mb-3">סטטיסטיקות</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{patient.appointment_count}</p>
            <p className="text-xs text-gray-500">תורים</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-sm font-bold text-green-600">
              {patient.last_visit ? new Date(patient.last_visit).toLocaleDateString('he-IL') : '—'}
            </p>
            <p className="text-xs text-gray-500">ביקור אחרון</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-sm font-bold text-purple-600">
              {patient.next_visit ? new Date(patient.next_visit).toLocaleDateString('he-IL') : '—'}
            </p>
            <p className="text-xs text-gray-500">תור הבא</p>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Patient Visits Tab ─────────────────────────────────

function PatientVisits({ visits }: { visits: PatientAppointment[] }) {
  if (visits.length === 0) {
    return <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>} title="אין ביקורים" description="טרם נקבעו תורים עם מטופל זה" />
  }

  return (
    <div className="space-y-3">
      {visits.map(visit => (
        <div key={visit.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-gray-900">{visit.chief_complaint}</p>
              {visit.complaint_description && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{visit.complaint_description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={visit.status === 'completed' ? 'success' : visit.status.startsWith('cancelled') ? 'danger' : 'info'}>
                {STATUS_LABELS[visit.status]}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span>{formatDateTime(visit.scheduled_at || visit.created_at)}</span>
            {visit.diagnosis && (
              <>
                <span>·</span>
                <span className="text-gray-600">אבחנה: {visit.diagnosis}</span>
              </>
            )}
            {visit.ai_triage_score != null && (
              <>
                <span>·</span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded',
                  visit.ai_triage_score >= 7 ? 'bg-red-100 text-red-700' : visit.ai_triage_score >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                )}>
                  דחיפות: {visit.ai_triage_score}
                </span>
              </>
            )}
          </div>

          {/* SOAP summary for completed visits */}
          {visit.status === 'completed' && (visit.assessment || visit.plan || visit.follow_up_instructions) && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
              {visit.assessment && (
                <p className="text-sm"><span className="font-medium text-gray-700">הערכה:</span> <span className="text-gray-600">{visit.assessment}</span></p>
              )}
              {visit.plan && (
                <p className="text-sm"><span className="font-medium text-gray-700">תוכנית:</span> <span className="text-gray-600">{visit.plan}</span></p>
              )}
              {visit.follow_up_instructions && (
                <p className="text-sm"><span className="font-medium text-gray-700">מעקב:</span> <span className="text-gray-600">{visit.follow_up_instructions}</span></p>
              )}
            </div>
          )}

          {/* AI summary */}
          {visit.ai_summary && (
            <div className="mt-3 p-2.5 bg-purple-50 rounded-lg">
              <p className="text-xs font-medium text-purple-700 mb-0.5">סיכום AI</p>
              <p className="text-xs text-purple-600 line-clamp-3">{visit.ai_summary}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Patient Documents Tab ──────────────────────────────

function PatientDocuments({ documents, supabase }: { documents: Document[]; supabase: ReturnType<typeof getClient> }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleDownload = async (doc: Document) => {
    setDownloading(doc.id)
    setDownloadError(null)
    try {
      const { data, error } = await supabase.storage
        .from('medical-documents')
        .createSignedUrl(doc.storage_path, 60)

      if (error || !data?.signedUrl) {
        setDownloadError('שגיאה בפתיחת המסמך')
        return
      }
      window.open(data.signedUrl, '_blank')
    } catch {
      setDownloadError('שגיאה בפתיחת המסמך')
    } finally {
      setDownloading(null)
    }
  }

  if (documents.length === 0) {
    return <EmptyState icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>} title="אין מסמכים" description="למטופל זה אין מסמכים" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-2">
      {downloadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{downloadError}</div>
      )}
      {documents.map(doc => (
        <div key={doc.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{doc.file_name}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{formatFileSize(doc.file_size_bytes)}</span>
                {doc.category && (
                  <>
                    <span>·</span>
                    <span>{doc.category}</span>
                  </>
                )}
                <span>·</span>
                <span>{new Date(doc.created_at).toLocaleDateString('he-IL')}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownload(doc)}
            loading={downloading === doc.id}
          >
            צפה
          </Button>
        </div>
      ))}
    </div>
  )
}

// ── Shared helpers ──────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-900">{value || '—'}</p>
    </div>
  )
}

function MedicalList({ label, items, variant }: { label: string; items: string[]; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }) {
  const colors = {
    success: 'bg-green-50 text-green-700',
    warning: 'bg-yellow-50 text-yellow-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    default: 'bg-gray-50 text-gray-700',
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">לא דווח</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className={cn('px-2.5 py-1 rounded-full text-xs font-medium', colors[variant])}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
