import React, { useMemo, useState } from 'react'
import { X, ChevronDown, Check, MessageCircle, Mail } from 'lucide-react'
import SearchSelect from '../common/SearchSelect'
import { guessFromLead } from '../common/CustomerPlotPicker'
import { useOptions } from '../../hooks/useOptions'
import { ensurePlotUids, formatRupees, parseRupees, statusGroup } from '../../lib/plotUtils'
import { PaymentDocumentSection, ShareResults, useDocumentSender } from '../documents/PlotDocumentSharing'
import { newRequestKey } from '../../lib/plotDocumentsApi'

const DEFAULT_FOR = ['Token advance', 'Booking advance', 'Part payment', 'Full payment', 'Registration advance']
const DEFAULT_MODES = ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card']

const inputCls =
  'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition'
const labelCls = 'block text-xs font-bold text-slate-700 mb-1.5'

const today = () => new Date().toISOString().slice(0, 10)

/** Short receipt text used for the WhatsApp / email hand-off after saving. */
function receiptText(lead, payment) {
  const lines = [
    `Hi ${lead.name}, thank you for your payment to Crystal Estates.`,
    `${payment.paymentFor}: ${payment.amountFormatted}`,
    `Mode: ${payment.mode}${payment.referenceNo ? ` (Ref: ${payment.referenceNo})` : ''}`,
    payment.property ? `Project: ${payment.property}` : null,
    payment.unitAllotted && payment.unitAllotted !== 'Not allotted' ? `Unit: ${payment.unitAllotted}` : null,
    `Date: ${payment.date || payment.paidOn}`,
  ]
  return lines.filter(Boolean).join('\n')
}

export default function RecordPaymentModal({ isOpen, lead, ...rest }) {
  // Mounting the form only while open (keyed by lead) gives every opening a fresh form
  if (!isOpen || !lead) return null
  return <RecordPaymentForm key={lead.id} lead={lead} {...rest} />
}

