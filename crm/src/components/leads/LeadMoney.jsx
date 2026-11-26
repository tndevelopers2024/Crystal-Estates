import React, { useMemo, useState } from 'react'
import { Pencil, Trash2, Check, Loader2, Plus } from 'lucide-react'
import EditableSelect from '../common/EditableSelect'
import { useOptions } from '../../hooks/useOptions'
import { useDialog } from '../../context/DialogContext'
import { updateLeadPayment, deletePayment } from '../../lib/api'
import { LandModal, Field, TextInput, NumberInput, SelectInput, FormError, inr, fmtDate } from '../land/LandKit'
import { Badge, btnGhost, btnPrimary } from '../common/PageKit'

export const PAYMENT_STATUSES = ['Received', 'Pending clearance', 'Failed']
const STATUS_TONE = { Received: 'green', 'Pending clearance': 'amber', Failed: 'rose' }
export const PaymentStatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status || 'Received'] || 'slate'}>{status || 'Received'}</Badge>

const MODES = ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card']
const FOR = ['Token advance', 'Booking advance', 'Part payment', 'Full payment', 'Registration advance']

/** Correct a recorded payment: amount, date, what it is for, mode, reference, status and note. */
export function EditPaymentModal({ payment, onClose, onSaved }) {
  const forList = useOptions('paymentFor', FOR)
  const modeList = useOptions('paymentMode', MODES)
  const [f, setF] = useState({
    amount: payment.amount ?? '',
    paidOn: payment.paidOn || '',
    paymentFor: payment.paymentFor || '',
    mode: payment.mode || '',
    referenceNo: payment.referenceNo || '',
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
      const res = await updateLeadPayment(payment.id, f)
      onSaved(res.payment)
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
      subtitle={`${payment.paymentFor || 'Payment'} · ${payment.leadName || ''}`}
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-payment" className={btnPrimary} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save changes
          </button>
        </>
      }
    >
      <form id="edit-payment" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount (₹)" htmlFor="ep-amount" required>
            <NumberInput id="ep-amount" value={f.amount} onChange={set('amount')} autoFocus />
          </Field>
          <Field label="Payment date" htmlFor="ep-date" required>
            <TextInput id="ep-date" type="date" value={f.paidOn} onChange={set('paidOn')} />
          </Field>
          <EditableSelect label="Payment for" value={f.paymentFor} onChange={set('paymentFor')} options={forList.options} onCreate={forList.add} onDelete={forList.remove} />
          <EditableSelect label="Mode" value={f.mode} onChange={set('mode')} options={modeList.options} onCreate={modeList.add} onDelete={modeList.remove} />
          <Field label="Reference / transaction no." htmlFor="ep-ref">
            <TextInput id="ep-ref" value={f.referenceNo} onChange={set('referenceNo')} maxLength={60} />
          </Field>
          <Field label="Status" htmlFor="ep-status" hint="Only “Received” counts towards the balance">
            <SelectInput id="ep-status" value={f.status} onChange={set('status')} options={PAYMENT_STATUSES} />
          </Field>
          <Field label="Note" htmlFor="ep-note" className="sm:col-span-2">
            <TextInput id="ep-note" value={f.note} onChange={set('note')} maxLength={500} />
          </Field>
        </div>
      </form>
    </LandModal>
  )
}

/**
 * Payments of a lead: the agreed price, what is received and pending, and every
 * payment with its status and note. Edits go through the server; onRefresh reloads the lead.
 */
