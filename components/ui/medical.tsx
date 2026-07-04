'use client'

/**
 * CANNA premium healthcare component language.
 * One consistent visual system: rounded-2xl surfaces, soft layered shadows,
 * calm medical palette, generous spacing. White-label safe (uses brand where
 * relevant, neutral medical tones otherwise).
 */

import { type ReactNode } from 'react'
import { cn, formatDateTime, SPECIALTIES } from '@/lib/utils'
import { StatusChip } from '@/components/ui'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

function specialtyLabel(id?: string | null): string {
  if (!id) return ''
  return SPECIALTIES.find(s => s.id === id)?.label || id
}

// ── Medical palette ──────────────────────────────────────
export const MED = {
  blue: '#2563eb', teal: '#0d9488', emerald: '#059669',
  amber: '#d97706', rose: '#e11d48', violet: '#7c3aed', slate: '#64748b',
}

type Accent = 'blue' | 'teal' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate'
const ACCENT: Record<Accent, { text: string; soft: string; ring: string; from: string; to: string }> = {
  blue:    { text: 'text-blue-600',    soft: 'bg-blue-50',    ring: 'ring-blue-100',    from: '#3b82f6', to: '#2563eb' },
  teal:    { text: 'text-teal-600',    soft: 'bg-teal-50',    ring: 'ring-teal-100',    from: '#14b8a6', to: '#0d9488' },
  emerald: { text: 'text-emerald-600', soft: 'bg-emerald-50', ring: 'ring-emerald-100', from: '#10b981', to: '#059669' },
  amber:   { text: 'text-amber-600',   soft: 'bg-amber-50',   ring: 'ring-amber-100',   from: '#f59e0b', to: '#d97706' },
  rose:    { text: 'text-rose-600',    soft: 'bg-rose-50',    ring: 'ring-rose-100',    from: '#f43f5e', to: '#e11d48' },
  violet:  { text: 'text-violet-600',  soft: 'bg-violet-50',  ring: 'ring-violet-100',  from: '#8b5cf6', to: '#7c3aed' },
  slate:   { text: 'text-slate-600',   soft: 'bg-slate-100',  ring: 'ring-slate-200',   from: '#64748b', to: '#475569' },
}

