import type { Metadata } from 'next'
import Link from 'next/link'
import HeroCarousel from './HeroCarousel'

export const metadata: Metadata = {
  title: { absolute: 'CANNA למרפאות — SaaS רפואי ישראלי' },
  description: 'הקם קליניקה דיגיטלית תוך 24 שעות. ניהול תורים, וידאו HD, סיכומי AI, מיתוג אישי ותמיכה ישראלית. ניסיון חינם 14 ימים.',
  keywords: ['telemedicine saas', 'SaaS מרפאות', 'ניהול קליניקה דיגיטלית', 'CANNA'],
  openGraph: {
    title: 'CANNA למרפאות — הפלטפורמה שמכפילה הכנסות',
    description: 'הקם קליניקה דיגיטלית תוך 24 שעות.',
    type: 'website',
    locale: 'he_IL',
  },
}

// ── Feature sections data ────────────────────────────────────────────

const features = [
  {
    tag: 'ייעוצי וידאו',
    title: 'שיחות וידאו HD — מובנות בפלטפורמה',
    body: 'ייעוצים בוידאו מוצפן ויציב. חדר המתנה דיגיטלי, בדיקת ציוד אוטומטית, ו-SOAP notes בצד המסך בזמן אמת. אפס התקנות למטופל.',
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=700&q=80',
    imgAlt: 'רופא בשיחת וידאו עם מטופל',
  },
  {
    tag: 'בינה מלאכותית',
    title: 'AI שכותב את התיעוד בשבילך',
    body: 'לפני כל ייעוץ — מיון אוטומטי ושאלון קליטה. אחרי — SOAP notes נכתבים לבד וטיוטת מרשם מוכנה לאישור. חיסכון של שעות תיעוד ביום.',
    img: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=700&q=80',
    imgAlt: 'AI רפואי מנתח מידע',
  },
  {
    tag: 'White-Label',
    title: 'המרפאה שלך — הזהות שלך',
    body: 'לוגו, צבעים, ו-subdomain ייחודיים. המטופלים שלך רואים רק את שם המרפאה שלך — לא "CANNA". מיתוג מלא בכמה קליקים.',
    img: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=700&q=80',
    imgAlt: 'מרפאה עם מיתוג אישי',
  },
]

// ── Check icon ────────────────────────────────────────────────────────

