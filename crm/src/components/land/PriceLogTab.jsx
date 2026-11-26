import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, EmptyState, LoadingBlock, ErrorBlock, StatCard, Badge, btnGhost, btnPrimary } from '../common/PageKit'
import { useDialog } from '../../context/DialogContext'
import { listPriceLog, addPriceEntry, updatePriceEntry, deletePriceEntry } from '../../lib/landApi'
import { useAsync, DataTable, ExportButton, LandModal, Field, TextInput, NumberInput, FormError, inr, inrShort, fmtDate, todayIso } from './LandKit'

const parse = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return v === '' || v == null || !Number.isFinite(n) ? null : n
}

function EntryModal({ project, entry, onClose, onSaved }) {
  const unit = project.areaUnit.toLowerCase().replace(/s$/, '')
  const [f, setF] = useState({ date: todayIso(), rate: '', totalPrice: '', reason: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  useEffect(() => {
    setError(null)
    setF(entry ? { date: entry.date, rate: entry.rate ?? '', totalPrice: entry.totalPrice ?? '', reason: entry.reason || '' } : { date: todayIso(), rate: '', totalPrice: '', reason: '' })
  }, [entry])

  const area = project.totalArea
  const rate = parse(f.rate)
  const total = parse(f.totalPrice)
  const hint =
    area && rate != null && f.totalPrice === '' ? `Total will be ${inr(rate * area)} (${area} ${project.areaUnit})`
    : area && total != null && f.rate === '' ? `Rate will be ${inr(total / area)} per ${unit}`
    : null

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { date: f.date, rate: f.rate, totalPrice: f.totalPrice, reason: f.reason }
      const res = entry ? await updatePriceEntry(entry.id, body) : await addPriceEntry(project.id, body)
      onSaved(res.entry, Boolean(entry))
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
      title={entry ? 'Edit price entry' : 'Record a price change'}
      subtitle={project.name}
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="price-form" className={btnPrimary} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {entry ? 'Save changes' : 'Add entry'}
          </button>
        </>
      }
    >
      <form id="price-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date" htmlFor="pl-date" required className="sm:col-span-2">
            <TextInput id="pl-date" type="date" value={f.date} onChange={set('date')} />
          </Field>
          <Field label={`Rate per ${unit} (₹)`} htmlFor="pl-rate">
            <NumberInput id="pl-rate" value={f.rate} onChange={set('rate')} autoFocus />
          </Field>
          <Field label="Total price (₹)" htmlFor="pl-total">
            <NumberInput id="pl-total" value={f.totalPrice} onChange={set('totalPrice')} />
          </Field>
          {hint && <p className="sm:col-span-2 text-[11px] text-[#0F3D2E] -mt-2">{hint}</p>}
          <Field label="Reason / note" htmlFor="pl-reason" className="sm:col-span-2">
            <TextInput id="pl-reason" value={f.reason} onChange={set('reason')} maxLength={300} placeholder="e.g. Revised after negotiation" />
          </Field>
        </div>
        <p className="text-[11px] text-slate-500">The latest entry by date becomes the project's current price.</p>
      </form>
    </LandModal>
  )
}

/** History of the land price: every change with the difference from the one before. */
export default function PriceLogTab({ project, canEdit, onChanged, onShowToast }) {
  const { confirm } = useDialog()
  const { data, loading, error, reload } = useAsync(() => listPriceLog(project.id), [project.id])
  const [modal, setModal] = useState(null) // { entry? }
  const entries = useMemo(() => data?.entries || [], [data])
  const unit = project.areaUnit.toLowerCase().replace(/s$/, '')
  const first = entries[entries.length - 1]
  const current = entries[0]
  const refreshed = () => {
    reload()
    onChanged()
  }

  const remove = async (e) => {
    const ok = await confirm({ title: 'Delete price entry', message: `Delete the entry dated ${fmtDate(e.date)}? The current price is recalculated from the remaining entries.`, confirmText: 'Delete entry', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      await deletePriceEntry(e.id)
      onShowToast?.('Price entry deleted', 'info')
      refreshed()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (e) => (
        <span className="font-semibold text-slate-800 whitespace-nowrap">
          {fmtDate(e.date)} {e.id === current?.id && <Badge tone="green">Current</Badge>}
        </span>
      ),
    },
    { key: 'rate', header: `Rate / ${unit}`, align: 'right', render: (e) => inr(e.rate) },
    { key: 'total', header: 'Total price', align: 'right', render: (e) => <span className="font-bold">{inr(e.totalPrice)}</span> },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      render: (e) =>
        e.change == null ? (
          <span className="text-slate-400">—</span>
        ) : e.change === 0 ? (
          <span className="text-slate-500">No change</span>
        ) : (
          <span className={`inline-flex items-center gap-1 font-semibold ${e.change > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {e.change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {inr(Math.abs(e.change))}
            {e.changePercent != null && <span className="text-[11px] font-medium">({e.changePercent > 0 ? '+' : ''}{e.changePercent}%)</span>}
          </span>
        ),
    },
    { key: 'reason', header: 'Reason', render: (e) => <span className="text-slate-600">{e.reason || '—'}</span> },
    { key: 'by', header: 'Recorded by', render: (e) => <span className="text-xs text-slate-500">{e.by?.name || '—'}</span> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (e) =>
        canEdit && (
          <span className="inline-flex items-center gap-1">
            <button type="button" onClick={() => setModal({ entry: e })} className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Edit entry of ${fmtDate(e.date)}`}>
              <Pencil className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => remove(e)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete entry of ${fmtDate(e.date)}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          </span>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      {entries.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Current price" value={inrShort(current?.totalPrice)} hint={fmtDate(current?.date)} icon={TrendingUp} />
          <StatCard label={`Current rate / ${unit}`} value={inr(current?.rate)} tone="gold" />
          <StatCard label="First price" value={inrShort(first?.totalPrice)} hint={fmtDate(first?.date)} tone="slate" />
          <StatCard
            label="Change since first"
            value={first && current && first.totalPrice != null && current.totalPrice != null ? `${current.totalPrice - first.totalPrice > 0 ? '+' : ''}${inrShort(current.totalPrice - first.totalPrice)}` : '—'}
            hint={`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
            tone="blue"
          />
        </div>
      )}
      <Card
        title="Price log"
        subtitle="Every change to the land price, newest first"
        actions={
          <>
            <ExportButton type="price-log" projectId={project.id} label="Export" onShowToast={onShowToast} />
            {canEdit && (
              <button type="button" className={btnPrimary} onClick={() => setModal({})}>
                <Plus className="w-3.5 h-3.5" /> Record price
              </button>
            )}
          </>
        }
        bodyClassName="p-3"
      >
        {loading && !data ? (
          <LoadingBlock label="Loading price log…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : entries.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No prices recorded yet" text="Record the price you agreed, and every later change, to keep a clear history." action={canEdit && <button type="button" className={btnPrimary} onClick={() => setModal({})}><Plus className="w-4 h-4" /> Record price</button>} />
        ) : (
          <DataTable columns={columns} rows={entries} rowKey={(e) => e.id} />
        )}
      </Card>

      {modal && (
        <EntryModal
          project={project}
          entry={modal.entry}
          onClose={() => setModal(null)}
          onSaved={(e, edited) => {
            onShowToast?.(edited ? 'Price entry updated' : 'Price recorded', 'success')
            refreshed()
          }}
        />
      )}
    </div>
  )
}
