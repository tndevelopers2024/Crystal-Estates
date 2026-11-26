import React, { useMemo, useState } from 'react'
import { AlertCircle, Check, Handshake, IndianRupee, Loader2, Mail, Pencil, Phone, Plus, Trash2, UserCheck, UserX } from 'lucide-react'
import { MANUAL_TYPES, toLocalInput, fmtDate } from './activityTypes'
import { BrokerSelect } from '../land/Parties'
import { useOptions } from '../../hooks/useOptions'
import { formatRupees } from '../../lib/plotUtils'

const PAYMENT_MODES = ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card']
const PAYMENT_FOR_OPTIONS = ['Token advance', 'Booking advance', 'Part payment', 'Full payment', 'Registration advance']
const todayIso = () => new Date().toISOString().slice(0, 10)

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
 * Reusable payment fields (rendered as a div so it can live inline inside another form or inside a SidePanel).
 */
export function CustomerPaymentFields({ initial = null, onSave, onCancel, saving = false, submitLabel }) {
  const modes = useOptions('paymentMode', PAYMENT_MODES)
  const [f, setF] = useState(() => ({
    paymentFor: initial?.paymentFor || PAYMENT_FOR_OPTIONS[0],
    amount: initial?.amount ?? '',
    paidOn: initial?.paidOn || todayIso(),
    mode: initial?.mode || PAYMENT_MODES[0],
    referenceNo: initial?.referenceNo || '',
    note: initial?.note || '',
  }))
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const handleSave = () => {
    setErr('')
    const amt = Number(String(f.amount || '').replace(/,/g, '').trim())
    if (!Number.isFinite(amt) || amt <= 0) return setErr('Enter a valid payment amount.')
    if (!f.paidOn) return setErr('Select a payment date.')
    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      paymentFor: f.paymentFor || 'Payment',
      amount: Math.round(amt * 100) / 100,
      paidOn: f.paidOn,
      mode: f.mode || 'UPI',
      referenceNo: f.referenceNo.trim(),
      note: f.note.trim(),
    })
  }

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
      {err && (
        <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cp-for" className={labelCls}>Payment type</label>
          <select id="cp-for" className={inputCls} value={f.paymentFor} onChange={set('paymentFor')}>
            {PAYMENT_FOR_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cp-amt" className={labelCls}>Amount (₹) <span className="text-rose-500">*</span></label>
          <input id="cp-amt" type="number" min="1" step="any" className={inputCls} value={f.amount} onChange={set('amount')} placeholder="e.g. 50000" />
        </div>
        <div>
          <label htmlFor="cp-date" className={labelCls}>Payment date <span className="text-rose-500">*</span></label>
          <input id="cp-date" type="date" className={inputCls} value={f.paidOn} onChange={set('paidOn')} />
        </div>
        <div>
          <label htmlFor="cp-mode" className={labelCls}>Payment method</label>
          <select id="cp-mode" className={inputCls} value={f.mode} onChange={set('mode')}>
            {modes.options.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cp-ref" className={labelCls}>Transaction / Reference number</label>
          <input id="cp-ref" className={inputCls} value={f.referenceNo} onChange={set('referenceNo')} placeholder="UTR, cheque no., receipt ID…" maxLength={80} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cp-note" className={labelCls}>Notes</label>
          <input id="cp-note" className={inputCls} value={f.note} onChange={set('note')} placeholder="Optional note about this payment" maxLength={300} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3.5 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-xs">
          Cancel
        </button>
        <button type="button" disabled={saving} onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-xs disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {submitLabel || (initial?.id ? 'Update payment' : 'Add payment')}
        </button>
      </div>
    </div>
  )
}

/**
 * Add / edit customer details, broker assignment, and payment records.
 * onSubmit(values) should throw an Error (with optional .existingId) when the server refuses.
 */
export function CustomerDetailsForm({ initial = {}, isNew = !initial?.id, submitLabel = 'Save customer', onSubmit, onCancel, onOpenExisting }) {
  const [values, setValues] = useState({
    name: initial.name || '',
    phone: initial.phone || '',
    email: initial.email || '',
    city: initial.city || '',
    address: initial.address || '',
    tags: Array.isArray(initial.tags) ? initial.tags.join(', ') : '',
    notes: initial.notes || '',
  })

  // Broker assignment state
  const [isDirectCustomer, setIsDirectCustomer] = useState(() =>
    initial.isDirectCustomer !== undefined ? Boolean(initial.isDirectCustomer) : !initial.referral?.brokerId,
  )
  const [brokerId, setBrokerId] = useState(() => initial.referral?.brokerId || '')
  const [selectedBroker, setSelectedBroker] = useState(() => initial.broker || null)
  const [commType, setCommType] = useState(() => initial.referral?.commission?.type || 'percent')
  const [commValue, setCommValue] = useState(() => initial.referral?.commission?.value ?? '')
  const [commNote, setCommNote] = useState(() => initial.referral?.commission?.note || '')

  // Payment tracking state
  const [dealValue, setDealValue] = useState(() => (initial.dealValue != null ? String(initial.dealValue) : ''))
  const [payments, setPayments] = useState([])
  const [editingPayment, setEditingPayment] = useState(null) // null | 'new' | { ...payment, _idx }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [existingId, setExistingId] = useState(null)
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const dealNum = useMemo(() => {
    if (dealValue === '' || dealValue === null || dealValue === undefined) return null
    const n = Number(String(dealValue).replace(/,/g, '').trim())
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [dealValue])

  const totalPaid = useMemo(() => {
    const base = isNew ? 0 : Number(initial.totalPaid || 0)
    const added = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return Math.round((base + added) * 100) / 100
  }, [isNew, initial.totalPaid, payments])

  const pendingBalance = dealNum != null ? Math.max(Math.round((dealNum - totalPaid) * 100) / 100, 0) : null

  const commissionDisplay = useMemo(() => {
    const val = Number(commValue)
    if (!Number.isFinite(val) || val <= 0) return 'Not specified'
    if (commType === 'percent') {
      const calc = dealNum ? ` (${formatRupees(Math.round((dealNum * val) / 100))})` : ''
      return `${val}%${calc}`
    }
    return `${formatRupees(val)} fixed`
  }, [commType, commValue, dealNum])

  const handleBrokerChange = (id, broker) => {
    setBrokerId(id || '')
    setSelectedBroker(broker || null)
    if (id) setIsDirectCustomer(false)
    if (broker?.defaultCommission && commValue === '') {
      setCommType(broker.defaultCommission.type || 'percent')
      setCommValue(broker.defaultCommission.value ?? '')
    }
  }

  const handleSaveQueuedPayment = (p) => {
    if (editingPayment && typeof editingPayment === 'object' && editingPayment._idx !== undefined) {
      setPayments((prev) => prev.map((item, idx) => (idx === editingPayment._idx ? p : item)))
    } else {
      setPayments((prev) => [p, ...prev])
    }
    setEditingPayment(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setExistingId(null)
    if (!values.name.trim()) return setError('Name is required.')
    if (!values.phone.trim() && !values.email.trim()) return setError('Add a phone number or email so the customer can be identified.')
    if (!isDirectCustomer && !brokerId) return setError('Select a broker or mark the customer as Direct Customer (No Broker).')
    if (dealValue !== '' && dealNum === null) return setError('Enter a valid Total Amount.')

    const commission =
      !isDirectCustomer && brokerId && commValue !== ''
        ? { type: commType, value: Number(commValue), note: commNote.trim() }
        : null

    setSaving(true)
    try {
      await onSubmit({
        ...values,
        tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean),
        isDirectCustomer,
        brokerId: isDirectCustomer ? '' : brokerId,
        commission,
        dealValue: dealNum,
        ...(isNew ? { payments } : {}),
      })
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

      {/* Section 1: Customer Information */}
      <section className="space-y-4">
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
          <textarea id="cf-notes" rows={3} className={inputCls} value={values.notes} onChange={set('notes')} placeholder="Preferences, family, budget, anything useful" />
        </div>
      </section>

      {/* Section 2: Broker Assignment */}
      <section className="pt-4 border-t border-slate-100 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Handshake className="w-4 h-4 text-[#0F3D2E]" /> Broker Assignment
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl" role="radiogroup" aria-label="Broker assignment mode">
          <button
            type="button"
            role="radio"
            aria-checked={isDirectCustomer}
            onClick={() => setIsDirectCustomer(true)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              isDirectCustomer ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserX className="w-3.5 h-3.5" /> Direct Customer (No Broker)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!isDirectCustomer}
            onClick={() => setIsDirectCustomer(false)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              !isDirectCustomer ? 'bg-white text-[#0F3D2E] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Assign Broker
          </button>
        </div>

        {!isDirectCustomer && (
          <div className="space-y-3.5 p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <div>
              <label htmlFor="cf-broker-select" className={labelCls}>Select Broker <span className="text-rose-500">*</span></label>
              <BrokerSelect
                id="cf-broker-select"
                value={brokerId}
                onChange={handleBrokerChange}
                showDetails={false}
                placeholder="Choose an existing broker or add new…"
              />
            </div>

            {selectedBroker && (
              <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">{selectedBroker.name}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E2EDE8] text-[#0F3D2E]">
                    Commission: {commissionDisplay}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {selectedBroker.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedBroker.phone}
                    </span>
                  )}
                  {selectedBroker.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {selectedBroker.email}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[135px_1fr] gap-3">
              <div>
                <label htmlFor="cf-cm-type" className={labelCls}>Commission Type</label>
                <select id="cf-cm-type" className={inputCls} value={commType} onChange={(e) => setCommType(e.target.value)}>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div>
                <label htmlFor="cf-cm-val" className={labelCls}>{commType === 'percent' ? 'Commission (%)' : 'Commission Amount (₹)'}</label>
                <input
                  id="cf-cm-val"
                  type="number"
                  min="0"
                  max={commType === 'percent' ? '100' : undefined}
                  step="any"
                  className={inputCls}
                  value={commValue}
                  onChange={(e) => setCommValue(e.target.value)}
                  placeholder={commType === 'percent' ? 'e.g. 2' : 'e.g. 50000'}
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="cf-cm-note" className={labelCls}>Commission Note</label>
                <input id="cf-cm-note" className={inputCls} value={commNote} onChange={(e) => setCommNote(e.target.value)} placeholder="e.g. Payable on registration" maxLength={200} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Payment Records & Summary */}
      <section className="pt-4 border-t border-slate-100 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <IndianRupee className="w-4 h-4 text-[#0F3D2E]" /> Payment Records
          </h3>
          {isNew && !editingPayment && (
            <button
              type="button"
              onClick={() => setEditingPayment('new')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0F3D2E] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add payment
            </button>
          )}
        </div>

        <div>
          <label htmlFor="cf-deal-value" className={labelCls}>Total Amount (₹)</label>
          <input
            id="cf-deal-value"
            type="number"
            min="0"
            step="any"
            className={inputCls}
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value)}
            placeholder="Agreed total amount (optional)"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Total Amount</p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900 tabular-nums truncate">{dealNum != null ? formatRupees(dealNum) : '—'}</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-emerald-50/40">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700/70">Total Paid</p>
            <p className="mt-0.5 text-sm font-extrabold text-emerald-700 tabular-nums truncate">{formatRupees(totalPaid)}</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-rose-50/30">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Pending Balance</p>
            <p className={`mt-0.5 text-sm font-extrabold tabular-nums truncate ${pendingBalance > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
              {pendingBalance != null ? formatRupees(pendingBalance) : '—'}
            </p>
          </div>
        </div>

        {isNew && editingPayment && (
          <CustomerPaymentFields
            initial={editingPayment === 'new' ? null : editingPayment}
            onCancel={() => setEditingPayment(null)}
            onSave={handleSaveQueuedPayment}
          />
        )}

        {isNew && payments.length > 0 && (
          <ul className="space-y-2">
            {payments.map((p, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">
                    {p.paymentFor} · <span className="text-emerald-700">{formatRupees(p.amount)}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {[fmtDate(p.paidOn), p.mode, p.referenceNo && `Ref: ${p.referenceNo}`].filter(Boolean).join(' · ')}
                  </p>
                  {p.note && <p className="text-[11px] text-slate-600 mt-0.5">{p.note}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingPayment({ ...p, _idx: idx })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F3D2E] hover:bg-slate-50"
                    aria-label="Edit payment"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    aria-label="Remove payment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
