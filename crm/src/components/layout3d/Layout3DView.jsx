import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapIcon, X } from 'lucide-react'
import { resolveMediaUrl, formatRupees } from '../../lib/plotUtils'
import { getApiUrl } from '../../lib/api'
import { parseLayoutSvg, parseSqft, plotKey, statusGroup } from './parseLayoutSvg'
import { buildPhases, phaseIndexFrom } from './phases'
import { SIZES, STATUS, cls } from './status'
import { PlaceDetails, PlaceMarkers } from './Places'
import { ActionBar, AvailabilityCard, FilterPanel, PlotDetails, ProjectHeader, SearchBar, ViewTools } from './Layout3DParts'
import PlotScene from './PlotScene'
import './layout3d.css'

const POLL_MS = 30000
const titleCase = (s) => String(s || '').replace(/_/g, ' ').trim().replace(/\b[a-z]/g, (c) => c.toUpperCase())

const defaultBusiness = {
  name: 'Crystal Estates',
  phone: '+91 94440 00000',
  whatsapp: '919444000000',
}

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
  if (r.width || r.length) return `${r.width ? fmtFeet(r.width) : '—'} × ${r.length ? fmtFeet(r.length) : '—'}`
  const d = String(r.dimensions || '').trim()
  return d && !/sq|cent|acre/i.test(d) ? d : ''
}

function areaOf(r) {
  if (!r?.area) return ''
  const s = String(r.area).trim()
  return /[a-z]/i.test(s) ? s : `${Number(s).toLocaleString('en-IN')} sq.ft`
}

function priceOf(r) {
  const n = Number(r?.price)
  return n > 0 ? formatRupees(n) : (r?.price || 'Price on request')
}

