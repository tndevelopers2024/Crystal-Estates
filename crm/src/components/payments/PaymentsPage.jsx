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
  Pencil,
  Download,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { fetchAllPayments, recordLeadPayment, deletePayment } from '../../lib/api'
import { exportPaymentReportExcel } from '../../lib/reportsApi'
import { useOptions } from '../../hooks/useOptions'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../context/DialogContext'
import EditableSelect from '../common/EditableSelect'
import SearchSelect from '../common/SearchSelect'
import CustomerPlotPicker from '../common/CustomerPlotPicker'
import CustomerHistoryDrawer from '../common/CustomerHistoryDrawer'
import SidePanel from '../common/SidePanel'
import { formatRupees, parseRupees } from '../../lib/plotUtils'
import { PaymentDocumentSection, ShareResults, useDocumentSender } from '../documents/PlotDocumentSharing'
import { EditPaymentModal, PaymentStatusBadge, PAYMENT_STATUSES } from '../leads/LeadMoney'
import { downloadCsv } from '../../lib/analytics'
import { newRequestKey } from '../../lib/plotDocumentsApi'

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
  const [target, setTargetRaw] = useState({ leadId: '', propertyId: '', plotUid: '', plotNo: '', phase: '' })
  // Plot documents to send with the confirmation (only when the user ticks a channel)
  const [docIds, setDocIds] = useState([])
  const [shareChannels, setShareChannels] = useState([])
  const [requestId] = useState(() => newRequestKey('pay'))
  const sender = useDocumentSender()
  const setTarget = (next) => {
    // A different plot has different documents: clear what was picked
    if (next.plotUid !== target.plotUid || next.plotNo !== target.plotNo || next.propertyId !== target.propertyId) {
      setDocIds([])
      setShareChannels([])
    }
    setTargetRaw(next)
  }
  const lead = leads.find((l) => l.id === target.leadId)
  const sharing = Boolean(target.leadId && target.plotNo && docIds.length && shareChannels.length)
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
        // Same id on a repeated submit: the server returns the first payment instead of a second one
        clientRequestId: requestId,
        documentIds: target.plotNo ? docIds : [],
      })
      // Only after the payment is saved, and only through the channels the user ticked
      let shareResults = null
      let shareError = null
      if (sharing && res.payment?.id) {
        shareResults = await sender.send({
          documentIds: docIds,
          channels: shareChannels,
          recipient: { type: 'lead', leadId: target.leadId },
          propertyId: target.propertyId,
          plotUid: target.plotUid,
          plotNo: target.plotNo,
          phase: target.phase,
          paymentId: res.payment.id,
          idempotencyKey: `payment:${res.payment.id}`,
        })
        if (!shareResults) shareError = 'The payment is saved, but the documents could not be sent. Try again from Send Document.'
      }
      onSaved(res.payment, { ...target, propertyName: property?.name }, { shareResults, shareError, request: sender.request })
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

        {target.propertyId && (
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Plot documents{target.plotNo ? ` · Plot ${target.plotNo}` : ''}</h3>
            <PaymentDocumentSection
              plotRef={{ propertyId: target.propertyId, plotUid: target.plotUid, plotNo: target.plotNo, phase: target.phase }}
              recipient={lead ? { name: lead.name, phone: lead.phone, email: lead.email } : null}
              docIds={docIds}
              onDocIds={setDocIds}
              channels={shareChannels}
              onChannels={setShareChannels}
            />
            {docIds.length > 0 && !target.leadId && <p className="text-[11px] text-amber-700">Select the customer to send documents.</p>}
          </section>
        )}

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
          {saving && sender.sending ? 'Sending documents…' : sharing ? 'Save & send' : 'Save payment'}
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [plotFilter, setPlotFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [brokerFilter, setBrokerFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [exporting, setExporting] = useState('')
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [editing, setEditing] = useState(null)
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
    const pl = plotFilter.trim().toLowerCase()
    const project = properties.find((p) => p.id === projectFilter)
    return payments.filter((p) => {
      const iso = p.paidOn || (p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '')
      if (dateFrom && (!iso || iso < dateFrom)) return false
      if (dateTo && (!iso || iso > dateTo)) return false
      if (customerFilter && (p.customerId || p.leadId || p.leadName) !== customerFilter) return false
      if (project && p.propertyId !== project.id && String(p.property || '').toLowerCase() !== project.name.toLowerCase()) return false
      if (!project && projectFilter && String(p.property || '') !== projectFilter) return false
      if (pl && !String(p.plotNo || p.unitAllotted || '').toLowerCase().includes(pl)) return false
      if (modeFilter && p.mode !== modeFilter) return false
      if (statusFilter && (p.status || 'Received') !== statusFilter) return false
      if (brokerFilter === '__none' ? p.brokerId : brokerFilter && p.brokerName !== brokerFilter) return false
      if (typeFilter && p.paymentFor !== typeFilter && p.sourceModule !== typeFilter) return false
      if (!q) return true
      return [p.id, p.leadName, p.referenceNo, p.paymentFor, p.property, p.unitAllotted, p.plotNo, p.brokerName, p.note, p.sourceModule].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [payments, search, dateFrom, dateTo, customerFilter, projectFilter, plotFilter, modeFilter, statusFilter, brokerFilter, typeFilter, properties])

  const brokerOptions = useMemo(() => [...new Set(payments.map((p) => p.brokerName).filter(Boolean))].sort(), [payments])
  const customerOptions = useMemo(() => {
    const map = new Map()
    for (const p of payments) {
      const key = p.customerId || p.leadId || p.leadName
      if (key && p.leadName && !map.has(key)) map.set(key, p.leadName)
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [payments])
  const projectOptions = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p.name]))
    for (const p of payments) {
      if (p.property && !Array.from(map.values()).some((n) => n.toLowerCase() === String(p.property).toLowerCase())) {
        map.set(p.propertyId || p.property, p.property)
      }
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [properties, payments])
  const typeOptions = useMemo(() => {
    const set = new Set()
    for (const p of payments) {
      if (p.paymentFor) set.add(p.paymentFor)
      if (p.sourceModule) set.add(p.sourceModule)
    }
    return [...set].sort()
  }, [payments])

  const hasActiveFilter = Boolean(search.trim() || dateFrom || dateTo || customerFilter || projectFilter || plotFilter.trim() || modeFilter || statusFilter || brokerFilter || typeFilter)

  const clearFilters = () => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setCustomerFilter('')
    setProjectFilter('')
    setPlotFilter('')
    setModeFilter('')
    setStatusFilter('')
    setBrokerFilter('')
    setTypeFilter('')
  }

  const stats = useMemo(() => {
    const isReceived = (p) => !['Pending', 'Pending clearance', 'Failed', 'Bounced', 'Refunded', 'Cancelled'].includes(p.status || 'Received')
    const totalPayments = filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const totalReceived = filtered.filter(isReceived).reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const pendingByLead = new Map()
    let pendingTxnSum = 0
    for (const p of filtered) {
      if (['Pending', 'Pending clearance'].includes(p.status)) pendingTxnSum += Number(p.amount) || 0
      if (p.balance != null && (p.leadId || p.customerId)) {
        const k = p.leadId || p.customerId
        if (!pendingByLead.has(k)) pendingByLead.set(k, Number(p.balance) || 0)
      }
    }
    const pendingAmount = pendingTxnSum + [...pendingByLead.values()].reduce((s, v) => s + v, 0)
    return {
      totalPayments,
      totalReceived,
      pendingAmount,
      count: filtered.length,
      customers: new Set(filtered.map((p) => p.customerId || p.leadId || p.leadName).filter(Boolean)).size,
    }
  }, [filtered])

  const runExcelExport = async (scope) => {
    setExporting(scope)
    try {
      const filename = await exportPaymentReportExcel('all-payments', {
        scope,
        filters: {
          q: search,
          dateFrom,
          dateTo,
          customerId: customerFilter,
          broker: brokerFilter,
          propertyId: projectFilter,
          plotNo: plotFilter,
          mode: modeFilter,
          status: statusFilter,
          paymentFor: typeFilter,
        },
      })
      onShowToast?.(`Downloaded ${filename}`, 'success')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setExporting('')
    }
  }

  const handleSaved = async (payment, target, share = {}) => {
    setFormOpen(false)
    setJustSaved({ payment, target, ...share })
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
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
        {justSaved.shareResults && <ShareResults results={justSaved.shareResults} />}
        {justSaved.shareError && <p className="text-xs text-rose-700">{justSaved.shareError}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total payments', value: formatRupees(stats.totalPayments), hint: hasActiveFilter ? 'Matching filters' : 'All modules', icon: Wallet },
          { label: 'Total received', value: formatRupees(stats.totalReceived), hint: 'Cleared / received', icon: CheckCircle2 },
          { label: 'Pending amount', value: formatRupees(stats.pendingAmount), hint: 'Pending clearance & balances', icon: Clock },
          { label: 'Payment count', value: stats.count, hint: `${stats.customers} customers / parties`, icon: Receipt },
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
              <p className="text-[11px] text-slate-400 mt-0.5">{s.hint}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, broker, plot, txn ID, reference…"
                className={`${inputCls} pl-9`}
                aria-label="Search payments"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`${inputCls} !w-auto text-xs`}
                aria-label="From date"
                title="From date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`${inputCls} !w-auto text-xs`}
                aria-label="To date"
                title="To date"
              />
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => runExcelExport('filtered')}
                disabled={Boolean(exporting) || !filtered.length}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-slate-200 text-slate-700 hover:border-[#0F3D2E] hover:text-[#0F3D2E] text-xs font-bold rounded-xl disabled:opacity-40"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {exporting === 'filtered' ? 'Exporting…' : 'Export Filtered (.xlsx)'}
              </button>
            )}
            <button
              type="button"
              onClick={() => runExcelExport('all')}
              disabled={Boolean(exporting) || !payments.length}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl disabled:opacity-40"
              title="Download all centralized payments as Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {exporting === 'all' ? 'Exporting…' : 'Export Excel (.xlsx)'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <SearchSelect value={customerFilter} onChange={setCustomerFilter} options={customerOptions} placeholder="All customers" clearable />
            <SearchSelect value={brokerFilter} onChange={setBrokerFilter} options={[{ value: '__none', label: 'Direct (No broker)' }, ...brokerOptions.map((b) => ({ value: b, label: b }))]} placeholder="All brokers" clearable />
            <SearchSelect value={projectFilter} onChange={setProjectFilter} options={projectOptions} placeholder="All projects" clearable />
            <input
              value={plotFilter}
              onChange={(e) => setPlotFilter(e.target.value)}
              placeholder="Plot no…"
              className={`${inputCls} !py-2 text-xs`}
              aria-label="Filter by plot number"
            />
            <SearchSelect value={modeFilter} onChange={setModeFilter} options={modeList.options.map((m) => ({ value: m, label: m }))} placeholder="All methods" clearable />
            <SearchSelect value={statusFilter} onChange={setStatusFilter} options={[...new Set([...PAYMENT_STATUSES, 'Pending clearance', 'Failed', 'Pending'])].map((st) => ({ value: st, label: st }))} placeholder="All statuses" clearable />
            <SearchSelect value={typeFilter} onChange={setTypeFilter} options={typeOptions.map((t) => ({ value: t, label: t }))} placeholder="All types" clearable />
          </div>

          {hasActiveFilter && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>Showing {filtered.length} of {payments.length} centralized payments</span>
              <button type="button" onClick={clearFilters} className="font-bold text-[#0F3D2E] hover:underline">
                Clear all filters
              </button>
            </div>
          )}
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
                    <th className="text-left font-semibold px-4 py-3">Status</th>
                    <th className="text-right font-semibold px-4 py-3">Amount</th>
                    <th className="text-right font-semibold px-4 py-3">Pending</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => (
                    <tr key={p.id} onClick={() => setSelectedPayment(p)} className="hover:bg-slate-50/70 cursor-pointer">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {fmtDate(paymentDate(p))}
                        {p.sourceModule && (
                          <span className="block text-[10px] font-semibold text-slate-400">{p.sourceModule}</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {p.leadId ? (
                          <button type="button" onClick={() => setHistoryLeadId(p.leadId)} className="font-semibold text-slate-900 hover:text-[#0F3D2E] hover:underline text-left">
                            {p.leadName}
                          </button>
                        ) : p.customerId ? (
                          <button type="button" onClick={() => navigate(`/customers/${encodeURIComponent(p.customerId)}`)} className="font-semibold text-slate-900 hover:text-[#0F3D2E] hover:underline text-left">
                            {p.leadName}
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-900">{p.leadName}</span>
                        )}
                        {p.brokerName && <span className="block text-[11px] text-violet-700">Broker: {p.brokerName}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.property}
                        {p.plotNo ? <span className="text-slate-400"> · Plot {p.plotNo}</span> : p.unitAllotted && p.unitAllotted !== 'Not allotted' ? <span className="text-slate-400"> · {p.unitAllotted}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.paymentFor}
                        {p.note && <span className="block text-[11px] text-slate-400 max-w-[200px] truncate" title={p.note}>{p.note}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.mode}
                        {p.referenceNo && <span className="block text-[11px] text-slate-400">{p.referenceNo}</span>}
                      </td>
                      <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatRupees(p.amount)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-xs">{p.balance == null ? <span className="text-slate-300">—</span> : p.balance > 0 ? <span className="font-semibold text-rose-700">{formatRupees(p.balance)}</span> : <span className="font-semibold text-emerald-700">Paid</span>}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {p.editKind === 'core' && (
                            <button type="button" onClick={() => setEditing(p)} className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Edit payment from ${p.leadName}`} title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {p.leadId && (
                            <button type="button" onClick={() => shareReceipt(p)} className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Share receipt for ${p.leadName}`} title="Share receipt">
                              <Receipt className="w-4 h-4" />
                            </button>
                          )}
                          {p.editKind === 'core' && (
                            <button type="button" onClick={() => handleDelete(p)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete payment from ${p.leadName}`} title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
                      {p.brokerName && <p className="text-[11px] text-violet-700">Broker: {p.brokerName}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900">{formatRupees(p.amount)}</p>
                      <PaymentStatusBadge status={p.status} />
                      {p.balance > 0 && <p className="text-[11px] text-rose-700 mt-0.5">{formatRupees(p.balance)} pending</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setEditing(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
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

      {editing && <EditPaymentModal payment={editing} onClose={() => setEditing(null)} onSaved={() => { onShowToast?.('Payment updated', 'success'); load() }} />}

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

      {/* Payment Details SidePanel */}
      <SidePanel
        open={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        title={selectedPayment ? `${selectedPayment.paymentFor || 'Payment'} · ${formatRupees(selectedPayment.amount)}` : 'Payment Details'}
        subtitle={selectedPayment ? `${selectedPayment.sourceModule || 'Payment'} · ${fmtDate(paymentDate(selectedPayment))}` : ''}
        icon={Receipt}
      >
        {selectedPayment && (
          <div className="p-5 space-y-5 overflow-y-auto h-full">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{formatRupees(selectedPayment.amount)}</p>
              </div>
              <PaymentStatusBadge status={selectedPayment.status} />
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Customer / Party</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{selectedPayment.leadName || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Payment Date</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{fmtDate(paymentDate(selectedPayment))}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Project / Property</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{selectedPayment.property || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Plot / Unit</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">
                  {selectedPayment.plotNo ? `Plot ${selectedPayment.plotNo}` : selectedPayment.unitAllotted || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Payment Method</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{selectedPayment.mode || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Reference / Txn ID</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{selectedPayment.referenceNo || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Broker</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{selectedPayment.brokerName || 'Direct / No Broker'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Source Module</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{selectedPayment.sourceModule || 'CRM'}</dd>
              </div>
              {selectedPayment.balance != null && (
                <div>
                  <dt className="text-[11px] font-medium text-slate-400">Pending Balance</dt>
                  <dd className={`font-bold mt-0.5 ${selectedPayment.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {selectedPayment.balance > 0 ? formatRupees(selectedPayment.balance) : 'Paid in full'}
                  </dd>
                </div>
              )}
              {selectedPayment.note && (
                <div className="col-span-2">
                  <dt className="text-[11px] font-medium text-slate-400">Notes</dt>
                  <dd className="text-slate-700 mt-0.5 whitespace-pre-line">{selectedPayment.note}</dd>
                </div>
              )}
            </dl>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
              {selectedPayment.customerId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPayment(null)
                    navigate(`/customers/${encodeURIComponent(selectedPayment.customerId)}`)
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Customer
                </button>
              )}
              {selectedPayment.propertyId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPayment(null)
                    navigate(`/properties/${encodeURIComponent(selectedPayment.propertyId)}/plots`)
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Property
                </button>
              )}
              {selectedPayment.brokerId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPayment(null)
                    navigate('/brokers')
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Brokers
                </button>
              )}
              {selectedPayment.editKind === 'core' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedPayment
                    setSelectedPayment(null)
                    setEditing(target)
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F3D2E] text-white rounded-xl text-xs font-bold hover:bg-[#16533D] ml-auto"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Payment
                </button>
              )}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}
