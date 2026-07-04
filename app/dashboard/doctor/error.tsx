'use client'

import { Button } from '@/components/ui'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-3" aria-hidden="true">
        <svg className="w-12 h-12 text-slate-400 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">משהו השתבש</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">{error.message || 'שגיאה לא צפויה. נסה לרענן את הדף.'}</p>
      <Button onClick={reset} variant="outline">נסה שוב</Button>
    </div>
  )
}
