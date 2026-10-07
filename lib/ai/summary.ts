/**
 * Consultation summary generation — one implementation shared by:
 *   - POST /api/ai-summary            (doctor clicks "generate summary")
 *   - POST /api/appointments/complete (automatic, when a consultation ends)
 *
 * The automatic path used to re-POST to /api/ai-summary over HTTP without
 * awaiting it. On Vercel the function is frozen once the response is sent, so
 * that request usually never ran — and when it did, it sent an action value
 * the route's schema rejects. Calling this function directly removes both
 * failure modes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { summaryAgent } from '@/lib/ai/agents'
import { notify } from '@/lib/notifications'

export type SummaryOutcome =
  | { ok: true; skipped: boolean; data?: unknown }
  | { ok: false; error: string }

export async function generateConsultationSummary(params: {
  appointmentId: string
  /** The doctor the summary is generated for/by — recorded for AI billing. */
  userId: string
  admin: SupabaseClient
  /** Regenerate even when a summary already exists (explicit doctor request). */
  force?: boolean
  /** Notify the patient that the summary is ready. */
  notifyPatient?: boolean
}): Promise<SummaryOutcome> {
  const { appointmentId, userId, admin } = params

  const { data: apt } = await admin.from('appointments')
    .select('id, chief_complaint, subjective_notes, objective_notes, assessment, plan, organization_id, video_duration_seconds, ai_summary')
    .eq('id', appointmentId)
    .single()
  if (!apt) return { ok: false, error: 'Appointment not found' }

  // Duplicate prevention: the automatic path must never overwrite or re-bill.
  if (apt.ai_summary && !params.force) return { ok: true, skipped: true }

  const result = await summaryAgent({
    complaint: apt.chief_complaint,
    notes: [apt.subjective_notes, apt.objective_notes].filter(Boolean).join('\n'),
    assessment: apt.assessment || undefined,
    plan: apt.plan || undefined,
    duration: apt.video_duration_seconds ? Math.round(apt.video_duration_seconds / 60) : undefined,
  })

  await admin.from('ai_conversations').insert({
    organization_id: apt.organization_id, user_id: userId, appointment_id: appointmentId,
    agent_type: 'summary', messages: [{ role: 'user', content: apt.chief_complaint }],
    result: result.parsed || { raw: result.success ? result.content : null }, is_complete: result.success,
    input_tokens: result.tokens?.input || 0, output_tokens: result.tokens?.output || 0,
    model_used: 'claude-sonnet-4-20250514',
  })

  if (!result.success) return { ok: false, error: result.content }

  const p = result.parsed as { soap?: { subjective?: string; assessment?: string; plan?: string } } | undefined
  const { error } = await admin.from('appointments').update({
    ai_summary: result.content, ai_summary_generated_at: new Date().toISOString(), ai_used: true,
    ...(!apt.subjective_notes && p?.soap?.subjective ? { subjective_notes: p.soap.subjective } : {}),
    ...(!apt.assessment && p?.soap?.assessment ? { assessment: p.soap.assessment } : {}),
    ...(!apt.plan && p?.soap?.plan ? { plan: p.soap.plan } : {}),
  }).eq('id', appointmentId)
  if (error) return { ok: false, error: error.message }

  if (params.notifyPatient) {
    await notify('consultation_summary', appointmentId, admin)
  }

  return { ok: true, skipped: false, data: result.parsed || result.content }
}
