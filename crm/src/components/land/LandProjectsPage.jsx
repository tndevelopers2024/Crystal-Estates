import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, MapPin, Landmark, LandPlot, IndianRupee, Wallet, Layers, ArrowUpRight } from 'lucide-react'
import { StatCard, EmptyState, LoadingBlock, ErrorBlock, btnPrimary, inputCls } from '../common/PageKit'
import { useAuth } from '../../context/AuthContext'
import { listProjects } from '../../lib/landApi'
import { useAsync, ExportButton, ProjectStatus, inr, inrShort, PROJECT_STATUSES, SelectInput } from './LandKit'
import ProjectForm from './ProjectForm'

/** Stacked bar of a project's plots by status. */
export function PlotBar({ summary }) {
  const t = summary.total || 0
  const seg = [
    ['Available', summary.available, 'bg-emerald-500'],
    ['Hold', summary.hold, 'bg-amber-400'],
    ['Booked', summary.booked, 'bg-sky-500'],
    ['Sold', summary.sold, 'bg-violet-500'],
  ]
  return (
    <div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex" role="img" aria-label={seg.map(([l, n]) => `${n} ${l}`).join(', ')}>
        {t > 0 && seg.map(([l, n, c]) => n > 0 && <span key={l} className={`${c} h-full`} style={{ width: `${(n / t) * 100}%` }} title={`${n} ${l}`} />)}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        {t === 0 ? 'No plots yet' : `${summary.available} available · ${summary.booked} booked · ${summary.sold} sold${summary.hold ? ` · ${summary.hold} on hold` : ''}`}
      </p>
    </div>
  )
}

/** Land records: every land project with its price, plots and money at a glance. */
export default function LandProjectsPage({ onShowToast }) {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canEdit = can('landrecords', 'edit')
  const { data, loading, error, reload } = useAsync(() => listProjects(), [])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const projects = useMemo(() => data?.projects || [], [data])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => (!status || p.status === status) && (!q || `${p.name} ${p.village} ${p.district} ${p.landownerName} ${p.vendorName} ${(p.brokerNames || []).join(' ')} ${p.surveyNumbers}`.toLowerCase().includes(q)))
  }, [projects, query, status])

  const totals = useMemo(
    () =>
      projects.reduce(
        (a, p) => ({
          cost: a.cost + (p.acquisitionCost || 0),
          plots: a.plots + p.plotSummary.total,
          sold: a.sold + p.plotSummary.sold + p.plotSummary.booked,
          saleValue: a.saleValue + p.plotSummary.saleValue,
          received: a.received + p.plotSummary.received,
          pending: a.pending + p.plotSummary.pending,
        }),
        { cost: 0, plots: 0, sold: 0, saleValue: 0, received: 0, pending: 0 },
      ),
    [projects],
  )

  return (
    <div className="space-y-5 pb-10 max-w-[1500px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Land records</h1>
          <p className="text-sm text-slate-500">Lands we are buying: prices, documents, plots, customers and payments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton type="all" label="Export everything" onShowToast={onShowToast} />
          {canEdit && (
            <button type="button" className={btnPrimary} onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4" /> Add project
            </button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading land projects…" rows={4} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80">
          <EmptyState
            icon={LandPlot}
            title="No land projects yet"
            text="Add the first land you are purchasing. You can then record its price history, documents, plots, customers and payments."
            action={canEdit && <button type="button" className={btnPrimary} onClick={() => setFormOpen(true)}><Plus className="w-4 h-4" /> Add project</button>}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Projects" value={projects.length} hint={`${projects.filter((p) => p.status === 'Selling').length} selling`} icon={LandPlot} />
            <StatCard label="Land cost" value={inrShort(totals.cost)} hint="Price + registration" icon={Landmark} tone="gold" />
            <StatCard label="Plots sold" value={`${totals.sold}/${totals.plots}`} hint="Booked or sold" icon={Layers} tone="blue" />
            <StatCard label="Received" value={inrShort(totals.received)} hint={`of ${inrShort(totals.saleValue)} sale value`} icon={IndianRupee} tone="green" />
            <StatCard label="Pending" value={inrShort(totals.pending)} hint="From customers" icon={Wallet} tone="rose" />
          </div>

          <div className="flex flex-col md:flex-row gap-2.5">
            <div className="relative md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search project, village, landowner…" className={`${inputCls} pl-9`} aria-label="Search projects" />
            </div>
            <div className="md:w-52">
              <SelectInput value={status} onChange={setStatus} options={PROJECT_STATUSES} placeholder="All statuses" aria-label="Filter by status" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No project matches your filters.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/landrecords/${p.id}`)}
                  className="group text-left bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 hover:shadow-lg hover:-translate-y-0.5 hover:border-[#0F3D2E]/40 transition-all duration-200 flex flex-col gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D2E]/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-[#0F3D2E]">{p.name}</h3>
                      <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        {[p.village, p.district].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ProjectStatus status={p.status} />
                      <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#0F3D2E]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Area</p>
                      <p className="font-bold text-slate-800 mt-0.5">{p.totalArea != null ? `${p.totalArea} ${p.areaUnit}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Land price</p>
                      <p className="font-bold text-slate-800 mt-0.5">{inrShort(p.landPrice)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Landowner</p>
                      <p className="font-bold text-slate-800 mt-0.5 truncate">{p.landownerName || p.vendorName || '—'}</p>
                    </div>
                  </div>

                  <PlotBar summary={p.plotSummary} />

                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold">Received</p>
                      <p className="font-bold text-emerald-700 tabular-nums">{inr(p.plotSummary.received)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold">Pending</p>
                      <p className={`font-bold tabular-nums ${p.plotSummary.pending > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{inr(p.plotSummary.pending)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <ProjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(project, created) => {
          onShowToast?.(created ? `${project.name} created` : 'Project saved', 'success')
          if (created) navigate(`/landrecords/${project.id}`)
          else reload()
        }}
      />
    </div>
  )
}
