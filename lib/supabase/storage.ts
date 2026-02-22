import type { SupabaseClient } from '@supabase/supabase-js'

// ── Allowed file types ────────────────────────────────

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

// ── Size limits ───────────────────────────────────────

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB for documents
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB for avatars/logos

// ── Validation ────────────────────────────────────────

export function validateFile(
  file: File,
  options: { maxSize: number; allowedTypes: string[] }
): { valid: boolean; error?: string } {
  if (file.size > options.maxSize) {
    const sizeMB = Math.round(options.maxSize / (1024 * 1024))
    return { valid: false, error: `גודל הקובץ מקסימלי ${sizeMB}MB` }
  }
  if (!options.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'סוג קובץ לא נתמך' }
  }
  return { valid: true }
}

// ── Upload document (medical-documents bucket) ────────

export async function uploadDocument(
  supabase: SupabaseClient,
  file: File,
  { orgId, userId }: { orgId: string; userId: string }
): Promise<{ path?: string; error?: string }> {
  const validation = validateFile(file, {
    maxSize: MAX_FILE_SIZE,
    allowedTypes: ALLOWED_DOCUMENT_TYPES,
  })
  if (!validation.valid) return { error: validation.error }

  const path = `${orgId}/${userId}/general/${Date.now()}-${file.name}`

  const { error } = await supabase.storage
    .from('medical-documents')
    .upload(path, file)

  if (error) return { error: 'שגיאה בהעלאת הקובץ. נסה שוב.' }
  return { path }
}

// ── Upload avatar (avatars bucket) ────────────────────

export async function uploadAvatar(
  supabase: SupabaseClient,
  file: File,
  { orgId, userId, oldAvatarUrl }: { orgId: string; userId: string; oldAvatarUrl?: string | null }
): Promise<{ publicUrl?: string; error?: string }> {
  const validation = validateFile(file, {
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: ALLOWED_IMAGE_TYPES,
  })
  if (!validation.valid) return { error: validation.error }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `avatars/${orgId}/${userId}.${ext}`

  // Delete old avatar if exists
  if (oldAvatarUrl) {
    const oldPath = oldAvatarUrl.split('/storage/v1/object/public/avatars/')[1]?.split('?')[0]
    if (oldPath) {
      await supabase.storage.from('avatars').remove([oldPath])
    }
  }

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (error) return { error: 'שגיאה בהעלאת התמונה' }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  return { publicUrl: `${publicUrl}?t=${Date.now()}` }
}

// ── Upload logo (avatars bucket, branding path) ───────

export async function uploadLogo(
  supabase: SupabaseClient,
  file: File,
  { orgId }: { orgId: string }
): Promise<{ publicUrl?: string; error?: string }> {
  const validation = validateFile(file, {
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: ALLOWED_LOGO_TYPES,
  })
  if (!validation.valid) return { error: validation.error }

  const ext = file.name.split('.').pop() || 'png'
  const path = `branding/${orgId}/logo.${ext}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) return { error: 'שגיאה בהעלאת הלוגו: ' + error.message }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  return { publicUrl: `${publicUrl}?t=${Date.now()}` }
}

// ── Signed URL ────────────────────────────────────────

export async function getSignedUrl(
  supabase: SupabaseClient,
  path: string,
  bucket: string,
  expirySeconds = 3600
): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expirySeconds)

  if (error || !data?.signedUrl) {
    return { error: 'שגיאה בפתיחת המסמך. נסה שוב.' }
  }
  return { url: data.signedUrl }
}

// ── Delete file ───────────────────────────────────────

export async function deleteFile(
  supabase: SupabaseClient,
  path: string,
  bucket: string
): Promise<{ error?: string }> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) return { error: 'שגיאה במחיקת הקובץ' }
  return {}
}

// ── List patient documents ────────────────────────────

export async function listPatientDocuments(
  supabase: SupabaseClient,
  patientId: string
): Promise<{ documents?: Record<string, unknown>[]; error?: string }> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) return { error: 'שגיאה בטעינת המסמכים' }
  return { documents: data || [] }
}
