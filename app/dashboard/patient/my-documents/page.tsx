'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, EmptyState, PageLoading } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { Document } from '@/types/database'

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  )
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return 'bg-purple-50 text-purple-600'
  if (fileType === 'application/pdf') return 'bg-red-50 text-red-600'
  return 'bg-blue-50 text-blue-600'
}

export default function MyDocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const supabase = getClient()

  useEffect(() => { loadDocs() }, [])

  const loadDocs = async () => {
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('documents').select('*').eq('patient_id', user.id).order('created_at', { ascending: false })
      setDocs((data || []) as unknown as Document[])
    } catch {
      setError('שגיאה בטעינת המסמכים')
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    // Client-side file size validation (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('גודל הקובץ מקסימלי 10MB')
      return
    }

    setUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return

      const path = `${profile.organization_id}/${user.id}/general/${Date.now()}-${file.name}`
      const { error: uploadErr } = await supabase.storage.from('medical-documents').upload(path, file)
      if (uploadErr) throw uploadErr

      await supabase.from('documents').insert({
        organization_id: profile.organization_id,
        patient_id: user.id,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        storage_path: path,
        document_type: 'patient_upload',
      })
      loadDocs()
    } catch {
      setError('שגיאה בהעלאת הקובץ. נסה שוב.')
    } finally {
      setUploading(false)
    }
  }

  const getDownloadUrl = async (path: string) => {
    try {
      const { data, error: signError } = await supabase.storage.from('medical-documents').createSignedUrl(path, 60)
      if (signError || !data?.signedUrl) {
        setError('שגיאה בפתיחת המסמך. נסה שוב.')
        return
      }
      window.open(data.signedUrl, '_blank')
    } catch {
      setError('שגיאה בפתיחת המסמך. נסה שוב.')
    }
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">המסמכים שלי</h2>
          <p className="text-sm text-gray-500 mt-0.5">{docs.length} מסמכים</p>
        </div>
        <div>
          <input type="file" id="doc-upload" className="hidden" accept="image/*,.pdf,.doc,.docx"
            onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]) }} />
          <Button loading={uploading} onClick={() => document.getElementById('doc-upload')?.click()}>
            <IconUpload className="w-4 h-4" />
            העלאת מסמך
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">
          <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="ghost" onClick={loadDocs}>נסה שוב</Button>
        </div>
      )}

      <Card>
        {docs.length === 0 ? (
          <EmptyState
            icon={<IconFolder className="w-10 h-10 text-gray-400" />}
            title="אין מסמכים"
            description="העלה בדיקות מעבדה, תמונות רפואיות והפניות כדי שהרופא יוכל לצפות בהם לפני הייעוץ"
            action={
              <Button variant="outline" onClick={() => document.getElementById('doc-upload')?.click()}>
                <IconUpload className="w-4 h-4" />
                העלה מסמך ראשון
              </Button>
            }
          />
        ) : (
          <div className="divide-y">
            {docs.map(doc => (
              <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getFileIcon(doc.file_type)}`}>
                    <IconFile className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(doc.created_at)} &middot; {(doc.file_size_bytes / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.is_verified && <Badge variant="success">מאומת</Badge>}
                  <Button size="sm" variant="outline" onClick={() => getDownloadUrl(doc.storage_path)}>
                    <IconEye className="w-3.5 h-3.5" />
                    צפה
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