function RecordPaymentForm({ lead, properties = [], onClose, onSavePayment }) {
  const forList = useOptions('paymentFor', DEFAULT_FOR)
  const modeList = useOptions('paymentMode', DEFAULT_MODES)
  const [initial] = useState(() => guessFromLead(lead, properties))

  const [paymentForChoice, setPaymentFor] = useState(DEFAULT_FOR[0])
  const [amount, setAmount] = useState('')
  const [modeChoice, setMode] = useState(DEFAULT_MODES[0])
  const [referenceNo, setReferenceNo] = useState('')
  const [paidOn, setPaidOn] = useState(today)
  const [target, setTarget] = useState(() => ({
    propertyId: initial.propertyId || '',
    plotUid: initial.plotUid || '',
    plotNo: initial.plotNo || '',
    phase: initial.phase || '',
  }))
  const [unitAllotted, setUnitAllotted] = useState(() =>
    initial.plotNo ? '' : lead.unit && lead.unit !== 'Not allotted' ? lead.unit : '',
  )
  const [sendWhatsApp, setSendWhatsApp] = useState(Boolean(lead.phone))
  const [sendEmail, setSendEmail] = useState(Boolean(lead.email))
  const [moveLeadToWon, setMoveLeadToWon] = useState(true)
  const [payStatus, setPayStatus] = useState('Received')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [saved, setSaved] = useState(null) // { payment, whatsapp, email } after a successful save
  // Plot documents to send with the confirmation (only when the user ticks a channel)
  const [docIds, setDocIds] = useState([])
  const [shareChannels, setShareChannels] = useState([])
  const [requestId] = useState(() => newRequestKey('pay'))
  const sender = useDocumentSender()

  // Server-managed option lists may not contain the default; fall back to their first entry
  const paymentFor = forList.options.includes(paymentForChoice) ? paymentForChoice : forList.options[0] || ''
  const mode = modeList.options.includes(modeChoice) ? modeChoice : modeList.options[0] || ''

  const projectOptions = useMemo(
    () => properties.filter((p) => p && p.id && p.name).map((p) => ({ value: p.id, label: p.name, sub: p.location })),
    [properties],
  )
  const project = properties.find((p) => p.id === target.propertyId)
  const plots = useMemo(() => ensurePlotUids(project?.plots || []), [project])
  const multiPhase = new Set(plots.map((p) => p.phase).filter(Boolean)).size > 1
  const plotOptions = useMemo(
    () =>
      plots.map((p) => ({
        value: p.uid,
        label: `Plot ${p.plotNo}${multiPhase && p.phase ? ` · ${p.phase}` : ''}`,
        sub: [statusGroup(p.status), p.area, p.facing && `${p.facing} facing`].filter(Boolean).join(' · '),
      })),
    [plots, multiPhase],
  )

  const parsedAmount = parseRupees(amount)

  // A different plot has different documents: clear what was picked
  const clearDocs = () => {
    setDocIds([])
    setShareChannels([])
  }
  const setProject = (propertyId) => {
    setTarget({ propertyId: propertyId || '', plotUid: '', plotNo: '', phase: '' })
    clearDocs()
  }
  const setPlot = (uid) => {
    const p = plots.find((x) => x.uid === uid)
    setTarget((t) => ({ ...t, plotUid: uid || '', plotNo: p?.plotNo ? String(p.plotNo) : '', phase: p?.phase || '' }))
    clearDocs()
  }
  const sharing = Boolean(target.plotNo && docIds.length && shareChannels.length)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.')
      return
    }
    if (!paymentFor) {
      setErrorMessage('Choose what the payment is for.')
      return
    }

    setSubmitting(true)
    try {
      const amountFormatted = formatRupees(parsedAmount)
      const unit = target.plotNo ? `Plot ${target.plotNo}` : unitAllotted.trim()
      const result = await onSavePayment({
        paymentFor,
        amount: parsedAmount,
        amountFormatted,
        mode,
        referenceNo: referenceNo.trim(),
        paidOn,
        unitAllotted: unit,
        propertyId: target.propertyId,
        plotUid: target.plotUid,
        plotNo: target.plotNo,
        phase: target.phase,
        // Receipts are handed off below; the server only records the payment
        sendWhatsApp: false,
        sendEmail: false,
        moveLeadToWon,
        // Same id on a repeated submit: the server returns the first payment instead of a second one
        clientRequestId: requestId,
        status: payStatus,
        note: note.trim(),
        documentIds: target.plotNo ? docIds : [],
      })
      const savedLead = result?.lead
      const savedPayment =
        (Array.isArray(savedLead?.payments) && savedLead.payments.find((p) => p.clientRequestId === requestId)) || result?.payment || null

      // Only after the payment is saved, and only through the channels the user ticked
      let shareResults = null
      if (sharing && savedPayment?.id) {
        shareResults = await sender.send({
          documentIds: docIds,
          channels: shareChannels,
          recipient: { type: 'lead', leadId: lead.id },
          propertyId: target.propertyId,
          plotUid: target.plotUid,
          plotNo: target.plotNo,
          phase: target.phase,
          paymentId: savedPayment.id,
          idempotencyKey: `payment:${savedPayment.id}`,
        })
      }

      const wantsWa = sendWhatsApp && lead.phone
      const wantsEmail = sendEmail && lead.email
      if (!wantsWa && !wantsEmail && !sharing) {
        onClose()
        return
      }
      const payment = savedPayment || {
        paymentFor,
        amountFormatted,
        mode,
        referenceNo: referenceNo.trim(),
        property: project?.name || lead.property,
        unitAllotted: unit,
        paidOn,
      }
      setSaved({ payment, whatsapp: Boolean(wantsWa), email: Boolean(wantsEmail), shared: sharing, shareResults })
    } catch (err) {
      setErrorMessage(err?.message || 'Error recording payment. Please verify the details and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const header = (
    <div className="px-6 py-4.5 border-b border-slate-100 flex items-start justify-between">
      <div>
        <h3 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
          {saved ? 'Payment recorded' : 'Record advance payment'}
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          {saved ? 'Share the receipt with the customer' : 'Log a booking, token or milestone payment'}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )

  if (saved) {
    const text = receiptText(lead, saved.payment)
    const phone = String(lead.phone || '').replace(/[^0-9]/g, '')
    return (
      <div className="fixed inset-0 z-70 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Payment recorded">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-lg w-full overflow-hidden font-sans">
          {header}
          <div className="p-6 space-y-4">
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-semibold">
              {saved.payment.paymentFor} of {saved.payment.amountFormatted} saved for {lead.name}.
            </div>
            {saved.shared && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Documents</p>
                {sender.sending ? (
                  <p className="text-xs text-slate-500">Sending…</p>
                ) : sender.error ? (
                  <p className="text-xs text-rose-600">{sender.error}</p>
                ) : (
                  <ShareResults results={sender.results || saved.shareResults} onRetry={sender.retry} retrying={sender.sending} />
                )}
              </div>
            )}
            {(saved.whatsapp || saved.email) && <p className="text-xs font-bold text-slate-700">Receipt</p>}
            <div className="flex flex-wrap gap-2.5">
              {saved.whatsapp && (
                <a
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-xl text-xs transition no-underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Send receipt on WhatsApp
                </a>
              )}
              {saved.email && (
                <a
                  href={`mailto:${lead.email}?subject=${encodeURIComponent('Payment receipt · Crystal Estates')}&body=${encodeURIComponent(text)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs transition no-underline"
                >
                  <Mail className="w-3.5 h-3.5" /> Email receipt
                </a>
              )}
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-xs shadow-sm transition"
              >
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Record advance payment">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-lg w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
        {header}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" noValidate>
          {errorMessage && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700 font-medium">
              <span>{errorMessage}</span>
              <button type="button" onClick={() => setErrorMessage('')} aria-label="Dismiss" className="text-rose-400 hover:text-rose-600 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Customer */}
          <div>
            <label className={labelCls} htmlFor="rpm-customer">Customer</label>
            <input
              id="rpm-customer"
              type="text"
              readOnly
              value={`${lead.name}${lead.phone ? ` · ${lead.phone}` : ''}`}
              className={`${inputCls} font-semibold cursor-default`}
            />
          </div>

          {/* Project & plot from listed properties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SearchSelect
              label="Project"
              value={target.propertyId}
              onChange={setProject}
              options={projectOptions}
              placeholder={projectOptions.length ? 'Select project' : 'No listed projects'}
              emptyText="No matching projects"
              clearable
            />
            <SearchSelect
              label="Plot (optional)"
              value={target.plotUid}
              onChange={setPlot}
              options={plotOptions}
              placeholder={project ? 'Select plot' : 'Pick a project first'}
              disabled={!project}
              emptyText="This project has no plots yet"
              clearable
            />
          </div>

          {/* Documents of the selected plot */}
          {target.propertyId && (
            <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2">
              <p className="text-xs font-bold text-slate-700">Plot documents{target.plotNo ? ` · Plot ${target.plotNo}` : ''}</p>
              <PaymentDocumentSection
                plotRef={{ propertyId: target.propertyId, plotUid: target.plotUid, plotNo: target.plotNo, phase: target.phase }}
                recipient={{ name: lead.name, phone: lead.phone, email: lead.email }}
                docIds={docIds}
                onDocIds={setDocIds}
                channels={shareChannels}
                onChannels={setShareChannels}
              />
            </div>
          )}

          {/* Payment for & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="rpm-for">Payment for</label>
              <div className="relative">
                <select
                  id="rpm-for"
                  value={paymentFor}
                  onChange={(e) => setPaymentFor(e.target.value)}
                  className={`${inputCls} appearance-none font-semibold cursor-pointer pr-8`}
                >
                  {forList.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="rpm-amount">Amount (₹)</label>
              <input
                id="rpm-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 25500 or 2 L"
                className={`${inputCls} font-bold text-slate-900`}
              />
              {parsedAmount > 0 && <p className="mt-1 text-[11px] text-slate-500">{formatRupees(parsedAmount)}</p>}
            </div>
          </div>

          {/* Mode & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="rpm-mode">Mode</label>
              <div className="relative">
                <select
                  id="rpm-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className={`${inputCls} appearance-none font-semibold cursor-pointer pr-8`}
                >
                  {modeList.options.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="rpm-ref">Reference no.</label>
              <input
                id="rpm-ref"
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="UPI / cheque / UTR no."
                className={inputCls}
              />
            </div>
          </div>

          {/* Paid on & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="rpm-date">Paid on</label>
              <input id="rpm-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="rpm-unit">Unit allotted</label>
              <input
                id="rpm-unit"
                type="text"
                value={target.plotNo ? `Plot ${target.plotNo}` : unitAllotted}
                onChange={(e) => setUnitAllotted(e.target.value)}
                readOnly={Boolean(target.plotNo)}
                placeholder="e.g. Plot #12"
                className={`${inputCls}${target.plotNo ? ' cursor-default' : ''}`}
              />
            </div>
          </div>

          {/* Status & note */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="rpm-status">Payment status</label>
              <div className="relative">
                <select id="rpm-status" value={payStatus} onChange={(e) => setPayStatus(e.target.value)} className={`${inputCls} appearance-none font-semibold cursor-pointer pr-8`}>
                  {['Received', 'Pending clearance', 'Failed'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="rpm-note">Note</label>
              <input id="rpm-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional" className={inputCls} />
            </div>
          </div>

          {/* Options */}
          <div className="pt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className={`flex items-center gap-2 text-xs font-medium ${lead.phone ? 'cursor-pointer text-slate-700' : 'text-slate-400'}`}>
              <input
                type="checkbox"
                checked={sendWhatsApp}
                disabled={!lead.phone}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-[#0F3D2E]"
              />
              <span>Send receipt on WhatsApp</span>
            </label>
            <label className={`flex items-center gap-2 text-xs font-medium ${lead.email ? 'cursor-pointer text-slate-700' : 'text-slate-400'}`}>
              <input
                type="checkbox"
                checked={sendEmail}
                disabled={!lead.email}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-[#0F3D2E]"
              />
              <span>Email receipt</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={moveLeadToWon}
                onChange={(e) => setMoveLeadToWon(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-[#0F3D2E]"
              />
              <span>Move lead to Won</span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{submitting ? (sender.sending ? 'Sending documents…' : 'Saving...') : sharing ? 'Save & send' : 'Save payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
