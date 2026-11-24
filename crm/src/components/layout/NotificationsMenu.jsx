import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, CheckCircle2 } from 'lucide-react'

/**
 * Header bell: real items that need attention (computed in App from live
 * data). Each row opens the page where it can be handled.
 * items: [{ id, label, detail, count, path }]
 */
export default function NotificationsMenu({ items = [] }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = items.filter((i) => i.count > 0)
  const total = active.reduce((s, i) => s + i.count, 0)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
        aria-label={`Notifications${total ? `, ${total} need attention` : ''}`}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4 text-slate-600" />
        {total > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-24px))] bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden" role="menu">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900">Needs attention</p>
          </div>
          {active.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="mt-2 text-xs font-semibold text-slate-700">You're all caught up</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {active.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false)
                      navigate(i.path)
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition"
                  >
                    <span className="min-w-7 h-7 px-1.5 rounded-full bg-[#E2EDE8] text-[#0F3D2E] text-[11px] font-extrabold grid place-items-center shrink-0">{i.count}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-800">{i.label}</span>
                      {i.detail && <span className="block text-[11px] text-slate-500 truncate">{i.detail}</span>}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
