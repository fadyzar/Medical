'use client'

import { useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

/**
 * "Sign in with Google" button.
 * Uses Supabase OAuth; the existing /api/auth/callback route exchanges the code,
 * auto-creates a patient profile for first-time users, and routes by role.
 *
 * NOTE: requires the Google provider to be enabled in the Supabase dashboard
 * (Authentication → Providers → Google) with a valid client ID/secret.
 */
export default function GoogleButton({
  redirect,
  label = 'המשך עם Google',
  onError,
}: {
  redirect?: string | null
  label?: string
  onError?: (msg: string) => void
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const supabase = getClient()
      // Open-redirect guard: only same-origin internal paths.
      const safe =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\')
          ? redirect
          : null
      const callbackUrl = `${window.location.origin}/api/auth/callback${safe ? `?next=${encodeURIComponent(safe)}` : ''}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl },
      })

      if (error) {
        const msg = 'שגיאה בהתחברות עם Google. נסה שוב.'
        onError?.(msg)
        toast.error(msg)
        setLoading(false)
      }
      // On success the browser is redirected to Google — keep the button in loading state.
    } catch {
      const msg = 'שגיאה בהתחברות עם Google. נסה שוב.'
      onError?.(msg)
      toast.error(msg)
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-3 py-3 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <svg className="w-5 h-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      {label}
    </button>
  )
}
