'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Map as MapIcon } from 'lucide-react'
import { business } from '../../data/site'
import { formatPrice, normalizePlot } from '../../lib/api'
import { parseLayoutSvg, parseSqft, plotKey, statusGroup } from './parseLayoutSvg'
import { buildPhases, phaseIndexFrom } from './phases'
import { SIZES, STATUS, cls } from './status'
import { ActionBar, AvailabilityCard, FilterPanel, PlotDetails, ProjectHeader, SearchBar, ViewTools } from './Layout3DParts'
import './layout3d.css'

const POLL_MS = 30000
const CRM_URL = (process.env.NEXT_PUBLIC_CRM_URL || 'http://localhost:5173').replace(/\/$/, '')
const titleCase = (s) => String(s || '').replace(/_/g, ' ').trim().replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** 30 | "30" | "30'0''" | "30'" → "30 ft"; anything else is shown as stored */
function fmtFeet(v) {
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return `${s} ft`
  const m = s.match(/^(\d+(?:\.\d+)?)\s*['′]\s*(?:0*\s*(?:''|"|″))?$/)
  if (m) return `${m[1]} ft`
  const fi = s.match(/^(\d+)\s*['′]\s*(\d+)\s*(?:''|"|″)$/)
  return fi ? `${fi[1]} ft ${fi[2]} in` : s
}

function dimsOf(r) {
  if (!r) return ''
  if (r.width && r.length) return `${fmtFeet(r.width)} × ${fmtFeet(r.length)}`
  const d = String(r.dimensions || '').trim()
  // Some records store the area here (e.g. "1200 sq.ft (Approx)"), which isn't a dimension
  return d && !/sq|cent|acre/i.test(d) ? d : ''
}
function areaOf(r) {
  if (!r?.area) return ''
  const s = String(r.area).trim()
  return /[a-z]/i.test(s) ? s : `${Number(s).toLocaleString('en-IN')} sq.ft`
}
function priceOf(r) {
  const n = Number(r?.price)
  return n > 0 ? formatPrice(n) : 'Price on request'
}

export default function Layout3DView({ project: initialProject }) {
  const params = useSearchParams()
  const [project, setProject] = useState(initialProject)
  const phases = useMemo(() => buildPhases(project), [project])
  const [phaseIdx, setPhaseIdx] = useState(() => phaseIndexFrom(buildPhases(initialProject), params.get('phase')))
  const phase = phases[phaseIdx] || phases[0]

  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const sceneRef = useRef(null)
  const labelRef = useRef(null)
  const needleRef = useRef(null)
  const miniRef = useRef(null)
  const miniDotRef = useRef(null)
  const searchRef = useRef(null)
  const initialPlotRef = useRef(params.get('plot'))

  const [layout, setLayout] = useState(null) // parsed SVG
  const [plots, setPlots] = useState([]) // [{no,key}] aligned with scene indices
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hover, setHover] = useState(null) // {i,x,y}
  const [selected, setSelected] = useState(null) // scene index
  const [statusFilter, setStatusFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [facingFilter, setFacingFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [searchMsg, setSearchMsg] = useState('')
  const [autoRotate, setAutoRotate] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [miniOpen, setMiniOpen] = useState(true)
  const [statsOpen, setStatsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 860)
  const topRef = useRef(null)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [flash, setFlash] = useState('')

  /* ───── Records for this phase, keyed by plot number ───── */
  const records = useMemo(() => {
    const m = new Map()
    for (const r of phase?.plots || []) {
      const k = plotKey(r.plotNo)
      if (k && !m.has(k)) m.set(k, r)
    }
    return m
  }, [phase])

  const recordAt = useCallback((i) => (i === null || i < 0 || !plots[i] ? null : records.get(plots[i].key) || null), [plots, records])

  /* ───── Load + parse the layout SVG (file is only read, never written) ───── */
  useEffect(() => {
    let cancelled = false
    const url = phase?.layoutUrl
    const done = (text) => {
      if (cancelled) return
      const parsed = parseLayoutSvg(text, phase?.plots || [], phase?.viewBox)
      if (!parsed.plots.length) {
        setError('This layout has no plot boundaries yet.')
        setLoading(false)
        return
      }
      setLayout(parsed)
    }
    if (!url) done(null)
    else
      fetch(url)
        .then((r) => (r.ok ? r.text() : null))
        .then(done)
        .catch(() => done(null))
    return () => {
      cancelled = true
    }
    // Only re-parse when the geometry source changes, not on status polls
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase?.id, phase?.layoutUrl])

  /* ───── Build the Three.js scene ───── */
  useEffect(() => {
    if (!layout || !stageRef.current) return undefined
    let scene
    let cancelled = false
    import('./PlotScene').then(({ default: PlotScene }) => {
      if (cancelled || !stageRef.current) return
      scene = new PlotScene(stageRef.current, {
        onHover: (i, pt) => {
          if (i < 0 || !pt) return setHover(null)
          const rect = stageRef.current.getBoundingClientRect()
          setHover({ i, x: pt.x - rect.left, y: pt.y - rect.top })
        },
        onSelect: (i) => setSelected(i),
        onFrame: (s) => {
          const pt = s.selectedScreenPoint()
          const el = labelRef.current
          if (el) {
            // Hide the pin while it would sit under the top panels
            const top = topRef.current
            const topSafe = top ? top.getBoundingClientRect().bottom - stageRef.current.getBoundingClientRect().top + 40 : 0
            if (pt && pt.y > topSafe) {
              el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -100%)`
              el.style.opacity = '1'
            } else el.style.opacity = '0'
          }
          if (needleRef.current) needleRef.current.style.transform = `rotate(${(-s.getAzimuth() * 180) / Math.PI}deg)`
          const dot = miniDotRef.current
          if (dot) {
            const t = s.cameraTargetSvg()
            const vb = s.viewBox
            dot.style.left = `${((t.x - vb.x) / vb.width) * 100}%`
            dot.style.top = `${((t.y - vb.y) / vb.height) * 100}%`
          }
        },
      })
      const built = scene.load(layout)
      sceneRef.current = scene
      if (process.env.NODE_ENV !== 'production') window.__plotScene = scene
      setPlots(built.map((p) => ({ no: p.no, key: p.key, d: p.d })))
      setLoading(false)
    })
    return () => {
      cancelled = true
      sceneRef.current = null
      scene?.dispose()
    }
  }, [layout])

  /* ───── Live status: poll the API and refresh on focus ───── */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/plots/${encodeURIComponent(initialProject.id)}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data?.success && data.plot) {
        setProject(normalizePlot(data.plot))
        setUpdatedAt(new Date())
      }
    } catch {
      /* offline — keep the last known statuses */
    }
  }, [initialProject.id])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  /* ───── Derived data ───── */
  const facings = useMemo(() => {
    const s = new Set()
    records.forEach((r) => r.facing && s.add(titleCase(String(r.facing).toLowerCase())))
    return [...s].sort()
  }, [records])

  const info = useMemo(
    () =>
      plots.map((p) => {
        const r = records.get(p.key)
        return {
          group: r ? statusGroup(r.status) : 'untagged',
          sqft: parseSqft(r?.area),
          facing: r?.facing ? titleCase(String(r.facing).toLowerCase()) : '',
        }
      }),
    [plots, records],
  )

  const counts = useMemo(() => {
    const c = { available: 0, booked: 0, reserved: 0, sold: 0, untagged: 0 }
    info.forEach((x) => (c[x.group] += 1))
    return c
  }, [info])

  const sizeTest = SIZES.find((s) => s.id === sizeFilter)?.test || (() => true)
  const q = plotKey(query)
  const matches = useMemo(
    () =>
      info.map(
        (x, i) =>
          (statusFilter === 'all' || x.group === statusFilter) &&
          (sizeFilter === 'all' || sizeTest(x.sqft)) &&
          (facingFilter === 'all' || x.facing === facingFilter) &&
          (!q || plots[i].key.startsWith(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info, statusFilter, sizeFilter, facingFilter, q, plots],
  )
  const matchCount = matches.filter(Boolean).length
  const filtering = statusFilter !== 'all' || sizeFilter !== 'all' || facingFilter !== 'all' || Boolean(q)

  const availableList = useMemo(
    () =>
      plots
        .map((p, i) => ({ ...p, i }))
        .filter((p) => info[p.i]?.group === 'available' && matches[p.i])
        .sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true })),
    [plots, info, matches],
  )

  /* ───── Push colours to the scene ───── */
  useEffect(() => {
    const s = sceneRef.current
    if (!s || !plots.length) return
    s.setStyles(info.map((x, i) => ({ color: STATUS[x.group].color, dim: filtering && !matches[i] })))
  }, [info, matches, filtering, plots])

  /* ───── Selection ↔ scene ↔ URL ───── */
  useEffect(() => {
    // On phones the details sheet covers the lower half, so lift the view centre
    sceneRef.current?.setViewShift(selected !== null && window.innerWidth <= 860 ? 0.11 : 0)
    sceneRef.current?.setSelected(selected ?? -1)
    if (!plots.length) return
    const url = new URL(window.location.href)
    if (selected !== null && plots[selected]) url.searchParams.set('plot', plots[selected].no)
    else url.searchParams.delete('plot')
    window.history.replaceState(window.history.state, '', url)
  }, [selected, plots])

  // Deep link: ?plot=214A selects it once the scene is ready
  useEffect(() => {
    const want = initialPlotRef.current
    if (!want || !plots.length) return
    initialPlotRef.current = null
    const i = plots.findIndex((p) => p.key === plotKey(want))
    if (i >= 0) setTimeout(() => setSelected(i), 350)
  }, [plots])

  /* ───── Minimap ───── */
  useEffect(() => {
    const cv = miniRef.current
    if (!cv || !layout || !plots.length || !miniOpen) return
    const vb = layout.viewBox
    const W = 220
    const H = Math.round((W * vb.height) / vb.width)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = W * dpr
    cv.height = H * dpr
    cv.style.height = `${H}px`
    const ctx = cv.getContext('2d')
    ctx.setTransform((W * dpr) / vb.width, 0, 0, (H * dpr) / vb.height, (-vb.x * W * dpr) / vb.width, (-vb.y * H * dpr) / vb.height)
    ctx.clearRect(vb.x, vb.y, vb.width, vb.height)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(vb.x, vb.y, vb.width, vb.height)
    layout.roads.forEach((d) => {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fill(new Path2D(d))
    })
    ctx.fillStyle = 'rgba(216,210,195,0.45)'
    ;(layout.unmapped || []).forEach((d) => ctx.fill(new Path2D(d)))
    plots.forEach((p, i) => {
      const g = info[i]?.group || 'untagged'
      ctx.globalAlpha = filtering && !matches[i] ? 0.25 : 1
      ctx.fillStyle = i === selected ? '#ffc21a' : STATUS[g].color
      ctx.fill(new Path2D(p.d))
    })
    ctx.globalAlpha = 1
  }, [layout, plots, info, matches, filtering, selected, miniOpen])

  const onMiniClick = (e) => {
    const s = sceneRef.current
    if (!s || !layout) return
    const r = e.currentTarget.getBoundingClientRect()
    const vb = layout.viewBox
    s.panToSvg(vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height)
  }

  /* ───── Controls ───── */
  const runSearch = (e) => {
    e?.preventDefault()
    if (!q) return
    const i = plots.findIndex((p) => p.key === q)
    const j = i >= 0 ? i : plots.findIndex((p) => p.key.startsWith(q))
    if (j < 0) {
      setSearchMsg(`No plot “${query.trim()}” in ${phase?.name || 'this layout'}`)
      return
    }
    setSearchMsg('')
    setSelected(j)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.()
  }
  useEffect(() => {
    const on = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  useEffect(() => {
    sceneRef.current?.setAutoRotate(autoRotate)
  }, [autoRotate, plots])

  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName || '')
      if (e.key === 'Escape') {
        if (typing) e.target.blur()
        setFiltersOpen(false)
        setSelected(null)
      } else if (!typing && e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (!typing && (e.key === '+' || e.key === '=')) sceneRef.current?.zoom(0.75)
      else if (!typing && (e.key === '-' || e.key === '_')) sceneRef.current?.zoom(1.33)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Hide the floating site-visit launcher while the 3D view is open
  useEffect(() => {
    document.body.classList.add('l3d-open')
    return () => document.body.classList.remove('l3d-open')
  }, [])

  const changePhase = (idx) => {
    if (idx === phaseIdx) return
    setLoading(true)
    setError('')
    setSelected(null)
    setLayout(null)
    setPlots([])
    setPhaseIdx(idx)
    setStatusFilter('all')
    setSizeFilter('all')
    setFacingFilter('all')
    setQuery('')
    const url = new URL(window.location.href)
    url.searchParams.set('phase', String(idx + 1))
    url.searchParams.delete('plot')
    window.history.replaceState(window.history.state, '', url)
  }

  /* ───── Selected plot details ───── */
  const sel = selected !== null ? plots[selected] : null
  const rec = recordAt(selected)
  const selGroup = sel ? info[selected]?.group || 'untagged' : null
  const projectName = titleCase(project.name || project.projectName)
  const projectHref = `/projects/${project.slug || project.id}`

  // Status changed under the open card (another user updated the CRM)
  const lastStatus = useRef(null)
  useEffect(() => {
    const key = sel ? `${sel.key}:${rec?.status || ''}` : null
    if (lastStatus.current && key && lastStatus.current.split(':')[0] === sel.key && lastStatus.current !== key) {
      setFlash(`Status updated to ${rec?.status || 'unknown'}`)
      const t = setTimeout(() => setFlash(''), 4000)
      lastStatus.current = key
      return () => clearTimeout(t)
    }
    lastStatus.current = key
    return undefined
  }, [sel, rec?.status])

  const waText = sel
    ? `Hi Crystal Estates, I'm interested in plot ${sel.no} at ${projectName}${phase?.name ? ` (${phase.name})` : ''}. Please share details.`
    : `Hi Crystal Estates, I'm interested in plots at ${projectName}. Please share details.`
  const waUrl = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(waText)}`
  const telUrl = `tel:${business.phone.replace(/\s/g, '')}`
  const mapUrl = project.mapLocation && /^https?:/i.test(project.mapLocation)
    ? project.mapLocation
    : `https://www.google.com/maps?q=${encodeURIComponent(`${projectName} ${project.location || ''}`)}`
  const crmUrl = sel
    ? `${CRM_URL}/properties/${encodeURIComponent(project.id)}/plots?${new URLSearchParams({
        ...(rec?.uid ? { plot: rec.uid } : {}),
        plotNo: sel.no,
        phase: phase?.name || '',
      })}`
    : null

  const enquire = () => window.dispatchEvent(new CustomEvent('open-site-visit', { detail: { plotNo: sel?.no } }))

  const hoverRec = hover ? recordAt(hover.i) : null
  const hoverGroup = hover ? info[hover.i]?.group || 'untagged' : null
  const filterCount = (statusFilter !== 'all') + (sizeFilter !== 'all') + (facingFilter !== 'all')
  const otherCount = counts.untagged + (layout?.unmapped?.length || 0)
  const specs = rec
    ? [
        ['Area', areaOf(rec)],
        ['Dimensions', dimsOf(rec)],
        ['Facing', rec.facing ? titleCase(String(rec.facing).toLowerCase()) : ''],
        ['Road width', rec.roadWidth ? (/\d$/.test(String(rec.roadWidth)) ? `${rec.roadWidth} ft` : String(rec.roadWidth)) : ''],
      ]
    : []
  const clearFilters = () => {
    setStatusFilter('all')
    setSizeFilter('all')
    setFacingFilter('all')
  }

  return (
    <div ref={rootRef} className={cls('l3d', sel && 'has-sel', statsOpen && 'stats-open', filtersOpen && 'filters-open')}>
      <div ref={stageRef} className="l3d-stage" onPointerDown={() => filtersOpen && setFiltersOpen(false)} />

      {/* Selected plot label pinned above the plot */}
      <div ref={labelRef} className="l3d-pin" aria-hidden="true" style={{ opacity: 0 }}>
        {sel && (
          <>
            <b>{sel.no}</b>
            <span>{STATUS[selGroup].label}</span>
          </>
        )}
      </div>

      {/* Hover tooltip (mouse only) */}
      {hover && hover.i !== selected && plots[hover.i] && (
        <div className="l3d-tip" style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 14}px)` }} aria-hidden="true">
          <b>Plot {plots[hover.i].no}</b>
          <span>
            <i style={{ background: STATUS[hoverGroup].color }} />
            {STATUS[hoverGroup].label}
            {hoverRec?.area ? ` · ${areaOf(hoverRec)}` : ''}
          </span>
        </div>
      )}

      {/* Left column: header, search, plot details */}
      <div className="l3d-left">
        <div className="l3d-top" ref={topRef}>
          <ProjectHeader
            name={projectName}
            location={project.location}
            href={projectHref}
            phases={phases}
            phaseIdx={phaseIdx}
            onPhase={changePhase}
          />
          <div className="l3d-find">
            <SearchBar
              inputRef={searchRef}
              query={query}
              setQuery={(v) => {
                setQuery(v)
                setSearchMsg('')
              }}
              onSubmit={runSearch}
              filterCount={filterCount}
              filtersOpen={filtersOpen}
              toggleFilters={() => setFiltersOpen((v) => !v)}
            />
            {filtersOpen && (
              <FilterPanel
                counts={counts}
                total={plots.length}
                status={statusFilter}
                setStatus={setStatusFilter}
                size={sizeFilter}
                setSize={setSizeFilter}
                facing={facingFilter}
                setFacing={setFacingFilter}
                facings={facings}
                matchCount={matchCount}
                onClear={clearFilters}
                onClose={() => setFiltersOpen(false)}
              />
            )}
            {searchMsg && (
              <p className="l3d-glass l3d-toast" role="status">
                {searchMsg}
              </p>
            )}
          </div>
        </div>

        {sel && (
          <PlotDetails
            no={sel.no}
            group={selGroup}
            statusText={rec?.status}
            price={priceOf(rec)}
            specs={specs}
            hasRecord={Boolean(rec)}
            flash={flash}
            onClose={() => setSelected(null)}
            onBook={enquire}
            waUrl={waUrl}
            crmUrl={crmUrl}
          />
        )}
      </div>

      {/* Right column: availability + camera tools */}
      <div className="l3d-right">
        <AvailabilityCard
          counts={counts}
          total={plots.length}
          other={otherCount}
          open={statsOpen}
          onToggle={() => setStatsOpen((v) => !v)}
          availableList={availableList}
          selected={selected}
          onPick={(i) => {
            setSelected(i)
            if (window.innerWidth <= 860) setStatsOpen(false)
          }}
          updatedAt={updatedAt}
        />
        <ViewTools
          onZoomIn={() => sceneRef.current?.zoom(0.7)}
          onZoomOut={() => sceneRef.current?.zoom(1.4)}
          onTop={() => sceneRef.current?.topView()}
          onReset={() => {
            setSelected(null)
            sceneRef.current?.reset()
          }}
          autoRotate={autoRotate}
          onRotate={() => setAutoRotate((v) => !v)}
          fullscreen={fullscreen}
          onFullscreen={toggleFullscreen}
          needleRef={needleRef}
        />
      </div>

      {/* Minimap */}
      {layout && (
        <div className={cls('l3d-glass l3d-mini', !miniOpen && 'closed')}>
          <button type="button" className="l3d-mini__toggle" onClick={() => setMiniOpen((v) => !v)} aria-expanded={miniOpen}>
            <MapIcon size={13} /> {miniOpen ? 'Overview' : 'Map'}
          </button>
          {miniOpen && (
            <div className="l3d-mini__map" onClick={onMiniClick} role="button" tabIndex={-1} aria-label="Overview map — click to move the camera">
              <canvas ref={miniRef} />
              <span ref={miniDotRef} className="l3d-mini__dot" />
            </div>
          )}
        </div>
      )}

      <ActionBar onEnquire={enquire} waUrl={waUrl} telUrl={telUrl} mapUrl={mapUrl} />

      {(loading || error) && (
        <div className="l3d-loader" role="status">
          {error ? (
            <>
              <p>{error}</p>
              <a href={projectHref} className="l3d-btn l3d-btn--gold">
                Back to project
              </a>
            </>
          ) : (
            <>
              <span className="l3d-spinner" />
              <p>Building the 3D layout…</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
