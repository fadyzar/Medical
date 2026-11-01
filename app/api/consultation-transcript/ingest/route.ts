import { NextResponse, after } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createServiceRole } from '@/lib/supabase/server'
import { TRANSCRIPT_RETENTION_DAYS, transcriptionConfigured } from '@/lib/transcription/config'
import { generateSummaryDraft } from '@/lib/clinical-summary/service'

export const maxDuration = 120

/**
 * Called by the transcription worker (server-to-server, shared secret):
 *   started   — the worker joined the room and is capturing audio
 *   processing — the call ended; audio is being transcribed
 *   completed — segments are ready; the audio has been deleted
 *   failed    — capture or transcription failed
 *   check     — may the worker (still) capture? (consent may have been withdrawn)
 * Capture is allowed only while both consents stand.
 */

function authorized(req: Request): boolean {
  const secret = process.env.TRANSCRIPTION_INGEST_SECRET || ''
  const given = req.headers.get('x-transcription-secret') || ''
  if (!secret || given.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret))
}

const segment = z.object({
  speaker: z.enum(['doctor', 'patient']),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().trim().max(4000),
})

const body = z.object({
  appointmentId: z.string().uuid(),
  event: z.enum(['check', 'started', 'processing', 'completed', 'failed']),
  provider: z.string().max(80).optional(),
  model: z.string().max(200).optional(),
  language: z.string().max(10).optional(),
  durationSeconds: z.number().int().min(0).max(6 * 3600).optional(),
  audioDeleted: z.boolean().optional(),
  segments: z.array(segment).max(5000).optional(),
  error: z.string().max(300).optional(),
})

export async function POST(req: Request) {
  if (!transcriptionConfigured() || !authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const b = parsed.data
  const admin = createServiceRole()

  const { data: rowData } = await admin.from('consultation_transcripts')
    .select('id, organization_id, status, doctor_consent_at, patient_consent_at')
    .eq('appointment_id', b.appointmentId).maybeSingle()
  const row = rowData as { id: string; organization_id: string; status: string; doctor_consent_at: string | null; patient_consent_at: string | null } | null
  const consented = !!row && !!row.doctor_consent_at && !!row.patient_consent_at && row.status !== 'withdrawn'
  if (!consented) return NextResponse.json({ allowed: false, status: row?.status ?? 'none' }, { status: b.event === 'check' ? 200 : 409 })

  const now = new Date().toISOString()
  switch (b.event) {
    case 'check':
      return NextResponse.json({ allowed: true, status: row.status })
    case 'started':
      if (row.status !== 'consent_pending' && row.status !== 'recording') return NextResponse.json({ allowed: false, status: row.status }, { status: 409 })
      await admin.from('consultation_transcripts').update({ status: 'recording', provider: b.provider ?? null, language: b.language ?? null })
        .eq('id', row.id).neq('status', 'withdrawn')
      return NextResponse.json({ allowed: true })
    case 'processing':
      await admin.from('consultation_transcripts').update({ status: 'processing' }).eq('id', row.id).eq('status', 'recording')
      return NextResponse.json({ allowed: true })
    case 'failed':
      await admin.from('consultation_transcripts').update({ status: 'failed', error: b.error ?? 'failed', segments: null, audio_deleted_at: b.audioDeleted ? now : null })
        .eq('id', row.id).neq('status', 'withdrawn')
      return NextResponse.json({ ok: true })
    case 'completed': {
      if (!b.audioDeleted) return NextResponse.json({ error: 'Audio must be deleted before the transcript is stored' }, { status: 422 })
      const segments = (b.segments || []).filter(s => s.text).sort((x, y) => x.start - y.start)
      const { data: saved } = await admin.from('consultation_transcripts').update({
        status: 'completed', segments, provider: b.provider ?? null, model: b.model ?? null, language: b.language ?? null,
        duration_seconds: b.durationSeconds ?? null, audio_deleted_at: now, error: null,
        retention_until: new Date(Date.now() + TRANSCRIPT_RETENTION_DAYS * 864e5).toISOString(),
      }).eq('id', row.id).in('status', ['recording', 'processing']).select('id')
      if (!saved?.length) return NextResponse.json({ error: 'Transcript not accepted in its current state' }, { status: 409 })

      try {
        await admin.from('audit_logs').insert({
          organization_id: row.organization_id, user_id: null, action: 'TRANSCRIPT_COMPLETED',
          resource_type: 'appointment', resource_id: b.appointmentId,
          description: 'תמלול השיחה הושלם; ההקלטה הקולית נמחקה',
          metadata: { segments: segments.length, provider: b.provider, model: b.model, duration_seconds: b.durationSeconds },
        })
      } catch { /* best-effort */ }

      // The consultation already ended: draft the summary now, with the transcript.
      const { data: apt } = await admin.from('appointments').select('status, doctor_id').eq('id', b.appointmentId).single()
      if (apt?.status === 'completed' && apt.doctor_id) {
        const doctorId = apt.doctor_id as string
        after(async () => {
          const r = await generateSummaryDraft(admin, { appointmentId: b.appointmentId, userId: doctorId, trigger: 'transcript' })
          if (!r.ok) console.error('[transcript/ingest] summary draft failed', b.appointmentId)
        })
      }
      return NextResponse.json({ ok: true, segments: segments.length })
    }
  }
}
