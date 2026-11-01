/**
 * Consultation summary service: generate an AI draft, let the treating doctor
 * edit, approve and release it. Server-only (service role). Every transition
 * is checked by lifecycle.decide() and written to audit_logs (field names and
 * versions only — no clinical text in the audit trail).
 *
 * The patient sees nothing until release: drafts live in
 * consultation_summaries (treating doctor only); release copies the approved
 * patient-facing text to appointments.ai_summary and notifies the patient.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { CLINICAL_MODEL, responseText } from '@/lib/ai/models'
import { notify } from '@/lib/notifications'
import { buildClinicalContext } from './context'
import { SUMMARY_OUTPUT_SCHEMA, SUMMARY_SYSTEM_PROMPT, renderContext } from './prompt'
import { groundSummary, type RawSummary } from './grounding'
import { decide, patientView, type Actor } from './lifecycle'
import type { SummaryContent, SummaryStatus, SummaryWarning } from './types'

export interface SummaryRow {
  id: string
  organization_id: string
  appointment_id: string
  version: number
  status: SummaryStatus
  ai_output: unknown
  content: SummaryContent
  sources: Record<string, unknown>
  warnings: SummaryWarning[]
  model_used: string | null
  generated_by: string | null
  generated_at: string
  edited_by: string | null
  edited_at: string | null
  edit_count: number
  approved_by: string | null
  approved_at: string | null
  released_by: string | null
  released_at: string | null
  superseded_at: string | null
  updated_at: string
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

let _client: Anthropic | null = null
function ai() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 90_000, maxRetries: 1 })
  return _client
}

async function audit(admin: SupabaseClient, row: { organization_id: string; appointment_id: string }, userId: string | null,
  action: string, description: string, metadata: Record<string, unknown>) {
  try {
    await admin.from('audit_logs').insert({
      organization_id: row.organization_id, user_id: userId, action,
      resource_type: 'consultation_summary', resource_id: row.appointment_id, description, metadata,
    })
  } catch { /* audit is best-effort; the version row itself keeps the timestamps */ }
}

async function actorFor(admin: SupabaseClient, userId: string): Promise<Actor | null> {
  const { data } = await admin.from('users').select('id, role').eq('id', userId).single()
  return data ? { id: data.id as string, role: data.role as string } : null
}

async function appointmentDoctor(admin: SupabaseClient, appointmentId: string) {
  const { data } = await admin.from('appointments')
    .select('id, organization_id, doctor_id, status').eq('id', appointmentId).single()
  return data as { id: string; organization_id: string; doctor_id: string | null; status: string } | null
}

// ── Generate ────────────────────────────────────────────────────────────────

/**
 * Creates a new draft version from the current clinical context. An open
 * draft/approved version is superseded; a released version stays visible to
 * the patient until the new one is released.
 *
 * trigger 'auto' (end of call) is skipped when any version already exists;
 * 'transcript' (a consented transcript just arrived) is skipped once the doctor
 * approved or released a version — their reviewed text is not replaced.
 */
