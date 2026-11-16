'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Route, ShieldCheck, FileCheck, MapPin, KeyRound, MessageSquare } from 'lucide-react'
import { steps } from '../../data/site'

const stepIcons = [MessageSquare, MapPin, FileCheck, ShieldCheck, KeyRound]
const stepPhases = [
  'Phase 1: Exploration',
  'Phase 2: On-Site Survey',
  'Phase 3: Legal Due Diligence',
  'Phase 4: Official Conveyance',
  'Phase 5: Clear Ownership',
]

export default function Process({
  eyebrow = 'The Acquisition Roadmap',
  title = 'Our Business Process',
  text = 'A transparent, hassle-free path to owning your approved residential plot and farmland asset in Chennai.',
  className = '',
}) {
  const trackRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [activeStep, setActiveStep] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })
  const hasMoved = useRef(false)

  const checkScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 15)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15)

    const cards = el.querySelectorAll('.roadmap-stage-card')
    if (cards.length > 0) {
      const cardWidth = cards[0].offsetWidth + 24
      const idx = Math.min(steps.length - 1, Math.max(0, Math.round(scrollLeft / cardWidth)))
      setActiveStep(idx)
    }
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    checkScrollState()
    el.addEventListener('scroll', checkScrollState, { passive: true })
    window.addEventListener('resize', checkScrollState)
    return () => {
      el.removeEventListener('scroll', checkScrollState)
      window.removeEventListener('resize', checkScrollState)
    }
  }, [checkScrollState])

  const handleScroll = (direction) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('.roadmap-stage-card')
    const scrollAmount = ((card?.offsetWidth || 340) + 24) * (direction === 'left' ? -1 : 1)
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  const handleMouseDown = (e) => {
    const el = trackRef.current
    if (!el) return
    setIsDragging(true)
    hasMoved.current = false
    dragStart.current = {
      x: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    const el = trackRef.current
    if (!el) return
    const x = e.pageX - el.offsetLeft
    const walk = (x - dragStart.current.x) * 1.4
    if (Math.abs(walk) > 5) {
      hasMoved.current = true
    }
    el.scrollLeft = dragStart.current.scrollLeft - walk
  }

  const handleMouseUpOrLeave = () => {
    setIsDragging(false)
  }

  return (
    <section id="process" className={`roadmap-sec ${className}`.trim()} aria-label="Our Business Process">
      <div className="roadmap-container">
        {/* Header with Title & Nav Buttons */}
        <div className="roadmap-header">
          <div className="roadmap-header__text">
            <div className="roadmap-badge">
              <Route size={14} className="roadmap-badge__icon" />
              <span>{eyebrow}</span>
            </div>
            <h2 className="roadmap-title">{title}</h2>
            <p className="roadmap-subtitle">{text}</p>
          </div>

          <div className="roadmap-header__nav">
            <div className="roadmap-nav-btns">
              <button
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                className="roadmap-nav-btn"
                aria-label="Previous step"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                className="roadmap-nav-btn"
                aria-label="Next step"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Scrolling Roadmap Stage Cards */}
        <div className="roadmap-track-container">
          <div
            ref={trackRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`roadmap-track ${isDragging ? 'is-dragging' : ''}`}
          >
            {steps.map((s, idx) => {
              const Icon = stepIcons[idx % stepIcons.length]
              const phase = stepPhases[idx % stepPhases.length]
              return (
                <div
                  key={s.title}
                  className={`roadmap-stage-card ${activeStep === idx ? 'is-active-card' : ''}`}
                >
                  <div className="roadmap-stage-card__header">
                    <span className="roadmap-stage-card__num">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="roadmap-stage-card__icon-box">
                      <Icon size={22} />
                    </div>
                  </div>

                  <div className="roadmap-stage-card__body">
                    <span className="roadmap-stage-card__phase">{phase}</span>
                    <h3 className="roadmap-stage-card__title">{s.title}</h3>
                    <p className="roadmap-stage-card__text">{s.text}</p>
                  </div>

                  <div className="roadmap-stage-card__footer">
                    <span className="roadmap-stage-card__step-tag">Step 0{idx + 1} of 0{steps.length}</span>
                    <div className="roadmap-stage-card__indicator" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
