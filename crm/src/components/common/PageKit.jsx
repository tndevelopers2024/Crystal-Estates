import React from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Shared building blocks so every CRM page uses the same card, spacing and
 * typography as the existing Payments / Documents / Customers pages.
 */

export function Card({ title, subtitle, actions, children, className = '', bodyClassName = 'p-5' }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h2>}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'green', onClick }) {
  const tones = {
    green: 'bg-[#E2EDE8] text-[#0F3D2E]',
    gold: 'bg-amber-50 text-amber-700',
    blue: 'bg-sky-50 text-sky-700',
    purple: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-600',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_6px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-3 min-w-0 ${onClick ? 'hover:border-[#0F3D2E]/40 hover:shadow-md transition cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</span>
        {Icon && (
          <span className={`p-2 rounded-xl shrink-0 ${tones[tone] || tones.green}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div>
        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums truncate">{value}</div>
        {hint && <div className="text-[11px] font-medium text-slate-500 mt-1 truncate">{hint}</div>}
      </div>
    </Tag>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="py-10 px-4 text-center">
      {Icon && (
        <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {text && <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…', rows = 3 }) {
  return (
    <div className="p-5 space-y-3" role="status" aria-live="polite">
      <p className="text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {label}
      </p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div role="alert" className="m-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-bold hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  )
}

/** Horizontal bars: [{ label, count, color? }] */
export function BarList({ rows, format = (n) => n, emptyText = 'Nothing to show yet', onSelect }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  if (!rows.length || rows.every((r) => !r.count)) return <p className="text-xs text-slate-400 py-6 text-center">{emptyText}</p>
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id || r.label}>
          <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(r)}
            className={`w-full text-left ${onSelect ? 'cursor-pointer group' : 'cursor-default'}`}
          >
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className={`font-semibold text-slate-700 truncate ${onSelect ? 'group-hover:text-[#0F3D2E]' : ''}`}>{r.label}</span>
              <span className="font-bold text-slate-900 tabular-nums shrink-0">{format(r.count)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(r.count / max) * 100}%`, background: r.color || '#0F3D2E' }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Simple column chart: [{ label, value }] */
export function ColumnChart({ data, format = (n) => n, height = 160 }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }} role="img" aria-label="Column chart">
      {data.map((d) => (
        <div key={d.label} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1.5" title={`${d.label}: ${format(d.value)}`}>
          <span className="text-[10px] font-bold text-slate-600 tabular-nums truncate max-w-full">{d.value ? format(d.value) : ''}</span>
          <div className="w-full max-w-[44px] rounded-t-lg bg-[#0F3D2E]/85 hover:bg-[#0F3D2E] transition-all duration-500" style={{ height: `${Math.max(d.value ? 4 : 0, (d.value / max) * (height - 40))}px` }} />
          <span className="text-[10px] font-semibold text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10.5px] font-bold whitespace-nowrap ${tones[tone] || tones.slate}`}>{children}</span>
}

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50'
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-[#0F3D2E] text-slate-700 hover:text-[#0F3D2E] text-xs font-bold rounded-xl transition disabled:opacity-50'
export const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
export const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'
