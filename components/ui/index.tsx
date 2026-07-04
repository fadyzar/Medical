import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'
import { cn, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'

// ==================== BUTTON ====================
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, style, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2'
    const s = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' }

    // primary + secondary use CSS vars injected by DashboardLayout (fall back to blue/gray)
    if (variant === 'primary') {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={cn(base, s[size], 'text-white shadow-sm brand-btn-primary', className)}
          style={{ backgroundColor: 'var(--brand-primary, #2563eb)', ...style }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.88)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}
          {...props}
        >
          {loading && <Spinner size="sm" />}
          {children}
        </button>
      )
    }

    if (variant === 'secondary') {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={cn(base, s[size], 'text-white shadow-sm', className)}
          style={{ backgroundColor: 'var(--brand-secondary, #6b7280)', ...style }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.88)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}
          {...props}
        >
          {loading && <Spinner size="sm" />}
          {children}
        </button>
      )
    }

    const staticVariants = {
      outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      danger: 'bg-rose-600 text-white hover:bg-rose-700',
    }

    return (
      <button ref={ref} disabled={disabled || loading} className={cn(base, staticVariants[variant as keyof typeof staticVariants], s[size], className)} style={style} {...props}>
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ==================== INPUT ====================
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, '-').toLowerCase()
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">{label}</label>}
        <input ref={ref} id={inputId} className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
          'placeholder:text-slate-400',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
          className
        )} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />
        {error && <p id={`${inputId}-error`} className="text-sm text-red-600" role="alert">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ==================== TEXTAREA ====================
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, '-').toLowerCase()
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">{label}</label>}
        <textarea ref={ref} id={inputId} className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors resize-y min-h-[80px]',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
          className
        )} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />
        {error && <p id={`${inputId}-error`} className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ==================== SELECT ====================
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, '-').toLowerCase()
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">{label}</label>}
        <select ref={ref} id={inputId} className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-sm bg-white transition-colors',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          error ? 'border-red-300' : 'border-slate-200',
          className
        )} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {error && <p id={`${inputId}-error`} className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

// ==================== CARD ====================
// Premium healthcare surface — shared by every dashboard section.
export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]', className)} {...props}>{children}</div>
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 py-5 border-b border-slate-100', className)}>{children}</div>
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>
}

// ==================== BADGE ====================
export function Badge({ children, variant = 'default', className }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const v = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
    info: 'bg-blue-50 text-blue-700',
  }
  return <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', v[variant], className)}>{children}</span>
}

// ==================== SPINNER ====================
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <div className={cn('animate-spin rounded-full border-2 border-slate-200 border-t-blue-600', s[size], className)} role="status" aria-label="טוען">
      <span className="sr-only">טוען...</span>
    </div>
  )
}

// ==================== PAGE LOADING ====================
export function PageLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded-lg w-40" />
          <div className="h-4 bg-gray-100 rounded-lg w-24" />
        </div>
        <div className="h-10 bg-gray-200 rounded-lg w-32" />
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="h-4 bg-slate-100 rounded w-20 mb-3" />
            <div className="h-7 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
      {/* Card skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="h-5 bg-slate-200 rounded w-32" />
        </div>
        <div className="divide-y divide-slate-50">
          {[1, 2, 3].map(i => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-48" />
                <div className="h-3 bg-slate-100 rounded w-32" />
              </div>
              <div className="h-6 bg-slate-100 rounded-full w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== EMPTY STATE ====================
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-50 ring-8 ring-slate-50/60 flex items-center justify-center mx-auto mb-4 text-slate-300 [&>svg]:w-7 [&>svg]:h-7">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description && <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ==================== STAT CARD ====================
export { Breadcrumb } from './Breadcrumb'

export function StatCard({ label, value, icon, color = 'blue' }: { label: string; value: string | number; icon?: ReactNode; color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' }) {
  const textColors = { blue: 'text-blue-600', green: 'text-emerald-600', orange: 'text-amber-600', red: 'text-rose-600', purple: 'text-violet-600' }
  const bgColors = { blue: 'bg-blue-50 ring-blue-100', green: 'bg-emerald-50 ring-emerald-100', orange: 'bg-amber-50 ring-amber-100', red: 'bg-rose-50 ring-rose-100', purple: 'bg-violet-50 ring-violet-100' }
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 font-medium truncate">{label}</p>
          <p className="text-2xl font-black text-slate-900 mt-1.5 tracking-tight">{value}</p>
        </div>
        {icon && (
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ring-4', bgColors[color], textColors[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

// Re-export AppointmentTimeline from separate file
export { AppointmentTimeline } from './AppointmentTimeline'

// ==================== STATUS CHIP ====================
// Consistent appointment-status pill used across every dashboard.
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const label = STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-slate-700'
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', color, className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

// ==================== SKELETON ====================
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-gray-100', className)} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>
    </div>
  )
}

/** Premium dashboard skeleton — mirrors the real dashboard grid while loading. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" dir="rtl" aria-busy="true" aria-label="טוען">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}
