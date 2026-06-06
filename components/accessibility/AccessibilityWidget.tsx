'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────
type Settings = {
  fontSize: 0 | 1 | 2 | 3   // 0=רגיל 1=גדול 2=גדול מאוד 3=ענק
  highContrast: boolean       // ניגודיות גבוהה
  grayscale: boolean          // גווני אפור
  underlineLinks: boolean     // הדגשת קישורים
  readableFont: boolean       // פונט קריא
  invertColors: boolean       // הפוך צבעים
}

const DEFAULT: Settings = {
  fontSize: 0,
  highContrast: false,
  grayscale: false,
  underlineLinks: false,
  readableFont: false,
  invertColors: false,
}

const STORAGE_KEY = 'telemed_a11y_v1'

const FONT_LABELS   = ['רגיל', 'גדול', 'גדול\u00A0מאוד', 'ענק']
const FONT_VALUES   = ['100%', '115%', '130%', '150%']

// ── Apply settings to <html> ─────────────────────────────────────────
function applySettings(s: Settings) {
  const html = document.documentElement

  // 1. Font size
  html.style.fontSize = FONT_VALUES[s.fontSize]

  // 2. Visual filters (combined to avoid conflicts)
  const filters: string[] = []
  if (s.highContrast) filters.push('contrast(160%)')
  if (s.grayscale)    filters.push('grayscale(100%)')
  if (s.invertColors) filters.push('invert(1) hue-rotate(180deg)')
  html.style.filter = filters.join(' ')

  // 3. CSS classes
  html.classList.toggle('a11y-underline-links', s.underlineLinks)
  html.classList.toggle('a11y-readable-font',   s.readableFont)
}

function resetSettings() {
  const html = document.documentElement
  html.style.fontSize = ''
  html.style.filter   = ''
  html.classList.remove('a11y-underline-links', 'a11y-readable-font')
}

// ── Toggle row component ─────────────────────────────────────────────
function ToggleRow({
  label, desc, checked, onChange, id,
}: {
  label: string
  desc?: string
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-gray-800 cursor-pointer block">
          {label}
        </label>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 items-center rounded-full
          transition-colors focus-visible:outline focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-blue-600
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        `}
        aria-label={label}
      >
        <span
          className={`
            inline-block h-4 w-4 rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  )
}

