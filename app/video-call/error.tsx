'use client'

import { Button } from '@/components/ui'

export default function VideoCallError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white" dir="rtl">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="flex justify-center mb-1">
          <svg className="w-14 h-14 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        </div>
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