export async function generateSummaryDraft(admin: SupabaseClient, params: {
  appointmentId: string
  /** The doctor who requested it, or the treating doctor for automatic drafts. */
  userId: string
  trigger: 'auto' | 'doctor' | 'transcript'
}): Promise<ServiceResult<SummaryRow | null>> {
  const apt = await appointmentDoctor(admin, params.appointmentId)
  if (!apt) return { ok: false, status: 404, error: 'התור לא נמצא' }
  if (params.trigger === 'doctor') {
    const actor = await actorFor(admin, params.userId)
    if (!actor || actor.role !== 'doctor' || actor.id !== apt.doctor_id) {
      return { ok: false, status: 403, error: 'רק הרופא המטפל יכול ליצור טיוטת סיכום' }
    }
  }

  const { data: existing } = await admin.from('consultation_summaries')
    .select('id, version, status').eq('appointment_id', apt.id).order('version', { ascending: false })
  const versions = (existing || []) as { id: string; version: number; status: SummaryStatus }[]
  if (params.trigger === 'auto' && versions.length) return { ok: true, data: null }
  if (params.trigger === 'transcript' && versions.some(v => v.status === 'approved' || v.status === 'released')) return { ok: true, data: null }

  const built = await buildClinicalContext(admin, apt.id)
  if (!built) return { ok: false, status: 404, error: 'התור לא נמצא' }

  let raw: RawSummary
  let usage = { input: 0, output: 0 }
  try {
    const res = await ai().messages.create({
      model: CLINICAL_MODEL,
      max_tokens: 12000,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SUMMARY_OUTPUT_SCHEMA as unknown as Record<string, unknown> },
      },
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: renderContext(built.context) }],
    })
    if (res.stop_reason === 'refusal') return { ok: false, status: 502, error: 'שירות ה-AI סירב לבקשה' }
    if (res.stop_reason === 'max_tokens') return { ok: false, status: 502, error: 'תשובת ה-AI נקטעה. נסה שוב.' }
    raw = JSON.parse(responseText(res)) as RawSummary
    usage = { input: res.usage.input_tokens, output: res.usage.output_tokens }
  } catch (err) {
    // No PHI in logs: the message only.
    console.error('[clinical-summary] generation failed:', err instanceof Error ? err.message : 'error')
    return { ok: false, status: 502, error: 'יצירת טיוטת הסיכום נכשלה. נסה שוב.' }
  }

  const { content, warnings } = groundSummary(raw, built.context)

  // Close the open version first: the unique index allows one draft/approved at a time.
  const open = versions.filter(v => v.status === 'draft' || v.status === 'approved' || v.status === 'legacy_unreviewed')
  if (open.length) {
    await admin.from('consultation_summaries')
      .update({ status: 'superseded', superseded_at: new Date().toISOString() })
      .in('id', open.map(v => v.id))
  }

  const version = (versions[0]?.version ?? 0) + 1
  const { data: inserted, error } = await admin.from('consultation_summaries').insert({
    organization_id: apt.organization_id,
    appointment_id: apt.id,
    version,
    status: 'draft',
    ai_output: raw,
    content,
    sources: built.sources,
    warnings,
    model_used: CLINICAL_MODEL,
    input_tokens: usage.input,
    output_tokens: usage.output,
    generated_by: params.trigger === 'doctor' ? params.userId : null,
  }).select('*').single()
  if (error || !inserted) {
    console.error('[clinical-summary] insert failed:', error?.message)
    return { ok: false, status: 409, error: 'הטיוטה לא נשמרה (ייתכן שנוצרה טיוטה במקביל). רענן ונסה שוב.' }
  }

  await admin.from('appointments').update({ ai_summary_generated_at: new Date().toISOString(), ai_used: true }).eq('id', apt.id)
  await admin.from('ai_conversations').insert({
    organization_id: apt.organization_id, user_id: params.userId, appointment_id: apt.id,
    agent_type: 'summary',
    // Which sources were used, not their content.
    messages: [{ role: 'user', content: `clinical context: ${Object.keys(built.sources).filter(k => (built.sources[k] as { included?: boolean })?.included).join(', ')}` }],
    result: { summary_version: version, warnings: warnings.length }, is_complete: true,
    input_tokens: usage.input, output_tokens: usage.output, model_used: CLINICAL_MODEL,
  })
  await audit(admin, { organization_id: apt.organization_id, appointment_id: apt.id }, params.trigger === 'doctor' ? params.userId : null,
    'SUMMARY_DRAFT_GENERATED',
    params.trigger === 'auto' ? 'טיוטת סיכום AI נוצרה בסיום השיחה'
      : params.trigger === 'transcript' ? 'טיוטת סיכום AI נוצרה לאחר קבלת תמלול השיחה' : 'הרופא יצר טיוטת סיכום AI',
    { version, trigger: params.trigger, superseded_versions: open.map(v => v.version), warnings: warnings.length, sources: built.sources })

  return { ok: true, data: inserted as SummaryRow }
}

// ── Edit / approve / release ────────────────────────────────────────────────

const itemSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  source: z.enum(['booking', 'history', 'intake', 'clinician_notes', 'transcript_doctor', 'transcript_patient', 'clinician_edit']),
  evidence: z.string().max(2000).optional(),
  verified: z.boolean().optional(),
})
export const contentSchema = z.object({
  sections: z.object({
    subjective: z.array(itemSchema).max(40),
    objective: z.array(itemSchema).max(40),
    assessment: z.array(itemSchema).max(40),
    plan: z.array(itemSchema).max(40),
  }),
  missing_information: z.array(z.string().trim().max(500)).max(30),
  ai_suggestions: z.array(z.object({ text: z.string().max(1000), rationale: z.string().max(1000) })).max(5),
  patient_summary: z.string().trim().max(4000),
  patient_instructions: z.array(z.string().trim().max(1000)).max(20),
  edited_sections: z.array(z.string()).optional(),
})

async function loadRow(admin: SupabaseClient, summaryId: string) {
  const { data } = await admin.from('consultation_summaries').select('*').eq('id', summaryId).single()
  if (!data) return null
  const row = data as SummaryRow
  const apt = await appointmentDoctor(admin, row.appointment_id)
  return apt ? { row, apt } : null
}

