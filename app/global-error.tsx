'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">שגיאה קריטית</h2>
          <p className="text-gray-500 text-sm mb-4">{error.message}</p>
          <button onClick={reset} className="bg-blue-600 text-white px-6 py-2 rounded-lg">נסה שוב</button>
        </div>
      </body>
    </html>
  )
}
