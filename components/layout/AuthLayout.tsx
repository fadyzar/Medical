'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'

// ── SVG Icons for the brand panel ────────────────────────

function IconStethoscope({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3" />
      <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  )
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

// ── Features list for brand panel ────────────────────────

const FEATURES = [
  { icon: IconVideo, text: 'ייעוץ וידאו עם רופאים מומחים' },
  { icon: IconClock, text: 'זמינות 24/7, ללא תורים ארוכים' },
  { icon: IconShield, text: 'מאובטח ומוגן בתקני HIPAA' },
]

// ── Component ────────────────────────────────────────────

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* ─── Brand Panel (desktop only) ────────────────── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-gradient-to-b from-blue-700 via-blue-600 to-teal-600 flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-white/5 rounded-full" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <IconStethoscope className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">CANNA</span>
          </Link>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              הרפואה של המחר,<br />
              זמינה לך היום
            </h2>
            <p className="text-blue-100 mt-3 text-lg leading-relaxed">
              ייעוץ רפואי מקצועי בשיחת וידאו —
              מהבית, בקליק אחד.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Capability card — factual, no fabricated social proof */}
        <div className="relative z-10">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
            <p className="text-white text-sm font-semibold mb-3">מה כלול בפלטפורמת CANNA</p>
            <div className="space-y-2.5">
              {['שיחות וידאו מוצפנות מקצה לקצה', 'סיכום ביקור ותיעוד מבוסס AI', 'ניהול מסמכים רפואיים מאובטח', 'תזכורות אוטומטיות לתורים'].map((t, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-teal-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-white/90 text-sm">{t}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-blue-200 text-xs mt-4 text-center">
            מאובטח בתקן HIPAA &middot; הפרדה מלאה בין מרפאות
          </p>
        </div>
      </div>

      {/* ─── Form Panel ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50/50">
        {/* Mobile header */}
        <div className="lg:hidden bg-gradient-to-l from-blue-700 to-teal-600 px-6 py-8">
          <Link href="/" className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <IconStethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CANNA</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-blue-100 text-sm mt-1">{subtitle}</p>}
        </div>

        {/* Form content */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 lg:py-12">
          <div className="w-full max-w-md">
            {/* Desktop title */}
            <div className="hidden lg:block mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
            </div>

            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 px-4 text-xs text-gray-400">
          <p>
            &copy; {new Date().getFullYear()} CANNA — ייעוץ רפואי מקצועי אונליין
          </p>
          <div className="flex items-center justify-center gap-3 mt-1">
            <Link href="/terms" className="hover:text-gray-600 transition-colors">תנאי שימוש</Link>
            <span>&middot;</span>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">מדיניות פרטיות</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
