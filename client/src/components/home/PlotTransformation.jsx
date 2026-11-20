'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Sparkles, ArrowRight, Home as HomeIcon, CheckCircle2 } from 'lucide-react'
import './PlotTransformation.css'

// Organic, irregular fluid splash mask with soft feathered blurred edges (NOT a circle)
const ORGANIC_SPLASH_SVG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240' width='240' height='240'><defs><filter id='f' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='8'/></filter></defs><g filter='url(%23f)' fill='%23000'><path d='M 120 28 C 142 22, 168 38, 178 58 C 188 78, 165 98, 195 118 C 218 134, 204 165, 175 178 C 148 190, 138 214, 115 212 C 90 210, 84 185, 62 188 C 36 191, 22 165, 30 140 C 36 120, 58 114, 45 92 C 30 66, 62 38, 92 48 C 105 52, 108 32, 120 28 Z'/><circle cx='195' cy='72' r='8.5'/><circle cx='212' cy='128' r='6'/><circle cx='182' cy='198' r='7.5'/><circle cx='128' cy='224' r='5'/><circle cx='48' cy='202' r='7'/><circle cx='18' cy='122' r='8'/><circle cx='28' cy='62' r='6.5'/><circle cx='76' cy='22' r='7'/><circle cx='154' cy='18' r='5'/></g></svg>")`

