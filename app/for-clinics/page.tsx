import type { Metadata } from 'next'
import Link from 'next/link'
import HeroCarousel from './HeroCarousel'

export const metadata: Metadata = {
  title: 'טלמדיסן למרפאות — SaaS רפואי ישראלי',
  description: 'הקם קליניקה דיגיטלית תוך 24 שעות. ניהול תורים, וידאו HD, סיכומי AI, מסמכים, מיתוג אישי ותמיכה ישראלית. ניסיון חינם 14 ימים.',
  keywords: ['telemedicine saas', 'SaaS מרפאות', 'ניהול קליניקה דיגיטלית', 'טלמדיסן', 'תוכנה לרפואה מרחוק'],
  openGraph: {
    title: 'טלמדיסן למרפאות — SaaS רפואי',
    description: 'הקם קליניקה דיגיטלית תוך 24 שעות.',
    type: 'website',
    locale: 'he_IL',
  },
}

// ── Icon components ────────────────────────────────────────────────
function Check({ className = '' }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────
const STATS = [
  { value: '500+', label: 'מרפאות פעילות' },
  { value: '50,000+', label: 'ייעוצים בוצעו' },
  { value: '4.9★', label: 'דירוג ממוצע' },
  { value: '24ש׳', label: 'עד הפעלה' },
]

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
    title: 'ייעוצי וידאו HD',
    desc: 'שיחות וידאו מוצפנות ויציבות. חדר המתנה דיגיטלי ובדיקת ציוד אוטומטית לפני כל ייעוץ.',
    badge: '',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
    title: 'AI מובנה — 4 סוכנים',
    desc: 'מיון לפני הייעוץ, SOAP notes אוטומטיים, טיוטת מרשם ושאלון קליטה דינמי. חיסכון של שעות ביום.',
    badge: 'חם',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: 'ניהול תורים חכם',
    desc: 'מטופל בוחר מועד מתוך הסלוטים הפנויים של הרופא. הרופא מאשר או מציע מועד חלופי.',
    badge: '',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    ),
    title: 'תזכורות אוטומטיות',
    desc: 'WhatsApp + Email אוטומטיים. תזכורת 24 שעות ושעה לפני עם קישור וידאו ישיר. אפס no-show.',
    badge: '',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    ),
    title: 'White Label מלא',
    desc: 'לוגו שלך, צבעים שלך, subdomain ייחודי. DNS אוטומטי. המטופלים רואים רק את המרפאה שלך.',
    badge: '',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'מסמכים רפואיים',
    desc: 'אחסון מאובטח בענן. גישה לפי הרשאה. signed URLs בלבד. תקן HIPAA.',
    badge: '',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    title: 'CRM ולידים מובנה',
    desc: 'ניהול מטופלים פוטנציאליים, סטטוסים, מעקב והערות. AI מנתח ומדרג לידים אוטומטית.',
    badge: '',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'דוחות ואנליטיקה',
    desc: 'KPIs, הכנסות, ניצול תורים, AI usage. גרפים בזמן אמת ודוחות חודשיים.',
    badge: '',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
    title: 'שאלונים דינמיים',
    desc: 'בנה שאלוני קליטה מותאמים לכל התמחות. AI מנתח תשובות ומכין את הרופא לפגישה.',
    badge: '',
  },
]

const COMPARISON = [
  { feature: 'ייעוצי וידאו HD', us: true, hidoc: true, bikur: false },
  { feature: 'AI מיון + SOAP notes', us: true, hidoc: false, bikur: false },
  { feature: 'White Label ו-subdomain', us: true, hidoc: false, bikur: false },
  { feature: 'WhatsApp אוטומטי', us: true, hidoc: false, bikur: true },
  { feature: 'מחירים בשקלים', us: true, hidoc: false, bikur: true },
  { feature: 'תמיכה בעברית', us: true, hidoc: false, bikur: true },
  { feature: 'ניהול לידים ו-CRM', us: true, hidoc: false, bikur: false },
  { feature: 'API ואינטגרציות', us: true, hidoc: true, bikur: false },
  { feature: 'הגדרה תוך 24 שעות', us: true, hidoc: false, bikur: false },
]

