'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, Badge, EmptyState, PageLoading } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { Document } from '@/types/database'

export default function MyDocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const supabase = getClient()

  useEffect(() => { loadDocs() }, [])

  const loadDocs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('documents').select('*').eq('patient_id', user.id).order('created_at', { ascending: false })
    setDocs((data || []) as unknown as Document[])
    setLoading(false)
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
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
      alert('שגיאה בהעלאה')
    } finally {
      setUploading(false)
    }
  }

  const getDownloadUrl = async (path: string) => {
    const { data } = await supabase.storage.from('medical-documents').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">המסמכים שלי</h2>
        <div>
          <input type="file" id="doc-upload" className="hidden" accept="image/*,.pdf,.doc,.docx"
            onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]) }} />
          <Button loading={uploading} onClick={() => document.getElementById('doc-upload')?.click()}>📁 העלאת מסמך</Button>
        </div>
      </div>

      <Card>
        {docs.length === 0 ? (
          <EmptyState icon="📄" title="אין מסמכים" description="העלה בדיקות מעבדה, תמונות והפניות" />
        ) : (
          <div className="divide-y">
            {docs.map(doc => (
              <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-400">{formatDate(doc.created_at)} · {(doc.file_size_bytes / 1024).toFixed(0)} KB</p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.is_verified && <Badge variant="success">מאומת</Badge>}
                  <Button size="sm" variant="outline" onClick={() => getDownloadUrl(doc.storage_path)}>צפה</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
