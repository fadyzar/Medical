'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Mock UI components ──────────────────────────────────────────────

function DashboardMock() {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden" dir="rtl"
      style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>כ</div>
          <span className="text-white text-xs font-bold">מרפאת כרמל</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-slate-400 text-[10px]">חי</span>
        </div>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2 p-3">
        {[
          { v: '24', l: 'תורים היום', c: '#60a5fa' },
          { v: '₪8,200', l: 'הכנסות', c: '#34d399' },
          { v: '12', l: 'מטופלים חדשים', c: '#a78bfa' },
          { v: '4.9★', l: 'דירוג', c: '#fbbf24' },
        ].map(k => (
          <div key={k.l} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-black" style={{ color: k.c }}>{k.v}</p>
            <p className="text-[9px] mt-0.5 leading-tight" style={{ color: '#475569' }}>{k.l}</p>
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="px-3 pb-2">
        <p className="text-[9px] mb-2 font-semibold" style={{ color: '#475569' }}>הכנסות — 7 ימים</p>
        <div className="flex items-end gap-1 h-12">
          {[40,60,35,80,55,100,75].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm transition-all"
              style={{ height: `${h}%`, background: i === 5 ? 'linear-gradient(180deg,#3b82f6,#4f46e5)' : 'rgba(59,130,246,0.25)' }} />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {['א','ב','ג','ד','ה','ו','ש'].map(d => (
            <span key={d} className="text-[8px] flex-1 text-center" style={{ color: '#334155' }}>{d}</span>
          ))}
        </div>
      </div>
      {/* Appointment list */}
      <div className="px-3 pb-3 space-y-1">
        <p className="text-[9px] mb-1.5 font-semibold" style={{ color: '#475569' }}>תורים קרובים</p>
        {[
          { t: '09:00', doc: 'ד"ר כהן', name: 'יונתן לוי', c: '#22c55e' },
          { t: '09:30', doc: 'ד"ר לוי', name: 'שרה כהן', c: '#3b82f6' },
          { t: '10:00', doc: 'ד"ר כהן', name: 'אבי משה', c: '#f59e0b' },
        ].map(a => (
          <div key={a.t} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="w-1 h-5 rounded-full shrink-0" style={{ background: a.c }} />
            <span className="text-[9px] font-mono w-8 shrink-0" style={{ color: '#60a5fa' }}>{a.t}</span>
            <span className="text-[9px] flex-1 truncate" style={{ color: '#64748b' }}>{a.doc}</span>
            <span className="text-[9px] font-medium" style={{ color: '#e2e8f0' }}>{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoMock() {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden flex flex-col"
      style={{ background: '#020817', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-3 py-2"
        style={{ background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>שיחה חיה</span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: '#475569' }}>18:32</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Main video */}
        <div className="flex-1 relative flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)' }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xl font-black"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#4f46e5)' }}>ש</div>
            <p className="text-white text-[10px] font-bold">שרה כהן</p>
            <p className="text-[9px]" style={{ color: '#64748b' }}>מטופלת</p>
          </div>
          {/* PiP */}
          <div className="absolute bottom-2 left-2 w-14 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>כ</div>
          </div>
          {/* AI badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold text-white"
            style={{ background: 'rgba(59,130,246,0.7)', backdropFilter: 'blur(8px)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            AI מנתח
          </div>
        </div>
        {/* SOAP panel */}
        <div className="w-28 flex flex-col" style={{ background: '#1e293b', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="p-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] font-bold text-white">SOAP — AI</p>
            <p className="text-[8px]" style={{ color: '#475569' }}>מתעדכן בזמן אמת</p>
          </div>
          <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
            {[
              { l: 'S', t: 'כאב ראש, 3 שבועות' },
              { l: 'O', t: 'לחץ 120/80, תקין' },
              { l: 'A', t: 'מיגרנה טנסיבית' },
              { l: 'P', t: 'אקמול 500mg' },
            ].map(s => (
              <div key={s.l} className="rounded-md p-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-[8px] font-black" style={{ color: '#60a5fa' }}>{s.l}:</span>
                <p className="text-[8px] leading-relaxed" style={{ color: '#64748b' }}>{s.t}</p>
              </div>
            ))}
          </div>
          <div className="p-2">
            <div className="text-center text-[8px] text-white font-bold py-1 rounded-md"
              style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>שמור</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandingMock() {
  const clinics = [
    { n: 'מרפאת השרון', sub: 'sharon-clinic', from: '#2563eb', to: '#4f46e5', init: 'ש' },
    { n: 'קליניקת ד"ר לוי', sub: 'drlevy', from: '#059669', to: '#0891b2', init: 'ל' },
    { n: 'מרכז כרמל', sub: 'carmel-med', from: '#7c3aed', to: '#db2777', init: 'כ' },
  ]
  return (
    <div className="w-full h-full rounded-2xl p-4 space-y-3 overflow-hidden" dir="rtl"
      style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest text-center" style={{ color: '#334155' }}>
        כל מרפאה — זהות ייחודית משלה
      </p>
      {clinics.map(c => (
        <div key={c.sub} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ background: `${c.from}18`, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-black"
                style={{ background: `linear-gradient(135deg,${c.from},${c.to})` }}>{c.init}</div>
              <span className="text-white text-[10px] font-bold">{c.n}</span>
            </div>
            <span className="text-[8px]" style={{ color: '#334155' }}>{c.sub}.telemed.co.il</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex gap-1">
              {[c.from, c.to, '#ffffff20'].map((col, i) => (
                <div key={i} className="w-3 h-3 rounded-full" style={{ background: col, border: '1px solid rgba(255,255,255,0.15)' }} />
              ))}
            </div>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full w-3/5" style={{ background: `linear-gradient(90deg,${c.from},${c.to})` }} />
            </div>
            <span className="text-[8px] text-green-400 font-bold">פעיל</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function AIMock() {
  const [chars, setChars] = useState(0)
  const text = 'מטופל בן 42, כאב ראש כרוני 3 שבועות, ללא חום. דחיפות: 4/10. ממליץ: ייעוץ נוירולוגי. לבדוק אלרגיה לאספירין לפני מרשם.'
  const elapsed = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      elapsed.current += 1
      setChars(p => p >= text.length ? 0 : p + 3)
    }, 55)
    return () => clearInterval(id)
  }, [text.length])

  return (
    <div className="w-full h-full rounded-2xl p-4 flex flex-col gap-3" dir="rtl"
      style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Triage badge */}
      <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.2)' }}>
          <span className="text-base font-black text-amber-400">4</span>
        </div>
        <div>
          <p className="text-white text-[10px] font-bold">ציון מיון AI</p>
          <p className="text-[9px]" style={{ color: '#94a3b8' }}>דחיפות בינונית · ייעוץ תוך 48ש׳</p>
        </div>
        <span className="mr-auto text-[9px] font-bold text-green-400 rounded-full px-2 py-0.5"
          style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>הושלם</span>
      </div>

      {/* Typing */}
      <div className="flex-1 rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.2)' }}>
            <span className="text-blue-400 text-[8px] font-black">AI</span>
          </div>
          <p className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>סיכום SOAP — מתכתב</p>
          <div className="flex gap-0.5 mr-auto">
            {[0,1,2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
        <p className="text-[9px] leading-relaxed" style={{ color: '#94a3b8' }}>
          {text.slice(0, chars)}
          <span className="inline-block w-0.5 h-3 ml-0.5 animate-pulse" style={{ background: '#60a5fa', verticalAlign: 'text-bottom' }} />
        </p>
      </div>

      {/* Agents */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { n: 'Triage Agent', done: true },
          { n: 'Intake Agent', done: true },
          { n: 'Summary Agent', done: false, active: true },
          { n: 'Prescription', done: false },
        ].map(a => (
          <div key={a.n} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className={`w-1.5 h-1.5 rounded-full ${a.done ? 'bg-green-400' : a.active ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[8px] font-medium" style={{ color: a.done ? '#34d399' : a.active ? '#60a5fa' : '#475569' }}>{a.n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slides ─────────────────────────────────────────────────────────

const SLIDES = [
  {
    tag: 'לוח בקרה',
    headline: ['כל המרפאה', 'במסך אחד'],
    desc: 'KPIs בזמן אמת, לוח תורים, הכנסות ומטופלים. דאשבורד נקי שחוסך שעות ניהול.',
    from: '#3b82f6', to: '#6366f1',
    ui: <DashboardMock />,
  },
  {
    tag: 'ייעוץ וידאו',
    headline: ['שיחות וידאו HD', 'מובנות בפלטפורמה'],
    desc: 'SOAP notes בצד, מסמכי מטופל גלויים, סיכום AI אוטומטי בסוף כל שיחה.',
    from: '#10b981', to: '#0891b2',
    ui: <VideoMock />,
  },
  {
    tag: 'White-Label',
    headline: ['המרפאה שלך', 'הזהות שלך'],
    desc: 'לוגו, צבעים ו-subdomain ייחודיים. המטופלים רואים רק את שם המרפאה שלך.',
    from: '#8b5cf6', to: '#ec4899',
    ui: <BrandingMock />,
  },
  {
    tag: 'בינה מלאכותית',
    headline: ['AI שכותב', 'את התיעוד בשבילך'],
    desc: 'מיון אוטומטי לפני ייעוץ. SOAP notes נכתבים לבד. טיוטת מרשם מוכנה תוך שניות.',
    from: '#f59e0b', to: '#ef4444',
    ui: <AIMock />,
  },
]

export default function HeroCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const DURATION = 5000

  const go = useCallback((i: number) => {
    setActive(i)
    setProgress(0)
    setPaused(true)
    setTimeout(() => setPaused(false), 500)
  }, [])

  useEffect(() => {
    if (paused) return
    const start = Date.now()
    const raf = () => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100)
      setProgress(p)
      if (p < 100) { handle = requestAnimationFrame(raf) }
      else { setProgress(0); setActive(a => (a + 1) % SLIDES.length) }
    }
    let handle = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(handle)
  }, [active, paused])

  const slide = SLIDES[active]

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-16" dir="rtl">

      {/* Progress bar */}
      <div className="flex gap-1.5 mb-10">
        {SLIDES.map((s, i) => (
          <button key={i} onClick={() => go(i)} className="flex-1 flex flex-col gap-1.5 group">
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-bold transition-colors"
                style={{ color: i === active ? '#e2e8f0' : '#475569' }}
              >
                {s.tag}
              </span>
            </div>
            <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: i === active ? `${progress}%` : i < active ? '100%' : '0%',
                  background: `linear-gradient(90deg, ${slide.from}, ${slide.to})`,
                  transition: i === active ? 'none' : 'width 0.3s',
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid lg:grid-cols-2 gap-12 items-center">

        {/* Text */}
        <div>
          <h3 className="font-black text-white leading-none tracking-tight mb-5"
            style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)' }}>
            {slide.headline[0]}{' '}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, ${slide.from}, ${slide.to})` }}>
              {slide.headline[1]}
            </span>
          </h3>
          <p className="text-base leading-relaxed mb-8" style={{ color: '#94a3b8' }}>
            {slide.desc}
          </p>
          {/* Feature bullets */}
          <div className="space-y-3">
            {[
              ['⚡', 'הפעלה בפחות מ-24 שעות'],
              ['🔒', 'HIPAA & GDPR מאובטח'],
              ['🇮🇱', 'תמיכה בעברית · ממשק RTL'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base">{icon}</span>
                <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mock UI */}
        <div
          className="relative h-64 sm:h-72 lg:h-80"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Glow */}
          <div className="absolute inset-0 rounded-2xl blur-2xl"
            style={{ background: `radial-gradient(ellipse, ${slide.from}25, transparent 70%)`, transform: 'scale(1.1)' }} />
          <div className="relative h-full rounded-2xl overflow-hidden shadow-2xl" style={{ boxShadow: `0 32px 64px rgba(0,0,0,0.5)` }}>
            {SLIDES.map((s, i) => (
              <div key={i} className="absolute inset-0 transition-opacity duration-500"
                style={{ opacity: i === active ? 1 : 0, pointerEvents: i === active ? 'auto' : 'none' }}>
                {s.ui}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
