import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'הדף לא נמצא (404)',
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4" dir="rtl">
      <div className="text-center max-w-lg">
        <p className="text-8xl font-black text-blue-600 mb-2">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">הדף לא נמצא</h1>
        <p className="text-gray-500 mb-8">
          מצטערים, הדף שחיפשת לא קיים או שהקישור שגוי. אפשר לנסות את אחד מהקישורים הבאים:
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
          <Link href="/" className="bg-white border rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all text-right">
            <span className="text-xl block mb-1" aria-hidden="true">🏠</span>
            <span className="font-medium text-gray-900">דף הבית</span>
          </Link>
          <Link href="/specialties" className="bg-white border rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all text-right">
            <span className="text-xl block mb-1" aria-hidden="true">🩺</span>
            <span className="font-medium text-gray-900">התמחויות</span>
          </Link>
          <Link href="/doctors" className="bg-white border rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all text-right">
            <span className="text-xl block mb-1" aria-hidden="true">👨‍⚕️</span>
            <span className="font-medium text-gray-900">הרופאים שלנו</span>
          </Link>
          <Link href="/blog" className="bg-white border rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all text-right">
            <span className="text-xl block mb-1" aria-hidden="true">📖</span>
            <span className="font-medium text-gray-900">בלוג רפואי</span>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
            חזרה לדף הבית
          </Link>
          <Link href="/auth/login" className="bg-white text-gray-700 border px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            התחברות
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          צריך עזרה? פנה אלינו ב-<a href="mailto:support@telemed.co.il" className="text-blue-600 hover:underline">support@telemed.co.il</a>
        </p>
      </div>
    </div>
  )
}
