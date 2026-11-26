import React, { useMemo, useRef, useState } from 'react'
import { Plus, Search, LayoutGrid, Table2, Loader2, Layers, Image as ImageIcon, UploadCloud, Eye, Trash2, RefreshCw, Check } from 'lucide-react'
import { Card, EmptyState, btnGhost, btnPrimary, inputCls } from '../common/PageKit'
import { useDialog } from '../../context/DialogContext'
import { createPlot, createPlotsBulk, uploadLayoutPlan, deleteLayoutPlan, layoutPlanBlobUrl } from '../../lib/landApi'
import { PLOT_DOC_ACCEPT } from '../../lib/plotDocumentsApi'
import { LandModal, Field, TextInput, NumberInput, SelectInput, FormError, DataTable, ExportButton, FilePreview, PlotStatus, PLOT_STYLE, PLOT_STATUSES, FACINGS, inr } from './LandKit'

const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })

/* ───────────── Layout board ───────────── */

function PlotBoard({ plots, onOpen }) {
  const groups = useMemo(() => {
    const m = new Map()
    for (const p of plots) {
      const k = p.block || ''
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(p)
    }
    return [...m.entries()].sort((a, b) => naturalSort(a[0], b[0]))
  }, [plots])

  if (!plots.length) return null
  return (
    <div className="space-y-5">
      {groups.map(([block, list]) => (
        <section key={block || 'none'} aria-label={block ? `Block ${block}` : 'Plots'}>
          {(block || groups.length > 1) && (
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{block ? `Block ${block}` : 'No block'}</h4>
              <span className="text-[11px] text-slate-400">{list.length} plot{list.length === 1 ? '' : 's'}</span>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
            {list.map((p) => {
              const st = PLOT_STYLE[p.status] || PLOT_STYLE.Available
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpen(p.id)}
                  title={[`Plot ${p.plotNo}`, p.status, p.customer?.name, p.area ? `${p.area} sq.ft` : null].filter(Boolean).join(' · ')}
                  className={`relative text-left rounded-xl border px-2.5 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D2E]/40 ${st.tile}`}
                >
                  <span className="block text-sm font-extrabold leading-tight truncate">{p.plotNo}</span>
                  <span className="block text-[10.5px] opacity-80 truncate">{p.customer?.name || (p.area ? `${p.area} sq.ft` : p.status)}</span>
                  {p.brokerId && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#0F3D2E]" title="Sold through a broker" />}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

/* ───────────── Add one / many ───────────── */

const blank = { plotNo: '', block: '', area: '', dimensions: '', facing: '', roadWidth: '', surveyNo: '', rate: '', status: 'Available', notes: '' }

function AddPlotModal({ project, onClose, onSaved }) {
  const [f, setF] = useState(blank)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await createPlot(project.id, f)
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
      title="Add a plot"
      subtitle={project.name}
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-plot" className={btnPrimary} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add plot
          </button>
        </>
      }
    >
      <form id="add-plot" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Plot number" htmlFor="ap-no" required>
            <TextInput id="ap-no" value={f.plotNo} onChange={set('plotNo')} maxLength={30} autoFocus />
          </Field>
          <Field label="Block / row" htmlFor="ap-block">
            <TextInput id="ap-block" value={f.block} onChange={set('block')} maxLength={30} placeholder="e.g. A" />
          </Field>
          <Field label="Area (sq.ft)" htmlFor="ap-area">
            <NumberInput id="ap-area" value={f.area} onChange={set('area')} />
          </Field>
          <Field label="Dimensions" htmlFor="ap-dim">
            <TextInput id="ap-dim" value={f.dimensions} onChange={set('dimensions')} placeholder="e.g. 30 x 40" />
          </Field>
          <Field label="Facing" htmlFor="ap-facing">
            <SelectInput id="ap-facing" value={f.facing} onChange={set('facing')} options={FACINGS} placeholder="—" />
          </Field>
          <Field label="Road width" htmlFor="ap-road">
            <TextInput id="ap-road" value={f.roadWidth} onChange={set('roadWidth')} placeholder="e.g. 30 ft" />
          </Field>
          <Field label="Rate (₹ / sq.ft)" htmlFor="ap-rate">
            <NumberInput id="ap-rate" value={f.rate} onChange={set('rate')} />
          </Field>
          <Field label="Status" htmlFor="ap-status">
            <SelectInput id="ap-status" value={f.status} onChange={set('status')} options={['Available', 'Hold']} />
          </Field>
        </div>
        <p className="text-[11px] text-slate-500">Add the customer, broker and payments from the plot once it is booked.</p>
      </form>
    </LandModal>
  )
}

function BulkModal({ project, onClose, onDone }) {
  const [f, setF] = useState({ prefix: '', from: '1', to: '', block: '', area: '', dimensions: '', facing: '', roadWidth: '', rate: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const count = Number.isInteger(parseInt(f.from, 10)) && Number.isInteger(parseInt(f.to, 10)) ? Math.max(parseInt(f.to, 10) - parseInt(f.from, 10) + 1, 0) : 0
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await createPlotsBulk(project.id, f)
      onDone(res)
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
      title="Add many plots"
      subtitle="Create a run of plots with the same size and rate"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="bulk-plots" className={btnPrimary} disabled={saving || count < 1}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Add {count > 0 ? count : ''} plot{count === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <form id="bulk-plots" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Prefix" htmlFor="bp-prefix" hint="Optional, e.g. A">
            <TextInput id="bp-prefix" value={f.prefix} onChange={set('prefix')} maxLength={10} />
          </Field>
          <Field label="From no." htmlFor="bp-from" required>
            <NumberInput id="bp-from" value={f.from} onChange={(v) => set('from')(v.replace(/\D/g, ''))} />
          </Field>
          <Field label="To no." htmlFor="bp-to" required>
            <NumberInput id="bp-to" value={f.to} onChange={(v) => set('to')(v.replace(/\D/g, ''))} autoFocus />
          </Field>
          <Field label="Block / row" htmlFor="bp-block">
            <TextInput id="bp-block" value={f.block} onChange={set('block')} maxLength={30} />
          </Field>
          <Field label="Area (sq.ft)" htmlFor="bp-area">
            <NumberInput id="bp-area" value={f.area} onChange={set('area')} />
          </Field>
          <Field label="Rate (₹ / sq.ft)" htmlFor="bp-rate">
            <NumberInput id="bp-rate" value={f.rate} onChange={set('rate')} />
          </Field>
          <Field label="Dimensions" htmlFor="bp-dim">
            <TextInput id="bp-dim" value={f.dimensions} onChange={set('dimensions')} />
          </Field>
          <Field label="Facing" htmlFor="bp-facing">
            <SelectInput id="bp-facing" value={f.facing} onChange={set('facing')} options={FACINGS} placeholder="—" />
          </Field>
          <Field label="Road width" htmlFor="bp-road">
            <TextInput id="bp-road" value={f.roadWidth} onChange={set('roadWidth')} />
          </Field>
        </div>
        <p className="text-[11px] text-slate-500">
          Creates {f.prefix}
          {f.from || '…'} to {f.prefix}
          {f.to || '…'}. Numbers that already exist are skipped.
        </p>
      </form>
    </LandModal>
  )
}

/* ───────────── Layout plan (reference drawing) ───────────── */

function LayoutPlan({ project, canEdit, onChanged, onShowToast }) {
  const { confirm } = useDialog()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [preview, setPreview] = useState(false)
  const layout = project.layout

  const upload = async (file) => {
    setBusy('upload')
    setProgress(0)
    try {
      await uploadLayoutPlan(project.id, file, { onProgress: setProgress, onStage: setStage })
      onShowToast?.('Layout plan saved', 'success')
      onChanged()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    const ok = await confirm({ title: 'Remove layout plan', message: 'Remove the uploaded layout plan from this project?', confirmText: 'Remove', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    setBusy('delete')
    try {
      await deleteLayoutPlan(project.id)
      onChanged()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="Layout plan" subtitle="The approved layout drawing of this project (PDF, JPG or PNG)">
      {layout ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center">
            <ImageIcon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{layout.name}</p>
            <p className="text-[11px] text-slate-500">{Math.round(layout.size / 1024)} KB</p>
          </div>
          <button type="button" className={btnGhost} onClick={() => setPreview(true)}>
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          {canEdit && (
            <>
              <button type="button" className={btnGhost} disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>
                {busy === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Replace
              </button>
              <button type="button" className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" disabled={Boolean(busy)} onClick={remove} aria-label="Remove layout plan">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ) : canEdit ? (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 hover:border-[#0F3D2E] py-6 text-center transition">
          {busy === 'upload' ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-[#0F3D2E]" /> : <UploadCloud className="w-6 h-6 mx-auto text-[#0F3D2E]" />}
          <p className="text-sm font-semibold text-slate-700 mt-1.5">Upload the layout plan</p>
          <p className="text-[11px] text-slate-500">PDF, JPG or PNG, up to 15 MB</p>
        </button>
      ) : (
        <p className="text-sm text-slate-500">No layout plan uploaded.</p>
      )}
      {busy === 'upload' && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
            <span>{stage}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <span className="block h-full bg-[#0F3D2E] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={PLOT_DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) upload(f)
        }}
      />
      {preview && layout && <FilePreview title="Layout plan" name={layout.name} ext={layout.ext} load={() => layoutPlanBlobUrl(project.id)} onClose={() => setPreview(false)} />}
    </Card>
  )
}

/* ───────────── Tab ───────────── */

export default function PlotsTab({ project, plots, canEdit, onOpen, onChanged, onProjectChanged, onShowToast }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [block, setBlock] = useState('')
  const [view, setView] = useState('board')
  const [adding, setAdding] = useState(false)
  const [bulk, setBulk] = useState(false)

  const counts = useMemo(() => Object.fromEntries(PLOT_STATUSES.map((s) => [s, plots.filter((p) => p.status === s).length])), [plots])
  const blocks = useMemo(() => [...new Set(plots.map((p) => p.block).filter(Boolean))].sort(naturalSort), [plots])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return plots.filter((p) => (!status || p.status === status) && (!block || p.block === block) && (!q || `${p.plotNo} ${p.customer?.name || ''} ${p.customer?.phone || ''} ${p.brokerName || ''}`.toLowerCase().includes(q)))
  }, [plots, query, status, block])

  const columns = [
    { key: 'plotNo', header: 'Plot', render: (p) => <span className="font-bold text-slate-900">{p.plotNo}</span> },
    { key: 'block', header: 'Block', render: (p) => p.block || '—' },
    { key: 'area', header: 'Area (sq.ft)', align: 'right', render: (p) => p.area ?? '—' },
    { key: 'status', header: 'Status', render: (p) => <PlotStatus status={p.status} /> },
    { key: 'customer', header: 'Customer', render: (p) => p.customer?.name || <span className="text-slate-400">—</span> },
    { key: 'source', header: 'Sold', render: (p) => (p.customer ? (p.brokerId ? p.brokerName || 'Broker' : 'Direct') : <span className="text-slate-400">—</span>) },
    { key: 'sale', header: 'Sale price', align: 'right', render: (p) => inr(p.salePrice) },
    { key: 'paid', header: 'Paid', align: 'right', render: (p) => inr(p.paid) },
    { key: 'balance', header: 'Balance', align: 'right', render: (p) => (p.balance > 0 ? <span className="text-rose-700 font-semibold">{inr(p.balance)}</span> : inr(p.balance)) },
  ]

  return (
    <div className="space-y-5">
      <Card
        title="Plot layout"
        subtitle={`${plots.length} plot${plots.length === 1 ? '' : 's'} · click a plot for its details, customer and payments`}
        actions={
          <>
            <ExportButton type="plots" projectId={project.id} label="Export plots" onShowToast={onShowToast} />
            {canEdit && (
              <>
                <button type="button" className={btnGhost} onClick={() => setBulk(true)}>
                  <Layers className="w-3.5 h-3.5" /> Add many
                </button>
                <button type="button" className={btnPrimary} onClick={() => setAdding(true)}>
                  <Plus className="w-3.5 h-3.5" /> Add plot
                </button>
              </>
            )}
          </>
        }
      >
        {plots.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No plots in this project yet"
            text="Add plots one by one, or create a whole run of them at once."
            action={canEdit && (
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className={btnGhost} onClick={() => setBulk(true)}><Layers className="w-4 h-4" /> Add many</button>
                <button type="button" className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add plot</button>
              </div>
            )}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
                <button type="button" onClick={() => setStatus('')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${!status ? 'bg-[#0F3D2E] border-[#0F3D2E] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                  All {plots.length}
                </button>
                {PLOT_STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(status === s ? '' : s)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${status === s ? 'bg-[#0F3D2E] border-[#0F3D2E] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${PLOT_STYLE[s].dot}`} /> {s} {counts[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 lg:ml-auto">
                <div className="relative flex-1 lg:w-56">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Plot, customer, broker…" className={`${inputCls} pl-9 !py-2`} aria-label="Search plots" />
                </div>
                {blocks.length > 0 && (
                  <div className="w-32">
                    <SelectInput value={block} onChange={setBlock} options={blocks.map((b) => ({ value: b, label: `Block ${b}` }))} placeholder="All blocks" aria-label="Filter by block" />
                  </div>
                )}
                <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200" role="group" aria-label="View">
                  {[
                    ['board', LayoutGrid, 'Layout'],
                    ['table', Table2, 'Table'],
                  ].map(([id, Icon, label]) => (
                    <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} title={label} aria-label={`${label} view`} className={`p-1.5 rounded-lg transition ${view === id ? 'bg-white text-[#0F3D2E] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No plot matches your filters.</p>
            ) : view === 'board' ? (
              <PlotBoard plots={filtered} onOpen={onOpen} />
            ) : (
              <DataTable columns={columns} rows={filtered} rowKey={(p) => p.id} onRowClick={(p) => onOpen(p.id)} />
            )}
          </div>
        )}
      </Card>

      <LayoutPlan project={project} canEdit={canEdit} onChanged={onProjectChanged} onShowToast={onShowToast} />

      {adding && (
        <AddPlotModal
          project={project}
          onClose={() => setAdding(false)}
          onSaved={(p) => {
            onShowToast?.(`Plot ${p.plotNo} added`, 'success')
            onChanged()
          }}
        />
      )}
      {bulk && (
        <BulkModal
          project={project}
          onClose={() => setBulk(false)}
          onDone={(r) => {
            onShowToast?.(`${r.created} plot${r.created === 1 ? '' : 's'} added${r.skipped?.length ? `, ${r.skipped.length} already existed` : ''}`, 'success')
            onChanged()
          }}
        />
      )}
    </div>
  )
}