export default function PlotTransformation() {
  const containerRef = useRef(null)
  const revealLayerRef = useRef(null)

  const [isHovered, setIsHovered] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const target = useRef({ x: 0, y: 0, r: 0 })
  const current = useRef({ x: 0, y: 0, r: 0 })
  const isHovering = useRef(false)
  const rafId = useRef(null)
  const touchTimer = useRef(null)

  // Reveal radius around cursor (~100px as requested)
  const SPLASH_RADIUS = 100

  // Detect touch capability for mobile devices
  useEffect(() => {
    if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      setIsTouchDevice(true)
    }
  }, [])

  // 60/120fps hardware-accelerated lerp loop with organic irregular splash mask
  const renderFrame = useCallback(() => {
    const t = target.current
    const c = current.current

    // Spring-lerp calculation for butter-smooth organic tracking
    c.x += (t.x - c.x) * 0.28
    c.y += (t.y - c.y) * 0.28
    c.r += (t.r - c.r) * 0.22

    if (revealLayerRef.current) {
      if (c.r > 0.5) {
        // ~100px radius = ~220px total splash bounding box
        const size = c.r * 2.2
        const offset = size / 2
        const posX = (c.x - offset).toFixed(1)
        const posY = (c.y - offset).toFixed(1)

        const layerStyle = revealLayerRef.current.style
        layerStyle.webkitMaskImage = ORGANIC_SPLASH_SVG
        layerStyle.maskImage = ORGANIC_SPLASH_SVG
        layerStyle.webkitMaskPosition = `${posX}px ${posY}px`
        layerStyle.maskPosition = `${posX}px ${posY}px`
        layerStyle.webkitMaskSize = `${size.toFixed(1)}px ${size.toFixed(1)}px`
        layerStyle.maskSize = `${size.toFixed(1)}px ${size.toFixed(1)}px`
        layerStyle.webkitMaskRepeat = 'no-repeat'
        layerStyle.maskRepeat = 'no-repeat'
        layerStyle.opacity = '1'
      } else {
        const layerStyle = revealLayerRef.current.style
        layerStyle.opacity = '0'
        layerStyle.webkitMaskImage = 'none'
        layerStyle.maskImage = 'none'
      }
    }

    // Keep loop active until settled
    const diffR = Math.abs(t.r - c.r)
    const diffX = Math.abs(t.x - c.x)
    const diffY = Math.abs(t.y - c.y)

    if (diffR > 0.2 || diffX > 0.2 || diffY > 0.2) {
      rafId.current = requestAnimationFrame(renderFrame)
    } else {
      c.r = t.r
      c.x = t.x
      c.y = t.y
      rafId.current = null
    }
  }, [])

  const startLoop = useCallback(() => {
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(renderFrame)
    }
  }, [renderFrame])

  // Mouse event handlers
  const handleMouseEnter = useCallback(
    (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      current.current.x = x
      current.current.y = y
      current.current.r = 0

      target.current.x = x
      target.current.y = y
      target.current.r = SPLASH_RADIUS

      isHovering.current = true
      setIsHovered(true)
      startLoop()
    },
    [SPLASH_RADIUS, startLoop]
  )

  const handleMouseMove = useCallback(
    (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      target.current.x = x
      target.current.y = y
      target.current.r = SPLASH_RADIUS

      if (!isHovering.current) {
        isHovering.current = true
        setIsHovered(true)
      }
      startLoop()
    },
    [SPLASH_RADIUS, startLoop]
  )

  const handleMouseLeave = useCallback(() => {
    isHovering.current = false
    setIsHovered(false)
    target.current.r = 0
    startLoop()
  }, [startLoop])

  // Touch handlers for mobile devices
  const handleTouchStart = useCallback(
    (e) => {
      if (!containerRef.current || !e.touches || !e.touches[0]) return
      if (touchTimer.current) clearTimeout(touchTimer.current)

      const rect = containerRef.current.getBoundingClientRect()
      const x = e.touches[0].clientX - rect.left
      const y = e.touches[0].clientY - rect.top

      current.current.x = x
      current.current.y = y
      current.current.r = 0

      target.current.x = x
      target.current.y = y
      target.current.r = SPLASH_RADIUS

      isHovering.current = true
      setIsHovered(true)
      startLoop()
    },
    [SPLASH_RADIUS, startLoop]
  )

  const handleTouchMove = useCallback(
    (e) => {
      if (!containerRef.current || !e.touches || !e.touches[0]) return
      if (touchTimer.current) clearTimeout(touchTimer.current)

      const rect = containerRef.current.getBoundingClientRect()
      const x = e.touches[0].clientX - rect.left
      const y = e.touches[0].clientY - rect.top

      target.current.x = x
      target.current.y = y
      target.current.r = SPLASH_RADIUS

      startLoop()
    },
    [SPLASH_RADIUS, startLoop]
  )

  const handleTouchEnd = useCallback(() => {
    if (touchTimer.current) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => {
      isHovering.current = false
      setIsHovered(false)
      target.current.r = 0
      startLoop()
    }, 1800)
  }, [startLoop])

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (touchTimer.current) clearTimeout(touchTimer.current)
    }
  }, [])

  return (
    <section className="pt-section" aria-labelledby="pt-title">
      {/* Section Header: Minimal, Meaningful, Engaging */}
      <div className="ch-wrap">
        <div className="pt-header">
          <div className="pt-header__eyebrow">
            <span className="pt-header__dot" />
            Plot Transformation
          </div>
          <h2 id="pt-title" className="pt-header__title">
            From Approved Land to <span className="pt-gold">Your Dream Home</span>
          </h2>
          <p className="pt-header__desc">
            Every Crystal Estates plot comes with 30-year high court legal scrutiny, DTCP & CMDA
            sanctions, and precise boundary demarcation. Move your cursor across the virgin land to
            reveal the architectural living space that awaits.
          </p>
        </div>
      </div>

      {/* Full-Width Edge-to-Edge Visual Canvas */}
      <div className="pt-edge-stage">
        <div
          ref={containerRef}
          className={`pt-canvas ${isHovered ? 'is-revealed' : ''}`}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="region"
          aria-label="Interactive Plot Transformation. Move cursor to reveal Your Dream Home in an organic 100px splash."
        >
          {/* Layer 1: Base Empty Demarcated Plot (100% visible across the entire canvas) */}
          <div className="pt-layer pt-layer--base">
            <Image
              src="/images/empty-plot.jpg"
              alt="Demarcated virgin residential plot with boundary stones"
              fill
              sizes="100vw"
              priority
              className="pt-img"
              draggable={false}
            />
          </div>

          {/* Layer 2: Dream Home Image - strictly revealed within ~100px irregular splash mask with blurred edges */}
          <div className="pt-layer pt-layer--reveal" ref={revealLayerRef}>
            <Image
              src="/images/dream-home.jpg"
              alt="Architectural luxury villa revealed within organic splash mask"
              fill
              sizes="100vw"
              priority
              className="pt-img"
              draggable={false}
            />
          </div>

          {/* Top Bar Status Indicator */}
          <div className="pt-topbar" onClick={(e) => e.stopPropagation()}>
            <div className="pt-status-pill">
              <span className={`pt-status-dot ${isHovered ? 'is-gold' : 'is-green'}`} />
              <span>{isHovered ? 'Dream Home Splash Active' : 'Demarcated Plot'}</span>
            </div>
          </div>

          {/* Base State Prompt Hint (Visible when not hovering) */}
          <div className={`pt-overlay-base ${!isHovered ? 'is-visible' : ''}`}>
            <div className="pt-base-badge">
              <span className="pt-base-badge-dot" />
              CMDA & DTCP Approved Residential Parcel
            </div>
            <div className="pt-prompt-pill">
              <Sparkles size={14} className="pt-prompt-sparkle" />
              <span>
                {isTouchDevice
                  ? 'Touch and drag across the plot to reveal Your Dream Home'
                  : 'Glide cursor across the plot to splash-reveal Your Dream Home'}
              </span>
            </div>
          </div>

          {/* "Your Dream Home" Content Card (Revealed on Hover / Touch) */}
          <div
            className={`pt-dream-card ${isHovered ? 'is-visible' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-dream-card__header">
              <span className="pt-dream-card__tag">
                <HomeIcon size={13} style={{ display: 'inline', marginRight: 5 }} />
                Bespoke Living
              </span>
              <span className="pt-dream-card__status">100% Ready to Build</span>
            </div>

            <h3 className="pt-dream-card__title">Your Dream Home</h3>

            <p className="pt-dream-card__desc">
              From demarcated ground to custom luxury villa. Designed with open-plan garden living,
              expansive sun decks, and Vaastu precision—grounded on 100% clear-title land.
            </p>

            <div className="pt-dream-card__specs">
              <div className="pt-spec-item">
                <CheckCircle2 size={13} className="pt-spec-icon" />
                <span>3,400+ Sq.Ft Custom Villa</span>
              </div>
              <div className="pt-spec-item">
                <CheckCircle2 size={13} className="pt-spec-icon" />
                <span>Immediate Spot Patta Transfer</span>
              </div>
              <div className="pt-spec-item">
                <CheckCircle2 size={13} className="pt-spec-icon" />
                <span>Pre-Approved Bank Plot Loans</span>
              </div>
            </div>

            <div className="pt-dream-card__action">
              <Link href="/contact" className="pt-dream-card__btn">
                <span>Enquire for Villa Planning</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
