import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
      outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
      ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      danger: 'bg-red-600 text-white hover:bg-red-700',
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
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
        <input ref={ref} id={inputId} className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
          'placeholder:text-gray-400',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white',
          className
        )} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />
        {error && <p id={`${inputId}-error`} className="text-sm text-red-600" role="alert">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
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
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
        <textarea ref={ref} id={inputId} className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors resize-y min-h-[80px]',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white',
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
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
        <select ref={ref} id={inputId} className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-sm bg-white transition-colors',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          error ? 'border-red-300' : 'border-gray-300',
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
export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)} {...props}>{children}</div>
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 py-4 border-b border-gray-100', className)}>{children}</div>
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

// ==================== BADGE ====================
export function Badge({ children, variant = 'default', className }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const v = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  }
  return <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', v[variant], className)}>{children}</span>
}

// ==================== SPINNER ====================
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <div className={cn('animate-spin rounded-full border-2 border-gray-300 border-t-blue-600', s[size], className)} role="status" aria-label="טוען">
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
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-4 bg-gray-100 rounded w-20 mb-3" />
            <div className="h-7 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      {/* Card skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="h-5 bg-gray-200 rounded w-32" />
        </div>
        <div className="divide-y">
          {[1, 2, 3].map(i => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-48" />
                <div className="h-3 bg-gray-100 rounded w-32" />
              </div>
              <div className="h-6 bg-gray-100 rounded-full w-16" />
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
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ==================== STAT CARD ====================
export { Breadcrumb } from './Breadcrumb'

export function StatCard({ label, value, icon, color = 'blue' }: { label: string; value: string | number; icon?: ReactNode; color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' }) {
  const textColors = { blue: 'text-blue-600', green: 'text-green-600', orange: 'text-orange-600', red: 'text-red-600', purple: 'text-purple-600' }
  const bgColors = { blue: 'bg-blue-50', green: 'bg-green-50', orange: 'bg-orange-50', red: 'bg-red-50', purple: 'bg-purple-50' }
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className={cn('text-2xl font-bold mt-1', textColors[color])}>{value}</p>
        </div>
        {icon && (
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-xl', bgColors[color])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}

// Re-export AppointmentTimeline from separate file
export { AppointmentTimeline } from './AppointmentTimeline'
