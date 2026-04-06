'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'
import { cn, getInitials } from '@/lib/utils'

// ── SVG Icons ────────────────────────────────────────────

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconCalendarPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="12" y1="14" x2="12" y2="18" />
      <line x1="10" y1="16" x2="14" y2="16" />
    </svg>
  )
}

function IconFileText({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconListChecks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6h11" />
      <path d="M10 12h11" />
      <path d="M10 18h11" />
      <path d="M3 6l1 1 2-2" />
      <path d="M3 12l1 1 2-2" />
      <path d="M3 18l1 1 2-2" />
    </svg>
  )
}

function IconBarChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function IconScroll({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h12a2 2 0 002-2v-2H10v2a2 2 0 11-4 0V5a2 2 0 10-4 0v3h4" />
      <path d="M19 17V5a2 2 0 00-2-2H4" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function IconPlug({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6v6a6 6 0 01-12 0V6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="8" y1="6" x2="8" y2="2"/>
      <line x1="16" y1="6" x2="16" y2="2"/>
    </svg>
  )
}

function IconMessageSquare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  )
}

function IconCreditCard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}

function IconLogOut({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconStethoscope({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3" />
      <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  )
}

// ── Icon map ─────────────────────────────────────────────

type IconComponent = ({ className }: { className?: string }) => ReactNode

const ICON_MAP: Record<string, IconComponent> = {
  home: IconHome,
  'calendar-plus': IconCalendarPlus,
  'file-text': IconFileText,
  user: IconUser,
  clipboard: IconClipboard,
  calendar: IconCalendar,
  users: IconUsers,
  'list-checks': IconListChecks,
  'bar-chart': IconBarChart,
  scroll: IconScroll,
  settings: IconSettings,
  'credit-card': IconCreditCard,
  stethoscope: IconStethoscope,
  plug: IconPlug,
  'message-square': IconMessageSquare,
  'user-plus': IconUserPlus,
}

// ── Navigation ───────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: string
}

const NAV: Record<string, NavItem[]> = {
  patient: [
    { label: 'דשבורד', href: '/dashboard/patient/dashboard', icon: 'home' },
    { label: 'תור חדש', href: '/dashboard/patient/new-appointment', icon: 'calendar-plus' },
    { label: 'התורים שלי', href: '/dashboard/patient/appointments', icon: 'clipboard' },
    { label: 'המסמכים שלי', href: '/dashboard/patient/my-documents', icon: 'file-text' },
    { label: 'הפרופיל שלי', href: '/dashboard/patient/profile', icon: 'user' },
  ],
  doctor: [
    { label: 'דשבורד', href: '/dashboard/doctor/dashboard', icon: 'home' },
    { label: 'תורים', href: '/dashboard/doctor/appointments', icon: 'clipboard' },
    { label: 'יומן', href: '/dashboard/doctor/calendar', icon: 'calendar' },
    { label: 'מטופלים', href: '/dashboard/doctor/patients', icon: 'users' },
    { label: 'שאלונים', href: '/dashboard/doctor/questionnaires', icon: 'list-checks' },
    { label: 'הפרופיל שלי', href: '/dashboard/doctor/profile', icon: 'user' },
  ],
  admin: [
    { label: 'דשבורד', href: '/dashboard/admin/dashboard', icon: 'home' },
    { label: 'ניהול תורים', href: '/dashboard/admin/appointments', icon: 'clipboard' },
    { label: 'משתמשים', href: '/dashboard/admin/users', icon: 'users' },
    { label: 'לידים', href: '/dashboard/admin/leads', icon: 'user-plus' },
    { label: 'שאלונים', href: '/dashboard/admin/questionnaires', icon: 'list-checks' },
    { label: 'תבניות הודעות', href: '/dashboard/admin/templates', icon: 'message-square' },
    { label: 'אינטגרציות', href: '/dashboard/admin/integrations', icon: 'plug' },
    { label: 'דוחות', href: '/dashboard/admin/reports', icon: 'bar-chart' },
    { label: 'יומן פעילות', href: '/dashboard/admin/audit-log', icon: 'scroll' },
    { label: 'הגדרות', href: '/dashboard/admin/settings', icon: 'settings' },
    { label: 'חיוב ומנוי', href: '/dashboard/admin/billing', icon: 'credit-card' },
  ],
  staff: [
    { label: 'דשבורד', href: '/dashboard/staff/dashboard', icon: 'home' },
    { label: 'תורים', href: '/dashboard/staff/appointments', icon: 'clipboard' },
    { label: 'לידים', href: '/dashboard/staff/leads', icon: 'user-plus' },
  ],
}

const ROLE_LABELS: Record<string, string> = {
  patient: 'מטופל',
  doctor: 'רופא',
  admin: 'מנהל',
  staff: 'צוות שירות',
}

// ── Component ────────────────────────────────────────────

export function DashboardLayout({ children, role }: { children: ReactNode; role: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof getClient> | null>(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = getClient()
    return supabaseRef.current
  }

  useEffect(() => {
    const supabase = getSupabase()
    // Check "remember me" session expiry
    const expiresAt = localStorage.getItem('sessionExpiresAt')
    if (expiresAt && Date.now() > Number(expiresAt)) {
      localStorage.removeItem('sessionExpiresAt')
      localStorage.removeItem('rememberMe')
      supabase.auth.signOut().then(() => router.push('/auth/login'))
      return
    }

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return
      supabase.from('users').select('*').eq('id', authUser.id).single()
        .then(({ data }) => { if (data) setUser(data as unknown as User) })
    })
  }, [router])

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const close = () => setUserMenuOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [userMenuOpen])

  const handleLogout = async () => {
    localStorage.removeItem('rememberMe')
    localStorage.removeItem('sessionExpiresAt')
    await getSupabase().auth.signOut()
    router.push('/auth/login')
  }

  const navItems = NAV[role] || NAV.patient

  // For mobile bottom tab: show max 5 items, prioritize dashboard first
  const mobileItems = navItems.slice(0, 5)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen bg-gray-50/80" dir="rtl">
      {/* ─── Desktop Sidebar ─────────────────────────────── */}
      <aside className={cn(
        'fixed right-0 top-0 bottom-0 z-40 bg-white border-l border-gray-200/80 transition-all duration-300 hidden lg:flex flex-col',
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      )}>
        {/* Logo area */}
        <div className={cn(
          'h-16 flex items-center border-b border-gray-100 shrink-0',
          sidebarCollapsed ? 'justify-center px-2' : 'px-5 gap-3'
        )}>
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-teal-500 rounded-xl flex items-center justify-center shrink-0">
            <IconStethoscope className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-bold bg-gradient-to-l from-blue-600 to-teal-600 bg-clip-text text-transparent">
              טלמדיסן
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="ניווט ראשי">
          {navItems.map(item => {
            const Icon = ICON_MAP[item.icon] || IconHome
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                  sidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3',
                  active
                    ? 'bg-gradient-to-l from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200'
                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('w-5 h-5 shrink-0', active ? 'text-white' : 'text-gray-400 group-hover:text-blue-600')} />
                {!sidebarCollapsed && <span>{item.label}</span>}
                {/* Tooltip for collapsed mode */}
                {sidebarCollapsed && (
                  <span className="absolute right-full mr-2 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="mx-3 mb-2 p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label={sidebarCollapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        >
          <svg className={cn('w-5 h-5 transition-transform duration-300 mx-auto', sidebarCollapsed && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>

        {/* User section at bottom */}
        <div className={cn(
          'border-t border-gray-100 p-3 shrink-0',
          sidebarCollapsed && 'flex justify-center'
        )}>
          {sidebarCollapsed ? (
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              aria-label="התנתק"
            >
              <IconLogOut className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {user ? getInitials(user.first_name, user.last_name) : '..'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user ? `${user.first_name} ${user.last_name}` : '...'}
                </p>
                <p className="text-xs text-gray-400">{ROLE_LABELS[role]}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                aria-label="התנתק"
              >
                <IconLogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Top Header ──────────────────────────────────── */}
      <header className={cn(
        'fixed top-0 left-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60 h-16 transition-all duration-300',
        sidebarCollapsed ? 'lg:right-[72px]' : 'lg:right-64',
        'right-0' // mobile: full width
      )}>
        <div className="h-full px-4 lg:px-6 flex items-center justify-between">
          {/* Right side: mobile logo + page context */}
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
                <IconStethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold bg-gradient-to-l from-blue-600 to-teal-600 bg-clip-text text-transparent">
                טלמדיסן
              </span>
            </div>
            {/* Welcome text - desktop only */}
            <div className="hidden lg:block">
              <h1 className="text-lg font-bold text-gray-900">
                {user ? (role === 'doctor' ? `שלום, ד"ר ${user.first_name}` : `שלום, ${user.first_name}`) : 'טוען...'}
              </h1>
              <p className="text-xs text-gray-400">
                {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Left side: notification + avatar */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button
              className="relative w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="התראות"
            >
              <IconBell className="w-5 h-5" />
              {/* Notification dot */}
              <span className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen) }}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-sm font-bold text-white">
                  {user ? getInitials(user.first_name, user.last_name) : '..'}
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-700 leading-tight">
                    {user ? `${user.first_name} ${user.last_name}` : '...'}
                  </p>
                  <p className="text-xs text-gray-400 leading-tight">{ROLE_LABELS[role]}</p>
                </div>
                <IconChevronDown className={cn(
                  'w-4 h-4 text-gray-400 hidden sm:block transition-transform duration-200',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>

              {/* Dropdown menu */}
              {userMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200/80 py-2 z-50" role="menu">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">
                      {user ? `${user.first_name} ${user.last_name}` : '...'}
                    </p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                  <Link
                    href={`/dashboard/${role}/profile`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <IconUser className="w-4 h-4 text-gray-400" />
                    <span>הפרופיל שלי</span>
                  </Link>
                  {role === 'admin' && (
                    <Link
                      href="/dashboard/admin/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <IconSettings className="w-4 h-4 text-gray-400" />
                      <span>הגדרות</span>
                    </Link>
                  )}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                      role="menuitem"
                    >
                      <IconLogOut className="w-4 h-4" />
                      <span>התנתקות</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────── */}
      <main className={cn(
        'pt-16 pb-20 lg:pb-6 transition-all duration-300 min-h-screen',
        sidebarCollapsed ? 'lg:mr-[72px]' : 'lg:mr-64'
      )}>
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* ─── Mobile Bottom Tab Bar ───────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200/80 lg:hidden" aria-label="ניווט ראשי">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileItems.map(item => {
            const Icon = ICON_MAP[item.icon] || IconHome
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-xl mx-0.5 transition-colors',
                  active
                    ? 'text-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <div className={cn(
                  'w-10 h-7 flex items-center justify-center rounded-lg transition-colors',
                  active && 'bg-blue-100'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={cn(
                  'text-[10px] font-medium leading-tight',
                  active && 'font-semibold'
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
        {/* Safe area for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  )
}
