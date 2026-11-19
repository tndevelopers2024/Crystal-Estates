import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Layers,
  X,
  Check,
  Trash2,
  AlertCircle,
  User,
  Phone,
  Mail,
  CalendarDays,
  IndianRupee,
  History,
  FileText,
  Pencil,
  Wallet,
  Info,
  Loader2,
} from 'lucide-react'
import { computePathCentroid } from '../../lib/svgPathCentroid'
import { parseViewBox } from '../../lib/svgUtils'
import {
  getClientUrl,
  updatePlot,
  saveLayoutPlots,
  fetchPlotActivity,
  addPlotActivity,
  fetchPlotBookings,
  savePlotBooking,
} from '../../lib/api'
import {
  canonicalLayoutSlug,
  resolveMediaUrl,
  summarizePlotStatuses,
  ensurePlotUids,
  newPlotUid,
  plotsForPhase,
  samePlotNo,
  parseRupees,
  formatRupees,
  statusGroup,
} from '../../lib/plotUtils'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../context/DialogContext'

const STATUSES = [
  { id: 'Available', fill: '#67E8F9', stroke: '#0284C7', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'Booked', fill: '#FCD34D', stroke: '#B45309', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'Sold', fill: '#FCA5A5', stroke: '#DC2626', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'Blocked', fill: '#CBD5E1', stroke: '#475569', chip: 'bg-slate-100 text-slate-700 border-slate-200' },
]
const statusCfg = (s) => STATUSES.find((x) => x.id === statusGroup(s)) || STATUSES[0]

const FACINGS = ['East', 'North', 'West', 'South', 'North-East', 'North-West', 'South-East', 'South-West']
const PLOT_TYPES = ['Residential Plot', 'Commercial Plot', 'Corner Plot', 'Villa Plot', 'Farm Land', 'Industrial Plot']
const PAYMENT_MODES = ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Demand draft', 'Home loan disbursal']

const inputCls =
  'w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

function cleanPathData(raw) {
  if (!raw) return ''
  const t = raw.trim()
  const m = t.match(/d=["']([^"']+)["']/i)
  if (m && m[1]) return m[1].trim()
  return t.replace(/^d=/, '').replace(/^["']|["']$/g, '').trim()
}

function getLayoutPhases(property) {
  if (Array.isArray(property?.layouts) && property.layouts.length > 0) return property.layouts
  if (Array.isArray(property?.phases) && property.phases.length > 0) return property.phases
  return null
}

const formatDateTime = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function StatusChip({ status }) {
  const cfg = statusCfg(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.chip}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.stroke }} />
      {status || 'Available'}
    </span>
  )
}

