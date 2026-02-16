import type { Metadata } from 'next'
import Link from 'next/link'
import { SPECIALTIES } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'טלמדיסן — ייעוץ רפואי אונליין | הפלטפורמה המובילה',
  description: 'ייעוץ רפואי אונליין בוידאו עם רופאים מומחים. סיכומי AI חכמים, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה הרפואית המתקדמת בישראל.',
}

const features = [
  { icon: '🎥', title: 'ייעוץ וידאו', desc: 'שיחת וידאו באיכות גבוהה עם רופא מומחה, מכל מקום' },
  { icon: '🤖', title: 'AI חכם', desc: 'סוכני בינה מלאכותית שמסייעים לרופא — מיון, סיכום, מרשם' },
  { icon: '📝', title: 'שאלונים דינמיים', desc: 'שאלון מקדים חכם שמתאים את עצמו לתלונה שלך' },
  { icon: '📄', title: 'מסמכים מאובטחים', desc: 'העלה בדיקות, תמונות ומסמכים — מוצפן ומאובטח' },
  { icon: '💳', title: 'תשלום פשוט', desc: 'תשלום בכרטיס אשראי, חשבונית אוטומטית' },
  { icon: '🔒', title: 'פרטיות מלאה', desc: 'הצפנה מקצה לקצה, תקן HIPAA, audit log מלא' },
]

// Using SPECIALTIES from lib/utils for consistency

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-black text-blue-600">טלמדיסן</h1>
          <div className="flex items-center gap-4">
            <Link href="/doctors" className="text-sm text-gray-600 hover:text-gray-900">הרופאים שלנו</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">התחברות</Link>
            <Link href="/onboarding" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">הרשמת מרפאה</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-black text-gray-900 leading-tight">
            ייעוץ רפואי אונליין
            <br />
            <span className="text-blue-600">עם רופאים מומחים</span>
          </h2>
          <p className="text-xl text-gray-500 mt-6 max-w-2xl mx-auto">
            קבל ייעוץ רפואי בוידאו תוך דקות. סוכני AI מתקדמים מסייעים לרופא להכין חוות דעת מדויקת ומהירה.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link href="/auth/register" className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25">
              קבע תור עכשיו — חינם
            </Link>
            <Link href="/doctors" className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-bold hover:border-gray-400 transition-colors">
              הרופאים שלנו
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
            <span>✅ ללא תור מוקדם</span>
            <span>✅ סיכום AI</span>
            <span>✅ מאובטח HIPAA</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50 px-4">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-black text-center mb-12">למה טלמדיסן?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map(f => (
              <div key={f.title} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h4 className="text-lg font-bold mb-2">{f.title}</h4>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specialties */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-black mb-8">התמחויות</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {SPECIALTIES.map(s => (
              <Link key={s.id} href={`/specialties/${s.id}`} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors">{s.label}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-black text-center mb-12">איך זה עובד?</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { num: '1', title: 'הרשמה', desc: 'צור חשבון בחינם תוך דקה' },
              { num: '2', title: 'בחר רופא', desc: 'בחר התמחות ורופא מומחה' },
              { num: '3', title: 'שאלון + מסמכים', desc: 'מלא שאלון והעלה מסמכים' },
              { num: '4', title: 'ייעוץ בוידאו', desc: 'שוחח עם הרופא בוידאו' },
            ].map(s => (
              <div key={s.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto">{s.num}</div>
                <h4 className="font-bold mt-3">{s.title}</h4>
                <p className="text-gray-500 text-sm mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for clinics */}
      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-black mb-4">בעלי מרפאה?</h3>
          <p className="text-xl text-blue-100 mb-8">הפלטפורמה שלנו זמינה כ-SaaS במיתוג אישי למרפאות. כולל AI, וידאו, שאלונים, תשלומים ועוד.</p>
          <Link href="/onboarding" className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-50 transition-colors inline-block">
            התחל ניסיון חינם — 14 ימים
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h5 className="font-bold text-white mb-3">טלמדיסן</h5>
            <p>פלטפורמת ייעוץ רפואי אונליין מתקדמת</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">שירותים</h5>
            <p>ייעוץ וידאו</p><p>סיכומי AI</p><p>שאלונים</p><p>מסמכים</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">למרפאות</h5>
            <p>SaaS מותאם אישית</p><p>מיתוג אישי</p><p>API</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">משפטי</h5>
            <p><Link href="/terms" className="hover:text-white">תנאי שימוש</Link></p>
            <p><Link href="/privacy" className="hover:text-white">מדיניות פרטיות</Link></p>
            <p><Link href="/accessibility" className="hover:text-white">נגישות</Link></p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          © {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
