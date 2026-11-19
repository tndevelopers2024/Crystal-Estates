import React, { useState, useEffect, useRef } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Trash2,
  X,
  HelpCircle,
} from 'lucide-react'

export default function ConfirmModal({
  isOpen = false,
  title = 'Please Confirm',
  message = 'Are you sure you want to proceed?',
  tag = null,
  type = 'danger', // 'danger' | 'warning' | 'info' | 'success'
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCancel = true,
  isPrompt = false,
  promptPlaceholder = 'Enter value...',
  promptDefaultValue = '',
  onConfirm,
  onCancel,
}) {
  const [promptValue, setPromptValue] = useState(promptDefaultValue)
  const inputRef = useRef(null)
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setPromptValue(promptDefaultValue)
      // Focus appropriate element
      setTimeout(() => {
        if (isPrompt && inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus()
        }
      }, 50)
    }
  }, [isOpen, isPrompt, promptDefaultValue])

  // Handle ESC key to dismiss and Enter key to confirm
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (onCancel) onCancel()
      } else if (e.key === 'Enter' && (!isPrompt || e.target === inputRef.current)) {
        e.preventDefault()
        if (onConfirm) onConfirm(isPrompt ? promptValue : true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isPrompt, promptValue, onCancel, onConfirm])

  if (!isOpen) return null

  // Get icon and color scheme based on type
  const renderIcon = () => {
    switch (type) {
      case 'danger':
        return (
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-xs">
            <Trash2 className="w-5 h-5" />
          </div>
        )
      case 'warning':
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
        )
      case 'success':
        return (
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )
      case 'info':
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#E2EDE8] border border-[#C8DED5] flex items-center justify-center text-[#0F3D2E] shrink-0 shadow-xs">
            <Info className="w-5 h-5" />
          </div>
        )
    }
  }

  // Confirm button color styling
  const getConfirmBtnCls = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-600/20'
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-600/20'
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20'
      case 'info':
      default:
        return 'bg-[#0F3D2E] hover:bg-[#16533D] active:bg-[#0B2B20] text-white shadow-[#0F3D2E]/20'
    }
  }

  const handleConfirmClick = () => {
    if (onConfirm) {
      onConfirm(isPrompt ? promptValue : true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) {
          onCancel()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-md w-full p-6 sm:p-7 overflow-hidden animate-in zoom-in-95 duration-150 my-auto font-sans">
        {/* Top-Right Dismiss Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header with Icon */}
        <div className="flex items-start gap-4">
          {renderIcon()}

          <div className="flex-1 min-w-0 pr-4">
            <h3
              id="confirm-modal-title"
              className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug"
            >
              {title}
            </h3>

            {tag && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                {tag}
              </div>
            )}

            <div className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-2">
              {message}
            </div>
          </div>
        </div>

        {/* Prompt Input field if requested */}
        {isPrompt && (
          <div className="mt-4">
            <input
              ref={inputRef}
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptPlaceholder}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/15 transition"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 text-xs sm:text-sm font-bold transition text-center cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirmClick}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center gap-2 text-center cursor-pointer ${getConfirmBtnCls()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