function stale(row: SummaryRow, expectedUpdatedAt?: string) {
  return !!expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== new Date(row.updated_at).getTime()
}

const STALE = { ok: false as const, status: 409, error: 'הסיכום השתנה מאז שנפתח (בחלון אחר?). רענן ונסה שוב.' }

/** Which sections the doctor changed, by comparing texts. */
function changedSections(before: SummaryContent, after: SummaryContent): string[] {
  const out: string[] = []
  for (const k of ['subjective', 'objective', 'assessment', 'plan'] as const) {
    const a = before.sections[k].map(i => i.text).join('\n'), b = after.sections[k].map(i => i.text).join('\n')
    if (a !== b) out.push(k)
  }
  if (before.patient_summary !== after.patient_summary) out.push('patient_summary')
  if (before.patient_instructions.join('\n') !== after.patient_instructions.join('\n')) out.push('patient_instructions')
  if (before.missing_information.join('\n') !== after.missing_information.join('\n')) out.push('missing_information')
  return out
}

export async function editSummary(admin: SupabaseClient, p: {
  summaryId: string; userId: string; content: unknown; expectedUpdatedAt?: string
}): Promise<ServiceResult<SummaryRow>> {
  const parsed = contentSchema.safeParse(p.content)
  if (!parsed.success) return { ok: false, status: 400, error: 'תוכן הסיכום אינו תקין' }
  const loaded = await loadRow(admin, p.summaryId)
  if (!loaded) return { ok: false, status: 404, error: 'הסיכום לא נמצא' }
  const { row, apt } = loaded
  const actor = await actorFor(admin, p.userId)
  if (!actor) return { ok: false, status: 403, error: 'אין הרשאה' }
  const d = decide('edit', { status: row.status, appointment_doctor_id: apt.doctor_id }, actor)
  if (!d.ok) return { ok: false, status: d.code, error: d.error }
  if (stale(row, p.expectedUpdatedAt)) return STALE

  const content = parsed.data as SummaryContent
  const changed = changedSections(row.content, content)
  content.edited_sections = Array.from(new Set([...(row.content.edited_sections || []), ...changed]))
  const now = new Date().toISOString()

  if (d.newVersion) {
    // Released text is immutable: the edit starts a new draft version.
    const { data: maxV } = await admin.from('consultation_summaries').select('version')
      .eq('appointment_id', row.appointment_id).order('version', { ascending: false }).limit(1).single()
    await admin.from('consultation_summaries').update({ status: 'superseded', superseded_at: now })
      .eq('appointment_id', row.appointment_id).in('status', ['draft', 'approved'])
    const version = ((maxV as { version: number } | null)?.version ?? row.version) + 1
    const { data: inserted, error } = await admin.from('consultation_summaries').insert({
      organization_id: row.organization_id, appointment_id: row.appointment_id, version, status: 'draft',
      ai_output: row.ai_output, content, sources: { ...row.sources, revised_from_version: row.version },
      warnings: row.warnings, model_used: row.model_used, generated_by: row.generated_by,
      edited_by: actor.id, edited_at: now, edit_count: 1,
    }).select('*').single()
    if (error || !inserted) return { ok: false, status: 409, error: 'שמירת הגרסה החדשה נכשלה' }
    await audit(admin, row, actor.id, 'SUMMARY_REVISION_STARTED', 'הרופא פתח גרסה חדשה של סיכום ששוחרר',
      { from_version: row.version, version, changed_sections: changed })
    return { ok: true, data: inserted as SummaryRow }
  }

  const { data: updated, error } = await admin.from('consultation_summaries').update({
    content, status: 'draft', edited_by: actor.id, edited_at: now, edit_count: row.edit_count + 1,
    ...(d.revokesApproval ? { approved_by: null, approved_at: null } : {}),
  }).eq('id', row.id).eq('updated_at', row.updated_at).select('*').single()
  if (error || !updated) return STALE
  await audit(admin, row, actor.id, 'SUMMARY_EDITED',
    d.revokesApproval ? 'הרופא ערך סיכום מאושר — נדרש אישור מחדש' : 'הרופא ערך את טיוטת הסיכום',
    { version: row.version, changed_sections: changed, approval_revoked: !!d.revokesApproval })
  return { ok: true, data: updated as SummaryRow }
}

