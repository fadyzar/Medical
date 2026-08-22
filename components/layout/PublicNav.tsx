'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Shared public-site navigation (all marketing pages).
 * Desktop: CANNA sticky white bar. Mobile/tablet: accessible hamburger menu.
 * White-label-neutral: uses the CANNA mark + teal CTA.
 */

const LINKS = [
  { href: '/', label: 'בית', key: 'home' },
  { href: '/doctors', label: 'רופאים', key: 'doctors' },
  { href: '/specialties', label: 'התמחויות', key: 'specialties' },
  { href: '/for-clinics', label: 'למרפאות', key: 'clinics' },
  { href: '/contact', label: 'צור קשר', key: 'contact' },
]

export default function PublicNav({ active }: { active?: string }) {
  const [open, setOpen] = useState(false)

  // Close on Escape; lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-100" dir="rtl">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/canna-mark.png" alt="CANNA" className="w-9 h-9 object-contain" />
          CANNA
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {LINKS.map(l => (
            <Link
              key={l.key}
              href={l.href}
              className={active === l.key ? 'text-sm font-semibold text-teal-600' : 'text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors'}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/auth/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">התחברות</Link>
          <Link href="/auth/register" className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm shadow-teal-600/20">
            הרשמה חינם
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'סגור תפריט' : 'פתח תפריט'}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {open ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          )}
        </button>
      </nav>

      {/* Mobile menu panel */}
      {open && (
        <div id="public-mobile-menu" className="md:hidden border-t border-slate-100 bg-white" dir="rtl">
          <div className="px-4 py-3 flex flex-col gap-1">
            {LINKS.map(l => (
              <Link
                key={l.key}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-3 rounded-xl text-base font-medium ${active === l.key ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-slate-100 my-2" />
            <Link href="/auth/login" onClick={() => setOpen(false)} className="px-3 py-3 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50">
              התחברות
            </Link>
            <Link href="/auth/register" onClick={() => setOpen(false)} className="px-3 py-3 rounded-xl text-base font-bold text-white bg-teal-600 hover:bg-teal-700 text-center">
              הרשמה חינם
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
