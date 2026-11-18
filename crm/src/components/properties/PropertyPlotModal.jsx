import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  X,
  Layers,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { computePathCentroid } from '../../lib/svgPathCentroid'
import { parseViewBox } from '../../lib/svgUtils'
import { getClientUrl, updatePlot, saveLayoutPlots } from '../../lib/api'
import {
  canonicalLayoutSlug,
  resolveMediaUrl,
  summarizePlotStatuses,
  ensurePlotUids,
  newPlotUid,
  plotsForPhase,
  samePlotNo,
} from '../../lib/plotUtils'

const FACING_OPTIONS = [
  'East',
  'North',
  'West',
  'South',
  'North-East',
  'North-West',
  'South-East',
  'South-West',
]

const STATUS_OPTIONS = [
  { id: 'Available', label: 'Available', color: '#0284C7', bg: '#67E8F9', border: '#38BDF8' },
  { id: 'Booked', label: 'Booked', color: '#16A34A', bg: '#86EFAC', border: '#4ADE80' },
  { id: 'Sold', label: 'Sold', color: '#DC2626', bg: '#FCA5A5', border: '#F87171' },
  { id: 'Blocked', label: 'Blocked', color: '#D97706', bg: '#FCD34D', border: '#FBBF24' },
]

const STATUS_ALIASES = { Reserved: 'Booked', Registered: 'Sold' }
const statusConfig = (status) =>
  STATUS_OPTIONS.find((s) => s.id === (STATUS_ALIASES[status] || status)) || STATUS_OPTIONS[0]

const PLOT_TYPES = [
  'Residential Plot',
  'Commercial Plot',
  'Corner Plot',
  'Villa Plot',
  'Farm Land',
  'Industrial Plot',
]

const EMPTY_FORM = {
  plotNo: '',
  status: 'Available',
  facing: 'East',
  area: '1200 sq.ft',
  dimensions: "30'0\" x 40'0\"",
  price: '',
  roadWidth: '30 ft Road',
  plotType: 'Residential Plot',
  surveyNo: '',
  svgPath: '',
}

