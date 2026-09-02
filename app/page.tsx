import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/layout/PublicNav'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'

export const metadata: Metadata = {
  title: { absolute: 'CANNA — ייעוץ רפואי אונליין | הפלטפורמה המובילה בישראל' },
  description: 'ייעוץ רפואי אונליין בוידאו עם רופאים מומחים. סיכומי AI חכמים, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה הרפואית המתקדמת בישראל.',
  keywords: ['CANNA', 'ייעוץ רפואי אונליין', 'רופא אונליין', 'SaaS רפואי'],
  openGraph: {
    title: 'CANNA — ייעוץ רפואי אונליין',
    description: 'ייעוץ רפואי בוידאו עם רופאים מומחים.',
    type: 'website',
    locale: 'he_IL',
    url: BASE_URL,
  },
  alternates: { canonical: BASE_URL },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CANNA',
  url: BASE_URL,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  description: 'פלטפורמת ייעוץ רפואי אונליין — וידאו HD, סוכני AI, שאלונים דינמיים, תשלומים מאובטחים.',
}

// ── Features ──────────────────────────────────────────────────────────────
const features = [
  {
    tag: 'וידאו HD',
    title: 'ייעוץ כמו בקליניקה, מהסלון',
    body: 'שיחת וידאו באיכות גבוהה עם הרופא שלך. אין תור, אין נסיעה — ייעוץ בתוך דקות.',
    icon: 'video' as const,
  },
  {
    tag: 'בינה מלאכותית',
    title: 'AI שמכין את הרופא לפגישה',
    body: 'לפני כל ייעוץ — AI מנתח את התלונה, בודק היסטוריה רפואית ומדרג דחיפות. אחרי — מייצר סיכום SOAP מלא.',
    icon: 'ai' as const,
  },
  {
    tag: 'אבטחה',
    title: 'הפרטיות שלך — קו אדום',
    body: 'הצפנה מקצה לקצה, תקן HIPAA, audit log מלא. המסמכים שלך נגישים רק לך ולרופא המטפל.',
    icon: 'shield' as const,
  },
]

// ── Illustrated avatars (flat, on-brand — no stock photos) ─────────────────
function DoctorPortrait({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden>
      <path d="M18 300 C18 208 70 188 120 188 C170 188 222 208 222 300 Z" fill="#ffffff" />
      <path d="M96 190 L120 222 L144 190 L135 300 L105 300 Z" fill="#2FA9A2" />
      <path d="M104 162 L104 196 Q120 206 136 196 L136 162 Z" fill="#e7ab7f" />
      <ellipse cx="120" cy="118" rx="42" ry="46" fill="#f2c19c" />
      <circle cx="80" cy="120" r="8" fill="#f2c19c" />
      <circle cx="160" cy="120" r="8" fill="#f2c19c" />
      <path d="M78 116 C74 68 100 58 120 58 C140 58 166 68 162 116 C160 94 150 86 120 86 C90 86 80 94 78 116 Z" fill="#5b3f2e" />
      <circle cx="105" cy="118" r="4" fill="#3b2b22" />
      <circle cx="135" cy="118" r="4" fill="#3b2b22" />
      <path d="M108 138 Q120 149 132 138" stroke="#b5765a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M105 197 C101 240 97 250 97 250" stroke="#334155" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M135 197 C139 238 150 248 150 248" stroke="#334155" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="150" cy="253" r="9" fill="#cbd5e1" stroke="#334155" strokeWidth="3" />
    </svg>
  )
}

function PatientPortrait({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 150" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden>
      <rect width="120" height="150" fill="#e2e8f0" />
      <path d="M14 150 C14 108 34 96 60 96 C86 96 106 108 106 150 Z" fill="#94a3b8" />
      <circle cx="60" cy="66" r="26" fill="#cbd5e1" />
      <path d="M36 64 C34 38 48 30 60 30 C72 30 86 38 84 64 C82 50 74 46 60 46 C46 46 38 50 36 64 Z" fill="#64748b" />
    </svg>
  )
}

