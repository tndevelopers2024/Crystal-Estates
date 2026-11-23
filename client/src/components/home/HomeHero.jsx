'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, Layers, Trees, ShieldCheck, Compass } from 'lucide-react'
import { openSiteVisit } from './motion'

const TOTAL_FRAMES = 150

// Frame URL generator for the 150 sequence images
const getFrameUrl = (index) => {
  const num = String(index + 1).padStart(3, '0')
  return `/images/sequence/ezgif-frame-${num}.jpg`
}

export default function HomeHero() {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const targetProgress = useRef(0)
  const currentProgress = useRef(0)
  const activeFrameRef = useRef(-1)
  const stageRefs = useRef([])

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
      // Fallback: If target frame is still loading, find nearest available
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
      }
    },
    [drawCover],
  )

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

    // Immediate Frame 1 load
    const firstImg = new Image()
    firstImg.src = getFrameUrl(0)
    firstImg.onload = () => {
      if (cancelled) return
      imagesRef.current[0] = firstImg
      handleResize()
      renderFrame(0)
    }

    // Background progressive loading
    let nextIdx = 1
    const loadBatch = (batchSize = 8) => {
      if (cancelled || nextIdx >= TOTAL_FRAMES) return
      const end = Math.min(nextIdx + batchSize, TOTAL_FRAMES)
      for (let i = nextIdx; i < end; i += 1) {
        const frameIdx = i
        const img = new Image()
        img.src = getFrameUrl(frameIdx)
        img.onload = () => {
          if (cancelled) return
          imagesRef.current[frameIdx] = img
        }
      }
      nextIdx = end
      if (nextIdx < TOTAL_FRAMES) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => loadBatch(batchSize))
        } else {
          setTimeout(() => loadBatch(batchSize), 50)
        }
      }
    }

    const timer = setTimeout(() => loadBatch(8), 50)
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [handleResize, renderFrame])

  // ─────────────────────────────────────────────────────────────
  // 3. SCROLL PROGRESSION & CONTENT TIMING
  // Alternating positions:
  // Stage 1: Bottom-Left (0.00 to 0.22)
  // Stage 2: Top-Right   (0.26 to 0.48)
  // Stage 3: Bottom-Left (0.52 to 0.74)
  // Stage 4: Top-Right   (0.78 to 0.98)
  // ─────────────────────────────────────────────────────────────
  const STAGE_CONFIGS = [
    { start: 0.0, peakStart: 0.0, peakEnd: 0.16, end: 0.22 },
    { start: 0.26, peakStart: 0.31, peakEnd: 0.43, end: 0.48 },
    { start: 0.52, peakStart: 0.57, peakEnd: 0.69, end: 0.74 },
    { start: 0.78, peakStart: 0.83, peakEnd: 0.94, end: 0.99 },
  ]

  useEffect(() => {
    let rafId = null

    const tick = () => {
      // Lerp for smooth deceleration
      const diff = targetProgress.current - currentProgress.current
      if (Math.abs(diff) > 0.0004) {
        currentProgress.current += diff * 0.18
      } else {
        currentProgress.current = targetProgress.current
      }

      const p = currentProgress.current

      // Advance/reverse frame sequence
      const frameIdx = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.floor(p * (TOTAL_FRAMES - 1))),
      )
      renderFrame(frameIdx)

      // Drive content cards transitions smoothly
      STAGE_CONFIGS.forEach((cfg, idx) => {
        const el = stageRefs.current[idx]
        if (!el) return

        if (p < cfg.start || p > cfg.end) {
          el.style.opacity = '0'
          el.style.transform = 'translate3d(0, 20px, 0)'
          el.style.pointerEvents = 'none'
          el.style.visibility = 'hidden'
          return
        }

        el.style.visibility = 'visible'
        el.style.pointerEvents = 'auto'

        let opacity = 0
        let translateY = 0

        if (p < cfg.peakStart) {
          // Entrance
          const t = (p - cfg.start) / Math.max(0.01, cfg.peakStart - cfg.start)
          opacity = Math.min(1, Math.max(0, t))
          translateY = (1 - opacity) * 20
        } else if (p > cfg.peakEnd) {
          // Exit
          const t = (p - cfg.peakEnd) / Math.max(0.01, cfg.end - cfg.peakEnd)
          opacity = Math.min(1, Math.max(0, 1 - t))
          translateY = -t * 20
        } else {
          // Full hold
          opacity = 1
          translateY = 0
        }

        el.style.opacity = opacity.toFixed(3)
        el.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`
      })

      rafId = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      if (scrollable <= 0) return

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
    <section id="home" ref={sectionRef} className="ch-hero" aria-label="Crystal Estates Home Hero">
      <div className="ch-hero__frame">
        {/* Fullscreen Canvas Frame Sequence */}
        <canvas ref={canvasRef} className="ch-hero__canvas" />

        {/* 10% subtle dark overlay */}
        <div className="ch-hero__overlay-10" aria-hidden="true" />

        {/* Dynamic Vignette Shades for optimal contrast */}
        <div className="ch-hero__shade" aria-hidden="true" />
        <div className="ch-hero__shade-top" aria-hidden="true" />

        {/* ─────────────────────────────────────────────────────────────
            STAGE 1 (Bottom-Left) — Primary Minimal Hero Statement
            Matches Reference Image 2
            ───────────────────────────────────────────────────────────── */}
        <div
          ref={(el) => {
            stageRefs.current[0] = el
          }}
          className="ch-hero__stage ch-hero__stage--bottom-left"
        >
          <div className="ch-hero__left-content">
            <h1 className="ch-hero__headline">
              Building the future<br />that you can own.
            </h1>
            <p className="ch-hero__lead">
              We create CMDA &amp; DTCP approved plotted communities and clear-title lands across Chennai.
            </p>
            <div className="ch-hero__actions">
              <button
                type="button"
                onClick={openSiteVisit}
                className="ch-hero__cta-primary"
                aria-label="Get In Touch"
              >
                Get In Touch
              </button>
              <Link href="/projects" className="ch-hero__cta-secondary" aria-label="Explore Plots">
                <span>Explore plots</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STAGE 2 (Top-Right) — Connectivity & Access
            Matches Reference Image 1
            ───────────────────────────────────────────────────────────── */}
        <div
          ref={(el) => {
            stageRefs.current[1] = el
          }}
          className="ch-hero__stage ch-hero__stage--top-right"
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          <div className="ch-hero__glass-card">
            <div className="ch-hero__card-top">
              <span className="ch-hero__card-step">02</span>
              <span className="ch-hero__card-badge">Connectivity &amp; Access</span>
            </div>
            <h2 className="ch-hero__card-title">
              Demarcated Roads &amp; Direct Highway Reach
            </h2>
            <p className="ch-hero__card-desc">
              Motorable 40-ft and 30-ft blacktop avenues branching directly through mature tree canopies, providing instant access to growth corridors.
            </p>
            <div className="ch-hero__card-pills">
              <span className="ch-hero__pill">
                <MapPin size={13} className="ch-hero__pill-icon" />
                <span>40ft &amp; 30ft Blacktop Roads</span>
              </span>
              <span className="ch-hero__pill">
                <Layers size={13} className="ch-hero__pill-icon" />
                <span>CMDA &amp; DTCP Norms</span>
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STAGE 3 (Bottom-Left) — Topography & Sweet Water
            Alternates back to Bottom-Left
            ───────────────────────────────────────────────────────────── */}
        <div
          ref={(el) => {
            stageRefs.current[2] = el
          }}
          className="ch-hero__stage ch-hero__stage--bottom-left"
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          <div className="ch-hero__glass-card">
            <div className="ch-hero__card-top">
              <span className="ch-hero__card-step">03</span>
              <span className="ch-hero__card-badge">Topography &amp; Ecology</span>
            </div>
            <h2 className="ch-hero__card-title">
              Fertile Ground &amp; Abundant Potable Water
            </h2>
            <p className="ch-hero__card-desc">
              Naturally elevated, flood-resilient terrain blessed with sweet groundwater tables, surrounded by permanent green buffer zones.
            </p>
            <div className="ch-hero__card-pills">
              <span className="ch-hero__pill">
                <Trees size={13} className="ch-hero__pill-icon" />
                <span>Sweet Water Table</span>
              </span>
              <span className="ch-hero__pill">
                <ShieldCheck size={13} className="ch-hero__pill-icon" />
                <span>Flood-Free Natural Elevation</span>
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STAGE 4 (Top-Right) — Asset Creation & Final CTA
            Alternates back to Top-Right
            ───────────────────────────────────────────────────────────── */}
        <div
          ref={(el) => {
            stageRefs.current[3] = el
          }}
          className="ch-hero__stage ch-hero__stage--top-right"
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          <div className="ch-hero__glass-card">
            <div className="ch-hero__card-top">
              <span className="ch-hero__card-step">04</span>
              <span className="ch-hero__card-badge">Asset Creation</span>
            </div>
            <h2 className="ch-hero__card-title">
              Your Legacy Demarcated on Ground
            </h2>
            <p className="ch-hero__card-desc">
              Physically marked boundary stones, transparent developer pricing, on-the-spot registration, and assisted individual patta transfer.
            </p>
            <div className="ch-hero__card-pills">
              <span className="ch-hero__pill">
                <ShieldCheck size={13} className="ch-hero__pill-icon" />
                <span>Spot Registration Guidance</span>
              </span>
              <span className="ch-hero__pill">
                <Compass size={13} className="ch-hero__pill-icon" />
                <span>Individual Patta Assistance</span>
              </span>
            </div>
            <div className="ch-hero__card-actions">
              <Link href="/projects" className="ch-hero__cta-primary" aria-label="Explore All Plots">
                <span>Explore plots</span>
                <ArrowRight size={15} style={{ marginLeft: 6 }} />
              </Link>
              <button
                type="button"
                onClick={openSiteVisit}
                className="ch-hero__cta-secondary"
                aria-label="Get In Touch"
              >
                Get In Touch
              </button>
            </div>
          </div>
        </div>

        {/* Subtle Bottom Progress Track */}
        <div className="ch-hero__track" aria-hidden="true" />
      </div>
    </section>
  )
}
