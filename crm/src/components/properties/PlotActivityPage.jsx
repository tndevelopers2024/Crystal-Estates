import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  Building2,
  Calendar,
  ChevronDown,
  Compass,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Search,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { fetchPlotActivity, fetchPlotActivitySummary, addPlotActivity, exportPlotActivityExcel } from '../../lib/api'
import { ensurePlotUids, formatRupees, plotsForPhase, statusGroup } from '../../lib/plotUtils'
import { useAuth } from '../../context/AuthContext'

const STATUS_BADGE = {
  Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Booked: 'bg-amber-50 text-amber-800 border-amber-200',
  Sold: 'bg-rose-50 text-rose-700 border-rose-200',
  Blocked: 'bg-slate-100 text-slate-700 border-slate-200',
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All activity' },
  { id: 'visits', label: 'Customer visits' },
  { id: 'payments', label: 'Payments' },
  { id: 'changes', label: 'Status & details' },
  { id: 'documents', label: 'Documents' },
  { id: 'leads', label: 'Leads & bookings' },
]

function formatDateTime(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getLayoutPhases(property) {
  if (Array.isArray(property?.layouts) && property.layouts.length > 0) return property.layouts
  if (Array.isArray(property?.phases) && property.phases.length > 0) return property.phases
  return null
}

function classifyActivity(item) {
  if (item._source === 'visit') return 'visits'
  if (item._source === 'legacyPayment' || item.type === 'payment') return 'payments'
  if (item.type === 'document') return 'documents'
  if (item._source === 'lead' || item.type === 'booking') return 'leads'
  return 'changes'
}

function itemBadge(category) {
  switch (category) {
    case 'visits':
      return { label: 'Site Visit', cls: 'bg-sky-50 text-sky-700 border-sky-200', Icon: Compass }
    case 'payments':
      return { label: 'Payment', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CreditCard }
    case 'documents':
      return { label: 'Document', cls: 'bg-purple-50 text-purple-700 border-purple-200', Icon: FileText }
    case 'leads':
      return { label: 'Lead / Booking', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Users }
    default:
      return { label: 'Plot Update', cls: 'bg-slate-100 text-slate-700 border-slate-200', Icon: History }
  }
}

export default function PlotActivityPage({ properties = [], loading = false, onShowToast }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, can } = useAuth()
  const canEdit = can('properties', 'edit')

  const initialProjParam = searchParams.get('project') || ''
  const initialPlotParam = searchParams.get('plot') || ''

  const [selectedPropId, setSelectedPropId] = useState(initialProjParam)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [selectedPlotUid, setSelectedPlotUid] = useState(initialPlotParam)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [onlyWithActivity, setOnlyWithActivity] = useState(false)
  const [categoryTab, setCategoryTab] = useState('all')

  const [summaryMap, setSummaryMap] = useState(new Map())
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [history, setHistory] = useState({
    activities: [],
    legacyPayments: [],
    relatedLeads: [],
    relatedVisits: [],
    documents: [],
    booking: null,
  })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [checkedUids, setCheckedUids] = useState(() => new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Default to first available project
  useEffect(() => {
    if (!properties.length) return
    const exists = properties.some((p) => p.id === selectedPropId || p.projectId === selectedPropId || p.slug === selectedPropId)
    if (!selectedPropId || !exists) {
      setSelectedPropId(properties[0].id || properties[0].projectId)
    }
  }, [properties, selectedPropId])

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropId || p.projectId === selectedPropId || p.slug === selectedPropId) || null,
    [properties, selectedPropId],
  )

  const propId = selectedProperty?.id || selectedProperty?.projectId || ''
  const layoutPhases = useMemo(() => getLayoutPhases(selectedProperty), [selectedProperty])
  const currentPhase = layoutPhases ? layoutPhases[phaseIdx] || layoutPhases[0] : null
  const phaseName = currentPhase?.name || ''

  const plots = useMemo(() => {
    if (!selectedProperty) return []
    const raw = currentPhase
      ? plotsForPhase(selectedProperty, currentPhase, phaseIdx, layoutPhases?.length || 1)
      : Array.isArray(selectedProperty.plots)
        ? selectedProperty.plots
        : []
    return ensurePlotUids(raw, phaseName).sort((a, b) =>
      String(a.plotNo || '').localeCompare(String(b.plotNo || ''), undefined, { numeric: true }),
    )
  }, [selectedProperty, currentPhase, phaseIdx, layoutPhases, phaseName])

  // Load project-wide activity summary counts
  const loadSummary = useCallback(async () => {
    if (!propId) return
    setSummaryLoading(true)
    try {
      const data = await fetchPlotActivitySummary({ propertyId: propId })
      const m = new Map()
      for (const row of data.summary || []) {
        if (row.plotUid) {
          const prev = m.get(row.plotUid) || { count: 0, lastAt: null }
          m.set(row.plotUid, {
            count: prev.count + row.count,
            lastAt: !prev.lastAt || new Date(row.lastAt) > new Date(prev.lastAt) ? row.lastAt : prev.lastAt,
          })
        }
        if (row.plotNo) {
          const key = `no:${String(row.phase || '').toLowerCase()}#${String(row.plotNo).trim().toLowerCase()}`
          const prev = m.get(key) || { count: 0, lastAt: null }
          m.set(key, {
            count: prev.count + row.count,
            lastAt: !prev.lastAt || new Date(row.lastAt) > new Date(prev.lastAt) ? row.lastAt : prev.lastAt,
          })
        }
      }
      setSummaryMap(m)
    } catch {
      setSummaryMap(new Map())
    } finally {
      setSummaryLoading(false)
    }
  }, [propId])

  useEffect(() => {
    setPhaseIdx(0)
    setSelectedPlotUid('')
    setCheckedUids(new Set())
    loadSummary()
  }, [propId, loadSummary])

  // Auto-select first plot if none selected
  useEffect(() => {
    if (!plots.length) return
    const valid = plots.some((p) => p.uid === selectedPlotUid || String(p.plotNo) === selectedPlotUid)
    if (!valid) {
      setSelectedPlotUid(plots[0].uid)
    }
  }, [plots, selectedPlotUid])

  const selectedPlot = useMemo(
    () => plots.find((p) => p.uid === selectedPlotUid || String(p.plotNo) === selectedPlotUid) || null,
    [plots, selectedPlotUid],
  )

  const activityInfoFor = useCallback(
    (p) => {
      const byUid = p.uid ? summaryMap.get(p.uid) : null
      const byNo = summaryMap.get(`no:${String(p.phase || phaseName || '').toLowerCase()}#${String(p.plotNo || '').trim().toLowerCase()}`)
      return byUid || byNo || { count: 0, lastAt: null }
    },
    [summaryMap, phaseName],
  )

  const filteredPlots = useMemo(() => {
    const q = search.trim().toLowerCase()
    return plots.filter((p) => {
      if (statusFilter !== 'All' && statusGroup(p.status) !== statusFilter) return false
      if (onlyWithActivity && activityInfoFor(p).count === 0) return false
      if (!q) return true
      return String(p.plotNo || '').toLowerCase().includes(q)
    })
  }, [plots, search, statusFilter, onlyWithActivity, activityInfoFor])

  // Load complete activity & history for the selected plot
  const loadPlotHistory = useCallback(async () => {
    if (!propId || !selectedPlot) return
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const data = await fetchPlotActivity({
        propertyId: propId,
        plotUid: selectedPlot.uid,
        plotNo: selectedPlot.plotNo,
        phase: selectedPlot.phase || phaseName,
        limit: 500,
      })
      setHistory({
        activities: data.activities || [],
        legacyPayments: data.legacyPayments || [],
        relatedLeads: data.relatedLeads || [],
        relatedVisits: data.relatedVisits || [],
        documents: data.documents || [],
        booking: data.booking || null,
      })
    } catch (err) {
      setHistoryError(err.message || 'Could not load plot history.')
    } finally {
      setHistoryLoading(false)
    }
  }, [propId, selectedPlot, phaseName])

  useEffect(() => {
    loadPlotHistory()
  }, [loadPlotHistory])

  // Merge all chronological events (newest first), deduplicated
  const timeline = useMemo(() => {
    const items = []
    const seenIds = new Set()

    for (const a of history.activities || []) {
      const id = a.id || `pa-${items.length}`
      if (seenIds.has(id)) continue
      seenIds.add(id)
      items.push({
        ...a,
        _id: id,
        _source: 'activity',
        _category: classifyActivity(a),
        _ts: new Date(a.createdAt || a.paidOn || 0).getTime(),
      })
    }

    for (const v of history.relatedVisits || []) {
      const id = `visit-${v.id}`
      if (seenIds.has(id)) continue
      seenIds.add(id)
      items.push({
        _id: id,
        _source: 'visit',
        _category: 'visits',
        _ts: new Date(v.createdAt || v.visitDate || 0).getTime(),
        title: `Site visit ${v.status || 'Scheduled'} — ${v.leadName || 'Visitor'}`,
        subtitle: [
          v.leadPhone,
          v.dateLabel || v.visitDate,
          v.visitTime,
          v.cabPickup ? 'Cab pickup requested' : null,
        ].filter(Boolean).join(' · '),
        note: v.notes || '',
        actor: v.assignedAgent || { name: v.source || 'Website / CRM' },
        createdAt: v.createdAt || v.visitDate,
      })
    }

    for (const lp of history.legacyPayments || []) {
      const id = `legpay-${lp.id}`
      if (seenIds.has(id)) continue
      seenIds.add(id)
      items.push({
        _id: id,
        _source: 'legacyPayment',
        _category: 'payments',
        _ts: new Date(lp.createdAt || lp.date || 0).getTime(),
        title: `Payment of ${formatRupees(lp.amount)} (${lp.status || 'Received'})`,
        subtitle: [lp.mode, lp.customerName, lp.referenceNo ? `Ref ${lp.referenceNo}` : null].filter(Boolean).join(' · '),
        note: lp.note || '',
        actor: { name: lp.leadName || 'CRM' },
        createdAt: lp.createdAt || lp.date,
      })
    }

    for (const ld of history.relatedLeads || []) {
      const id = `lead-${ld.id}`
      if (seenIds.has(id)) continue
      seenIds.add(id)
      items.push({
        _id: id,
        _source: 'lead',
        _category: 'leads',
        _ts: new Date(ld.updatedAt || ld.createdAt || 0).getTime(),
        title: `Lead: ${ld.name} (${ld.stage || 'new'})`,
        subtitle: [ld.phone, ld.email, ld.source, ld.followUpDate ? `Follow-up: ${ld.followUpDate}` : null].filter(Boolean).join(' · '),
        note: ld.notes || '',
        actor: { name: ld.source || 'CRM Lead' },
        createdAt: ld.updatedAt || ld.createdAt,
      })
    }

    items.sort((a, b) => b._ts - a._ts)
    if (categoryTab === 'all') return items
    return items.filter((it) => it._category === categoryTab)
  }, [history, categoryTab])

  const toggleCheckedPlot = (uid) => {
    setCheckedUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const handleExport = async (scope) => {
    if (!propId || exporting) return
    setExportOpen(false)
    setExporting(true)
    try {
      let plotUids = []
      let plotNos = []
      if (scope === 'single') {
        if (!selectedPlot) throw new Error('Select a plot first.')
        if (selectedPlot.uid) plotUids = [selectedPlot.uid]
        if (selectedPlot.plotNo) plotNos = [selectedPlot.plotNo]
      } else if (scope === 'selected') {
        const chosen = plots.filter((p) => checkedUids.has(p.uid))
        if (chosen.length === 0) throw new Error('Select at least one plot using the checkboxes.')
        plotUids = chosen.map((p) => p.uid).filter(Boolean)
        plotNos = chosen.map((p) => p.plotNo).filter(Boolean)
      }
      const file = await exportPlotActivityExcel({
        propertyId: propId,
        scope,
        phase: scope === 'project' ? '' : phaseName,
        plotUids,
        plotNos,
      })
      onShowToast?.(`Exported ${file}`, 'success')
    } catch (err) {
      onShowToast?.(err.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim() || !selectedPlot || !propId) return
    setSavingNote(true)
    try {
      await addPlotActivity({
        propertyId: propId,
        propertyName: selectedProperty?.name || '',
        phase: selectedPlot.phase || phaseName,
        plotUid: selectedPlot.uid,
        plotNo: selectedPlot.plotNo,
        type: 'note',
        note: noteText.trim(),
        actor: user ? { name: user.name, email: user.email } : undefined,
      })
      setNoteText('')
      onShowToast?.('Activity note recorded', 'success')
      await Promise.all([loadPlotHistory(), loadSummary()])
    } catch (err) {
      onShowToast?.(err.message || 'Could not add note', 'error')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Project Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F3D2E] uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Audit & Timeline</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Project Plot Activity & History</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track status changes, dimension updates, site visits, payments, documents, and customer leads for every plot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-[#0F3D2E] shrink-0" />
            <select
              value={propId}
              onChange={(e) => {
                const nextId = e.target.value
                setSelectedPropId(nextId)
                setSearchParams({ project: nextId })
              }}
              aria-label="Select project"
              className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none min-w-[180px]"
              disabled={loading || properties.length === 0}
            >
              {properties.length === 0 ? (
                <option value="">{loading ? 'Loading projects…' : 'No projects found'}</option>
              ) : (
                properties.map((p) => (
                  <option key={p.id || p.projectId} value={p.id || p.projectId}>
                    {p.name || p.projectName}
                  </option>
                ))
              )}
            </select>
          </div>

          {propId && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                disabled={exporting || plots.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl shadow-2xs transition disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span>{exporting ? 'Exporting…' : 'Export to Excel'}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-30">
                    <button
                      type="button"
                      disabled={!selectedPlot}
                      onClick={() => handleExport('single')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold text-slate-800">
                        {selectedPlot ? `Export Plot ${selectedPlot.plotNo}` : 'Export current plot'}
                      </span>
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      disabled={checkedUids.size === 0}
                      onClick={() => handleExport('selected')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold text-slate-800">
                        Export selected plots ({checkedUids.size})
                      </span>
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => handleExport('project')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-bold text-[#0F3D2E]">
                        Export entire project
                      </span>
                      <Download className="w-3.5 h-3.5 text-[#0F3D2E]" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {propId && (
            <Link
              to={`/properties/${encodeURIComponent(propId)}/plots`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-[#0F3D2E] text-slate-700 hover:text-[#0F3D2E] text-xs font-bold rounded-xl transition no-underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Manage plots
            </Link>
          )}
        </div>
      </div>

      {/* Phase Tabs */}
      {layoutPhases && layoutPhases.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {layoutPhases.map((ph, i) => (
            <button
              key={ph.id || i}
              type="button"
              onClick={() => {
                setPhaseIdx(i)
                setSelectedPlotUid('')
              }}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                i === phaseIdx
                  ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              {ph.name || `Phase ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Main Split Layout: Plot List (left) + Timeline (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        {/* Left: Plot Selector */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-slate-100 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plot number…"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0F3D2E]"
                aria-label="Search plots"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['All', 'Available', 'Booked', 'Sold', 'Blocked'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded accent-[#0F3D2E]"
                  checked={onlyWithActivity}
                  onChange={(e) => setOnlyWithActivity(e.target.checked)}
                />
                <span>Only with activity</span>
              </label>
              {filteredPlots.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCheckedUids(new Set(filteredPlots.map((p) => p.uid)))}
                    className="font-bold text-[#0F3D2E] hover:underline"
                  >
                    Select all
                  </button>
                  {checkedUids.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setCheckedUids(new Set())}
                      className="font-semibold text-slate-500 hover:underline"
                    >
                      Clear ({checkedUids.size})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
            {filteredPlots.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                {summaryLoading ? 'Loading plots…' : 'No matching plots found.'}
              </p>
            ) : (
              filteredPlots.map((p) => {
                const st = statusGroup(p.status)
                const isSel = selectedPlot?.uid === p.uid
                const isChecked = checkedUids.has(p.uid)
                const info = activityInfoFor(p)
                return (
                  <div
                    key={p.uid}
                    className={`w-full px-3.5 py-2.5 flex items-center gap-2.5 transition ${
                      isSel ? 'bg-[#E2EDE8]/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheckedPlot(p.uid)}
                      aria-label={`Select Plot ${p.plotNo} for export`}
                      className="w-4 h-4 rounded accent-[#0F3D2E] shrink-0 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedPlotUid(p.uid)}
                      className="flex-1 min-w-0 text-left flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">Plot {p.plotNo}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {[p.area, p.dimensions].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {info.count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0F3D2E]/10 text-[#0F3D2E]">
                            {info.count}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[st] || STATUS_BADGE.Available}`}>
                          {st}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })
            )}
          </div>
          <p className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
            Showing {filteredPlots.length} of {plots.length} plots
          </p>
        </section>

        {/* Right: Plot Details & Chronological Activity Log */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-w-0">
          {!selectedPlot ? (
            <div className="p-12 text-center">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Select a plot to view its activity</p>
            </div>
          ) : (
            <>
              {/* Plot Summary Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">Plot {selectedPlot.plotNo}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_BADGE[statusGroup(selectedPlot.status)]}`}>
                      {selectedPlot.status || 'Available'}
                    </span>
                    {phaseName && (
                      <span className="text-xs font-semibold text-slate-500">· {phaseName}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {[
                      selectedPlot.area,
                      selectedPlot.dimensions,
                      selectedPlot.facing ? `${selectedPlot.facing} facing` : null,
                      history.booking?.buyerName ? `Buyer: ${history.booking.buyerName}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    loadPlotHistory()
                    loadSummary()
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-[#0F3D2E] text-xs font-bold text-slate-700 rounded-xl shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Category Tabs */}
              <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {CATEGORY_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCategoryTab(t.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      categoryTab === t.id
                        ? 'bg-[#0F3D2E] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Quick Note Form (edit permission only) */}
              {canEdit && (
                <form onSubmit={handleAddNote} className="px-4 sm:px-5 py-3 border-b border-slate-100 flex gap-2 bg-white">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add an activity note for this plot…"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0F3D2E]"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !noteText.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-3.5 h-3.5" />}
                    Add note
                  </button>
                </form>
              )}

              {/* Timeline Content */}
              <div className="p-4 sm:p-5">
                {historyLoading ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading plot activity…
                  </div>
                ) : historyError ? (
                  <p className="text-xs text-rose-600 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> {historyError}
                  </p>
                ) : timeline.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No recorded activity in this category for Plot {selectedPlot.plotNo} yet.
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {timeline.map((item) => {
                      const { label, cls, Icon } = itemBadge(item._category)
                      return (
                        <li key={item._id} className="rounded-xl border border-slate-200/80 p-3.5 bg-white hover:border-slate-300 transition">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className={`w-8 h-8 rounded-lg border grid place-items-center shrink-0 ${cls}`}>
                                <Icon className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
                                    {label}
                                  </span>
                                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                                </div>
                                {item.subtitle && (
                                  <p className="text-xs text-slate-600 mt-1">{item.subtitle}</p>
                                )}
                                {item.type === 'payment' && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    {[
                                      item.amount ? formatRupees(item.amount) : null,
                                      item.status,
                                      item.mode,
                                      item.referenceNo ? `Ref ${item.referenceNo}` : null,
                                      item.paidOn ? `Paid ${item.paidOn}` : null,
                                    ].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                                {item.note && (
                                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                                    {item.note}
                                  </p>
                                )}
                                {Array.isArray(item.changes) && item.changes.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {item.changes.map((c, idx) => (
                                      <span key={`${c.field}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                                        <strong className="font-semibold">{c.label || c.field}:</strong>
                                        <span className="line-through text-slate-400">{c.from || '—'}</span>
                                        <span>→</span>
                                        <span className="font-bold text-[#0F3D2E]">{c.to || '—'}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[11px] font-semibold text-slate-600 flex items-center justify-end gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatDateTime(item.createdAt)}
                              </p>
                              {item.actor?.name && (
                                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                                  <User className="w-3 h-3" />
                                  {item.actor.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}

                {/* Attached Documents Quick Summary */}
                {history.documents?.length > 0 && (categoryTab === 'all' || categoryTab === 'documents') && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Current Documents ({history.documents.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {history.documents.map((d) => (
                        <span key={d.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900">
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                          <strong>{d.label}</strong>
                          <span className="text-[11px] text-purple-700">({d.name})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
