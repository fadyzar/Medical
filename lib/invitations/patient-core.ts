/**
 * Pure rules for patient invitations (no I/O) — shared by the service, the API
 * routes and the unit tests.
 */
import type { RequestTenant } from '@/lib/tenant/server'

export type PatientInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export function inviteStatus(r: { used_at: string | null; revoked_at: string | null; expires_at: string }, now = Date.now()): PatientInviteStatus {
  if (r.used_at) return 'accepted'
  if (r.revoked_at) return 'revoked'
  return new Date(r.expires_at).getTime() <= now ? 'expired' : 'pending'
}

/** Where the invitee should land: the clinic's own site whenever it exists. */
export function clinicBaseUrl(
  org: { subdomain: string | null; domain_status?: string | null; custom_domain?: string | null },
  requestOrigin: string,
  tenant: RequestTenant,
): string {
  if (tenant.kind === 'clinic') return requestOrigin
  const u = new URL(requestOrigin)
  if (org.subdomain) {
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return `${u.protocol}//${org.subdomain}.canna.localhost${u.port ? `:${u.port}` : ''}`
    if (u.hostname.endsWith('cannaforyou.net') && org.domain_status === 'active') return `https://${org.subdomain}.cannaforyou.net`
  }
  return requestOrigin
}

export type AcceptOutcome =
  | 'joined' | 'already_member' | 'other_clinic' | 'not_found' | 'revoked' | 'used'
  | 'expired' | 'email_mismatch' | 'email_unverified' | 'not_patient' | 'no_profile'

export const ACCEPT_MESSAGES: Record<AcceptOutcome, string> = {
  joined: 'ההצטרפות למרפאה הושלמה',
  already_member: 'את/ה כבר חבר/ה במרפאה הזו',
  other_clinic: 'החשבון שלך כבר משויך למרפאה אחרת. מטופל יכול להיות משויך למרפאה אחת בלבד, ולכן לא ניתן להצטרף למרפאה נוספת ללא תהליך העברה מאושר. לבקשת העברה בין מרפאות פנה/י אלינו: medical@cannaforyou.net (או דרך עמוד צור קשר)',
  not_found: 'ההזמנה לא נמצאה',
  revoked: 'ההזמנה בוטלה על ידי המרפאה',
  used: 'ההזמנה כבר נוצלה',
  expired: 'תוקף ההזמנה פג. בקש/י מהמרפאה לשלוח הזמנה חדשה',
  email_mismatch: 'ההזמנה נשלחה לכתובת אימייל אחרת. התחבר/י עם הכתובת שאליה נשלחה ההזמנה',
  email_unverified: 'יש לאמת את כתובת האימייל לפני אישור ההזמנה',
  not_patient: 'ההזמנה מיועדת למטופלים. חשבון זה רשום בתפקיד אחר',
  no_profile: 'פרופיל המשתמש לא נמצא',
}


/** Exact, case-insensitive match for PostgREST ilike (escape its wildcards). */
export const ilikeExact = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)
