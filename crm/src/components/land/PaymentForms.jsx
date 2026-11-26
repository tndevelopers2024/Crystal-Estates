import React, { useEffect, useMemo, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import EditableSelect from '../common/EditableSelect'
import SearchSelect from '../common/SearchSelect'
import { btnGhost, btnPrimary } from '../common/PageKit'
import { useOptions } from '../../hooks/useOptions'
import { addPayment, updatePayment, addCommissionPayment, updateCommissionPayment } from '../../lib/landApi'
import { Field, TextInput, NumberInput, FormError, LandModal, inr, todayIso } from './LandKit'

const FOR = ['Token advance', 'Booking advance', 'Part payment', 'Full payment', 'Registration advance']
const MODES = ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card']

/**
 * Record or edit one payment: what a customer paid for a plot (kind "customer"),
 * or what we paid a broker as commission (kind "commission").
 * `plot` carries the figures used for the "balance" hint; the server enforces the limit.
 */
export function PaymentForm({ kind, plot, payment, onSaved, onCancel, compact = false }) {
  const isCommission = kind === 'commission'
  const forList = useOptions('paymentFor', FOR)
  const modeList = useOptions('paymentMode', MODES)
  const editing = Boolean(payment)
  const room = isCommission ? plot.commissionPending + (payment?.amount || 0) : plot.balance != null ? plot.balance + (payment?.amount || 0) : null

  const [f, setF] = useState({ amount: '', date: todayIso(), label: '', mode: '', referenceNo: '', note: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    setError(null)
    setF(payment ? { amount: payment.amount, date: payment.date, label: payment.label || '', mode: payment.mode || '', referenceNo: payment.referenceNo || '', note: payment.note || '' } : { amount: '', date: todayIso(), label: '', mode: '', referenceNo: '', note: '' })
  }, [payment, plot.id])

  const submit = async (e) => {
    e?.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { amount: f.amount, date: f.date, mode: f.mode, referenceNo: f.referenceNo, note: f.note, ...(isCommission ? {} : { label: f.label }) }
      const res = isCommission
        ? editing
          ? await updateCommissionPayment(payment.id, body)
          : await addCommissionPayment(plot.id, body)
        : editing
          ? await updatePayment(payment.id, body)
          : await addPayment(plot.id, body)
      onSaved(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={`space-y-4 ${compact ? 'rounded-2xl border border-slate-200 bg-slate-50/60 p-4' : ''}`} noValidate>
      <FormError message={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Amount (₹)"
          htmlFor="pay-amount"
          required
          hint={room != null && room > 0 ? (
            <>
              {isCommission ? 'Pending' : 'Balance'}: {inr(room)}{' '}
              <button type="button" className="font-bold text-[#0F3D2E] hover:underline" onClick={() => set('amount')(String(room))}>
                use full amount
              </button>
            </>
          ) : undefined}
        >
          <NumberInput id="pay-amount" value={f.amount} onChange={set('amount')} autoFocus />
        </Field>
        <Field label="Date" htmlFor="pay-date" required>
          <TextInput id="pay-date" type="date" value={f.date} onChange={set('date')} />
        </Field>
        {!isCommission && (
          <EditableSelect label="Payment for" value={f.label} onChange={set('label')} options={forList.options} onCreate={forList.add} onDelete={forList.remove} placeholder="e.g. Booking advance" />
        )}
        <EditableSelect label="Mode" value={f.mode} onChange={set('mode')} options={modeList.options} onCreate={modeList.add} onDelete={modeList.remove} placeholder="e.g. UPI" />
        <Field label="Reference no." htmlFor="pay-ref">
          <TextInput id="pay-ref" value={f.referenceNo} onChange={set('referenceNo')} maxLength={60} placeholder="UPI / cheque / UTR no." />
        </Field>
        <Field label="Note" htmlFor="pay-note" className={isCommission ? '' : 'sm:col-span-2'}>
          <TextInput id="pay-note" value={f.note} onChange={set('note')} maxLength={300} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className={btnGhost} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing ? 'Save changes' : isCommission ? 'Record commission payment' : 'Record payment'}
        </button>
      </div>
    </form>
  )
}

/** Record a payment from a project-level tab: pick the plot first. */
export function PaymentModal({ kind, plots, onClose, onSaved }) {
  const isCommission = kind === 'commission'
  const eligible = useMemo(() => plots.filter((p) => (isCommission ? p.brokerId && p.commissionPayable > 0 : p.customer?.name)), [plots, isCommission])
  const [plotId, setPlotId] = useState('')
  const plot = eligible.find((p) => p.id === plotId)
  return (
    <LandModal
      open
      onClose={onClose}
      title={isCommission ? 'Record commission payment' : 'Record customer payment'}
      subtitle={isCommission ? 'Commission paid to a broker for a plot' : 'Money received from a plot customer'}
      width="max-w-xl"
    >
      <div className="space-y-4">
        <SearchSelect
          label="Plot"
          required
          value={plotId}
          onChange={(v) => setPlotId(v || '')}
          options={eligible.map((p) => ({
            value: p.id,
            label: `Plot ${p.plotNo}${p.block ? ` · Block ${p.block}` : ''} · ${p.customer?.name || ''}`,
            sub: isCommission ? `${p.brokerName} · pending ${inr(p.commissionPending)}` : `Balance ${inr(p.balance)}`,
          }))}
          placeholder={eligible.length ? 'Select the plot' : isCommission ? 'No plot has commission to pay yet' : 'No plot has a customer yet'}
          emptyText={isCommission ? 'Assign a broker and set the commission on a plot first' : 'Add a customer to a plot first'}
        />
        {plot && <PaymentForm kind={kind} plot={plot} onSaved={(res) => (onSaved(res), onClose())} onCancel={onClose} />}
      </div>
    </LandModal>
  )
}