// ── Main widget ──────────────────────────────────────────────────────
export default function AccessibilityWidget() {
  const [open, setOpen]         = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT)
  const panelRef                = useRef<HTMLDivElement>(null)
  const triggerRef              = useRef<HTMLButtonElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Settings
        setSettings(parsed)
        applySettings(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  // Apply + save on every change
  const update = useCallback((partial: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      applySettings(next)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const handleReset = useCallback(() => {
    setSettings(DEFAULT)
    resetSettings()
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  // Escape key / focus trap
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
      // Basic focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, a, input, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last  = focusable[focusable.length - 1]
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // Auto-focus first element in panel
    setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    }, 50)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const isModified = JSON.stringify(settings) !== JSON.stringify(DEFAULT)

  return (
    <>
      {/* ── Floating trigger button ── */}
      <div className="fixed bottom-6 left-6 z-[9998]" dir="rtl">
        <button
          ref={triggerRef}
          onClick={() => setOpen(p => !p)}
          aria-label="פתח תפריט נגישות"
          aria-expanded={open}
          aria-controls="a11y-panel"
          className="
            group relative w-14 h-14 rounded-2xl
            bg-blue-600 hover:bg-blue-700
            text-white shadow-xl shadow-blue-600/40
            flex items-center justify-center
            transition-all hover:-translate-y-0.5 hover:shadow-blue-600/50
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400
          "
        >
          {/* Accessibility icon */}
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/>
            <path d="M9 9h6M12 9v4M10 20l2-4 2 4"/>
            <path d="M8.5 20c-.8-1.5-1-3-1-4.5C7.5 14 9 13 12 13s4.5 1 4.5 2.5c0 1.5-.2 3-1 4.5"/>
          </svg>

          {/* Modified indicator */}
          {isModified && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white" aria-label="הגדרות נגישות פעילות" />
          )}

          {/* Tooltip */}
          <span className="
            absolute left-full mr-3 whitespace-nowrap
            bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg
            opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
            mr-2
          " style={{ right: '100%', left: 'auto', marginRight: '10px' }}>
            הגדרות נגישות
          </span>
        </button>
      </div>

      {/* ── Panel ── */}
      {open && (
        <>
          {/* Backdrop (mobile) */}
          <div
            className="fixed inset-0 z-[9998] bg-black/20 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            id="a11y-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="הגדרות נגישות"
            dir="rtl"
            className="
              fixed bottom-24 left-6 z-[9999]
              w-80 bg-white rounded-2xl shadow-2xl shadow-gray-400/30
              border border-gray-200
              animate-fadeIn
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/>
                    <path d="M9 9h6M12 9v4M10 20l2-4 2 4"/>
                    <path d="M8.5 20c-.8-1.5-1-3-1-4.5C7.5 14 9 13 12 13s4.5 1 4.5 2.5c0 1.5-.2 3-1 4.5"/>
                  </svg>
                </div>
                <h2 className="font-bold text-gray-900 text-sm">הגדרות נגישות</h2>
              </div>
              <button
                onClick={() => { setOpen(false); triggerRef.current?.focus() }}
                aria-label="סגור תפריט נגישות"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* ── Font size ── */}
              <section aria-labelledby="font-size-label">
                <p id="font-size-label" className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  גודל טקסט
                </p>
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-labelledby="font-size-label">
                  {FONT_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => update({ fontSize: i as 0|1|2|3 })}
                      aria-pressed={settings.fontSize === i}
                      aria-label={`גודל טקסט ${label}`}
                      className={`
                        py-2 rounded-xl border-2 text-center transition-all
                        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600
                        ${settings.fontSize === i
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'}
                      `}
                    >
                      <span style={{ fontSize: `${11 + i * 2}px` }} className="font-bold block leading-none">א</span>
                      <span className="text-[9px] mt-1 block leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Display options ── */}
              <section aria-labelledby="display-label">
                <p id="display-label" className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  תצוגה
                </p>
                <div role="group" aria-labelledby="display-label">
                  <ToggleRow
                    id="a11y-contrast"
                    label="ניגודיות גבוהה"
                    desc="מגביר ניגודיות צבעים ל-160%"
                    checked={settings.highContrast}
                    onChange={v => update({ highContrast: v })}
                  />
                  <ToggleRow
                    id="a11y-grayscale"
                    label="גווני אפור"
                    desc="הסרת צבעים מהתצוגה"
                    checked={settings.grayscale}
                    onChange={v => update({ grayscale: v })}
                  />
                  <ToggleRow
                    id="a11y-invert"
                    label="הפוך צבעים"
                    desc="מצב כהה מלא (דומה למצב לילה)"
                    checked={settings.invertColors}
                    onChange={v => update({ invertColors: v })}
                  />
                  <ToggleRow
                    id="a11y-links"
                    label="הדגשת קישורים"
                    desc="קו תחתי לכל הקישורים בדף"
                    checked={settings.underlineLinks}
                    onChange={v => update({ underlineLinks: v })}
                  />
                  <ToggleRow
                    id="a11y-font"
                    label="פונט קריא"
                    desc='עבור ל-Arial — קריאה קלה יותר'
                    checked={settings.readableFont}
                    onChange={v => update({ readableFont: v })}
                  />
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 space-y-2">
              <button
                onClick={handleReset}
                disabled={!isModified}
                className="
                  w-full py-2.5 rounded-xl text-sm font-semibold transition-all
                  border-2 border-gray-200 text-gray-600
                  hover:border-red-300 hover:text-red-600 hover:bg-red-50
                  disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 disabled:hover:bg-transparent
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600
                "
              >
                איפוס כל ההגדרות
              </button>
              <Link
                href="/accessibility"
                className="
                  flex items-center justify-center gap-1.5
                  text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 rounded
                "
                onClick={() => setOpen(false)}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                הצהרת נגישות
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