function Check() {
  return (
    <svg className="w-5 h-5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────

export default function ForClinicsPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">

      {/* ── Navbar ── */}
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
              <Link href="/doctors" className="hover:text-slate-900 transition-colors">לרופאים</Link>
              <Link href="#features" className="hover:text-slate-900 transition-colors">פיצ׳רים</Link>
              <Link href="#pricing" className="hover:text-slate-900 transition-colors">מחירים</Link>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors">
                כניסה
              </Link>
              <Link href="/auth/register?type=clinic" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm shadow-blue-600/20">
                ניסיון חינם — 14 יום
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Hero — fullscreen carousel ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <HeroCarousel />
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-900/80 to-slate-900/40 z-10" />

        <div className="relative z-20 max-w-7xl mx-auto px-6 py-32 w-full">
          <div className="max-w-2xl mr-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/90 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              50+ מרפאות כבר פועלות על הפלטפורמה
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight">
              קליניקה דיגיטלית
              <br />
              <span className="text-blue-400">תוך 24 שעות.</span>
            </h1>

            <p className="text-lg text-white/70 mt-6 leading-relaxed max-w-lg">
              ניהול תורים, ייעוצי וידאו HD, AI שכותב תיעוד, מיתוג אישי ותמיכה ישראלית — פלטפורמה אחת, פתרון מלא.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Link
                href="/auth/register?type=clinic"
                className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                התחל ניסיון חינם — 14 יום
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all backdrop-blur-sm"
              >
                גלה את הפיצ׳רים
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-10">
              {['✓ הפעלה תוך 24 שעות', '✓ AI שכותב תיעוד', '✓ White-Label מלא', '✓ ביטול בכל עת'].map(t => (
                <span key={t} className="text-sm text-white/60 font-medium">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="bg-blue-600 py-8 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {[
            { v: '+40%', l: 'הכנסות ממוצעות תוך 3 חודשים' },
            { v: '−3 שעות', l: 'פחות תיעוד ידני ביום' },
            { v: '0%', l: 'no-show עם תזכורות אוטומטיות' },
            { v: '× 2.4', l: 'תפוקת ייעוצים לרופא' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-black">{s.v}</p>
              <p className="text-blue-100 text-xs mt-1 font-medium">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature sections — alternating with real images ── */}
      <section id="features" className="bg-slate-50 py-4">
        {features.map((f, i) => (
          <div
            key={f.tag}
            className={`max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center`}
          >
            {/* Text */}
            <div className={i % 2 === 1 ? 'order-1 lg:order-2' : 'order-1'}>
              <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5">
                {f.tag}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                {f.title}
              </h2>
              <p className="text-slate-500 mt-5 text-lg leading-relaxed">{f.body}</p>
              <Link
                href="/auth/register?type=clinic"
                className="inline-flex items-center gap-2 mt-8 text-blue-600 font-semibold hover:gap-3 transition-all group"
              >
                התחל עכשיו
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-[-3px] transition-transform">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
              </Link>
            </div>

            {/* Image */}
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
                <div
                  className={`absolute -z-10 w-48 h-48 opacity-30 ${i % 2 === 0 ? '-bottom-6 -left-6' : '-bottom-6 -right-6'}`}
                  style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── All features list ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-4">הכל כלול</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              כל מה שמרפאה מודרנית צריכה
            </h2>
            <p className="text-slate-500 mt-4 text-lg">פלטפורמה אחת — בלי לרכב על כמה כלים</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📹', title: 'ייעוצי וידאו HD', desc: 'LiveKit מוצפן, חדר המתנה דיגיטלי, ניהול ציוד.' },
              { icon: '🤖', title: 'AI — 4 סוכנים', desc: 'מיון, SOAP notes, טיוטת מרשם ושאלון קליטה.', hot: true },
              { icon: '📅', title: 'ניהול תורים', desc: 'מטופל בוחר מועד, רופא מאשר, תזכורות אוטומטיות.' },
              { icon: '🎨', title: 'White-Label מלא', desc: 'לוגו, צבעים, subdomain ודומיין אישי.' },
              { icon: '📋', title: 'מסמכים דיגיטליים', desc: 'מרשמים, אישורי מחלה, חתימה דיגיטלית.' },
              { icon: '📊', title: 'דוחות ואנליטיקה', desc: 'הכנסות, no-show, AI usage — הכל בזמן אמת.' },
              { icon: '🔔', title: 'תזכורות אוטומטיות', desc: 'WhatsApp + Email — 24ש׳ ושעה לפני הייעוץ.' },
              { icon: '🔒', title: 'HIPAA & GDPR', desc: 'הצפנה מקצה לקצה, audit log, אחסון בישראל.' },
              { icon: '🇮🇱', title: 'תמיכה ישראלית', desc: 'צוות תמיכה בעברית, זמן תגובה עד 2 שעות.' },
            ].map((f, i) => (
              <div key={i} className="bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-2xl p-6 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{f.icon}</span>
                  {f.hot && (
                    <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">🔥 חם</span>
                  )}
                </div>
                <h3 className="font-black text-slate-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-6 bg-slate-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">תהליך</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">מהרשמה לקליניקה פעילה — 4 שלבים</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: '01', title: 'נרשמים', desc: 'הרשמה בדקה אחת. 14 ימי ניסיון חינם, ללא כרטיס אשראי.' },
              { n: '02', title: 'מגדירים מיתוג', desc: 'מעלים לוגו, בוחרים צבעים ומקבלים subdomain ייחודי.' },
              { n: '03', title: 'מזמינים רופאים', desc: 'שולחים הזמנה באימייל. רופאים מצטרפים ומגדירים זמינות.' },
              { n: '04', title: 'מתחילים לקבל', desc: 'מטופלים קובעים תורים, הרופאים מקיימים ייעוצים, AI מתעד.' },
            ].map((s, i) => (
              <div key={s.n} className="relative group">
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

      {/* ── Capabilities ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-4">היכולות</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">כל מה שמרפאה דיגיטלית צריכה</h2>
            <p className="text-slate-500 mt-3 text-lg">פלטפורמה אחת, מקצה לקצה</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { t: 'White-Label מלא', d: 'מיתוג אישי — לוגו, צבעים ו-Subdomain משלך' },
              { t: 'AI SOAP notes', d: 'סיכום ייעוץ אוטומטי שהרופא מאשר בלחיצה' },
              { t: 'מרשמים דיגיטליים', d: 'טיוטת מרשם חכמה עם בדיקת אלרגיות' },
              { t: 'ממשק עברית מלא (RTL)', d: 'כל המערכת בעברית, נגישה ומותאמת מובייל' },
              { t: 'תורים + אישור רופא', d: 'זרימת קביעת תור מלאה עם אישור ותשלום' },
              { t: 'וידאו HD מוצפן', d: 'שיחות וידאו מאובטחות ישירות בדפדפן' },
              { t: 'תמיכה ישראלית', d: 'ליווי והטמעה בעברית, בשעות ישראל' },
              { t: 'ביטול בכל עת', d: 'ללא התחייבות ארוכת טווח' },
            ].map((row, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-5 bg-slate-50/50">
                <span className="inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white text-sm font-black">✓</span>
                <div>
                  <p className="font-bold text-slate-900">{row.t}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{row.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-4">תמחור</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              מחיר פשוט, שקוף, ללא הפתעות
            </h2>
            <p className="text-slate-500 mt-3 text-lg">14 ימי ניסיון חינם בכל תוכנית · אין כרטיס אשראי</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter',
                price: '₪299',
                sub: 'לחודש',
                desc: 'למרפאה קטנה שמתחילה',
                highlight: false,
                points: ['עד 2 רופאים', '100 ייעוצים/חודש', 'וידאו HD', 'מרשמים דיגיטליים', 'White-Label'],
              },
              {
                name: 'Pro',
                price: '₪799',
                sub: 'לחודש',
                desc: 'למרפאה מתפתחת עם AI',
                highlight: true,
                badge: 'הכי פופולרי',
                points: ['עד 10 רופאים', 'ייעוצים ללא הגבלה', 'AI — 4 סוכנים', 'אנליטיקה מלאה', 'תמיכה עדיפות'],
              },
              {
                name: 'Enterprise',
                price: 'צור קשר',
                sub: '',
                desc: 'לרשת מרפאות וארגונים',
                highlight: false,
                points: ['רופאים ללא הגבלה', 'Multi-clinic', 'SLA מותאם', 'Dedicated support', 'API access'],
              },
            ].map((plan) => (
              <div key={plan.name}
                className={`relative rounded-2xl p-8 border transition-all hover:-translate-y-1 ${
                  plan.highlight
                    ? 'bg-blue-600 border-blue-500 shadow-2xl shadow-blue-600/30'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 right-1/2 translate-x-1/2 bg-amber-400 text-slate-900 text-xs font-black px-4 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <h3 className={`font-black text-xl mb-1 ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                <p className={`text-sm mb-5 ${plan.highlight ? 'text-blue-100' : 'text-slate-500'}`}>{plan.desc}</p>
                <div className="mb-6">
                  <span className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                  {plan.sub && <span className={`text-sm mr-1 ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>{plan.sub}</span>}
                </div>
                <Link
                  href={plan.price === 'צור קשר' ? '/contact' : '/auth/register?type=clinic'}
                  className={`block text-center font-bold py-3 rounded-xl mb-6 text-sm transition-all hover:scale-105 ${
                    plan.highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.price === 'צור קשר' ? 'צור קשר' : 'התחל ניסיון חינם'}
                </Link>
                <div className="space-y-2.5">
                  {plan.points.map(p => (
                    <div key={p} className="flex items-center gap-2.5">
                      <svg className={`w-4 h-4 shrink-0 ${plan.highlight ? 'text-blue-200' : 'text-blue-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className={`text-sm ${plan.highlight ? 'text-blue-100' : 'text-slate-600'}`}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-4">לקוחות מרוצים</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">מה אומרות המרפאות</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'ד"ר שרה לוי', role: 'מנהלת מרפאת השרון', text: 'הכנסות עלו ב-45% תוך חודשיים. הרופאים חסכו שעתיים ביום על תיעוד. ה-AI פשוט עושה את העבודה.' },
              { name: 'ד"ר אמיר כהן', role: 'קליניקת כרמל', text: 'הייתי סקפטי בהתחלה. אחרי שבוע — לא מבין איך עבדתי בלי. המטופלים מגיעים עם שאלון מלא ומיון AI כבר.' },
              { name: 'נדב ברק', role: 'מנכ"ל רשת רפואה פרטית', text: 'ניהלנו 3 מרפאות עם 3 מערכות שונות. היום — מערכת אחת, לוח שלים, תמיכה מדהימה.' },
            ].map((t, i) => (
              <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-slate-600 leading-relaxed mb-5 text-sm">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-slate-950 py-20 px-6">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-3">מוכן להתחיל?</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              14 ימי ניסיון חינם.<br />
              <span className="text-blue-400">ללא כרטיס אשראי.</span>
            </h2>
            <p className="text-slate-400 mt-4 leading-relaxed max-w-lg">
              הפעלה תוך 24 שעות, תמיכה בעברית, ביטול בכל עת. מעל 50 מרפאות כבר מנהלות את הקליניקה הדיגיטלית שלהן עם CANNA.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <Link
              href="/auth/register?type=clinic"
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/30 hover:-translate-y-0.5"
            >
              התחל ניסיון חינם — 14 יום
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-8 py-3 rounded-2xl transition-all"
            >
              דבר עם המכירות
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-950 py-16 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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
              <p className="text-slate-500 leading-relaxed text-sm">פלטפורמת SaaS רפואי White-Label לישראל.</p>
            </div>
            <div>
              <p className="text-white font-bold mb-4">פלטפורמה</p>
              <nav className="space-y-3 text-slate-500">
                <p><a href="#features" className="hover:text-white transition-colors">פיצ׳רים</a></p>
                <p><a href="#pricing" className="hover:text-white transition-colors">מחירים</a></p>
                <p><Link href="/doctors" className="hover:text-white transition-colors">לרופאים</Link></p>
              </nav>
            </div>
            <div>
              <p className="text-white font-bold mb-4">חשבון</p>
              <nav className="space-y-3 text-slate-500">
                <p><Link href="/auth/register?type=clinic" className="hover:text-white transition-colors">הרשמה חינם</Link></p>
                <p><Link href="/auth/login" className="hover:text-white transition-colors">התחברות</Link></p>
                <p><Link href="/contact" className="hover:text-white transition-colors">יצירת קשר</Link></p>
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
            <p>נבנה ב <span className="font-semibold text-slate-500">NFD — Next Flow Digital</span></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
