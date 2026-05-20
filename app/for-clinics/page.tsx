import type { Metadata } from 'next'
import Link from 'next/link'

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

// ── Feature list ───────────────────────────────────────────
const features = [
  { icon: 'video', title: 'ייעוצי וידאו HD', desc: 'שיחות וידאו מוצפנות ויציבות. חדר המתנה דיגיטלי, בדיקת ציוד אוטומטית.' },
  { icon: 'ai', title: 'AI מובנה', desc: 'מיון AI לפני כל ייעוץ. סיכום SOAP אוטומטי אחרי הפגישה. חיסכון של שעות בתיעוד.' },
  { icon: 'docs', title: 'מסמכים רפואיים', desc: 'אחסון מאובטח, signed URLs, גישה לפי הרשאה. תקן HIPAA.' },
  { icon: 'notify', title: 'תזכורות חכמות', desc: 'WhatsApp + Email אוטומטיים. תזכורת 24ש׳ ושעה לפני. קישור וידאו ישיר.' },
  { icon: 'brand', title: 'White Label', desc: 'לוגו שלך, צבעים שלך, subdomain שלך. המטופלים רואים רק את המרפאה שלך.' },
  { icon: 'multi', title: 'Multi-tenant', desc: 'כל מרפאה — מבודדת לחלוטין. RLS מלא, org isolation, no data leakage.' },
  { icon: 'leads', title: 'ניהול לידים', desc: 'מטופלים פוטנציאליים, סטטוסים, הערות. CRM פשוט מובנה.' },
  { icon: 'analytics', title: 'Dashboard אדמין', desc: 'KPIs, הכנסות, ניצול תורים, דוחות חודשיים. הכל בזמן אמת.' },
  { icon: 'questionnaire', title: 'שאלונים דינמיים', desc: 'בנה שאלוני קליטה בהתאמה אישית. AI מנתח תשובות לפני הפגישה.' },
]

// ── Plans ─────────────────────────────────────────────────
const plans = [
  {
    name: 'Basic',
    price: '₪490',
    period: 'לחודש',
    highlight: false,
    features: ['עד 3 רופאים', 'עד 100 ייעוצים/חודש', 'וידאו HD', 'AI מיון + סיכום', 'Email + WhatsApp', '10GB אחסון'],
  },
  {
    name: 'Pro',
    price: '₪990',
    period: 'לחודש',
    highlight: true,
    badge: 'הכי פופולרי',
    features: ['עד 10 רופאים', 'ייעוצים ללא הגבלה', 'הכל ב-Basic', 'White Label', 'שאלונים מתקדמים', 'API access', '50GB אחסון'],
  },
  {
    name: 'Enterprise',
    price: 'בהתאמה',
    period: '',
    highlight: false,
    features: ['רופאים ללא הגבלה', 'SLA מותאם', 'Onboarding אישי', 'Custom domain', 'אינטגרציות מותאמות', 'תמיכה 24/7'],
  },
]

// ── Steps ─────────────────────────────────────────────────
const steps = [
  { n: '01', title: 'נרשמים תוך דקות', desc: 'Wizard מהיר: שם המרפאה, לוגו, subdomain. ללא כרטיס אשראי.' },
  { n: '02', title: 'מזמינים רופאים', desc: 'שולחים מייל הזמנה. הרופא מקבל link אישי ונרשם תוך שניות.' },
  { n: '03', title: 'מגדירים תזמון', desc: 'שעות פעילות, מחירים, מדיניות ביטול. הכל דרך ממשק פשוט.' },
  { n: '04', title: 'מתחילים לעבוד', desc: 'מטופלים קובעים תורים, מקבלים תזכורות, נכנסים לייעוץ בלחיצה.' },
]

const FeatureIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    video: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
    ai: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 012 2v2M12 2a2 2 0 00-2 2v2M12 2v2"/><circle cx="12" cy="12" r="4"/>
        <path d="M12 8V4M8.5 10l-3-3M4 12H2M8.5 14l-3 3M12 16v4M15.5 14l3 3M20 12h2M15.5 10l3-3"/>
      </svg>
    ),
    docs: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
    notify: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    ),
    brand: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    ),
    multi: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="7" height="7"/><rect x="15" y="3" width="7" height="7"/><rect x="2" y="14" width="7" height="7"/><rect x="15" y="14" width="7" height="7"/>
      </svg>
    ),
    leads: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    analytics: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    questionnaire: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  }
  return <>{icons[type] ?? null}</>
}

