'use client'

/**
 * Consultation transcription consent. Each side consents for themselves; the
 * transcript is captured only when the doctor and the patient both agreed.
 * Optional: declining never blocks the call. Either side can stop it.
 */
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Status {
  available: boolean
  status: string
  myConsent: boolean
  otherConsent: boolean
  consentText: string
  consentVersion: string
}

function useTranscription(appointmentId: string) {
  const [s, setS] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/consultation-transcript?appointmentId=${appointmentId}`, { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setS(await res.json() as Status)
  }, [appointmentId])
  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const t = setInterval(refresh, 4000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [refresh])
  const act = async (action: 'consent' | 'withdraw') => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/consultation-transcript', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action, consentVersion: s?.consentVersion }),
      })
      const body = await res.json().catch(() => ({})) as Status & { error?: string }
      if (res.ok) setS(body); else setError(body.error || 'הפעולה נכשלה')
    } finally { setBusy(false) }
  }
  return { s, busy, error, act }
}

/** Waiting room: explain, ask, show where the other side stands. */
export function TranscriptionConsentCard({ appointmentId, otherLabel }: { appointmentId: string; otherLabel: string }) {
  const { s, busy, error, act } = useTranscription(appointmentId)
  if (!s?.available) return null
  return (
    <div className="text-start rounded-xl border border-sky-700/60 bg-sky-950/40 p-3 space-y-2" data-testid="transcription-consent">
      <p className="text-sm font-semibold text-sky-200">תמלול השיחה (רשות)</p>
      <p className="text-xs text-slate-300 leading-relaxed">{s.consentText}</p>
      <label className="flex items-start gap-2 text-sm text-white cursor-pointer">
        <input type="checkbox" className="mt-1" checked={s.myConsent} disabled={busy}
          onChange={e => act(e.target.checked ? 'consent' : 'withdraw')} />
        אני מסכים/ה לתמלול השיחה
      </label>
      <p className={cn('text-xs', s.otherConsent ? 'text-green-400' : 'text-slate-400')}>
        {s.otherConsent ? `✓ ${otherLabel} הסכים/ה` : `${otherLabel} עדיין לא הסכים/ה`}
        {' · '}התמלול יתחיל רק בהסכמת שני הצדדים
      </p>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

/** In the call: a visible indicator while transcription is on, and a stop button. */
export function TranscriptionIndicator({ appointmentId }: { appointmentId: string }) {
  const { s, busy, act } = useTranscription(appointmentId)
  if (!s?.available || s.status === 'none') return null
  const both = s.myConsent && s.otherConsent
  if (s.status === 'withdrawn') {
    return <span className="text-xs text-slate-400" data-testid="transcription-indicator">התמלול הופסק</span>
  }
  if (!both) {
    return (
      <span className="text-xs text-slate-300" data-testid="transcription-indicator">
        תמלול: {s.myConsent ? 'ממתין להסכמת הצד השני' : 'לא אושר על ידך'}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2" data-testid="transcription-indicator">
      <span className="flex items-center gap-1.5 bg-sky-600/90 px-2.5 py-1 rounded-md text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        {s.status === 'recording' ? 'תמלול פעיל' : 'תמלול יופעל'} · בהסכמת שני הצדדים
      </span>
      <button type="button" disabled={busy} onClick={() => act('withdraw')}
        className="text-xs underline text-slate-200 hover:text-white disabled:opacity-50">
        הפסק תמלול
      </button>
    </span>
  )
}
