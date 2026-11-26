import React, { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import EditableSelect from '../common/EditableSelect'
import { btnGhost, btnPrimary } from '../common/PageKit'
import { useOptions } from '../../hooks/useOptions'
import { updatePlotEntry } from '../../lib/api'
import { LandModal, Field, TextInput, NumberInput, SelectInput, FormError } from '../land/LandKit'
import { PAYMENT_STATUSES } from '../leads/LeadMoney'

const MODES = ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card']

/** Correct a payment that was entered on a plot: amount, date, mode, reference, status and note. */
export default function PlotPaymentEdit({ payment, onClose, onSaved }) {
  const modes = useOptions('paymentMode', MODES)
  const [f, setF] = useState({
    amount: payment.amount ?? '',
    paidOn: String(payment.date || '').slice(0, 10),
    mode: payment.mode || '',
    referenceNo: payment.ref || '',
    status: payment.status || 'Received',
    note: payment.note || '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await updatePlotEntry(payment.id, f)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <LandModal
      open
      onClose={onClose}
      title="Edit payment"
      subtitle="Entered on this plot"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-plot-payment" className={btnPrimary} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save changes
          </button>
        </>
      }
    >
      <form id="edit-plot-payment" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount (₹)" htmlFor="epp-amount" required>
            <NumberInput id="epp-amount" value={f.amount} onChange={set('amount')} autoFocus />
          </Field>
          <Field label="Paid on" htmlFor="epp-date">
            <TextInput id="epp-date" type="date" value={f.paidOn} onChange={set('paidOn')} />
          </Field>
          <EditableSelect label="Mode" value={f.mode} onChange={set('mode')} options={modes.options} onCreate={modes.add} onDelete={modes.remove} />
          <Field label="Reference / transaction no." htmlFor="epp-ref">
            <TextInput id="epp-ref" value={f.referenceNo} onChange={set('referenceNo')} maxLength={60} />
          </Field>
          <Field label="Status" htmlFor="epp-status" hint="Only “Received” counts towards the balance">
            <SelectInput id="epp-status" value={f.status} onChange={set('status')} options={PAYMENT_STATUSES} />
          </Field>
          <Field label="Note" htmlFor="epp-note">
            <TextInput id="epp-note" value={f.note} onChange={set('note')} maxLength={500} />
          </Field>
        </div>
      </form>
    </LandModal>
  )
}
