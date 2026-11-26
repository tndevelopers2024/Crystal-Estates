import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  Handshake,
  Search,
  FileSpreadsheet,
  IndianRupee,
  Loader2,
  ExternalLink,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Card, StatCard, EmptyState, ErrorBlock, LoadingBlock, Badge, btnGhost, btnPrimary, inputCls } from '../common/PageKit'
import SidePanel from '../common/SidePanel'
import { fetchPaymentReportsOverview, exportPaymentReportExcel } from '../../lib/reportsApi'
import { formatRupees } from '../../lib/plotUtils'
import { fmtDate } from '../customers/activityTypes'

const TABS = [
  { id: 'plots', label: 'Plot Payments', exportType: 'plot-payments', icon: Building2 },
  { id: 'customers', label: 'Customer Payments', exportType: 'customer-payments', icon: Users },
  { id: 'brokers', label: 'Broker Payments & Commission', exportType: 'broker-payments', icon: Handshake },
]

function statusTone(st) {
  const s = String(st || '').toLowerCase()
  if (s === 'paid in full' || s === 'paid') return 'green'
  if (s === 'partial' || s === 'part paid') return 'amber'
  if (s === 'pending') return 'rose'
  return 'slate'
}

function money(v) {
  return v == null ? '—' : formatRupees(v)
}

