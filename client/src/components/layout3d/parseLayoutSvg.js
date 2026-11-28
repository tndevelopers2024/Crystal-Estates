/**
 * Read a project's layout SVG and return the pieces the 3D view needs.
 * The SVG file itself is never modified.
 *
 * Expected structure (Somamangalam Phase 1 follows it):
 *   <g id="plots">        <path data-plot="214A" d="…"/> …
 *   <g id="plot-numbers"> <text x y>214A</text> …
 *   <g id="roads">        <path id="road-network" d="…"/>
 *   <g id="open-space">   <path d="…"/> …
 *
 * Files without tagged plots fall back to the boundary paths stored on the
 * plot records (svgPath / textX / textY), so other projects still work.
 */

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, '')

export function plotKey(no) {
  return norm(no)
}

/**
 * Extract only the numeric plot number for on-plot rendering, stripping
 * trailing letters, side descriptions, or parenthetical notes.
 */
export function formatPlotNumberOnly(plotNo) {
  const raw = String(plotNo ?? '').trim()
  if (!raw) return ''
  const match = raw.match(/^(?:plot\s*(?:no\.?\s*)?)?(\d+)/i)
  return match ? match[1] : raw
}

function readViewBox(svg) {
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
    return { x: vb[0], y: vb[1], width: vb[2], height: vb[3] }
  }
  const w = parseFloat(svg.getAttribute('width')) || 1056
  const h = parseFloat(svg.getAttribute('height')) || 816
  return { x: 0, y: 0, width: w, height: h }
}

/**
 * @param {string} svgText   raw SVG markup (may be null when the file is missing)
 * @param {Array}  dbPlots   plot records for this phase (fallback geometry)
 * @param {string} fallbackViewBox  "0 0 w h" from the phase record
 */
export function parseLayoutSvg(svgText, dbPlots = [], fallbackViewBox) {
  let viewBox = null
  let plots = []
  let roads = []
  let openSpaces = []
  let unmapped = []

  if (svgText && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (svg && !doc.querySelector('parsererror')) {
      viewBox = readViewBox(svg)

      // Label positions from the plot-numbers group
      const labels = new Map()
      doc.querySelectorAll('#plot-numbers text').forEach((t) => {
        const key = norm(t.textContent)
        if (!key || labels.has(key)) return
        labels.set(key, { x: parseFloat(t.getAttribute('x')), y: parseFloat(t.getAttribute('y')) })
      })

      doc.querySelectorAll('#plots [data-plot]').forEach((el) => {
        const d = el.getAttribute('d')
        const no = el.getAttribute('data-plot')
        if (!d || !no) return
        const lbl = labels.get(norm(no))
        plots.push({ no: no.trim(), key: norm(no), d, labelX: lbl?.x, labelY: lbl?.y, source: 'svg' })
      })

      // Drawn plot cells that carry no plot number — shown, but can't be matched to a record
      unmapped = [...doc.querySelectorAll('#plots path:not([data-plot])')].map((p) => p.getAttribute('d')).filter(Boolean)

      roads = [...doc.querySelectorAll('#road-network, #roads path')]
        .map((p) => p.getAttribute('d'))
        .filter(Boolean)
        .filter((d, i, a) => a.indexOf(d) === i)

      openSpaces = [...doc.querySelectorAll('#open-space path, [id^="open-space-"]')]
        .map((p) => p.getAttribute('d'))
        .filter(Boolean)
        .filter((d, i, a) => a.indexOf(d) === i)
    }
  }

  // The CRM is the source of truth: a boundary saved on the plot record
  // replaces the file's shape, and plots added in the CRM (with a boundary)
  // appear even though the SVG file doesn't have them.
  if (plots.length > 0) {
    const records = new Map()
    const numericRecords = new Map()
    for (const r of dbPlots) {
      const key = norm(r.plotNo)
      if (key && !records.has(key)) {
        records.set(key, r)
        const numKey = norm(formatPlotNumberOnly(r.plotNo))
        if (numKey && !numericRecords.has(numKey)) numericRecords.set(numKey, r)
      }
    }
    const seen = new Set()
    plots = plots.map((p) => {
      let r = records.get(p.key)
      if (!r) {
        const candidate = numericRecords.get(p.key)
        // Only fall back to the numeric key if that record's exact key isn't another SVG plot
        if (candidate && !plots.some((other) => other.key === norm(candidate.plotNo))) {
          r = candidate
        }
      }
      if (!r) {
        seen.add(p.key)
        return p
      }
      const rKey = norm(r.plotNo)
      seen.add(rKey)
      const hasDbPath = Boolean(r.svgPath && String(r.svgPath).trim())
      return {
        ...p,
        no: String(r.plotNo).trim(),
        key: rKey,
        d: hasDbPath ? String(r.svgPath).trim() : p.d,
        labelX: Number.isFinite(Number(r.textX)) && r.textX !== null ? Number(r.textX) : p.labelX,
        labelY: Number.isFinite(Number(r.textY)) && r.textY !== null ? Number(r.textY) : p.labelY,
        source: hasDbPath ? 'db' : p.source,
      }
    })
    records.forEach((r, key) => {
      if (seen.has(key)) return
      if (!r.svgPath || !String(r.svgPath).trim()) return
      plots.push({
        no: String(r.plotNo).trim(),
        key,
        d: String(r.svgPath).trim(),
        labelX: r.textX ?? undefined,
        labelY: r.textY ?? undefined,
        source: 'db',
      })
    })
  }

  // Fallback: geometry stored on the plot records
  if (plots.length === 0) {
    plots = dbPlots
      .filter((p) => p.svgPath && String(p.svgPath).trim())
      .map((p) => ({
        no: String(p.plotNo).trim(),
        key: norm(p.plotNo),
        d: String(p.svgPath).trim(),
        labelX: p.textX ?? undefined,
        labelY: p.textY ?? undefined,
        source: 'db',
      }))
  }

  if (!viewBox) {
    const vb = String(fallbackViewBox || '0 0 1056 816').split(/[\s,]+/).map(Number)
    viewBox = { x: vb[0] || 0, y: vb[1] || 0, width: vb[2] || 1056, height: vb[3] || 816 }
  }

  if (plots.length && plots[0].source === 'db') unmapped = []
  return { viewBox, plots, roads, openSpaces, unmapped }
}

/** Plot status → display group used for colours and filters. */
export function statusGroup(status) {
  const s = String(status || '').trim().toLowerCase()
  if (!s) return 'untagged'
  if (s === 'available') return 'available'
  if (s === 'booked') return 'booked'
  if (s === 'sold' || s === 'registered') return 'sold'
  if (s === 'reserved' || s === 'blocked') return 'reserved'
  return 'available'
}

/** "11,363.25 sq.ft" / "1200" → 11363.25 */
export function parseSqft(area) {
  if (area === null || area === undefined) return null
  const m = String(area).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  let n = parseFloat(m[1])
  if (/cent/i.test(String(area))) n *= 435.6
  else if (/acre/i.test(String(area))) n *= 43560
  return n
}
