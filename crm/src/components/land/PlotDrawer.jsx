import React, { useEffect, useState } from 'react'
import {
  LandPlot,
  Check,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Phone,
  Mail,
  MapPin,
  Flag,
  UserRound,
  Handshake,
  Percent,
  IndianRupee,
  StickyNote,
  Info,
} from 'lucide-react'
import SidePanel from '../common/SidePanel'
import { Badge, btnGhost, btnPrimary, EmptyState, LoadingBlock, ErrorBlock } from '../common/PageKit'
import { useDialog } from '../../context/DialogContext'
import { getPlot, updatePlot, deletePlot, deletePayment, deleteCommissionPayment, addPlotNote, updatePlotNote, deletePlotNote } from '../../lib/landApi'
import { Field, TextInput, NumberInput, SelectInput, FormError, SectionTitle, DetailGrid, PlotStatus, PayStatus, CommissionStatus, useAsync, inr, fmtDate, fmtDateTime, PLOT_STATUSES, FACINGS } from './LandKit'
import { BrokerSelect } from './Parties'
import { PaymentForm } from './PaymentForms'
import { CustomerSaleFields, saleFormFromPlot, saleBody } from './CustomerSale'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'edit', label: 'Edit' },
  { id: 'payments', label: 'Payments' },
  { id: 'commission', label: 'Commission' },
  { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' },
]

const LOG_ICON = { created: Plus, status: Flag, customer: UserRound, broker: Handshake, commission: Percent, payment: IndianRupee, update: Pencil, note: StickyNote }
const parse = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return v === '' || v == null || !Number.isFinite(n) ? null : n
}

const commissionText = (c) => (c ? (c.type === 'percent' ? `${c.value}% of the sale price` : `${inr(c.value)} fixed`) : 'Not set')

