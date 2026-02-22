import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'טלמדיסן — ייעוץ רפואי אונליין | הפלטפורמה המובילה',
  description: 'ייעוץ רפואי אונליין בוידאו עם רופאים מומחים. סיכומי AI חכמים, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה הרפואית המתקדמת בישראל.',
}

// ── SVG Icons ────────────────────────────────────────
function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}
function IconAI({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z" />
      <circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /><path d="M10 17h4" />
    </svg>
  )
}
function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}
function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
function IconCreditCard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}
function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function IconStethoscope({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3" />
      <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" />
    </svg>
  )
}

const features = [
  { icon: IconVideo, title: 'ייעוץ וידאו', desc: 'שיחת וידאו באיכות גבוהה עם רופא מומחה, מכל מקום', color: 'bg-blue-50 text-blue-600' },
  { icon: IconAI, title: 'AI חכם', desc: 'סוכני בינה מלאכותית שמסייעים לרופא — מיון, סיכום, מרשם', color: 'bg-purple-50 text-purple-600' },
  { icon: IconClipboard, title: 'שאלונים דינמיים', desc: 'שאלון מקדים חכם שמתאים את עצמו לתלונה שלך', color: 'bg-teal-50 text-teal-600' },
  { icon: IconFile, title: 'מסמכים מאובטחים', desc: 'העלה בדיקות, תמונות ומסמכים — מוצפן ומאובטח', color: 'bg-green-50 text-green-600' },
  { icon: IconCreditCard, title: 'תשלום פשוט', desc: 'תשלום בכרטיס אשראי, חשבונית אוטומטית', color: 'bg-orange-50 text-orange-600' },
  { icon: IconLock, title: 'פרטיות מלאה', desc: 'הצפנה מקצה לקצה, תקן HIPAA, audit log מלא', color: 'bg-red-50 text-red-600' },
]

const specialties = [
  'רפואה כללית', 'עור ומין', 'אורתופדיה', 'קרדיולוגיה', 'א.א.ג',
  'נוירולוגיה', 'גסטרו', 'אורולוגיה', 'גינקולוגיה', 'עיניים',
  'פסיכיאטריה', 'ילדים', 'ריאות', 'רפואת כאב',
]

