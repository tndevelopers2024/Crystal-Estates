import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Right-hand slide-in panel (full screen on phones). Children fill the body
 * and can render their own sticky footer.
 */
export default function SidePanel({ open, onClose, title, subtitle, icon: Icon, width = 'max-w-xl', children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => panelRef.current?.focus(), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] cursor-default" aria-label="Close panel" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className={`relative w-full ${width} h-full bg-white shadow-2xl flex flex-col outline-none animate-in slide-in-from-right duration-200`}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && (
              <span className="w-10 h-10 rounded-2xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center shrink-0">
                <Icon className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  )
}
