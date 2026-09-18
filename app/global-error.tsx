'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">שגיאה קריטית</h2>
          <p className="text-slate-500 text-sm mb-4">{error.message}</p>
          <button onClick={reset} className="bg-teal-600 text-white px-6 py-2 rounded-lg">נסה שוב</button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              The root layout itself failed, so next/link cannot be relied on — this must be a
// full page load. Intentionally not next/link. */}
          <a href="/" className="block mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors">חזרה לדף הבית</a>
        </div>
      </body>
    </html>
  )
}