export async function approveSummary(admin: SupabaseClient, p: {
  summaryId: string; userId: string; expectedUpdatedAt?: string; reviewed: boolean; acknowledgeWarnings: boolean
}): Promise<ServiceResult<SummaryRow>> {
  const loaded = await loadRow(admin, p.summaryId)
  if (!loaded) return { ok: false, status: 404, error: 'הסיכום לא נמצא' }
  const { row, apt } = loaded
  const actor = await actorFor(admin, p.userId)
  if (!actor) return { ok: false, status: 403, error: 'אין הרשאה' }
  const d = decide('approve', { status: row.status, appointment_doctor_id: apt.doctor_id }, actor)
  if (!d.ok) return { ok: false, status: d.code, error: d.error }
  if (stale(row, p.expectedUpdatedAt)) return STALE
  if (!p.reviewed) return { ok: false, status: 422, error: 'יש לאשר שבדקת את הסיכום מול המקורות' }
  const openWarnings = (row.warnings || []).length
  if (openWarnings && !p.acknowledgeWarnings) {
    return { ok: false, status: 422, error: `יש ${openWarnings} פריטים שלא אומתו מול המקור. בדוק אותם ואשר שראית אותם.` }
  }
  if (!row.content.patient_summary?.trim()) {
    return { ok: false, status: 422, error: 'חסר הסיכום למטופל. כתוב אותו לפני האישור.' }
  }
  // Words the transcript garbled are marked, never guessed; the doctor resolves them first.
  const unclear = [row.content.patient_summary, ...row.content.patient_instructions,
    ...Object.values(row.content.sections).flat().map(i => i.text)].some(t => t.includes('[לא ברור'))
  if (unclear) {
    return { ok: false, status: 422, error: 'בסיכום יש מילים שסומנו [לא ברור] מהתמלול. תקן אותן בעריכה לפני האישור.' }
  }
  const now = new Date().toISOString()
  const { data: updated } = await admin.from('consultation_summaries')
    .update({ status: 'approved', approved_by: actor.id, approved_at: now })
    .eq('id', row.id).eq('updated_at', row.updated_at).select('*').single()
  if (!updated) return STALE
  await audit(admin, row, actor.id, 'SUMMARY_APPROVED', 'הרופא אישר את הסיכום',
    { version: row.version, edit_count: row.edit_count, warnings_acknowledged: openWarnings })
  return { ok: true, data: updated as SummaryRow }
}

export async function releaseSummary(admin: SupabaseClient, p: {
  summaryId: string; userId: string; expectedUpdatedAt?: string
}): Promise<ServiceResult<SummaryRow>> {
  const loaded = await loadRow(admin, p.summaryId)
  if (!loaded) return { ok: false, status: 404, error: 'הסיכום לא נמצא' }
  const { row, apt } = loaded
  const actor = await actorFor(admin, p.userId)
  if (!actor) return { ok: false, status: 403, error: 'אין הרשאה' }
  const d = decide('release', { status: row.status, appointment_doctor_id: apt.doctor_id }, actor)
  if (!d.ok) return { ok: false, status: d.code, error: d.error }
  if (stale(row, p.expectedUpdatedAt)) return STALE
  if (apt.status !== 'completed') return { ok: false, status: 409, error: 'ניתן לשחרר סיכום רק לאחר סיום הייעוץ' }

  const { data: approver } = await admin.from('users').select('first_name, last_name').eq('id', row.approved_by!).single()
  const name = approver ? `ד"ר ${approver.first_name} ${approver.last_name}` : 'הרופא המטפל'
  const now = new Date().toISOString()

  // The previous released version (if any) is replaced.
  await admin.from('consultation_summaries').update({ status: 'superseded', superseded_at: now })
    .eq('appointment_id', row.appointment_id).eq('status', 'released')
  const { data: updated } = await admin.from('consultation_summaries')
    .update({ status: 'released', released_by: actor.id, released_at: now })
    .eq('id', row.id).eq('status', 'approved').select('*').single()
  if (!updated) return STALE

  const view = patientView(row.content, { version: row.version, approvedAt: row.approved_at!, approvedByName: name })
  const { error } = await admin.from('appointments')
    .update({ ai_summary: JSON.stringify(view), ai_summary_released_at: now }).eq('id', row.appointment_id)
  if (error) return { ok: false, status: 500, error: 'שחרור הסיכום למטופל נכשל' }

  await audit(admin, row, actor.id, 'SUMMARY_RELEASED', 'הרופא שחרר את הסיכום המאושר למטופל', { version: row.version })
  await notify('consultation_summary', row.appointment_id, admin)
  return { ok: true, data: updated as SummaryRow }
}

/** Versions for the treating doctor's review screen (read with the caller's RLS session). */
export async function listVersions(client: SupabaseClient, appointmentId: string) {
  const { data, error } = await client.from('consultation_summaries')
    .select('*').eq('appointment_id', appointmentId).order('version', { ascending: false })
  return { rows: (data || []) as SummaryRow[], error }
}
