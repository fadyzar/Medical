'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

/**
 * A signed-in patient reviews a clinic invitation and accepts it. Everything is
 * decided by the server (/api/auth/invite-accept → accept_patient_invitation):
 * token, email, expiry, single use and the one-clinic-per-patient rule.
 */
export default function AcceptPatientInvite({ token, orgName, email }: { token: string; orgName: string; email: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; redirect?: string | null } | null>(null)

  const accept = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/invite-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string; redirect?: string | null; outcome?: string }
      if (res.ok && body.ok) {
        setResult({ ok: true, message: body.message || 'ההצטרפות הושלמה', redirect: body.redirect })
        if (body.outcome === 'joined' && body.redirect) window.location.assign(body.redirect)
      } else {
        setResult({ ok: false, message: body.error || 'לא ניתן לאשר את ההזמנה' })
      }
    } catch {
      setResult({ ok: false, message: 'שגיאה לא צפויה. נסה/י שוב.' })
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="w-full" role="status" aria-live="polite" data-testid="invite-result">
        <div className={`mb-5 p-4 rounded-xl border text-sm leading-relaxed ${result.ok ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          {result.message}
        </div>
        {result.ok && (
          <a href={result.redirect || '/dashboard/patient/dashboard'} className="inline-flex w-full justify-center rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700">
            מעבר לאזור האישי
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 leading-relaxed">
        <p className="mb-2">את/ה מחובר/ת כ-<span className="font-semibold" dir="ltr">{email}</span>.</p>
        <p>אישור ההזמנה ישייך את החשבון שלך ל<strong>{orgName}</strong>. מטופל יכול להיות משויך למרפאה אחת בלבד.
          המרפאה תוכל לראות את פרטי הפרופיל שלך ואת התורים שתקבע/י בה — לא מידע ממרפאות אחרות.</p>
      </div>
      <Button type="button" onClick={accept} loading={loading} className="w-full">
        אישור ההזמנה והצטרפות ל{orgName}
      </Button>
    </div>
  )
}
