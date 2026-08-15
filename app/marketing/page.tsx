import type { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'

export const metadata: Metadata = {
  title: { absolute: 'CANNA — ייעוץ רפואי אונליין | הפלטפורמה המובילה' },
  description: 'ייעוץ רפואי אונליין בוידאו עם רופאים מומחים. סיכומי AI חכמים, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה הרפואית המתקדמת בישראל.',
  keywords: ['CANNA', 'ייעוץ רפואי אונליין', 'רופא אונליין', 'SaaS רפואי', 'פלטפורמה רפואית'],
  openGraph: {
    title: 'CANNA — ייעוץ רפואי אונליין | הפלטפורמה המובילה',
    description: 'ייעוץ רפואי בוידאו עם רופאים מומחים. AI, שאלונים, תשלומים מאובטחים.',
    type: 'website',
    locale: 'he_IL',
    url: `${BASE_URL}/marketing`,
  },
  alternates: { canonical: `${BASE_URL}/marketing` },
}

// ── Inline SVGs ───────────────────────────────────────────────────────

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function CheckCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600 shrink-0 mt-0.5">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────────

const features = [
  {
    label: 'ייעוץ וידאו HD',
    heading: 'שיחה עם הרופא — בלי לצאת מהבית',
    body: 'ייעוץ בשיחת וידאו באיכות גבוהה עם רופאים מומחים. אין תור, אין המתנה — זמינות 24/7 מכל מכשיר.',
    bullets: ['חיבור מאובטח מקצה לקצה', 'תמיכה בכל המכשירים', 'חדר המתנה דיגיטלי'],
    icon: 'video' as const,
    gradient: ['#0c4a6e', '#0e7490', '#0f766e'] as const,
    reverse: false,
  },
  {
    label: 'בינה מלאכותית',
    heading: 'AI שעובד בשבילך',
    body: 'ארבעה סוכני AI מתקדמים מסייעים לרופא: מיון דחיפות, סיכום SOAP, טיוטת מרשם ושאלון קליטה דינמי.',
    bullets: ['סיכום אוטומטי לאחר כל ייעוץ', 'מיון חכם לפי דחיפות', 'טיוטת מרשם לרופא'],
    icon: 'ai' as const,
    gradient: ['#1e3a8a', '#4338ca', '#0e7490'] as const,
    reverse: true,
  },
  {
    label: 'מסמכים ואבטחה',
    heading: 'כל המידע שלך — מוגן ומסודר',
    body: 'העלה תוצאות בדיקות, תמונות ומסמכים רפואיים. מוצפן, פרטי, ועומד בתקן HIPAA.',
    bullets: ['הצפנה מלאה בענן', 'גישה רק לצוות הרפואי', 'Audit log מלא'],
    icon: 'shield' as const,
    gradient: ['#065f46', '#0d9488', '#0369a1'] as const,
    reverse: false,
  },
]

// ── Branded feature visual — gradient panel + icon (no stock photos) ──
function FeatureIcon({ name }: { name: 'video' | 'ai' | 'shield' }) {
  const c = { width: 104, height: 104, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'video') return (<svg {...c}><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>)
  if (name === 'ai') return (<svg {...c}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>)
  return (<svg {...c}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>)
}

function FeatureVisual({ icon, gradient, aspect = 'aspect-video' }: { icon: 'video' | 'ai' | 'shield'; gradient: readonly [string, string, string]; aspect?: string }) {
  return (
    <div className={`rounded-3xl overflow-hidden ${aspect} shadow-xl shadow-slate-200 relative flex items-center justify-center`}
      style={{ background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 55%, ${gradient[2]} 100%)` }}>
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 60% at 70% 25%, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
      <div className="relative w-28 h-28 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center shadow-lg">
        <FeatureIcon name={icon} />
      </div>
    </div>
  )
}

const steps = [
  { n: '01', title: 'נרשם בחינם', desc: 'יצירת חשבון תוך דקה עם האימייל שלך.' },
  { n: '02', title: 'בוחר רופא', desc: 'בחר התמחות, קרא פרופיל רופאים וקבע תור.' },
  { n: '03', title: 'ממלא שאלון', desc: 'שאלון קצר שמכין את הרופא לפגישה.' },
  { n: '04', title: 'נכנס לייעוץ', desc: 'שיחת וידאו עם הרופא, סיכום AI באותו יום.' },
]


const specialties = [
  'רפואה כללית', 'עור ומין', 'אורתופדיה', 'קרדיולוגיה',
  'א.א.ג', 'נוירולוגיה', 'גסטרו', 'גינקולוגיה',
  'פסיכיאטריה', 'ילדים', 'ריאות', 'אורולוגיה',
]

// ── Page ──────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'CANNA',
    url: `${BASE_URL}/marketing`,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    description: 'פלטפורמת ייעוץ רפואי אונליין — וידאו HD, סוכני AI, שאלונים דינמיים, תשלומים מאובטחים.',
  }

  return (
    <div className="min-h-screen bg-white text-slate-900" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/canna-mark.png" alt="CANNA" className="w-9 h-9 object-contain shrink-0" />
            <span className="text-xl font-bold tracking-tight">CANNA</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600 font-medium">
            <Link href="/doctors" className="hover:text-slate-900 transition-colors">רופאים</Link>
            <Link href="/specialties" className="hover:text-slate-900 transition-colors">התמחויות</Link>
            <Link href="/onboarding" className="hover:text-slate-900 transition-colors">למרפאות</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2">
              כניסה
            </Link>
            <Link href="/auth/register" className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-700 transition-colors">
              הרשמה חינם
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="pt-[68px]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center py-20 lg:py-28">

          {/* Text */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-teal-600 rounded-full" />
              הפלטפורמה הרפואית המתקדמת בישראל
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-slate-900">
              רופא מומחה,
              <br />
              <span className="text-teal-600">מכל מקום.</span>
            </h1>

            <p className="text-lg text-slate-500 mt-6 leading-relaxed max-w-xl">
              ייעוץ רפואי בוידאו תוך דקות, ללא תור. סוכני AI מתקדמים מכינים סיכום מלא לאחר כל פגישה.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white text-base font-bold px-7 py-4 rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 hover:shadow-xl hover:shadow-teal-600/25"
              >
                קבע ייעוץ עכשיו — חינם
              </Link>
              <Link
                href="/doctors"
                className="inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700 text-base font-semibold px-7 py-4 rounded-xl hover:bg-slate-50 transition-colors"
              >
                הכר את הרופאים
                <ArrowLeft />
              </Link>
            </div>

            {/* Micro-trust */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle />
                ללא צורך בביטוח
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle />
                סיכום ביקור באותו יום
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle />
                מאובטח HIPAA
              </span>
            </div>
          </div>

          {/* Hero Visual — branded gradient, no stock photo */}
          <div className="order-1 lg:order-2 relative">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-2xl shadow-slate-200 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0e7490 55%, #0f766e 100%)' }}>
              <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 60% at 70% 25%, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
              <div className="relative w-32 h-32 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <FeatureIcon name="video" />
              </div>
              {/* Overlay card */}
              <div className="absolute bottom-5 right-5 bg-white rounded-2xl shadow-xl px-5 py-4 flex items-center gap-4 max-w-[220px]">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">הייעוץ הסתיים</p>
                  <p className="text-sm font-bold text-slate-900">סיכום AI נשלח</p>
                </div>
              </div>
            </div>

            {/* Floating badge — capability, not a fabricated metric */}
            <div className="absolute -top-4 -left-4 bg-teal-600 text-white rounded-2xl px-5 py-3 shadow-lg shadow-teal-600/30">
              <p className="text-lg font-black">וידאו HD</p>
              <p className="text-xs text-teal-200 mt-0.5">מוצפן מקצה לקצה</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities bar (factual — no fabricated metrics) ──── */}
      <div className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 text-center">
          {[
            { v: 'מערכת תורים', l: 'קביעה ואישור אונליין' },
            { v: 'שיחות וידאו', l: 'מוצפנות מקצה לקצה' },
            { v: 'סיכומי AI', l: 'SOAP אוטומטי' },
            { v: 'תזכורות', l: 'אימייל ו-WhatsApp' },
            { v: 'ניהול מסמכים', l: 'מאובטח ומסודר' },
            { v: 'הפרדת מרפאות', l: 'בידוד מלא לכל מרפאה' },
          ].map(s => (
            <div key={s.v}>
              <p className="text-base lg:text-lg font-black text-slate-900 leading-tight">{s.v}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features — alternating image/text ─────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-7xl mx-auto space-y-28">
          {features.map((f) => (
            <div
              key={f.label}
              className={`grid lg:grid-cols-2 gap-16 items-center ${f.reverse ? 'direction-ltr' : ''}`}
            >
              {/* Text */}
              <div className={f.reverse ? 'order-1 lg:order-2' : ''}>
                <span className="text-xs font-bold tracking-widest uppercase text-teal-600">{f.label}</span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3 leading-tight text-slate-900">
                  {f.heading}
                </h2>
                <p className="text-slate-500 mt-4 text-lg leading-relaxed">{f.body}</p>
                <ul className="mt-6 space-y-3">
                  {f.bullets.map(b => (
                    <li key={b} className="flex items-start gap-3 text-slate-700 font-medium">
                      <CheckCircle />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 text-teal-600 font-semibold mt-8 hover:gap-3 transition-all"
                >
                  התחל עכשיו
                  <ArrowLeft />
                </Link>
              </div>

              {/* Visual — branded gradient, no stock photo */}
              <div className={f.reverse ? 'order-2 lg:order-1' : ''}>
                <FeatureVisual icon={f.icon} gradient={f.gradient} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Specialties ────────────────────────────────────────── */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold tracking-widest uppercase text-teal-600">התמחויות</span>
          <h2 className="text-3xl sm:text-4xl font-black mt-3 text-slate-900">רופאים מומחים בכל תחום</h2>
          <p className="text-slate-500 mt-3 text-lg">פנל רחב של רופאים בכל התמחות רפואית</p>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {specialties.map(s => (
              <Link
                key={s}
                href={`/specialties/${s}`}
                className="bg-white border border-slate-200 text-slate-700 text-sm font-medium px-5 py-2.5 rounded-full hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-all shadow-sm"
              >
                {s}
              </Link>
            ))}
          </div>
          <Link href="/specialties" className="inline-flex items-center gap-2 text-teal-600 font-semibold text-sm mt-8 hover:gap-3 transition-all">
            כל ההתמחויות
            <ArrowLeft />
          </Link>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-teal-600">תהליך</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 text-slate-900">ארבעה שלבים פשוטים</h2>
            <p className="text-slate-500 mt-3 text-lg">מהרשמה לייעוץ — הכל תוך דקות ספורות</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 left-0 w-full h-px bg-slate-200 -z-10" />
                )}
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white text-sm font-black flex items-center justify-center shadow-lg shadow-teal-600/20">
                  {s.n}
                </div>
                <h3 className="font-bold text-slate-900 mt-5">{s.title}</h3>
                <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── For Clinics CTA ────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl overflow-hidden grid lg:grid-cols-2 items-stretch min-h-[360px] relative" style={{ background: 'linear-gradient(135deg, #2FA9A2 0%, #157F73 100%)' }}>
            {/* Text */}
            <div className="p-12 lg:p-16 flex flex-col justify-center relative">
              <span className="text-xs font-bold tracking-widest uppercase text-teal-100 mb-4">SaaS למרפאות</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                הקם את הקליניקה
                <br />
                הדיגיטלית שלך
              </h2>
              <p className="text-white/80 mt-4 text-lg leading-relaxed max-w-md">
                מיתוג אישי, מנוי חודשי גמיש, ממשק ניהול מלא. כולל AI, וידאו, שאלונים ותשלומים — מוכן מהיום הראשון.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center gap-2 bg-white text-teal-700 font-bold px-7 py-4 rounded-xl hover:-translate-y-0.5 transition-all shadow-lg"
                >
                  ניסיון חינם — 14 ימים
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 border border-white/40 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/10 transition-colors"
                >
                  יש לי חשבון
                </Link>
              </div>
            </div>
            {/* Visual side — subtle grid motif */}
            <div className="hidden lg:block relative">
              <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 70% at 70% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-md bg-teal-600 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1"/>
                    <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/>
                  </svg>
                </div>
                <span className="text-white font-bold text-lg">CANNA</span>
              </div>
              <p className="leading-relaxed text-slate-500">פלטפורמת ייעוץ רפואי אונליין מתקדמת לישראל.</p>
            </div>

            <div>
              <h5 className="text-white font-bold mb-4 text-sm">שירותים</h5>
              <nav className="space-y-2.5 text-slate-500 text-sm">
                <p><Link href="/doctors" className="hover:text-white transition-colors">רופאים</Link></p>
                <p><Link href="/specialties" className="hover:text-white transition-colors">התמחויות</Link></p>
                <p><Link href="/auth/register" className="hover:text-white transition-colors">הרשמה</Link></p>
              </nav>
            </div>

            <div>
              <h5 className="text-white font-bold mb-4 text-sm">למרפאות</h5>
              <nav className="space-y-2.5 text-slate-500 text-sm">
                <p><Link href="/onboarding" className="hover:text-white transition-colors">SaaS מותאם אישית</Link></p>
                <p><Link href="/onboarding" className="hover:text-white transition-colors">ניסיון חינם</Link></p>
              </nav>
            </div>

            <div>
              <h5 className="text-white font-bold mb-4 text-sm">משפטי</h5>
              <nav className="space-y-2.5 text-slate-500 text-sm">
                <p><Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link></p>
                <p><Link href="/privacy" className="hover:text-white transition-colors">מדיניות פרטיות</Link></p>
                <p><Link href="/accessibility" className="hover:text-white transition-colors">נגישות</Link></p>
              </nav>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
            <p>&copy; {new Date().getFullYear()} CANNA. כל הזכויות שמורות.</p>
            <p>CANNA For You — ייעוץ רפואי אונליין</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
