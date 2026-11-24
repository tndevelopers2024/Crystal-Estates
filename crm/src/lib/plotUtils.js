import { getApiUrl } from './api'

/**
 * Derive a clean layout slug from a slug, filename or layout URL.
 *   "/plots/layout-ozhalai_panchayath_layout_editable-1794467980605.svg"
 *     -> "ozhalai_panchayath_layout_editable"
 *   "kolapakkam-layout.svg" -> "kolapakkam"
 */
export function canonicalLayoutSlug(value) {
  if (!value || typeof value !== 'string') return ''
  let s = value.trim()
  try {
    s = decodeURIComponent(s)
  } catch {
    /* keep raw */
  }
  s = s.split('?')[0].split('#')[0]
  s = s.substring(s.lastIndexOf('/') + 1)
  s = s.replace(/\.svg$/i, '')
  s = s.replace(/^layout-/i, '')
  s = s.replace(/-layout$/i, '')
  s = s.replace(/-\d{10,}$/, '')
  return s
}

/**
 * Uploaded layouts and plot images live on the API server. Relative
 * "/plots/…" and "/images/plots/…" paths are resolved against it so they
 * also work when the CRM is deployed separately.
 */
export function resolveMediaUrl(src) {
  if (!src || typeof src !== 'string') return ''
  if (/^(https?:|data:|blob:)/i.test(src)) return src
  const clean = src.startsWith('/') ? src : `/${src}`
  if (/^\/(plots|images\/plots|uploads|documents)\//i.test(clean)) return getApiUrl(clean)
  return clean
}

const normalizeStatus = (s) => String(s || 'Available').trim().toLowerCase()

/** Plot-status summary computed from the actual plot list. */
export function summarizePlotStatuses(plots = []) {
  const summary = { total: 0, available: 0, booked: 0, sold: 0, blocked: 0 }
  for (const p of plots) {
    summary.total += 1
    const st = normalizeStatus(p.status)
    if (st === 'available') summary.available += 1
    else if (st === 'booked' || st === 'reserved') summary.booked += 1
    else if (st === 'sold' || st === 'registered') summary.sold += 1
    else if (st === 'blocked') summary.blocked += 1
  }
  return summary
}

/** True when two plot numbers refer to the same plot label. */
export function samePlotNo(a, b) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
}

/**
 * Plot numbers and `id`s are not unique in existing data (e.g. Somamangalam
 * has two plots labelled "8(7A)", and ids repeat across phases). Every plot
 * gets a stable `uid` so selecting, editing and deleting target exactly one.
 */
export function ensurePlotUids(plots = []) {
  const used = new Set()
  return plots.map((p, idx) => {
    let uid = p.uid ? String(p.uid) : ''
    if (!uid || used.has(uid)) {
      const base = `${p.phase || 'plot'}-${p.plotNo ?? p.id ?? idx}`
        .toLowerCase()
        .replace(/[^a-z0-9()_-]+/g, '-')
      uid = base
      let n = 1
      while (used.has(uid)) {
        uid = `${base}-${n}`
        n += 1
      }
    }
    used.add(uid)
    return uid === p.uid ? p : { ...p, uid }
  })
}

/** New unique uid for a freshly added plot. */
export function newPlotUid(phaseName, plotNo) {
  const rand = Math.random().toString(36).slice(2, 7)
  return `${phaseName || 'plot'}-${plotNo}-${Date.now().toString(36)}${rand}`
    .toLowerCase()
    .replace(/[^a-z0-9()_-]+/g, '-')
}

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

/**
 * Plots belonging to one phase. The property-level `plots` array is the
 * source of truth (every save writes it); `layouts[i].plots` is a fallback
 * for older records.
 */
export function plotsForPhase(property, phase, phaseIndex, phaseCount) {
  const all = Array.isArray(property?.plots) ? property.plots : []
  if (!phase) return all
  const phaseName = (phase.name || `Phase ${phaseIndex + 1}`).trim()

  const tagged = all.filter((p) => p.phase && sameName(p.phase, phaseName))
  if (tagged.length > 0) return tagged

  // Untagged plots belong to the first phase of a single-phase project
  const untagged = all.filter((p) => !p.phase)
  if (untagged.length > 0 && (phaseCount === 1 || phaseIndex === 0)) return untagged

  return Array.isArray(phase.plots) ? phase.plots : []
}

/**
 * Parse Indian price text into rupees: 4200000, "42,00,000", "₹ 42.00 Lakhs", "1.2 Cr".
 * Returns null when no number is present.
 */
export function parseRupees(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const s = String(value).toLowerCase().replace(/,/g, '')
  const m = s.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  let n = parseFloat(m[1])
  if (/\bcr|crore/.test(s)) n *= 10000000
  else if (/lakh|lac|\bl\b/.test(s)) n *= 100000
  return Math.round(n)
}

export function formatRupees(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—'
  return `₹${Math.round(Number(n)).toLocaleString('en-IN')}`
}

/** Same as summarizePlotStatuses but returns the plot's display group. */
export function statusGroup(status) {
  const s = String(status || 'Available').trim().toLowerCase()
  if (s === 'booked' || s === 'reserved') return 'Booked'
  if (s === 'sold' || s === 'registered') return 'Sold'
  if (s === 'blocked') return 'Blocked'
  return 'Available'
}

/**
 * Every plot of a property, phase-tagged with the same uids the Plots page
 * uses (uids are made per phase), so documents uploaded from any screen line
 * up with the plot's own details.
 */
export function plotsOfProperty(property) {
  const phases =
    Array.isArray(property?.layouts) && property.layouts.length > 0
      ? property.layouts
      : Array.isArray(property?.phases) && property.phases.length > 0
        ? property.phases
        : null
  if (!phases) return ensurePlotUids(Array.isArray(property?.plots) ? property.plots : [])
  return phases.flatMap((ph, i) => {
    const name = (ph.name || `Phase ${i + 1}`).trim()
    return ensurePlotUids(plotsForPhase(property, ph, i, phases.length).map((p) => ({ ...p, phase: name })))
  })
}
