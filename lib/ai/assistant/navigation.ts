/**
 * Where the assistant may send a user. An explicit allowlist per role: the
 * model picks a key, never a URL, so it cannot link anywhere else — and a page
 * a role cannot open is never offered to it.
 *
 * Dependency-free (types only) so it can be unit-tested directly.
 */
import type { CallerRole } from '@/lib/services/appointments'

export type PageKey =
  | 'dashboard' | 'appointments' | 'new_appointment' | 'documents' | 'profile' | 'payment'
  | 'calendar' | 'availability' | 'patients' | 'questionnaires'
  | 'users' | 'integrations' | 'whatsapp_settings' | 'email_settings' | 'domain_settings'
  | 'reports' | 'billing' | 'settings' | 'audit_log' | 'templates' | 'leads'

type PageDef = { label: string; description: string; href: Partial<Record<CallerRole, string>> }

export const PAGES: Record<PageKey, PageDef> = {
  dashboard: {
    label: 'לוח הבקרה', description: 'מסך הבית: סיכום היום, תורים קרובים ופעולות מהירות',
    href: { patient: '/dashboard/patient/dashboard', doctor: '/dashboard/doctor/dashboard', staff: '/dashboard/staff/dashboard', admin: '/dashboard/admin/dashboard' },
  },
  appointments: {
    label: 'התורים', description: 'רשימת התורים, סינון לפי סטטוס, פרטי תור',
    href: { patient: '/dashboard/patient/appointments', doctor: '/dashboard/doctor/appointments', staff: '/dashboard/staff/appointments', admin: '/dashboard/admin/appointments' },
  },
  new_appointment: {
    label: 'קביעת תור חדש', description: 'תהליך קביעת תור: התמחות, רופא, מועד ותשלום',
    href: { patient: '/dashboard/patient/new-appointment' },
  },
  documents: {
    label: 'המסמכים שלי', description: 'העלאה וצפייה במסמכים רפואיים',
    href: { patient: '/dashboard/patient/my-documents' },
  },
  profile: {
    label: 'הפרופיל שלי', description: 'פרטים אישיים, טלפון ופרטי קשר',
    href: { patient: '/dashboard/patient/profile', doctor: '/dashboard/doctor/profile' },
  },
  payment: {
    label: 'תשלום', description: 'תשלום עבור ייעוץ שאושר',
    href: { patient: '/dashboard/patient/payment' },
  },
  calendar: {
    label: 'היומן', description: 'תצוגה שבועית ויומית של התורים',
    href: { doctor: '/dashboard/doctor/calendar' },
  },
  availability: {
    label: 'שעות פעילות וחופשות', description: 'הגדרת ימים ושעות קבלה וימי חופשה',
    href: { doctor: '/dashboard/doctor/availability' },
  },
  patients: {
    label: 'המטופלים', description: 'רשימת המטופלים והיסטוריית הביקורים',
    href: { doctor: '/dashboard/doctor/patients' },
  },
  questionnaires: {
    label: 'שאלונים', description: 'בניית שאלוני קליטה למטופלים',
    href: { doctor: '/dashboard/doctor/questionnaires', admin: '/dashboard/admin/questionnaires' },
  },
  users: {
    label: 'ניהול משתמשים', description: 'רופאים, צוות ומטופלים; הזמנת משתמשים חדשים',
    href: { admin: '/dashboard/admin/users' },
  },
  integrations: {
    label: 'אינטגרציות', description: 'WhatsApp, תשלומים, אימייל, וידאו, חשבוניות ודומיין',
    href: { admin: '/dashboard/admin/integrations' },
  },
  whatsapp_settings: {
    label: 'הגדרות WhatsApp', description: 'חיבור Green API של המרפאה ושליחת הודעת בדיקה',
    href: { admin: '/dashboard/admin/integrations?tab=whatsapp' },
  },
  email_settings: {
    label: 'אימייל', description: 'אימייל מנוהל ע"י CANNA ושליחת אימייל בדיקה',
    href: { admin: '/dashboard/admin/integrations?tab=email' },
  },
  domain_settings: {
    label: 'דומיין המרפאה', description: 'בקשת תת-דומיין או דומיין מותאם (בהגדרות המרפאה)',
    href: { admin: '/dashboard/admin/settings' },
  },
  reports: {
    label: 'דוחות', description: 'הכנסות, תורים ושימוש ב-AI',
    href: { admin: '/dashboard/admin/reports' },
  },
  billing: {
    label: 'חיוב ומנוי', description: 'תוכנית המנוי של המרפאה',
    href: { admin: '/dashboard/admin/billing' },
  },
  settings: {
    label: 'הגדרות המרפאה', description: 'שעות, מחירים, מדיניות ביטול, תזכורות ומיתוג',
    href: { admin: '/dashboard/admin/settings' },
  },
  audit_log: {
    label: 'יומן ביקורת', description: 'מי עשה מה ומתי',
    href: { admin: '/dashboard/admin/audit-log' },
  },
  templates: {
    label: 'תבניות הודעה', description: 'נוסחי ההודעות שנשלחים למטופלים',
    href: { admin: '/dashboard/admin/templates' },
  },
  leads: {
    label: 'לידים', description: 'פניות של מטופלים פוטנציאליים',
    href: { admin: '/dashboard/admin/leads', staff: '/dashboard/staff/leads' },
  },
}

export function pagesForRole(role: CallerRole): Array<{ key: PageKey; label: string; description: string; href: string }> {
  return (Object.keys(PAGES) as PageKey[])
    .filter(k => PAGES[k].href[role])
    .map(k => ({ key: k, label: PAGES[k].label, description: PAGES[k].description, href: PAGES[k].href[role]! }))
}

export function resolvePage(role: CallerRole, key: string): { label: string; href: string } | null {
  const def = PAGES[key as PageKey]
  const href = def?.href[role]
  return def && href ? { label: def.label, href } : null
}

/**
 * Human label for the page the user is on, from the client-reported pathname.
 * The path is only ever matched against the allowlist — unknown paths yield
 * null and nothing from it reaches the model.
 */
export function describeCurrentPage(role: CallerRole, pathname: unknown): string | null {
  if (typeof pathname !== 'string' || !/^\/[a-z0-9/_-]{0,100}$/.test(pathname)) return null
  let best: { label: string; len: number } | null = null
  for (const def of Object.values(PAGES)) {
    const href = def.href[role]?.split('?')[0]
    if (href && pathname.startsWith(href) && (!best || href.length > best.len)) best = { label: def.label, len: href.length }
  }
  return best?.label ?? null
}
