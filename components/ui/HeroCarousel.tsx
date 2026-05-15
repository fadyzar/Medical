'use client'

import { useEffect, useState, useCallback } from 'react'

const slides = [
  {
    src: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1800&q=85',
    alt: 'רופא בייעוץ וידאו',
  },
  {
    src: 'https://images.unsplash.com/photo-1551190822-a9333d879b1f?auto=format&fit=crop&w=1800&q=85',
    alt: 'רופאה מקצועית',
  },
  {
    src: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1800&q=85',
    alt: 'בדיקה רפואית',
  },
  {
    src: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1800&q=85',
    alt: 'טיפול רפואי',
  },
  {
    src: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&w=1800&q=85',
    alt: 'מרפאה מודרנית',
  },
]

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const goTo = useCallback((idx: number) => {
    if (transitioning) return
    setTransitioning(true)
    setTimeout(() => {
      setCurrent(idx)
      setTransitioning(false)
    }, 400)
  }, [transitioning])

  const next = useCallback(() => {
    goTo((current + 1) % slides.length)
  }, [current, goTo])

  const prev = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length)
  }, [current, goTo])

  useEffect(() => {
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next])

  return (
    <>
      {/* Images */}
      {slides.map((slide, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={slide.src}
          src={slide.src}
          alt={i === 0 ? '' : slide.alt}
          aria-hidden={i !== current}
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0 }}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {/* Prev / Next buttons */}
      <button
        onClick={prev}
        aria-label="תמונה קודמת"
        className="absolute left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button
        onClick={next}
        aria-label="תמונה הבאה"
        className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`תמונה ${i + 1}`}
            className="transition-all duration-300"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
            />
          </button>
        ))}
      </div>
    </>
  )
}