export default function LeadPayments({ lead, canEdit, onRecord, onSaveAgreedPrice, onRefresh }) {
  const { confirm, alert } = useDialog()
  const payments = useMemo(() => [...(lead.payments || [])].sort((a, b) => String(b.paidOn || b.createdAt).localeCompare(String(a.paidOn || a.createdAt))), [lead.payments])
  const received = payments.filter((p) => (p.status || 'Received') === 'Received').reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const awaiting = payments.filter((p) => p.status === 'Pending clearance').reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const agreed = lead.dealValue != null ? Number(lead.dealValue) : null
  const pending = agreed != null ? Math.max(agreed - received, 0) : null
  const [editingPrice, setEditingPrice] = useState(false)
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(null)

  const savePrice = async () => {
    setBusy(true)
    try {
      await onSaveAgreedPrice(price === '' ? null : price)
      setEditingPrice(false)
    } catch (err) {
      await alert({ title: 'Could not save the agreed price', message: err.message, confirmText: 'OK', type: 'info' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p) => {
    const ok = await confirm({ title: 'Delete payment', message: `Delete the ${p.paymentFor || 'payment'} of ${inr(p.amount)}? This also removes it from the plot history.`, confirmText: 'Delete payment', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      await deletePayment(p.id)
      await onRefresh()
    } catch (err) {
      await alert({ title: 'Could not delete the payment', message: err.message, confirmText: 'OK', type: 'info' })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Payments</span>
        {canEdit && (
          <button type="button" onClick={onRecord} className="inline-flex items-center gap-1 text-xs font-bold text-[#0F3D2E] hover:text-[#16533D] transition">
            <Plus className="w-3.5 h-3.5" /> Record
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Agreed price', agreed != null ? inr(agreed) : 'Not set', 'text-slate-900'],
          ['Received', inr(received), 'text-emerald-700'],
          ['Pending', pending != null ? inr(pending) : '—', pending > 0 ? 'text-rose-700' : 'text-slate-900'],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-slate-200 p-2.5 min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{k}</p>
            <p className={`text-xs sm:text-sm font-extrabold mt-0.5 tabular-nums truncate ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      {awaiting > 0 && <p className="text-[11px] text-amber-700">{inr(awaiting)} is awaiting clearance and not counted yet.</p>}

      {editingPrice ? (
        <div className="flex items-center gap-2">
          <NumberInput value={price} onChange={setPrice} placeholder="Agreed price (₹)" aria-label="Agreed price" autoFocus />
          <button type="button" onClick={savePrice} disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => setEditingPrice(false)} className={btnGhost}>
            Cancel
          </button>
        </div>
      ) : (
        canEdit && (
          <button
            type="button"
            onClick={() => {
              setPrice(agreed ?? '')
              setEditingPrice(true)
            }}
            className="text-[11px] font-bold text-[#0F3D2E] hover:underline"
          >
            {agreed != null ? 'Change agreed price' : 'Set the agreed price to track the pending balance'}
          </button>
        )
      )}

      {payments.length === 0 ? (
        <p className="text-xs text-slate-400">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {payments.map((p) => (
            <li key={p.id} className="p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 tabular-nums flex items-center gap-2 flex-wrap">
                  {inr(p.amount)} <PaymentStatusBadge status={p.status} />
                </p>
                <p className="text-[11px] text-slate-500 truncate">{[p.paymentFor, p.mode, p.referenceNo && `Ref ${p.referenceNo}`].filter(Boolean).join(' · ') || '—'}</p>
                {p.note && <p className="text-[11px] text-slate-600 mt-0.5">{p.note}</p>}
                {(p.propertyId || p.plotNo) && <p className="text-[10.5px] text-slate-400 mt-0.5">{[p.property, p.plotNo && `Plot ${p.plotNo}`].filter(Boolean).join(' · ')}</p>}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <span className="text-[11px] text-slate-500 mr-1">{p.paidOn ? fmtDate(p.paidOn) : p.date}</span>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => setEdit({ ...p, leadName: lead.name })} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F3D2E] hover:bg-slate-100" aria-label={`Edit payment of ${inr(p.amount)}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete payment of ${inr(p.amount)}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {edit && <EditPaymentModal payment={edit} onClose={() => setEdit(null)} onSaved={() => onRefresh()} />}
    </div>
  )
}
