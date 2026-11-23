'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Compass,
  MapPin,
  Trees,
  ShieldCheck,
  ArrowRight,
  MousePointer,
  Layers,
  ChevronDown,
} from 'lucide-react'
import './FrameScrollSequence.css'

const TOTAL_FRAMES = 150

// Frame URL builder for the 150 sequence images
const getFrameUrl = (index) => {
  const num = String(index + 1).padStart(3, '0')
  return `/images/sequence/ezgif-frame-${num}.jpg`
}

// Content stages configured in the requested alternating pattern:
// 1. Bottom-left
// 2. Top-right
// 3. Bottom-left
// 4. Top-right
const STAGES = [
  {
    id: 'stage-1',
    step: '01',
    position: 'bottom-left',
    start: 0.03,
    peakStart: 0.08,
    peakEnd: 0.19,
    end: 0.24,
    badge: 'Aerial Expanse',
    title: 'Vast Horizons. Vetted Acreage.',
    desc: 'Contiguous, high-yield land parcels surveyed and vetted through 30-year revenue scrutiny. Unbroken natural acreage primed for generational value.',
    pills: [
      { icon: Compass, label: '30-Yr Legal Scrutiny' },
      { icon: ShieldCheck, label: '100% Clear Title Patta' },
    ],
  },
  {
    id: 'stage-2',
    step: '02',
    position: 'top-right',
    start: 0.27,
    peakStart: 0.32,
    peakEnd: 0.43,
    end: 0.48,
    badge: 'Connectivity & Access',
    title: 'Demarcated Roads & Direct Highway Reach',
    desc: 'Motorable 40-ft and 30-ft blacktop avenues branching directly through mature tree canopies, providing instant access to growth corridors.',
    pills: [
      { icon: MapPin, label: '40ft & 30ft Blacktop Roads' },
      { icon: Layers, label: 'CMDA & DTCP Norms' },
    ],
  },
  {
    id: 'stage-3',
    step: '03',
    position: 'bottom-left',
    start: 0.51,
    peakStart: 0.56,
    peakEnd: 0.67,
    end: 0.72,
    badge: 'Topography & Ecology',
    title: 'Fertile Soil. Abundant Potable Water.',
    desc: 'Naturally elevated, flood-resilient terrain blessed with sweet groundwater tables, surrounded by permanent green buffer zones.',
    pills: [
      { icon: Trees, label: 'Sweet Water Table' },
      { icon: ShieldCheck, label: 'Flood-Free Natural Elevation' },
    ],
  },
  {
    id: 'stage-4',
    step: '04',
    position: 'top-right',
    start: 0.75,
    peakStart: 0.80,
    peakEnd: 0.93,
    end: 0.98,
    badge: 'Asset Creation',
    title: 'Your Legacy Demarcated on Ground',
    desc: 'Physically marked boundary stones, transparent developer pricing, on-the-spot registration, and assisted individual patta transfer.',
    pills: [
      { icon: ShieldCheck, label: 'Spot Registration Guidance' },
      { icon: Compass, label: 'Individual Patta Transfer' },
    ],
    cta: {
      text: 'Explore Available Layouts',
      href: '/projects',
    },
  },
]

