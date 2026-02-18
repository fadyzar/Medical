'use client'

import { Button } from '@/components/ui'

export default function VideoCallError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white" dir="rtl">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold">שגיאה בטעינת שיחת הוידאו</h2>
        <p className="text-gray-400 text-sm">
          {error.message || 'אירעה שגיאה בלתי צפויה. אנא נסו שוב.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline" className="border-gray-600 text-white hover:bg-gray-800">
            נסה שוב
          </Button>
          <Button onClick={() => window.history.back()} variant="ghost" className="text-gray-400">
            חזרה
          </Button>
        </div>
      </div>
    </div>
  )
}
