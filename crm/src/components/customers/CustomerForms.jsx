import React, { useState } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { MANUAL_TYPES, toLocalInput } from './activityTypes'

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

function FormShell({ onSubmit, error, saving, submitLabel, onCancel, children }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full" noValidate>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
        {children}
      </div>
      <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

/**
 * Add / edit customer details.
 * onSubmit(values) should throw an Error (with optional .existingId) when the server refuses.
 */
export function CustomerDetailsForm({ initial = {}, submitLabel = 'Save customer', onSubmit, onCancel, onOpenExisting }) {
  const [values, setValues] = useState({
    name: initial.name || '',
    phone: initial.phone || '',
    email: initial.email || '',
    city: initial.city || '',
    address: initial.address || '',
    tags: Array.isArray(initial.tags) ? initial.tags.join(', ') : '',
    notes: initial.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [existingId, setExistingId] = useState(null)
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setExistingId(null)
    if (!values.name.trim()) return setError('Name is required.')
    if (!values.phone.trim() && !values.email.trim()) return setError('Add a phone number or email so the customer can be identified.')
    setSaving(true)
    try {
      await onSubmit({ ...values, tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean) })
    } catch (err) {
      setError(err.message || 'Could not save the customer.')
      if (err.existingId) setExistingId(err.existingId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormShell onSubmit={submit} error={error} saving={saving} submitLabel={submitLabel} onCancel={onCancel}>
      {existingId && onOpenExisting && (
        <button type="button" onClick={() => onOpenExisting(existingId)} className="text-xs font-bold text-[#0F3D2E] underline underline-offset-2">
          Open the existing profile instead
        </button>
      )}
      <div>
        <label htmlFor="cf-name" className={labelCls}>
          Full name <span className="text-rose-500">*</span>
        </label>
        <input id="cf-name" className={inputCls} value={values.name} onChange={set('name')} autoComplete="name" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cf-phone" className={labelCls}>Phone</label>
          <input id="cf-phone" type="tel" inputMode="tel" className={inputCls} value={values.phone} onChange={set('phone')} placeholder="+91 98xxx xxxxx" autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="cf-email" className={labelCls}>Email</label>
          <input id="cf-email" type="email" inputMode="email" className={inputCls} value={values.email} onChange={set('email')} placeholder="name@example.com" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="cf-city" className={labelCls}>City</label>
          <input id="cf-city" className={inputCls} value={values.city} onChange={set('city')} />
        </div>
        <div>
          <label htmlFor="cf-tags" className={labelCls}>Tags</label>
          <input id="cf-tags" className={inputCls} value={values.tags} onChange={set('tags')} placeholder="Investor, NRI, Repeat buyer" />
        </div>
      </div>
      <div>
        <label htmlFor="cf-address" className={labelCls}>Address</label>
        <textarea id="cf-address" rows={2} className={inputCls} value={values.address} onChange={set('address')} />
      </div>
      <div>
        <label htmlFor="cf-notes" className={labelCls}>Notes</label>
        <textarea id="cf-notes" rows={4} className={inputCls} value={values.notes} onChange={set('notes')} placeholder="Preferences, family, budget, anything useful" />
      </div>
    </FormShell>
  )
}

/** Log or edit a timeline entry (call, meeting, note …). */
export function ActivityForm({ initial, properties = [], onSubmit, onCancel }) {
  const editing = Boolean(initial?.id)
  const [values, setValues] = useState({
    type: initial?.type && MANUAL_TYPES.some((t) => t.id === initial.type) ? initial.type : 'call',
    title: initial?.title || '',
    details: initial?.details || '',
    occurredAt: toLocalInput(initial?.occurredAt || new Date()),
    propertyId: initial?.propertyId || '',
    amount: initial?.amount ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!values.title.trim()) return setError('Add a short summary of what happened.')
    const when = new Date(values.occurredAt)
    if (Number.isNaN(when.getTime())) return setError('Enter a valid date and time.')
    const property = properties.find((p) => p.id === values.propertyId)
    setSaving(true)
    try {
      await onSubmit({
        type: values.type,
        title: values.title.trim(),
        details: values.details.trim(),
        occurredAt: when.toISOString(),
        propertyId: property?.id || '',
        property: property?.name || '',
        amount: values.amount === '' ? null : Number(String(values.amount).replace(/[^\d.]/g, '')),
      })
    } catch (err) {
      setError(err.message || 'Could not save this activity.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormShell onSubmit={submit} error={error} saving={saving} submitLabel={editing ? 'Save changes' : 'Log activity'} onCancel={onCancel}>
      <fieldset>
        <legend className={labelCls}>Type</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Activity type">
          {MANUAL_TYPES.map((t) => {
            const Icon = t.icon
            const on = values.type === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setValues((v) => ({ ...v, type: t.id }))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition ${
                  on ? 'bg-[#0F3D2E] text-white ring-[#0F3D2E]' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      <div>
        <label htmlFor="af-title" className={labelCls}>
          Summary <span className="text-rose-500">*</span>
        </label>
        <input id="af-title" className={inputCls} value={values.title} onChange={set('title')} placeholder="e.g. Called about east-facing plots" maxLength={240} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="af-when" className={labelCls}>Date &amp; time</label>
          <input id="af-when" type="datetime-local" className={inputCls} value={values.occurredAt} onChange={set('occurredAt')} />
        </div>
        <div>
          <label htmlFor="af-property" className={labelCls}>Property</label>
          <select id="af-property" className={inputCls} value={values.propertyId} onChange={set('propertyId')}>
            <option value="">—</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {values.type === 'payment' && (
        <div>
          <label htmlFor="af-amount" className={labelCls}>Amount (₹)</label>
          <input id="af-amount" inputMode="decimal" className={inputCls} value={values.amount} onChange={set('amount')} />
          <p className="mt-1 text-[11px] text-slate-500">For notes only — record real payments from the lead or Payments page so they count in totals.</p>
        </div>
      )}
      <div>
        <label htmlFor="af-details" className={labelCls}>Details</label>
        <textarea id="af-details" rows={5} className={inputCls} value={values.details} onChange={set('details')} placeholder="What was discussed, next steps, outcome…" maxLength={2000} />
      </div>
    </FormShell>
  )
}