export default function FrameScrollSequence() {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const targetProgress = useRef(0)
  const currentProgress = useRef(0)
  const activeFrameRef = useRef(-1)
  const isLoopRunning = useRef(false)
  const cardRefs = useRef([])

  const [loadedCount, setLoadedCount] = useState(0)
  const [isFirstFrameReady, setIsFirstFrameReady] = useState(false)
  const [hudFrame, setHudFrame] = useState(1)
  const [hudProgress, setHudProgress] = useState(0)
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  // ─────────────────────────────────────────────────────────────
  // 1. CANVAS RENDERING ENGINE (High DPI + Object-Fit: Cover)
  // ─────────────────────────────────────────────────────────────
  const drawCover = useCallback((img) => {
    const canvas = canvasRef.current
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height
    const iw = img.naturalWidth
    const ih = img.naturalHeight

    const imgRatio = iw / ih
    const canvasRatio = cw / ch

    let dw, dh, dx, dy
    if (canvasRatio > imgRatio) {
      dw = cw
      dh = cw / imgRatio
      dx = 0
      dy = (ch - dh) / 2
    } else {
      dh = ch
      dw = ch * imgRatio
      dx = (cw - dw) / 2
      dy = 0
    }

    ctx.drawImage(img, dx, dy, dw, dh)
  }, [])

  const renderFrame = useCallback(
    (targetIndex) => {
      const idx = Math.min(TOTAL_FRAMES - 1, Math.max(0, targetIndex))
      if (idx === activeFrameRef.current) return

      let img = imagesRef.current[idx]
      // Fallback: If current frame is still decoding, find nearest available
      if (!img || !img.complete || img.naturalWidth === 0) {
        for (let offset = 1; offset < TOTAL_FRAMES; offset += 1) {
          const prev = imagesRef.current[idx - offset]
          if (prev && prev.complete && prev.naturalWidth > 0) {
            img = prev
            break
          }
          const next = imagesRef.current[idx + offset]
          if (next && next.complete && next.naturalWidth > 0) {
            img = next
            break
          }
        }
      }

      if (img && img.complete && img.naturalWidth > 0) {
        drawCover(img)
        activeFrameRef.current = idx
        setHudFrame(idx + 1)
      }
    },
    [drawCover],
  )

  // Resize handler with DPR scaling
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    const w = Math.round(rect.width * dpr)
    const h = Math.round(rect.height * dpr)

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      activeFrameRef.current = -1
      renderFrame(Math.round(currentProgress.current * (TOTAL_FRAMES - 1)))
    }
  }, [renderFrame])

  // ─────────────────────────────────────────────────────────────
  // 2. PROGRESSIVE PRELOADER
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    imagesRef.current = new Array(TOTAL_FRAMES).fill(null)

    // A. Priority 1: Load Frame 1 immediately
    const firstImg = new Image()
    firstImg.src = getFrameUrl(0)
    firstImg.onload = () => {
      if (cancelled) return
      imagesRef.current[0] = firstImg
      setIsFirstFrameReady(true)
      setLoadedCount((c) => c + 1)
      handleResize()
      renderFrame(0)
    }

    // B. Priority 2: Preload key milestones & progressive chunks
    let nextIdx = 1
    const loadBatch = (batchSize = 6) => {
      if (cancelled || nextIdx >= TOTAL_FRAMES) return
      const end = Math.min(nextIdx + batchSize, TOTAL_FRAMES)
      for (let i = nextIdx; i < end; i += 1) {
        const frameIdx = i
        const img = new Image()
        img.src = getFrameUrl(frameIdx)
        img.onload = () => {
          if (cancelled) return
          imagesRef.current[frameIdx] = img
          setLoadedCount((c) => c + 1)
        }
        img.onerror = () => {
          if (cancelled) return
          // retry fallback if needed
        }
      }
      nextIdx = end
      if (nextIdx < TOTAL_FRAMES) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => loadBatch(batchSize))
        } else {
          setTimeout(() => loadBatch(batchSize), 60)
        }
      }
    }

    // Start background batch after frame 1 is requested
    const timer = setTimeout(() => loadBatch(8), 50)

    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [handleResize, renderFrame])

  // ─────────────────────────────────────────────────────────────
  // 3. 60/120FPS HARDWARE-ACCELERATED SCROLL RAF LOOP
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let rafId = null

    const tick = () => {
      // Lerp progress for buttery-smooth deceleration
      const diff = targetProgress.current - currentProgress.current
      if (Math.abs(diff) > 0.0004) {
        currentProgress.current += diff * 0.18
      } else {
        currentProgress.current = targetProgress.current
      }

      const p = currentProgress.current
      setHudProgress(Math.round(p * 100))

      // 1. Advance or rewind frame sequence
      const frameIdx = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.floor(p * (TOTAL_FRAMES - 1))),
      )
      renderFrame(frameIdx)

      // 2. Animate content cards with elegant fade & subtle vertical motion
      let activeIdx = 0
      STAGES.forEach((stage, idx) => {
        const el = cardRefs.current[idx]
        if (!el) return

        if (p < stage.start || p > stage.end) {
          el.style.opacity = '0'
          el.style.transform = 'translate3d(0, 24px, 0)'
          el.style.pointerEvents = 'none'
          el.style.visibility = 'hidden'
          return
        }

        activeIdx = idx
        el.style.visibility = 'visible'
        el.style.pointerEvents = 'auto'

        let opacity = 0
        let translateY = 0

        if (p < stage.peakStart) {
          // Entrance: fade in + glide up into place
          const t = (p - stage.start) / (stage.peakStart - stage.start)
          opacity = Math.min(1, Math.max(0, t))
          translateY = (1 - opacity) * 22
        } else if (p > stage.peakEnd) {
          // Exit: fade out + continue floating gently upward
          const t = (p - stage.peakEnd) / (stage.end - stage.peakEnd)
          opacity = Math.min(1, Math.max(0, 1 - t))
          translateY = -t * 22
        } else {
          // Full peak visibility
          opacity = 1
          translateY = 0
        }

        el.style.opacity = opacity.toFixed(3)
        el.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`
      })

      setActiveStageIndex(activeIdx)

      rafId = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      if (scrollable <= 0) return

      // Progress through the sticky section: 0 to 1
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable))
      targetProgress.current = progress
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [renderFrame])

  return (
    <section
      ref={containerRef}
      className="ce-fbf-section"
      aria-label="Interactive aerial plot sequence"
    >
      {/* Pinned full-screen viewport */}
      <div className="ce-fbf-sticky">
        {/* Hardware-accelerated canvas */}
        <canvas ref={canvasRef} className="ce-fbf-canvas" />

        {/* Cinematic Vignette & Readability Gradient Mesh */}
        <div className="ce-fbf-overlay" aria-hidden="true" />

        {/* Flight HUD / Indicator Bar */}
        <div className="ce-fbf-hud" aria-hidden="true">
          <div className="ce-fbf-hud__tag">
            <span className="ce-fbf-hud__pulse" />
            <span className="ce-fbf-hud__label">AERIAL INSPECTION FLIGHT</span>
          </div>
          <div className="ce-fbf-hud__metrics">
            <span className="ce-fbf-hud__stat">
              FRAME <b>{String(hudFrame).padStart(3, '0')}</b> / {TOTAL_FRAMES}
            </span>
            <span className="ce-fbf-hud__divider">·</span>
            <span className="ce-fbf-hud__stat">
              ALTITUDE <b>{hudProgress}%</b>
            </span>
          </div>
        </div>

        {/* Initial Scroll Prompt (Fades away once user starts scrolling) */}
        <div
          className={`ce-fbf-scroll-prompt ${hudProgress > 4 ? 'is-hidden' : ''}`}
          aria-hidden="true"
        >
          <div className="ce-fbf-scroll-prompt__mouse">
            <span className="ce-fbf-scroll-prompt__wheel" />
          </div>
          <span className="ce-fbf-scroll-prompt__text">Scroll to glide over the land</span>
          <ChevronDown className="ce-fbf-scroll-prompt__icon" size={16} />
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4 Progressive Content Cards (Alternating: BL -> TR -> BL -> TR)
            ───────────────────────────────────────────────────────────── */}
        <div className="ce-fbf-cards-stage">
          {STAGES.map((stage, idx) => (
            <article
              key={stage.id}
              ref={(el) => {
                cardRefs.current[idx] = el
              }}
              className={`ce-fbf-card ce-fbf-card--${stage.position}`}
              aria-label={stage.title}
            >
              <div className="ce-fbf-card__inner">
                {/* Header: Stage Step + Badge */}
                <div className="ce-fbf-card__top">
                  <span className="ce-fbf-card__step">{stage.step}</span>
                  <span className="ce-fbf-card__badge">{stage.badge}</span>
                </div>

                {/* Title */}
                <h3 className="ce-fbf-card__title">{stage.title}</h3>

                {/* Description */}
                <p className="ce-fbf-card__desc">{stage.desc}</p>

                {/* Value Micro-Pills */}
                <div className="ce-fbf-card__pills">
                  {stage.pills.map((pill, pIdx) => {
                    const IconComponent = pill.icon
                    return (
                      <span key={pIdx} className="ce-fbf-pill">
                        <IconComponent className="ce-fbf-pill__icon" size={13} />
                        <span className="ce-fbf-pill__label">{pill.label}</span>
                      </span>
                    )
                  })}
                </div>

                {/* Optional Final Stage CTA */}
                {stage.cta && (
                  <div className="ce-fbf-card__action">
                    <Link href={stage.cta.href} className="ce-fbf-cta-btn">
                      <span>{stage.cta.text}</span>
                      <ArrowRight size={16} className="ce-fbf-cta-btn__arrow" />
                    </Link>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Subtle Bottom Progress Track */}
        <div className="ce-fbf-track" aria-hidden="true">
          <div
            className="ce-fbf-track__fill"
            style={{ width: `${hudProgress}%` }}
          />
          {STAGES.map((s, i) => (
            <span
              key={s.id}
              className={`ce-fbf-track__point ${i <= activeStageIndex ? 'is-passed' : ''}`}
              style={{ left: `${((s.peakStart + s.peakEnd) / 2) * 100}%` }}
              title={s.badge}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
