import React, { useMemo, useState } from 'react'
import { Plus, Search, Users, Check, Loader2, Phone, UserPlus } from 'lucide-react'
import { Card, EmptyState, LoadingBlock, ErrorBlock, StatCard, btnGhost, btnPrimary, inputCls } from '../common/PageKit'
import SearchSelect from '../common/SearchSelect'
import { listCustomers, updatePlot } from '../../lib/landApi'
import { useAsync, DataTable, ExportButton, LandModal, Field, SelectInput, FormError, PayStatus, inr, inrShort, fmtDate } from './LandKit'
import { CustomerSaleFields, blankSale, saleBody } from './CustomerSale'

const PAY_STATUSES = ['Unpaid', 'Part paid', 'Paid']

/** Give a plot its customer, with the sale and (optionally) a broker. */
function AssignCustomerModal({ project, plots, onClose, onSaved }) {
  const free = useMemo(() => plots.filter((p) => !p.customer?.name), [plots])
  const [plotId, setPlotId] = useState('')
  const [f, setF] = useState({ ...blankSale })
  const [status, setStatus] = useState('Booked')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const plot = free.find((p) => p.id === plotId)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!plot) return setError('Choose the plot this customer is buying.')
    if (!f.cName.trim()) return setError("Enter the customer's name.")
    setSaving(true)
    try {
      const res = await updatePlot(plot.id, { ...saleBody(f), status })
      onSaved(res.plot)
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
      title="Assign a customer to a plot"
      subtitle={project.name}
      width="max-w-2xl"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="assign-customer" className={btnPrimary} disabled={saving || free.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save customer
          </button>
        </>
      }
    >
      <form id="assign-customer" onSubmit={submit} className="space-y-6" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchSelect
            label="Plot"
            required
            value={plotId}
            onChange={(v) => setPlotId(v || '')}
            options={free.map((p) => ({ value: p.id, label: `Plot ${p.plotNo}${p.block ? ` · Block ${p.block}` : ''}`, sub: [p.status, p.area ? `${p.area} sq.ft` : null].filter(Boolean).join(' · ') }))}
            placeholder={free.length ? 'Select a plot without a customer' : 'Every plot already has a customer'}
            emptyText="No free plots"
          />
          <Field label="Plot status" htmlFor="ac-status">
            <SelectInput id="ac-status" value={status} onChange={setStatus} options={['Booked', 'Sold']} />
          </Field>
        </div>
        <CustomerSaleFields f={f} set={set} setF={setF} />
      </form>
    </LandModal>
  )
}

/** Every customer of the project, one per plot, with their sale, payments and broker. */
export default function CustomersTab({ project, plots, canEdit, onOpenPlot, onChanged, onShowToast }) {
  const { data, loading, error, reload } = useAsync(() => listCustomers(project.id), [project.id, plots])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [modal, setModal] = useState(false)
  const customers = useMemo(() => data?.customers || [], [data])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter((c) => (!status || c.paymentStatus === status) && (!q || `${c.name} ${c.phone || ''} ${c.email || ''} ${c.plotNo} ${c.brokerName}`.toLowerCase().includes(q)))
  }, [customers, query, status])
  const tot = customers.reduce((a, c) => ({ sale: a.sale + (c.salePrice || 0), paid: a.paid + c.paid, bal: a.bal + (c.balance || 0) }), { sale: 0, paid: 0, bal: 0 })

  const columns = [
    {
      key: 'name',
      header: 'Customer',
      render: (c) => (
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate max-w-[220px]">{c.name}</p>
          {c.phone && (
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <Phone className="w-3 h-3" /> {c.phone}
            </p>
          )}
        </div>
      ),
    },
    { key: 'plot', header: 'Plot', render: (c) => <span className="font-bold text-slate-900">{c.plotNo}{c.block ? <span className="font-normal text-slate-400"> · {c.block}</span> : null}</span> },
    { key: 'via', header: 'Sold', render: (c) => (c.brokerId ? c.brokerName || 'Broker' : 'Direct') },
    { key: 'sale', header: 'Sale price', align: 'right', render: (c) => inr(c.salePrice) },
    { key: 'paid', header: 'Paid', align: 'right', render: (c) => inr(c.paid) },
    { key: 'bal', header: 'Balance', align: 'right', render: (c) => (c.balance > 0 ? <span className="font-semibold text-rose-700">{inr(c.balance)}</span> : inr(c.balance)) },
    { key: 'status', header: 'Payment', render: (c) => <PayStatus status={c.paymentStatus} /> },
    { key: 'last', header: 'Last payment', render: (c) => <span className="whitespace-nowrap text-slate-500">{c.lastPaymentDate ? fmtDate(c.lastPaymentDate) : '—'}</span> },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Customers" value={customers.length} hint="One per plot" icon={Users} />
        <StatCard label="Sale value" value={inrShort(tot.sale)} tone="blue" />
        <StatCard label="Received" value={inrShort(tot.paid)} tone="green" />
        <StatCard label="Pending" value={inrShort(tot.bal)} tone="rose" />
      </div>

      <Card
        title="Customers"
        subtitle="People who have booked or bought a plot. Click a row for the plot, payments, commission, notes and history."
        actions={
          <>
            <ExportButton type="customers" projectId={project.id} label="Export" onShowToast={onShowToast} />
            {canEdit && (
              <button type="button" className={btnPrimary} onClick={() => setModal(true)}>
                <UserPlus className="w-3.5 h-3.5" /> Assign customer
              </button>
            )}
          </>
        }
        bodyClassName="p-3 space-y-3"
      >
        {loading && !data ? (
          <LoadingBlock label="Loading customers…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" text="Assign a customer to a plot when it is booked. Their payments, broker and commission are then tracked on that plot." action={canEdit && <button type="button" className={btnPrimary} onClick={() => setModal(true)}><Plus className="w-4 h-4" /> Assign customer</button>} />
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-2.5">
              <div className="relative md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer, phone, plot, broker…" className={`${inputCls} pl-9 !py-2`} aria-label="Search customers" />
              </div>
              <div className="md:w-48">
                <SelectInput value={status} onChange={setStatus} options={PAY_STATUSES} placeholder="Any payment status" aria-label="Filter by payment status" />
              </div>
            </div>
            <DataTable columns={columns} rows={filtered} rowKey={(c) => c.plotId} onRowClick={(c) => onOpenPlot(c.plotId, 'overview')} empty="No customer matches your filters." />
          </>
        )}
      </Card>

      {modal && (
        <AssignCustomerModal
          project={project}
          plots={plots}
          onClose={() => setModal(false)}
          onSaved={(p) => {
            onShowToast?.(`${p.customer?.name} assigned to plot ${p.plotNo}`, 'success')
            reload()
            onChanged()
          }}
        />
      )}
    </div>
  )
}
