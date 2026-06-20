import type { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'

export const metadata: Metadata = {
  title: 'צור קשר',
  description: 'דברו איתנו — צוות CANNA זמין לכל שאלה על הקמת מרפאה דיגיטלית, תמחור, הטמעה ותמיכה.',
  alternates: { canonical: `${BASE_URL}/contact` },
}

const CONTACTS = [
  { icon: '📧', label: 'אימייל', value: 'medical@cannaforyou.net', href: 'mailto:medical@cannaforyou.net' },
  { icon: '🏥', label: 'מרפאות ושיתופי פעולה', value: 'medical@cannaforyou.net', href: 'mailto:medical@cannaforyou.net' },
  { icon: '🌐', label: 'אתר', value: 'cannaforyou.net', href: 'https://cannaforyou.net' },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-blue-600">CANNA</Link>
          <div className="flex items-center gap-4">
            <Link href="/specialties" className="text-sm text-gray-600 hover:text-gray-900">התמחויות</Link>
            <Link href="/doctors" className="text-sm text-gray-600 hover:text-gray-900">הרופאים שלנו</Link>
            <Link href="/for-clinics" className="text-sm text-gray-600 hover:text-gray-900">למרפאות</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">התחברות</Link>
          </div>
        </div>
      </nav>

      <section className="py-20 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">דברו איתנו</h1>
          <p className="text-lg text-gray-500">
            יש לכם שאלה על הקמת מרפאה דיגיטלית, תמחור או הטמעה? צוות CANNA כאן בשבילכם.
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto grid gap-4">
          {CONTACTS.map(c => (
            <a key={c.label} href={c.href}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition-all">
              <span className="text-3xl shrink-0">{c.icon}</span>
              <div>
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className="font-bold text-gray-900">{c.value}</p>
              </div>
            </a>
          ))}
        </div>
        <div className="max-w-2xl mx-auto text-center mt-12">
          <Link href="/for-clinics" className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors inline-block">
            למידע על תוכניות ומחירים
          </Link>
        </div>
      </section>

      <footer className="py-12 px-4 bg-gray-900 text-gray-400 mt-12">
        <div className="max-w-6xl mx-auto text-center text-xs">
          &copy; {new Date().getFullYear()} CANNA. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
