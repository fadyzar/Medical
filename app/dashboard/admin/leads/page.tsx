'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Input, Select, Card, CardHeader, CardContent, Badge, PageLoading, EmptyState, Textarea } from '@/components/ui'
import { formatDateTime, formatDate, SPECIALTIES, cn } from '@/lib/utils'
import type { Lead, LeadStatus, LeadPriority, LeadSource, User } from '@/types/database'

// ── Constants ──────────────────────────────────────────

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new',       label: 'ליד חדש',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted', label: 'נוצר קשר',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'qualified', label: 'מוכשר',       color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'converted', label: 'הומר למטופל', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost',      label: 'ירד מהפרויקט',color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

const PRIORITY_OPTIONS: { value: LeadPriority; label: string }[] = [
  { value: 'low',    label: 'נמוכה' },
  { value: 'normal', label: 'רגילה' },
  { value: 'high',   label: 'גבוהה' },
  { value: 'urgent', label: 'דחוף' },
]

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'website',  label: 'אתר' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone',    label: 'טלפון' },
  { value: 'referral', label: 'הפניה' },
  { value: 'ad',       label: 'מודעה' },
  { value: 'other',    label: 'אחר' },
]

const PRIORITY_BADGE: Record<LeadPriority, string> = {
  low:    'bg-gray-100 text-gray-500',
  normal: 'bg-blue-50 text-blue-600',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const PRIORITY_LABEL: Record<LeadPriority, string> = {
  low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחוף',
}

type LeadWithAssignee = Lead & { assignee?: Pick<User, 'id' | 'first_name' | 'last_name'> | null }

type FormState = {
  first_name: string; last_name: string; phone: string; email: string
  source: LeadSource; specialty_interest: string; message: string
  priority: LeadPriority; assigned_to: string; next_follow_up: string; notes: string
  status: LeadStatus
}

const emptyForm: FormState = {
  first_name: '', last_name: '', phone: '', email: '',
  source: 'other', specialty_interest: '', message: '',
  priority: 'normal', assigned_to: '', next_follow_up: '', notes: '',
  status: 'new',
}

// ── Component ──────────────────────────────────────────

export default function AdminLeadsPage() {
  const supabase = getClient()
  const [leads, setLeads] = useState<LeadWithAssignee[]>([])
  const [staff, setStaff] = useState<Pick<User, 'id' | 'first_name' | 'last_name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<LeadWithAssignee | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return

      const [leadsRes, staffRes] = await Promise.all([
        supabase.from('leads')
          .select('*, assignee:assigned_to(id, first_name, last_name)')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false }),
        supabase.from('users')
          .select('id, first_name, last_name')
          .eq('organization_id', profile.organization_id)
          .in('role', ['staff', 'admin', 'doctor'])
          .eq('is_active', true),
      ])

      setLeads((leadsRes.data || []) as unknown as LeadWithAssignee[])
      setStaff((staffRes.data || []) as unknown as Pick<User, 'id' | 'first_name' | 'last_name'>[])
    } catch {
      toast.error('שגיאה בטעינת הלידים')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setIsNew(true)
    setForm(emptyForm)
    setSelected(null)
    setShowModal(true)
  }

  function openEdit(lead: LeadWithAssignee) {
    setIsNew(false)
    setSelected(lead)
    setForm({
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source,
      specialty_interest: lead.specialty_interest || '',
      message: lead.message || '',
      priority: lead.priority,
      assigned_to: lead.assigned_to || '',
      next_follow_up: lead.next_follow_up ? lead.next_follow_up.split('T')[0] : '',
      notes: lead.notes || '',
      status: lead.status,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.first_name || !form.last_name) {
      toast.error('שם פרטי ושם משפחה נדרשים')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return

      const payload = {
        organization_id: profile.organization_id,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
        email: form.email || null,
        source: form.source,
        specialty_interest: form.specialty_interest || null,
        message: form.message || null,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        next_follow_up: form.next_follow_up || null,
        notes: form.notes || null,
        status: form.status,
      }

      if (isNew) {
        const { error } = await supabase.from('leads').insert(payload)
        if (error) throw error
        toast.success('ליד נוסף בהצלחה')
      } else if (selected) {
        const { error } = await supabase.from('leads').update(payload).eq('id', selected.id)
        if (error) throw error
        toast.success('ליד עודכן בהצלחה')
      }

      setShowModal(false)
      loadData()
    } catch (err) {
      toast.error('שגיאה בשמירה')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(leadId: string, newStatus: LeadStatus) {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    if (error) { toast.error('שגיאה בעדכון סטטוס'); return }
    toast.success('סטטוס עודכן')
    setLeads((prev: LeadWithAssignee[]) => prev.map((l: LeadWithAssignee) => l.id === leadId ? { ...l, status: newStatus } : l))
    if (selected?.id === leadId) setSelected((prev: LeadWithAssignee | null) => prev ? { ...prev, status: newStatus } : prev)
  }

  async function handleDelete(leadId: string) {
    if (!confirm('האם למחוק ליד זה לצמיתות?')) return
    const { error } = await supabase.from('leads').delete().eq('id', leadId)
    if (error) { toast.error('שגיאה במחיקה'); return }
    toast.success('ליד נמחק')
    setLeads((prev: LeadWithAssignee[]) => prev.filter((l: LeadWithAssignee) => l.id !== leadId))
    if (selected?.id === leadId) setSelected(null)
  }

  async function analyzeWithAI(lead: LeadWithAssignee) {
    setAiLoading(true)
    try {
      // We call via our own API to keep key server-side
      const res = await fetch('/api/ai-lead-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })
      if (res.ok) {
        const data = await res.json()
        // Update lead with AI score
        await supabase.from('leads').update({
          ai_score: data.score,
          ai_analysis: data.analysis,
          ai_recommendations: data.recommendations,
        }).eq('id', lead.id)
        toast.success('ניתוח AI הושלם')
        loadData()
      } else {
        toast.error('שגיאה בניתוח AI')
      }
    } catch {
      toast.error('שגיאה בניתוח AI')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) return <PageLoading />

  const filtered = leads.filter((l: LeadWithAssignee) => {
    const matchStatus = !filterStatus || l.status === filterStatus
    const matchSearch = !search || `${l.first_name} ${l.last_name} ${l.phone || ''} ${l.email || ''}`.includes(search)
    return matchStatus && matchSearch
  })

  // KPI counts
  const counts = STATUS_OPTIONS.reduce((acc: Record<string, number>, s) => {
    acc[s.value] = leads.filter((l: LeadWithAssignee) => l.status === s.value).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">ניהול לידים</h2>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} לידים סה"כ</p>
        </div>
        <Button onClick={openNew}>+ ליד חדש</Button>
      </div>

      {/* Status pipeline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
            className={cn(
              'p-4 rounded-xl border text-right transition-all hover:shadow-sm',
              filterStatus === s.value ? s.color + ' shadow-sm' : 'bg-white border-gray-200'
            )}
          >
            <p className="text-2xl font-bold">{counts[s.value] || 0}</p>
            <p className="text-xs font-medium mt-0.5 text-gray-600">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input placeholder="חיפוש לפי שם, טלפון, אימייל..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="w-48">
          <Select
            options={[{ value: '', label: 'כל הסטטוסים' }, ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))]}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          />
        </div>
      </div>

      {/* Leads list + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <Card className="max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
              title={leads.length === 0 ? 'אין לידים עדיין' : 'לא נמצאו לידים'}
              description={leads.length === 0 ? 'הוסף ליד ראשון למערכת' : 'נסה לשנות את מסנני החיפוש'}
              action={leads.length === 0 ? <Button onClick={openNew}>הוסף ליד</Button> : undefined}
            />
          ) : (
            <div className="divide-y">
              {filtered.map((lead: LeadWithAssignee) => {
                const statusInfo = STATUS_OPTIONS.find(s => s.value === lead.status)
                const isSelected = selected?.id === lead.id
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelected(isSelected ? null : lead)}
                    className={cn(
                      'w-full px-4 py-3 text-right hover:bg-gray-50 transition-colors',
                      isSelected && 'bg-blue-50 border-r-4 border-blue-600'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{lead.first_name} {lead.last_name}</p>
                          {lead.ai_score != null && (
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded font-bold',
                              lead.ai_score >= 7 ? 'bg-green-100 text-green-700' :
                              lead.ai_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-500'
                            )}>
                              AI {lead.ai_score}/10
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {lead.phone || lead.email || '—'}
                          {lead.specialty_interest && ` · ${lead.specialty_interest}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(lead.created_at)}
                          {lead.assignee && ` · ${lead.assignee.first_name} ${lead.assignee.last_name}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', statusInfo?.color || '')}>
                          {statusInfo?.label}
                        </span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_BADGE[lead.priority as LeadPriority])}>
                          {PRIORITY_LABEL[lead.priority as LeadPriority]}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* Detail panel */}
        <div className="space-y-4">
          {selected ? (
            <>
              {/* Lead detail card */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{selected.first_name} {selected.last_name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        נוסף {formatDateTime(selected.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>עריכה</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(selected.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">מחק</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contact */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selected.phone && (
                      <div>
                        <p className="text-gray-400 text-xs">טלפון</p>
                        <a href={`tel:${selected.phone}`} className="font-medium text-blue-600 hover:underline">{selected.phone}</a>
                      </div>
                    )}
                    {selected.email && (
                      <div>
                        <p className="text-gray-400 text-xs">אימייל</p>
                        <a href={`mailto:${selected.email}`} className="font-medium text-blue-600 hover:underline">{selected.email}</a>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-400 text-xs">מקור</p>
                      <p className="font-medium">{SOURCE_OPTIONS.find(s => s.value === selected.source)?.label}</p>
                    </div>
                    {selected.specialty_interest && (
                      <div>
                        <p className="text-gray-400 text-xs">התמחות מבוקשת</p>
                        <p className="font-medium">{selected.specialty_interest}</p>
                      </div>
                    )}
                    {selected.next_follow_up && (
                      <div>
                        <p className="text-gray-400 text-xs">מעקב הבא</p>
                        <p className="font-medium">{formatDate(selected.next_follow_up)}</p>
                      </div>
                    )}
                    {selected.assignee && (
                      <div>
                        <p className="text-gray-400 text-xs">מטפל</p>
                        <p className="font-medium">{selected.assignee.first_name} {selected.assignee.last_name}</p>
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  {selected.message && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">הודעת הליד</p>
                      <p className="text-sm text-gray-700">{selected.message}</p>
                    </div>
                  )}

                  {/* AI analysis */}
                  {selected.ai_analysis && (
                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-purple-700">ניתוח AI</p>
                        {selected.ai_score != null && (
                          <span className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded',
                            selected.ai_score >= 7 ? 'bg-green-100 text-green-700' :
                            selected.ai_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          )}>
                            ציון {selected.ai_score}/10
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-purple-700">{selected.ai_analysis}</p>
                      {selected.ai_recommendations && (
                        <p className="text-xs text-purple-600 mt-1.5 border-t border-purple-100 pt-1.5">
                          המלצות: {selected.ai_recommendations}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {selected.notes && (
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">הערות פנימיות</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-3 pt-1">
                    {/* Status pipeline */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">שינוי סטטוס</p>
                      <div className="flex gap-2 flex-wrap">
                        {STATUS_OPTIONS.filter(s => s.value !== selected.status).map(s => (
                          <button
                            key={s.value}
                            onClick={() => updateStatus(selected.id, s.value)}
                            className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-all hover:shadow-sm', s.color)}
                          >
                            → {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI + contact buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={aiLoading}
                        onClick={() => analyzeWithAI(selected)}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50"
                      >
                        ניתוח AI
                      </Button>
                      {selected.phone && (
                        <a href={`https://wa.me/972${selected.phone.replace(/\D/g, '').replace(/^0/, '')}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                            WhatsApp
                          </Button>
                        </a>
                      )}
                      {selected.phone && (
                        <a href={`tel:${selected.phone}`}>
                          <Button size="sm" variant="outline">התקשר</Button>
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>}
                title="בחר ליד לפרטים"
                description="לחץ על ליד מהרשימה להצגת פרטים ופעולות"
              />
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold">{isNew ? 'ליד חדש' : 'עריכת ליד'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <Input label="שם פרטי *" value={form.first_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p: FormState) => ({ ...p, first_name: e.target.value }))} />
              <Input label="שם משפחה *" value={form.last_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p: FormState) => ({ ...p, last_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="טלפון" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="050-1234567" />
              <Input label="אימייל" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="מקור"
                options={SOURCE_OPTIONS}
                value={form.source}
                onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))}
              />
              <Select
                label="עדיפות"
                options={PRIORITY_OPTIONS}
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as LeadPriority }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="סטטוס"
                options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as LeadStatus }))}
              />
              <Select
                label="הקצה לנציג"
                options={[{ value: '', label: 'לא מוקצה' }, ...staff.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))]}
                value={form.assigned_to}
                onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">התמחות מבוקשת</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  value={form.specialty_interest}
                  onChange={e => setForm(p => ({ ...p, specialty_interest: e.target.value }))}
                >
                  <option value="">בחר התמחות</option>
                  {SPECIALTIES.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                </select>
              </div>
              <Input
                label="מועד מעקב"
                type="date"
                value={form.next_follow_up}
                onChange={e => setForm(p => ({ ...p, next_follow_up: e.target.value }))}
              />
            </div>

            <Textarea
              label="הודעת הליד"
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="מה הליד כתב / אמר..."
            />

            <Textarea
              label="הערות פנימיות"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="הערות לצוות..."
            />

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>ביטול</Button>
              <Button onClick={handleSave} loading={saving}>
                {isNew ? 'הוסף ליד' : 'שמור שינויים'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
