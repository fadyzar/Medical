import type { Metadata } from 'next'
import Link from 'next/link'
import { SPECIALTIES } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export const metadata: Metadata = {
  title: 'טלמדיסן — ייעוץ רפואי אונליין | הפלטפורמה המובילה בישראל',
  description: 'ייעוץ רפואי אונליין בוידאו עם רופאים מומחים. סיכומי AI חכמים, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה הרפואית המתקדמת בישראל.',
  keywords: ['טלמדיסן', 'ייעוץ רפואי אונליין', 'רופא אונליין', 'שיחת וידאו רופא', 'telemedicine israel'],
  openGraph: {
    title: 'טלמדיסן — ייעוץ רפואי אונליין',
    description: 'ייעוץ רפואי בוידאו עם רופאים מומחים. AI, שאלונים, תשלומים מאובטחים.',
    type: 'website',
    locale: 'he_IL',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'טלמדיסן — ייעוץ רפואי אונליין',
    description: 'ייעוץ רפואי בוידאו עם רופאים מומחים. AI, שאלונים, תשלומים מאובטחים.',
  },
  alternates: { canonical: BASE_URL },
}

const SPECIALTY_ICONS: Record<string, string> = {
  general: '🏥', dermatology: '🔬', orthopedics: '🦴', cardiology: '❤️',
  ent: '👂', neurology: '🧠', gastro: '🫁', urology: '🔬',
  gynecology: '👩‍⚕️', ophthalmology: '👁️', psychiatry: '🧠', endocrinology: '⚕️',
  pulmonology: '🫁', pediatrics: '👶', pain: '💊', oncology: '🔬',
}

const TESTIMONIALS = [
  { name: 'מיכל כ.', role: 'מטופלת', text: 'קיבלתי ייעוץ תוך 20 דקות מרגע ההרשמה. הרופא היה מקצועי ואדיב, וסיכום הביקור הגיע מיד למייל. חוויה מעולה!', rating: 5 },
  { name: 'ד"ר אורי ל.', role: 'רופא עור', text: 'הפלטפורמה חוסכת לי זמן רב. סוכן ה-AI מכין סיכום מדויק, השאלונים מותאמים אישית, והמטופלים מגיעים מוכנים.', rating: 5 },
  { name: 'יעל ש.', role: 'מטופלת', text: 'כאמא לשלושה, אין לי זמן לשבת בתור. כאן קבעתי תור לרופא ילדים בערב, מהספה. ממליצה בחום!', rating: 5 },
  { name: 'רון מ.', role: 'מטופל', text: 'הייתי צריך חוות דעת שנייה מאונקולוג. תוך יום קיבלתי ייעוץ מקיף עם סיכום מפורט. שירות ברמה אחרת.', rating: 5 },
  { name: 'ד"ר נועה ב.', role: 'רופאה כללית', text: 'הממשק נוח ומהיר. אני יכולה לראות את תשובות השאלון לפני השיחה, מה שמייעל מאוד את הייעוץ.', rating: 5 },
]

const FAQS = [
  { q: 'כמה עולה ייעוץ רפואי אונליין?', a: 'המחיר משתנה לפי ההתמחות ונע בין 149-399 ש"ח. ניתן לראות את המחיר המדויק לפני הזמנת התור. לא מחייבים ללא אישור.' },
  { q: 'האם הייעוץ מוכר על ידי קופות החולים?', a: 'הייעוץ הוא פרטי ולא דרך קופת חולים. עם זאת, אנו מנפיקים חשבונית מס שניתן להגיש לביטוח המשלים לקבלת החזר.' },
  { q: 'כמה זמן לוקח עד שאקבל ייעוץ?', a: 'רוב הרופאים שלנו זמינים תוך 24-48 שעות. במקרים דחופים ניתן לקבל ייעוץ ביום, בכפוף לזמינות הרופא.' },
  { q: 'האם אפשר לקבל מרשם אונליין?', a: 'כן, הרופא יכול להנפיק מרשם דיגיטלי בסיום הייעוץ. המרשם נשלח ישירות למייל וניתן לממש אותו בכל בית מרקחת.' },
  { q: 'איך שומרים על פרטיות המידע הרפואי?', a: 'המערכת עומדת בתקן HIPAA. כל המידע מוצפן מקצה לקצה, גישה מוגבלת לרופא המטפל בלבד, ויש audit log מלא לכל פעולה.' },
  { q: 'מה קורה אם אני לא מרוצה מהייעוץ?', a: 'שביעות הרצון שלך חשובה לנו. אם הייעוץ לא ענה על הציפיות, ניתן לפנות לשירות הלקוחות לבדיקת החזר מלא או חלקי.' },
]