const stats = [
  { value: '10,000+', label: 'ייעוצים מוצלחים' },
  { value: '50+', label: 'רופאים מומחים' },
  { value: '4.9/5', label: 'דירוג ממוצע' },
  { value: '24/7', label: 'זמינות מלאה' },
]

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-teal-500 rounded-xl flex items-center justify-center">
              <IconStethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black text-gray-900">טלמדיסן</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/doctors" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors">הרופאים שלנו</Link>
            <Link href="/specialties" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors">התמחויות</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">התחברות</Link>
            <Link href="/auth/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">הרשמה חינם</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 lg:py-28 px-4 bg-gradient-to-b from-blue-50/50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            הפלטפורמה הרפואית המתקדמת בישראל
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight">
            ייעוץ רפואי אונליין
            <br />
            <span className="bg-gradient-to-l from-blue-600 to-teal-500 bg-clip-text text-transparent">עם רופאים מומחים</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-500 mt-6 max-w-2xl mx-auto leading-relaxed">
            קבל ייעוץ רפואי בוידאו תוך דקות. סוכני AI מתקדמים מסייעים לרופא להכין חוות דעת מדויקת ומהירה.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link href="/auth/register" className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30">
              קבע תור עכשיו — חינם
            </Link>
            <Link href="/doctors" className="border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-xl text-lg font-bold hover:border-gray-300 hover:bg-gray-50 transition-colors">
              הרופאים שלנו
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <IconCheck className="w-4 h-4 text-green-500" />
              ללא תור מוקדם
            </span>
            <span className="flex items-center gap-1.5">
              <IconCheck className="w-4 h-4 text-green-500" />
              סיכום AI
            </span>
            <span className="flex items-center gap-1.5">
              <IconCheck className="w-4 h-4 text-green-500" />
              מאובטח HIPAA
            </span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black text-blue-600">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h3 className="text-3xl font-black text-gray-900">למה טלמדיסן?</h3>
            <p className="text-gray-500 mt-2 text-lg">הטכנולוגיה הטובה ביותר לייעוץ רפואי מרחוק</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color} group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specialties */}
      <section className="py-20 px-4 bg-gray-50/70">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-black text-gray-900 mb-3">התמחויות</h3>
          <p className="text-gray-500 mb-8">רופאים מומחים בכל תחום</p>
          <div className="flex flex-wrap justify-center gap-3">
            {specialties.map(s => (
              <span key={s} className="px-4 py-2 bg-white text-blue-700 rounded-full text-sm font-medium border border-blue-100 hover:bg-blue-50 transition-colors">{s}</span>
            ))}
          </div>
          <Link href="/specialties" className="inline-flex items-center gap-2 text-blue-600 font-medium text-sm mt-6 hover:text-blue-700 transition-colors">
            צפה בכל ההתמחויות
            <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h3 className="text-3xl font-black text-gray-900">איך זה עובד?</h3>
            <p className="text-gray-500 mt-2">ארבעה שלבים פשוטים עד לייעוץ</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { num: '1', title: 'הרשמה', desc: 'צור חשבון בחינם תוך דקה' },
              { num: '2', title: 'בחר רופא', desc: 'בחר התמחות ורופא מומחה' },
              { num: '3', title: 'שאלון + מסמכים', desc: 'מלא שאלון והעלה מסמכים' },
              { num: '4', title: 'ייעוץ בוידאו', desc: 'שוחח עם הרופא בוידאו' },
            ].map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 left-0 w-full h-0.5 bg-blue-100 -z-10" />
                )}
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto relative shadow-lg shadow-blue-600/25">{s.num}</div>
                <h4 className="font-bold text-gray-900 mt-4">{s.title}</h4>
                <p className="text-gray-500 text-sm mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 px-4 bg-gray-50/70">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="flex items-center justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map(i => (
                <svg key={i} className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
            <blockquote className="text-lg text-gray-700 leading-relaxed">
              &ldquo;שירות מדהים. תוך דקות הייתי עם רופא מומחה שנתן לי טיפול מקצועי ומפורט. הסיכום שקיבלתי אחרי הייעוץ היה מצוין. ממליץ בחום!&rdquo;
            </blockquote>
            <div className="mt-4">
              <p className="font-bold text-gray-900">דוד כהן</p>
              <p className="text-sm text-gray-500">מטופל מרוצה, תל אביב</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA for clinics */}
      <section className="py-20 px-4 bg-gradient-to-l from-blue-700 to-teal-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-black mb-4">בעלי מרפאה?</h3>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">הפלטפורמה שלנו זמינה כ-SaaS במיתוג אישי למרפאות. כולל AI, וידאו, שאלונים, תשלומים ועוד.</p>
          <Link href="/auth/register" className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-50 transition-colors inline-block shadow-lg">
            התחל ניסיון חינם — 14 ימים
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <IconStethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg">טלמדיסן</span>
            </div>
            <p className="leading-relaxed">פלטפורמת ייעוץ רפואי אונליין מתקדמת</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">שירותים</h5>
            <div className="space-y-1.5">
              <p>ייעוץ וידאו</p><p>סיכומי AI</p><p>שאלונים</p><p>מסמכים</p>
            </div>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">למרפאות</h5>
            <div className="space-y-1.5">
              <p>SaaS מותאם אישית</p><p>מיתוג אישי</p><p>API</p>
            </div>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">משפטי</h5>
            <div className="space-y-1.5">
              <p><Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link></p>
              <p><Link href="/privacy" className="hover:text-white transition-colors">מדיניות פרטיות</Link></p>
              <p><Link href="/accessibility" className="hover:text-white transition-colors">נגישות</Link></p>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          &copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
