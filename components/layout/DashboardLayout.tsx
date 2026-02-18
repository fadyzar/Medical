'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'
import { cn, getInitials } from '@/lib/utils'

interface NavItem { label: string; href: string; icon: string }

const NAV: Record<string, NavItem[]> = {
  patient: [
    { label: 'דשבורד', href: '/dashboard/patient/dashboard', icon: '🏠' },
    { label: 'תור חדש', href: '/dashboard/patient/new-appointment', icon: '🩺' },
    { label: 'המסמכים שלי', href: '/dashboard/patient/my-documents', icon: '📄' },
    { label: 'הפרופיל שלי', href: '/dashboard/patient/profile', icon: '👤' },
  ],
  doctor: [
    { label: 'דשבורד', href: '/dashboard/doctor/dashboard', icon: '🏠' },
    { label: 'תורים', href: '/dashboard/doctor/appointments', icon: '📋' },
    { label: 'יומן', href: '/dashboard/doctor/calendar', icon: '📅' },
    { label: 'מטופלים', href: '/dashboard/doctor/patients', icon: '👥' },
    { label: 'שאלונים', href: '/dashboard/doctor/questionnaires', icon: '📝' },
    { label: 'הפרופיל שלי', href: '/dashboard/doctor/profile', icon: '👤' },
  ],
  admin: [
    { label: 'דשבורד', href: '/dashboard/admin/dashboard', icon: '🏠' },
    { label: 'משתמשים', href: '/dashboard/admin/users', icon: '👥' },
    { label: 'שאלונים', href: '/dashboard/admin/questionnaires', icon: '📝' },
    { label: 'דוחות', href: '/dashboard/admin/reports', icon: '📊' },
    { label: 'יומן פעילות', href: '/dashboard/admin/audit-log', icon: '📜' },
    { label: 'הגדרות', href: '/dashboard/admin/settings', icon: '⚙️' },
    { label: 'חיוב ומנוי', href: '/dashboard/admin/billing', icon: '💳' },
  ],
  staff: [
    { label: 'דשבורד', href: '/dashboard/staff/dashboard', icon: '🏠' },
    { label: 'תורים', href: '/dashboard/staff/appointments', icon: '📋' },
  ],
}

export function DashboardLayout({ children, role }: { children: ReactNode; role: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const supabase = getClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return
      supabase.from('users').select('*').eq('id', authUser.id).single()
        .then(({ data }) => { if (data) setUser(data as unknown as User) })
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navItems = NAV[role] || NAV.patient

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden p-2 -mr-2" aria-label="תפריט" aria-expanded={mobileMenu} aria-controls="mobile-nav">
              <span className="text-xl" aria-hidden="true">☰</span>
            </button>
            <h1 className="text-lg font-bold text-blue-600">טלמדיסן</h1>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700" aria-hidden="true">
                  {getInitials(user.first_name, user.last_name)}
                </div>
                <span className="text-sm font-medium hidden sm:block">{user.first_name}</span>
              </div>
            )}
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 text-sm" aria-label="התנתק">יציאה</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:block w-56 shrink-0 border-l border-gray-200 bg-white min-h-[calc(100vh-3.5rem)] sticky top-14">
          <nav className="p-3 space-y-1" aria-label="ניווט ראשי">
            {navItems.map(item => (
              <a key={item.href} href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === item.href ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                )}
                aria-current={pathname === item.href ? 'page' : undefined}>
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Mobile sidebar */}
        {mobileMenu && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="תפריט ניווט">
            <div className="fixed inset-0 bg-black/30" onClick={() => setMobileMenu(false)} />
            <div className="fixed right-0 top-0 bottom-0 w-64 bg-white shadow-xl p-4 pt-16">
              <nav id="mobile-nav" className="space-y-1" aria-label="ניווט ראשי">
                {navItems.map(item => (
                  <a key={item.href} href={item.href} onClick={() => setMobileMenu(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                      pathname === item.href ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                    )}
                    aria-current={pathname === item.href ? 'page' : undefined}>
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  )
}
