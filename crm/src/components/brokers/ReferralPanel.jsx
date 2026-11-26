import React, { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Pencil, Trash2, Handshake, Info, UserX } from 'lucide-react'
import EditableSelect from '../common/EditableSelect'
import { btnGhost, btnPrimary } from '../common/PageKit'
import { useOptions } from '../../hooks/useOptions'
import { useDialog } from '../../context/DialogContext'
import { BrokerSelect } from '../land/Parties'
import { Field, TextInput, NumberInput, SelectInput, FormError, SectionTitle, CommissionStatus, useAsync, inr, fmtDate, fmtDateTime, todayIso } from '../land/LandKit'
import { getReferral, saveReferral, addCommissionPayment, updateCommissionPayment, deleteCommissionPayment } from '../../lib/brokersApi'

const MODES = ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card']
const cmText = (c) => (c ? (c.type === 'percent' ? `${c.value}%` : `${inr(c.value)} fixed`) : 'No commission set')

function CommissionPaymentForm({ owner, payment, onSaved, onCancel }) {
  const modes = useOptions('paymentMode', MODES)
  const [f, setF] = useState(() => ({ amount: payment?.amount ?? '', date: payment?.date || todayIso(), mode: payment?.mode || '', referenceNo: payment?.referenceNo || '', note: payment?.note || '' }))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = payment ? await updateCommissionPayment(payment.id, f) : await addCommissionPayment(owner, f)
      onSaved(res.view)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4" noValidate>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)" htmlFor="cp-amount" required>
          <NumberInput id="cp-amount" value={f.amount} onChange={set('amount')} autoFocus />
        </Field>
        <Field label="Date" htmlFor="cp-date" required>
          <TextInput id="cp-date" type="date" value={f.date} onChange={set('date')} />
        </Field>
        <EditableSelect label="Mode" value={f.mode} onChange={set('mode')} options={modes.options} onCreate={modes.add} onDelete={modes.remove} placeholder="e.g. UPI" />
        <Field label="Reference no." htmlFor="cp-ref">
          <TextInput id="cp-ref" value={f.referenceNo} onChange={set('referenceNo')} maxLength={60} />
        </Field>
        <Field label="Note" htmlFor="cp-note" className="col-span-2">
          <TextInput id="cp-note" value={f.note} onChange={set('note')} maxLength={300} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {payment ? 'Save changes' : 'Record payment'}
        </button>
      </div>
    </form>
  )
}

/**
 * The broker on one lead or plot booking: who it is, the commission, commission
 * payments and the broker's activity on this deal.
 *   owner: { type: 'lead', leadId } | { type: 'booking', propertyId, plotUid, plotNo, phase }
 *   dealHint: where the deal value (the base of a percentage commission) is entered
 */
