'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Card, CardHeader, CardContent, Badge, PageLoading, EmptyState, Textarea, Input, Select } from '@/components/ui'
import { formatDateTime, formatDate, cn } from '@/lib/utils'
import type { Lead, LeadStatus } from '@/types/database'

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new',       label: 'ליד חדש',     color: 'bg-teal-100 text-teal-700' },
  { value: 'contacted', label: 'נוצר קשר',    color: 'bg-yellow-100 text-yellow-700' },
  { value: 'qualified', label: 'מוכשר',       color: 'bg-purple-100 text-purple-700' },
  { value: 'converted', label: 'הומר למטופל', color: 'bg-green-100 text-green-700' },
  { value: 'lost',      label: 'ירד',         color: 'bg-slate-100 text-slate-500' },
]

export default function StaffLeadsPage() {
  const supabase = getClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('new')
  const [search, setSearch] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [userId, setUserId] = useState('')

  const loadLeads = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase.from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      setLeads((data || []) as unknown as Lead[])
    } catch {
      toast.error('שגיאה בטעינת הלידים')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadLeads() }, [loadLeads])

  function selectLead(lead: Lead) {
    setSelected(lead)
    setNoteText(lead.notes || '')
    setFollowUpDate(lead.next_follow_up ? lead.next_follow_up.split('T')[0] : '')
  }

  async function updateStatus(leadId: string, newStatus: LeadStatus) {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    if (error) { toast.error('שגיאה בעדכון סטטוס'); return }
    toast.success('סטטוס עודכן')
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    if (selected?.id === leadId) setSelected(prev => prev ? { ...prev, status: newStatus } : null)
  }

  async function saveNote() {
    if (!selected) return
    setSavingNote(true)
    const { error } = await supabase.from('leads').update({
      notes: noteText,
      next_follow_up: followUpDate || null,
      assigned_to: userId || null,
    }).eq('id', selected.id)

    if (error) {
      toast.error('שגיאה בשמירת הערה')
    } else {
      toast.success('נשמר בהצלחה')
      setLeads(prev => prev.map(l => l.id === selected.id
        ? { ...l, notes: noteText, next_follow_up: followUpDate || null }
        : l
      ))
      setSelected(prev => prev ? { ...prev, notes: noteText, next_follow_up: followUpDate || null } : null)
    }
    setSavingNote(false)
  }

  if (loading) return <PageLoading />

  const filtered = leads.filter(l => {
    const matchStatus = !filterStatus || l.status === filterStatus
    const matchSearch = !search || `${l.first_name} ${l.last_name} ${l.phone || ''} ${l.email || ''}`.includes(search)
    return matchStatus && matchSearch
  })

  const myCounts = STATUS_OPTIONS.slice(0, 3).reduce((acc, s) => {
    acc[s.value] = leads.filter(l => l.status === s.value).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">לידים לטיפול</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {leads.filter(l => ['new', 'contacted'].includes(l.status)).length} לידים פעילים
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_OPTIONS.slice(0, 3).map(s => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
            className={cn(
              'p-4 rounded-xl border text-right transition-all',
              filterStatus === s.value ? s.color + ' border-current' : 'bg-white border-slate-200 hover:border-slate-300'
            )}
          >
            <p className="text-2xl font-bold">{myCounts[s.value] || 0}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="w-44">
          <Select
            options={[{ value: '', label: 'כל הסטטוסים' }, ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))]}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <Card className="max-h-[65vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
              title="אין לידים"
            />
          ) : (
            <div className="divide-y">
              {filtered.map(lead => {
                const statusInfo = STATUS_OPTIONS.find(s => s.value === lead.status)
                const isSelected = selected?.id === lead.id
                const isOverdue = lead.next_follow_up && new Date(lead.next_follow_up) < new Date()
                return (
                  <button
                    key={lead.id}
                    onClick={() => selectLead(lead)}
                    className={cn(
                      'w-full px-4 py-3 text-right hover:bg-slate-50 transition-colors',
                      isSelected && 'bg-teal-50 border-r-4 border-teal-600',
                      isOverdue && !isSelected && 'border-r-4 border-orange-400'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{lead.first_name} {lead.last_name}</p>
                        <p className="text-xs text-slate-500">{lead.phone || lead.email || '—'}</p>
                        {lead.next_follow_up && (
                          <p className={cn('text-xs mt-0.5', isOverdue ? 'text-orange-600 font-medium' : 'text-slate-400')}>
                            {isOverdue ? '⚠ ' : ''}מעקב: {formatDate(lead.next_follow_up)}
                          </p>
                        )}
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusInfo?.color)}>
                        {statusInfo?.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* Detail / action panel */}
        <div>
          {selected ? (
            <Card>
              <CardHeader>
                <h3 className="font-bold text-lg">{selected.first_name} {selected.last_name}</h3>
                <p className="text-sm text-slate-500">{formatDateTime(selected.created_at)}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contact info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selected.phone && (
                    <div>
                      <p className="text-xs text-slate-400">טלפון</p>
                      <a href={`tel:${selected.phone}`} className="font-medium text-teal-600 hover:underline">{selected.phone}</a>
                    </div>
                  )}
                  {selected.email && (
                    <div>
                      <p className="text-xs text-slate-400">אימייל</p>
                      <a href={`mailto:${selected.email}`} className="font-medium text-teal-600 hover:underline truncate block">{selected.email}</a>
                    </div>
                  )}
                  {selected.specialty_interest && (
                    <div>
                      <p className="text-xs text-slate-400">מבקש</p>
                      <p className="font-medium">{selected.specialty_interest}</p>
                    </div>
                  )}
                </div>

                {/* Original message */}
                {selected.message && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">הודעה</p>
                    <p className="text-sm text-slate-700">{selected.message}</p>
                  </div>
                )}

                {/* AI analysis */}
                {selected.ai_analysis && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-purple-700 mb-1">
                      ניתוח AI {selected.ai_score != null && `· ציון ${selected.ai_score}/10`}
                    </p>
                    <p className="text-sm text-purple-700">{selected.ai_analysis}</p>
                  </div>
                )}

                {/* Status change */}
                <div>
                  <p className="text-xs text-slate-400 mb-2">עדכן סטטוס</p>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.filter(s => s.value !== selected.status).slice(0, 3).map(s => (
                      <button
                        key={s.value}
                        onClick={() => updateStatus(selected.id, s.value)}
                        className={cn('text-xs px-3 py-1.5 rounded-full font-medium transition-colors hover:opacity-80', s.color)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note + follow-up */}
                <div className="space-y-3">
                  <Textarea
                    label="הערה / עדכון"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="מה דובר עם הליד..."
                  />
                  <Input
                    label="מועד מעקב הבא"
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveNote} loading={savingNote}>שמור</Button>
                  {selected.phone && (
                    <a href={`https://wa.me/972${selected.phone.replace(/\D/g, '').replace(/^0/, '')}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                        WhatsApp
                      </Button>
                    </a>
                  )}
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`}>
                      <Button variant="outline">התקשר</Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={<svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 18l-6-6 6-6"/></svg>}
                title="בחר ליד לטיפול"
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
