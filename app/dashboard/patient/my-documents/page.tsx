'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardHeader, Badge, PageLoading, EmptyState } from '@/components/ui'
import { formatDate, cn } from '@/lib/utils'
import { validateFile, uploadDocument, getSignedUrl, deleteFile, ALLOWED_DOCUMENT_TYPES, MAX_FILE_SIZE } from '@/lib/supabase/storage'
import type { Document } from '@/types/database'

// ── Category config ────────────────────────────────────────────────

type CategoryKey = 'all' | 'lab' | 'image' | 'referral' | 'other'

const CATEGORIES: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'all',      label: 'הכל',         icon: '📁' },
  { key: 'lab',      label: 'בדיקות מעבדה', icon: '🧪' },
  { key: 'image',    label: 'דימות/צילום',  icon: '🔬' },
  { key: 'referral', label: 'הפניות',       icon: '📋' },
  { key: 'other',    label: 'אחר',          icon: '📄' },
]

function getCategoryKey(doc: Document): CategoryKey {
  const cat = (doc.category || '').toLowerCase()
  const name = (doc.file_name || '').toLowerCase()
  const type = (doc.document_type || '').toLowerCase()
  if (cat.includes('lab') || name.includes('lab') || type.includes('lab')) return 'lab'
  if (cat.includes('image') || cat.includes('xray') || cat.includes('ct') || cat.includes('mri') || doc.file_type?.startsWith('image/')) return 'image'
  if (cat.includes('referral') || type.includes('referral') || name.includes('referral')) return 'referral'
  return 'other'
}

// ── File type helpers ──────────────────────────────────────────────

function fileIconColor(fileType: string) {
  if (fileType?.startsWith('image/')) return { bg: 'bg-purple-50', text: 'text-purple-600' }
  if (fileType === 'application/pdf') return { bg: 'bg-red-50', text: 'text-red-600' }
  return { bg: 'bg-teal-50', text: 'text-teal-600' }
}