// ── Section header ───────────────────────────────────────
export function SectionHeader({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ── Surface card ─────────────────────────────────────────
export function Panel({ className, children, padded = true }: { className?: string; children: ReactNode; padded?: boolean }) {
  return (
    <div className={cn('rounded-2xl bg-white border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]', padded && 'p-5 sm:p-6', className)}>
      {children}
    </div>
  )
}

// ── Premium stat card ────────────────────────────────────
export function PremiumStat({ label, value, icon, accent = 'blue', hint, featured }: {
  label: string; value: string | number; icon?: ReactNode; accent?: Accent; hint?: string; featured?: boolean
}) {
  const a = ACCENT[accent]
  if (featured) {
    return (
      <div className="rounded-2xl p-5 text-white relative overflow-hidden shadow-lg" style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}>
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium">{label}</p>
            <p className="text-3xl font-black mt-2 tracking-tight">{value}</p>
            {hint && <p className="text-white/70 text-xs mt-1">{hint}</p>}
          </div>
          {icon && <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-xl">{icon}</div>}
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 font-medium truncate">{label}</p>
          <p className="text-2xl font-black text-slate-900 mt-1.5 tracking-tight">{value}</p>
          {hint && <p className={cn('text-xs mt-1 font-medium', a.text)}>{hint}</p>}
        </div>
        {icon && <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ring-4', a.soft, a.ring)}>{icon}</div>}
      </div>
    </div>
  )
}

// ── Medical badge ────────────────────────────────────────
export function MedicalBadge({ children, accent = 'slate', className }: { children: ReactNode; accent?: Accent; className?: string }) {
  const a = ACCENT[accent]
  return <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', a.soft, a.text, className)}>{children}</span>
}

// ── Empty state ──────────────────────────────────────────
export function MedicalEmpty({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 ring-8 ring-slate-50/60 flex items-center justify-center mx-auto mb-4 text-slate-300 text-2xl">
        {icon || '○'}
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── Notification card ────────────────────────────────────
export function NotificationCard({ title, body, time, accent = 'blue', unread, icon }: {
  title: string; body?: string; time?: string; accent?: Accent; unread?: boolean; icon?: ReactNode
}) {
  const a = ACCENT[accent]
  return (
    <div className={cn('flex gap-3 p-3.5 rounded-xl transition-colors', unread ? 'bg-slate-50/80' : 'hover:bg-slate-50/60')}>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm', a.soft, a.text)}>{icon || '🔔'}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
          {unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
        </div>
        {body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{body}</p>}
        {time && <p className="text-[11px] text-slate-400 mt-1">{time}</p>}
      </div>
    </div>
  )
}

// ── Chart card wrapper (with honest empty state) ─────────
export function ChartCard({ title, subtitle, action, hasData, emptyLabel = 'אין נתונים להצגה עדיין', children }: {
  title: string; subtitle?: string; action?: ReactNode; hasData: boolean; emptyLabel?: string; children: ReactNode
}) {
  return (
    <Panel>
      <SectionHeader title={title} subtitle={subtitle} action={action} />
      {hasData ? (
        <div className="h-56 -mx-2">{children}</div>
      ) : (
        <div className="h-56 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18" strokeLinecap="round"/><path d="M7 14l3-3 3 3 4-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <p className="text-sm text-slate-400">{emptyLabel}</p>
        </div>
      )}
    </Panel>
  )
}

const AXIS = { fontSize: 11, fill: '#94a3b8' }
const chartTooltip = { contentStyle: { borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 8px 24px -12px rgba(15,23,42,0.2)', fontSize: 12, direction: 'rtl' as const } }

export function AreaTrend({ data, dataKey, xKey, color = MED.blue }: { data: Array<Record<string, unknown>>; dataKey: string; xKey: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`ar-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} reversed />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip {...chartTooltip} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#ar-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function BarTrend({ data, dataKey, xKey, color = MED.teal }: { data: Array<Record<string, unknown>>; dataKey: string; xKey: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} reversed />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip {...chartTooltip} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DonutChart({ data, colors = [MED.blue, MED.teal, MED.emerald, MED.amber, MED.violet, MED.slate] }: {
  data: Array<{ name: string; value: number }>; colors?: string[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip {...chartTooltip} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Avatar (initials) ────────────────────────────────────
export function Avatar({ name, accent = 'blue', size = 44, src }: { name: string; accent?: Accent; size?: number; src?: string | null }) {
  const a = ACCENT[accent]
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0)).join('')
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className="rounded-xl object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}>
      {initials}
    </div>
  )
}

// ── Premium appointment card ─────────────────────────────
export function AppointmentCard({ title, subtitle, specialty, datetime, status, type, price, accent = 'blue', action, onClick }: {
  title: string; subtitle?: string; specialty?: string | null; datetime?: string | null;
  status?: string; type?: 'video' | 'clinic' | null; price?: number | null; accent?: Accent; action?: ReactNode; onClick?: () => void
}) {
  return (
    <div onClick={onClick}
      className={cn('group flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 transition-all',
        onClick && 'cursor-pointer hover:border-slate-200 hover:shadow-md')}>
      <Avatar name={title} accent={accent} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-slate-900 truncate">{title}</p>
          {status && <StatusChip status={status} />}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
          {specialty && <span>{specialtyLabel(specialty)}</span>}
          {specialty && (datetime || subtitle) && <span className="text-slate-300">·</span>}
          {datetime ? <span>{formatDateTime(datetime)}</span> : subtitle && <span>{subtitle}</span>}
          {type && <><span className="text-slate-300">·</span><span>{type === 'video' ? '📹 וידאו' : '🏥 במרפאה'}</span></>}
        </div>
      </div>
      {price != null && <span className="text-sm font-bold text-emerald-600 shrink-0">₪{price}</span>}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ── Medical timeline ─────────────────────────────────────
export type TimelineStep = { label: string; time?: string; state: 'done' | 'current' | 'todo' }
export function MedicalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        const color = s.state === 'done' ? MED.emerald : s.state === 'current' ? MED.blue : '#cbd5e1'
        return (
          <li key={i} className="flex gap-3 pb-5 last:pb-0 relative">
            {!last && <span className="absolute right-[11px] top-6 bottom-0 w-px bg-slate-100" />}
            <span className="relative z-10 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: s.state === 'todo' ? '#f1f5f9' : color }}>
              {s.state === 'done'
                ? <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : s.state === 'current'
                  ? <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  : <span className="w-2 h-2 rounded-full bg-slate-300" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm font-semibold', s.state === 'todo' ? 'text-slate-400' : 'text-slate-800')}>{s.label}</p>
              {s.time && <p className="text-xs text-slate-400 mt-0.5">{s.time}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ── Summary card (patient / doctor) ──────────────────────
export function SummaryCard({ name, subtitle, avatarSrc, accent = 'blue', rows, footer }: {
  name: string; subtitle?: string; avatarSrc?: string | null; accent?: Accent;
  rows?: Array<{ label: string; value: ReactNode }>; footer?: ReactNode
}) {
  return (
    <Panel>
      <div className="flex items-center gap-4">
        <Avatar name={name} accent={accent} size={52} src={avatarSrc} />
        <div className="min-w-0">
          <p className="font-black text-slate-900 text-lg truncate">{name}</p>
          {subtitle && <p className="text-sm text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      {rows && rows.length > 0 && (
        <div className="mt-5 space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{r.label}</span>
              <span className="font-semibold text-slate-800">{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {footer && <div className="mt-5 pt-4 border-t border-slate-100">{footer}</div>}
    </Panel>
  )
}

// ── AI summary card ──────────────────────────────────────
export function AISummaryCard({ title = 'סיכום AI', children, badge = 'מבוסס AI' }: { title?: string; children: ReactNode; badge?: string }) {
  return (
    <div className="rounded-2xl p-5 border border-violet-100 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #eff6ff 100%)' }}>
      <div className="absolute -top-10 -left-10 w-28 h-28 rounded-full bg-violet-200/30 blur-2xl" />
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-violet-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>
          </span>
          <p className="font-bold text-slate-900 text-sm">{title}</p>
        </div>
        <span className="text-[11px] font-semibold text-violet-600 bg-white/70 px-2 py-0.5 rounded-full">{badge}</span>
      </div>
      <div className="relative text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  )
}
