'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'

const ROLE_HOME: Record<string, string> = {
  doctor: '/dashboard/doctor/dashboard',
  staff:  '/dashboard/staff/dashboard',
  admin:  '/dashboard/admin/dashboard',
}

/**
 * Shown on the invite page to a signed-in user whose email matches the
 * invitation: completes it through /api/auth/invite-accept, which re-checks
 * the token, the email, expiry and single use on the server.
 */
export default function AcceptInvite({ token, roleLabel, orgName, email }: {
  token: string
  roleLabel: string
  orgName: string
  email: string
}) {
  const [loading, setLoading] = useState(false)

  const accept = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/invite-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; role?: string }
      if (!res.ok) {
        toast.error(body.error || 'שגיאה בעיבוד ההזמנה')
        setLoading(false)
        return
      }
      toast.success('ההצטרפות הושלמה')
      // Hard navigation so the middleware reads the new role.
      window.location.assign(ROLE_HOME[body.role || ''] || '/dashboard/patient/dashboard')
    } catch {
      toast.error('שגיאה לא צפויה')
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 leading-relaxed">
        את/ה מחובר/ת כ-<span className="font-semibold" dir="ltr">{email}</span>.
        לחיצה על הכפתור תשלים את ההצטרפות ל{orgName} בתפקיד {roleLabel}.
      </div>
      <Button type="button" onClick={accept} loading={loading} className="w-full">
        השלם הצטרפות ל{orgName}
      </Button>
    </div>
  )
}
