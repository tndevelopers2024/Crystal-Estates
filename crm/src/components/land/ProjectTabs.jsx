import React, { useMemo, useState } from 'react'
import { Plus, Search, IndianRupee, Handshake, Phone, Mail } from 'lucide-react'
import { Card, EmptyState, LoadingBlock, ErrorBlock, StatCard, btnPrimary, inputCls } from '../common/PageKit'
import { listProjectPayments, listCommissions } from '../../lib/landApi'
import { useAsync, DataTable, ExportButton, DetailGrid, CommissionStatus, inr, inrShort, fmtDate } from './LandKit'
import { PlotBar } from './LandProjectsPage'
import { PaymentModal } from './PaymentForms'

/* ───────────── Overview ───────────── */

/** Name and contact details of a landowner, vendor or broker. */
function PersonCard({ person, empty }) {
  if (!person) return <p className="text-sm text-slate-500">{empty}</p>
  const dc = person.defaultCommission
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-slate-900">{person.name}</p>
      {dc && <p className="text-xs text-slate-500">Usual commission: {dc.type === 'percent' ? `${dc.value}%` : `${inr(dc.value)} fixed`}</p>}
      {person.phone && (
        <a href={`tel:${person.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-[#0F3D2E]">
          <Phone className="w-3.5 h-3.5 text-slate-400" /> {person.phone}
        </a>
      )}
      {person.email && (
        <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-[#0F3D2E] break-all">
          <Mail className="w-3.5 h-3.5 text-slate-400" /> {person.email}
        </a>
      )}
      {person.address && <p className="text-sm text-slate-600">{person.address}</p>}
    </div>
  )
}

export function OverviewTab({ project, landowner, vendor, brokers = [] }) {
  const pu = project.purchase || {}
  const location = [project.village, project.taluk, project.district, project.state].filter(Boolean).join(', ')
  const unit = project.areaUnit.toLowerCase().replace(/s$/, '')
  const costRows = [
    ['Land price', project.landPrice],
    ['Stamp duty', pu.stampDuty],
    ['Registration charges', pu.registrationCharges],
    ['Other costs', pu.otherCosts],
  ]
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 space-y-5">
        <Card title="Land details">
          <div className="space-y-5">
            <DetailGrid
              cols={3}
              items={[
                ['Location', location],
                ['Survey numbers', project.surveyNumbers],
                ['Total area', project.totalArea != null ? `${project.totalArea} ${project.areaUnit}` : null],
                ['Land price', project.landPrice != null ? inr(project.landPrice) : null],
                [`Rate per ${unit}`, project.rate != null ? inr(project.rate) : null],
                ['Price as on', project.priceDate ? fmtDate(project.priceDate) : null],
              ]}
            />
            {project.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{project.notes}</p>}
          </div>
        </Card>

        <Card title="Purchase details">
          <div className="space-y-5">
            <DetailGrid
              cols={3}
              items={[
                ['Agreement date', pu.agreementDate ? fmtDate(pu.agreementDate) : null],
                ['Registration date', pu.registrationDate ? fmtDate(pu.registrationDate) : null],
                ['Registration no.', pu.registrationNo],
              ]}
            />
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {costRows.map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-4 py-2.5 text-slate-600">{k}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{v != null ? inr(v) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#E2EDE8]/60">
                    <td className="px-4 py-2.5 font-bold text-[#0F3D2E]">Total acquisition cost</td>
                    <td className="px-4 py-2.5 text-right font-extrabold text-[#0F3D2E] tabular-nums">{inr(project.acquisitionCost)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Paid to owner so far</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700">{pu.paidToOwner != null ? inr(pu.paidToOwner) : '—'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Balance to owner</td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${project.balanceToOwner > 0 ? 'text-rose-700' : ''}`}>{project.balanceToOwner != null ? inr(project.balanceToOwner) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {pu.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{pu.notes}</p>}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Landowner">
          <PersonCard person={landowner} empty="No landowner added. Choose one in Edit project." />
        </Card>
        <Card title="Vendor">
          <PersonCard person={vendor} empty="No vendor added." />
        </Card>
        <Card title={`Brokers${brokers.length ? ` (${brokers.length})` : ''}`}>
          {brokers.length === 0 ? (
            <p className="text-sm text-slate-500">No brokers added to this project.</p>
          ) : (
            <ul className="divide-y divide-slate-100 -my-2">
              {brokers.map((b) => (
                <li key={b.id} className="py-3">
                  <PersonCard person={b} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Plots">
          <div className="space-y-4">
            <PlotBar summary={project.plotSummary} />
            <DetailGrid
              items={[
                ['Total plots', project.plotSummary.total],
                ['Plot area', project.plotSummary.area ? `${project.plotSummary.area.toLocaleString('en-IN')} sq.ft` : null],
                ['Sale value', inrShort(project.plotSummary.saleValue)],
                ['Received', inrShort(project.plotSummary.received)],
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ───────────── Customer payments of the whole project ───────────── */

export function ProjectPaymentsTab({ project, plots, canEdit, onOpenPlot, onChanged, onShowToast }) {
  const { data, loading, error, reload } = useAsync(() => listProjectPayments(project.id), [project.id, plots])
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const payments = useMemo(() => data?.payments || [], [data])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return payments.filter((p) => !q || `${p.plotNo} ${p.customerName} ${p.label || ''} ${p.referenceNo || ''} ${p.mode || ''}`.toLowerCase().includes(q))
  }, [payments, query])
  const s = project.plotSummary

  const columns = [
    { key: 'date', header: 'Date', render: (p) => <span className="whitespace-nowrap">{fmtDate(p.date)}</span> },
    { key: 'plot', header: 'Plot', render: (p) => <span className="font-bold text-slate-900">{p.plotNo}</span> },
    { key: 'customer', header: 'Customer', render: (p) => p.customerName || '—' },
    { key: 'label', header: 'Payment for', render: (p) => p.label || <span className="text-slate-400">—</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-bold">{inr(p.amount)}</span> },
    { key: 'mode', header: 'Mode', render: (p) => p.mode || <span className="text-slate-400">—</span> },
    { key: 'ref', header: 'Reference', render: (p) => p.referenceNo || <span className="text-slate-400">—</span> },
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Received" value={inrShort(s.received)} hint={`${payments.length} payment${payments.length === 1 ? '' : 's'}`} icon={IndianRupee} tone="green" />
        <StatCard label="Sale value" value={inrShort(s.saleValue)} hint="Booked and sold plots" tone="blue" />
        <StatCard label="Pending" value={inrShort(s.pending)} hint="Still to collect" tone="rose" />
      </div>
      <Card
        title="Customer payments"
        subtitle="Everything received from plot customers. Click a row to open the plot."
        actions={
          <>
            <ExportButton type="payments" projectId={project.id} label="Export" onShowToast={onShowToast} />
            {canEdit && (
              <button type="button" className={btnPrimary} onClick={() => setModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Record payment
              </button>
            )}
          </>
        }
        bodyClassName="p-3 space-y-3"
      >
        {loading && !data ? (
          <LoadingBlock label="Loading payments…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : payments.length === 0 ? (
          <EmptyState icon={IndianRupee} title="No payments yet" text="Payments appear here as you record them against plots." action={canEdit && <button type="button" className={btnPrimary} onClick={() => setModal(true)}><Plus className="w-4 h-4" /> Record payment</button>} />
        ) : (
          <>
            <div className="relative md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plot, customer, reference…" className={`${inputCls} pl-9 !py-2`} aria-label="Search payments" />
            </div>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(p) => p.id}
              onRowClick={(p) => onOpenPlot(p.plotId, 'payments')}
              empty="No payment matches your search."
              footer={
                filtered.length > 0 && (
                  <tr>
                    <td className="px-3.5 py-2.5" colSpan={4}>Total ({filtered.length})</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{inr(filtered.reduce((t, p) => t + p.amount, 0))}</td>
                    <td colSpan={2} />
                  </tr>
                )
              }
            />
          </>
        )}
      </Card>
      {modal && (
        <PaymentModal
          kind="customer"
          plots={plots}
          onClose={() => setModal(false)}
          onSaved={() => {
            onShowToast?.('Payment recorded', 'success')
            reload()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/* ───────────── Broker commission of the whole project ───────────── */

export function ProjectCommissionTab({ project, plots, canEdit, onOpenPlot, onChanged, onShowToast }) {
  const { data, loading, error, reload } = useAsync(() => listCommissions(project.id), [project.id, plots])
  const [modal, setModal] = useState(false)
  const rows = useMemo(() => data?.commissions || [], [data])
  const payments = useMemo(() => data?.payments || [], [data])
  const tot = rows.reduce((a, r) => ({ payable: a.payable + r.payable, paid: a.paid + r.paid, pending: a.pending + r.pending }), { payable: 0, paid: 0, pending: 0 })

  const columns = [
    { key: 'plot', header: 'Plot', render: (r) => <span className="font-bold text-slate-900">{r.plotNo}</span> },
    { key: 'broker', header: 'Broker', render: (r) => r.brokerName || '—' },
    { key: 'customer', header: 'Customer', render: (r) => r.customerName || '—' },
    { key: 'sale', header: 'Sale price', align: 'right', render: (r) => inr(r.salePrice) },
    { key: 'rate', header: 'Commission', render: (r) => (r.commission ? (r.commission.type === 'percent' ? `${r.commission.value}%` : `${inr(r.commission.value)} fixed`) : <span className="text-slate-400">Not set</span>) },
    { key: 'payable', header: 'Payable', align: 'right', render: (r) => inr(r.payable) },
    { key: 'paid', header: 'Paid', align: 'right', render: (r) => inr(r.paid) },
    { key: 'pending', header: 'Pending', align: 'right', render: (r) => (r.pending > 0 ? <span className="font-semibold text-rose-700">{inr(r.pending)}</span> : inr(r.pending)) },
    { key: 'status', header: 'Status', render: (r) => <CommissionStatus status={r.commissionStatus} /> },
  ]
  const payColumns = [
    { key: 'date', header: 'Date', render: (p) => <span className="whitespace-nowrap">{fmtDate(p.date)}</span> },
    { key: 'plot', header: 'Plot', render: (p) => <span className="font-bold text-slate-900">{p.plotNo}</span> },
    { key: 'broker', header: 'Broker', render: (p) => p.brokerName || '—' },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-bold">{inr(p.amount)}</span> },
    { key: 'mode', header: 'Mode', render: (p) => p.mode || <span className="text-slate-400">—</span> },
    { key: 'ref', header: 'Reference', render: (p) => p.referenceNo || <span className="text-slate-400">—</span> },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Payable" value={inrShort(tot.payable)} hint={`${rows.length} broker plot${rows.length === 1 ? '' : 's'}`} icon={Handshake} tone="gold" />
        <StatCard label="Paid" value={inrShort(tot.paid)} tone="green" />
        <StatCard label="Pending" value={inrShort(tot.pending)} tone="rose" />
      </div>
      <Card
        title="Commission by plot"
        subtitle="Plots sold through brokers. Set the commission on the plot's Edit tab."
        actions={
          <>
            <ExportButton type="commissions" projectId={project.id} label="Export" onShowToast={onShowToast} />
            {canEdit && rows.length > 0 && (
              <button type="button" className={btnPrimary} onClick={() => setModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Record payment
              </button>
            )}
          </>
        }
        bodyClassName="p-3"
      >
        {loading && !data ? (
          <LoadingBlock label="Loading commission…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Handshake} title="No plots sold through a broker" text="Open a plot, choose “Through a broker” in the Edit tab and set the commission. It is then tracked here." />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.plotId} onRowClick={(r) => onOpenPlot(r.plotId, 'commission')} />
        )}
      </Card>
      {payments.length > 0 && (
        <Card title="Commission payments" subtitle={`${payments.length} payment${payments.length === 1 ? '' : 's'} made to brokers`} bodyClassName="p-3">
          <DataTable columns={payColumns} rows={payments} rowKey={(p) => p.id} onRowClick={(p) => onOpenPlot(p.plotId, 'commission')} />
        </Card>
      )}
      {modal && (
        <PaymentModal
          kind="commission"
          plots={plots}
          onClose={() => setModal(false)}
          onSaved={() => {
            onShowToast?.('Commission payment recorded', 'success')
            reload()
            onChanged()
          }}
        />
      )}
    </div>
  )
}