export default function ReferralPanel({ owner, canEdit = true, onShowToast, onChanged, dealHint = 'the agreed price' }) {
  const { confirm } = useDialog()
  const ownerKey = JSON.stringify(owner)
  const { data, loading, error, reload, setData } = useAsync(() => getReferral(owner), [ownerKey])
  const referral = data?.referral || null
  const [f, setF] = useState({ brokerId: '', cmType: 'percent', cmValue: '', cmNote: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [paying, setPaying] = useState(null) // 'new' | payment
  const [notice, setNotice] = useState('')
  const say = (msg, type = 'success') => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
    onShowToast?.(msg, type)
  }

  useEffect(() => {
    setFormError(null)
    setF({ brokerId: referral?.brokerId || '', cmType: referral?.commission?.type || 'percent', cmValue: referral?.commission?.value ?? '', cmNote: referral?.commission?.note || '' })
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const dirty = (referral?.brokerId || '') !== f.brokerId || (referral?.commission?.type || 'percent') !== f.cmType || String(referral?.commission?.value ?? '') !== String(f.cmValue) || (referral?.commission?.note || '') !== f.cmNote

  const apply = (view) => {
    if (view) setData(view)
    else reload()
    onChanged?.()
  }

  const save = async () => {
    setFormError(null)
    if (!f.brokerId) return setFormError('Choose a broker, or use “Remove broker”.')
    setSaving(true)
    try {
      const res = await saveReferral(owner, f.brokerId, { type: f.cmType, value: f.cmValue, note: f.cmNote })
      apply(res.view)
      say('Broker details saved')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({ title: 'Remove broker', message: `Remove ${referral.brokerName} from this deal? The change is kept in the broker's activity log.`, confirmText: 'Remove broker', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    setSaving(true)
    try {
      apply((await saveReferral(owner, '', null)).view)
      say('Broker removed', 'info')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const removePayment = async (p) => {
    const ok = await confirm({ title: 'Delete commission payment', message: `Delete the payment of ${inr(p.amount)} dated ${fmtDate(p.date)}?`, confirmText: 'Delete payment', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      const res = await deleteCommissionPayment(p.id)
      apply(res.view)
      say('Commission payment deleted', 'info')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  if (loading && !data) return <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading broker details…</p>
  if (error && !data) {
    return (
      <p className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <Info className="w-4 h-4 shrink-0 text-slate-400" /> {error}
      </p>
    )
  }

  const logs = data?.logs || []
  const payments = data?.payments || []
  const noPriceForPercent = referral && referral.commission?.type === 'percent' && !(referral.dealValue > 0)

  return (
    <div className="space-y-5">
      {data?.owner?.via === 'booking' && (
        <p className="flex items-start gap-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-xl p-3">
          <Info className="w-4 h-4 shrink-0" /> The buyer of this plot is linked to the customer's lead <b>{data.owner.label}</b>, so the broker is recorded once, on that lead.
        </p>
      )}

      <section className="space-y-3">
        <SectionTitle aside={referral ? <CommissionStatus status={referral.status} /> : null}>Broker</SectionTitle>
        {canEdit ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <Field label="Broker" htmlFor="referral-broker">
              <BrokerSelect
                id="referral-broker"
                value={f.brokerId}
                onChange={(id, broker) =>
                  setF((x) => ({
                    ...x,
                    brokerId: id,
                    // The broker's usual commission, when none is entered yet
                    ...(broker?.defaultCommission && x.cmValue === '' ? { cmType: broker.defaultCommission.type, cmValue: broker.defaultCommission.value } : {}),
                  }))
                }
              />
            </Field>
            {f.brokerId && (
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <Field label="Commission" htmlFor="ref-cmtype">
                  <SelectInput id="ref-cmtype" value={f.cmType} onChange={set('cmType')} options={[{ value: 'percent', label: 'Percent (%)' }, { value: 'fixed', label: 'Fixed (₹)' }]} />
                </Field>
                <Field label={f.cmType === 'percent' ? `Percentage of ${dealHint}` : 'Amount (₹)'} htmlFor="ref-cmval">
                  <NumberInput id="ref-cmval" value={f.cmValue} onChange={set('cmValue')} />
                </Field>
                <Field label="Commission note" htmlFor="ref-cmnote" className="col-span-2">
                  <TextInput id="ref-cmnote" value={f.cmNote} onChange={set('cmNote')} maxLength={200} placeholder="e.g. Payable after registration" />
                </Field>
              </div>
            )}
            <FormError message={formError} />
            {notice && <p role="status" className="text-xs font-semibold text-emerald-700">{notice}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {referral ? (
                <button type="button" onClick={remove} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl">
                  <UserX className="w-4 h-4" /> Remove broker
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">Optional: leave empty for a direct sale.</span>
              )}
              <button type="button" onClick={save} disabled={saving || !dirty || !f.brokerId} className={btnPrimary}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save broker
              </button>
            </div>
          </div>
        ) : referral ? (
          <p className="text-sm font-semibold text-slate-800">{referral.brokerName} <span className="font-normal text-slate-500">· {cmText(referral.commission)}</span></p>
        ) : (
          <p className="text-sm text-slate-500">Direct sale: no broker.</p>
        )}
      </section>

      {referral && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[['Payable', inr(referral.payable)], ['Paid', inr(referral.paid)], ['Pending', inr(referral.pending)]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 p-3 min-w-0">
                <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">{k}</p>
                <p className="text-sm font-extrabold mt-0.5 tabular-nums truncate">{v}</p>
              </div>
            ))}
          </div>
          {noPriceForPercent && (
            <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Info className="w-4 h-4 shrink-0" /> A percentage commission needs {dealHint}. Set it to see the amount payable.
            </p>
          )}
          {referral.dealValue > 0 && <p className="text-[11px] text-slate-500 -mt-2">Commission is worked out on {inr(referral.dealValue)}.</p>}

          <section className="space-y-2">
            <SectionTitle aside={canEdit && !paying && referral.pending > 0 ? (
              <button type="button" onClick={() => setPaying('new')} className="inline-flex items-center gap-1 text-xs font-bold text-[#0F3D2E] hover:underline">
                <Plus className="w-3.5 h-3.5" /> Record payment
              </button>
            ) : null}>Commission payments ({payments.length})</SectionTitle>
            {paying && (
              <CommissionPaymentForm
                owner={owner}
                payment={paying === 'new' ? null : paying}
                onCancel={() => setPaying(null)}
                onSaved={(view) => {
                  setPaying(null)
                  apply(view)
                  say('Commission payment saved')
                }}
              />
            )}
            {payments.length === 0 ? (
              <p className="text-sm text-slate-400">No commission paid yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {payments.map((p) => (
                  <li key={p.id} className="p-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold tabular-nums">{inr(p.amount)}</p>
                      <p className="text-xs text-slate-500 truncate">{[p.mode, p.referenceNo && `Ref ${p.referenceNo}`, p.note].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-500 mr-1">{fmtDate(p.date)}</span>
                      {canEdit && (
                        <>
                          <button type="button" onClick={() => setPaying(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F3D2E] hover:bg-slate-100" aria-label={`Edit payment of ${inr(p.amount)}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => removePayment(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete payment of ${inr(p.amount)}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle>Broker activity on this deal</SectionTitle>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing yet.</p>
            ) : (
              <ol className="space-y-2.5">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center shrink-0 mt-0.5">
                      <Handshake className="w-3 h-3" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{l.title}</p>
                      {l.details && <p className="text-xs text-slate-500">{l.details}</p>}
                      {(l.changes || []).map((c) => (
                        <p key={c.field} className="text-xs text-slate-600">
                          {c.label}: <span className="line-through text-slate-400">{c.from}</span> → <b>{c.to}</b>
                        </p>
                      ))}
                      <p className="text-[11px] text-slate-400">{fmtDateTime(l.at)} · {l.by?.name || 'CRM user'}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  )
}