const TESTIMONIALS = [
  {
    name: 'ד"ר מיכאל כהן',
    role: 'דרמטולוגיה, מרפאת הכרמל',
    text: 'עברנו מ-HiDoc לטלמדיסן לפני 6 חודשים. השינוי הכי גדול — ה-AI. SOAP notes שלוקחים 20 דקות עכשיו נכתבים תוך 30 שניות. החזרנו שעתיים ביום לכל רופא.',
    stars: 5,
  },
  {
    name: 'שירה לוי',
    role: 'מנהלת מרפאה, רפואת הנשים תל אביב',
    text: 'המיתוג האישי שינה הכל. המטופלות שלנו חושבות שבנינו אפליקציה ייחודית. פחות no-show בזכות התזכורות האוטומטיות בWhatsApp.',
    stars: 5,
  },
  {
    name: 'ד"ר אבי ברק',
    role: 'אורתופדיה, קליניקת ברק',
    text: 'הקמנו תוך יום. הזמנתי 3 רופאים בלינק, הגדרתי שעות פעילות, ומחר כבר קיבלנו את התור הראשון. אף מוצר אחר לא נותן את זה.',
    stars: 5,
  },
]

const PLANS = [
  {
    name: 'Basic',
    price: '₪490',
    period: 'לחודש',
    highlight: false,
    badge: '',
    features: ['עד 3 רופאים', 'עד 100 ייעוצים / חודש', 'וידאו HD', 'AI מיון + סיכום', 'Email + WhatsApp', '10GB אחסון', 'תמיכה בעברית'],
  },
  {
    name: 'Pro',
    price: '₪990',
    period: 'לחודש',
    highlight: true,
    badge: 'הכי פופולרי',
    features: ['עד 10 רופאים', 'ייעוצים ללא הגבלה', 'White Label מלא', 'CRM ולידים', 'שאלונים מתקדמים', 'API access', '50GB אחסון', 'תמיכה עדיפות'],
  },
  {
    name: 'Enterprise',
    price: 'בהתאמה',
    period: '',
    highlight: false,
    badge: '',
    features: ['רופאים ללא הגבלה', 'SLA מותאם', 'Onboarding אישי', 'Custom domain (SSL)', 'אינטגרציות מותאמות', 'מנהל לקוח ייעודי', 'תמיכה 24/7'],
  },
]

const STEPS = [
  { n: '01', title: 'נרשמים תוך 3 דקות', desc: 'Wizard מהיר: שם המרפאה, לוגו, subdomain. ללא כרטיס אשראי. מיד מקבלים גישה מלאה.' },
  { n: '02', title: 'מזמינים רופאים', desc: 'שולחים מייל הזמנה מהממשק. הרופא מקבל לינק אישי ונרשם בלחיצה. אין צורך בגישת IT.' },
  { n: '03', title: 'מגדירים שעות ומחירים', desc: 'שעות פעילות, מחיר ייעוץ, מדיניות ביטול. הכל דרך ממשק פשוט ב-5 דקות.' },
  { n: '04', title: 'מתחילים לקבל מטופלים', desc: 'מטופלים קובעים תורים אונליין, מקבלים תזכורות WhatsApp, ונכנסים לוידאו בלחיצה.' },
]

const FAQ = [
  {
    q: 'כמה זמן לוקחת ההקמה?',
    a: 'בממוצע פחות מ-24 שעות. ה-Wizard מדריך אותך שלב אחר שלב. Subdomain ו-DNS מוגדרים אוטומטית.',
  },
  {
    q: 'איך מטופלים נרשמים?',
    a: 'כל מרפאה מקבלת קישור הרשמה ייחודי. אפשר לשתף ב-WhatsApp, באתר, או בכרטיס ביקור דיגיטלי.',
  },
  {
    q: 'האם הרופאים צריכים להתקין אפליקציה?',
    a: 'לא. הכל עובד בדפדפן. רופא נכנס עם מייל וסיסמה ומיד רואה את לוח התורים שלו.',
  },
  {
    q: 'מה עם תשלומים בין מטופל לרופא?',
    a: 'המטופל משלם דרך Tranzila (ישראלי, מאובטח). התשלום מגיע לחשבון המרפאה ישירות.',
  },
  {
    q: 'האם המידע הרפואי מוגן?',
    a: 'כן. הצפנה מלאה, RLS (Row Level Security) בכל שאילתה, אחסון מבודד לכל מרפאה. תקן HIPAA.',
  },
]

