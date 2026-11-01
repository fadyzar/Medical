'use client'

/**
 * The treating doctor's review of an AI consultation summary:
 * draft → (edit) → approve → release to the patient.
 * Nothing on this card reaches the patient before "שחרר למטופל".
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, CardContent, CardHeader, Badge, Spinner } from '@/components/ui'
import { cn, formatDateTime } from '@/lib/utils'
import {
  SECTION_KEYS, SOURCE_LABELS, STATUS_LABELS,
  type SectionKey, type SummaryContent, type SummaryItem, type SummaryStatus, type SummaryWarning,
} from '@/lib/clinical-summary/types'
import { WARNING_LABELS } from '@/lib/clinical-summary/grounding'

interface Version {
  id: string; version: number; status: SummaryStatus; content: SummaryContent
  sources: Record<string, { included?: boolean; lines?: number } | string | number>
  warnings: SummaryWarning[]; model_used: string | null
  generated_at: string; generated_by: string | null; edited_at: string | null; edited_by: string | null; edit_count: number
  approved_at: string | null; approved_by: string | null; released_at: string | null; updated_at: string
}
interface HistoryRow { id: string; version: number; status: SummaryStatus; generated_at: string; approved_at: string | null; released_at: string | null; edit_count: number }
interface Payload { current: Version | null; released: Version | null; history: HistoryRow[]; names: Record<string, string> }

const SECTION_LABELS: Record<SectionKey, { letter: string; label: string }> = {
  subjective: { letter: 'S', label: 'סובייקטיבי — מה דווח' },
  objective: { letter: 'O', label: 'אובייקטיבי — ממצאי הרופא' },
  assessment: { letter: 'A', label: 'הערכה — של הרופא' },
  plan: { letter: 'P', label: 'תוכנית — של הרופא' },
}

const SOURCE_CHIPS: { key: string; label: string }[] = [
  { key: 'booking', label: 'תיאור בהזמנה' },
  { key: 'history', label: 'היסטוריה רפואית' },
  { key: 'intake', label: 'שאלון קליטה' },
  { key: 'clinician_notes', label: 'הערות הרופא' },
  { key: 'transcript', label: 'תמלול השיחה' },
]

const STATUS_VARIANT: Record<SummaryStatus, 'warning' | 'info' | 'success' | 'default' | 'danger'> = {
  draft: 'warning', approved: 'info', released: 'success', superseded: 'default', legacy_unreviewed: 'danger',
}

const lines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean)

interface EditState { sections: Record<SectionKey, string>; missing: string; patient: string; instructions: string }

function toEdit(c: SummaryContent): EditState {
  return {
    sections: Object.fromEntries(SECTION_KEYS.map(k => [k, c.sections[k].map(i => i.text).join('\n')])) as Record<SectionKey, string>,
    missing: c.missing_information.join('\n'),
    patient: c.patient_summary,
    instructions: c.patient_instructions.join('\n'),
  }
}

function fromEdit(base: SummaryContent, e: EditState): SummaryContent {
  const sections = {} as Record<SectionKey, SummaryItem[]>
  for (const k of SECTION_KEYS) {
    const unchanged = base.sections[k].map(i => i.text).join('\n') === lines(e.sections[k]).join('\n')
    sections[k] = unchanged ? base.sections[k] : lines(e.sections[k]).map(text => ({ text, source: 'clinician_edit', verified: true }))
  }
  return {
    ...base, sections,
    missing_information: lines(e.missing),
    patient_summary: e.patient.trim(),
    patient_instructions: lines(e.instructions),
  }
}

export function SummaryReviewPanel({ appointmentId, appointmentStatus }: { appointmentId: string; appointmentStatus: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<null | 'generate' | 'save' | 'approve' | 'release' | 'send'>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [ackWarnings, setAckWarnings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/consultation-summary?appointmentId=${appointmentId}`, { cache: 'no-store' })
      if (res.ok) setData(await res.json() as Payload)
    } finally { setLoading(false) }
  }, [appointmentId])

  // Mounted with key={appointmentId}, so a new appointment starts from fresh state.
  useEffect(() => { load() }, [load])

  // Right after a consultation the automatic draft is still being written: poll for ~2 minutes.
  const hasAny = !!(data?.current || data?.released)
  useEffect(() => {
    if (loading || hasAny || appointmentStatus !== 'completed' || waiting > 24) return
    const t = setTimeout(() => { setWaiting(w => w + 1); load() }, 5000)
    return () => clearTimeout(t)
  }, [loading, hasAny, appointmentStatus, waiting, load])

  const act = async (action: 'generate' | 'save' | 'approve' | 'release', extra: Record<string, unknown> = {}) => {
    setBusy(action); setError(null)
    try {
      const res = await fetch('/api/consultation-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(body.error || 'הפעולה נכשלה'); return false }
      await load()
      return true
    } catch { setError('שגיאת רשת'); return false } finally { setBusy(null) }
  }

  const resend = async (channel: 'in_app' | 'email' | 'whatsapp') => {
    setBusy('send')
    try {
      const res = await fetch('/api/notifications/send-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, channel }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; results?: Record<string, { ok: boolean; error?: string }> }
      const r = body.results?.[channel] ?? body.results?.in_app
      if (res.ok && r?.ok !== false) toast.success('הסיכום נשלח שוב למטופל')
      else toast.error(r?.error || body.error || 'השליחה נכשלה')
    } finally { setBusy(null) }
  }

  if (loading) return <Card><CardContent className="py-6 flex justify-center"><Spinner /></CardContent></Card>

  const cur = data?.current ?? null
  const rel = data?.released ?? null
  const names = data?.names ?? {}
  const shown = cur ?? rel
  const editable = cur && (cur.status === 'draft' || cur.status === 'approved')

  return (
    <Card className="border-teal-200" data-testid="summary-review">
      <CardHeader className="py-3 px-4 border-b border-teal-100 bg-teal-50/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-teal-800">סיכום ייעוץ — טיוטת AI לבדיקת הרופא</p>
          {shown && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">גרסה {shown.version}</span>
              <Badge variant={STATUS_VARIANT[shown.status]}>{STATUS_LABELS[shown.status]}</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-4 px-4 space-y-4">
        {!shown && (
          <div className="space-y-3 text-sm text-slate-600">
            {appointmentStatus === 'completed' && waiting <= 24
              ? <p className="flex items-center gap-2"><Spinner size="sm" /> טיוטת הסיכום נוצרת…</p>
              : <p>עדיין אין טיוטת סיכום לייעוץ הזה.</p>}
            <Button size="sm" variant="outline" loading={busy === 'generate'} onClick={() => act('generate', { appointmentId })}>
              צור טיוטת סיכום
            </Button>
          </div>
        )}

        {/* Released version stays with the patient while a new draft is reviewed. */}
        {rel && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            גרסה {rel.version} שוחררה למטופל {rel.released_at ? formatDateTime(rel.released_at) : ''} · אושרה ע&quot;י {names[rel.approved_by ?? ''] ?? 'הרופא'}
            {cur && cur.id !== rel.id && ' · גרסה חדשה בבדיקה: המטופל רואה עדיין את הגרסה ששוחררה'}
          </div>
        )}

        {shown && (
          <>
            {shown.status === 'legacy_unreviewed' && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                סיכום ישן שנוצר לפני תהליך האישור, מתלונת ההזמנה בלבד. הוא לא נבדק ולא יוצג למטופל. צור טיוטה חדשה.
              </div>
            )}
            {shown.status === 'draft' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                טיוטה שנכתבה ע&quot;י AI. <strong>המטופל לא רואה אותה.</strong> בדוק מול המקורות, ערוך, אשר ושחרר.
              </div>
            )}

            {/* Sources that went into the draft */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">מקורות שהוזנו ל-AI</p>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_CHIPS.map(s => {
                  const v = shown.sources?.[s.key] as { included?: boolean } | undefined
                  const on = !!v?.included
                  return (
                    <span key={s.key} className={cn('text-xs rounded-full px-2.5 py-1 border',
                      on ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-400 line-through')}>
                      {on ? '✓' : '✗'} {s.label}
                    </span>
                  )
                })}
              </div>
            </div>

            {shown.warnings?.length > 0 && (
              <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                <p className="text-xs font-bold text-orange-800 mb-1">⚠ פריטים שלא אומתו מול המקור ({shown.warnings.length})</p>
                <ul className="text-xs text-orange-900 space-y-1 list-disc ps-4">
                  {shown.warnings.map((w, i) => <li key={i}><span className="font-semibold">{WARNING_LABELS[w.reason]}:</span> {w.text}</li>)}
                </ul>
              </div>
            )}

            {/* SOAP */}
            {SECTION_KEYS.map(k => (
              <div key={k} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-bold text-teal-700 mb-1.5">
                  {SECTION_LABELS[k].letter} · {SECTION_LABELS[k].label}
                  {shown.content.edited_sections?.includes(k) && <span className="ms-2 text-indigo-600">נערך ע&quot;י הרופא</span>}
                </p>
                {edit ? (
                  <textarea aria-label={SECTION_LABELS[k].label} rows={Math.max(2, lines(edit.sections[k]).length + 1)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                    value={edit.sections[k]} onChange={e => setEdit({ ...edit, sections: { ...edit.sections, [k]: e.target.value } })} />
                ) : shown.content.sections?.[k]?.length ? (
                  <ul className="space-y-1.5">
                    {shown.content.sections[k].map((it, i) => (
                      <li key={i} className="text-sm text-slate-800 leading-relaxed" title={it.evidence ? `ציטוט מהמקור: "${it.evidence}"` : undefined}>
                        {it.verified === false && <span className="text-orange-600 font-bold" aria-label="לא אומת">⚠ </span>}
                        {it.text}
                        <span className="ms-2 text-[11px] rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 whitespace-nowrap">{SOURCE_LABELS[it.source] ?? it.source}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-400">— לא תועד —</p>}
              </div>
            ))}

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-600 mb-1.5">מידע חסר</p>
              {edit ? (
                <textarea aria-label="מידע חסר" rows={3} className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  value={edit.missing} onChange={e => setEdit({ ...edit, missing: e.target.value })} />
              ) : (
                <ul className="text-sm text-slate-700 list-disc ps-4 space-y-0.5">
                  {(shown.content.missing_information || []).map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              )}
            </div>

            {shown.content.ai_suggestions?.length > 0 && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="text-xs font-bold text-violet-800 mb-1.5">הצעות AI לשיקול הרופא בלבד — לא יוצגו למטופל</p>
                <ul className="text-sm text-violet-900 space-y-1 list-disc ps-4">
                  {shown.content.ai_suggestions.map((s, i) => <li key={i}>{s.text} <span className="text-xs text-violet-600">({s.rationale})</span></li>)}
                </ul>
              </div>
            )}

            {/* What the patient will see */}
            <div className="rounded-lg border-2 border-dashed border-emerald-300 p-3">
              <p className="text-xs font-bold text-emerald-700 mb-1.5">מה המטופל יראה לאחר השחרור</p>
              {edit ? (
                <div className="space-y-2">
                  <textarea aria-label="סיכום למטופל" rows={4} className="w-full text-sm border border-slate-300 rounded-lg p-2"
                    value={edit.patient} onChange={e => setEdit({ ...edit, patient: e.target.value })} />
                  <textarea aria-label="הנחיות למטופל" rows={3} placeholder="הנחיה בכל שורה" className="w-full text-sm border border-slate-300 rounded-lg p-2"
                    value={edit.instructions} onChange={e => setEdit({ ...edit, instructions: e.target.value })} />
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-800 leading-relaxed">{shown.content.patient_summary || <span className="text-slate-400">— ריק —</span>}</p>
                  {shown.content.patient_instructions?.length > 0 && (
                    <ul className="mt-2 text-sm text-slate-700 list-disc ps-5 space-y-0.5">
                      {shown.content.patient_instructions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>

            {error && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

            {/* Actions */}
            {edit ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={busy === 'save'} onClick={async () => {
                  if (await act('save', { summaryId: shown.id, content: fromEdit(shown.content, edit), expectedUpdatedAt: shown.updated_at })) {
                    setEdit(null); setReviewed(false); toast.success('העריכה נשמרה')
                  }
                }}>שמור עריכה</Button>
                <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>ביטול</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {editable && cur && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEdit(toEdit(cur.content))}>ערוך</Button>
                  </div>
                )}

                {cur?.status === 'draft' && JSON.stringify(cur.content).includes('[לא ברור') && (
                  <div role="status" className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                    התמלול שיבש מילים (מסומנות [לא ברור]). ה-AI לא ניחש אותן: תקן אותן ב&quot;ערוך&quot; לפני האישור.
                  </div>
                )}
                {cur?.status === 'draft' && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                    <label className="flex items-start gap-2 text-sm text-slate-800">
                      <input type="checkbox" className="mt-1" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />
                      בדקתי את הסיכום מול המקורות, והוא משקף את הייעוץ.
                    </label>
                    {cur.warnings?.length > 0 && (
                      <label className="flex items-start gap-2 text-sm text-orange-900">
                        <input type="checkbox" className="mt-1" checked={ackWarnings} onChange={e => setAckWarnings(e.target.checked)} />
                        עברתי על {cur.warnings.length} הפריטים שלא אומתו.
                      </label>
                    )}
                    <Button size="sm" loading={busy === 'approve'} disabled={!reviewed || (cur.warnings?.length > 0 && !ackWarnings)}
                      onClick={() => act('approve', { summaryId: cur.id, expectedUpdatedAt: cur.updated_at, reviewed, acknowledgeWarnings: ackWarnings })}>
                      אשר סיכום
                    </Button>
                  </div>
                )}

                {cur?.status === 'approved' && (
                  <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 space-y-2">
                    <p className="text-sm text-teal-900">
                      אושר ע&quot;י {names[cur.approved_by ?? ''] ?? 'הרופא'} ב-{cur.approved_at ? formatDateTime(cur.approved_at) : ''}. עדיין לא נשלח למטופל.
                    </p>
                    <Button size="sm" loading={busy === 'release'} disabled={appointmentStatus !== 'completed'}
                      onClick={async () => { if (await act('release', { summaryId: cur.id, expectedUpdatedAt: cur.updated_at })) toast.success('הסיכום שוחרר למטופל ונשלחה לו הודעה') }}>
                      שחרר למטופל ושלח הודעה
                    </Button>
                    {appointmentStatus !== 'completed' && <p className="text-xs text-slate-500">ניתן לשחרר לאחר סיום הייעוץ.</p>}
                  </div>
                )}

                {rel && !cur && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">שלח שוב את הסיכום ששוחרר</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => resend('in_app')}>בעמוד</Button>
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => resend('email')}>אימייל</Button>
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => resend('whatsapp')}>WhatsApp</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(toEdit(rel.content))}>ערוך (גרסה חדשה)</Button>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" loading={busy === 'generate'}
                    onClick={() => act('generate', { appointmentId })}>
                    צור טיוטה מחדש מהנתונים העדכניים
                  </Button>
                  <span className="text-xs text-slate-400">תיווצר גרסה חדשה; הגרסה הקודמת נשמרת בהיסטוריה</span>
                </div>
              </div>
            )}

            {/* Editing a released version starts a new draft on save. */}
            {edit && !cur && rel && <p className="text-xs text-slate-500">השמירה תיצור גרסה חדשה לבדיקה. המטופל ימשיך לראות את הגרסה ששוחררה עד שתשחרר את החדשה.</p>}

            <TranscriptViewer appointmentId={appointmentId} />

            {/* Trail */}
            {(data?.history?.length ?? 0) > 0 && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold">היסטוריית גרסאות ({data!.history.length})</summary>
                <ul className="mt-2 space-y-1">
                  {data!.history.map(h => (
                    <li key={h.id}>
                      גרסה {h.version} · {STATUS_LABELS[h.status]} · נוצרה {formatDateTime(h.generated_at)}
                      {h.edit_count > 0 && ` · ${h.edit_count} עריכות`}
                      {h.approved_at && ` · אושרה ${formatDateTime(h.approved_at)}`}
                      {h.released_at && ` · שוחררה ${formatDateTime(h.released_at)}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** The consented transcript, for checking the draft against what was said. Treating doctor only. */
function TranscriptViewer({ appointmentId }: { appointmentId: string }) {
  const [segs, setSegs] = useState<{ speaker: string; start: number; text: string }[] | null>(null)
  useEffect(() => {
    fetch(`/api/consultation-transcript?appointmentId=${appointmentId}&full=1`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { transcript?: { speaker: string; start: number; text: string }[] } | null) => setSegs(d?.transcript ?? null))
      .catch(() => setSegs(null))
  }, [appointmentId])
  if (!segs?.length) return null
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  return (
    <details className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 text-sm" data-testid="transcript-viewer">
      <summary className="cursor-pointer text-xs font-bold text-sky-800">
        תמלול השיחה ({segs.length} קטעים) — תמלול אוטומטי, עלול לכלול שגיאות
      </summary>
      <ul className="mt-2 space-y-1 max-h-72 overflow-y-auto">
        {segs.map((s, i) => (
          <li key={i} className="leading-relaxed">
            <span className="text-[11px] text-slate-400 font-mono me-2">{mmss(s.start)}</span>
            <span className={cn('font-semibold me-1', s.speaker === 'doctor' ? 'text-teal-700' : 'text-indigo-700')}>
              {s.speaker === 'doctor' ? 'רופא:' : 'מטופל:'}
            </span>
            {s.text}
          </li>
        ))}
      </ul>
    </details>
  )
}