/** Full view of one plot: details, customer, broker, payments and history. */
export default function PlotDrawer({ plotId, initialTab = 'overview', onClose, onChanged, canEdit, onShowToast }) {
  const [tab, setTab] = useState('overview')
  const { data, loading, error, reload, setData } = useAsync(() => getPlot(plotId), [plotId])

  useEffect(() => setTab(initialTab), [plotId, initialTab])

  const plot = data?.plot
  // Quietly refetch (keeps the screen steady) after something changed
  const refresh = async () => {
    try {
      setData(await getPlot(plotId))
    } catch {
      /* the next action will show any problem */
    }
    onChanged?.()
  }
  const merge = (view) => {
    setData((d) => ({ ...d, ...view }))
    refresh()
  }

  const visibleTabs = TABS.filter((t) => (t.id === 'edit' ? canEdit : t.id === 'commission' ? Boolean(plot?.brokerId) : true))

  return (
    <SidePanel
      open={Boolean(plotId)}
      onClose={onClose}
      title={plot ? `Plot ${plot.plotNo}${plot.block ? ` · Block ${plot.block}` : ''}` : 'Plot'}
      subtitle={data?.project?.name}
      icon={LandPlot}
      width="max-w-2xl"
    >
      <div className="flex flex-col h-full">
        {plot && (
          <div className="px-3 border-b border-slate-100 flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Plot sections">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-3.5 py-3 text-xs font-bold border-b-2 transition ${tab === t.id ? 'border-[#0F3D2E] text-[#0F3D2E]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && !data ? (
            <LoadingBlock label="Loading plot…" />
          ) : error && !data ? (
            <ErrorBlock message={error} onRetry={reload} />
          ) : plot ? (
            <>
              {tab === 'overview' && <Overview data={data} canEdit={canEdit} onEdit={() => setTab('edit')} onGo={setTab} />}
              {tab === 'edit' && canEdit && (
                <EditTab
                  plot={plot}
                  onSaved={async () => {
                    onShowToast?.(`Plot ${plot.plotNo} saved`, 'success')
                    await refresh()
                    setTab('overview')
                  }}
                  onDeleted={() => {
                    onShowToast?.(`Plot ${plot.plotNo} deleted`, 'info')
                    onChanged?.()
                    onClose()
                  }}
                />
              )}
              {tab === 'payments' && <CustomerPayments data={data} canEdit={canEdit} onView={merge} onShowToast={onShowToast} goEdit={() => setTab('edit')} />}
              {tab === 'commission' && <CommissionPayments data={data} canEdit={canEdit} onView={merge} onShowToast={onShowToast} />}
              {tab === 'notes' && <Notes data={data} canEdit={canEdit} onChanged={refresh} onShowToast={onShowToast} />}
              {tab === 'history' && <History data={data} />}
            </>
          ) : null}
        </div>
      </div>
    </SidePanel>
  )
}

/* ───────────── Overview ───────────── */

function Overview({ data, canEdit, onEdit, onGo }) {
  const { plot: p, broker, payments = [], logs = [] } = data
  const notes = logs.filter((l) => l.type === 'note').slice(0, 2)
  const pct = p.salePrice > 0 ? Math.min((p.paid / p.salePrice) * 100, 100) : 0
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PlotStatus status={p.status} />
          {p.source && p.customer && <Badge tone={p.source === 'broker' ? 'violet' : 'slate'}>{p.source === 'broker' ? 'Through broker' : 'Direct sale'}</Badge>}
          {p.paymentStatus && <PayStatus status={p.paymentStatus} />}
        </div>
        {canEdit && (
          <button type="button" onClick={onEdit} className={btnGhost}>
            <Pencil className="w-3.5 h-3.5" /> Edit plot
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Sale price', p.salePrice != null ? inr(p.salePrice) : 'Not set', 'text-slate-900'],
          ['Received', inr(p.paid), 'text-emerald-700'],
          ['Balance', p.balance != null ? inr(p.balance) : '—', p.balance > 0 ? 'text-rose-700' : 'text-slate-900'],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-slate-200 p-3 min-w-0">
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">{k}</p>
            <p className={`text-sm sm:text-base font-extrabold mt-0.5 tabular-nums truncate ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      {p.salePrice > 0 && (
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Received of sale price">
          <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      <section className="space-y-3">
        <SectionTitle>Plot details</SectionTitle>
        <DetailGrid
          items={[
            ['Area', p.area != null ? `${p.area} sq.ft` : null],
            ['Dimensions', p.dimensions],
            ['Facing', p.facing],
            ['Road width', p.roadWidth],
            ['Survey no.', p.surveyNo],
            ['Rate', p.rate != null ? `${inr(p.rate)} / sq.ft` : null],
            ['List price', p.listPrice != null ? inr(p.listPrice) : null],
            ['Block', p.block],
          ]}
        />
        {p.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{p.notes}</p>}
      </section>

      <section className="space-y-3">
        <SectionTitle>Customer</SectionTitle>
        {p.customer ? (
          <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
            <p className="text-sm font-bold text-slate-900">{p.customer.name}</p>
            {p.customer.phone && (
              <a href={`tel:${p.customer.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-[#0F3D2E]">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> {p.customer.phone}
              </a>
            )}
            {p.customer.email && (
              <a href={`mailto:${p.customer.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-[#0F3D2E] break-all">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> {p.customer.email}
              </a>
            )}
            {p.customer.address && (
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" /> {p.customer.address}
              </p>
            )}
            {p.saleDate && <p className="text-xs text-slate-500">Sale date: {fmtDate(p.saleDate)}</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No customer yet. {canEdit && 'Add one in the Edit tab when the plot is booked.'}</p>
        )}
      </section>

      {p.brokerId && (
        <section className="space-y-3">
          <SectionTitle>Broker and commission</SectionTitle>
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{broker?.name || p.brokerName}</p>
              {broker?.phone && <p className="text-xs text-slate-500">{broker.phone}</p>}
            </div>
            <DetailGrid cols={3} items={[['Commission', commissionText(p.commission)], ['Payable', inr(p.commissionPayable)], ['Paid', inr(p.commissionPaid)], ['Pending', inr(p.commissionPending)], ['Status', p.commissionStatus && <CommissionStatus status={p.commissionStatus} />]]} />
          </div>
        </section>
      )}

      {p.customer && (
        <section className="space-y-3">
          <SectionTitle aside={<button type="button" onClick={() => onGo('payments')} className="text-xs font-bold text-[#0F3D2E] hover:underline">All payments</button>}>Recent payments</SectionTitle>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {payments.slice(0, 3).map((x) => (
                <li key={x.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold tabular-nums">{inr(x.amount)}</span>
                    <span className="block text-xs text-slate-500 truncate">{[x.label, x.mode, x.referenceNo && `Ref ${x.referenceNo}`].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">{fmtDate(x.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle aside={<button type="button" onClick={() => onGo('notes')} className="text-xs font-bold text-[#0F3D2E] hover:underline">All notes</button>}>Latest notes</SectionTitle>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.details}</p>
                <p className="text-[11px] text-slate-400 mt-1">{n.target === 'customer' ? 'Customer note' : 'Plot note'} · {fmtDateTime(n.at)} · {n.by?.name || 'CRM user'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ───────────── Edit ───────────── */

function toForm(p) {
  return {
    plotNo: p.plotNo || '',
    block: p.block || '',
    area: p.area ?? '',
    dimensions: p.dimensions || '',
    facing: p.facing || '',
    roadWidth: p.roadWidth || '',
    surveyNo: p.surveyNo || '',
    rate: p.rate ?? '',
    listPrice: p.listPrice ?? '',
    status: p.status || 'Available',
    notes: p.notes || '',
    ...saleFormFromPlot(p),
  }
}

function EditTab({ plot, onSaved, onDeleted }) {
  const { confirm, alert } = useDialog()
  const [f, setF] = useState(() => toForm(plot))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  useEffect(() => setF(toForm(plot)), [plot])

  const listSuggestion = parse(f.rate) != null && parse(f.area) != null ? parse(f.rate) * parse(f.area) : null

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await updatePlot(plot.id, {
        plotNo: f.plotNo,
        block: f.block,
        area: f.area,
        dimensions: f.dimensions,
        facing: f.facing,
        roadWidth: f.roadWidth,
        surveyNo: f.surveyNo,
        rate: f.rate,
        listPrice: f.listPrice,
        status: f.status,
        notes: f.notes,
        ...saleBody(f, plot.customer),
      })
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({ title: 'Delete plot', message: `Delete plot ${plot.plotNo} and its history? This can't be undone. Plots with payments recorded can't be deleted.`, confirmText: 'Delete plot', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      await deletePlot(plot.id)
      onDeleted()
    } catch (err) {
      await alert({ title: "Can't delete this plot", message: err.message, confirmText: 'OK', type: 'info' })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <FormError message={error} />

      <section className="space-y-3">
        <SectionTitle>Plot</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Plot number" htmlFor="pd-no" required>
            <TextInput id="pd-no" value={f.plotNo} onChange={set('plotNo')} maxLength={30} />
          </Field>
          <Field label="Block / row" htmlFor="pd-block">
            <TextInput id="pd-block" value={f.block} onChange={set('block')} maxLength={30} placeholder="e.g. A" />
          </Field>
          <Field label="Area (sq.ft)" htmlFor="pd-area">
            <NumberInput id="pd-area" value={f.area} onChange={set('area')} />
          </Field>
          <Field label="Dimensions" htmlFor="pd-dim">
            <TextInput id="pd-dim" value={f.dimensions} onChange={set('dimensions')} placeholder="e.g. 30 x 40" />
          </Field>
          <Field label="Facing" htmlFor="pd-facing">
            <SelectInput id="pd-facing" value={f.facing} onChange={set('facing')} options={FACINGS} placeholder="—" />
          </Field>
          <Field label="Road width" htmlFor="pd-road">
            <TextInput id="pd-road" value={f.roadWidth} onChange={set('roadWidth')} placeholder="e.g. 30 ft" />
          </Field>
          <Field label="Rate (₹ / sq.ft)" htmlFor="pd-rate">
            <NumberInput id="pd-rate" value={f.rate} onChange={set('rate')} />
          </Field>
          <Field label="List price (₹)" htmlFor="pd-list" hint={listSuggestion != null && f.listPrice === '' ? `Will be ${inr(listSuggestion)} (rate × area)` : undefined}>
            <NumberInput id="pd-list" value={f.listPrice} onChange={set('listPrice')} />
          </Field>
          <Field label="Survey no." htmlFor="pd-survey">
            <TextInput id="pd-survey" value={f.surveyNo} onChange={set('surveyNo')} />
          </Field>
          <Field label="Status" htmlFor="pd-status">
            <SelectInput id="pd-status" value={f.status} onChange={set('status')} options={PLOT_STATUSES} />
          </Field>
          <Field label="Notes" htmlFor="pd-notes" className="col-span-2">
            <textarea id="pd-notes" rows={2} maxLength={1000} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
          </Field>
        </div>
      </section>

      <CustomerSaleFields f={f} set={set} setF={setF} />

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
        <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl">
          <Trash2 className="w-4 h-4" /> Delete plot
        </button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save plot
        </button>
      </div>
    </form>
  )
}

/* ───────────── Payments (customer and commission) ───────────── */

function PaymentList({ rows, kind, canEdit, onEdit, onDelete }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No payments recorded yet.</p>
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {rows.map((p) => (
        <li key={p.id} className="p-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 tabular-nums">{inr(p.amount)}</p>
            <p className="text-xs text-slate-500 truncate">{[kind === 'customer' ? p.label : null, p.mode, p.referenceNo && `Ref ${p.referenceNo}`, p.note].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-slate-500 mr-1">{fmtDate(p.date)}</span>
            {canEdit && (
              <>
                <button type="button" onClick={() => onEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F3D2E] hover:bg-slate-100" aria-label={`Edit payment of ${inr(p.amount)}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => onDelete(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete payment of ${inr(p.amount)}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function useRowActions(kind, onView, onShowToast) {
  const { confirm, alert } = useDialog()
  const [editing, setEditing] = useState(null) // payment | 'new' | null
  const done = (msg) => (view) => {
    onView(view)
    setEditing(null)
    onShowToast?.(msg, 'success')
  }
  const remove = async (p) => {
    const ok = await confirm({ title: 'Delete payment', message: `Delete the payment of ${inr(p.amount)} dated ${fmtDate(p.date)}?`, confirmText: 'Delete payment', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      const view = await (kind === 'customer' ? deletePayment(p.id) : deleteCommissionPayment(p.id))
      onView(view)
      onShowToast?.('Payment deleted', 'info')
    } catch (err) {
      await alert({ title: "Can't delete", message: err.message, confirmText: 'OK', type: 'info' })
    }
  }
  return { editing, setEditing, done, remove }
}

function CustomerPayments({ data, canEdit, onView, onShowToast, goEdit }) {
  const { plot, payments } = data
  const { editing, setEditing, done, remove } = useRowActions('customer', onView, onShowToast)
  const pct = plot.salePrice > 0 ? Math.min((plot.paid / plot.salePrice) * 100, 100) : 0
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {[['Sale price', plot.salePrice != null ? inr(plot.salePrice) : 'Not set'], ['Received', inr(plot.paid)], ['Balance', plot.balance != null ? inr(plot.balance) : '—']].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 p-3 min-w-0">
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">{k}</p>
            <p className="text-sm font-extrabold mt-0.5 tabular-nums truncate">{v}</p>
          </div>
        ))}
      </div>
      {plot.salePrice > 0 && (
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Received of sale price">
          <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      )}
      {plot.salePrice == null && (
        <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Info className="w-4 h-4 shrink-0" /> Set the sale price in the Edit tab to track the pending balance.
        </p>
      )}

      {!plot.customer?.name ? (
        <p className="text-sm text-slate-600">
          Add the customer to this plot before recording payments.{' '}
          {canEdit && (
            <button type="button" onClick={goEdit} className="font-bold text-[#0F3D2E] hover:underline">
              Add customer
            </button>
          )}
        </p>
      ) : (
        <>
          {canEdit && !editing && (
            <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
              <Plus className="w-4 h-4" /> Record payment
            </button>
          )}
          {editing && (
            <PaymentForm kind="customer" compact plot={plot} payment={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={done(editing === 'new' ? 'Payment recorded' : 'Payment updated')} />
          )}
        </>
      )}
      <section className="space-y-2">
        <SectionTitle>Payments received ({payments.length})</SectionTitle>
        <PaymentList rows={payments} kind="customer" canEdit={canEdit} onEdit={setEditing} onDelete={remove} />
      </section>
    </div>
  )
}

function CommissionPayments({ data, canEdit, onView, onShowToast }) {
  const { plot, commPayments, broker } = data
  const { editing, setEditing, done, remove } = useRowActions('commission', onView, onShowToast)
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-bold text-slate-900">{broker?.name || plot.brokerName}</p>
        <p className="text-xs text-slate-500">{commissionText(plot.commission)}</p>
        {plot.commissionStatus && <div className="mt-2"><CommissionStatus status={plot.commissionStatus} /></div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['Payable', inr(plot.commissionPayable)], ['Paid', inr(plot.commissionPaid)], ['Pending', inr(plot.commissionPending)]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 p-3 min-w-0">
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">{k}</p>
            <p className="text-sm font-extrabold mt-0.5 tabular-nums truncate">{v}</p>
          </div>
        ))}
      </div>
      {!(plot.commissionPayable > 0) ? (
        <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Info className="w-4 h-4 shrink-0" /> Set the commission and the sale price in the Edit tab to know the amount payable.
        </p>
      ) : (
        <>
          {canEdit && !editing && plot.commissionPending > 0 && (
            <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
              <Plus className="w-4 h-4" /> Record commission payment
            </button>
          )}
          {editing && <PaymentForm kind="commission" compact plot={plot} payment={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={done(editing === 'new' ? 'Commission payment recorded' : 'Payment updated')} />}
        </>
      )}
      <section className="space-y-2">
        <SectionTitle>Commission paid ({commPayments.length})</SectionTitle>
        <PaymentList rows={commPayments} kind="commission" canEdit={canEdit} onEdit={setEditing} onDelete={remove} />
      </section>
    </div>
  )
}

/* ───────────── Notes ───────────── */

/** Notes about the plot or its customer, with who wrote them and when. */
function Notes({ data, canEdit, onChanged, onShowToast }) {
  const { confirm } = useDialog()
  const { plot } = data
  const [text, setText] = useState('')
  const [target, setTarget] = useState('plot')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { id, text }
  const [filter, setFilter] = useState('all')
  const notes = (data.logs || []).filter((l) => l.type === 'note')
  const shown = notes.filter((n) => filter === 'all' || (n.target || 'plot') === filter)

  const add = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await addPlotNote(plot.id, text, target)
      setText('')
      onShowToast?.('Note added', 'success')
      await onChanged()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const saveEdit = async () => {
    if (!editing?.text.trim()) return
    setBusy(true)
    try {
      await updatePlotNote(editing.id, editing.text)
      setEditing(null)
      await onChanged()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (n) => {
    const ok = await confirm({ title: 'Delete note', message: 'Delete this note? This can\'t be undone.', confirmText: 'Delete note', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      await deletePlotNote(n.id)
      await onChanged()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <form onSubmit={add} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="flex items-center gap-2">
            <label htmlFor="note-target" className="text-xs font-semibold text-slate-600">Note about</label>
            <select id="note-target" value={target} onChange={(e) => setTarget(e.target.value)} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#0F3D2E]">
              <option value="plot">This plot</option>
              {plot.customer?.name && <option value="customer">Customer: {plot.customer.name}</option>}
            </select>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder="Write a note…" aria-label="Note" className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Saved with today's date, time and your name</span>
            <button type="submit" disabled={busy || !text.trim()} className={btnPrimary}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add note
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-1.5" role="group" aria-label="Filter notes">
        {[['all', 'All'], ['plot', 'Plot'], ['customer', 'Customer']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${filter === id ? 'bg-[#0F3D2E] border-[#0F3D2E] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" text="Write down calls, promises and anything worth remembering about this plot or its customer." />
      ) : (
        <ul className="space-y-3">
          {shown.map((n) => (
            <li key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <Badge tone={n.target === 'customer' ? 'blue' : 'slate'}>{n.target === 'customer' ? `Customer: ${n.customerName || ''}` : 'Plot'}</Badge>
                {canEdit && !editing && (
                  <span className="flex items-center gap-0.5 -mt-1 -mr-1">
                    <button type="button" onClick={() => setEditing({ id: n.id, text: n.details })} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F3D2E] hover:bg-slate-100" aria-label="Edit note">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(n)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Delete note">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              {editing?.id === n.id ? (
                <div className="mt-2 space-y-2">
                  <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3} maxLength={1000} aria-label="Edit note text" className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" />
                  <div className="flex justify-end gap-2">
                    <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
                    <button type="button" className={btnPrimary} disabled={busy || !editing.text.trim()} onClick={saveEdit}>Save</button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{n.details}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                {fmtDateTime(n.at)} · {n.by?.name || 'CRM user'}
                {n.editedAt && ` · edited ${fmtDateTime(n.editedAt)} by ${n.editedBy?.name || 'CRM user'}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ───────────── History ───────────── */

const HISTORY_FILTERS = [
  ['all', 'Everything'],
  ['payment', 'Payments'],
  ['commission', 'Commission'],
  ['broker', 'Broker'],
  ['customer', 'Customer'],
  ['status', 'Booking & status'],
  ['note', 'Notes'],
]

/** Every change to the plot, newest first, filterable by kind. */
function History({ data }) {
  const [filter, setFilter] = useState('all')
  const all = data.logs || []
  const logs = filter === 'all' ? all : all.filter((l) => l.type === filter)
  const counts = Object.fromEntries(HISTORY_FILTERS.map(([id]) => [id, id === 'all' ? all.length : all.filter((l) => l.type === id).length]))
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter history">
        {HISTORY_FILTERS.filter(([id]) => id === 'all' || counts[id] > 0).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${filter === id ? 'bg-[#0F3D2E] border-[#0F3D2E] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
            {label} <span className="opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>
      {logs.length === 0 ? (
        <EmptyState icon={StickyNote} title="No history yet" text="Every change to this plot is recorded here." />
      ) : (
        <ol className="relative border-l border-slate-200 ml-3 space-y-5">
          {logs.map((l) => {
            const Icon = LOG_ICON[l.type] || Pencil
            return (
              <li key={l.id} className="pl-5 relative">
                <span className="absolute -left-3.5 top-0 w-7 h-7 rounded-full bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center ring-4 ring-white">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <p className="text-sm font-semibold text-slate-900">{l.title}</p>
                {l.details && <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{l.details}</p>}
                {l.changes?.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {l.changes.map((c) => (
                      <li key={c.field} className="text-xs text-slate-600">
                        <span className="font-semibold">{c.label}:</span> <span className="text-slate-400 line-through">{c.from}</span> → <span className="font-semibold text-slate-800">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  {fmtDateTime(l.at)} · {l.by?.name || 'CRM user'}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