// ── Realistic live video-call mockup (reused in hero + feature) ────────────
function VideoCallMock() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-[20px]" style={{ background: 'linear-gradient(160deg,#0f766e 0%,#157F73 45%,#0c4a6e 100%)' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(75% 55% at 50% 22%, rgba(255,255,255,0.20), transparent 70%)' }} />
      <DoctorPortrait className="absolute inset-x-0 bottom-0 w-full h-full" />
      {/* top bar */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 bg-black/25 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> LIVE
        </span>
        <span className="bg-black/25 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full tabular-nums">12:47</span>
      </div>
      {/* doctor name tag */}
      <div className="absolute bottom-16 right-3 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-xl">
        <p className="text-white text-[13px] font-bold leading-none">ד״ר רונית לוי</p>
        <p className="text-white/70 text-[10px] mt-1">מומחית עור ומין</p>
      </div>
      {/* patient self-view */}
      <div className="absolute bottom-16 left-3 w-16 aspect-[4/5] rounded-lg overflow-hidden border-2 border-white/40 shadow-md">
        <PatientPortrait className="w-full h-full" />
      </div>
      {/* call controls */}
      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4" /></svg>
        </span>
        <span className="w-9 h-9 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
        </span>
        <span className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center shadow rotate-[135deg]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z" /></svg>
        </span>
      </div>
    </div>
  )
}