export default function LandingPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'טלמדיסן',
    url: BASE_URL,
    description: 'פלטפורמת ייעוץ רפואי אונליין מתקדמת — רופאים מומחים, סיכומי AI, שאלונים דינמיים, תשלומים מאובטחים.',
    areaServed: { '@type': 'Country', name: 'Israel' },
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      {/* ═══════════════════════ NAV ═══════════════════════ */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-black">T</span>
            </div>
            <span className="text-xl font-black bg-gradient-to-l from-blue-600 to-teal-600 bg-clip-text text-transparent">טלמדיסן</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/specialties" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">התמחויות</Link>
            <Link href="/doctors" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">הרופאים שלנו</Link>
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">בלוג</Link>
            <Link href="/onboarding" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">למרפאות</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:inline">התחברות</Link>
            <Link href="/auth/register" className="bg-gradient-to-l from-blue-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-600/25 transition-all duration-300 hover:-translate-y-0.5">
              קבע תור
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-bl from-blue-50 via-teal-50/30 to-white" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
              </span>
              <span className="text-sm font-medium text-blue-700">רופאים זמינים עכשיו</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.1] tracking-tight">
              ייעוץ רפואי אונליין
              <br />
              <span className="bg-gradient-to-l from-blue-600 to-teal-600 bg-clip-text text-transparent">בלחיצת כפתור</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 mt-6 max-w-2xl mx-auto leading-relaxed">
              רופאים מומחים ב-16 התמחויות זמינים לך בשיחת וידאו.
              <br className="hidden sm:block" />
              סיכומי AI חכמים, שאלונים מותאמים, חשבונית אוטומטית.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Link href="/auth/register" className="group bg-gradient-to-l from-blue-600 to-teal-600 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-xl shadow-blue-600/20 hover:shadow-2xl hover:shadow-blue-600/30 transition-all duration-300 hover:-translate-y-1">
                קבע תור עכשיו — חינם
                <span className="inline-block mr-2 transition-transform duration-300 group-hover:-translate-x-1">←</span>
              </Link>
              <Link href="/doctors" className="border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-2xl text-lg font-bold hover:border-gray-300 hover:bg-gray-50 transition-all duration-300">
                הרופאים שלנו
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TRUST INDICATORS ═══════════════════════ */}
      <section className="py-6 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 md:gap-16">
            {/* Rating */}
            <div className="flex items-center gap-3">
              <div className="flex" aria-label="דירוג 4.9 מתוך 5">
                {[1, 2, 3, 4, 5].map(i => (
                  <svg key={i} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <div>
                <span className="text-sm font-bold text-gray-900">4.9/5</span>
                <span className="text-sm text-gray-500 mr-1">(193+ ביקורות)</span>
              </div>
            </div>

            <div className="hidden sm:block w-px h-8 bg-gray-200" aria-hidden="true" />

            {/* Doctors count */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2 space-x-reverse">
                {['bg-blue-500', 'bg-teal-500', 'bg-indigo-500'].map((bg, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-white flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold" aria-hidden="true">{['ד', 'א', 'נ'][i]}</span>
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-600"><span className="font-bold text-gray-900">50+</span> רופאים מומחים</span>
            </div>

            <div className="hidden sm:block w-px h-8 bg-gray-200" aria-hidden="true" />

            {/* No approval badge */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <span className="text-sm text-gray-600">ללא אישור — <span className="font-bold text-gray-900">ללא חיוב</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section className="py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-bold text-teal-600 tracking-wide">פשוט ומהיר</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">איך זה עובד?</h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">שלושה צעדים פשוטים לייעוץ רפואי מקצועי</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 right-[16.67%] left-[16.67%] h-0.5 bg-gradient-to-l from-blue-200 via-teal-200 to-blue-200" aria-hidden="true" />

            {[
              { num: '1', icon: (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              ), title: 'הרשמה ובחירת רופא', desc: 'צור חשבון בחינם, בחר התמחות ורופא מומחה. מלא שאלון מקדים קצר והעלה מסמכים רלוונטיים.' },
              { num: '2', icon: (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              ), title: 'תשלום מאובטח', desc: 'שלם בכרטיס אשראי בצורה מאובטחת. לא מחייבים ללא אישור מראש. חשבונית נשלחת אוטומטית.' },
              { num: '3', icon: (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ), title: 'ייעוץ בוידאו + סיכום', desc: 'שוחח עם הרופא בוידאו באיכות HD. בסיום — סיכום AI מפורט, מרשם דיגיטלי והוראות המשך למייל.' },
            ].map((step) => (
              <div key={step.num} className="relative text-center group">
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-600/20 group-hover:shadow-xl group-hover:shadow-blue-600/30 transition-all duration-300 group-hover:-translate-y-1">
                  {step.icon}
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border-2 border-blue-600 text-blue-600 text-xs font-black flex items-center justify-center z-20 mx-auto" style={{ right: 'calc(50% - 28px)' }}>
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mt-6">{step.title}</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ SPECIALTIES ═══════════════════════ */}
      <section className="py-20 md:py-28 px-4 sm:px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-bold text-teal-600 tracking-wide">16 התמחויות</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">רופאים מומחים בכל תחום</h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">בחר את ההתמחות הרלוונטית וקבע תור עם רופא מומחה</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {SPECIALTIES.map(s => (
              <Link
                key={s.id}
                href={`/specialties/${s.id}`}
                className="group relative bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-300 hover:-translate-y-1"
              >
                <span className="text-3xl block mb-3" aria-hidden="true">{SPECIALTY_ICONS[s.id] || '🩺'}</span>
                <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base">{s.label}</span>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/specialties" className="text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors inline-flex items-center gap-1">
              לכל ההתמחויות
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURES ═══════════════════════ */}
      <section className="py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-bold text-teal-600 tracking-wide">יתרונות הפלטפורמה</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">למה טלמדיסן?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
              ), title: 'ייעוץ וידאו HD', desc: 'שיחת וידאו באיכות גבוהה עם רופא מומחה, מכל מקום ובכל מכשיר', color: 'from-blue-500 to-blue-600' },
              { icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
              ), title: 'סוכני AI חכמים', desc: 'מיון דחיפות, סיכום ייעוץ, טיוטת מרשם — AI שמסייע לרופא ומייעל את הטיפול', color: 'from-purple-500 to-indigo-600' },
              { icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              ), title: 'שאלונים דינמיים', desc: 'שאלון מקדים חכם שמתאים את עצמו לתלונה שלך — הרופא מגיע מוכן', color: 'from-teal-500 to-emerald-600' },
              { icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
              ), title: 'מרשם דיגיטלי', desc: 'הרופא מנפיק מרשם דיגיטלי מאובטח — נשלח ישירות למייל, ניתן למימוש בכל בית מרקחת', color: 'from-orange-500 to-amber-600' },
              { icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              ), title: 'תשלום מאובטח', desc: 'תשלום בכרטיס אשראי עם הצפנה מלאה. חשבונית אוטומטית, ללא חיוב ללא אישור', color: 'from-green-500 to-emerald-600' },
              { icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              ), title: 'פרטיות ואבטחה', desc: 'הצפנה מקצה לקצה, תקן HIPAA, גישה מוגבלת לרופא בלבד, audit log מלא', color: 'from-red-500 to-rose-600' },
            ].map(f => (
              <div key={f.title} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} text-white flex items-center justify-center shadow-lg mb-5`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TESTIMONIALS ═══════════════════════ */}
      <section className="py-20 md:py-28 px-4 sm:px-6 bg-gradient-to-b from-blue-50/50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-bold text-teal-600 tracking-wide">מה אומרים עלינו</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">193+ ביקורות מאומתות</h2>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[1, 2, 3, 4, 5].map(i => (
                <svg key={i} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-sm font-bold text-gray-700 mr-2">4.9 מתוך 5</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TESTIMONIALS.slice(0, 3).map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
                    <span className="text-white text-sm font-bold" aria-hidden="true">{t.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Second row — 2 cards centered */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-4xl mx-auto">
            {TESTIMONIALS.slice(3, 5).map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
                    <span className="text-white text-sm font-bold" aria-hidden="true">{t.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FAQ ═══════════════════════ */}
      <section className="py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-bold text-teal-600 tracking-wide">שאלות נפוצות</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">יש לך שאלה?</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-blue-200 transition-colors duration-300">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none text-right">
                  <span className="font-bold text-gray-900 text-sm sm:text-base">{faq.q}</span>
                  <svg className="w-5 h-5 text-gray-400 shrink-0 mr-4 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </summary>
                <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA — PATIENTS ═══════════════════════ */}
      <section className="py-20 md:py-24 px-4 sm:px-6 bg-gradient-to-bl from-blue-600 via-blue-700 to-teal-700 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-teal-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">מוכן לקבל ייעוץ רפואי?</h2>
          <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto">הרשם בחינם, בחר רופא מומחה, ושוחח בוידאו — הכל מהבית.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register" className="group bg-white text-blue-700 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1">
              קבע תור עכשיו — חינם
              <span className="inline-block mr-2 transition-transform duration-300 group-hover:-translate-x-1">←</span>
            </Link>
            <Link href="/specialties" className="border-2 border-white/30 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-white/10 transition-all duration-300">
              עיין בהתמחויות
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA — CLINICS ═══════════════════════ */}
      <section className="py-16 px-4 sm:px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-2xl font-black text-gray-900">בעלי מרפאה?</h3>
            <p className="text-gray-500 mt-2 max-w-lg">הפלטפורמה זמינה כ-SaaS במיתוג אישי למרפאות. כולל AI, וידאו, שאלונים, תשלומים, דוחות ועוד.</p>
          </div>
          <Link href="/onboarding" className="shrink-0 bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all duration-300 hover:-translate-y-0.5 shadow-lg">
            התחל ניסיון חינם — 14 ימים
          </Link>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="py-16 px-4 sm:px-6 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-black">T</span>
                </div>
                <span className="text-lg font-black text-white">טלמדיסן</span>
              </div>
              <p className="text-gray-400 leading-relaxed">פלטפורמת ייעוץ רפואי אונליין מתקדמת. רופאים מומחים, AI חכם, חוויה מעולה.</p>
            </div>

            <div>
              <h5 className="font-bold text-white mb-4">התמחויות</h5>
              <div className="space-y-2">
                {SPECIALTIES.slice(0, 6).map(s => (
                  <p key={s.id}><Link href={`/specialties/${s.id}`} className="text-gray-400 hover:text-white transition-colors">{s.label}</Link></p>
                ))}
              </div>
            </div>

            <div>
              <h5 className="font-bold text-white mb-4">קישורים</h5>
              <div className="space-y-2">
                <p><Link href="/doctors" className="text-gray-400 hover:text-white transition-colors">הרופאים שלנו</Link></p>
                <p><Link href="/blog" className="text-gray-400 hover:text-white transition-colors">בלוג רפואי</Link></p>
                <p><Link href="/auth/register" className="text-gray-400 hover:text-white transition-colors">הרשמה</Link></p>
                <p><Link href="/auth/login" className="text-gray-400 hover:text-white transition-colors">התחברות</Link></p>
                <p><Link href="/onboarding" className="text-gray-400 hover:text-white transition-colors">למרפאות</Link></p>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-white mb-4">משפטי</h5>
              <div className="space-y-2">
                <p><Link href="/terms" className="text-gray-400 hover:text-white transition-colors">תנאי שימוש</Link></p>
                <p><Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">מדיניות פרטיות</Link></p>
                <p><Link href="/accessibility" className="text-gray-400 hover:text-white transition-colors">הצהרת נגישות</Link></p>
              </div>
              <h5 className="font-bold text-white mt-6 mb-2">צור קשר</h5>
              <p><a href="mailto:support@telemed.co.il" className="text-gray-400 hover:text-white transition-colors">support@telemed.co.il</a></p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>&copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.</p>
            <div className="flex items-center gap-4">
              <span>תקן HIPAA</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" aria-hidden="true" />
              <span>SSL מאובטח</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" aria-hidden="true" />
              <span>פלטפורמה ישראלית</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
