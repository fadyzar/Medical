import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// All user-facing appointment times display in Israel local time (Asia/Jerusalem),
// DST-aware. Pinning the timeZone keeps server-side surfaces (emails, WhatsApp,
// notifications — which run in UTC on Vercel) consistent with the browser.
export const APP_TIMEZONE = 'Asia/Jerusalem'

export function formatDate(date: string | Date, locale = 'he-IL') {
  return new Intl.DateTimeFormat(locale, { timeZone: APP_TIMEZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
}

export function formatTime(date: string | Date, locale = 'he-IL') {
  return new Intl.DateTimeFormat(locale, { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function formatDateTime(date: string | Date, locale = 'he-IL') {
  return new Intl.DateTimeFormat(locale, { timeZone: APP_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function formatPrice(amount: number, currency = 'ILS') {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency }).format(amount)
}

export function formatPhone(phone: string) {
  if (phone.startsWith('+972')) return '0' + phone.slice(4)
  return phone
}

export function toIsraeliPhone(phone: string) {
  return phone.startsWith('+') ? phone : `+972${phone.replace(/^0/, '')}`
}

export function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה', pending: 'ממתין', doctor_confirmed: 'רופא אישר',
  time_selected: 'נבחר זמן', payment_pending: 'ממתין לתשלום', paid: 'שולם',
  scheduled: 'מתוזמן', ready: 'מוכן', in_progress: 'בתהליך', completed: 'הושלם',
  cancelled_patient: 'בוטל', cancelled_doctor: 'בוטל ע"י רופא',
  no_show_patient: 'לא הגיע', no_show_doctor: 'רופא לא הגיע',
}

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', doctor_confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800', scheduled: 'bg-blue-100 text-blue-800',
  ready: 'bg-indigo-100 text-indigo-800', in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800', cancelled_patient: 'bg-red-100 text-red-800',
  cancelled_doctor: 'bg-red-100 text-red-800', payment_pending: 'bg-orange-100 text-orange-800',
}

export const SPECIALTIES = [
  { id: 'general', label: 'רפואה כללית' },
  { id: 'dermatology', label: 'עור ומין' },
  { id: 'orthopedics', label: 'אורתופדיה' },
  { id: 'cardiology', label: 'קרדיולוגיה' },
  { id: 'ent', label: 'א.א.ג' },
  { id: 'neurology', label: 'נוירולוגיה' },
  { id: 'gastro', label: 'גסטרו' },
  { id: 'urology', label: 'אורולוגיה' },
  { id: 'gynecology', label: 'גינקולוגיה' },
  { id: 'ophthalmology', label: 'עיניים' },
  { id: 'psychiatry', label: 'פסיכיאטריה' },
  { id: 'endocrinology', label: 'אנדוקרינולוגיה' },
  { id: 'pulmonology', label: 'ריאות' },
  { id: 'pediatrics', label: 'ילדים' },
  { id: 'pain', label: 'רפואת כאב' },
  { id: 'oncology', label: 'אונקולוגיה' },
]
