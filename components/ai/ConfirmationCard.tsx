'use client'

import { cn } from '@/lib/utils'

export type ConfirmationCardData = {
  actionId: string
  title: string
  intent: 'create' | 'update' | 'destructive'
  rows: Array<{ label: string; value: string }>
  warning?: string
  confirmLabel: string
}

/**
 * The gate between the assistant proposing something and it happening.
 *
 * Shows only what the user needs to check — never a tool name, an id or JSON.
 * Once resolved it stays on screen as a record of what was decided, so the
 * transcript still reads correctly when scrolled back through.
 */
export function ConfirmationCard({
  card, state, onConfirm, onCancel,
}: {
  card: ConfirmationCardData
  state: 'pending' | 'working' | 'confirmed' | 'cancelled' | 'failed'
  onConfirm: () => void
  onCancel: () => void
}) {
  const destructive = card.intent === 'destructive'
  const resolved = state === 'confirmed' || state === 'cancelled' || state === 'failed'

  return (
    <div
      className={cn(
        'rounded-2xl border-2 overflow-hidden transition-colors',
        destructive ? 'border-red-200 bg-red-50/60' : 'border-teal-200 bg-teal-50/60',
        resolved && 'border-slate-200 bg-slate-50 opacity-90',
      )}
    >
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
              resolved ? 'bg-slate-200' : destructive ? 'bg-red-100' : 'bg-teal-100',
            )}
            aria-hidden="true"
          >
            {state === 'confirmed' ? (
              <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : destructive ? (
              <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            )}
          </span>
          <h3 className="text-sm font-bold text-slate-900">{card.title}</h3>
        </div>

        <dl className="space-y-1.5">
          {card.rows.map(row => (
            <div key={row.label} className="flex gap-3 text-sm">
              <dt className="text-slate-500 shrink-0 w-24">{row.label}</dt>
              <dd className="text-slate-900 font-medium flex-1 break-words">{row.value}</dd>
            </div>
          ))}
        </dl>

        {card.warning && !resolved && (
          <p className={cn('mt-3 text-xs rounded-lg px-3 py-2', destructive ? 'bg-red-100 text-red-800' : 'bg-amber-50 text-amber-800')}>
            {card.warning}
          </p>
        )}
      </div>

      <div className="px-4 py-2.5 border-t bg-white/70 flex items-center gap-2">
        {state === 'pending' || state === 'working' ? (
          <>
            <button
              onClick={onConfirm}
              disabled={state === 'working'}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60',
                destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700',
              )}
            >
              {state === 'working' ? 'מבצע…' : card.confirmLabel}
            </button>
            <button
              onClick={onCancel}
              disabled={state === 'working'}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60"
            >
              בטל
            </button>
          </>
        ) : (
          <p className={cn(
            'text-sm font-medium',
            state === 'confirmed' ? 'text-green-700' : state === 'failed' ? 'text-red-600' : 'text-slate-500',
          )}>
            {state === 'confirmed' ? 'בוצע' : state === 'failed' ? 'הפעולה נכשלה' : 'בוטל — לא בוצע שינוי'}
          </p>
        )}
      </div>
    </div>
  )
}
