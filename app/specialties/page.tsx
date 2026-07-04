import type { Metadata } from 'next'
import Link from 'next/link'
import { SPECIALTIES } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'

export const metadata: Metadata = {
  title: 'התמחויות רפואיות — ייעוץ אונליין',
  description: 'ייעוץ רפואי אונליין בכל ההתמחויות: רפואה כללית, עור, אורתופדיה, קרדיולוגיה, נוירולוגיה, פסיכיאטריה ועוד. רופאים מומחים בשיחת וידאו.',
  keywords: ['התמחויות רפואיות', 'ייעוץ אונליין', 'רופא מומחה', 'CANNA', 'שיחת וידאו'],
  openGraph: {
    title: 'התמחויות רפואיות — ייעוץ אונליין | CANNA',
    description: 'ייעוץ רפואי אונליין בכל ההתמחויות. רופאים מומחים בשיחת וידאו.',
    type: 'website',
    locale: 'he_IL',
    url: `${BASE_URL}/specialties`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'התמחויות רפואיות — ייעוץ אונליין | CANNA',
    description: 'ייעוץ רפואי אונליין בכל ההתמחויות. רופאים מומחים בשיחת וידאו.',
  },
  alternates: { canonical: `${BASE_URL}/specialties` },
}

const SPECIALTY_DETAILS: Record<string, { icon: string; description: string }> = {
  general: { icon: '🏥', description: 'רופא משפחה לכל בעיה רפואית — אבחנה, מרשם, הפניה לבדיקות' },
  dermatology: { icon: '🔬', description: 'אבחון בעיות עור, פריחה, אקנה, שומות חשודות ועוד' },
  orthopedics: { icon: '🦴', description: 'כאבי גב, ברכיים, מפרקים, פציעות ספורט' },
  cardiology: { icon: '❤️', description: 'לחץ דם, כולסטרול, הפרעות קצב, בריאות הלב' },
  ent: { icon: '👂', description: 'כאבי אוזניים, סחרחורת, נחירות, בעיות שמיעה' },
  neurology: { icon: '🧠', description: 'כאבי ראש, מיגרנה, נימול, סחרחורת, בעיות זיכרון' },
  gastro: { icon: '🫁', description: 'כאבי בטן, צרבת, בעיות עיכול, IBS' },
  urology: { icon: '🔬', description: 'בעיות במערכת השתן, דלקות, אבנים בכליות' },
  gynecology: { icon: '👩‍⚕️', description: 'בעיות מחזור, הריון, גיל המעבר, בריאות האישה' },
  ophthalmology: { icon: '👁️', description: 'בעיות ראייה, עיניים יבשות, אדמומיות, גלאוקומה' },
  psychiatry: { icon: '🧠', description: 'חרדה, דיכאון, הפרעות שינה, ADHD' },
  endocrinology: { icon: '⚕️', description: 'סוכרת, בלוטת תריס, הפרעות הורמונליות' },
  pulmonology: { icon: '🫁', description: 'אסתמה, קוצר נשימה, שיעול כרוני, COPD' },
  pediatrics: { icon: '👶', description: 'חום, שיעול, פריחה, בעיות התנהגות אצל ילדים' },
  pain: { icon: '💊', description: 'כאב כרוני, פיברומיאלגיה, כאבי עצבים' },
  oncology: { icon: '🔬', description: 'חוות דעת שנייה, מעקב אחרי טיפול, פענוח בדיקות' },
}

export default function SpecialtiesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: 'CANNA — התמחויות רפואיות',
    url: `${BASE_URL}/specialties`,
    description: 'ייעוץ רפואי אונליין בכל ההתמחויות',
    areaServed: { '@type': 'Country', name: 'Israel' },
    availableService: SPECIALTIES.map(s => ({
      '@type': 'MedicalProcedure',
      name: `ייעוץ ${s.label} אונליין`,
      procedureType: 'http://schema.org/NoninvasiveProcedure',
    })),
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-blue-600">CANNA</Link>
          <div className="flex items-center gap-4">
            <Link href="/specialties" className="text-sm text-blue-600 font-medium">התמחויות</Link>
            <Link href="/doctors" className="text-sm text-slate-600 hover:text-slate-900">הרופאים שלנו</Link>
            <Link href="/blog" className="text-sm text-slate-600 hover:text-slate-900">בלוג</Link>
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">התחברות</Link>
            <Link href="/auth/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">הרשמה חינם</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
            כל ההתמחויות
            <br />
            <span className="text-blue-600">ייעוץ רפואי אונליין</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            רופאים מומחים ב-16 התמחויות רפואיות זמינים לך בשיחת וידאו. בחר התמחות וקבע תור עכשיו.
          </p>
        </div>
      </section>

      {/* Specialties Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {SPECIALTIES.map(s => {
              const details = SPECIALTY_DETAILS[s.id]
              return (
                <Link
                  key={s.id}
                  href={`/specialties/${s.id}`}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-lg hover:border-blue-200 transition-all"
                >
                  <div className="text-4xl mb-4" aria-hidden="true">{details?.icon || '🩺'}</div>
                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{s.label}</h2>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{details?.description || 'ייעוץ רפואי אונליין עם מומחים'}</p>
                  <div className="mt-4 text-sm font-medium text-blue-600 group-hover:underline">
                    למידע נוסף ←
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-black mb-4">לא בטוח לאיזה מומחה לפנות?</h2>
          <p className="text-blue-100 mb-8 text-lg">קבע תור לרופא כללי והוא יכוון אותך להתמחות המתאימה</p>
          <Link href="/auth/register" className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-50 transition-colors inline-block">
            קבע תור עכשיו
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h5 className="font-bold text-white mb-3">CANNA</h5>
            <p>פלטפורמת ייעוץ רפואי אונליין מתקדמת</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">התמחויות</h5>
            {SPECIALTIES.slice(0, 5).map(s => (
              <p key={s.id}><Link href={`/specialties/${s.id}`} className="hover:text-white">{s.label}</Link></p>
            ))}
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">קישורים</h5>
            <p><Link href="/doctors" className="hover:text-white">הרופאים שלנו</Link></p>
            <p><Link href="/auth/register" className="hover:text-white">הרשמה</Link></p>
            <p><Link href="/auth/login" className="hover:text-white">התחברות</Link></p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">משפטי</h5>
            <p><Link href="/terms" className="hover:text-white">תנאי שימוש</Link></p>
            <p><Link href="/privacy" className="hover:text-white">מדיניות פרטיות</Link></p>
            <p><Link href="/accessibility" className="hover:text-white">נגישות</Link></p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-slate-800 text-center text-xs">
          &copy; {new Date().getFullYear()} CANNA. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
