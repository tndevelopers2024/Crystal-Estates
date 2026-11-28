'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
  Info,
  ArrowLeft,
  ChevronDown,
  Box,
} from 'lucide-react'
import { WhatsAppIcon } from '../ui'
import { computePathCentroid } from '@/lib/svgPathCentroid'
import { parseViewBox, formatPlotNumberOnly } from '@/lib/svgUtils'
import './PlotViewer.css'

// Shared in-memory cache for parsed vector SVG blueprints (instant phase switching & 0ms re-renders)
const svgVectorCache = new Map()

/**
 * React Interactive Plot Viewer Component
 * Displays a real estate layout map with dynamic plots loaded from API/Database,
 * pan & zoom, hover tooltips, status filters, and pre-filled WhatsApp inquiry.
 * All plot boundaries and layouts are loaded dynamically from the database.
 */
export default function PlotViewer({
  initialPlots = null,
  fetchUrl = null,
  backgroundUrl = null,
  viewBox = null,
  metadata = null,
  phases = null,
  activePhase = 0,
  onPhaseChange = null,
  whatsappNumber = '919444000000',
  className = '',
  onPlotSelect = null,
  backHref = null,
  onClose = null,
  isModal = false,
  onToggleFullscreen = null,
  view3dHref = null,
  // true = always fit the whole layout in view (no mobile zoom-in on load)
  fitWholeLayout = false,
}) {
  // Data state loaded purely from API or passed props
  const [plots, setPlots] = useState(() => (Array.isArray(initialPlots) ? initialPlots : []))
  const [meta, setMeta] = useState(metadata || {})
  const [loading, setLoading] = useState(Boolean(!Array.isArray(initialPlots) && fetchUrl))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (metadata) setMeta(metadata)
  }, [metadata])

  useEffect(() => {
    if (Array.isArray(initialPlots)) {
      setPlots(initialPlots)
    }
  }, [initialPlots])

  // Multi-Phase Layout Support
  const layoutPhases = React.useMemo(() => {
    if (Array.isArray(phases) && phases.length > 0) return phases
    if (Array.isArray(metadata?.layouts) && metadata.layouts.length > 0) return metadata.layouts
    if (Array.isArray(metadata?.phases) && metadata.phases.length > 0) return metadata.phases
    if (Array.isArray(meta?.layouts) && meta.layouts.length > 0) return meta.layouts
    if (Array.isArray(meta?.phases) && meta.phases.length > 0) return meta.phases
    return null
  }, [phases, metadata, meta])

  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(activePhase || 0)

  useEffect(() => {
    if (typeof activePhase === 'number' && activePhase >= 0) {
      setCurrentPhaseIdx(activePhase)
    }
  }, [activePhase])

  const currentPhase = layoutPhases && layoutPhases[currentPhaseIdx] ? layoutPhases[currentPhaseIdx] : null

  const activeBackgroundUrl =
    currentPhase?.layoutUrl ||
    currentPhase?.layoutBackgroundUrl ||
    backgroundUrl ||
    meta?.layoutBackgroundUrl ||
    meta?.layoutUrl ||
    null

  const activeViewBox =
    currentPhase?.viewBox ||
    viewBox ||
    meta?.viewBox ||
    '0 0 1056 816'

  // Status Filter state: 'All' | 'Available' | 'Booked' | 'Sold' | 'Blocked'
  const [activeFilter, setActiveFilter] = useState('All')

  // Pan & Zoom state (unified atomic transform to prevent scale/pan desynchronization)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef({ scale: 1, x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ x: 0, y: 0 })
  const mouseDownPosRef = useRef({ x: 0, y: 0 })
  const lastCursorPosRef = useRef(null)
  const hasCapturedRef = useRef(false)

  // Sync ref with transform state
  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  // Convenience getters
  const scale = transform.scale
  const pan = { x: transform.x, y: transform.y }

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const viewerRef = useRef(null)
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)

  // Touch device detection to prevent sticky hover tooltips on mobile
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
  }, [])

  // Hover Tooltip state
  const [hoveredPlot, setHoveredPlot] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, flipBelow: false })

  // Selected Plot Modal state (strictly one plot at a time)
  const [selectedPlot, setSelectedPlot] = useState(null)

  // Background SVG load error & inline fallback states
  const [bgLoadError, setBgLoadError] = useState(false)
  const [inlineSvgContent, setInlineSvgContent] = useState(null)

  // Automatic True Scalable Vector SVG Loading & Memory Caching
  useEffect(() => {
    setBgLoadError(false)
    if (!activeBackgroundUrl) {
      setInlineSvgContent(null)
      return
    }

    const isSvgUrl =
      activeBackgroundUrl.toLowerCase().includes('.svg') ||
      activeBackgroundUrl.startsWith('data:image/svg+xml')

    if (!isSvgUrl) {
      setInlineSvgContent(null)
      return
    }

    // Check memory cache first for 0ms instant display
    const cached = svgVectorCache.get(activeBackgroundUrl)
    if (cached) {
      setInlineSvgContent(cached)
      return
    }

    let isMounted = true
    fetch(activeBackgroundUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        if (!isMounted) return
        if (text && text.includes('<svg')) {
          // Clean prologue and editor metadata for maximum rendering speed and clean DOM
          const cleanSvg = text
            .replace(/<\?xml[\s\S]*?\?>/i, '')
            .replace(/<!DOCTYPE[\s\S]*?>/i, '')
            .replace(/<sodipodi:namedview[\s\S]*?\/>/i, '')
            .trim()
          svgVectorCache.set(activeBackgroundUrl, cleanSvg)
          setInlineSvgContent(cleanSvg)
          setBgLoadError(false)
        } else {
          setInlineSvgContent(null)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('Vector SVG direct fetch failed, falling back to standard image loader:', err.message)
        setInlineSvgContent(null)
      })

    return () => {
      isMounted = false
    }
  }, [activeBackgroundUrl])

  const handleBgError = useCallback((url) => {
    if (!url) {
      setBgLoadError(true)
      return
    }
    // Attempt fallback fetch to retrieve inline SVG directly
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        if (text && text.includes('<svg')) {
          const cleanSvg = text
            .replace(/<\?xml[\s\S]*?\?>/i, '')
            .replace(/<!DOCTYPE[\s\S]*?>/i, '')
            .replace(/<sodipodi:namedview[\s\S]*?\/>/i, '')
            .trim()
          svgVectorCache.set(url, cleanSvg)
          setInlineSvgContent(cleanSvg)
          setBgLoadError(false)
        } else {
          setBgLoadError(true)
        }
      })
      .catch(() => {
        setBgLoadError(true)
      })
  }, [])

  // Touch pinch zoom state
  const touchDistRef = useRef(null)

  // 1. Dynamic Data Fetching from Database API (only when initialPlots is not passed)
  useEffect(() => {
    if (!fetchUrl || Array.isArray(initialPlots)) return
    let isMounted = true

    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          if (data.metadata) setMeta(data.metadata)
          if (data.layouts || data.phases) {
            setMeta((prev) => ({
              ...prev,
              layouts: data.layouts || data.phases,
              phases: data.layouts || data.phases,
            }))
          }
          setPlots(data.plots || [])
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [fetchUrl, initialPlots])

  // Active display plots (phase-specific if phases exist, else fallback to props or fetched state)
  const displayPlots = React.useMemo(() => {
    if (currentPhase) {
      const phaseName = (currentPhase.name || `Phase ${currentPhaseIdx + 1}`).trim()
      let pList = Array.isArray(currentPhase.plots) ? currentPhase.plots : []
      if (pList.length > 0 && pList.some((p) => p.phase)) {
        return pList.filter(
          (p) => !p.phase || String(p.phase).trim().toLowerCase() === phaseName.toLowerCase()
        )
      }
      if (pList.length === 0 && Array.isArray(initialPlots) && initialPlots.length > 0) {
        return initialPlots.filter(
          (p) => p.phase && String(p.phase).trim().toLowerCase() === phaseName.toLowerCase()
        )
      }
      if (pList.length === 0 && Array.isArray(plots) && plots.length > 0) {
        return plots.filter(
          (p) => p.phase && String(p.phase).trim().toLowerCase() === phaseName.toLowerCase()
        )
      }
      return pList
    }
    return Array.isArray(initialPlots) ? initialPlots : plots
  }, [currentPhase, currentPhaseIdx, initialPlots, plots])

  const handlePhaseSelect = (idx) => {
    setCurrentPhaseIdx(idx)
    setSelectedPlot(null)
    setHoveredPlot(null)
    if (onPhaseChange) {
      onPhaseChange(idx)
    }
  }

  // Auto-Calculate & Fit Layout: Resizes SVG dimensions based on available viewport size
  const handleResetZoom = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    if (!containerWidth || !containerHeight) return

    const { width: targetW, height: targetH } = parseViewBox(activeViewBox, 1056, 816)

    const isMobile = containerWidth < 768
    const isPortrait = containerHeight > containerWidth

    let fitScale

    if (isMobile && isPortrait && !fitWholeLayout) {
      // On mobile screens, scale the layout so it fills the available viewport properly
      // without excessive empty space or becoming microscopic dots:
      const scaleByWidth = containerWidth / targetW
      const scaleByHeight = containerHeight / targetH

      // Comfortable mobile scale that preserves 1:1 geometry and makes plots clearly visible
      const optimalMobileScale = Math.min(
        Math.max(scaleByWidth * 1.65, scaleByHeight * 0.72, 0.28),
        scaleByHeight * 0.96,
        0.55
      )
      fitScale = optimalMobileScale
    } else {
      // Desktop / Tablet / Landscape view:
      const padX = containerWidth < 900 ? 12 : 28
      const padY = containerHeight < 900 ? 12 : 28
      fitScale = Math.min((containerWidth - padX) / targetW, (containerHeight - padY) / targetH)
    }

    const finalScale = Math.max(fitScale, 0.05)

    // Center the layout in the available viewport
    const initialPanX = (containerWidth - targetW * finalScale) / 2
    const initialPanY = (containerHeight - targetH * finalScale) / 2

    const next = { scale: finalScale, x: initialPanX, y: initialPanY }
    setTransform(next)
    transformRef.current = next
  }, [activeViewBox, fitWholeLayout])

  useEffect(() => {
    handleResetZoom()
  }, [currentPhaseIdx, activeViewBox, activeBackgroundUrl, handleResetZoom])

  useEffect(() => {
    handleResetZoom()
    const container = containerRef.current
    let resizeObserver = null
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        handleResetZoom()
      })
      resizeObserver.observe(container)
    }
    const timer = setTimeout(handleResetZoom, 200)
    window.addEventListener('resize', handleResetZoom)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResetZoom)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [handleResetZoom])

  // Center smoothly on a specific plot (focuses on selected plot)
  const centerOnPlot = useCallback((plot, zoomFactor = null) => {
    if (!containerRef.current || !plot) return
    let labelX = plot.textX
    let labelY = plot.textY

    if (labelX == null || labelY == null) {
      try {
        const centroid = computePathCentroid(plot.svgPath)
        labelX = centroid?.textX
        labelY = centroid?.textY
      } catch {}
    }

    if (labelX == null || labelY == null) return

    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    const currentTransform = transformRef.current

    // Keep comfortable zoom so the plot and context are clearly visible
    const targetScale = zoomFactor
      ? Math.min(Math.max(currentTransform.scale * zoomFactor, 0.1), 4.0)
      : Math.max(currentTransform.scale, 0.6)

    // Vertically offset slightly so bottom popup card does not obscure the plot
    const targetScreenY = containerHeight < 600 ? containerHeight * 0.38 : containerHeight * 0.44
    const newPanX = (containerWidth / 2) - labelX * targetScale
    const newPanY = targetScreenY - labelY * targetScale

    const next = { scale: targetScale, x: newPanX, y: newPanY }
    setTransform(next)
    transformRef.current = next
  }, [])

  // Zoom In / Out Handlers (Focuses on selected plot or cursor position)
  const handleZoom = (factor) => {
    if (!containerRef.current) return
    const current = transformRef.current
    const minAllowed = 0.05
    const maxAllowed = 4.0
    const newScale = Math.min(Math.max(current.scale * factor, minAllowed), maxAllowed)
    if (newScale === current.scale) return

    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight

    // Determine focus anchor:
    // 1. If a plot is selected, focus directly on that plot!
    // 2. Else if user recently hovered cursor inside canvas, focus on that cursor position!
    // 3. Otherwise focus on the viewport center.
    let focusX = containerWidth / 2
    let focusY = containerHeight / 2

    if (selectedPlot) {
      let plotX = selectedPlot.textX
      let plotY = selectedPlot.textY
      if (plotX == null || plotY == null) {
        try {
          const c = computePathCentroid(selectedPlot.svgPath)
          plotX = c?.textX
          plotY = c?.textY
        } catch {}
      }
      if (plotX != null && plotY != null) {
        focusX = current.x + plotX * current.scale
        focusY = current.y + plotY * current.scale
      }
    } else if (lastCursorPosRef.current) {
      focusX = lastCursorPosRef.current.x
      focusY = lastCursorPosRef.current.y
    }

    const newPanX = focusX - ((focusX - current.x) / current.scale) * newScale
    const newPanY = focusY - ((focusY - current.y) / current.scale) * newScale

    const next = { scale: newScale, x: newPanX, y: newPanY }
    setTransform(next)
    transformRef.current = next
  }

  // Mouse Wheel Zoom centered strictly on actual cursor position with atomic transform
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e) => {
      // In embedded mode, require Ctrl/Cmd to zoom so page scroll flows smoothly without interference
      if (!isFullscreen && !isModal && !e.ctrlKey && !e.metaKey) {
        return
      }
      e.preventDefault()

      const rect = container.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      lastCursorPosRef.current = { x: cursorX, y: cursorY }

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85

      setTransform((prev) => {
        const minAllowed = 0.05
        const maxAllowed = 4.0
        const newScale = Math.min(Math.max(prev.scale * zoomFactor, minAllowed), maxAllowed)
        if (newScale === prev.scale) return prev

        const newPanX = cursorX - ((cursorX - prev.x) / prev.scale) * newScale
        const newPanY = cursorY - ((cursorY - prev.y) / prev.scale) * newScale

        const next = { scale: newScale, x: newPanX, y: newPanY }
        transformRef.current = next
        return next
      })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [isFullscreen, isModal])

  // Smooth Pointer Drag Handlers (Captures pointer only on actual drag to preserve plot click events)
  const handlePointerDown = (e) => {
    // Only primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
    panStartRef.current = { x: transformRef.current.x, y: transformRef.current.y }
    hasCapturedRef.current = false
  }

  // Smart tooltip positioning: clamps inside canvas bounds & flips below when near top
  const updateTooltipPosition = (clientX, clientY) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top

    const tipW = tooltipRef.current?.offsetWidth || 210
    const tipH = tooltipRef.current?.offsetHeight || 165
    const halfW = tipW / 2
    const gap = 16

    // Flip below if cursor is too close to top edge of the canvas viewport
    const flipBelow = mouseY < tipH + gap + 20

    // Clamp X so tooltip never clips left or right edge of the container
    const clampedX = Math.max(halfW + 12, Math.min(rect.width - halfW - 12, mouseX))

    // Clamp Y to prevent clipping at bottom if flipped below or top if flipped above
    let clampedY = mouseY
    if (flipBelow) {
      if (mouseY + gap + tipH > rect.height - 12) {
        clampedY = Math.max(0, rect.height - tipH - gap - 12)
      }
    } else {
      if (mouseY - gap - tipH < 12) {
        clampedY = tipH + gap + 12
      }
    }

    setTooltipPos({
      x: clampedX,
      y: clampedY,
      flipBelow,
    })
  }

  const handlePointerMove = (e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    lastCursorPosRef.current = { x: cursorX, y: cursorY }

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y

      // Only capture pointer once drag threshold is exceeded to ensure child click events fire
      if (!hasCapturedRef.current && Math.hypot(dx, dy) > 4) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
          hasCapturedRef.current = true
        } catch {}
      }

      const nextX = panStartRef.current.x + dx
      const nextY = panStartRef.current.y + dy

      setTransform((prev) => {
        const next = { ...prev, x: nextX, y: nextY }
        transformRef.current = next
        return next
      })
    }

    updateTooltipPosition(e.clientX, e.clientY)
  }

  const handlePointerUp = (e) => {
    setIsDragging(false)
    if (hasCapturedRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {}
      hasCapturedRef.current = false
    }
  }

  // Double click to zoom in focused on clicked point
  const handleDoubleClick = (e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    setTransform((prev) => {
      const newScale = Math.min(prev.scale * 1.5, 4.0)
      const newPanX = cursorX - ((cursorX - prev.x) / prev.scale) * newScale
      const newPanY = cursorY - ((cursorY - prev.y) / prev.scale) * newScale
      const next = { scale: newScale, x: newPanX, y: newPanY }
      transformRef.current = next
      return next
    })
  }

  // Touch Handlers for Mobile (Pinch-to-zoom support)
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setIsDragging(false)
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchDistRef.current = dist
    }
  }

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchDistRef.current && containerRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const factor = dist / touchDistRef.current
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = containerRef.current.getBoundingClientRect()
      const cursorX = midX - rect.left
      const cursorY = midY - rect.top

      setTransform((prev) => {
        const minAllowed = 0.05
        const maxAllowed = 4.0
        const newScale = Math.min(Math.max(prev.scale * factor, minAllowed), maxAllowed)
        if (newScale === prev.scale) return prev
        const newPanX = cursorX - ((cursorX - prev.x) / prev.scale) * newScale
        const newPanY = cursorY - ((cursorY - prev.y) / prev.scale) * newScale
        const next = { scale: newScale, x: newPanX, y: newPanY }
        transformRef.current = next
        return next
      })
      touchDistRef.current = dist
    }
  }

  const handleTouchEnd = () => {
    touchDistRef.current = null
  }

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!viewerRef.current) return
    if (!document.fullscreenElement) {
      viewerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Sync Fullscreen with browser native fullscreenchange
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
      setTimeout(() => {
        handleResetZoom()
      }, 100)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [handleResetZoom])

  // Close plot selection or exit modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedPlot) {
          setSelectedPlot(null)
        } else if (onClose) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPlot, onClose])

  // Plot Counts for Filter Controls
  const counts = {
    All: displayPlots.length,
    Available: displayPlots.filter((p) => p.status === 'Available').length,
    Booked: displayPlots.filter((p) => p.status === 'Booked').length,
    Sold: displayPlots.filter((p) => p.status === 'Sold' || p.status === 'Registered').length,
    Blocked: displayPlots.filter((p) => p.status === 'Blocked' || p.status === 'Reserved').length,
  }

  // Filter Match Checker
  const isPlotMatchingFilter = (plot) => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Available') return plot.status === 'Available'
    if (activeFilter === 'Booked') return plot.status === 'Booked'
    if (activeFilter === 'Sold') return plot.status === 'Sold' || plot.status === 'Registered'
    if (activeFilter === 'Booked / Sold') {
      return plot.status === 'Sold' || plot.status === 'Registered' || plot.status === 'Booked'
    }
    if (activeFilter === 'Blocked' || activeFilter === 'Reserved') {
      return plot.status === 'Blocked' || plot.status === 'Reserved'
    }
    return true
  }

  // Build WhatsApp Inquiry URL
  const getWhatsAppUrl = (plot) => {
    if (!plot) return '#'
    const layoutTitle = meta?.title || meta?.name || 'Crystal Estates'
    const boundaryDetails = plot.dimensions ? ` Dimensions: ${plot.dimensions}.` : ''
    const message = `Hello Crystal Estates, I am interested in ${layoutTitle} Plot No ${plot.plotNo} (${plot.area || ''}, ${plot.facing || 'East'} facing).${boundaryDetails} Please share current pricing and schedule a site visit.`
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
  }

  const rawTitle = meta?.title || meta?.name || 'Layout Master Plan'
  const cleanTitle = rawTitle.replace(/\s*\((Phase\s*\d+|Layout\s*\d+)\)/gi, '').trim()
  const layoutTitle =
    currentPhase && layoutPhases && layoutPhases.length > 1
      ? `${cleanTitle} (${currentPhase.name || `Phase ${currentPhaseIdx + 1}`})`
      : rawTitle

  // Status Filter Options for Desktop Buttons & Mobile Dropdown
  const filterOptions = React.useMemo(() => {
    const list = [
      { id: 'All', label: 'All', count: counts.All },
      { id: 'Available', label: 'Available', count: counts.Available, dot: 'avail' },
    ]
    if (counts.Booked > 0) {
      list.push({ id: 'Booked', label: 'Booked', count: counts.Booked, dot: 'booked' })
    }
    if (counts.Sold > 0) {
      list.push({ id: 'Sold', label: 'Sold', count: counts.Sold, dot: 'sold' })
    }
    if (counts.Blocked > 0) {
      list.push({ id: 'Blocked', label: 'Blocked', count: counts.Blocked, dot: 'blocked' })
    }
    return list
  }, [counts.All, counts.Available, counts.Booked, counts.Sold, counts.Blocked])

  return (
    <div
      ref={viewerRef}
      className={`plot-viewer ${isFullscreen ? 'plot-viewer--fullscreen' : ''} ${isModal ? 'plot-viewer--modal' : ''} ${className}`}
    >
      {/* ── Top Header with Project Name & Status Filter ── */}
      <div className="plot-viewer__header">
        <div className="plot-viewer__title-group">
          <h3 className="plot-viewer__title">
            {cleanTitle}
          </h3>
          {/* Phase switch sits with the layout so visitors change phase while looking at it */}
          {layoutPhases && layoutPhases.length > 1 && (
            <div className="pv-phase-tabs" role="tablist" aria-label="Layout phase">
              {layoutPhases.map((ph, idx) => {
                const active = idx === currentPhaseIdx
                const count = Array.isArray(ph.plots) ? ph.plots.length : 0
                return (
                  <button
                    key={ph.id || `phase-${idx}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`pv-phase-tab ${active ? 'pv-phase-tab--active' : ''}`}
                    onClick={() => !active && handlePhaseSelect(idx)}
                    title={count ? `${ph.name || `Phase ${idx + 1}`} · ${count} plots` : undefined}
                  >
                    {ph.name || `Phase ${idx + 1}`}
                    {count > 0 && <span className="pv-phase-tab__count">{count}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="plot-viewer__header-actions">
          {/* Status Filter: segmented pills on desktop, clean dropdown on mobile */}
          {filterOptions.length > 1 && (
            <div className="plot-viewer__status-filter">
              {/* Desktop & Tablet Segmented Pill Filter */}
              <div
                className="plot-viewer__status-filter-desktop"
                role="group"
                aria-label="Filter plots by status"
              >
                {filterOptions.map((opt) => {
                  const isActive = activeFilter === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setActiveFilter(opt.id)}
                      className={`pv-status-btn ${isActive ? 'pv-status-btn--active' : ''}`}
                      title={`Filter by ${opt.label} (${opt.count})`}
                    >
                      {opt.dot && <span className={`pv-status-dot pv-status-dot--${opt.dot}`} />}
                      <span className="pv-status-btn__label">{opt.label}</span>
                      <span className="pv-status-btn__count">{opt.count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Mobile Screen Compact Dropdown */}
              <div className="plot-viewer__status-filter-mobile">
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="pv-status-select"
                  aria-label="Filter plots by status"
                >
                  {filterOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.count})
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="pv-status-select-arrow" />
              </div>
            </div>
          )}

          {/* Opens the 3D layout explorer */}
          {view3dHref && (
            <Link
              href={view3dHref}
              className="pv-fullview-btn pv-view3d-btn"
              title="Explore layout in 3D"
              aria-label="View 3D layout"
            >
              <Box size={15} aria-hidden="true" />
              <span className="pv-fullview-btn__label">View 3D</span>
            </Link>
          )}

          {/* Opens the layout in a larger full-view dialog (page supplies the handler) */}
          {onToggleFullscreen && !isModal && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="pv-fullview-btn"
              title="Open the layout in full view"
              aria-label="Open the layout in full view"
            >
              <Maximize2 size={15} aria-hidden="true" />
              <span className="pv-fullview-btn__label">Full View</span>
            </button>
          )}

          {(onClose || backHref) && (
            <button
              type="button"
              onClick={
                onClose
                  ? onClose
                  : () => {
                      if (backHref) window.location.href = backHref
                      else window.history.back()
                    }
              }
              className="plot-viewer__modal-close-btn"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Canvas Viewport ── */}
      <div
        ref={containerRef}
        className={`plot-viewer__canvas-container ${isDragging ? 'plot-viewer__canvas-container--dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        onClick={(e) => {
          // If clicked on canvas background without panning, dismiss open selection
          const dx = e.clientX - mouseDownPosRef.current.x
          const dy = e.clientY - mouseDownPosRef.current.y
          if (Math.hypot(dx, dy) < 8) {
            setSelectedPlot(null)
            setHoveredPlot(null)
          }
        }}
      >
        {loading && (
          <div className="plot-viewer__loading-overlay">
            <div className="plot-viewer__spinner" />
            <span>Loading layout from database...</span>
          </div>
        )}

        {error && (
          <div className="plot-viewer__error-banner">
            Error loading plots: {error}
          </div>
        )}

        {/* Transform Stage */}
        <div
          className="plot-viewer__map-stage"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            willChange: isDragging ? 'transform' : 'auto',
          }}
        >
          {(() => {
            const { width: stageWidth, height: stageHeight, viewBoxStr } = parseViewBox(activeViewBox, 1056, 816)

            return (
              <div
                className="plot-viewer__map-layers"
                style={{
                  width: `${stageWidth}px`,
                  height: `${stageHeight}px`,
                }}
              >
                {/* 1. True Scalable Vector Inline SVG Blueprint */}
                {inlineSvgContent ? (
                  <div
                    className="plot-viewer__bg-inline"
                    style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                    dangerouslySetInnerHTML={{ __html: inlineSvgContent }}
                  />
                ) : activeBackgroundUrl && !bgLoadError ? (
                  /* Initial preview while vector SVG loads */
                  <img
                    src={activeBackgroundUrl}
                    alt={layoutTitle}
                    className="plot-viewer__bg-image"
                    draggable={false}
                    onError={() => handleBgError(activeBackgroundUrl)}
                  />
                ) : bgLoadError ? (
                  <div className="plot-viewer__bg-blueprint-fallback">
                    <div className="pv-blueprint-watermark">CAD VECTOR PLAN</div>
                    <span className="pv-blueprint-title">{layoutTitle}</span>
                  </div>
                ) : null}

                {/* 2. Interactive SVG Overlay Element (Dynamically fetched from DB) */}
                <svg
                  viewBox={viewBoxStr}
                  className="plot-viewer__overlay-svg"
                  shapeRendering="geometricPrecision"
                  textRendering="geometricPrecision"
                  aria-label="Interactive Plot Overlay"
                >
                  {displayPlots.filter((plot) => Boolean(plot.svgPath && plot.svgPath.trim())).map((plot, plotIdx) => {
                const isMatch = isPlotMatchingFilter(plot)
                const isSelected = selectedPlot
                  ? ((selectedPlot.uid && plot.uid)
                      ? selectedPlot.uid === plot.uid
                      : (selectedPlot._id && plot._id)
                        ? selectedPlot._id === plot._id
                        : selectedPlot.id === plot.id && selectedPlot.plotNo === plot.plotNo)
                  : false
                const plotKey = plot.uid || plot._id || `plot-${plot.id ?? ''}-${plot.plotNo ?? ''}-${plotIdx}`

                return (
                  <g
                    key={plotKey}
                    id={`plot-group-${plot.uid || plot._id || plot.plotNo || plotIdx}`}
                    className={`pv-plot pv-plot--${plot.status} ${isSelected ? 'pv-plot--selected' : ''} ${!isMatch ? 'pv-plot--dimmed' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setHoveredPlot(null)
                      setSelectedPlot(plot)
                      centerOnPlot(plot)
                      if (onPlotSelect) onPlotSelect(plot)
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Plot Number ${plot.plotNo}, Status: ${plot.status}, Area: ${plot.area}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedPlot(plot)
                        centerOnPlot(plot)
                      }
                    }}
                  >
                    {/* Boundary Path */}
                    <path
                      d={plot.svgPath}
                      className="pv-plot__boundary"
                    />

                    {/* Centered Plot Number Label directly inside plot (No circular background) */}
                    {(() => {
                      const displayNo = formatPlotNumberOnly(plot.plotNo)
                      if (!displayNo) return null

                      let centroid = null
                      try {
                        centroid = computePathCentroid(plot.svgPath)
                      } catch {
                        // ignore malformed path
                      }
                      const hasFiniteTextCoords =
                        Number.isFinite(Number(plot.textX)) &&
                        Number.isFinite(Number(plot.textY)) &&
                        plot.textX !== null &&
                        plot.textY !== null
                      const tx = hasFiniteTextCoords ? Number(plot.textX) : null
                      const ty = hasFiniteTextCoords ? Number(plot.textY) : null
                      const isExplicitValid =
                        tx !== null &&
                        ty !== null &&
                        (!centroid || (
                          tx >= centroid.minX &&
                          tx <= centroid.maxX &&
                          ty >= centroid.minY &&
                          ty <= centroid.maxY
                        ))
                      const labelX = isExplicitValid ? tx : (centroid?.textX ?? tx ?? 0)
                      const labelY = isExplicitValid ? ty : (centroid?.textY ?? ty ?? 0)

                      // Compute font size based on plot bounding box dimensions and digit count so it fits cleanly
                      let fontSize = 8.5
                      if (centroid) {
                        const pw = centroid.maxX - centroid.minX
                        const ph = centroid.maxY - centroid.minY
                        const minDim = Math.min(pw, ph)
                        if (pw > 0 && ph > 0) {
                          const maxByWidth = (pw * 0.78) / Math.max(1, displayNo.length * 0.65)
                          const maxByHeight = ph * 0.52
                          const ideal = Math.min(minDim * 0.36, maxByWidth, maxByHeight)
                          fontSize = Math.min(Math.max(ideal, 3.5), 13)
                        }
                      }

                      return (
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          stroke="none"
                          className="pv-plot__label-text"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {displayNo}
                        </text>
                      )
                    })()}
                  </g>
                )
              })}
            </svg>
          </div>
        )
      })()}
    </div>

        {/* ── Floating Zoom Controls Toolbar ── */}
        <div className="plot-viewer__controls" role="toolbar" aria-label="Map zoom and navigation controls">
          <button
            type="button"
            className="pv-control-btn"
            onClick={() => handleZoom(1.25)}
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <ZoomIn size={18} />
          </button>

          <span className="plot-viewer__zoom-level" title="Zoom Percentage">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            className="pv-control-btn"
            onClick={() => handleZoom(0.8)}
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>

          <button
            type="button"
            className="pv-control-btn pv-control-btn--resize"
            onClick={handleResetZoom}
            title="Resize to Fit Screen"
            aria-label="Resize to Fit Screen"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* ── Instruction Pill (Hidden when plot details card is open) ── */}
        {!selectedPlot && (
          <div className="plot-viewer__helper-pill">
            <Info size={14} />
            <span>Click & drag to pan • Scroll to zoom • Click plot for details</span>
          </div>
        )}

        {/* ── Hover Tooltip Card (Only when no plot is selected and non-touch) ── */}
        {hoveredPlot && !selectedPlot && !isTouchDevice && !isDragging && (
          <div
            ref={tooltipRef}
            className={`pv-tooltip ${tooltipPos.flipBelow ? 'pv-tooltip--bottom' : ''}`}
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
            }}
          >
            <div className="pv-tooltip__header">
              <h4 className="pv-tooltip__title">Plot {hoveredPlot.plotNo}</h4>
              <span className={`pv-tooltip__status pv-tooltip__status--${hoveredPlot.status}`}>
                {hoveredPlot.status}
              </span>
            </div>
            <div className="pv-tooltip__grid">
              <span className="pv-tooltip__label">Facing:</span>
              <span className="pv-tooltip__val">{hoveredPlot.facing || 'East'}</span>
              <span className="pv-tooltip__label">Area:</span>
              <span className="pv-tooltip__val">{hoveredPlot.area}</span>
              {(hoveredPlot.dimensions || hoveredPlot.width || hoveredPlot.length) && (
                <>
                  <span className="pv-tooltip__label">Dimensions:</span>
                  <span className="pv-tooltip__val pv-tooltip__val--dimensions" title={hoveredPlot.dimensions || `${hoveredPlot.width || ''} × ${hoveredPlot.length || ''}`}>
                    {hoveredPlot.dimensions || `${hoveredPlot.width || ''} × ${hoveredPlot.length || ''}`}
                  </span>
                </>
              )}
            </div>
            <div className="pv-tooltip__hint">Click for full details & WhatsApp inquiry</div>
          </div>
        )}

        {/* ── Selected Plot Bottom Popup Card (Positioned at bottom of screen) ── */}
        {selectedPlot && (
          <div
            className="pv-bottom-card pv-tiny-card"
            key={`selected-plot-${selectedPlot.plotNo}-${selectedPlot.id || ''}`}
            role="dialog"
            aria-label={`Plot No ${selectedPlot.plotNo} Details`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Header: Title + Status + Extent Pill + Close */}
            <div className="pv-bottom-card__header pv-tiny-card__header">
              <div className="pv-bottom-card__title-wrap pv-tiny-card__title-wrap">
                <span className="pv-bottom-card__title pv-tiny-card__title">Plot {selectedPlot.plotNo}</span>
                <span className={`pv-bottom-card__badge pv-tiny-card__badge pv-tiny-card__badge--${selectedPlot.status}`}>
                  {selectedPlot.status}
                </span>
                {selectedPlot.area && (
                  <span className="pv-bottom-card__extent-pill">
                    {selectedPlot.area}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="pv-bottom-card__close pv-tiny-card__close"
                onClick={() => setSelectedPlot(null)}
                aria-label="Close plot details"
                title="Close (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Quick Compact Specs Grid */}
            <div className="pv-bottom-card__specs pv-tiny-card__specs">
              <div className="pv-bottom-card__spec pv-tiny-card__spec">
                <span className="pv-bottom-card__label pv-tiny-card__label">Extent</span>
                <strong className="pv-bottom-card__val pv-tiny-card__val">{selectedPlot.area}</strong>
              </div>
              <div className="pv-bottom-card__spec pv-tiny-card__spec">
                <span className="pv-bottom-card__label pv-tiny-card__label">Facing</span>
                <strong className="pv-bottom-card__val pv-tiny-card__val">{selectedPlot.facing || 'East'}</strong>
              </div>
              {(selectedPlot.width || selectedPlot.length) ? (
                <div className="pv-bottom-card__spec pv-tiny-card__spec">
                  <span className="pv-bottom-card__label pv-tiny-card__label">W × L</span>
                  <strong className="pv-bottom-card__val pv-tiny-card__val">
                    {`${selectedPlot.width || '—'} × ${selectedPlot.length || '—'}`}
                  </strong>
                </div>
              ) : selectedPlot.dimensions ? (
                <div className="pv-bottom-card__spec pv-tiny-card__spec pv-tiny-card__spec--full">
                  <span className="pv-bottom-card__label pv-tiny-card__label">Dimensions</span>
                  <strong className="pv-bottom-card__val pv-tiny-card__val" title={selectedPlot.dimensions}>
                    {selectedPlot.dimensions}
                  </strong>
                </div>
              ) : null}
              {selectedPlot.price && (
                <div className="pv-bottom-card__spec pv-tiny-card__spec pv-bottom-card__spec--price">
                  <span className="pv-bottom-card__label pv-tiny-card__label">Price</span>
                  <strong className="pv-bottom-card__val pv-tiny-card__val pv-tiny-card__val--price">{selectedPlot.price}</strong>
                </div>
              )}
            </div>

            {/* Excel-based Boundary Dimensions (N, S, E, W in ft) */}
            {(selectedPlot.north != null || selectedPlot.south != null || selectedPlot.east != null || selectedPlot.west != null) && (
              <div className="pv-bottom-card__boundaries pv-tiny-card__boundaries">
                <div className="pv-bottom-card__boundaries-header pv-tiny-card__boundaries-header">
                  <span className="pv-bottom-card__boundaries-title pv-tiny-card__boundaries-title">Boundary Dimensions (Excel)</span>
                </div>
                <div className="pv-bottom-card__boundaries-grid pv-tiny-card__boundaries-grid">
                  <div className={`pv-boundary-chip ${selectedPlot.north != null ? 'pv-boundary-chip--active' : ''}`}>
                    <span className="pv-boundary-chip__dir">North</span>
                    <span className="pv-boundary-chip__val">{selectedPlot.north != null ? `${selectedPlot.north}'` : '—'}</span>
                  </div>
                  <div className={`pv-boundary-chip ${selectedPlot.south != null ? 'pv-boundary-chip--active' : ''}`}>
                    <span className="pv-boundary-chip__dir">South</span>
                    <span className="pv-boundary-chip__val">{selectedPlot.south != null ? `${selectedPlot.south}'` : '—'}</span>
                  </div>
                  <div className={`pv-boundary-chip ${selectedPlot.east != null ? 'pv-boundary-chip--active' : ''}`}>
                    <span className="pv-boundary-chip__dir">East</span>
                    <span className="pv-boundary-chip__val">{selectedPlot.east != null ? `${selectedPlot.east}'` : '—'}</span>
                  </div>
                  <div className={`pv-boundary-chip ${selectedPlot.west != null ? 'pv-boundary-chip--active' : ''}`}>
                    <span className="pv-boundary-chip__dir">West</span>
                    <span className="pv-boundary-chip__val">{selectedPlot.west != null ? `${selectedPlot.west}'` : '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Compact WhatsApp Action */}
            <div className="pv-bottom-card__footer">
              <a
                href={getWhatsAppUrl(selectedPlot)}
                target="_blank"
                rel="noopener noreferrer"
                className="pv-bottom-card__btn-wa pv-tiny-card__btn-wa"
              >
                <WhatsAppIcon size={15} />
                <span>Enquire Plot {selectedPlot.plotNo} on WhatsApp</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