// ── AI SOAP-summary mockup ─────────────────────────────────────────────────
function AiMock() {
  const rows = [
    { k: 'S', t: 'כאב גרון 3 ימים, חום 37.8°', w: 'w-[85%]' },
    { k: 'O', t: 'לוע אדום, בלוטות מוגדלות', w: 'w-[68%]' },
    { k: 'A', t: 'חשד לדלקת גרון חיידקית', w: 'w-[78%]' },
    { k: 'P', t: 'אנטיביוטיקה + מעקב 48ש׳', w: 'w-[60%]' },
  ]
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-5.8 2.1L12 18l-2.1-5.9L4 10l5.9-1.2L12 3z" /></svg>
          </span>
          <p className="font-bold text-slate-800 text-sm">סיכום SOAP</p>
        </div>
        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full">AI</span>
      </div>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.k} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-md bg-teal-50 text-teal-700 text-xs font-black flex items-center justify-center shrink-0">{r.k}</span>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[13px] text-slate-700 leading-snug">{r.t}</p>
              <div className={`h-1.5 rounded-full bg-slate-100 mt-2 ${r.w}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-teal-700 bg-teal-50 rounded-xl px-3 py-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        <span className="text-xs font-bold">נשלח למטופל ולתיק הרפואי</span>
      </div>
    </div>
  )
}

// ── Security / privacy mockup ──────────────────────────────────────────────
function ShieldMock() {
  const items = [
    { t: 'הצפנה מקצה לקצה', s: 'AES-256' },
    { t: 'תקן HIPAA', s: 'תואם' },
    { t: 'Audit log מלא', s: 'פעיל' },
  ]
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#0d9488,#0369a1)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
        </span>
        <div>
          <p className="font-bold text-slate-800 text-sm">אבטחת מידע רפואי</p>
          <p className="text-xs text-slate-400">הנתונים שלך מוגנים 24/7</p>
        </div>
        <span className="mr-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">מאובטח</span>
      </div>
      <div className="space-y-2.5">
        {items.map(it => (
          <div key={it.t} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <p className="text-[13px] font-medium text-slate-700 flex-1">{it.t}</p>
            <span className="text-[11px] font-semibold text-slate-400">{it.s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureVisual({ icon }: { icon: 'video' | 'ai' | 'shield' }) {
  return (
    <div className="rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-200/70 border border-slate-100"
      style={{ background: icon === 'ai' ? 'linear-gradient(135deg,#eef2ff,#faf5ff)' : icon === 'shield' ? 'linear-gradient(135deg,#ecfdf5,#f0fdfa)' : 'linear-gradient(135deg,#f0fdfa,#ecfeff)' }}>
      {icon === 'video' && <div className="max-w-[15rem] mx-auto aspect-[4/5]"><VideoCallMock /></div>}
      {icon === 'ai' && <AiMock />}
      {icon === 'shield' && <ShieldMock />}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Navbar (shared) ────────────────────────────────────────────── */}
      <PublicNav active="home" />

      {/* ── Hero — bright CANNA layout ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#F7F9FA]">
        {/* Soft pale-teal decorative accents */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-teal-100/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 w-80 h-80 rounded-full bg-emerald-100/40 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text side */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold tracking-wide uppercase px-4 py-2 rounded-full mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              הפלטפורמה הרפואית המתקדמת בישראל
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight" style={{ color: '#18232F' }}>
              רופא מומחה
              <br />
              <span className="text-teal-600">בלחיצה אחת.</span>
            </h1>

            <p className="text-lg text-slate-500 mt-6 leading-relaxed max-w-lg">
              ייעוץ רפואי בוידאו תוך דקות. AI מתקדם שמכין את הרופא לפגישה ומייצר סיכום מלא אחרי כל ייעוץ.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-lg shadow-teal-600/25 hover:-translate-y-0.5"
              >
                קבל ייעוץ עכשיו — חינם
              </Link>
              <Link
                href="/doctors"
                className="inline-flex items-center justify-center border border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-semibold text-base px-8 py-4 rounded-2xl transition-all"
              >
                הכר את הרופאים
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-9">
              {['ללא תור מוקדם', 'סיכום AI מידי', 'מאובטח HIPAA', 'זמינות 24/7'].map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                  <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Consultation mockup — realistic live video call */}
          <div className="order-1 lg:order-2 relative">
            {/* floating wait-time stat */}
            <div className="absolute -top-4 -left-3 z-20 hidden sm:flex items-center gap-2.5 bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 px-4 py-3">
              <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </span>
              <div>
                <p className="text-sm font-black text-slate-900 leading-none">2:14 דק׳</p>
                <p className="text-[11px] text-slate-400 mt-1">זמן המתנה ממוצע</p>
              </div>
            </div>

            <div className="relative mx-auto max-w-sm rounded-[28px] bg-white border border-slate-100 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] p-3">
              <div className="aspect-[4/5]">
                <VideoCallMock />
              </div>
              {/* AI summary chip */}
              <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                <span className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-violet-600 shrink-0">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-5.8 2.1L12 18l-2.1-5.9L4 10l5.9-1.2L12 3z" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">סיכום AI נשלח</p>
                  <p className="text-xs text-slate-400">סיכום SOAP מלא נשלח למטופל</p>
                </div>
                <span className="text-teal-600 shrink-0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature sections ────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-4">
        {features.map((f, i) => (
          <div
            key={f.tag}
            className={`max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
          >
            {/* Text side */}
            <div className={i % 2 === 1 ? 'order-1 lg:order-2' : 'order-1'}>
              <span className="inline-block bg-teal-100 text-teal-700 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5">
                {f.tag}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                {f.title}
              </h2>
              <p className="text-slate-500 mt-5 text-lg leading-relaxed">{f.body}</p>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 mt-8 text-teal-600 font-semibold hover:gap-3 transition-all group"
              >
                התחל עכשיו
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-[-3px] transition-transform">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
              </Link>
            </div>

            {/* Visual side — realistic product mockup, no stock photo */}
            <div className={i % 2 === 1 ? 'order-2 lg:order-1' : 'order-2'}>
              <FeatureVisual icon={f.icon} />
            </div>
          </div>
        ))}
      </section>

      {/* ── Specialties pill cloud ──────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-teal-600 mb-4">התמחויות</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            רופאים מומחים בכל תחום
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {['רפואה כללית','עור ומין','אורתופדיה','קרדיולוגיה','א.א.ג','נוירולוגיה','גסטרו','גינקולוגיה','פסיכיאטריה','ילדים','ריאות','אורולוגיה','עיניים','רפואת כאב'].map(s => (
              <Link
                key={s}
                href={`/specialties/${encodeURIComponent(s)}`}
                className="bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-medium text-sm px-5 py-2.5 rounded-full border border-transparent hover:border-teal-200 transition-all"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works — visual timeline ─────────────────────────────── */}
      <section className="py-24 px-6 bg-[#F7F9FA]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-teal-600 mb-4">תהליך</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: '#18232F' }}>מהרשמה לייעוץ — ארבעה שלבים</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: '01', title: 'נרשם בחינם', desc: 'הרשמה בדקה אחת עם אימייל בלבד.' },
              { n: '02', title: 'בוחר רופא', desc: 'עיין בפרופילי רופאים לפי התמחות ודירוג.' },
              { n: '03', title: 'ממלא שאלון', desc: 'שאלון AI קצר שמכין את הרופא מראש.' },
              { n: '04', title: 'נכנס לייעוץ', desc: 'וידאו HD + סיכום מלא אחרי הפגישה.' },
            ].map((s, i) => (
              <div key={s.n} className="relative group">
                {/* Connector */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-7 left-0 w-full h-px bg-slate-200 -z-10" />
                )}
                <div className="bg-white border border-slate-100 hover:border-teal-200 hover:shadow-md rounded-2xl p-6 transition-all">
                  <span className="text-4xl font-black text-teal-100 group-hover:text-teal-300 transition-colors">{s.n}</span>
                  <h3 className="text-slate-900 font-bold mt-3">{s.title}</h3>
                  <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Clinic strip — teal band ─────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto rounded-3xl px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #2FA9A2 0%, #157F73 100%)' }}>
          <div aria-hidden className="pointer-events-none absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative">
            <p className="text-white font-bold text-lg">בעל מרפאה?</p>
            <p className="text-white/80 text-sm mt-1">הקם קליניקה דיגיטלית תוך 24 שעות — White Label, AI, וידאו, תשלומים.</p>
          </div>
          <Link
            href="/for-clinics"
            className="relative shrink-0 inline-flex items-center gap-2 bg-white text-teal-700 font-bold px-6 py-3 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 text-sm"
          >
            גלה עוד
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1"/>
                    <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/>
                  </svg>
                </span>
                <span className="text-white font-bold text-lg">CANNA</span>
              </Link>
              <p className="text-slate-500 leading-relaxed text-sm">פלטפורמת ייעוץ רפואי אונליין מתקדמת לישראל.</p>
            </div>
            <div>
              <p className="text-white font-bold mb-4">שירותים</p>
              <nav className="space-y-3 text-slate-500">
                <p><Link href="/doctors" className="hover:text-white transition-colors">רופאים</Link></p>
                <p><Link href="/specialties" className="hover:text-white transition-colors">התמחויות</Link></p>
                <p><Link href="/auth/register" className="hover:text-white transition-colors">הרשמה</Link></p>
              </nav>
            </div>
            <div>
              <p className="text-white font-bold mb-4">למרפאות</p>
              <nav className="space-y-3 text-slate-500">
                <p><Link href="/onboarding" className="hover:text-white transition-colors">SaaS מותאם אישית</Link></p>
                <p><Link href="/onboarding" className="hover:text-white transition-colors">ניסיון חינם</Link></p>
              </nav>
            </div>
            <div>
              <p className="text-white font-bold mb-4">משפטי</p>
              <nav className="space-y-3 text-slate-500">
                <p><Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link></p>
                <p><Link href="/privacy" className="hover:text-white transition-colors">מדיניות פרטיות</Link></p>
                <p><Link href="/accessibility" className="hover:text-white transition-colors">נגישות</Link></p>
              </nav>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
            <p>&copy; {new Date().getFullYear()} CANNA. כל הזכויות שמורות.</p>
            <p>CANNA For You — ייעוץ רפואי אונליין</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
