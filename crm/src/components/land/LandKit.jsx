import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Download, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { Badge, btnGhost, inputCls, labelCls } from '../common/PageKit'
import { exportLandExcel, downloadBlobUrl } from '../../lib/landApi'

/* ───────────── Formatting ───────────── */

export const inr = (n) => {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/** ₹1.25 Cr / ₹4.5 L for headline numbers */
export const inrShort = (n) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  const a = Math.abs(v)
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`
  return inr(v)
}

export const fmtDate = (d) => {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T00:00:00` : d)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
export const fmtDateTime = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export const todayIso = () => new Date().toISOString().slice(0, 10)
export const num = (v) => (v === '' || v === null || v === undefined ? '' : String(v))
export const formatBytes = (n) => {
  const v = Number(n) || 0
  return v < 1024 ? `${v} B` : v < 1048576 ? `${(v / 1024).toFixed(0)} KB` : `${(v / 1048576).toFixed(1)} MB`
}

/* ───────────── Statuses ───────────── */

export const PROJECT_STATUSES = ['Negotiation', 'Agreement signed', 'Registered', 'Development', 'Selling', 'Completed']
export const PLOT_STATUSES = ['Available', 'Hold', 'Booked', 'Sold']
export const AREA_UNITS = ['Acres', 'Cents', 'Sq.ft', 'Grounds']
export const DOC_STATUSES = ['Pending', 'Received', 'Verified', 'Not required']
export const FACINGS = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West']
export const DEFAULT_DOC_TYPES = ['Parent deed', 'Sale deed', 'Agreement of sale', 'Patta / Chitta', 'Encumbrance certificate', 'FMB sketch', 'Layout approval', 'Tax receipt', 'Power of attorney', 'Legal opinion', 'Layout plan', 'Other']

export const PLOT_STYLE = {
  Available: { tone: 'green', tile: 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  Hold: { tone: 'amber', tile: 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100', dot: 'bg-amber-500' },
  Booked: { tone: 'blue', tile: 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100', dot: 'bg-sky-500' },
  Sold: { tone: 'violet', tile: 'bg-violet-100 border-violet-300 text-violet-900 hover:bg-violet-200', dot: 'bg-violet-500' },
}
const PROJECT_TONE = { Negotiation: 'amber', 'Agreement signed': 'blue', Registered: 'violet', Development: 'blue', Selling: 'green', Completed: 'slate' }
const DOC_TONE = { Pending: 'amber', Received: 'blue', Verified: 'green', 'Not required': 'slate' }

export const PlotStatus = ({ status }) => <Badge tone={PLOT_STYLE[status]?.tone || 'slate'}>{status}</Badge>
export const ProjectStatus = ({ status }) => <Badge tone={PROJECT_TONE[status] || 'slate'}>{status}</Badge>
const PAY_TONE = { Paid: 'green', 'Part paid': 'amber', Unpaid: 'rose', 'Price not set': 'slate' }
const COMM_TONE = { Paid: 'green', 'Part paid': 'amber', Pending: 'rose', 'Not set': 'slate' }
/** What a customer has paid of the sale price */
export const PayStatus = ({ status }) => <Badge tone={PAY_TONE[status] || 'slate'}>{status}</Badge>
/** What has been paid of a broker's commission */
export const CommissionStatus = ({ status }) => <Badge tone={COMM_TONE[status] || 'slate'}>{status}</Badge>
export const DocStatus = ({ status }) => <Badge tone={DOC_TONE[status] || 'slate'}>{status}</Badge>

/* ───────────── Data loading ───────────── */

/** Load data with loading / error state; `reload()` fetches again, `setData` updates locally. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  useEffect(() => {
    let active = true
    loaderRef.current()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((err) => active && setState((s) => ({ ...s, loading: false, error: err.message || 'Could not load' })))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    setTick((t) => t + 1)
  }, [])
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), [])
  return { ...state, reload, setData }
}

/* ───────────── Dialogs and form fields ───────────── */

/** Centered dialog. Escape closes only this dialog, even when it sits on top of a side panel. */
export function LandModal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  if (!open) return null
  // Rendered on the page body: a dialog opened from inside a form must not become a form nested in it
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}
      // Events from the dialog (e.g. its form's submit) must not reach the form that opened it
      onSubmit={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] cursor-default" aria-label="Close" onClick={onClose} />
      <div className={`relative w-full ${width} max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 -mr-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, htmlFor, required, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className={labelCls}>
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

export function TextInput({ id, value, onChange, type = 'text', ...rest }) {
  return <input id={id} type={type} className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
}
export function NumberInput({ id, value, onChange, ...rest }) {
  return <input id={id} inputMode="decimal" autoComplete="off" className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))} {...rest} />
}
export function SelectInput({ id, value, onChange, options, placeholder, ...rest }) {
  return (
    <select id={id} className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return (
          <option key={v} value={v}>
            {l}
          </option>
        )
      })}
    </select>
  )
}

export function FormError({ message }) {
  if (!message) return null
  return (
    <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> <span>{message}</span>
    </div>
  )
}

export function SectionTitle({ children, aside, id }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h4 id={id} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{children}</h4>
      {aside}
    </div>
  )
}

/** Label / value grid for read-only details. */
export function DetailGrid({ items, cols = 2 }) {
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
      {items
        .filter(Boolean)
        .map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{k}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{v === null || v === undefined || v === '' ? '—' : v}</dd>
          </div>
        ))}
    </dl>
  )
}

/* ───────────── Excel button ───────────── */

export function ExportButton({ type, projectId, label = 'Export to Excel', onShowToast, className = '' }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const file = await exportLandExcel({ type, projectId })
      onShowToast?.(`Downloaded ${file}`, 'success')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" onClick={run} disabled={busy} className={`${btnGhost} ${className}`} title="Download as an Excel workbook">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} {label}
    </button>
  )
}

/* ───────────── File preview ───────────── */

/** Preview a stored PDF or image. `load()` resolves to a temporary object URL. */
export function FilePreview({ title, name, ext, load, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let active = true
    let made = null
    load()
      .then((u) => {
        made = u
        if (active) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
      if (made) URL.revokeObjectURL(made)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[95] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Preview ${title}`} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
            <p className="text-[11px] text-slate-500 truncate">{name}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {url && (
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-slate-100" onClick={() => downloadBlobUrl(url, name)} aria-label="Download">
                <Download className="w-4 h-4" />
              </button>
            )}
            <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close preview">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
          {error ? (
            <p className="text-sm text-rose-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>
          ) : !url ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : ext === 'pdf' ? (
            <iframe title={title} src={url} className="w-full h-full bg-white" />
          ) : (
            <img src={url} alt={title} className="max-w-full max-h-full object-contain" />
          )}
        </div>
      </div>
    </div>
  )
}

/** Simple sortable-free responsive table shell. */
export function DataTable({ columns, rows, rowKey, onRowClick, empty, footer }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3.5 py-2.5 font-bold whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-400">
                {empty || 'Nothing to show.'}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'hover:bg-[#F3F8F5] cursor-pointer transition' : ''}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3.5 py-2.5 align-middle ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className || ''}`}>
                    {c.render ? c.render(r) : r[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && <tfoot className="bg-[#E2EDE8]/60 text-sm font-bold text-[#0F3D2E]">{footer}</tfoot>}
      </table>
    </div>
  )
}
