'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/* Illustrative specialty cards for the hero — no fabricated doctors, names,
   ratings, reviews or prices. Real doctors are listed in the grid below. */
const SPECIALTY_CARDS = [
  { icon: '🔬', spec: 'עור ומין', tag: 'ייעוץ בוידאו', from: '#3b82f6', to: '#6366f1' },
  { icon: '❤️', spec: 'קרדיולוגיה', tag: 'ייעוץ בוידאו', from: '#10b981', to: '#0891b2' },
  { icon: '🦴', spec: 'אורתופדיה', tag: 'ייעוץ בוידאו', from: '#8b5cf6', to: '#ec4899' },
]

const SPECIALTIES_PREVIEW = [
  'רפואה כללית', 'עור ומין', 'קרדיולוגיה', 'אורתופדיה',
  'נוירולוגיה', 'פסיכיאטריה', 'גינקולוגיה', 'אלרגולוגיה',
]

const TRUST_BADGES = [
  { icon: '🛡️', text: 'רישיון מאומת' },
  { icon: '📋', text: 'מרשם דיגיטלי' },
  { icon: '🔒', text: 'HIPAA מאובטח' },
]

export default function DoctorsHeroCarousel() {
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(1)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => {
      setTick(n => n + 1)
      setActive(p => (p + 1) % 3)
    }, 3200)
    return () => clearInterval(t)
  }, [])

  /* Card layout: fan arrangement */
  const CARDS = [
    { tx: '-140px', ty: '-30px', rot: '-7deg', z: 2, scale: '0.88' },
    { tx: '0px',   ty: '0px',   rot: '0deg',  z: 4, scale: '1'    },
    { tx: '140px', ty: '30px',  rot: '7deg',  z: 2, scale: '0.88' },
  ]

  return (
    <section
      className="relative overflow-hidden"
      style={{
        minHeight: '100vh',
        background: [
          'radial-gradient(ellipse 70% 60% at 20% 40%, rgba(59,130,246,0.18) 0%, transparent 70%)',
          'radial-gradient(ellipse 50% 50% at 80% 20%, rgba(139,92,246,0.14) 0%, transparent 60%)',
          'radial-gradient(ellipse 60% 50% at 60% 80%, rgba(16,185,129,0.08) 0%, transparent 60%)',
          'linear-gradient(160deg, #07090f 0%, #0d1225 50%, #080b18 100%)',
        ].join(', '),
      }}
      dir="rtl"
    >
      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.025,
          backgroundImage: [
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '64px 64px',
        }}
      />

      {/* Floating orbs */}
      <div className="pointer-events-none absolute top-24 left-[10%] w-72 h-72 rounded-full blur-3xl opacity-20"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
      <div className="pointer-events-none absolute bottom-24 right-[15%] w-56 h-56 rounded-full blur-3xl opacity-15"
        style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 flex flex-col lg:grid lg:grid-cols-2 gap-12 items-center"
        style={{ minHeight: '100vh', padding: '6rem 1rem' }}>

        {/* ── Left: Text ── */}
        <div
          className="transition-all duration-1000"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          }}
        >
          {/* Availability badge */}
          <div className="inline-flex items-center gap-2.5 mb-8 rounded-full border px-5 py-2 text-sm font-bold"
            style={{
              background: 'rgba(59,130,246,0.08)',
              borderColor: 'rgba(59,130,246,0.25)',
              color: '#93c5fd',
              backdropFilter: 'blur(12px)',
            }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
            רופאים מומחים זמינים כעת לייעוץ
          </div>

          {/* Headline */}
          <h1 className="font-black leading-none tracking-tight text-white mb-6"
            style={{ fontSize: 'clamp(2.8rem, 6vw, 4.5rem)', lineHeight: '0.92' }}>
            הרופא שלך<br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #60a5fa, #818cf8, #a78bfa)' }}>
              בשיחת וידאו
            </span>
          </h1>

          <p className="text-lg leading-relaxed mb-10 max-w-lg"
            style={{ color: '#94a3b8' }}>
            מאות רופאים מומחים מאומתים — זמינים לייעוץ בוידאו תוך שעות.{' '}
            ללא תור, ללא נסיעה, עם מרשם דיגיטלי ישירות לנייד.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-black text-white transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
              }}
            >
              קבע תור עכשיו — חינם
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <a
              href="#doctors-grid"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white transition-all hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
              }}
            >
              עיין ברופאים
            </a>
          </div>

          {/* Specialty pills scroll */}
          <div className="mb-10 overflow-hidden" style={{ maxWidth: '480px' }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#475569', letterSpacing: '0.1em' }}>
              התמחויות זמינות
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES_PREVIEW.map((s, i) => (
                <span
                  key={s}
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#cbd5e1',
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { v: 'וידאו HD', l: 'מוצפן' },
              { v: 'סיכומי AI', l: 'אחרי ייעוץ' },
              { v: 'מרשמים', l: 'דיגיטליים' },
              { v: 'מסמכים', l: 'מאובטחים' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-base font-black text-white leading-tight">{s.v}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Floating doctor cards ── */}
        <div
          className="relative flex items-center justify-center transition-all duration-1000"
          style={{
            minHeight: '480px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(48px)',
            transitionDelay: '300ms',
          }}
        >
          {/* Glow under cards */}
          <div className="absolute inset-0 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%)' }} />

          {/* Cards fan */}
          {SPECIALTY_CARDS.map((doc, i) => {
            const cfg = CARDS[i]
            const isActive = active === i
            return (
              <div
                key={i}
                onClick={() => setActive(i)}
                className="absolute cursor-pointer"
                style={{
                  transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: `translate(${cfg.tx}, ${cfg.ty}) rotate(${isActive ? '0deg' : cfg.rot}) scale(${isActive ? '1.06' : cfg.scale})`,
                  zIndex: isActive ? 10 : cfg.z,
                  width: '280px',
                }}
              >
                <div
                  className="rounded-3xl p-5 w-full"
                  style={{
                    background: isActive
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(20px)',
                    border: isActive
                      ? '1px solid rgba(255,255,255,0.25)'
                      : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isActive
                      ? `0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)`
                      : '0 8px 32px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Status — neutral capability badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        color: '#34d399',
                      }}
                    >
                      ● ייעוץ אונליין
                    </span>
                    <span className="text-xs font-bold" style={{ color: '#60a5fa' }}>
                      {doc.tag}
                    </span>
                  </div>

                  {/* Specialty icon + label */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${doc.from}, ${doc.to})`,
                        boxShadow: `0 8px 24px ${doc.from}40`,
                      }}
                    >
                      {doc.icon}
                    </div>
                    <div>
                      <p className="font-black text-white text-base">{doc.spec}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>רופאים מומחים בפלטפורמה</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center justify-between pt-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-sm font-bold" style={{ color: '#34d399' }}>
                      וידאו HD מוצפן
                    </span>
                    <a
                      href="#doctors-grid"
                      className="text-xs font-bold px-4 py-2 rounded-xl text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
                    >
                      קבע תור
                    </a>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Trust badge floating pills */}
          {TRUST_BADGES.map((b, i) => {
            const positions = [
              { top: '6%', right: '-8%' },
              { bottom: '10%', left: '-10%' },
              { top: '50%', right: '-12%' },
            ]
            return (
              <div
                key={i}
                className="absolute text-xs font-bold px-3.5 py-2 rounded-xl"
                style={{
                  ...positions[i],
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#e2e8f0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  animation: `bounce ${3 + i * 0.7}s ease-in-out infinite`,
                  animationDelay: `${i * 0.5}s`,
                }}
              >
                {b.icon} {b.text}
              </div>
            )
          })}

          {/* Card dots */}
          <div className="absolute -bottom-8 flex gap-2">
            {SPECIALTY_CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className="rounded-full transition-all"
                style={{
                  width: active === i ? '28px' : '8px',
                  height: '8px',
                  background: active === i ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="text-xs font-medium" style={{ color: '#475569' }}>גלול לגלות</span>
        <div className="w-5 h-8 rounded-full flex items-start justify-center pt-1.5"
          style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>
          <div className="w-1 h-2 rounded-full animate-bounce"
            style={{ background: '#60a5fa' }} />
        </div>
      </div>
    </section>
  )
}
