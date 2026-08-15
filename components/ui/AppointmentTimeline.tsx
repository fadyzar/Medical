'use client'

import { cn } from '@/lib/utils'

interface TimelineStep {
  label: string
  status: 'completed' | 'current' | 'pending' | 'skipped'
  date?: string
  description?: string
}

interface AppointmentTimelineProps {
  status: string
  createdAt: string
  scheduledAt?: string | null
  videoStartedAt?: string | null
  completedAt?: string | null
  paymentStatus?: string | null
  className?: string
}

export function AppointmentTimeline({
  status,
  createdAt,
  scheduledAt,
  videoStartedAt,
  completedAt,
  paymentStatus,
  className,
}: AppointmentTimelineProps) {
  // Build timeline based on appointment status
  const steps: TimelineStep[] = []

  // Step 1: Created
  steps.push({
    label: 'בקשה נשלחה',
    status: 'completed',
    date: createdAt,
    description: 'הבקשה לתור התקבלה במערכת',
  })

  // Step 2: Doctor confirmed
  const doctorConfirmed = ['doctor_confirmed', 'payment_pending', 'paid', 'scheduled', 'ready', 'in_progress', 'completed'].includes(status)
  steps.push({
    label: 'אושר על ידי רופא',
    status: doctorConfirmed ? 'completed' : status === 'pending' ? 'current' : 'pending',
    description: doctorConfirmed ? 'הרופא אישר את התור' : 'ממתין לאישור רופא',
  })

  // Step 3: Payment (if required)
  if (paymentStatus) {
    const paymentCompleted = paymentStatus === 'completed'
    steps.push({
      label: 'תשלום',
      status: paymentCompleted ? 'completed' : status === 'payment_pending' ? 'current' : paymentStatus === 'failed' ? 'skipped' : 'pending',
      description: paymentCompleted ? 'התשלום בוצע בהצלחה' : paymentStatus === 'failed' ? 'התשלום נכשל' : 'ממתין לתשלום',
    })
  }

  // Step 4: Scheduled
  const isScheduled = scheduledAt && ['scheduled', 'ready', 'in_progress', 'completed'].includes(status)
  steps.push({
    label: 'קבעו תאריך ושעה',
    status: isScheduled ? 'completed' : ['paid', 'payment_pending', 'doctor_confirmed'].includes(status) ? 'current' : 'pending',
    date: scheduledAt || undefined,
    description: isScheduled ? `התור נקבע ל-${new Date(scheduledAt!).toLocaleDateString('he-IL')}` : 'ממתין לתיאום',
  })

  // Step 5: Video call
  const videoStarted = videoStartedAt && ['in_progress', 'completed'].includes(status)
  steps.push({
    label: 'שיחת וידאו',
    status: videoStarted ? 'completed' : status === 'ready' ? 'current' : completedAt ? 'skipped' : 'pending',
    date: videoStartedAt || undefined,
    description: videoStarted ? 'השיחה החלה' : status === 'ready' ? 'מוכן לשיחה' : 'טרם התחיל',
  })

  // Step 6: Completed
  steps.push({
    label: 'הושלם',
    status: completedAt ? 'completed' : status === 'in_progress' ? 'current' : 'pending',
    date: completedAt || undefined,
    description: completedAt ? 'הייעוץ הושלם בהצלחה' : 'טרם הושלם',
  })

  return (
    <div className={cn('relative', className)} role="list" aria-label="מסלול התור">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1
        const statusColor =
          step.status === 'completed'
            ? 'bg-green-500 border-green-500'
            : step.status === 'current'
            ? 'bg-teal-500 border-teal-500 ring-4 ring-teal-100'
            : step.status === 'skipped'
            ? 'bg-red-500 border-red-500'
            : 'bg-slate-200 border-slate-300'

        const lineColor = step.status === 'completed' ? 'bg-green-500' : 'bg-slate-200'

        return (
          <div key={idx} className="relative flex gap-4 pb-8 last:pb-0" role="listitem">
            {/* Timeline line */}
            {!isLast && (
              <div
                className={cn('absolute right-3 top-6 w-0.5 h-full', lineColor)}
                aria-hidden="true"
              />
            )}

            {/* Circle indicator */}
            <div className="relative z-10 flex-shrink-0">
              <div
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all duration-300',
                  statusColor
                )}
                aria-label={`${step.label}: ${
                  step.status === 'completed'
                    ? 'הושלם'
                    : step.status === 'current'
                    ? 'בתהליך'
                    : step.status === 'skipped'
                    ? 'דולג'
                    : 'ממתין'
                }`}
              >
                {step.status === 'completed' && (
                  <svg
                    className="w-full h-full text-white p-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {step.status === 'current' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" aria-hidden="true" />
                  </div>
                )}
                {step.status === 'skipped' && (
                  <svg
                    className="w-full h-full text-white p-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium transition-colors',
                  step.status === 'completed'
                    ? 'text-slate-900'
                    : step.status === 'current'
                    ? 'text-teal-600 font-bold'
                    : step.status === 'skipped'
                    ? 'text-red-600'
                    : 'text-slate-400'
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
              )}
              {step.date && (
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(step.date).toLocaleString('he-IL', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
