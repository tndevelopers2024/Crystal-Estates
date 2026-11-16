'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  BadgeCheck,
  FileCheck2,
  Receipt,
  Car,
  Landmark,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

const defaultPoints = [
  {
    icon: ShieldCheck,
    title: '100% Clear Titles',
    badge: 'High-Court Scrutiny',
    description:
      'Every property goes through exhaustive 30-year legal searches and high-court title scrutiny before being offered to buyers.',
  },
  {
    icon: BadgeCheck,
    title: 'DTCP & CMDA Approved',
    badge: 'Norms Compliant',
    description:
      'All layouts comply strictly with Chennai Metropolitan Development Authority (CMDA) and DTCP norms and guidelines.',
  },
  {
    icon: FileCheck2,
    title: 'Registration Support',
    badge: 'Spot Patta Transfer',
    description:
      'Complete hands-on assistance through sub-registrar office scheduling, token generation, draft vetting, and spot patta transfer.',
  },
  {
    icon: Receipt,
    title: 'Transparent Pricing',
    badge: 'Zero Hidden Charges',
    description:
      'Honest, all-inclusive sq.ft pricing with zero hidden development charges, brokerage surprises, or unrecorded fees.',
  },
  {
    icon: Car,
    title: 'Site Visit Assistance',
    badge: 'Complimentary Cab',
    description:
      'Complimentary weekend cab pick-up from Chennai locations with accompanied on-site survey and boundary stone inspection.',
  },
  {
    icon: Landmark,
    title: 'Bank Loan Guidance',
    badge: 'Leading National Banks',
    description:
      'Tie-ups with leading nationalized and private banks for fast, seamless plot loans with minimal paperwork.',
  },
]

export default function WhyChooseUs({
  title = 'Why Choose Crystal Estates?',
  subtitle = 'Six core pillars that make us Chennai’s most trusted land and plot asset creator.',
  eyebrow = 'The Crystal Standard',
  points = defaultPoints,
  className = '',
}) {
  const trackRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })
  const hasMoved = useRef(false)

  const checkScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 15)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15)

    const cards = el.querySelectorAll('.pillar-scroll-card')
    if (cards.length > 0) {
      const cardWidth = cards[0].offsetWidth + 20
      const idx = Math.min(points.length - 1, Math.max(0, Math.round(scrollLeft / cardWidth)))
      setActiveIndex(idx)
    }
  }, [points.length])

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
    const card = el.querySelector('.pillar-scroll-card')
    const scrollAmount = ((card?.offsetWidth || 340) + 20) * (direction === 'left' ? -1 : 1)
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
    <section className={`pillars-section ${className}`.trim()} aria-label="Why Choose Crystal Estates">
      <div className="pillars-container">
        {/* Left Sticky Hero Column */}
        <div className="pillars-sidebar">
          <div className="pillars-sidebar__header">
            <div className="pillars-badge">
              <Sparkles size={14} className="pillars-badge__icon" />
              <span>{eyebrow}</span>
            </div>
            <h2 className="pillars-sidebar__title">{title}</h2>
            <p className="pillars-sidebar__subtitle">{subtitle}</p>
          </div>

          {/* Trust Guarantees Box */}
          <div className="pillars-trust-card">
            <div className="pillars-trust-item">
              <CheckCircle2 size={16} className="pillars-trust-icon" />
              <span>30-Year Historical Title Search</span>
            </div>
            <div className="pillars-trust-item">
              <CheckCircle2 size={16} className="pillars-trust-icon" />
              <span>100% Zero Encroachment Plots</span>
            </div>
            <div className="pillars-trust-item">
              <CheckCircle2 size={16} className="pillars-trust-icon" />
              <span>Direct Patta & Legal Support</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="pillars-sidebar__nav-row">
            <div className="pillars-nav-buttons">
              <button
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                className="pillars-nav-btn"
                aria-label="Previous pillar"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                className="pillars-nav-btn"
                aria-label="Next pillar"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Horizontal Scroll Track */}
        <div className="pillars-track-wrapper">
          <div
            ref={trackRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`pillars-track ${isDragging ? 'is-dragging' : ''}`}
          >
            {points.map((pt, idx) => {
              const Icon = pt.icon
              return (
                <div key={idx} className="pillar-scroll-card">
                  <div className="pillar-scroll-card__top">
                    <span className="pillar-scroll-card__num">0{idx + 1}</span>
                    <div className="pillar-scroll-card__icon-box">
                      <Icon size={24} />
                    </div>
                  </div>

                  <div className="pillar-scroll-card__content">
                    <span className="pillar-scroll-card__badge">{pt.badge}</span>
                    <h3 className="pillar-scroll-card__title">{pt.title}</h3>
                    <p className="pillar-scroll-card__desc">{pt.description}</p>
                  </div>

                  <div className="pillar-scroll-card__accent-line" />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
