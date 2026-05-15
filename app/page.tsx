import type { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export const metadata: Metadata = {
  title: 'טלמדיסן — ייעוץ רפואי אונליין | הפלטפורמה המובילה',
  description: 'ייעוץ רפואי אונליין בוידאו עם רופאים מומחים. סיכומי AI חכמים, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה הרפואית המתקדמת בישראל.',
  keywords: ['טלמדיסן', 'ייעוץ רפואי אונליין', 'telemedicine', 'רופא אונליין', 'SaaS רפואי'],
  openGraph: {
    title: 'טלמדיסן — ייעוץ רפואי אונליין',
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
  name: 'טלמדיסן',
  url: BASE_URL,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  description: 'פלטפורמת ייעוץ רפואי אונליין — וידאו HD, סוכני AI, שאלונים דינמיים, תשלומים מאובטחים.',
}

// ── Testimonials ──────────────────────────────────────────────────────────
const testimonials = [
  {
    quote: 'תוך 20 דקות הייתי עם רופאת עור שנתנה לי מרשם מדויק. חסכתי שלושה שבועות המתנה.',
    name: 'מיכל לוי',
    role: 'מטופלת, תל אביב',
    img: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=80&q=80',
  },
  {
    quote: 'הסיכום שקיבלתי אחרי הייעוץ היה יותר מפורט מכל מה שקיבלתי אי פעם. הAI עשה עבודה מדהימה.',
    name: 'אלון שמיר',
    role: 'מטופל, חיפה',
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
  },
  {
    quote: 'כרופאה, המערכת חסכה לי שעות של תיעוד. הAI מכין הכל ואני רק מאשרת ומשלימה.',
    name: 'ד"ר רינת כהן',
    role: 'רופאת עור ומין',
    img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=80&q=80',
  },
]

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
              טלמדיסן
            </Link>
            <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
              <Link href="/doctors" className="hover:text-slate-900 transition-colors">רופאים</Link>
              <Link href="/specialties" className="hover:text-slate-900 transition-colors">התמחויות</Link>
              <Link href="/onboarding" className="hover:text-slate-900 transition-colors">למרפאות</Link>
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

      {/* ── Hero — full bleed image with overlay ───────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1800&q=85"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-900/80 to-slate-900/40" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-32 w-full">
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

        {/* Floating stat card bottom-left */}
        <div className="absolute bottom-10 left-8 hidden lg:flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4">
          <div className="text-right">
            <p className="text-2xl font-black text-white">10,000+</p>
            <p className="text-xs text-white/60">ייעוצים מוצלחים</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="text-right">
            <p className="text-2xl font-black text-white">4.9 ★</p>
            <p className="text-xs text-white/60">דירוג ממוצע</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="text-right">
            <p className="text-2xl font-black text-white">50+</p>
            <p className="text-xs text-white/60">רופאים מומחים</p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
          <span className="text-xs tracking-widest uppercase">גלול למטה</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
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

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-4">חוות דעת</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">מה אומרים המשתמשים</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className={`rounded-3xl p-8 border flex flex-col gap-6 ${i === 1 ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-600/20' : 'bg-slate-50 border-slate-100'}`}
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} width="14" height="14" viewBox="0 0 24 24" fill={i === 1 ? '#bfdbfe' : '#fbbf24'} stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
                <p className={`text-[15px] leading-relaxed flex-1 ${i === 1 ? 'text-white' : 'text-slate-700'}`}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.img} alt={t.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${i === 1 ? 'text-white' : 'text-slate-900'}`}>{t.name}</p>
                    <p className={`text-xs ${i === 1 ? 'text-blue-200' : 'text-slate-400'}`}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Clinic CTA — split with image ───────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden min-h-[440px] flex items-center">
            {/* Background image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-slate-950/98 via-slate-900/90 to-slate-900/20" />

            <div className="relative z-10 px-10 py-16 md:px-16 max-w-xl mr-auto">
              <span className="inline-block bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
                SaaS למרפאות
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight">
                הקם את הקליניקה
                <br />
                הדיגיטלית שלך — היום.
              </h2>
              <p className="text-slate-400 mt-4 text-lg leading-relaxed">
                מיתוג אישי, AI מובנה, מנוי גמיש. כולל וידאו, שאלונים, תשלומים ותמיכה ישראלית.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                >
                  ניסיון חינם — 14 ימים
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center border border-white/15 hover:border-white/30 text-slate-300 hover:text-white font-semibold px-7 py-4 rounded-2xl transition-all"
                >
                  יש לי חשבון
                </Link>
              </div>
            </div>
          </div>
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
                <span className="text-white font-bold text-lg">טלמדיסן</span>
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
            <p>&copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.</p>
            <p>עשוי עם ❤ בישראל</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
