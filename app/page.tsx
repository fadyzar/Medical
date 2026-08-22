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
    gradient: ['#0c4a6e', '#0e7490', '#0f766e'] as const,
  },
  {
    tag: 'בינה מלאכותית',
    title: 'AI שמכין את הרופא לפגישה',
    body: 'לפני כל ייעוץ — AI מנתח את התלונה, בודק היסטוריה רפואית ומדרג דחיפות. אחרי — מייצר סיכום SOAP מלא.',
    icon: 'ai' as const,
    gradient: ['#1e3a8a', '#4338ca', '#0e7490'] as const,
  },
  {
    tag: 'אבטחה',
    title: 'הפרטיות שלך — קו אדום',
    body: 'הצפנה מקצה לקצה, תקן HIPAA, audit log מלא. המסמכים שלך נגישים רק לך ולרופא המטפל.',
    icon: 'shield' as const,
    gradient: ['#065f46', '#0d9488', '#0369a1'] as const,
  },
]

// ── Branded feature visual — gradient panel + medical icon (no stock photos) ──
function FeatureIcon({ name }: { name: 'video' | 'ai' | 'shield' }) {
  const common = { width: 96, height: 96, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'video') return (<svg {...common}><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>)
  if (name === 'ai') return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>)
  return (<svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>)
}

function FeatureVisual({ icon, gradient, side }: { icon: 'video' | 'ai' | 'shield'; gradient: readonly [string, string, string]; side: number }) {
  return (
    <div className="relative">
      <div className="rounded-3xl overflow-hidden shadow-2xl shadow-slate-200 aspect-[4/3] relative flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 55%, ${gradient[2]} 100%)` }}>
        {/* grid + glow motif */}
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 60% at 70% 25%, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
        <div className="relative w-28 h-28 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center shadow-lg">
          <FeatureIcon name={icon} />
        </div>
      </div>
      <div className={`absolute -z-10 w-48 h-48 opacity-30 ${side % 2 === 0 ? '-bottom-6 -left-6' : '-bottom-6 -right-6'}`}
        style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
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

          {/* Consultation card — clean, no stock photo */}
          <div className="order-1 lg:order-2 relative">
            <div className="relative mx-auto max-w-md rounded-3xl bg-white border border-slate-100 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.25)] p-5">
              {/* Video panel */}
              <div className="rounded-2xl aspect-video relative overflow-hidden flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2FA9A2 0%, #157F73 100%)' }}>
                <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <div className="relative w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                </div>
                <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-white/90 text-teal-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> וידאו HD
                </span>
              </div>
              {/* Doctor row */}
              <div className="flex items-center gap-3 mt-4">
                <div className="w-11 h-11 rounded-xl text-white font-bold flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #2FA9A2, #157F73)' }}>ד״ר</div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm">רופא/ה מומחה/ית</p>
                  <p className="text-xs text-slate-400">ייעוץ בוידאו · מרשם דיגיטלי</p>
                </div>
                <span className="mr-auto text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">מחובר</span>
              </div>
              {/* AI summary chip */}
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                <span className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-violet-600 shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">סיכום AI נשלח</p>
                  <p className="text-xs text-slate-400">סיכום SOAP מלא לאחר הייעוץ</p>
                </div>
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

            {/* Visual side — branded gradient, no stock photo */}
            <div className={i % 2 === 1 ? 'order-2 lg:order-1' : 'order-2'}>
              <FeatureVisual icon={f.icon} gradient={f.gradient} side={i} />
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