export default function ForClinicsPage() {
  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">

      {/* ── Navbar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1"/>
                <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/>
              </svg>
            </span>
            טלמדיסן
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">יכולות</a>
            <a href="#how" className="hover:text-white transition-colors">איך עובד</a>
            <a href="#pricing" className="hover:text-white transition-colors">מחירים</a>
            <Link href="/" className="hover:text-white transition-colors">למטופלים</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white px-3 py-2 transition-colors">
              כניסה
            </Link>
            <Link href="/onboarding" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-600/20">
              ניסיון חינם — 14 יום
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-32 px-6">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-blue-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            SaaS רפואי לישראל
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight">
            הקליניקה הדיגיטלית
            <br />
            <span className="text-blue-400">שלך — תוך 24 שעות.</span>
          </h1>

          <p className="text-xl text-slate-400 mt-6 leading-relaxed max-w-2xl mx-auto">
            פלטפורמת SaaS מלאה לניהול מרפאה: ייעוצי וידאו, AI, מסמכים, תשלומים ומיתוג אישי.
            <br />בלי להתעסק בטכנולוגיה. בלי שרתים. בלי כאבי ראש.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/30 hover:-translate-y-0.5"
            >
              פתח מרפאה — חינם 14 יום
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center border border-white/15 hover:border-white/30 text-slate-300 hover:text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all"
            >
              בקש דמו
            </a>
          </div>

          <p className="text-slate-600 text-sm mt-5">אין צורך בכרטיס אשראי · ביטול בכל עת · תמיכה בעברית</p>

          {/* Social proof bar */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-14 pt-10 border-t border-white/5">
            {['HIPAA Compliant', 'תקן ISO 27001', 'אחסון בישראל', 'SLA 99.9%'].map(t => (
              <div key={t} className="flex items-center gap-2 text-slate-500 text-sm">
                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-slate-900/50">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <div key={f.title} className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-2xl p-6 transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 group-hover:bg-blue-600/30 transition-colors">
                  <FeatureIcon type={f.icon} />
                </div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="relative group">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-7 left-0 w-full h-px bg-white/8 -z-10" />
                )}
                <div className="bg-white/3 border border-white/8 hover:border-blue-500/30 rounded-2xl p-6 transition-all hover:bg-white/5">
                  <span className="text-4xl font-black text-white/8 group-hover:text-blue-500/25 transition-colors">{s.n}</span>
                  <h3 className="text-white font-bold mt-3 text-sm">{s.title}</h3>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">מחירים</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">שקוף, ללא הפתעות</h2>
            <p className="text-slate-400 mt-4">מחירים בשקלים, חיוב ישראלי, ביטול בכל עת.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`relative rounded-3xl p-8 border flex flex-col ${
                  plan.highlight
                    ? 'bg-blue-600 border-blue-500 shadow-2xl shadow-blue-600/20'
                    : 'bg-white/3 border-white/10'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-blue-700 text-xs font-black px-4 py-1.5 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`font-bold text-lg ${plan.highlight ? 'text-white' : 'text-white'}`}>{plan.name}</h3>
                  <div className="flex items-end gap-1 mt-3">
                    <span className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-white'}`}>{plan.price}</span>
                    {plan.period && <span className={`text-sm mb-1 ${plan.highlight ? 'text-blue-200' : 'text-slate-500'}`}>{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-blue-200' : 'text-blue-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className={`text-sm ${plan.highlight ? 'text-white' : 'text-slate-300'}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.name === 'Enterprise' ? '#contact' : '/onboarding'}
                  className={`block text-center font-bold py-3.5 px-6 rounded-xl transition-all text-sm ${
                    plan.highlight
                      ? 'bg-white text-blue-700 hover:bg-blue-50'
                      : 'bg-white/8 hover:bg-white/15 text-white border border-white/10'
                  }`}
                >
                  {plan.name === 'Enterprise' ? 'צור קשר' : 'התחל ניסיון חינם'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-center">
            <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true"
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />
            <p className="relative text-blue-200 text-xs font-bold tracking-widest uppercase mb-4">מוכנים להתחיל?</p>
            <h2 className="relative text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              הקם את המרפאה הדיגיטלית שלך עוד היום
            </h2>
            <p className="relative text-blue-200 text-lg mb-10">
              14 יום חינם. ללא כרטיס אשראי. ביטול בכל עת.
            </p>
            <div className="relative flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center bg-white text-blue-700 font-black text-base px-8 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-xl"
              >
                פתח מרפאה עכשיו — חינם
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center border-2 border-white/30 hover:border-white/50 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all"
              >
                יש לי חשבון
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1"/>
                <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/>
              </svg>
            </span>
            <span className="text-slate-400 font-semibold">טלמדיסן</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            <Link href="/" className="hover:text-slate-300 transition-colors">למטופלים</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">פרטיות</Link>
            <Link href="/accessibility" className="hover:text-slate-300 transition-colors">נגישות</Link>
          </nav>
          <p>© {new Date().getFullYear()} טלמדיסן</p>
        </div>
      </footer>
    </div>
  )
}