function fileExt(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase() || 'DOC'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Component ──────────────────────────────────────────────────────

export default function MyDocumentsPage() {
  const supabase = getClient()

  const [docs, setDocs]             = useState<Document[]>([])
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingId, setViewingId]   = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [filter, setFilter]         = useState<CategoryKey>('all')
  const [search, setSearch]         = useState('')
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => { loadDocs() }, [])

  const loadDocs = async () => {
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('documents').select('*').eq('patient_id', user.id).order('created_at', { ascending: false })
      setDocs((data || []) as unknown as Document[])
    } catch {
      setError('שגיאה בטעינת המסמכים. נסה לרענן את הדף.')
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    const validation = validateFile(file, { maxSize: MAX_FILE_SIZE, allowedTypes: ALLOWED_DOCUMENT_TYPES })
    if (!validation.valid) { setError(validation.error!); return }

    setUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return

      const { path, error: uploadErr } = await uploadDocument(supabase, file, {
        orgId: profile.organization_id,
        userId: user.id,
      })
      if (uploadErr || !path) { setError(uploadErr || 'שגיאה בהעלאת הקובץ'); return }

      const { error: insertErr } = await supabase.from('documents').insert({
        organization_id: profile.organization_id,
        patient_id: user.id, uploaded_by: user.id,
        file_name: file.name, file_type: file.type,
        file_size_bytes: file.size, storage_path: path,
        document_type: 'patient_upload',
      })
      if (insertErr) { setError('הקובץ הועלה אך לא נשמר. נסה שוב.'); return }

      // Notify doctor (best-effort, non-blocking)
      fetch('/api/documents/notify-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      }).catch(() => {})

      loadDocs()
    } catch {
      setError('שגיאה בהעלאת הקובץ. נסה שוב.')
    } finally {
      setUploading(false)
    }
  }

  const handleView = async (doc: Document) => {
    setViewingId(doc.id)
    setError('')
    const { url, error: signError } = await getSignedUrl(supabase, doc.storage_path, 'medical-documents')
    if (signError || !url) { setError(signError || 'שגיאה בפתיחת המסמך'); setViewingId(null); return }
    window.open(url, '_blank')
    setViewingId(null)
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`למחוק את "${doc.file_name}"?`)) return
    setDeletingId(doc.id)
    setError('')
    const { error: storageErr } = await deleteFile(supabase, doc.storage_path, 'medical-documents')
    if (storageErr) { setError(storageErr); setDeletingId(null); return }
    const { error: dbErr } = await supabase.from('documents').delete().eq('id', doc.id)
    if (dbErr) { setError('שגיאה במחיקת המסמך') }
    else { setDocs(prev => prev.filter(d => d.id !== doc.id)) }
    setDeletingId(null)
  }

  const handleDropFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => uploadFile(file))
  }

  // Filter + search
  const filtered = docs.filter(d => {
    const matchCat = filter === 'all' || getCategoryKey(d) === filter
    const matchSearch = !search.trim() || d.file_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const countFor = (k: CategoryKey) => {
    if (k === 'all') return docs.length
    return docs.filter(d => getCategoryKey(d) === k).length
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">המסמכים שלי</h1>
          <p className="text-sm text-slate-500 mt-0.5">{docs.length} מסמכים שמורים בצורה מאובטחת</p>
        </div>
        <div className="flex gap-2">
          <input type="file" id="doc-upload" className="hidden" accept="image/*,.pdf,.doc,.docx"
            multiple
            onChange={e => { if (e.target.files) { Array.from(e.target.files).forEach(f => uploadFile(f)) } }} />
          <Button
            loading={uploading}
            onClick={() => document.getElementById('doc-upload')?.click()}
            className="gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            העלאת מסמך
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">
          <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600" aria-label="סגור">✕</button>
        </div>
      )}

      {/* ── Drag-drop zone (when no docs or as persistent target) ── */}
      {docs.length === 0 ? (
        <div
          className={cn(
            'rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer',
            isDragging ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/40'
          )}
          onClick={() => document.getElementById('doc-upload')?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleDropFiles(e.dataTransfer.files) }}
        >
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3 className="font-bold text-slate-700 text-lg">גרור מסמכים לכאן</h3>
          <p className="text-sm text-slate-400 mt-1">או לחץ לבחירת קבצים</p>
          <p className="text-xs text-slate-400 mt-3">PDF, תמונות, Word · עד 10MB לקובץ</p>
          <p className="text-xs text-teal-500 mt-2 font-medium">🔒 כל המסמכים מוצפנים ומאובטחים</p>
        </div>
      ) : (
        <>
          {/* ── Search ── */}
          <div className="relative">
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="search"
              placeholder="חיפוש לפי שם קובץ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:outline-none"
            />
          </div>

          {/* ── Category filters ── */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => {
              const count = countFor(cat.key)
              const active = filter === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setFilter(cat.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                    active
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300 hover:text-teal-600'
                  )}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                  <span className={cn('text-xs tabular-nums px-1.5 py-0.5 rounded-full font-semibold', active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Docs list ── */}
          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<div className="text-4xl mb-2">🔍</div>}
                title="לא נמצאו מסמכים"
                description={search ? `לא נמצאו מסמכים עבור "${search}"` : 'אין מסמכים בקטגוריה זו'}
                action={search
                  ? <Button variant="outline" onClick={() => setSearch('')}>נקה חיפוש</Button>
                  : <Button variant="outline" onClick={() => setFilter('all')}>הצג הכל</Button>
                }
              />
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    {filtered.length} מסמכים
                    {filter !== 'all' && <span className="text-slate-400 font-normal"> · {CATEGORIES.find(c => c.key === filter)?.label}</span>}
                  </h3>
                  {/* Subtle drop target */}
                  <div
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer',
                      isDragging ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-dashed border-slate-300 text-slate-400 hover:border-teal-300'
                    )}
                    onClick={() => document.getElementById('doc-upload')?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); handleDropFiles(e.dataTransfer.files) }}
                  >
                    + גרור קובץ חדש
                  </div>
                </div>
              </CardHeader>
              <div className="divide-y">
                {filtered.map(doc => {
                  const { bg, text } = fileIconColor(doc.file_type)
                  return (
                    <div key={doc.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                      {/* File icon */}
                      <div className={cn('w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0', bg)}>
                        <svg className={cn('w-5 h-5', text)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className={cn('text-[9px] font-bold mt-0.5', text)}>{fileExt(doc.file_name)}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{doc.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-400">{formatDate(doc.created_at)}</span>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400">{formatSize(doc.file_size_bytes)}</span>
                          {doc.category && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-xs text-teal-600 font-medium">{doc.category}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {doc.is_verified && <Badge variant="success">מאומת</Badge>}
                        <Button
                          size="sm"
                          variant="outline"
                          loading={viewingId === doc.id}
                          onClick={() => handleView(doc)}
                          className="gap-1"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                          צפה
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={deletingId === doc.id}
                          onClick={() => handleDelete(doc)}
                          aria-label={`מחק ${doc.file_name}`}
                        >
                          <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pt-2">
        <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        כל המסמכים מאוחסנים בצורה מוצפנת ומאובטחת — גישה רק לך ולצוות הרפואי
      </div>
    </div>
  )
}
