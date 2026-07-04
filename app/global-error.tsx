'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">שגיאה קריטית</h2>
          <p className="text-slate-500 text-sm mb-4">{error.message}</p>
          <button onClick={reset} className="bg-blue-600 text-white px-6 py-2 rounded-lg">נסה שוב</button>
          <a href="/" className="block mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors">חזרה לדף הבית</a>
        </div>
      </body>
    </html>
  )
}
