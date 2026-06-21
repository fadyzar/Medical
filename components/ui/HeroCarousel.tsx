'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * CANNA-branded gradient hero carousel.
 * No stock photography — premium healthcare gradients with a subtle medical motif.
 */
const slides = [
  { from: '#0c4a6e', via: '#0e7490', to: '#0f766e', label: 'ייעוץ וידאו' },
  { from: '#1e3a8a', via: '#4338ca', to: '#0e7490', label: 'בינה מלאכותית' },
  { from: '#065f46', via: '#0d9488', to: '#0369a1', label: 'מסמכים מאובטחים' },
  { from: '#0f172a', via: '#1e40af', to: '#0e7490', label: 'זמינות 24/7' },
]

/* Faint ECG + cross motif, tiled — pure SVG, no external assets */
function MedicalMotif() {
  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="canna-grid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0H0V64" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </pattern>
        <linearGradient id="canna-ecg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#canna-grid)" />
      <path
        d="M0 70 H120 l18 -42 18 84 22 -120 16 78 H360 l18 -30 18 60 22 -90 16 60 H700 l18 -42 18 84 22 -120 16 78 H1100"
        fill="none" stroke="url(#canna-ecg)" strokeWidth="2.5"
        transform="translate(0,40)"
      />
    </svg>
  )
}

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)

  const goTo = useCallback((idx: number) => setCurrent(idx), [])
  const next = useCallback(() => setCurrent(c => (c + 1) % slides.length), [])
  const prev = useCallback(() => setCurrent(c => (c - 1 + slides.length) % slides.length), [])

  useEffect(() => {
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next])

  return (
    <>
      {/* Gradient slides */}
      {slides.map((slide, i) => (
        <div
          key={slide.label}
          aria-hidden={i !== current}
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: i === current ? 1 : 0,
            background: `linear-gradient(135deg, ${slide.from} 0%, ${slide.via} 55%, ${slide.to} 100%)`,
          }}
        >
          <MedicalMotif />
          {/* Soft radial glows for depth */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(60% 60% at 75% 25%, rgba(255,255,255,0.14) 0%, transparent 60%), radial-gradient(50% 50% at 20% 80%, rgba(255,255,255,0.08) 0%, transparent 60%)',
          }} />
        </div>
      ))}

      {/* Prev / Next buttons */}
      <button onClick={prev} aria-label="שקופית קודמת"
        className="absolute left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button onClick={next} aria-label="שקופית הבאה"
        className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {slides.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`שקופית ${i + 1}`} className="transition-all duration-300">
            <span className={`block rounded-full transition-all duration-300 ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'}`} />
          </button>
        ))}
      </div>
    </>
  )
}
