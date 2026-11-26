import React, { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil, MapPin, Landmark, LandPlot, Layers, IndianRupee, Wallet } from 'lucide-react'
import { StatCard, ErrorBlock, LoadingBlock, btnGhost } from '../common/PageKit'
import { useAuth } from '../../context/AuthContext'
import { getProject, listPlots } from '../../lib/landApi'
import { useAsync, ExportButton, ProjectStatus, inrShort } from './LandKit'
import ProjectForm from './ProjectForm'
import PlotsTab from './PlotsTab'
import PlotDrawer from './PlotDrawer'
import PriceLogTab from './PriceLogTab'
import DocumentLogTab from './DocumentLogTab'
import CustomersTab from './CustomersTab'
import { OverviewTab, ProjectPaymentsTab, ProjectCommissionTab } from './ProjectTabs'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'plots', label: 'Plots' },
  { id: 'customers', label: 'Customers' },
  { id: 'price', label: 'Price log' },
  { id: 'documents', label: 'Documents' },
  { id: 'payments', label: 'Payments' },
  { id: 'commission', label: 'Commission' },
]

/** One land project: overview, plot layout, price log, document log, payments and commission. */
export default function LandProjectPage({ onShowToast }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { can } = useAuth()
  const canEdit = can('landrecords', 'edit')
  const projectState = useAsync(() => getProject(projectId), [projectId])
  const plotsState = useAsync(() => listPlots(projectId), [projectId])
  const [editing, setEditing] = useState(false)
  const [drawerTab, setDrawerTab] = useState('overview')

  const project = projectState.data?.project
  const landowner = projectState.data?.landowner
  const vendor = projectState.data?.vendor
  const brokers = projectState.data?.brokers
  const plots = useMemo(() => plotsState.data?.plots || [], [plotsState.data])
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  const openPlotId = params.get('plot')

  const go = (patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    setParams(next, { replace: true })
  }
  const refresh = () => {
    projectState.reload()
    plotsState.reload()
  }
  const openPlot = (id, startTab = 'overview') => {
    setDrawerTab(startTab)
    go({ plot: id })
  }

  if (projectState.loading && !project) return <LoadingBlock label="Loading project…" rows={4} />
  if (!project) {
    return (
      <div className="max-w-xl mx-auto pt-10 space-y-4">
        <ErrorBlock message={projectState.error || 'Project not found.'} onRetry={projectState.reload} />
        <button type="button" className={btnGhost} onClick={() => navigate('/landrecords')}>
          <ArrowLeft className="w-4 h-4" /> Back to land records
        </button>
      </div>
    )
  }

  const s = project.plotSummary
  const counts = { plots: s.total, price: project.priceLogCount, documents: project.docCount }

  return (
    <div className="space-y-5 pb-10 max-w-[1500px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={() => navigate('/landrecords')} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#0F3D2E] hover:border-[#0F3D2E] shrink-0" aria-label="Back to land records">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
              <ProjectStatus status={project.status} />
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> {[project.village, project.taluk, project.district].filter(Boolean).join(', ') || 'Location not set'}
              </span>
              {(project.landownerName || project.vendorName) && (
                <span className="inline-flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-slate-400" /> {[project.landownerName, project.vendorName].filter(Boolean).join(' · ')}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <ExportButton type="project" projectId={project.id} label="Export project" onShowToast={onShowToast} />
          {canEdit && (
            <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" /> Edit project
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Land price" value={inrShort(project.landPrice)} hint={project.totalArea != null ? `${project.totalArea} ${project.areaUnit}` : undefined} icon={Landmark} tone="gold" />
        <StatCard label="Acquisition cost" value={inrShort(project.acquisitionCost)} hint="With registration" tone="slate" />
        <StatCard label="Plots" value={`${s.available}/${s.total}`} hint="Available / total" icon={LandPlot} />
        <StatCard label="Sale value" value={inrShort(s.saleValue)} hint={`${s.booked + s.sold} booked or sold`} icon={Layers} tone="blue" />
        <StatCard label="Received" value={inrShort(s.received)} icon={IndianRupee} tone="green" />
        <StatCard label="Pending" value={inrShort(s.pending)} icon={Wallet} tone="rose" />
      </div>

      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Project sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => go({ tab: t.id === 'overview' ? '' : t.id, plot: '' })}
            className={`shrink-0 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition ${tab === t.id ? 'border-[#0F3D2E] text-[#0F3D2E]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
            {counts[t.id] > 0 && <span className="ml-1.5 text-[11px] font-semibold text-slate-400">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab project={project} landowner={landowner} vendor={vendor} brokers={brokers} />}
      {tab === 'plots' && (plotsState.loading && !plotsState.data ? <LoadingBlock label="Loading plots…" /> : plotsState.error && !plotsState.data ? <ErrorBlock message={plotsState.error} onRetry={plotsState.reload} /> : <PlotsTab project={project} plots={plots} canEdit={canEdit} onOpen={(id) => openPlot(id)} onChanged={refresh} onProjectChanged={projectState.reload} onShowToast={onShowToast} />)}
      {tab === 'customers' && <CustomersTab project={project} plots={plots} canEdit={canEdit} onOpenPlot={openPlot} onChanged={refresh} onShowToast={onShowToast} />}
      {tab === 'price' && <PriceLogTab project={project} canEdit={canEdit} onChanged={projectState.reload} onShowToast={onShowToast} />}
      {tab === 'documents' && <DocumentLogTab project={project} plots={plots} canEdit={canEdit} onChanged={projectState.reload} onShowToast={onShowToast} />}
      {tab === 'payments' && <ProjectPaymentsTab project={project} plots={plots} canEdit={canEdit} onOpenPlot={openPlot} onChanged={refresh} onShowToast={onShowToast} />}
      {tab === 'commission' && <ProjectCommissionTab project={project} plots={plots} canEdit={canEdit} onOpenPlot={openPlot} onChanged={refresh} onShowToast={onShowToast} />}

      {openPlotId && <PlotDrawer plotId={openPlotId} initialTab={drawerTab} canEdit={canEdit} onClose={() => go({ plot: '' })} onChanged={refresh} onShowToast={onShowToast} />}

      <ProjectForm
        open={editing}
        project={project}
        canDelete={canEdit}
        onClose={() => setEditing(false)}
        onSaved={() => {
          onShowToast?.('Project saved', 'success')
          refresh()
        }}
        onDeleted={(p) => {
          onShowToast?.(`${p.name} deleted`, 'info')
          navigate('/landrecords')
        }}
      />
    </div>
  )
}
