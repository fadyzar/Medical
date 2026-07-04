'use client'

import { BrandSupportEmail } from '@/components/branding/BrandProvider'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4" dir="rtl">
      <div className="text-center max-w-md">
        <p className="text-6xl font-black text-red-400 mb-2" aria-hidden="true">500</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">שגיאה בשרת</h2>
        <p className="text-gray-500 text-sm mb-6">
          {error.message || 'אירעה שגיאה לא צפויה. הצוות שלנו קיבל התראה ומטפל בעניין.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <button onClick={reset} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
            נסה שוב
          </button>
          <a href="/" className="bg-white text-gray-700 border px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            חזרה לדף הבית
          </a>
        </div>
        <p className="text-xs text-gray-400">
          אם הבעיה נמשכת, פנה אלינו ב-<BrandSupportEmail className="text-blue-600 hover:underline" />
        </p>
      </div>
    </div>
  )
}
