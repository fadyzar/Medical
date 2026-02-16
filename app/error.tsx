'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">😔</div>
        <h2 className="text-xl font-bold mb-2">משהו השתבש</h2>
        <p className="text-gray-500 text-sm mb-6">{error.message || 'שגיאה לא צפויה'}</p>
        <button onClick={reset} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">נסה שוב</button>
      </div>
    </div>
  )
}
