import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import ConfirmModal from '../components/common/ConfirmModal'

const DialogContext = createContext(null)

export function DialogProvider({ children }) {
  const [dialogConfig, setDialogConfig] = useState(null)
  const resolverRef = useRef(null)

  // Clean close helper
  const handleClose = useCallback((result = false) => {
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
    }
    setDialogConfig(null)
  }, [])

  /**
   * Show custom confirmation dialog
   * @param {Object|string} options
   * @returns {Promise<boolean>}
   */
  const confirm = useCallback((options = {}) => {
    const config = typeof options === 'string'
      ? { message: options }
      : { ...options }

    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialogConfig({
        isOpen: true,
        title: config.title || 'Please Confirm',
        message: config.message || 'Are you sure you want to proceed?',
        tag: config.tag || null,
        type: config.type || 'danger',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        showCancel: config.showCancel !== false,
        isPrompt: false,
      })
    })
  }, [])

  /**
   * Show custom alert dialog
   * @param {Object|string} options
   * @returns {Promise<boolean>}
   */
  const alert = useCallback((options = {}) => {
    const config = typeof options === 'string'
      ? { message: options }
      : { ...options }

    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialogConfig({
        isOpen: true,
        title: config.title || 'Notice',
        message: config.message || '',
        tag: config.tag || null,
        type: config.type || 'info',
        confirmText: config.confirmText || 'OK',
        showCancel: false,
        isPrompt: false,
      })
    })
  }, [])

  /**
   * Show custom prompt dialog
   * @param {Object|string} options
   * @returns {Promise<string|null>}
   */
  const prompt = useCallback((options = {}) => {
    const config = typeof options === 'string'
      ? { message: options }
      : { ...options }

    return new Promise((resolve) => {
      resolverRef.current = (val) => {
        if (val === false || val === null || val === undefined) {
          resolve(null)
        } else {
          resolve(typeof val === 'string' ? val : '')
        }
      }
      setDialogConfig({
        isOpen: true,
        title: config.title || 'Input Required',
        message: config.message || '',
        promptPlaceholder: config.placeholder || 'Enter value...',
        promptDefaultValue: config.defaultValue || '',
        type: config.type || 'info',
        confirmText: config.confirmText || 'Submit',
        cancelText: config.cancelText || 'Cancel',
        showCancel: true,
        isPrompt: true,
      })
    })
  }, [])

  // Expose global window helpers so non-hook scripts or callbacks can also invoke them
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.crmConfirm = confirm
      window.crmAlert = alert
      window.crmPrompt = prompt
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.crmConfirm
        delete window.crmAlert
        delete window.crmPrompt
      }
    }
  }, [confirm, alert, prompt])

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      {dialogConfig && (
        <ConfirmModal
          isOpen={dialogConfig.isOpen}
          title={dialogConfig.title}
          message={dialogConfig.message}
          tag={dialogConfig.tag}
          type={dialogConfig.type}
          confirmText={dialogConfig.confirmText}
          cancelText={dialogConfig.cancelText}
          showCancel={dialogConfig.showCancel}
          isPrompt={dialogConfig.isPrompt}
          promptPlaceholder={dialogConfig.promptPlaceholder}
          promptDefaultValue={dialogConfig.promptDefaultValue}
          onConfirm={(val) => handleClose(dialogConfig.isPrompt ? val : true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}

export const useConfirm = useDialog
