import React, { useState, useRef, useEffect, useId, useMemo } from 'react'
import { ChevronDown, Check, Plus, Trash2, Search, Loader2 } from 'lucide-react'
import { useDialog } from '../../context/DialogContext'

/**
 * Dropdown where users pick an existing option, create a new one by typing,
 * or delete options they no longer need.
 *
 * Props
 *  - label, value, onChange(value)
 *  - options: string[]
 *  - onCreate(value) → Promise<string>   (omit to disable creating)
 *  - onDelete(value) → Promise<void>     (omit to disable deleting)
 *  - placeholder, required, disabled, id
 */
export default function EditableSelect({
  label,
  value,
  onChange,
  options = [],
  onCreate,
  onDelete,
  placeholder = 'Select…',
  required = false,
  disabled = false,
  id,
  hint,
}) {
  const autoId = useId()
  const { confirm } = useDialog()
  const inputId = id || `es-${autoId}`
  const listId = `${inputId}-list`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  }, [options, query])

  const trimmed = query.trim()
  const canCreate = Boolean(onCreate && trimmed && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase()))
  const rows = [...filtered.map((o) => ({ kind: 'option', value: o })), ...(canCreate ? [{ kind: 'create', value: trimmed }] : [])]

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setError(null)
      setActive(Math.max(0, options.indexOf(value)))
      setTimeout(() => searchRef.current?.focus(), 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const choose = (v) => {
    onChange?.(v)
    setOpen(false)
  }

  const create = async (v) => {
    setBusy('create')
    setError(null)
    try {
      const saved = await onCreate(v)
      choose(saved || v)
    } catch (err) {
      setError(err.message || 'Could not add option')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (v, e) => {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Remove Option',
      message: `Delete "${v}" from this list? Records that already use it keep their value.`,
      tag: v,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    setBusy(v)
    setError(null)
    try {
      await onDelete(v)
      if (v === value) onChange?.('')
    } catch (err) {
      setError(err.message || 'Could not delete option')
    } finally {
      setBusy(null)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[active]
      if (!row) return
      if (row.kind === 'create') create(row.value)
      else choose(row.value)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-600 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <button
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border rounded-xl text-sm text-left transition disabled:opacity-60 ${
          open ? 'border-[#0F3D2E] ring-2 ring-[#0F3D2E]/10' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* Lets native form validation enforce `required` */}
      {required && <input tabIndex={-1} aria-hidden="true" className="sr-only absolute" value={value || ''} onChange={() => {}} required />}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={onCreate ? 'Search or type a new option…' : 'Search…'}
                className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F3D2E]"
                aria-label={`Search ${label || 'options'}`}
                aria-controls={listId}
                aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
              />
            </div>
          </div>

          <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1" aria-label={label}>
            {rows.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">No options</li>}
            {rows.map((row, idx) =>
              row.kind === 'create' ? (
                <li
                  key="__create"
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={active === idx}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => create(row.value)}
                  className={`mx-1 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold cursor-pointer text-[#0F3D2E] ${active === idx ? 'bg-[#E2EDE8]' : ''}`}
                >
                  {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add “{row.value}”
                </li>
              ) : (
                <li
                  key={row.value}
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={row.value === value}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => choose(row.value)}
                  className={`group mx-1 px-3 py-2 rounded-lg flex items-center justify-between gap-2 text-sm cursor-pointer ${
                    active === idx ? 'bg-slate-100' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Check className={`w-4 h-4 shrink-0 ${row.value === value ? 'text-[#0F3D2E]' : 'text-transparent'}`} />
                    <span className="truncate text-slate-800">{row.value}</span>
                  </span>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => remove(row.value, e)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Delete option ${row.value}`}
                      disabled={busy === row.value}
                    >
                      {busy === row.value ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </li>
              ),
            )}
          </ul>

          {error && <p className="px-3 py-2 text-xs text-rose-600 border-t border-rose-100 bg-rose-50">{error}</p>}
        </div>
      )}
    </div>
  )
}
