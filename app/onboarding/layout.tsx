import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'הרשמת מרפאה',
  description: 'הקימו מרפאה דיגיטלית תוך דקות. ייעוץ וידאו, AI חכם, שאלונים דינמיים ועוד.',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black text-blue-600 hover:text-blue-700 transition-colors">CANNA</Link>
          <p className="text-gray-500 mt-1">הקמת מרפאה חדשה</p>
        </div>
        {children}
      </div>
    </div>
  )
}