export default function PaymentTrackingPanel({ title = 'Payment Tracking & Reports', subtitle, defaultTab = 'plots' }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState(defaultTab)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [exporting, setExporting] = useState('')
  const [exportNotice, setExportNotice] = useState('')
  const [detail, setDetail] = useState(null) // { type, row }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchPaymentReportsOverview()
      setData(res)
    } catch (err) {
      setError(err.message || 'Could not load payment tracking data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const switchTab = (next) => {
    setTab(next)
    setQ('')
    setPropertyId('')
    setStatusFilter('')
    setDetail(null)
  }

  const plotProperties = useMemo(() => {
    const map = new Map()
    for (const r of data?.plots || []) {
      if (r.propertyId && !map.has(r.propertyId)) map.set(r.propertyId, r.propertyName)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const filteredPlots = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (data?.plots || []).filter((r) => {
      if (propertyId && r.propertyId !== propertyId) return false
      if (statusFilter && r.paymentStatus !== statusFilter) return false
      if (ql && !`${r.propertyName} ${r.plotNo} ${r.buyerName} ${r.buyerPhone}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [data, q, propertyId, statusFilter])

  const filteredCustomers = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (data?.customers || []).filter((r) => {
      if (statusFilter && r.paymentStatus !== statusFilter) return false
      if (ql && !`${r.name} ${r.phone} ${r.email} ${r.city} ${r.brokerName}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [data, q, statusFilter])

  const filteredBrokers = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (data?.brokers || []).filter((r) => {
      if (statusFilter && r.commissionStatus !== statusFilter) return false
      if (ql && !`${r.name} ${r.phone} ${r.email}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [data, q, statusFilter])

  const hasActiveFilter = Boolean(q.trim() || statusFilter || (tab === 'plots' && propertyId))
  const activeTabDef = TABS.find((t) => t.id === tab) || TABS[0]

  const runExport = async (scope) => {
    setExporting(scope)
    setExportNotice('')
    try {
      const filename = await exportPaymentReportExcel(activeTabDef.exportType, {
        scope,
        filters: { q, status: statusFilter, ...(tab === 'plots' ? { propertyId } : {}) },
      })
      setExportNotice(`Downloaded ${filename}`)
      setTimeout(() => setExportNotice(''), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting('')
    }
  }

  const summaries = data?.summaries || {}
  const activeSummary = summaries[tab] || {}

  const statusOptions =
    tab === 'brokers'
      ? ['Paid', 'Part paid', 'Pending', 'Not set']
      : ['Paid in full', 'Partial', 'Pending', 'No total set', 'Paid (No total set)']

  return (
    <div className="space-y-4">
      <Card
        title={title}
        subtitle={subtitle || 'Complete payment summaries, pending balances, and transaction history across plots, customers, and brokers'}
        bodyClassName="p-0"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {exportNotice && <span className="text-xs font-semibold text-emerald-700">{exportNotice}</span>}
            {hasActiveFilter && (
              <button
                type="button"
                className={btnGhost}
                disabled={Boolean(exporting) || loading}
                onClick={() => runExport('filtered')}
              >
                {exporting === 'filtered' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                Export Filtered (.xlsx)
              </button>
            )}
            <button
              type="button"
              className={btnPrimary}
              disabled={Boolean(exporting) || loading}
              onClick={() => runExport('all')}
            >
              {exporting === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Export {activeTabDef.label} (.xlsx)
            </button>
          </div>
        }
      >
        {/* Tab bar */}
        <div className="px-4 pt-3 border-b border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon
            const on = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => switchTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                  on ? 'border-[#0F3D2E] text-[#0F3D2E]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Summary strip */}
        {data && (
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/50 border-b border-slate-100">
            <StatCard
              label={tab === 'brokers' ? 'Total Commission' : 'Total Amount'}
              value={money(tab === 'brokers' ? activeSummary.totalCommission : activeSummary.totalAmount)}
              hint={
                tab === 'plots'
                  ? `${activeSummary.totalPlots || 0} plots tracked`
                  : tab === 'customers'
                    ? `${activeSummary.totalCustomers || 0} customers`
                    : `${activeSummary.totalBrokers || 0} brokers · ${activeSummary.totalReferrals || 0} referrals`
              }
              icon={IndianRupee}
            />
            <StatCard
              label={tab === 'brokers' ? 'Commission Paid' : 'Total Paid'}
              value={money(tab === 'brokers' ? activeSummary.commissionPaid : activeSummary.totalPaid)}
              hint={`${activeSummary.transactionCount || 0} transactions`}
              icon={CheckCircle2}
              tone="green"
            />
            <StatCard
              label={tab === 'brokers' ? 'Pending Commission' : 'Pending Balance'}
              value={money(tab === 'brokers' ? activeSummary.pendingCommission : activeSummary.pendingBalance)}
              hint="Outstanding balance"
              icon={Clock}
              tone="gold"
            />
            <StatCard
              label="Showing"
              value={
                tab === 'plots'
                  ? filteredPlots.length
                  : tab === 'customers'
                    ? filteredCustomers.length
                    : filteredBrokers.length
              }
              hint={hasActiveFilter ? 'Filtered records' : 'All database records'}
              icon={activeTabDef.icon}
              tone="blue"
            />
          </div>
        )}

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === 'plots'
                  ? 'Search project, plot no., buyer…'
                  : tab === 'customers'
                    ? 'Search customer, phone, broker…'
                    : 'Search broker name, phone, email…'
              }
              className={`${inputCls} !py-2 !text-xs pl-8`}
            />
          </div>

          {tab === 'plots' && (
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className={`${inputCls} !py-2 !text-xs !w-auto min-w-[170px]`}
              aria-label="Filter by property"
            >
              <option value="">All properties</option>
              {plotProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${inputCls} !py-2 !text-xs !w-auto min-w-[150px]`}
            aria-label="Filter by payment status"
          >
            <option value="">All statuses</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading && !data ? (
          <div className="p-5">
            <LoadingBlock rows={5} />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={load} />
          </div>
        ) : tab === 'plots' ? (
          filteredPlots.length === 0 ? (
            <EmptyState icon={Building2} title="No plot payment records found" text="Booked/sold plots or plots with recorded payments appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left font-bold px-5 py-2.5">Property / Plot</th>
                    <th className="text-left font-bold px-3 py-2.5">Buyer</th>
                    <th className="text-right font-bold px-3 py-2.5">Total Amount</th>
                    <th className="text-right font-bold px-3 py-2.5">Paid</th>
                    <th className="text-right font-bold px-3 py-2.5">Pending</th>
                    <th className="text-left font-bold px-3 py-2.5">Status</th>
                    <th className="text-right font-bold px-5 py-2.5">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPlots.map((r) => (
                    <tr key={r.id} onClick={() => setDetail({ type: 'plot', row: r })} className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-800">
                          {r.propertyName} · Plot {r.plotNo}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {[r.phase, r.plotStatus].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-800">{r.buyerName || '—'}</p>
                        {r.buyerPhone && <p className="text-[11px] text-slate-500">{r.buyerPhone}</p>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold">{money(r.totalAmount)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-700">{money(r.amountPaid)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-rose-700">{money(r.pendingBalance)}</td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTone(r.paymentStatus)}>{r.paymentStatus}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-[11px] font-bold text-[#0F3D2E] hover:underline">
                          {r.paymentCount} {r.paymentCount === 1 ? 'txn' : 'txns'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'customers' ? (
          filteredCustomers.length === 0 ? (
            <EmptyState icon={Users} title="No customer payment records found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left font-bold px-5 py-2.5">Customer</th>
                    <th className="text-left font-bold px-3 py-2.5">Broker / Direct</th>
                    <th className="text-right font-bold px-3 py-2.5">Total Amount</th>
                    <th className="text-right font-bold px-3 py-2.5">Total Paid</th>
                    <th className="text-right font-bold px-3 py-2.5">Pending</th>
                    <th className="text-left font-bold px-3 py-2.5">Status</th>
                    <th className="text-right font-bold px-5 py-2.5">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((r) => (
                    <tr key={r.id} onClick={() => setDetail({ type: 'customer', row: r })} className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-800">{r.name}</p>
                        <p className="text-[11px] text-slate-500">{[r.phone, r.city].filter(Boolean).join(' · ') || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium text-slate-700">{r.brokerName}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold">{money(r.totalAmount)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-700">{money(r.amountPaid)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-rose-700">{money(r.pendingBalance)}</td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTone(r.paymentStatus)}>{r.paymentStatus}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-[11px] font-bold text-[#0F3D2E] hover:underline">
                          {r.paymentCount} {r.paymentCount === 1 ? 'txn' : 'txns'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredBrokers.length === 0 ? (
          <EmptyState icon={Handshake} title="No broker commission records found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left font-bold px-5 py-2.5">Broker</th>
                  <th className="text-right font-bold px-3 py-2.5">Referrals</th>
                  <th className="text-right font-bold px-3 py-2.5">Total Commission</th>
                  <th className="text-right font-bold px-3 py-2.5">Paid</th>
                  <th className="text-right font-bold px-3 py-2.5">Pending</th>
                  <th className="text-left font-bold px-3 py-2.5">Status</th>
                  <th className="text-right font-bold px-5 py-2.5">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBrokers.map((r) => (
                  <tr key={r.id} onClick={() => setDetail({ type: 'broker', row: r })} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-800">{r.name}</p>
                      <p className="text-[11px] text-slate-500">{[r.phone, r.usualCommission !== '—' && `Usual: ${r.usualCommission}`].filter(Boolean).join(' · ') || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">{r.referralCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">{money(r.totalCommission)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-700">{money(r.commissionPaid)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-rose-700">{money(r.pendingCommission)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone(r.commissionStatus)}>{r.commissionStatus}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[11px] font-bold text-[#0F3D2E] hover:underline">
                        {r.transactions.length} {r.transactions.length === 1 ? 'txn' : 'txns'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Drill-down Transaction History Drawer */}
      <SidePanel
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={
          detail?.type === 'plot'
            ? `${detail.row.propertyName} · Plot ${detail.row.plotNo}`
            : detail?.row?.name || 'Payment History'
        }
        subtitle={
          detail?.type === 'plot'
            ? detail.row.buyerName || 'Plot payment ledger'
            : detail?.type === 'customer'
              ? [detail.row.phone, detail.row.brokerName].filter(Boolean).join(' · ')
              : detail?.row?.phone || 'Broker commission ledger'
        }
        icon={History}
        width="max-w-2xl"
      >
        {detail && (
          <div className="p-5 space-y-5 overflow-y-auto h-full">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  {detail.type === 'broker' ? 'Total Commission' : 'Total Amount'}
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-900 tabular-nums">
                  {money(detail.type === 'broker' ? detail.row.totalCommission : detail.row.totalAmount)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-emerald-50/40">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700/70">Total Paid</p>
                <p className="mt-0.5 text-sm font-extrabold text-emerald-700 tabular-nums">
                  {money(detail.type === 'broker' ? detail.row.commissionPaid : detail.row.amountPaid)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-rose-50/30">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Pending</p>
                <p className="mt-0.5 text-sm font-extrabold text-rose-700 tabular-nums">
                  {money(detail.type === 'broker' ? detail.row.pendingCommission : detail.row.pendingBalance)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Badge tone={statusTone(detail.type === 'broker' ? detail.row.commissionStatus : detail.row.paymentStatus)}>
                {detail.type === 'broker' ? detail.row.commissionStatus : detail.row.paymentStatus}
              </Badge>
              {detail.type === 'plot' && detail.row.propertyId && (
                <button
                  type="button"
                  onClick={() => navigate(`/properties/${encodeURIComponent(detail.row.propertyId)}/plots`)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0F3D2E] hover:underline"
                >
                  Open plot <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              {detail.type === 'customer' && (
                <button
                  type="button"
                  onClick={() => navigate(`/customers/${encodeURIComponent(detail.row.id)}`)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0F3D2E] hover:underline"
                >
                  Open customer profile <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              {detail.type === 'broker' && (
                <button
                  type="button"
                  onClick={() => navigate('/brokers')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0F3D2E] hover:underline"
                >
                  Open Brokers <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {detail.type === 'broker' && detail.row.referrals?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Referrals ({detail.row.referrals.length})
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2">Customer / Detail</th>
                        <th className="text-right px-3 py-2">Payable</th>
                        <th className="text-right px-3 py-2">Paid</th>
                        <th className="text-right px-3 py-2">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.row.referrals.map((ref) => (
                        <tr key={ref.key}>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-800">{ref.name}</p>
                            <p className="text-[11px] text-slate-500">{[ref.module, ref.detail].filter(Boolean).join(' · ')}</p>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(ref.payable)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-semibold">{money(ref.paid)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-rose-700 font-semibold">{money(ref.pending)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Transaction History ({detail.row.transactions?.length || 0})
              </h4>
              {!detail.row.transactions?.length ? (
                <div className="p-6 text-center rounded-2xl border border-slate-200 text-xs text-slate-400">
                  <AlertCircle className="w-5 h-5 mx-auto mb-1.5 text-slate-300" />
                  No transactions recorded yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {detail.row.transactions.map((t) => (
                    <li key={t.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">
                          {t.paymentFor || t.ref || 'Payment'}{' '}
                          {t.status && <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{t.status}</span>}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {[fmtDate(t.date), t.mode, t.referenceNo && `Ref: ${t.referenceNo}`, t.property && `${t.property}${t.plotNo ? ` · ${t.plotNo}` : ''}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {t.note && <p className="text-xs text-slate-600 mt-1">{t.note}</p>}
                      </div>
                      <span className="text-sm font-extrabold text-emerald-700 tabular-nums shrink-0">{money(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}
