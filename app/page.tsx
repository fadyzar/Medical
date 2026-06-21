import type { Metadata } from 'next'
import Link from 'next/link'
import HeroCarousel from '@/components/ui/HeroCarousel'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'

export const metadata: Metadata = {
  title: { absolute: 'CANNA — ייעוץ רפואי אונליין | הפלטפורמה המובילה בישראל' },
  description: 'ייעוץ רפואי אונליין בוידאו עם רופאים מומחים. סיכומי AI חכמים, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה הרפואית המתקדמת בישראל.',
  keywords: ['CANNA', 'ייעוץ רפואי אונליין', 'telemedicine', 'רופא אונליין', 'SaaS רפואי'],
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
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=700&q=80',
    imgAlt: 'רופא בשיחת וידאו',
  },
  {
    tag: 'בינה מלאכותית',
    title: 'AI שמכין את הרופא לפגישה',
    body: 'לפני כל ייעוץ — AI מנתח את התלונה, בודק היסטוריה רפואית ומדרג דחיפות. אחרי — מייצר סיכום SOAP מלא.',
    img: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=700&q=80',
    imgAlt: 'בינה מלאכותית רפואית',
  },
  {
    tag: 'אבטחה',
    title: 'הפרטיות שלך — קו אדום',
    body: 'הצפנה מקצה לקצה, תקן HIPAA, audit log מלא. המסמכים שלך נגישים רק לך ולרופא המטפל.',
    img: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=700&q=80',
    imgAlt: 'אבטחת מידע רפואי',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="mt-4 flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm px-5 h-14">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900">
              <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1"/>
                  <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/>
                </svg>
              </span>
              CANNA
            </Link>
            <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
              <Link href="/doctors" className="hover:text-slate-900 transition-colors">רופאים</Link>
              <Link href="/specialties" className="hover:text-slate-900 transition-colors">התמחויות</Link>
              <Link href="/for-clinics" className="hover:text-slate-900 transition-colors">למרפאות</Link>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors">
                כניסה
              </Link>
              <Link href="/auth/register" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm shadow-blue-600/20">
                התחל עכשיו
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Hero — carousel with overlay ───────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Carousel images */}
        <HeroCarousel />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-900/80 to-slate-900/40 z-10" />

        {/* Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-6 py-32 w-full">
          <div className="max-w-2xl mr-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/90 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              הפלטפורמה הרפואית המתקדמת בישראל
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight">
              רופא מומחה
              <br />
              <span className="text-blue-400">בלחיצה אחת.</span>
            </h1>

            <p className="text-lg text-white/70 mt-6 leading-relaxed max-w-lg">
              ייעוץ רפואי בוידאו תוך דקות. AI מתקדם שמכין את הרופא לפגישה ומייצר סיכום מלא אחרי כל ייעוץ.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                קבל ייעוץ עכשיו — חינם
              </Link>
              <Link
                href="/doctors"
                className="inline-flex items-center justify-center border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all backdrop-blur-sm"
              >
                הכר את הרופאים
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-10">
              {['✓ ללא תור מוקדם', '✓ סיכום AI מידי', '✓ מאובטח HIPAA', '✓ זמינות 24/7'].map(t => (
                <span key={t} className="text-sm text-white/60 font-medium">{t}</span>
              ))}
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
              <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5">
                {f.tag}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                {f.title}
              </h2>
              <p className="text-slate-500 mt-5 text-lg leading-relaxed">{f.body}</p>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 mt-8 text-blue-600 font-semibold hover:gap-3 transition-all group"
              >
                התחל עכשיו
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-[-3px] transition-transform">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
              </Link>
            </div>

            {/* Image side */}
            <div className={i % 2 === 1 ? 'order-2 lg:order-1' : 'order-2'}>
              <div className="relative">
                <div className="rounded-3xl overflow-hidden shadow-2xl shadow-slate-200 aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.img}
                    alt={f.imgAlt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Decorative dot grid */}
                <div
                  className={`absolute -z-10 w-48 h-48 opacity-30 ${i % 2 === 0 ? '-bottom-6 -left-6' : '-bottom-6 -right-6'}`}
                  style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Specialties pill cloud ──────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-4">התמחויות</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            רופאים מומחים בכל תחום
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {['רפואה כללית','עור ומין','אורתופדיה','קרדיולוגיה','א.א.ג','נוירולוגיה','גסטרו','גינקולוגיה','פסיכיאטריה','ילדים','ריאות','אורולוגיה','עיניים','רפואת כאב'].map(s => (
              <Link
                key={s}
                href={`/specialties/${encodeURIComponent(s)}`}
                className="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium text-sm px-5 py-2.5 rounded-full border border-transparent hover:border-blue-200 transition-all"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works — visual timeline ─────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">תהליך</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">מהרשמה לייעוץ — ארבעה שלבים</h2>
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
                  <div className="hidden lg:block absolute top-7 left-0 w-full h-px bg-white/10 -z-10" />
                )}
                <div className="bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all">
                  <span className="text-4xl font-black text-white/10 group-hover:text-blue-500/30 transition-colors">{s.n}</span>
                  <h3 className="text-white font-bold mt-3">{s.title}</h3>
                  <p className="text-white/50 text-sm mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Clinic strip ─────────────────────────────────────────────────── */}
      <section className="bg-slate-950 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div>
            <p className="text-white font-bold text-lg">בעל מרפאה?</p>
            <p className="text-slate-400 text-sm mt-1">הקם קליניקה דיגיטלית תוך 24 שעות — White Label, AI, וידאו, תשלומים.</p>
          </div>
          <Link
            href="/for-clinics"
            className="shrink-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
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
                <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
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