export default function ForClinicsPage() {
  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">

      {/* ── Navbar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-lg text-white">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1"/>
                <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/>
              </svg>
            </span>
            טלמדיסן
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">יכולות</a>
            <a href="#compare" className="hover:text-white transition-colors">השוואה</a>
            <a href="#how" className="hover:text-white transition-colors">איך עובד</a>
            <a href="#pricing" className="hover:text-white transition-colors">מחירים</a>
            <a href="#faq" className="hover:text-white transition-colors">שאלות</a>
            <Link href="/" className="hover:text-white transition-colors text-blue-400">למטופלים</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white px-3 py-2 transition-colors">
              כניסה
            </Link>
            <Link href="/onboarding" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-black px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 hover:-translate-y-0.5">
              ניסיון חינם — 14 יום
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        {/* Background glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-1/4 w-[700px] h-[500px] bg-blue-600/8 rounded-full blur-[130px]" />
          <div className="absolute top-10 left-1/3 w-[400px] h-[300px] bg-indigo-600/8 rounded-full blur-[100px]" />
          <div className="absolute -bottom-20 left-1/4 w-[500px] h-[400px] bg-blue-800/6 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 text-blue-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            SaaS רפואי ישראלי — פלטפורמה מובילה
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight">
            הקליניקה הדיגיטלית
            <br />
            <span className="bg-gradient-to-l from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              שלך — תוך 24 שעות.
            </span>
          </h1>

          <p className="text-xl text-slate-400 mt-6 leading-relaxed max-w-2xl mx-auto">
            פלטפורמת SaaS מלאה לניהול מרפאה: ייעוצי וידאו, AI, מסמכים, תשלומים ומיתוג אישי.
            <br className="hidden sm:block" />
            בלי שרתים. בלי כאבי ראש. בלי IT.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-black text-base px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-600/30 hover:-translate-y-0.5 hover:shadow-blue-500/40"
            >
              פתח מרפאה — חינם 14 יום
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
            <a
              href="#compare"
              className="inline-flex items-center justify-center border border-white/15 hover:border-white/30 text-slate-300 hover:text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all bg-white/3 hover:bg-white/6"
            >
              ראה השוואה
            </a>
          </div>

          <p className="text-slate-600 text-sm mt-5">
            אין צורך בכרטיס אשראי · ביטול בכל עת · תמיכה בעברית
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-12 pt-10 border-t border-white/5">
            {['HIPAA Compliant', 'אחסון בישראל', 'SLA 99.9%', 'תמיכה בעברית', 'ISO 27001'].map(t => (
              <div key={t} className="flex items-center gap-2 text-slate-500 text-sm">
                <Check className="w-4 h-4 text-green-400" />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* ── Carousel ── */}
        <HeroCarousel />
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-3xl sm:text-4xl font-black text-white">{s.value}</p>
              <p className="text-slate-500 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">יכולות</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              כל מה שמרפאה דיגיטלית צריכה
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              לא תצטרך לשלב כלים שונים. הכל מובנה, מחובר, ועובד מהרגע הראשון.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group relative bg-white/3 hover:bg-white/6 border border-white/8 hover:border-blue-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/5"
              >
                {f.badge && (
                  <div className="absolute top-4 left-4 bg-blue-600/30 border border-blue-500/30 text-blue-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {f.badge}
                  </div>
                )}
                <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 group-hover:bg-blue-600/25 group-hover:border-blue-400/30 transition-all">
                  {f.icon}
                </div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────── */}
      <section id="compare" className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">השוואה</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              למה טלמדיסן?
            </h2>
            <p className="text-slate-400 mt-4">השוואה כנה עם המתחרים הגדולים בשוק הישראלי</p>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-4 bg-slate-800/80 border-b border-white/10">
              <div className="p-4 text-slate-400 text-sm font-semibold">תכונה</div>
              <div className="p-4 text-center">
                <span className="text-blue-400 font-black text-sm">טלמדיסן</span>
              </div>
              <div className="p-4 text-center text-slate-500 text-sm font-medium">HiDoc</div>
              <div className="p-4 text-center text-slate-500 text-sm font-medium">ביקורופא</div>
            </div>

            {/* Rows */}
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 border-b border-white/5 last:border-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/2'}`}
              >
                <div className="p-4 text-sm text-slate-300 flex items-center">{row.feature}</div>
                <div className="p-4 flex items-center justify-center">
                  {row.us
                    ? <span className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-blue-400" /></span>
                    : <span className="w-2 h-2 rounded-full bg-slate-700" />}
                </div>
                <div className="p-4 flex items-center justify-center">
                  {row.hidoc
                    ? <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-slate-500" /></span>
                    : <span className="w-2 h-2 rounded-full bg-slate-800" />}
                </div>
                <div className="p-4 flex items-center justify-center">
                  {row.bikur
                    ? <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-slate-500" /></span>
                    : <span className="w-2 h-2 rounded-full bg-slate-800" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">תהליך</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              מהרשמה לייעוץ ראשון — 4 שלבים
            </h2>
            <p className="text-slate-400 mt-4">הכנו את כל הטכנולוגיה. אתם רק צריכים להתחיל.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative group">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-7 left-0 w-full h-px bg-gradient-to-l from-transparent via-white/10 to-transparent -z-10" />
                )}
                <div className="bg-white/3 border border-white/8 hover:border-blue-500/30 rounded-2xl p-6 transition-all hover:bg-white/5 hover:-translate-y-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl font-black text-white/10 group-hover:text-blue-500/30 transition-colors">{s.n}</span>
                    <div className="w-6 h-px bg-white/10 flex-1" />
                  </div>
                  <h3 className="text-white font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">עדויות</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              מרפאות שכבר עובדות איתנו
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white/3 border border-white/8 hover:border-white/15 rounded-2xl p-6 transition-all hover:-translate-y-0.5">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>

                <p className="text-slate-300 text-sm leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>

                <div className="flex items-center gap-3 pt-4 border-t border-white/8">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">מחירים</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">שקוף, ללא הפתעות</h2>
            <p className="text-slate-400 mt-4">מחירים בשקלים, חיוב ישראלי, ביטול בכל עת.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`relative rounded-3xl p-8 border flex flex-col transition-all hover:-translate-y-1 ${
                  plan.highlight
                    ? 'bg-blue-600 border-blue-500 shadow-2xl shadow-blue-600/25'
                    : 'bg-white/3 border-white/10 hover:border-white/20'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-blue-700 text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-white font-black text-lg">{plan.name}</h3>
                  <div className="flex items-end gap-1 mt-3">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    {plan.period && <span className={`text-sm mb-1.5 ${plan.highlight ? 'text-blue-200' : 'text-slate-500'}`}>{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-blue-200' : 'text-blue-400'}`} />
                      <span className={`text-sm ${plan.highlight ? 'text-white' : 'text-slate-300'}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.name === 'Enterprise' ? '#faq' : '/onboarding'}
                  className={`block text-center font-black py-3.5 px-6 rounded-xl transition-all text-sm ${
                    plan.highlight
                      ? 'bg-white text-blue-700 hover:bg-blue-50 shadow-lg'
                      : 'bg-white/8 hover:bg-white/15 text-white border border-white/10'
                  }`}
                >
                  {plan.name === 'Enterprise' ? 'דברו איתנו' : 'התחל ניסיון חינם'}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-600 text-sm mt-8">
            כל התוכניות כוללות 14 יום ניסיון חינם · אין קנסות ביטול · תמיכה בעברית
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">שאלות נפוצות</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">יש לך שאלות?</h2>
          </div>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-all">
                <h3 className="text-white font-bold text-base mb-3">{item.q}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-slate-500 text-sm">
              יש שאלה נוספת?{' '}
              <a href="mailto:hello@cannaforyou.net" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                כתבו לנו ישירות
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 sm:p-16 text-center shadow-2xl shadow-blue-600/20">
            {/* Dot grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              aria-hidden="true"
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }}
            />
            {/* Glow */}
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" aria-hidden="true" />
            <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl" aria-hidden="true" />

            <div className="relative">
              <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-4">מוכנים להתחיל?</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
                הקם את המרפאה הדיגיטלית
                <br className="hidden sm:block" />
                שלך עוד היום
              </h2>
              <p className="text-blue-200 text-lg mb-10">
                14 יום חינם. ללא כרטיס אשראי. ביטול בכל עת.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center bg-white text-blue-700 font-black text-base px-8 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-xl"
                >
                  פתח מרפאה עכשיו — חינם
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center border-2 border-white/30 hover:border-white/60 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all hover:bg-white/10"
                >
                  יש לי חשבון
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1"/>
                    <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/>
                  </svg>
                </span>
                <span className="text-white font-black">טלמדיסן</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">הפלטפורמה הרפואית הדיגיטלית המובילה בישראל.</p>
            </div>

            <div>
              <p className="text-white text-xs font-bold uppercase tracking-wide mb-4">מוצר</p>
              <div className="space-y-2">
                {['#features', '#compare', '#pricing', '#faq'].map((href, i) => (
                  <a key={href} href={href} className="block text-slate-500 hover:text-slate-300 text-sm transition-colors">
                    {['יכולות', 'השוואה', 'מחירים', 'שאלות'][i]}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-white text-xs font-bold uppercase tracking-wide mb-4">חברה</p>
              <div className="space-y-2">
                {[['/', 'למטופלים'], ['/terms', 'תנאי שימוש'], ['/privacy', 'פרטיות'], ['/accessibility', 'נגישות']].map(([href, label]) => (
                  <Link key={href} href={href} className="block text-slate-500 hover:text-slate-300 text-sm transition-colors">{label}</Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-white text-xs font-bold uppercase tracking-wide mb-4">יצירת קשר</p>
              <div className="space-y-2">
                <a href="mailto:hello@cannaforyou.net" className="block text-slate-500 hover:text-slate-300 text-sm transition-colors">hello@cannaforyou.net</a>
                <Link href="/onboarding" className="inline-flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-colors mt-2">
                  התחל ניסיון חינם
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
            <p>© {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-slate-500">כל המערכות פעילות</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
