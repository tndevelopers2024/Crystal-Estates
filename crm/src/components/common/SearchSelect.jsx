import React, { useState, useRef, useEffect, useId, useMemo } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'

/**
 * Searchable single-select for records.
 * options: [{ value, label, sub? }]
 */
export default function SearchSelect({ label, value, onChange, options = [], placeholder = 'Select…', required, disabled, emptyText = 'No matches', clearable = false }) {
  const autoId = useId()
  const inputId = `ss-${autoId}`
  const listId = `${inputId}-list`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const selected = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    setTimeout(() => searchRef.current?.focus(), 0)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const choose = (v) => {
    onChange?.(v)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) choose(filtered[active].value)
    } else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-600 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border rounded-xl text-sm text-left transition disabled:opacity-60 disabled:bg-slate-50 ${
            open ? 'border-[#0F3D2E] ring-2 ring-[#0F3D2E]/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="min-w-0">
            <span className={`block truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>{selected?.label || placeholder}</span>
            {selected?.sub && <span className="block truncate text-[11px] text-slate-500">{selected.sub}</span>}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {clearable && selected && !disabled && (
          <button type="button" onClick={() => choose('')} className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" aria-label={`Clear ${label || 'selection'}`}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {required && <input tabIndex={-1} aria-hidden="true" className="sr-only absolute" value={value || ''} onChange={() => {}} required />}

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
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F3D2E]"
                aria-label={`Search ${label || 'options'}`}
                aria-controls={listId}
              />
            </div>
          </div>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">{emptyText}</li>}
            {filtered.map((o, idx) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(idx)}
                onClick={() => choose(o.value)}
                className={`mx-1 px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer ${active === idx ? 'bg-slate-100' : ''}`}
              >
                <Check className={`w-4 h-4 shrink-0 ${o.value === value ? 'text-[#0F3D2E]' : 'text-transparent'}`} />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-800 truncate">{o.label}</span>
                  {o.sub && <span className="block text-[11px] text-slate-500 truncate">{o.sub}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
