import React, { useMemo, useState } from 'react'
import { Download, IndianRupee, Users, Compass, Trophy, BarChart2, CalendarRange } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePayments } from '../../hooks/usePayments'
import { Card, StatCard, EmptyState, LoadingBlock, ErrorBlock, BarList, ColumnChart, btnGhost } from '../common/PageKit'
import {
  STAGES,
  stageCounts,
  countBy,
  inRange,
  paymentsByMonth,
  paymentDate,
  sumPayments,
  visitOutcomes,
  shortRupees,
  rupees,
  fmtDate,
  downloadCsv,
  toDate,
} from '../../lib/analytics'

const RANGES = [
  { id: 30, label: 'Last 30 days', months: 3 },
  { id: 90, label: 'Last 90 days', months: 4 },
  { id: 180, label: 'Last 6 months', months: 6 },
  { id: 365, label: 'Last 12 months', months: 12 },
  { id: 0, label: 'All time', months: 12 },
]

/** Reports built from leads, visits and payments, filtered by date range. */
export default function ReportsView({ leads = [], visits = [], loading = false }) {
  const { can } = useAuth()
  const showMoney = can('payments', 'view')
  const pay = usePayments()
  const [rangeId, setRangeId] = useState(90)
  const range = RANGES.find((r) => r.id === rangeId) || RANGES[1]

  const data = useMemo(() => {
    const L = leads.filter((l) => inRange(l.createdAt, range.id))
    const V = visits.filter((v) => inRange(v.visitDate || v.createdAt, range.id))
    const P = (showMoney ? pay.payments : []).filter((p) => inRange(paymentDate(p), range.id))
    const won = L.filter((l) => l.stage === 'won').length
    // Funnel: how many leads reached at least each stage
    const order = STAGES.filter((s) => s.id !== 'lost').map((s) => s.id)
    const reached = order.map((id, i) => ({
      id,
      label: STAGES.find((s) => s.id === id).label,
      color: STAGES.find((s) => s.id === id).color,
      count: L.filter((l) => l.stage !== 'lost' && order.indexOf(l.stage || 'new') >= i).length,
    }))
    return {
      L,
      V,
      P,
      won,
      conversion: L.length ? Math.round((won / L.length) * 100) : 0,
      funnel: reached,
      stages: stageCounts(L),
      sources: countBy(L, (l) => l.source, { top: 8 }),
      outcomes: visitOutcomes(V),
      byMonth: paymentsByMonth(P, range.months),
      collected: sumPayments(P),
      byMode: countBy(P, (p) => p.mode, { top: 6 }),
    }
  }, [leads, visits, pay.payments, range, showMoney])

  const exportLeads = () =>
    downloadCsv(`leads-${range.id || 'all'}d.csv`, [
      { label: 'Name', value: 'name' },
      { label: 'Phone', value: 'phone' },
      { label: 'Email', value: 'email' },
      { label: 'Project', value: 'property' },
      { label: 'Source', value: 'source' },
      { label: 'Stage', value: (l) => STAGES.find((s) => s.id === l.stage)?.label || l.stage },
      { label: 'Agent', value: (l) => l.assignedAgent?.name || '' },
      { label: 'Created', value: (l) => fmtDate(l.createdAt) },
    ], data.L)

  const exportPayments = () =>
    downloadCsv(`payments-${range.id || 'all'}d.csv`, [
      { label: 'Date', value: (p) => fmtDate(paymentDate(p)) },
      { label: 'Customer', value: 'leadName' },
      { label: 'Project', value: 'property' },
      { label: 'Plot', value: 'plotNo' },
      { label: 'For', value: 'paymentFor' },
      { label: 'Mode', value: 'mode' },
      { label: 'Reference', value: 'referenceNo' },
      { label: 'Amount (INR)', value: 'amount' },
    ], [...data.P].sort((a, b) => (paymentDate(b) || 0) - (paymentDate(a) || 0)))

  const exportVisits = () =>
    downloadCsv(`site-visits-${range.id || 'all'}d.csv`, [
      { label: 'Date', value: (v) => fmtDate(v.visitDate) },
      { label: 'Time', value: 'visitTime' },
      { label: 'Customer', value: 'leadName' },
      { label: 'Phone', value: 'leadPhone' },
      { label: 'Project', value: 'property' },
      { label: 'Status', value: 'status' },
      { label: 'Agent', value: (v) => v.assignedAgent?.name || '' },
    ], [...data.V].sort((a, b) => (toDate(b.visitDate) || 0) - (toDate(a.visitDate) || 0)))

  return (
    <div className="space-y-5 pb-10">
      {/* Range + exports */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Report period">
          <CalendarRange className="w-4 h-4 text-slate-400 shrink-0" />
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={r.id === rangeId}
              onClick={() => setRangeId(r.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                r.id === rangeId ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0F3D2E]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={exportLeads} disabled={!data.L.length}>
            <Download className="w-3.5 h-3.5" /> Leads CSV
          </button>
          <button type="button" className={btnGhost} onClick={exportVisits} disabled={!data.V.length}>
            <Download className="w-3.5 h-3.5" /> Visits CSV
          </button>
          {showMoney && (
            <button type="button" className={btnGhost} onClick={exportPayments} disabled={!data.P.length}>
              <Download className="w-3.5 h-3.5" /> Payments CSV
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="New leads" value={loading ? '…' : data.L.length} hint={range.label} icon={Users} />
        <StatCard label="Bookings won" value={loading ? '…' : data.won} hint={`${data.conversion}% conversion`} icon={Trophy} tone="purple" />
        <StatCard label="Site visits" value={loading ? '…' : data.V.length} hint={`${data.outcomes.find((o) => o.label === 'Completed')?.count || 0} completed`} icon={Compass} tone="blue" />
        <StatCard
          label="Collected"
          value={showMoney ? (pay.loading ? '…' : shortRupees(data.collected)) : '—'}
          hint={showMoney ? `${data.P.length} payments` : 'Payments access needed'}
          icon={IndianRupee}
          tone="gold"
        />
      </div>

      {showMoney && (
        <Card title="Collections by month" subtitle="Payments recorded against customers and plots">
          {pay.loading ? (
            <LoadingBlock rows={2} />
          ) : pay.error ? (
            <ErrorBlock message={pay.error} onRetry={pay.reload} />
          ) : data.collected === 0 ? (
            <EmptyState icon={BarChart2} title="No payments in this period" />
          ) : (
            <ColumnChart data={data.byMonth.map((m) => ({ label: m.label, value: m.total }))} format={shortRupees} />
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Conversion funnel" subtitle="Leads that reached each stage (lost leads excluded)">
          {loading ? <LoadingBlock rows={4} /> : <BarList rows={data.funnel} emptyText="No leads in this period" />}
        </Card>
        <Card title="Lead sources" subtitle={range.label}>
          {loading ? <LoadingBlock rows={4} /> : <BarList rows={data.sources} emptyText="No leads in this period" />}
        </Card>
        <Card title="Site-visit outcomes" subtitle={range.label}>
          {loading ? <LoadingBlock rows={3} /> : <BarList rows={data.outcomes} emptyText="No site visits in this period" />}
        </Card>
        <Card title="Current stage mix" subtitle="Where this period's leads are now">
          {loading ? <LoadingBlock rows={4} /> : <BarList rows={data.stages} emptyText="No leads in this period" />}
        </Card>
      </div>

      {showMoney && (
        <Card title="Payment register" subtitle={`${range.label} · newest first`} bodyClassName="p-0">
          {pay.loading ? (
            <LoadingBlock rows={4} />
          ) : data.P.length === 0 ? (
            <EmptyState icon={IndianRupee} title="No payments in this period" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left font-bold px-5 py-2.5">Date</th>
                    <th className="text-left font-bold px-3 py-2.5">Customer</th>
                    <th className="text-left font-bold px-3 py-2.5">Project / plot</th>
                    <th className="text-left font-bold px-3 py-2.5">For</th>
                    <th className="text-left font-bold px-3 py-2.5">Mode</th>
                    <th className="text-right font-bold px-5 py-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...data.P]
                    .sort((a, b) => (paymentDate(b) || 0) - (paymentDate(a) || 0))
                    .slice(0, 50)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-2.5 whitespace-nowrap">{fmtDate(paymentDate(p))}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{p.leadName}</td>
                        <td className="px-3 py-2.5 text-slate-600">{[p.property, p.plotNo && `Plot ${p.plotNo}`].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600">{p.paymentFor}</td>
                        <td className="px-3 py-2.5 text-slate-600">{p.mode}</td>
                        <td className="px-5 py-2.5 text-right font-bold tabular-nums">{rupees(p.amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {data.P.length > 50 && <p className="px-5 py-3 text-[11px] text-slate-500">Showing the latest 50 — download the CSV for all {data.P.length}.</p>}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