/* ─────────────────────────── Layout map ─────────────────────────── */
function LayoutMap({ plots, viewBox, backgroundUrl, selectedUid, onSelect, highlight }) {
  const [zoom, setZoom] = useState(1)
  const [imgFailed, setImgFailed] = useState(false)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    setImgFailed(false)
    setZoom(1)
  }, [backgroundUrl])

  const drawable = plots.filter((p) => p.svgPath && String(p.svgPath).trim())

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-[#0F3D2E] shrink-0" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">Layout map</span>
          <span className="hidden sm:inline text-[11px] text-slate-400 truncate">Click a plot to open it</span>
        </div>
        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-slate-600">
          <button type="button" onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} className="p-1.5 hover:text-slate-900 rounded" aria-label="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono px-1 font-bold w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))} className="p-1.5 hover:text-slate-900 rounded" aria-label="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setZoom(1)} className="p-1.5 hover:text-slate-900 rounded" aria-label="Reset zoom">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative h-[320px] sm:h-[420px] xl:h-[520px] bg-slate-50 overflow-auto no-scrollbar">
        {backgroundUrl || drawable.length > 0 ? (
          <div className="relative" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: '100%', minHeight: '100%' }}>
            {backgroundUrl && !imgFailed && (
              <img
                src={backgroundUrl}
                alt="Layout plan"
                decoding="async"
                onError={() => setImgFailed(true)}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              />
            )}
            <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" role="group" aria-label="Plots on layout">
              {drawable.map((p) => {
                const cfg = statusCfg(p.status)
                const isSel = p.uid === selectedUid
                const dim = highlight && !highlight.has(p.uid)
                return (
                  <g
                    key={p.uid}
                    className="cursor-pointer"
                    onClick={() => onSelect(p.uid)}
                    onMouseEnter={() => setHovered(p)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <path
                      d={p.svgPath}
                      fill={cfg.fill}
                      fillOpacity={dim ? 0.18 : isSel ? 0.95 : 0.7}
                      stroke={isSel ? '#0F3D2E' : cfg.stroke}
                      strokeWidth={isSel ? 2.5 : 0.8}
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
                        opacity={dim ? 0.35 : 1}
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
            <p className="text-sm font-semibold text-slate-600">No layout uploaded for this phase</p>
            <p className="text-xs text-slate-400 max-w-xs">Plots still work from the list. Upload a layout from Edit Property to see them on the map.</p>
          </div>
        )}

        {hovered && (
          <div className="sticky top-3 left-3 m-3 inline-flex items-center gap-2 bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg pointer-events-none z-10">
            <span className="font-bold">Plot {hovered.plotNo}</span>
            <span>•</span>
            <span>{hovered.status || 'Available'}</span>
            {hovered.booking?.buyerName && (
              <>
                <span>•</span>
                <span className="truncate max-w-[140px]">{hovered.booking.buyerName}</span>
              </>
            )}
          </div>
        )}

        {backgroundUrl && imgFailed && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Layout file is missing on the server. Re-upload it from Edit Property.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-500">
        {STATUSES.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border" style={{ background: s.fill, borderColor: s.stroke }} />
            {s.id}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── Plot list ─────────────────────────── */
function PlotList({ plots, selectedUid, onSelect }) {
  if (plots.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm font-semibold text-slate-600">No plots match</p>
        <p className="text-xs text-slate-400 mt-1">Try a different search or status filter.</p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {plots.map((p) => {
        const isSel = p.uid === selectedUid
        return (
          <li key={p.uid}>
            <button
              type="button"
              onClick={() => onSelect(p.uid)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${isSel ? 'bg-[#E2EDE8]' : 'hover:bg-slate-50'}`}
              aria-current={isSel ? 'true' : undefined}
            >
              <span className="w-12 shrink-0 text-sm font-bold text-slate-900">#{p.plotNo}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-slate-500 truncate">
                  {[p.area, p.facing && `${p.facing} facing`].filter(Boolean).join(' · ') || '—'}
                </span>
                {p.booking?.buyerName && (
                  <span className="block text-xs font-semibold text-slate-700 truncate">{p.booking.buyerName}</span>
                )}
              </span>
              <StatusChip status={p.status} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ─────────────────────────── History timeline ─────────────────────────── */
const TYPE_STYLE = {
  created: { icon: Plus, cls: 'bg-emerald-100 text-emerald-700' },
  deleted: { icon: Trash2, cls: 'bg-rose-100 text-rose-700' },
  status: { icon: Check, cls: 'bg-sky-100 text-sky-700' },
  booking: { icon: User, cls: 'bg-amber-100 text-amber-800' },
  payment: { icon: IndianRupee, cls: 'bg-emerald-100 text-emerald-700' },
  update: { icon: Pencil, cls: 'bg-slate-100 text-slate-700' },
  note: { icon: FileText, cls: 'bg-violet-100 text-violet-700' },
  document: { icon: FileText, cls: 'bg-indigo-100 text-indigo-700' },
}

function HistoryTimeline({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <History className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No history yet</p>
        <p className="text-xs text-slate-400 mt-1">Changes, bookings and payments made from now on appear here.</p>
      </div>
    )
  }
  return (
    <ol className="relative border-l-2 border-slate-100 ml-3 space-y-5">
      {entries.map((e) => {
        const style = TYPE_STYLE[e.type] || TYPE_STYLE.update
        const Icon = style.icon
        return (
          <li key={e.id} className="ml-5">
            <span className={`absolute -left-[13px] w-6 h-6 rounded-full grid place-items-center ring-4 ring-white ${style.cls}`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-semibold text-slate-900">{e.title}</p>
              <time className="text-[11px] text-slate-400">{formatDateTime(e.createdAt)}</time>
            </div>
            {e.type === 'payment' && (
              <p className="text-xs text-slate-600 mt-0.5">
                {[e.mode, e.referenceNo && `Ref ${e.referenceNo}`, e.paidOn && `Paid on ${e.paidOn}`].filter(Boolean).join(' · ')}
              </p>
            )}
            {e.note && <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{e.note}</p>}
            {Array.isArray(e.changes) && e.changes.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {e.changes.map((c, i) => (
                  <li key={i} className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">{c.label || c.field}:</span>{' '}
                    <span className="line-through text-slate-400">{c.from || '—'}</span> → <span>{c.to || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-400 mt-1">by {e.actor?.name || e.source || 'CRM user'}</p>
          </li>
        )
      })}
    </ol>
  )
}

/* ─────────────────────────── Plot detail panel ─────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'edit', label: 'Edit details', icon: Pencil },
  { id: 'booking', label: 'Booking', icon: User },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'history', label: 'History', icon: History },
]

const EMPTY_DETAILS = {
  plotNo: '',
  status: 'Available',
  facing: 'East',
  area: '',
  dimensions: '',
  price: '',
  roadWidth: '',
  type: 'Residential Plot',
  surveyNo: '',
  svgPath: '',
}

function PlotPanel({ property, plot, isNew, phaseName, existingPlots, onSavePlot, onDeletePlot, onBookingSaved, onClose, actor, onShowToast }) {
  const { confirm } = useDialog()
  const [tab, setTab] = useState(isNew ? 'edit' : 'overview')
  const [details, setDetails] = useState(EMPTY_DETAILS)
  const [booking, setBooking] = useState({})
  const [payment, setPayment] = useState({ amount: '', mode: 'Bank transfer', referenceNo: '', paidOn: new Date().toISOString().slice(0, 10), note: '' })
  const [note, setNote] = useState('')
  const [history, setHistory] = useState({ activities: [], legacyPayments: [], relatedLeads: [] })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const propId = property.id || property.projectId

  // Set tab when switching between plots or creating new plot
  useEffect(() => {
    setTab(isNew ? 'edit' : 'overview')
    setError(null)
  }, [plot?.uid, isNew])

  // Populate form state only when a different plot is selected or on new plot init
  useEffect(() => {
    if (isNew) {
      setDetails(EMPTY_DETAILS)
      setBooking({})
    } else if (plot) {
      setDetails({
        plotNo: String(plot.plotNo ?? ''),
        status: plot.status || 'Available',
        facing: plot.facing || 'East',
        area: plot.area || '',
        dimensions: plot.dimensions || '',
        price: plot.price != null ? String(plot.price) : '',
        roadWidth: plot.roadWidth || '',
        type: plot.type || 'Residential Plot',
        surveyNo: plot.surveyNo || '',
        svgPath: plot.svgPath || '',
      })
      setBooking({ ...(plot?.booking || {}) })
    }
  }, [plot?.uid, isNew])

  const plotUid = plot?.uid
  const plotNo = plot?.plotNo
  const plotPhase = plot?.phase

  const loadHistory = useCallback(async (showSpinner = false) => {
    if (isNew || !plotUid) return
    if (showSpinner) setHistoryLoading(true)
    try {
      const data = await fetchPlotActivity({ propertyId: propId, plotUid, plotNo, phase: plotPhase })
      setHistory({
        activities: data.activities || [],
        legacyPayments: data.legacyPayments || [],
        relatedLeads: data.relatedLeads || [],
      })
    } catch (err) {
      console.warn(err)
    } finally {
      if (showSpinner) setHistoryLoading(false)
    }
  }, [isNew, propId, plotUid, plotNo, plotPhase])

  useEffect(() => {
    loadHistory(true)
  }, [loadHistory])

  // Payment summary: log entries + legacy lead payments that mention this plot
  const payments = useMemo(() => {
    const logged = history.activities
      .filter((a) => a.type === 'payment')
      .map((a) => ({ id: a.id, amount: Number(a.amount) || 0, mode: a.mode, ref: a.referenceNo, date: a.paidOn || a.createdAt, by: a.actor?.name, note: a.note, source: 'Plot log' }))
    const legacy = history.legacyPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount) || 0,
      mode: p.mode,
      ref: p.referenceNo,
      date: p.date || p.createdAt,
      by: p.leadName,
      note: p.paymentFor,
      source: 'Lead payment',
    }))
    return [...logged, ...legacy].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [history])

  const agreed = parseRupees(booking.totalPrice) ?? parseRupees(plot?.booking?.totalPrice) ?? parseRupees(plot?.price)
  const received = payments.reduce((s, p) => s + p.amount, 0)
  const balance = agreed != null ? Math.max(agreed - received, 0) : null

  const save = async (nextPlot, successMsg) => {
    setError(null)
    setSaving(true)
    try {
      await onSavePlot(nextPlot)
      onShowToast?.(successMsg, 'success')
      await loadHistory(false)
      return true
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleDetailsSubmit = async (e) => {
    e.preventDefault()
    const plotNo = details.plotNo.trim()
    if (!plotNo) return setError('Plot number is required.')
    const keepsNumber = !isNew && samePlotNo(plot.plotNo, plotNo)
    if (!keepsNumber && existingPlots.some((p) => samePlotNo(p.plotNo, plotNo) && p.uid !== plot?.uid)) {
      return setError(`Plot ${plotNo} already exists in ${phaseName || 'this layout'}.`)
    }
    const path = cleanPathData(details.svgPath)
    const c = path ? computePathCentroid(path) : null
    const [w, l] = details.dimensions.split(/x|×/i)
    const base = isNew ? { id: `plot-${plotNo}`, uid: newPlotUid(phaseName, plotNo) } : plot
    const next = {
      ...base,
      ...details,
      plotNo,
      svgPath: path,
      width: (w || '').trim(),
      length: (l || '').trim(),
      textX: c?.textX ?? base.textX ?? null,
      textY: c?.textY ?? base.textY ?? null,
      phase: phaseName,
      updatedAt: new Date().toISOString(),
    }
    const ok = await save(next, isNew ? `Plot ${plotNo} added` : `Plot ${plotNo} updated`)
    if (ok && isNew) {
      setTab('overview')
    }
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    if (!String(booking.buyerName || '').trim()) return setError("Enter the buyer's name.")
    setError(null)
    setSaving(true)
    try {
      // Buyer details are stored privately (plot_bookings), not on public plot data
      const res = await savePlotBooking({
        propertyId: propId,
        propertyName: property.name,
        phase: plot.phase,
        plotUid: plot.uid,
        plotNo: plot.plotNo,
        booking,
        actor,
      })
      onBookingSaved?.(plot, res.booking)
      // A plot that gets a buyer is no longer available
      if (statusGroup(plot.status) === 'Available') {
        await onSavePlot({ ...plot, status: 'Booked', updatedAt: new Date().toISOString() })
      }
      onShowToast?.(`Booking saved for plot ${plot.plotNo}`, 'success')
      await loadHistory()
    } catch (err) {
      setError(err.message || 'Could not save the booking.')
    } finally {
      setSaving(false)
    }
  }

  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const amount = parseRupees(payment.amount)
    if (!amount || amount <= 0) return setError('Enter a valid payment amount.')
    setSaving(true)
    try {
      await addPlotActivity({
        propertyId: propId,
        propertyName: property.name,
        phase: plot.phase,
        plotUid: plot.uid,
        plotNo: plot.plotNo,
        type: 'payment',
        amount,
        mode: payment.mode,
        referenceNo: payment.referenceNo,
        paidOn: payment.paidOn,
        note: payment.note,
        actor,
      })
      setPayment((p) => ({ ...p, amount: '', referenceNo: '', note: '' }))
      onShowToast?.(`Payment of ${formatRupees(amount)} recorded`, 'success')
      await loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleNoteSubmit = async (e) => {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addPlotActivity({ propertyId: propId, propertyName: property.name, phase: plot.phase, plotUid: plot.uid, plotNo: plot.plotNo, type: 'note', note, actor })
      setNote('')
      await loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete Plot ${plot.plotNo}`,
      message: `Are you sure you want to delete Plot ${plot.plotNo}? Its dimensions, facing, and status will be removed, while historical activities remain in the log.`,
      tag: `Plot ${plot.plotNo} · ${plot.status || 'Available'}`,
      confirmText: 'Delete Plot',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    setSaving(true)
    try {
      await onDeletePlot(plot)
      onShowToast?.(`Plot ${plot.plotNo} deleted`, 'info')
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const setD = (k) => (e) => setDetails((d) => ({ ...d, [k]: e.target.value }))
  const setB = (k) => (e) => setBooking((b) => ({ ...b, [k]: e.target.value }))
  const setP = (k) => (e) => setPayment((p) => ({ ...p, [k]: e.target.value }))

  const visibleTabs = isNew ? TABS.filter((t) => t.id === 'edit') : TABS

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {property.name}
            {phaseName ? ` · ${phaseName}` : ''}
          </p>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            {isNew ? 'New plot' : `Plot ${plot.plotNo}`}
          </h2>
          {!isNew && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip status={plot.status} />
              {plot.booking?.buyerName && <span className="text-xs text-slate-600">Booked by <strong>{plot.booking.buyerName}</strong></span>}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl" aria-label="Close plot details">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 border-b border-slate-100 flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Plot sections">
        {visibleTabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.id)
                setError(null)
              }}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-3 text-xs font-bold border-b-2 transition ${
                active ? 'border-[#0F3D2E] text-[#0F3D2E]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Overview */}
        {tab === 'overview' && !isNew && (
          <>
            <dl className="grid grid-cols-2 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
              {[
                ['Area', plot.area],
                ['Dimensions', plot.dimensions],
                ['Facing', plot.facing],
                ['Road width', plot.roadWidth],
                ['Plot type', plot.type],
                ['Survey no.', plot.surveyNo],
                ['List price', plot.price || 'On request'],
                ['Balance due', balance != null ? formatRupees(balance) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-white p-3">
                  <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{k}</dt>
                  <dd className="text-sm font-semibold text-slate-900 mt-0.5 break-words">{v || '—'}</dd>
                </div>
              ))}
            </dl>

            {plot.booking?.buyerName && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">Booking</p>
                <p className="text-sm font-semibold text-slate-900">{plot.booking.buyerName}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {[plot.booking.phone, plot.booking.email, plot.booking.bookedOn && `Booked ${plot.booking.bookedOn}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent activity</p>
                <button type="button" onClick={() => setTab('history')} className="text-xs font-bold text-[#0F3D2E] hover:underline">
                  Full history
                </button>
              </div>
              {historyLoading ? (
                <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>
              ) : (
                <HistoryTimeline entries={history.activities.slice(0, 3)} />
              )}
            </div>
          </>
        )}

        {/* Edit details */}
        {tab === 'edit' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pp-no" className={labelCls}>Plot number *</label>
                <input id="pp-no" className={inputCls} value={details.plotNo} onChange={setD('plotNo')} required placeholder="e.g. 24" />
              </div>
              <div>
                <label htmlFor="pp-status" className={labelCls}>Status</label>
                <select id="pp-status" className={inputCls} value={statusGroup(details.status)} onChange={setD('status')}>
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pp-area" className={labelCls}>Area</label>
                <input id="pp-area" className={inputCls} value={details.area} onChange={setD('area')} placeholder="e.g. 1200 sq.ft" />
              </div>
              <div>
                <label htmlFor="pp-dims" className={labelCls}>Dimensions</label>
                <input id="pp-dims" className={inputCls} value={details.dimensions} onChange={setD('dimensions')} placeholder={'e.g. 30\' x 40\''} />
              </div>
              <div>
                <label htmlFor="pp-facing" className={labelCls}>Facing</label>
                <select id="pp-facing" className={inputCls} value={details.facing} onChange={setD('facing')}>
                  {FACINGS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pp-price" className={labelCls}>List price</label>
                <input id="pp-price" className={inputCls} value={details.price} onChange={setD('price')} placeholder="e.g. ₹ 42 Lakhs" />
              </div>
              <div>
                <label htmlFor="pp-road" className={labelCls}>Road width</label>
                <input id="pp-road" className={inputCls} value={details.roadWidth} onChange={setD('roadWidth')} placeholder="e.g. 30 ft" />
              </div>
              <div>
                <label htmlFor="pp-type" className={labelCls}>Plot type</label>
                <select id="pp-type" className={inputCls} value={details.type} onChange={setD('type')}>
                  {(PLOT_TYPES.includes(details.type) ? PLOT_TYPES : [details.type, ...PLOT_TYPES]).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pp-survey" className={labelCls}>Survey number</label>
                <input id="pp-survey" className={inputCls} value={details.surveyNo} onChange={setD('surveyNo')} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pp-path" className={labelCls}>Boundary on layout (SVG path, optional)</label>
                <textarea id="pp-path" rows={3} className={`${inputCls} font-mono text-xs`} value={details.svgPath} onChange={setD('svgPath')} placeholder='Paste the d="…" value or a full <path> tag' />
                {!cleanPathData(details.svgPath) && <p className="mt-1 text-[11px] text-amber-700">Without a boundary the plot is saved but not drawn on the map.</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {!isNew ? (
                <button type="button" onClick={handleDelete} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Delete plot
                </button>
              ) : <span />}
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-sm font-bold rounded-xl disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isNew ? 'Add plot' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {/* Booking */}
        {tab === 'booking' && !isNew && (
          <form onSubmit={handleBookingSubmit} className="space-y-4">
            {history.relatedLeads.length > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <p className="font-bold mb-1">Leads linked to this plot</p>
                <ul className="space-y-1">
                  {history.relatedLeads.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span><strong>{l.name}</strong> {l.phone && `· ${l.phone}`} · {l.stage}</span>
                      {!booking.buyerName && (
                        <button type="button" className="font-bold text-[#0F3D2E] hover:underline" onClick={() => setBooking((b) => ({ ...b, buyerName: l.name, phone: l.phone || '', email: l.email || '', leadId: l.id }))}>
                          Use as buyer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="pb-name" className={labelCls}>Buyer name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="pb-name" className={`${inputCls} pl-9`} value={booking.buyerName || ''} onChange={setB('buyerName')} required />
                </div>
              </div>
              <div>
                <label htmlFor="pb-phone" className={labelCls}>Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="pb-phone" type="tel" className={`${inputCls} pl-9`} value={booking.phone || ''} onChange={setB('phone')} />
                </div>
              </div>
              <div>
                <label htmlFor="pb-email" className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="pb-email" type="email" className={`${inputCls} pl-9`} value={booking.email || ''} onChange={setB('email')} />
                </div>
              </div>
              <div>
                <label htmlFor="pb-date" className={labelCls}>Booking date</label>
                <div className="relative">
                  <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="pb-date" type="date" className={`${inputCls} pl-9`} value={booking.bookedOn || ''} onChange={setB('bookedOn')} />
                </div>
              </div>
              <div>
                <label htmlFor="pb-total" className={labelCls}>Agreed total price</label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="pb-total" className={`${inputCls} pl-9`} value={booking.totalPrice || ''} onChange={setB('totalPrice')} placeholder="e.g. 4200000 or 42 Lakhs" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pb-notes" className={labelCls}>Booking notes</label>
                <textarea id="pb-notes" rows={3} className={inputCls} value={booking.notes || ''} onChange={setB('notes')} placeholder="Token terms, registration date, loan details…" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-sm font-bold rounded-xl disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save booking
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Saving a booking on an available plot marks it Booked. Every change is kept in History.</p>
          </form>
        )}

        {/* Payments */}
        {tab === 'payments' && !isNew && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Agreed price', agreed != null ? formatRupees(agreed) : 'Not set', 'text-slate-900'],
                ['Received', formatRupees(received), 'text-emerald-700'],
                ['Balance', balance != null ? formatRupees(balance) : '—', balance ? 'text-rose-700' : 'text-slate-900'],
              ].map(([k, v, cls]) => (
                <div key={k} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{k}</p>
                  <p className={`text-sm sm:text-base font-bold mt-0.5 ${cls}`}>{v}</p>
                </div>
              ))}
            </div>
            {agreed == null && (
              <p className="text-xs text-amber-700">Set the agreed price in the Booking tab (or a list price) to track the balance.</p>
            )}
            {agreed != null && agreed > 0 && (
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={agreed} aria-valuenow={Math.min(received, agreed)} aria-label="Amount received">
                <span className="block h-full bg-emerald-500" style={{ width: `${Math.min((received / agreed) * 100, 100)}%` }} />
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Record a payment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pm-amt" className={labelCls}>Amount *</label>
                  <input id="pm-amt" className={inputCls} value={payment.amount} onChange={setP('amount')} required placeholder="e.g. 500000" inputMode="decimal" />
                </div>
                <div>
                  <label htmlFor="pm-mode" className={labelCls}>Mode</label>
                  <select id="pm-mode" className={inputCls} value={payment.mode} onChange={setP('mode')}>
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="pm-ref" className={labelCls}>Reference no.</label>
                  <input id="pm-ref" className={inputCls} value={payment.referenceNo} onChange={setP('referenceNo')} />
                </div>
                <div>
                  <label htmlFor="pm-date" className={labelCls}>Paid on</label>
                  <input id="pm-date" type="date" className={inputCls} value={payment.paidOn} onChange={setP('paidOn')} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="pm-note" className={labelCls}>Note</label>
                  <input id="pm-note" className={inputCls} value={payment.note} onChange={setP('note')} placeholder="e.g. Token advance" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-sm font-bold rounded-xl disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add payment
                </button>
              </div>
            </form>

            <div>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Payments received ({payments.length})</p>
              {payments.length === 0 ? (
                <p className="text-xs text-slate-400">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {payments.map((p) => (
                    <li key={p.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{formatRupees(p.amount)}</p>
                        <p className="text-xs text-slate-500">{[p.mode, p.ref && `Ref ${p.ref}`, p.note].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-600">{typeof p.date === 'string' && p.date.length <= 12 ? p.date : formatDateTime(p.date)}</p>
                        <p className="text-[11px] text-slate-400">{p.source}{p.by ? ` · ${p.by}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* History */}
        {tab === 'history' && !isNew && (
          <>
            <form onSubmit={handleNoteSubmit} className="flex gap-2">
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to this plot's history…" aria-label="Note" />
              <button type="submit" disabled={saving || !note.trim()} className="shrink-0 px-4 bg-[#0F3D2E] text-white text-sm font-bold rounded-xl disabled:opacity-40">
                Add
              </button>
            </form>
            {historyLoading ? (
              <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history…</p>
            ) : (
              <HistoryTimeline entries={history.activities} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── Page ─────────────────────────── */
export default function PlotsPage({ property, onPropertyUpdated, onShowToast, onBack }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const actor = useMemo(() => ({ name: user?.name || user?.email || 'CRM user', email: user?.email || '' }), [user])

  const layoutPhases = useMemo(() => getLayoutPhases(property), [property])
  const [phaseIdx, setPhaseIdx] = useState(0)
  const currentPhase = layoutPhases ? layoutPhases[phaseIdx] || layoutPhases[0] : null
  const phaseName = currentPhase ? (currentPhase.name || `Phase ${phaseIdx + 1}`).trim() : undefined

  const phaseLists = useMemo(() => {
    if (!layoutPhases) return [ensurePlotUids(Array.isArray(property.plots) ? property.plots : [])]
    return layoutPhases.map((ph, i) =>
      ensurePlotUids(
        plotsForPhase(property, ph, i, layoutPhases.length).map((p) => ({ ...p, phase: (ph.name || `Phase ${i + 1}`).trim() })),
      ),
    )
  }, [property, layoutPhases])

  // Private booking records (buyer details), merged into plots for display only
  const [bookings, setBookings] = useState({})
  const propId = property.id || property.projectId
  useEffect(() => {
    let active = true
    fetchPlotBookings(propId)
      .then((data) => {
        if (active && data?.bookings) setBookings(data.bookings)
      })
      .catch((err) => console.warn(err))
    return () => {
      active = false
    }
  }, [propId])

  const bookingFor = useCallback(
    (p) => bookings[p.uid] || bookings[`${p.phase || ''}#${p.plotNo}`] || null,
    [bookings],
  )

  const plots = useMemo(
    () => (phaseLists[phaseIdx] || []).map((p) => {
      const b = bookingFor(p)
      return b ? { ...p, booking: b } : p
    }),
    [phaseLists, phaseIdx, bookingFor],
  )
  const [selectedUid, setSelectedUid] = useState(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    setSelectedUid(null)
    setCreating(false)
  }, [phaseIdx])

  const selected = plots.find((p) => p.uid === selectedUid) || null
  const summary = summarizePlotStatuses(plots)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return plots.filter((p) => {
      if (filter !== 'All' && statusGroup(p.status) !== filter) return false
      if (!q) return true
      return [p.plotNo, p.booking?.buyerName, p.booking?.phone, p.area, p.facing].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [plots, search, filter])

  const highlight = useMemo(
    () => (search.trim() || filter !== 'All' ? new Set(filtered.map((p) => p.uid)) : null),
    [filtered, search, filter],
  )

  const rawLayoutUrl = currentPhase?.layoutUrl || currentPhase?.layoutBackgroundUrl || property.layoutBackgroundUrl || property.layoutUrl || null
  const { viewBoxStr } = parseViewBox(currentPhase?.viewBox || property.viewBox || '0 0 1056 816', 1056, 816)
  const slug = canonicalLayoutSlug(property.layoutSlug) || canonicalLayoutSlug(property.layoutBackgroundUrl) || property.projectId || property.id
  const publicLink = getClientUrl(`/projects/${property.slug || property.id}`)

  /** Save this phase's list while keeping every other phase untouched. */
  const persist = useCallback(
    async (nextPhasePlotsRaw) => {
      // Never send buyer details with public plot data
      const nextPhasePlots = nextPhasePlotsRaw.map(({ booking, ...p }) => p)
      let finalLayouts = null
      let all = nextPhasePlots
      if (layoutPhases) {
        const lists = phaseLists.map((l, i) => (i === phaseIdx ? nextPhasePlots : l))
        finalLayouts = layoutPhases.map((l, i) => {
          const s = summarizePlotStatuses(lists[i] || [])
          return { ...l, plots: lists[i] || [], totalPlots: s.total, availablePlots: s.available }
        })
        all = lists.flat()
      }
      const s = summarizePlotStatuses(all)
      const payload = {
        plots: all,
        totalPlots: s.total,
        availablePlots: s.available,
        available: s.available,
        booked: s.booked,
        sold: s.sold,
        ...(finalLayouts ? { layouts: finalLayouts, phases: finalLayouts } : {}),
      }
      await updatePlot(propId, { ...payload, _actor: actor })
      const layoutSlug = property.layoutSlug || slug
      if (layoutSlug) {
        try {
          await saveLayoutPlots(layoutSlug, all)
        } catch (err) {
          console.warn('Layout collection sync failed:', err)
        }
      }
      onPropertyUpdated?.({ ...property, ...payload })
    },
    [property, propId, layoutPhases, phaseLists, phaseIdx, actor, slug, onPropertyUpdated],
  )

  const handleBookingSaved = (plot, booking) => {
    setBookings((prev) => ({ ...prev, [plot.uid || `${plot.phase || ''}#${plot.plotNo}`]: booking }))
  }

  const handleSavePlot = async (plot) => {
    const exists = plots.some((p) => p.uid === plot.uid)
    const next = exists ? plots.map((p) => (p.uid === plot.uid ? plot : p)) : [...plots, plot]
    await persist(next)
    setCreating(false)
    setSelectedUid(plot.uid)
  }

  const handleDeletePlot = async (plot) => {
    await persist(plots.filter((p) => p.uid !== plot.uid))
    setSelectedUid(null)
  }

  const panelOpen = Boolean(selected || creating)

  return (
    <div className="max-w-[1600px] mx-auto pb-10 space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={onBack} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#0F3D2E] hover:border-[#0F3D2E] shrink-0" aria-label="Back to properties">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400">Properties / Plots</p>
            <h1
              onClick={() => navigate(`/properties/edit/${encodeURIComponent(property.id || property.projectId)}`)}
              className="text-xl sm:text-2xl font-bold text-slate-900 hover:text-[#0F3D2E] tracking-tight truncate cursor-pointer transition"
              title="Click to edit project details"
            >
              {property.name}
            </h1>
            <p className="text-xs text-slate-500 truncate">{property.location}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/properties/edit/${encodeURIComponent(property.id || property.projectId)}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-[#0F3D2E] text-slate-700 hover:text-[#0F3D2E] text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
            title="Edit Project Details"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit project</span>
          </button>
          <a href={publicLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 text-xs font-bold rounded-xl shadow-2xs">
            <ExternalLink className="w-3.5 h-3.5" /> View on website
          </a>
          <button
            type="button"
            onClick={() => {
              setSelectedUid(null)
              setCreating(true)
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl"
          >
            <Plus className="w-4 h-4" /> Add plot
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['All', summary.total, 'text-slate-900'],
          ['Available', summary.available, 'text-sky-700'],
          ['Booked', summary.booked, 'text-amber-700'],
          ['Sold', summary.sold, 'text-rose-700'],
        ].map(([k, v, cls]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`text-left rounded-2xl border p-4 bg-white transition ${filter === k ? 'border-[#0F3D2E] ring-2 ring-[#0F3D2E]/10' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{k === 'All' ? 'Total plots' : k}</p>
            <p className={`text-2xl font-bold mt-1 ${cls}`}>{v}</p>
          </button>
        ))}
      </div>

      {/* Phase tabs */}
      {layoutPhases && layoutPhases.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {layoutPhases.map((ph, i) => (
            <button
              key={ph.id || i}
              type="button"
              onClick={() => setPhaseIdx(i)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                i === phaseIdx ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              {ph.name || `Phase ${i + 1}`} · {(phaseLists[i] || []).length}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <LayoutMap
            plots={plots}
            viewBox={viewBoxStr}
            backgroundUrl={resolveMediaUrl(rawLayoutUrl)}
            selectedUid={selectedUid}
            onSelect={(uid) => {
              setCreating(false)
              setSelectedUid(uid)
            }}
            highlight={highlight}
          />

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search plot no., buyer, phone…"
                  className={`${inputCls} pl-9`}
                  aria-label="Search plots"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {['All', 'Available', 'Booked', 'Sold', 'Blocked'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto no-scrollbar">
              <PlotList plots={filtered} selectedUid={selectedUid} onSelect={(uid) => { setCreating(false); setSelectedUid(uid) }} />
            </div>
            <p className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
              Showing {filtered.length} of {plots.length} plots{phaseName ? ` in ${phaseName}` : ''}
            </p>
          </div>
        </div>

        {/* Detail panel: sticky column on wide screens, full-screen sheet on smaller ones */}
        <aside
          className={`${panelOpen ? 'fixed inset-0 z-60 xl:static xl:z-auto' : 'hidden xl:block'} xl:sticky xl:top-4`}
          aria-label="Plot details"
        >
          <div className="h-full xl:h-[calc(100vh-2rem)] xl:rounded-2xl xl:border xl:border-slate-200 overflow-hidden bg-white shadow-xl xl:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {panelOpen ? (
              <PlotPanel
                key={creating ? 'new' : selectedUid}
                property={property}
                plot={creating ? null : selected}
                isNew={creating}
                phaseName={phaseName}
                existingPlots={plots}
                onSavePlot={handleSavePlot}
                onDeletePlot={handleDeletePlot}
                onBookingSaved={handleBookingSaved}
                onClose={() => {
                  setSelectedUid(null)
                  setCreating(false)
                }}
                actor={actor}
                onShowToast={onShowToast}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center">
                  <Layers className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">Select a plot</p>
                <p className="text-xs text-slate-500 max-w-[260px]">
                  Click a plot on the map or in the list to see its booking, payments, balance and full history.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
