import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  IndianRupee,
  CalendarDays,
  Users,
  Receipt,
  Trash2,
  X,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
} from 'lucide-react'
import { fetchAllPayments, recordLeadPayment, deletePayment } from '../../lib/api'
import { useOptions } from '../../hooks/useOptions'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../context/DialogContext'
import EditableSelect from '../common/EditableSelect'
import SearchSelect from '../common/SearchSelect'
import CustomerPlotPicker from '../common/CustomerPlotPicker'
import CustomerHistoryDrawer from '../common/CustomerHistoryDrawer'
import SidePanel from '../common/SidePanel'
import { formatRupees, parseRupees } from '../../lib/plotUtils'

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

const DEFAULT_FOR = ['Token advance', 'Booking advance', 'Part payment', 'Full payment', 'Registration advance']
const DEFAULT_MODES = ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card']

const paymentDate = (p) => p.paidOn || p.createdAt
const fmtDate = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? String(d || '—') : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Record payment form ─────────────────────────────────────────── */
function RecordPaymentForm({ leads, properties, onSaved, onCancel, actor }) {
  const forList = useOptions('paymentFor', DEFAULT_FOR)
  const modeList = useOptions('paymentMode', DEFAULT_MODES)
  const [target, setTarget] = useState({ leadId: '', propertyId: '', plotUid: '', plotNo: '', phase: '' })
  const [form, setForm] = useState({
    paymentFor: DEFAULT_FOR[0],
    amount: '',
    mode: DEFAULT_MODES[0],
    referenceNo: '',
    paidOn: new Date().toISOString().slice(0, 10),
    note: '',
    moveLeadToWon: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const amount = parseRupees(form.amount)
    if (!target.leadId) return setError('Select a customer.')
    if (!amount || amount <= 0) return setError('Enter a valid amount.')
    if (!form.paymentFor) return setError('Choose what the payment is for.')
    setSaving(true)
    try {
      const property = properties.find((p) => p.id === target.propertyId)
      const res = await recordLeadPayment(target.leadId, {
        paymentFor: form.paymentFor,
        amount,
        amountFormatted: formatRupees(amount),
        mode: form.mode,
        referenceNo: form.referenceNo.trim(),
        unitAllotted: target.plotNo ? `Plot ${target.plotNo}` : '',
        paidOn: form.paidOn,
        note: form.note.trim(),
        propertyId: target.propertyId,
        plotUid: target.plotUid,
        plotNo: target.plotNo,
        phase: target.phase,
        moveLeadToWon: form.moveLeadToWon,
        sendWhatsApp: false,
        sendEmail: false,
        actor,
      })
      onSaved(res.payment, { ...target, propertyName: property?.name })
    } catch (err) {
      setError(err.message || 'Could not save the payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <section className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Customer &amp; plot</h3>
          <CustomerPlotPicker leads={leads} properties={properties} value={target} onChange={setTarget} plotLabel="Plot (optional)" />
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Payment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditableSelect
              label="Payment for"
              required
              value={form.paymentFor}
              onChange={set('paymentFor')}
              options={forList.options}
              onCreate={forList.add}
              onDelete={forList.remove}
              hint="Type to add a new type"
            />
            <div>
              <label htmlFor="rp-amount" className={labelCls}>
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input id="rp-amount" inputMode="decimal" className={`${inputCls} pl-9`} value={form.amount} onChange={set('amount')} placeholder="500000" required />
              </div>
              {parseRupees(form.amount) > 0 && <p className="mt-1 text-[11px] text-slate-500">{formatRupees(parseRupees(form.amount))}</p>}
            </div>
            <EditableSelect
              label="Mode"
              value={form.mode}
              onChange={set('mode')}
              options={modeList.options}
              onCreate={modeList.add}
              onDelete={modeList.remove}
            />
            <div>
              <label htmlFor="rp-ref" className={labelCls}>Reference no.</label>
              <input id="rp-ref" className={inputCls} value={form.referenceNo} onChange={set('referenceNo')} placeholder="UPI / cheque / UTR no." />
            </div>
            <div>
              <label htmlFor="rp-date" className={labelCls}>Paid on</label>
              <input id="rp-date" type="date" className={inputCls} value={form.paidOn} onChange={set('paidOn')} />
            </div>
            <div>
              <label htmlFor="rp-note" className={labelCls}>Note</label>
              <input id="rp-note" className={inputCls} value={form.note} onChange={set('note')} placeholder="Optional" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.moveLeadToWon} onChange={set('moveLeadToWon')} className="w-4 h-4 accent-[#0F3D2E]" />
            Move this lead to <strong>Won</strong>
          </label>
        </section>
      </div>

      <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save payment
        </button>
      </div>
    </form>
  )
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function PaymentsPage({ leads = [], properties = [], onShowToast, onLeadsChanged }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { confirm } = useDialog()
  const actor = useMemo(() => ({ name: user?.name || user?.email || 'CRM user', email: user?.email || '' }), [user])
  const modeList = useOptions('paymentMode', DEFAULT_MODES)

  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [historyLeadId, setHistoryLeadId] = useState(null)
  const [justSaved, setJustSaved] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllPayments()
      setPayments(Array.isArray(data.payments) ? data.payments : [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const project = properties.find((p) => p.id === projectFilter)
    return payments.filter((p) => {
      if (project && p.propertyId !== project.id && String(p.property || '').toLowerCase() !== project.name.toLowerCase()) return false
      if (modeFilter && p.mode !== modeFilter) return false
      if (!q) return true
      return [p.leadName, p.referenceNo, p.paymentFor, p.property, p.unitAllotted, p.plotNo].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [payments, search, projectFilter, modeFilter, properties])

  const stats = useMemo(() => {
    const now = new Date()
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const month = payments
      .filter((p) => {
        const d = new Date(paymentDate(p))
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return { total, month, count: payments.length, customers: new Set(payments.map((p) => p.leadId)).size }
  }, [payments])

  const handleSaved = async (payment, target) => {
    setFormOpen(false)
    setJustSaved({ payment, target })
    onShowToast?.(`Payment of ${formatRupees(payment.amount)} recorded`, 'success')
    await load()
    onLeadsChanged?.()
  }

  const handleDelete = async (p) => {
    const ok = await confirm({
      title: 'Delete Payment Record',
      message: `Are you sure you want to delete the ${p.paymentFor} of ${formatRupees(p.amount)} from ${p.leadName}? This also removes it from the plot history.`,
      tag: `${p.leadName} · ${formatRupees(p.amount)}`,
      confirmText: 'Delete Payment',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    try {
      await deletePayment(p.id)
      setPayments((list) => list.filter((x) => x.id !== p.id))
      onShowToast?.('Payment deleted', 'info')
      onLeadsChanged?.()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  const shareReceipt = (p) => {
    const params = new URLSearchParams({ share: 'Payment receipt', leadId: p.leadId || '', paymentId: p.id })
    if (p.propertyId) params.set('propertyId', p.propertyId)
    if (p.plotUid) params.set('plotUid', p.plotUid)
    if (p.plotNo) params.set('plotNo', p.plotNo)
    navigate(`/documents?${params.toString()}`)
  }

  const historyLead = leads.find((l) => l.id === historyLeadId)

  return (
    <div className="max-w-[1500px] mx-auto pb-10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Payments</h1>
          <p className="text-sm text-slate-500">Record and track customer payments by plot.</p>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-sm font-bold rounded-xl">
          <Plus className="w-4 h-4" /> Record payment
        </button>
      </div>

      {justSaved && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            <strong>{formatRupees(justSaved.payment.amount)}</strong> recorded for {justSaved.payment.leadName}
            {justSaved.target.plotNo ? ` · Plot ${justSaved.target.plotNo}` : ''}.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => shareReceipt(justSaved.payment)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F3D2E] text-white text-xs font-bold rounded-xl">
              <Receipt className="w-4 h-4" /> Share receipt
            </button>
            <button type="button" onClick={() => setJustSaved(null)} className="p-2 text-emerald-800 hover:bg-emerald-100 rounded-xl" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total received', value: formatRupees(stats.total), icon: Wallet },
          { label: 'This month', value: formatRupees(stats.month), icon: CalendarDays },
          { label: 'Payments', value: stats.count, icon: Receipt },
          { label: 'Paying customers', value: stats.customers, icon: Users },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
                <span className="w-8 h-8 rounded-xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center">
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 grid grid-cols-1 md:grid-cols-[1fr_220px_220px] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, reference, plot…" className={`${inputCls} pl-9`} aria-label="Search payments" />
          </div>
          <SearchSelect value={projectFilter} onChange={setProjectFilter} options={properties.map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects" clearable />
          <SearchSelect value={modeFilter} onChange={setModeFilter} options={modeList.options.map((m) => ({ value: m, label: m }))} placeholder="All modes" clearable />
        </div>

        {loading ? (
          <p className="p-8 text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading payments…
          </p>
        ) : error ? (
          <p className="p-8 text-sm text-rose-600 text-center">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center mx-auto mb-3">
              <Wallet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">{payments.length ? 'No payments match your filters' : 'No payments yet'}</p>
            <p className="text-xs text-slate-500 mt-1">Use “Record payment” to log a token, booking or milestone payment.</p>
          </div>
        ) : (
          <>
            {/* Table on wide screens */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Date</th>
                    <th className="text-left font-semibold px-4 py-3">Customer</th>
                    <th className="text-left font-semibold px-4 py-3">Project / plot</th>
                    <th className="text-left font-semibold px-4 py-3">For</th>
                    <th className="text-left font-semibold px-4 py-3">Mode &amp; ref</th>
                    <th className="text-right font-semibold px-4 py-3">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(paymentDate(p))}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setHistoryLeadId(p.leadId)} className="font-semibold text-slate-900 hover:text-[#0F3D2E] hover:underline">
                          {p.leadName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.property}
                        {p.plotNo ? <span className="text-slate-400"> · Plot {p.plotNo}</span> : p.unitAllotted && p.unitAllotted !== 'Not allotted' ? <span className="text-slate-400"> · {p.unitAllotted}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.paymentFor}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.mode}
                        {p.referenceNo && <span className="block text-[11px] text-slate-400">{p.referenceNo}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatRupees(p.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => shareReceipt(p)} className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Share receipt for ${p.leadName}`} title="Share receipt">
                            <Receipt className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(p)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete payment from ${p.leadName}`} title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on phones */}
            <ul className="md:hidden divide-y divide-slate-100">
              {filtered.map((p) => (
                <li key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button type="button" onClick={() => setHistoryLeadId(p.leadId)} className="text-sm font-bold text-slate-900 truncate">
                        {p.leadName}
                      </button>
                      <p className="text-xs text-slate-500 truncate">
                        {p.paymentFor} · {p.mode} · {fmtDate(paymentDate(p))}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {p.property}
                        {p.plotNo ? ` · Plot ${p.plotNo}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 shrink-0">{formatRupees(p.amount)}</p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => shareReceipt(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E2EDE8] text-[#0F3D2E] text-xs font-bold">
                      <Receipt className="w-3.5 h-3.5" /> Receipt
                    </button>
                    <button type="button" onClick={() => handleDelete(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 text-xs font-bold hover:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <SidePanel open={formOpen} onClose={() => setFormOpen(false)} title="Record payment" subtitle="Log a booking, token or milestone payment" icon={IndianRupee}>
        {formOpen && <RecordPaymentForm leads={leads} properties={properties} onSaved={handleSaved} onCancel={() => setFormOpen(false)} actor={actor} />}
      </SidePanel>

      <CustomerHistoryDrawer
        lead={historyLead}
        open={Boolean(historyLeadId)}
        onClose={() => setHistoryLeadId(null)}
        payments={payments.filter((p) => p.leadId === historyLeadId)}
        onShareDocument={(type) => {
          setHistoryLeadId(null)
          navigate(`/documents?${new URLSearchParams({ share: type, leadId: historyLeadId }).toString()}`)
        }}
      />
    </div>
  )
}
