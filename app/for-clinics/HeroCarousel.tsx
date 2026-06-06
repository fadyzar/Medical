'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ── Mock UI components for each slide ────────────────────────────
function DashboardMock() {
  return (
    <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white/80" />
          </div>
          <span className="text-white text-xs font-bold">מרפאת כרמל</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>חי</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-2 p-3">
        {[
          { val: '24', label: 'תורים היום', color: 'text-blue-400' },
          { val: '₪8,200', label: 'הכנסות', color: 'text-green-400' },
          { val: '12', label: 'מטופלים חדשים', color: 'text-purple-400' },
          { val: '4.9★', label: 'דירוג', color: 'text-yellow-400' },
        ].map(k => (
          <div key={k.label} className="bg-white/5 rounded-lg p-2 border border-white/8">
            <p className={`text-base font-black ${k.color}`}>{k.val}</p>
            <p className="text-slate-500 text-[9px] mt-0.5 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Mini chart */}
      <div className="px-3 mb-2">
        <p className="text-slate-500 text-[9px] mb-1.5 font-semibold">ייעוצים — 7 ימים אחרונים</p>
        <div className="flex items-end gap-1 h-10">
          {[6, 9, 5, 12, 8, 15, 11].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm bg-blue-600/60 hover:bg-blue-500/80 transition-all" style={{ height: `${(h / 15) * 100}%` }} />
          ))}
        </div>
        <div className="flex justify-between mt-0.5">
          {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(d => (
            <span key={d} className="text-slate-600 text-[8px] flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Appointments list */}
      <div className="px-3 pb-3 space-y-1">
        <p className="text-slate-500 text-[9px] mb-1.5 font-semibold">תורים קרובים</p>
        {[
          { time: '09:00', doc: 'ד"ר כהן', name: 'יונתן לוי', status: 'bg-green-500' },
          { time: '09:30', doc: 'ד"ר לוי', name: 'שרה כהן', status: 'bg-blue-500' },
          { time: '10:00', doc: 'ד"ר כהן', name: 'אבי משה', status: 'bg-amber-500' },
        ].map(apt => (
          <div key={apt.time} className="flex items-center gap-2 bg-white/4 rounded-lg px-2 py-1.5">
            <div className={`w-1 h-5 rounded-full ${apt.status} shrink-0`} />
            <span className="text-blue-300 text-[9px] font-mono w-8 shrink-0">{apt.time}</span>
            <span className="text-slate-400 text-[9px] flex-1 truncate">{apt.doc}</span>
            <span className="text-white text-[9px] font-medium truncate">{apt.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoMock() {
  return (
    <div className="w-full h-full bg-slate-950 rounded-xl overflow-hidden border border-white/10" dir="rtl">
      <div className="grid grid-cols-3 gap-0 h-full">
        {/* Video area */}
        <div className="col-span-2 flex flex-col">
          {/* Patient video */}
          <div className="flex-1 bg-gradient-to-br from-slate-800 to-slate-900 relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">ש</div>
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-medium">שרה כהן — מטופלת</div>
            {/* Doctor PiP */}
            <div className="absolute bottom-2 left-2 w-16 h-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-white/20 flex items-center justify-center overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs">כ</div>
            </div>
          </div>
          {/* Controls bar */}
          <div className="bg-slate-900 px-3 py-2 flex items-center justify-between border-t border-white/8">
            <div className="flex items-center gap-2 text-slate-500 text-[9px]">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>18:32</span>
            </div>
            <div className="flex gap-2">
              {['M', 'V', '⏹'].map(c => (
                <div key={c} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-[9px] cursor-pointer hover:bg-white/20">{c}</div>
              ))}
              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-[9px]">✕</div>
            </div>
            <div className="text-[9px] text-slate-500">HD</div>
          </div>
        </div>

        {/* SOAP Notes panel */}
        <div className="bg-slate-800/80 border-r border-white/8 flex flex-col">
          <div className="px-2 py-2 border-b border-white/8">
            <p className="text-white text-[9px] font-bold">סיכום AI</p>
            <p className="text-slate-500 text-[8px]">מתעדכן בזמן אמת</p>
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-hidden">
            {[
              { label: 'S', text: 'כאב ראש כרוני, 3 שבועות, ללא חום' },
              { label: 'O', text: 'לחץ 120/80, ללא ממצאים פתולוגיים' },
              { label: 'A', text: 'מיגרנה טנסיבית סבירה' },
              { label: 'P', text: 'אקמול 500, מעקב שבועי...' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-md p-1.5">
                <span className="text-blue-400 text-[8px] font-black">{s.label}:</span>
                <p className="text-slate-400 text-[8px] mt-0.5 leading-relaxed line-clamp-2">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-white/8">
            <div className="bg-blue-600/80 text-white text-[8px] text-center py-1 rounded-md font-semibold">שמור סיכום</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandingMock() {
  const clinics = [
    { name: 'מרפאת השרון', sub: 'sharon-clinic', primary: '#2563eb', secondary: '#4f46e5', initials: 'ש' },
    { name: 'קליניקת ד"ר לוי', sub: 'drlevy', primary: '#059669', secondary: '#0891b2', initials: 'ל' },
    { name: 'מרכז כרמל הרפואי', sub: 'carmel-med', primary: '#7c3aed', secondary: '#db2777', initials: 'כ' },
  ]
  return (
    <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 p-3 space-y-2" dir="rtl">
      <div className="text-center mb-3">
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">כל מרפאה — זהות ייחודית משלה</p>
      </div>
      {clinics.map(c => (
        <div key={c.sub} className="bg-white/5 rounded-xl border border-white/8 overflow-hidden">
          {/* Mini navbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5" style={{ backgroundColor: c.primary + '22' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-black" style={{ backgroundColor: c.primary }}>{c.initials}</div>
              <span className="text-white text-[9px] font-bold">{c.name}</span>
            </div>
            <span className="text-slate-500 text-[8px]">{c.sub}.cannaforyou.net</span>
          </div>
          {/* Content preview */}
          <div className="px-3 py-2 flex items-center gap-3">
            <div className="flex gap-1">
              {[c.primary, c.secondary, '#ffffff33'].map((col, i) => (
                <div key={i} className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: col }} />
              ))}
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-white/5">
              <div className="h-full rounded-full w-3/5" style={{ backgroundColor: c.primary + '80' }} />
            </div>
            <div className="text-[8px] text-slate-500">פעיל</div>
          </div>
        </div>
      ))}
      <div className="text-center pt-1">
        <span className="text-[8px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">+ הגדרות צבע, לוגו ו-subdomain</span>
      </div>
    </div>
  )
}

function AIMock() {
  const [chars, setChars] = useState(0)
  const text = 'מטופל בן 42, תלונה על כאב ראש כרוני. על פי הניתוח: דחיפות 4/10. ממליץ על ייעוץ נוירולוגי. תרופות: יש לבדוק אלרגיה לאספירין לפני מרשם.'
  useEffect(() => {
    const id = setInterval(() => setChars(p => p < text.length ? p + 2 : 0), 60)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 p-3 flex flex-col gap-2" dir="rtl">
      {/* Triage score */}
      <div className="bg-white/5 rounded-xl border border-white/8 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
          <span className="text-amber-400 font-black text-base">4</span>
        </div>
        <div>
          <p className="text-white text-[10px] font-bold">ציון מיון AI</p>
          <p className="text-slate-500 text-[9px]">דחיפות בינונית · ייעוץ תוך 48ש׳</p>
        </div>
        <div className="mr-auto text-[9px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">הושלם</div>
      </div>

      {/* AI Typing */}
      <div className="flex-1 bg-white/5 rounded-xl border border-white/8 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-md bg-blue-600/30 border border-blue-500/30 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
          </div>
          <p className="text-blue-400 text-[9px] font-bold">סיכום AI — מתכתב...</p>
          <div className="flex gap-0.5 mr-auto">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
        <p className="text-slate-300 text-[9px] leading-relaxed">
          {text.slice(0, chars)}
          <span className="inline-block w-0.5 h-3 bg-blue-400 ml-0.5 animate-pulse" />
        </p>
      </div>

      {/* Agents list */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { name: 'Triage Agent', done: true, color: 'text-green-400' },
          { name: 'Intake Agent', done: true, color: 'text-green-400' },
          { name: 'Summary Agent', done: false, color: 'text-blue-400' },
          { name: 'Prescription Agent', done: false, color: 'text-slate-500' },
        ].map(a => (
          <div key={a.name} className="flex items-center gap-1.5 bg-white/4 rounded-lg px-2 py-1">
            <div className={`w-1.5 h-1.5 rounded-full ${a.done ? 'bg-green-400' : a.color === 'text-blue-400' ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-[8px] font-medium ${a.color}`}>{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slides data ────────────────────────────────────────────────────
const SLIDES = [
  {
    tag: 'לוח בקרה',
    title: 'כל המרפאה\u00A0— במסך אחד',
    desc: 'KPIs בזמן אמת, לוח תורים, הכנסות ומטופלים. הכל בדאשבורד נקי ומהיר.',
    ui: <DashboardMock />,
  },
  {
    tag: 'ייעוץ וידאו',
    title: 'שיחת וידאו HD\u00A0— מובנית',
    desc: 'SOAP notes בצד, מסמכי מטופל גלויים, סיכום AI אוטומטי בסוף כל שיחה.',
    ui: <VideoMock />,
  },
  {
    tag: 'White Label',
    title: 'המרפאה שלך\u00A0— הזהות שלך',
    desc: 'לוגו, צבעים ו-subdomain ייחודיים. המטופלים רואים רק את המרפאה שלך.',
    ui: <BrandingMock />,
  },
  {
    tag: 'בינה מלאכותית',
    title: 'AI שחוסך שעות\u00A0של תיעוד',
    desc: 'מיון אוטומטי לפני הייעוץ, SOAP notes נכתבים לבד, טיוטת מרשם מוכנה.',
    ui: <AIMock />,
  },
]

export default function HeroCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => setActive(p => (p + 1) % SLIDES.length), [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(next, 4500)
    return () => clearInterval(id)
  }, [next, paused])

  return (
    <div className="relative w-full max-w-6xl mx-auto mt-16 px-6" dir="rtl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

        {/* ── Left: text content ── */}
        <div className="space-y-6 order-2 lg:order-1">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.tag}
                onClick={() => { setActive(i); setPaused(true) }}
                className={cn(
                  'text-xs font-bold px-3 py-1.5 rounded-full border transition-all',
                  active === i
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                    : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white bg-white/3'
                )}
              >
                {s.tag}
              </button>
            ))}
          </div>

          {/* Animated text */}
          <div className="min-h-[120px]">
            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
              {SLIDES[active].title}
            </h3>
            <p className="text-slate-400 mt-4 text-base leading-relaxed">
              {SLIDES[active].desc}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => { setActive(i); setPaused(true) }}
                className={cn(
                  'rounded-full transition-all',
                  active === i ? 'w-6 h-2 bg-blue-500' : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                )}
                aria-label={`שקופית ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ── Right: UI mock ── */}
        <div
          className="h-64 sm:h-72 lg:h-80 order-1 lg:order-2 relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Glow behind */}
          <div className="absolute inset-0 bg-blue-600/10 rounded-2xl blur-2xl scale-105" />
          <div className="relative h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10">
            {SLIDES.map((s, i) => (
              <div
                key={i}
                className={cn(
                  'absolute inset-0 transition-opacity duration-500',
                  active === i ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
              >
                {s.ui}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