export default function Layout3DView({
  project: initialProject,
  pickMode = false,
  onPick: propOnPick,
  draft: propDraft = null,
  initialPhase = null,
  onClose,
  onBack,
}) {
  const [project, setProject] = useState(initialProject || {})
  const phases = useMemo(() => buildPhases(project), [project])
  const [phaseIdx, setPhaseIdx] = useState(() => phaseIndexFrom(phases, initialPhase))
  const phase = phases[phaseIdx] || phases[0]

  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const sceneRef = useRef(null)
  const labelRef = useRef(null)
  const needleRef = useRef(null)
  const miniRef = useRef(null)
  const miniDotRef = useRef(null)
  const searchRef = useRef(null)

  const [draft, setDraft] = useState(() => {
    if (propDraft && (Number.isFinite(propDraft.x) || propDraft.name)) return propDraft
    return pickMode ? { x: null, y: null, name: '' } : null
  })

  // Keep propDraft in sync if parent updates it
  useEffect(() => {
    if (propDraft) setDraft(propDraft)
  }, [propDraft])

  const [activePlace, setActivePlace] = useState(null)
  const [showPlaces, setShowPlaces] = useState(true)
  const markerEls = useRef(new Map())
  const placesRef = useRef([])
  const draftRef = useRef(draft)
  draftRef.current = draft
  const viewRef = useRef(null)
  const selectedKeyRef = useRef(null)
  const [svgSource, setSvgSource] = useState(null)
  const [plots, setPlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hover, setHover] = useState(null)
  const [selected, setSelected] = useState(null)
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

  /* ───── Layout geometry: SVG file + plot records from the CRM ───── */
  const phaseKey = `${phase?.id || ''}|${phase?.layoutUrl || ''}`
  useEffect(() => {
    let cancelled = false
    const rawUrl = phase?.layoutUrl
    const url = rawUrl ? resolveMediaUrl(rawUrl) : null
    const done = (text) => !cancelled && setSvgSource({ key: phaseKey, text })
    if (!url) {
      done(null)
    } else {
      fetch(url)
        .then((r) => (r.ok ? r.text() : null))
        .then(done)
        .catch(() => done(null))
    }
    return () => {
      cancelled = true
    }
  }, [phaseKey, phase?.layoutUrl])

  const geomKey = useMemo(() => {
    let h = 0
    for (const r of phase?.plots || []) {
      const str = `${r.plotNo}|${r.svgPath || ''}|${r.textX ?? ''}|${r.textY ?? ''};`
      for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
    }
    return `${(phase?.plots || []).length}:${h}`
  }, [phase])

  const layout = useMemo(() => {
    if (!svgSource || svgSource.key !== phaseKey) return null
    return parseLayoutSvg(svgSource.text, phase?.plots || [], phase?.viewBox)
  }, [svgSource, phaseKey, geomKey])
  const layoutError = layout && !layout.plots.length ? 'This layout has no plot boundaries yet.' : ''

  /* ───── Build the Three.js scene ───── */
  useEffect(() => {
    if (!layout || !layout.plots.length || !stageRef.current) return undefined
    let scene
    let cancelled = false

    try {
      scene = new PlotScene(stageRef.current, {
        onHover: (i, pt) => {
          if (i < 0 || !pt || !stageRef.current) return setHover(null)
          const rect = stageRef.current.getBoundingClientRect()
          setHover({ i, x: pt.x - rect.left, y: pt.y - rect.top })
        },
        onSelect: (i) => {
          setActivePlace(null)
          setSelected(i)
        },
        pickMode,
        onPick: ({ x, y }) => {
          const next = { ...(draftRef.current || {}), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }
          draftRef.current = next
          setDraft(next)
          propOnPick?.({ x: next.x, y: next.y, phase: phase?.name || '' })
        },
        onFrame: (s) => {
          const pt = s.selectedScreenPoint()
          const el = labelRef.current
          if (el && stageRef.current) {
            const top = topRef.current
            const topSafe = top ? top.getBoundingClientRect().bottom - stageRef.current.getBoundingClientRect().top + 40 : 0
            if (pt && pt.y > topSafe) {
              el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -100%)`
              el.style.opacity = '1'
            } else {
              el.style.opacity = '0'
            }
          }
          const top = topRef.current
          const safe = top && stageRef.current ? top.getBoundingClientRect().bottom - stageRef.current.getBoundingClientRect().top + 8 : 0
          const place = (elem, x, y) => {
            const at = Number.isFinite(x) && Number.isFinite(y) ? s.projectSvg(x, y, 6) : null
            if (!at || at.y < safe) {
              elem.style.opacity = '0'
              elem.style.pointerEvents = 'none'
              return
            }
            elem.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`
            elem.style.opacity = '1'
            elem.style.pointerEvents = ''
          }
          for (const pl of placesRef.current) {
            const el = markerEls.current.get(pl.id)
            if (el) place(el, pl.x, pl.y)
          }
          const dEl = markerEls.current.get('__draft')
          if (dEl && draftRef.current) place(dEl, draftRef.current.x, draftRef.current.y)
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
      if (viewRef.current?.phaseKey === phaseKey) scene.setView(viewRef.current.view)
      else if (pickMode && draftRef.current && Number.isFinite(draftRef.current.x)) scene.panToSvg(draftRef.current.x, draftRef.current.y)

      const list = built.map((p) => ({ no: p.no, key: p.key, d: p.d }))
      setPlots(list)
      const keep = selectedKeyRef.current ? list.findIndex((p) => p.key === selectedKeyRef.current) : -1
      setSelected(keep >= 0 ? keep : null)
      setLoading(false)
    } catch (err) {
      console.error('3D scene init error:', err)
      setError(err.message || 'Failed to initialize 3D scene')
      setLoading(false)
    }

    return () => {
      cancelled = true
      if (scene?.viewBox) viewRef.current = { phaseKey, view: scene.getView() }
      sceneRef.current = null
      scene?.dispose()
    }
  }, [layout])

  /* ───── Live status: poll CRM API ───── */
  const projId = initialProject?.id || initialProject?.projectId || initialProject?._id
  const refresh = useCallback(async () => {
    if (!projId) return
    try {
      const res = await fetch(getApiUrl(`/api/plots/${encodeURIComponent(projId)}`), { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data?.success && data.plot) {
        setProject(data.plot)
        setUpdatedAt(new Date())
      }
    } catch {
      /* keep last known statuses */
    }
  }, [projId])

  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(first)
      clearInterval(id)
      window.removeEventListener('focus', refresh)
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

  /* ───── Nearby places ───── */
  const places = useMemo(() => {
    const name = String(phase?.name || '').trim().toLowerCase()
    return (Array.isArray(project.nearbyPlaces) ? project.nearbyPlaces : []).filter(
      (pl) => pl && pl.id && Number.isFinite(Number(pl.x)) && Number.isFinite(Number(pl.y)) && (!pl.phase || String(pl.phase).trim().toLowerCase() === name),
    ).map((pl) => ({ ...pl, x: Number(pl.x), y: Number(pl.y) }))
  }, [project.nearbyPlaces, phase?.name])

  const visiblePlaces = showPlaces ? places : []
  useEffect(() => {
    placesRef.current = visiblePlaces
  }, [places, showPlaces])

  const registerMarker = useCallback((id, el) => {
    if (el) markerEls.current.set(id, el)
    else markerEls.current.delete(id)
  }, [])

  const placeSel = activePlace ? places.find((pl) => pl.id === activePlace) || null : null
  const openPlace = (id) => {
    const pl = places.find((x) => x.id === id)
    if (!pl) return
    setSelected(null)
    setActivePlace(id)
    sceneRef.current?.focusPlace(pl.x, pl.y)
  }

  /* ───── Push colours to the scene ───── */
  useEffect(() => {
    const s = sceneRef.current
    if (!s || !plots.length) return
    s.setStyles(info.map((x, i) => ({ color: STATUS[x.group].color, dim: filtering && !matches[i] })))
  }, [info, matches, filtering, plots])

  /* ───── Selection ↔ scene ───── */
  useEffect(() => {
    selectedKeyRef.current = selected !== null ? plots[selected]?.key || null : null
    sceneRef.current?.setViewShift(selected !== null && window.innerWidth <= 860 ? 0.11 : 0)
    sceneRef.current?.setSelected(selected ?? -1)
  }, [selected, plots])

  // Place card closed: the camera returns (runs after the selection effect, so a plot opened from a place keeps its own return)
  useEffect(() => {
    if (!activePlace) sceneRef.current?.closePlace()
  }, [activePlace])

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

  const changePhase = (idx) => {
    if (idx === phaseIdx) return
    setLoading(true)
    setError('')
    setSelected(null)
    setActivePlace(null)
    setPlots([])
    setPhaseIdx(idx)
    setStatusFilter('all')
    setSizeFilter('all')
    setFacingFilter('all')
    setQuery('')
  }

  const sel = selected !== null ? plots[selected] : null
  const rec = recordAt(selected)
  const selGroup = sel ? info[selected]?.group || 'untagged' : null
  const projectName = titleCase(project.name || project.projectName)

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
        ...(rec.frontage || rec.rearWidth || rec.leftSideLength || rec.rightSideLength
          ? [
              ['Frontage', rec.frontage || '—'],
              ['Rear Width', rec.rearWidth || '—'],
              ['Left Side Length', rec.leftSideLength || '—'],
              ['Right Side Length', rec.rightSideLength || '—'],
            ]
          : []),
        ...(rec.north != null || rec.south != null || rec.east != null || rec.west != null
          ? [
              ['North', rec.north != null ? fmtFeet(rec.north) : '—'],
              ['South', rec.south != null ? fmtFeet(rec.south) : '—'],
              ['East', rec.east != null ? fmtFeet(rec.east) : '—'],
              ['West', rec.west != null ? fmtFeet(rec.west) : '—'],
            ]
          : []),
      ]
    : []

  const clearFilters = () => {
    setStatusFilter('all')
    setSizeFilter('all')
    setFacingFilter('all')
  }

  return (
    <div ref={rootRef} className={cls('l3d', (sel || placeSel) && 'has-sel', statsOpen && 'stats-open', filtersOpen && 'filters-open', pickMode && 'is-picking')}>
      <div ref={stageRef} className="l3d-stage" onPointerDown={() => filtersOpen && setFiltersOpen(false)} />

      <PlaceMarkers places={visiblePlaces} activeId={activePlace} onSelect={pickMode ? undefined : openPlace} registerRef={registerMarker} draft={pickMode ? draft : null} />

      {pickMode && (
        <div className="l3d-glass l3d-pickbar" role="status">
          {draft && Number.isFinite(draft.x)
            ? `Position set (${draft.x}, ${draft.y}) — click again to move marker`
            : `Click on the 3D layout where ${draft?.name || 'the place'} is`}
        </div>
      )}

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
            phases={phases}
            phaseIdx={phaseIdx}
            onPhase={changePhase}
            onBack={onBack || onClose}
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

        {placeSel && !sel && <PlaceDetails place={placeSel} onClose={() => setActivePlace(null)} />}

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
          placesCount={pickMode ? 0 : places.length}
          placesOn={showPlaces}
          onPlaces={() => {
            setShowPlaces((v) => !v)
            setActivePlace(null)
          }}
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

      {(loading || error || layoutError) && (
        <div className="l3d-loader" role="status">
          {error || layoutError ? (
            <>
              <p>{error || layoutError}</p>
              {onClose && (
                <button type="button" onClick={onClose} className="l3d-btn l3d-btn--gold">
                  Close
                </button>
              )}
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
