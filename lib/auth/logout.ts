'use client'

import { getClient } from '@/lib/supabase/client'

/** Resolves with the promise's result, or with `fallback` after `ms`. Never rejects. */
function settle<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(fallback), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(fallback) })
  })
}

/** Deletes any Supabase auth cookie still visible to this page (host-only cookies). */
function clearAuthCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name && name.startsWith('sb-')) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
    }
  }
}

/**
 * Logs the user out and always leaves the page, even when signOut fails.
 *
 * The old handler awaited signOut() without checking its result and then did a
 * soft router.push: when signOut errored or hung (e.g. the auth lock held by
 * another tab) the session cookies survived and the middleware sent the user
 * straight back to the dashboard — "logout does nothing".
 */
let inProgress = false
/** True while this tab is logging out (its own SIGNED_OUT event is expected). */
export function isLoggingOut(): boolean { return inProgress }

export async function logout(redirectTo = '/auth/login'): Promise<void> {
  if (inProgress) return
  inProgress = true
  try {
    localStorage.removeItem('rememberMe')
    localStorage.removeItem('sessionExpiresAt')
  } catch { /* private mode */ }

  const supabase = getClient()

  // 1. Client sign-out: revokes the session and tells other open tabs (SIGNED_OUT).
  const res = await settle<{ error: unknown }>(supabase.auth.signOut(), 5000, { error: new Error('timeout') })
  if (res.error) {
    // Could not reach the auth server or the lock was busy: drop the local session anyway.
    await settle<{ error: unknown }>(supabase.auth.signOut({ scope: 'local' }), 2000, { error: null })
  }

  // 2. Server sign-out: revokes and deletes the auth cookies server-side.
  await settle<Response | null>(
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }),
    5000,
    null,
  )

  // 3. Last resort for anything left in this browser, then a full page load so
  //    no cached client state (React or router cache) can show the old session.
  clearAuthCookies()
  window.location.replace(redirectTo)
}
