'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Sparkles, Eye, Maximize2 } from 'lucide-react'
import './PlotTransformation.css'

export default function PlotTransformation() {
  const stageRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hasInteracted, setHasInteracted] = useState(false)
  const [mode, setMode] = useState('lens') // 'lens' | 'full'
  const [lensRadius, setLensRadius] = useState(220)

  // Dynamically calibrate lens radius based on viewport size
  useEffect(() => {
    const updateRadius = () => {
      if (window.innerWidth < 640) {
        setLensRadius(140)
      } else if (window.innerWidth < 1024) {
        setLensRadius(180)
      } else {
        setLensRadius(220)
      }
    }
    updateRadius()
    window.addEventListener('resize', updateRadius)
    return () => window.removeEventListener('resize', updateRadius)
  }, [])

  // Coordinate updater
  const updateCoords = useCallback((clientX, clientY) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top))
    setPos({ x, y })
  }, [])

  const handleMouseMove = useCallback(
    (e) => {
      updateCoords(e.clientX, e.clientY)
      if (!isHovered) setIsHovered(true)
      if (!hasInteracted) setHasInteracted(true)
    },
    [isHovered, hasInteracted, updateCoords]
  )

  const handleMouseEnter = useCallback(
    (e) => {
      updateCoords(e.clientX, e.clientY)
      setIsHovered(true)
      setHasInteracted(true)
    },
    [updateCoords]
  )

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  // Touch device handling
  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches && e.touches[0]) {
        updateCoords(e.touches[0].clientX, e.touches[0].clientY)
        setIsHovered(true)
        setHasInteracted(true)
      }
    },
    [updateCoords]
  )

  const handleTouchMove = useCallback(
    (e) => {
      if (e.touches && e.touches[0]) {
        updateCoords(e.touches[0].clientX, e.touches[0].clientY)
        setIsHovered(true)
      }
    },
    [updateCoords]
  )

  const handleTouchEnd = useCallback(() => {
    // Retain vision lens on mobile for a moment
    setTimeout(() => {
      setIsHovered(false)
    }, 1800)
  }, [])

  const handleStageClick = useCallback(
    (e) => {
      updateCoords(e.clientX, e.clientY)
      setIsHovered(true)
      setHasInteracted(true)
    },
    [updateCoords]
  )

  // Compute dynamic clipPath
  const getClipPath = () => {
    if (mode === 'full') {
      return 'circle(150% at 50% 50%)'
    }
    if (isHovered) {
      return `circle(${lensRadius}px at ${pos.x}px ${pos.y}px)`
    }
    return `circle(0px at ${pos.x}px ${pos.y}px)`
  }

  return (
    <section className="pt-section" aria-labelledby="pt-title">
      <div className="pt-header">
        <span className="pt-header__pill">
          <span className="pt-header__pill-dot" />
          Interactive Vision
        </span>
        <h2 id="pt-title" className="pt-header__title">
          Every Plot Holds a Future.{' '}
          <span className="ch-accent">Glide your cursor to reveal it.</span>
        </h2>
        <p className="pt-header__desc">
          Witness what your verified layout will become. Move your cursor across the virgin land
          to seamlessly uncover the architectural dream home designed for this parcel.
        </p>
      </div>

      <div className="pt-stage-wrap">
        <div
          ref={stageRef}
          className="pt-stage"
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleStageClick}
          role="region"
          aria-label="Interactive Plot to Dream Villa Reveal Canvas"
        >
          {/* Base Layer: Empty Land / Plot */}
          <div className="pt-layer">
            <Image
              src="/images/empty-plot.jpg"
              alt="Empty approved residential plot ready for development"
              fill
              sizes="(max-width: 1200px) 100vw, 1140px"
              priority
              className="pt-layer__img"
              draggable={false}
            />
            {/* Tag badge on plot */}
            <div className="pt-tag pt-tag--plot">
              <span className="pt-tag-dot pt-tag-dot--green" />
              Approved Residential Parcel
            </div>
          </div>

          {/* Reveal Layer: Futuristic Dream Villa */}
          <div
            className={`pt-layer--reveal ${mode === 'full' ? 'is-full' : ''}`}
            style={{
              clipPath: getClipPath(),
              WebkitClipPath: getClipPath(),
            }}
          >
            <Image
              src="/images/dream-home.jpg"
              alt="Architectural luxury dream villa concept revealed on plot"
              fill
              sizes="(max-width: 1200px) 100vw, 1140px"
              priority
              className="pt-layer__img"
              draggable={false}
            />
            {/* Tag badge on villa */}
            <div className="pt-tag pt-tag--villa">
              <span className="pt-tag-dot pt-tag-dot--gold" />
              Luxury Villa Concept
            </div>
          </div>

          {/* Cursor Lens Halo Ring (follows cursor in lens mode) */}
          {mode === 'lens' && isHovered && (
            <div
              className="pt-lens-ring"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${lensRadius * 2}px`,
                height: `${lensRadius * 2}px`,
                opacity: isHovered ? 1 : 0,
              }}
              aria-hidden="true"
            >
              <div className="pt-lens-badge">
                <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
                Dream Home Vision
              </div>
            </div>
          )}

          {/* Initial Prompt Hint (hides on interaction) */}
          <div className={`pt-hint ${hasInteracted ? 'is-hidden' : ''}`} aria-hidden="true">
            <Sparkles size={16} />
            <span>Hover or tap over the land to transform</span>
          </div>

          {/* Quick Controls: Lens Mode vs Full Villa View */}
          <div className="pt-controls" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`pt-btn ${mode === 'lens' ? 'is-active' : ''}`}
              onClick={() => setMode('lens')}
              title="Cursor Spotlight Lens"
            >
              <Eye size={13} />
              Cursor Lens
            </button>
            <button
              type="button"
              className={`pt-btn ${mode === 'full' ? 'is-active' : ''}`}
              onClick={() => setMode('full')}
              title="Full Villa Vision"
            >
              <Maximize2 size={13} />
              Full Vision
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
