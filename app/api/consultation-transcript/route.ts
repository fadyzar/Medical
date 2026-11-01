import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, clinicEnabled, transcriptionConfigured } from '@/lib/transcription/config'

/**
 * Transcription consent for one consultation. The doctor and the patient each
 * consent (or withdraw) for themselves; capture starts only with both.
 */

async function load(appointmentId: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const admin = createServiceRole()
  const { data: apt } = await admin.from('appointments')
    .select('id, organization_id, doctor_id, patient_id, status, org:organization_id(settings)')
    .eq('id', appointmentId).maybeSingle()
  const a = apt as unknown as { id: string; organization_id: string; doctor_id: string | null; patient_id: string; status: string; org: { settings: unknown } | null } | null
  if (!a) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const side = a.doctor_id === user.id ? 'doctor' : a.patient_id === user.id ? 'patient' : null
  if (!side) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { data: row } = await admin.from('consultation_transcripts')
    .select('id, status, doctor_consent_at, patient_consent_at, withdrawn_at, segments')
    .eq('appointment_id', a.id).maybeSingle()
  return { user, admin, apt: a, side: side as 'doctor' | 'patient', row }
}

function view(apt: { org: { settings: unknown } | null }, side: 'doctor' | 'patient', row: {
  status: string; doctor_consent_at: string | null; patient_consent_at: string | null; segments?: unknown
} | null) {
  const available = transcriptionConfigured() && clinicEnabled(apt.org?.settings)
  const mine = side === 'doctor' ? row?.doctor_consent_at : row?.patient_consent_at
  const theirs = side === 'doctor' ? row?.patient_consent_at : row?.doctor_consent_at
  return {
    available,
    status: row?.status ?? 'none',
    myConsent: !!mine && row?.status !== 'withdrawn',
    otherConsent: !!theirs && row?.status !== 'withdrawn',
    consentText: CONSENT_TEXT,
    consentVersion: CONSENT_TEXT_VERSION,
    segments: side === 'doctor' && row?.status === 'completed' && Array.isArray(row.segments) ? row.segments.length : undefined,
  }
}

/** The transcript text itself: the treating doctor only (same rule as RLS ct_treating_doctor_select). */
function transcriptFor(side: 'doctor' | 'patient', row: { status: string; segments?: unknown } | null) {
  if (side !== 'doctor' || row?.status !== 'completed' || !Array.isArray(row.segments)) return undefined
  return row.segments as { speaker: string; start: number; text: string }[]
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('appointmentId')
  if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })
  const r = await load(id)
  if ('error' in r) return r.error
  const full = new URL(req.url).searchParams.get('full') === '1'
  return NextResponse.json({ ...view(r.apt, r.side, r.row), ...(full ? { transcript: transcriptFor(r.side, r.row) } : {}) })
}

const body = z.object({ appointmentId: z.string().uuid(), action: z.enum(['consent', 'withdraw']), consentVersion: z.string().optional() })

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
  const { appointmentId, action, consentVersion } = parsed.data
  const r = await load(appointmentId)
  if ('error' in r) return r.error
  const { admin, apt, side, user } = r
  let row = r.row
  const now = new Date().toISOString()
  const field = side === 'doctor' ? 'doctor_consent_at' : 'patient_consent_at'

  if (action === 'consent') {
    if (!transcriptionConfigured() || !clinicEnabled(apt.org?.settings)) {
      return NextResponse.json({ error: 'תמלול אינו זמין במרפאה זו' }, { status: 409 })
    }
    if (consentVersion !== CONSENT_TEXT_VERSION) return NextResponse.json({ error: 'נוסח ההסכמה התעדכן. רענן את הדף.' }, { status: 409 })
    if (['completed', 'cancelled_patient', 'cancelled_doctor', 'no_show_patient', 'no_show_doctor'].includes(apt.status)) {
      return NextResponse.json({ error: 'הייעוץ אינו פעיל' }, { status: 409 })
    }
    if (!row) {
      const { data } = await admin.from('consultation_transcripts').insert({
        organization_id: apt.organization_id, appointment_id: apt.id, consent_text_version: CONSENT_TEXT_VERSION, [field]: now,
      }).select('id, status, doctor_consent_at, patient_consent_at, withdrawn_at, segments').single()
      row = data
    } else if (row.status === 'withdrawn') {
      // A new consent after a withdrawal starts over: both sides consent again.
      const { data } = await admin.from('consultation_transcripts').update({
        status: 'consent_pending', doctor_consent_at: null, patient_consent_at: null, withdrawn_at: null, withdrawn_by: null,
        consent_text_version: CONSENT_TEXT_VERSION, [field]: now,
      }).eq('id', row.id).select('id, status, doctor_consent_at, patient_consent_at, withdrawn_at, segments').single()
      row = data
    } else if (row.status === 'consent_pending') {
      const { data } = await admin.from('consultation_transcripts').update({ [field]: now })
        .eq('id', row.id).select('id, status, doctor_consent_at, patient_consent_at, withdrawn_at, segments').single()
      row = data
    }
  } else {
    if (row && row.status !== 'withdrawn') {
      // Withdrawal stops capture (the worker polls the status) and discards any text.
      const { data } = await admin.from('consultation_transcripts').update({
        status: 'withdrawn', withdrawn_at: now, withdrawn_by: user.id, segments: null,
      }).eq('id', row.id).select('id, status, doctor_consent_at, patient_consent_at, withdrawn_at, segments').single()
      row = data
    }
  }

  try {
    await admin.from('audit_logs').insert({
      organization_id: apt.organization_id, user_id: user.id,
      action: action === 'consent' ? 'TRANSCRIPTION_CONSENT_GIVEN' : 'TRANSCRIPTION_CONSENT_WITHDRAWN',
      resource_type: 'appointment', resource_id: apt.id,
      description: action === 'consent'
        ? (side === 'doctor' ? 'הרופא הסכים לתמלול השיחה' : 'המטופל הסכים לתמלול השיחה')
        : (side === 'doctor' ? 'הרופא הפסיק את התמלול' : 'המטופל הפסיק את התמלול'),
      metadata: { side, consent_version: CONSENT_TEXT_VERSION },
    })
  } catch { /* best-effort */ }

  return NextResponse.json(view(apt, side, row))
}
