import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'
import {
  approveSummary, editSummary, generateSummaryDraft, listVersions, releaseSummary,
} from '@/lib/clinical-summary/service'

// Generation is a ~30–60s model call.
export const maxDuration = 90

/** Versions of an appointment's summary — RLS limits this to the treating doctor. */
export async function GET(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const appointmentId = new URL(req.url).searchParams.get('appointmentId')
  if (!appointmentId || !z.string().uuid().safeParse(appointmentId).success) {
    return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })
  }
  const { data: apt } = await supabase.from('appointments')
    .select('id, doctor_id, status').eq('id', appointmentId).maybeSingle()
  if (!apt || apt.doctor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows, error } = await listVersions(supabase, appointmentId)
  if (error) return NextResponse.json({ error: 'שגיאה בטעינת הסיכום' }, { status: 500 })
  const current = rows.find(r => r.status === 'draft' || r.status === 'approved')
    ?? rows.find(r => r.status === 'legacy_unreviewed') ?? null
  const released = rows.find(r => r.status === 'released') ?? null

  // Display names for the people in the trail (same clinic, already visible to the doctor).
  const ids = Array.from(new Set(rows.flatMap(r => [r.approved_by, r.released_by, r.edited_by, r.generated_by]).filter(Boolean))) as string[]
  const { data: people } = ids.length
    ? await createServiceRole().from('users').select('id, first_name, last_name').in('id', ids)
    : { data: [] as { id: string; first_name: string; last_name: string }[] }
  const names = Object.fromEntries((people || []).map(p => [p.id, `ד"ר ${p.first_name} ${p.last_name}`]))

  return NextResponse.json({
    current, released, names,
    history: rows.map(r => ({
      id: r.id, version: r.version, status: r.status, generated_at: r.generated_at, edited_at: r.edited_at,
      edit_count: r.edit_count, approved_at: r.approved_at, approved_by: r.approved_by,
      released_at: r.released_at, superseded_at: r.superseded_at,
    })),
  })
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate'), appointmentId: z.string().uuid() }),
  z.object({ action: z.literal('save'), summaryId: z.string().uuid(), content: z.unknown(), expectedUpdatedAt: z.string().optional() }),
  z.object({
    action: z.literal('approve'), summaryId: z.string().uuid(), expectedUpdatedAt: z.string().optional(),
    reviewed: z.boolean(), acknowledgeWarnings: z.boolean().default(false),
  }),
  z.object({ action: z.literal('release'), summaryId: z.string().uuid(), expectedUpdatedAt: z.string().optional() }),
])

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
    const body = parsed.data
    const admin = createServiceRole()

    let result
    switch (body.action) {
      case 'generate': {
        const limit = rateLimit(`clinical-summary:${user.id}`, { maxRequests: 20, windowMs: 60 * 60 * 1000 })
        if (!limit.allowed) return NextResponse.json({ error: 'חריגה ממגבלת בקשות AI. נסה שוב מאוחר יותר.' }, { status: 429 })
        result = await generateSummaryDraft(admin, { appointmentId: body.appointmentId, userId: user.id, trigger: 'doctor' })
        break
      }
      case 'save':
        result = await editSummary(admin, { summaryId: body.summaryId, userId: user.id, content: body.content, expectedUpdatedAt: body.expectedUpdatedAt })
        break
      case 'approve':
        result = await approveSummary(admin, {
          summaryId: body.summaryId, userId: user.id, expectedUpdatedAt: body.expectedUpdatedAt,
          reviewed: body.reviewed, acknowledgeWarnings: body.acknowledgeWarnings,
        })
        break
      case 'release':
        result = await releaseSummary(admin, { summaryId: body.summaryId, userId: user.id, expectedUpdatedAt: body.expectedUpdatedAt })
        break
    }
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, summary: result.data })
  } catch (err) {
    console.error('[consultation-summary]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
