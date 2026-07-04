'use client'

import { Button } from '@/components/ui'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-3" aria-hidden="true">😔</div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">משהו השתבש</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">{error.message || 'שגיאה לא צפויה. נסה לרענן את הדף.'}</p>
      <Button onClick={reset} variant="outline">נסה שוב</Button>
    </div>
  )
}