/** Strip a pasted <path d="…"> tag down to its path data. */
function cleanPathData(raw) {
  if (!raw) return ''
  const trimmed = raw.trim()
  const dMatch = trimmed.match(/d=["']([^"']+)["']/i)
  if (dMatch && dMatch[1]) return dMatch[1].trim()
  return trimmed.replace(/^d=/, '').replace(/^["']|["']$/g, '').trim()
}

/** Normalize the phase list on a property (layouts or legacy phases). */
function getLayoutPhases(property) {
  if (Array.isArray(property?.layouts) && property.layouts.length > 0) return property.layouts
  if (Array.isArray(property?.phases) && property.phases.length > 0) return property.phases
  return null
}

/**
 * Wrapper keeps the early return outside the component that uses hooks,
 * so opening/closing never changes the hook order.
 */
export default function PropertyPlotModal({ isOpen, property, ...rest }) {
  if (!isOpen || !property) return null
  return <PlotManager property={property} {...rest} />
}

function PlotManager({ property, onClose, onPropertyUpdated, onShowToast }) {
  const layoutPhases = useMemo(() => getLayoutPhases(property), [property])
  const [activePhaseIndex, setActivePhaseIndex] = useState(0)
  const currentPhase = layoutPhases ? layoutPhases[activePhaseIndex] || layoutPhases[0] : null
  const phaseName = currentPhase ? (currentPhase.name || `Phase ${activePhaseIndex + 1}`).trim() : undefined

  // Plots per phase, each with a stable uid
  const phasePlotLists = useMemo(() => {
    if (!layoutPhases) return [ensurePlotUids(Array.isArray(property.plots) ? property.plots : [])]
    return layoutPhases.map((phase, idx) =>
      ensurePlotUids(
        plotsForPhase(property, phase, idx, layoutPhases.length).map((p) => ({
          ...p,
          phase: (phase.name || `Phase ${idx + 1}`).trim(),
        })),
      ),
    )
  }, [property, layoutPhases])

  const [plots, setPlots] = useState(() => phasePlotLists[0] || [])
  const [editingUid, setEditingUid] = useState(null)
  const [filter, setFilter] = useState('All')
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [hoveredPlot, setHoveredPlot] = useState(null)
  const [layoutImgFailed, setLayoutImgFailed] = useState(false)

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingUid(null)
    setFormError(null)
  }, [])

  // Re-sync when the property or active phase changes
  useEffect(() => {
    setPlots(phasePlotLists[activePhaseIndex] || [])
    setHoveredPlot(null)
    setLayoutImgFailed(false)
    resetForm()
  }, [phasePlotLists, activePhaseIndex, resetForm])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cleanedPath = cleanPathData(form.svgPath)
  const centroid = useMemo(() => computePathCentroid(cleanedPath), [cleanedPath])
  const editingPlot = editingUid ? plots.find((p) => p.uid === editingUid) : null

  // Layout background + coordinate system
  const rawLayoutUrl =
    currentPhase?.layoutUrl ||
    currentPhase?.layoutBackgroundUrl ||
    property.layoutBackgroundUrl ||
    property.layoutUrl ||
    null
  const layoutBackgroundUrl = resolveMediaUrl(rawLayoutUrl)
  const { viewBoxStr: activeViewBox } = parseViewBox(
    currentPhase?.viewBox || property.viewBox || '0 0 1056 816',
    1056,
    816,
  )

  // "View Layout" link on the public website
  const slug =
    canonicalLayoutSlug(property.layoutSlug) ||
    canonicalLayoutSlug(property.layoutBackgroundUrl) ||
    property.projectId ||
    property.id
  const phaseParam = currentPhase ? `&phase=${encodeURIComponent(currentPhase.id || currentPhase.name)}` : ''
  const targetLayoutLink = getClientUrl(`/layout-viewer?slug=${encodeURIComponent(slug)}${phaseParam}`)

  const summary = summarizePlotStatuses(plots)
  const counts = {
    All: summary.total,
    Available: summary.available,
    Booked: summary.booked,
    Sold: summary.sold,
    Blocked: summary.blocked,
  }

  const handleEditClick = (plot) => {
    setEditingUid(plot.uid)
    setForm({
      plotNo: String(plot.plotNo ?? ''),
      status: STATUS_ALIASES[plot.status] || plot.status || 'Available',
      facing: plot.facing || 'East',
      area: plot.area || '',
      dimensions: plot.dimensions || '',
      price: plot.price != null ? String(plot.price) : '',
      roadWidth: plot.roadWidth || '30 ft Road',
      plotType: plot.type || 'Residential Plot',
      surveyNo: plot.surveyNo || '',
      svgPath: plot.svgPath || '',
    })
    setFormError(null)
  }

  /** Save this phase's plots while keeping every other phase intact. */
  const persistPlots = async (updatedPhasePlots) => {
    const propId = property.id || property.projectId
    if (!propId) throw new Error('This property has no id, so plots cannot be saved.')

    let finalLayouts = null
    let allCombinedPlots = updatedPhasePlots

    if (layoutPhases) {
      const lists = phasePlotLists.map((list, idx) => (idx === activePhaseIndex ? updatedPhasePlots : list))
      finalLayouts = layoutPhases.map((l, idx) => {
        const list = lists[idx] || []
        const s = summarizePlotStatuses(list)
        return { ...l, plots: list, totalPlots: s.total, availablePlots: s.available }
      })
      allCombinedPlots = lists.flat()
    }

    const s = summarizePlotStatuses(allCombinedPlots)
    const patchPayload = {
      plots: allCombinedPlots,
      totalPlots: s.total,
      availablePlots: s.available,
      available: s.available,
      booked: s.booked,
      sold: s.sold,
      ...(finalLayouts ? { layouts: finalLayouts, phases: finalLayouts } : {}),
    }

    // updatePlot throws on a non-2xx response, so failures reach the form
    await updatePlot(propId, patchPayload)

    const layoutSlug = property.layoutSlug || slug
    if (layoutSlug) {
      try {
        await saveLayoutPlots(layoutSlug, allCombinedPlots)
      } catch (err) {
        console.warn('Layout collection sync failed:', err)
      }
    }

    onPropertyUpdated?.({ ...property, ...patchPayload })
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    const plotNo = form.plotNo.trim()
    if (!plotNo) {
      setFormError('Please enter a Plot Number.')
      return
    }
    // Boundary path is optional: 223 Somamangalam plots have none yet, and
    // their status/price must still be editable. They just don't draw on the map.
    // Only check when adding or renaming; a plot keeping its (duplicated) number can still be edited
    const keepsNumber = editingPlot && samePlotNo(editingPlot.plotNo, plotNo)
    const clash = !keepsNumber && plots.find((p) => samePlotNo(p.plotNo, plotNo) && p.uid !== editingUid)
    if (clash) {
      setFormError(`Plot ${plotNo} already exists in ${phaseName || 'this layout'}. Edit that plot or use a different number.`)
      return
    }

    try {
      setIsSubmitting(true)
      const c = cleanedPath ? computePathCentroid(cleanedPath) : null
      const [w, l] = form.dimensions.split(/x|×/i)
      const plotRecord = {
        plotNo,
        status: form.status,
        facing: form.facing,
        area: form.area.trim(),
        dimensions: form.dimensions.trim(),
        width: (w || '').trim(),
        length: (l || '').trim(),
        price: form.price.trim(),
        roadWidth: form.roadWidth.trim(),
        type: form.plotType,
        surveyNo: form.surveyNo.trim(),
        svgPath: cleanedPath,
        textX: c?.textX ?? null,
        textY: c?.textY ?? null,
        phase: phaseName,
        updatedAt: new Date().toISOString(),
      }

      const updatedPlotsList = editingPlot
        ? plots.map((p) => (p.uid === editingUid ? { ...p, ...plotRecord } : p))
        : [...plots, { id: `plot-${plotNo}`, uid: newPlotUid(phaseName, plotNo), ...plotRecord }]

      await persistPlots(updatedPlotsList)
      setPlots(updatedPlotsList)
      onShowToast?.(
        editingPlot ? `Plot ${plotNo} updated successfully!` : `Plot ${plotNo} added to ${property.name}!`,
        'success',
      )
      resetForm()
    } catch (err) {
      setFormError(err.message || 'Failed to save plot.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePlot = async (plot) => {
    if (!window.confirm(`Are you sure you want to delete Plot ${plot.plotNo}?`)) return
    try {
      const updatedPlotsList = plots.filter((p) => p.uid !== plot.uid)
      await persistPlots(updatedPlotsList)
      setPlots(updatedPlotsList)
      if (editingUid === plot.uid) resetForm()
      onShowToast?.(`Plot ${plot.plotNo} deleted successfully!`, 'info')
    } catch (err) {
      setFormError(`Failed to delete plot: ${err.message}`)
    }
  }

  const filteredPlots =
    filter === 'All' ? plots : plots.filter((p) => statusConfig(p.status).id === filter)

  return (
    <div
      className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage plots for ${property.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] sm:max-h-[94vh] flex flex-col overflow-hidden font-sans">
        {/* ── Top Header Bar ── */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex w-10 h-10 rounded-2xl bg-[#E2EDE8] text-[#0F3D2E] items-center justify-center shrink-0 border border-[#C8DED5] shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  Manage Plots — {property.name}
                </h3>
                {property.projectId && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                    {property.projectId}
                  </span>
                )}
                {property.type && (
                  <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E2EDE8] text-[#0F3D2E] border border-[#C8DED5] shrink-0">
                    {property.type}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {property.location || 'Chennai, Tamil Nadu'}
                <span className="hidden sm:inline"> • Configure interactive boundaries & plot specs</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={targetLayoutLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-[#E2EDE8] hover:bg-[#d1e4dc] text-[#0F3D2E] font-bold text-xs rounded-xl border border-[#C8DED5] shadow-2xs transition active:scale-[0.98]"
              title="Open full interactive layout in a new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Layout</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Phase Switcher Tabs */}
        {layoutPhases && layoutPhases.length > 1 && (
          <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-xs font-bold text-slate-500 mr-1 shrink-0">Select Phase:</span>
            {layoutPhases.map((phase, idx) => {
              const isActive = idx === activePhaseIndex
              const count = (phasePlotLists[idx] || []).length
              return (
                <button
                  key={phase.id || idx}
                  type="button"
                  onClick={() => setActivePhaseIndex(idx)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shrink-0 ${
                    isActive
                      ? 'bg-[#0F3D2E] text-white border-[#0F3D2E] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{phase.name || `Phase ${idx + 1}`}</span>
                  <span
                    className={`text-[10px] px-1.5 rounded-full font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count} {count === 1 ? 'plot' : 'plots'}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Modal Body ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 bg-slate-50/50">
          {/* LEFT: layout preview & configured plots */}
          <div className="lg:col-span-7 flex flex-col gap-4 min-w-0">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
                    Plot Layout Blueprint
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-slate-600">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                      className="p-1.5 hover:text-slate-900 rounded"
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono px-1 font-bold">{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
                      className="p-1.5 hover:text-slate-900 rounded"
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className="p-1.5 hover:text-slate-900 rounded"
                      aria-label="Reset zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <a
                    href={targetLayoutLink}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden sm:inline-flex text-xs font-bold text-[#0F3D2E] hover:text-[#B8964E] hover:underline items-center gap-1"
                  >
                    <span>Full Layout</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Layout frame: scrolls when zoomed so every plot stays reachable */}
              <div className="relative w-full h-64 sm:h-80 lg:h-96 bg-slate-100 border border-slate-200 rounded-xl overflow-auto">
                {layoutBackgroundUrl || plots.some((p) => p.svgPath) ? (
                  <div
                    className="relative"
                    style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: '100%', minHeight: '100%' }}
                  >
                    {layoutBackgroundUrl && !layoutImgFailed && (
                      <img
                        src={layoutBackgroundUrl}
                        alt={`${property.name} layout`}
                        decoding="async"
                        onError={() => setLayoutImgFailed(true)}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                      />
                    )}

                    <svg
                      viewBox={activeViewBox}
                      preserveAspectRatio="xMidYMid meet"
                      className="absolute inset-0 w-full h-full"
                      role="group"
                      aria-label="Plot boundaries"
                    >
                      {plots
                        .filter((p) => p.svgPath && String(p.svgPath).trim())
                        .map((p) => {
                          const cfg = statusConfig(p.status)
                          const isActive = hoveredPlot?.uid === p.uid || editingUid === p.uid
                          return (
                            <g
                              key={p.uid}
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredPlot(p)}
                              onMouseLeave={() => setHoveredPlot(null)}
                              onClick={() => handleEditClick(p)}
                            >
                              <path
                                d={p.svgPath}
                                fill={cfg.bg}
                                fillOpacity={isActive ? 0.92 : 0.72}
                                stroke={cfg.color}
                                strokeWidth={isActive ? 2 : 0.85}
                                style={{ vectorEffect: 'non-scaling-stroke' }}
                              />
                              {p.textX != null && p.textY != null && (
                                <text
                                  x={p.textX}
                                  y={p.textY}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fill="#0F172A"
                                  fontSize="8.5"
                                  fontWeight="700"
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {p.plotNo}
                                </text>
                              )}
                            </g>
                          )
                        })}
                    </svg>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-2">
                    <Layers className="w-8 h-8 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">No layout blueprint uploaded yet</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      You can still add plots with their boundary paths. Upload an SVG blueprint via property edit.
                    </p>
                  </div>
                )}

                {layoutBackgroundUrl && layoutImgFailed && (
                  <div className="absolute bottom-2 left-2 right-2 sm:right-auto bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Layout file is missing on the server. Re-upload it from Edit Property.
                  </div>
                )}

                {hoveredPlot && (
                  <div className="sticky top-3 left-3 inline-flex bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg pointer-events-none items-center gap-2 z-20 m-3">
                    <span className="font-bold">Plot {hoveredPlot.plotNo}</span>
                    {hoveredPlot.area && (
                      <>
                        <span>•</span>
                        <span>{hoveredPlot.area}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="text-emerald-300 font-bold">{hoveredPlot.status}</span>
                  </div>
                )}
              </div>

              {/* Status filter pills */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['All', 'Available', 'Booked', 'Sold', 'Blocked'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilter(st)}
                      aria-pressed={filter === st}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        filter === st
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      {st} ({counts[st] || 0})
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {plots.length} demarcated {plots.length === 1 ? 'plot' : 'plots'}
                </span>
              </div>
            </div>

            {/* Configured plots table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Configured Plots ({filteredPlots.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Click a plot to edit</span>
              </div>

              {filteredPlots.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-600">No plots found</p>
                  <p className="text-[11px] text-slate-400">
                    Use the form to add the first plot for this {phaseName ? 'phase' : 'property'}.
                  </p>
                </div>
              ) : (
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-5">
                      <tr>
                        <th className="py-2 px-3">Plot #</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 hidden sm:table-cell">Facing & Area</th>
                        <th className="py-2 px-3 hidden sm:table-cell">Price</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPlots.map((p) => {
                        const cfg = statusConfig(p.status)
                        const isCurrent = editingUid === p.uid
                        return (
                          <tr
                            key={p.uid}
                            className={`transition cursor-pointer ${isCurrent ? 'bg-[#E2EDE8]/60' : 'hover:bg-slate-50/80'}`}
                            onClick={() => handleEditClick(p)}
                          >
                            <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">Plot {p.plotNo}</td>
                            <td className="py-2 px-3">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.color }}
                              >
                                {p.status || 'Available'}
                              </span>
                            </td>
                            <td className="py-2 px-3 hidden sm:table-cell">
                              <div className="font-semibold text-slate-800">{p.facing || 'East'}</div>
                              <div className="text-[10px] text-slate-400">{p.area || p.dimensions}</div>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900 hidden sm:table-cell">
                              {p.price || 'Price on Request'}
                            </td>
                            <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(p)}
                                  className="p-1.5 text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8] rounded-lg transition"
                                  aria-label={`Edit plot ${p.plotNo}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePlot(p)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  aria-label={`Delete plot ${p.plotNo}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: add / edit form */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    {editingPlot ? `Edit Plot ${editingPlot.plotNo}` : 'Add New Plot'}
                    {phaseName && <span className="text-slate-400 font-semibold"> · {phaseName}</span>}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {editingPlot
                      ? 'Modify dimensions, pricing, facing, or path data'
                      : 'Define plot boundaries, dimensions, and facing'}
                  </p>
                </div>
                {editingPlot && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
                  >
                    + New
                  </button>
                )}
              </div>

              {formError && (
                <div role="alert" className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <form id="plot-editor-form" onSubmit={handleFormSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pm-plotno" className="block text-xs font-bold text-slate-700 mb-1">
                      Plot Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="pm-plotno"
                      type="text"
                      required
                      value={form.plotNo}
                      onChange={setField('plotNo')}
                      placeholder="e.g. 1"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="pm-status" className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                    <select
                      id="pm-status"
                      value={form.status}
                      onChange={setField('status')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer transition"
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st.id} value={st.id}>{st.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pm-facing" className="block text-xs font-bold text-slate-700 mb-1">Facing Direction</label>
                    <select
                      id="pm-facing"
                      value={form.facing}
                      onChange={setField('facing')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer transition"
                    >
                      {FACING_OPTIONS.map((f) => (
                        <option key={f} value={f}>{f} Facing</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pm-area" className="block text-xs font-bold text-slate-700 mb-1">Area (sq.ft)</label>
                    <input
                      id="pm-area"
                      type="text"
                      value={form.area}
                      onChange={setField('area')}
                      placeholder="e.g. 1200 sq.ft"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pm-dims" className="block text-xs font-bold text-slate-700 mb-1">Dimensions</label>
                    <input
                      id="pm-dims"
                      type="text"
                      value={form.dimensions}
                      onChange={setField('dimensions')}
                      placeholder={'e.g. 30\'0" x 40\'0"'}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="pm-price" className="block text-xs font-bold text-slate-700 mb-1">Price</label>
                    <input
                      id="pm-price"
                      type="text"
                      value={form.price}
                      onChange={setField('price')}
                      placeholder="e.g. ₹ 42.00 Lakhs"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pm-road" className="block text-xs font-bold text-slate-700 mb-1">Road Width</label>
                    <input
                      id="pm-road"
                      type="text"
                      value={form.roadWidth}
                      onChange={setField('roadWidth')}
                      placeholder="e.g. 30 ft Road"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="pm-type" className="block text-xs font-bold text-slate-700 mb-1">Plot Type</label>
                    <select
                      id="pm-type"
                      value={form.plotType}
                      onChange={setField('plotType')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer transition"
                    >
                      {(PLOT_TYPES.includes(form.plotType) ? PLOT_TYPES : [form.plotType, ...PLOT_TYPES]).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label htmlFor="pm-path" className="block text-xs font-bold text-slate-700">
                      SVG Path Boundary (<code className="font-mono text-[#0F3D2E] font-semibold">d="..."</code>)
                    </label>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">Paste path or &lt;path&gt; tag</span>
                  </div>
                  <textarea
                    id="pm-path"
                    rows={3}
                    value={form.svgPath}
                    onChange={setField('svgPath')}
                    placeholder="e.g. M 702.90862 324.75473 60.6439 -0.93659 v 46.36098 h -60.6439 l -0.23415 -45.19024 z"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white resize-y transition"
                  />
                  {!cleanedPath && (
                    <p className="mt-1 text-[11px] text-amber-700 font-medium">
                      No boundary yet: this plot is saved but won&apos;t appear on the layout map.
                    </p>
                  )}
                </div>

                {cleanedPath && centroid && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
                      <svg
                        viewBox={`${centroid.minX - 10} ${centroid.minY - 10} ${Math.max(centroid.maxX - centroid.minX + 20, 30)} ${Math.max(centroid.maxY - centroid.minY + 20, 30)}`}
                        className="w-full h-full"
                        aria-hidden="true"
                      >
                        <path d={cleanedPath} fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
                        <circle cx={centroid.textX} cy={centroid.textY} r="7" fill="#0284C7" />
                        <text
                          x={centroid.textX}
                          y={centroid.textY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          fontSize="7"
                          fontWeight="bold"
                        >
                          {form.plotNo || '1'}
                        </text>
                      </svg>
                    </div>
                    <div className="text-[11px] text-slate-500 min-w-0">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Valid SVG Boundary Path</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5 truncate">
                        Centroid: X={centroid.textX}, Y={centroid.textY}
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              {editingPlot && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                form="plot-editor-form"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Saving to Database...</span>
                ) : editingPlot ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Update Plot {editingPlot.plotNo}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Plot to Property</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
