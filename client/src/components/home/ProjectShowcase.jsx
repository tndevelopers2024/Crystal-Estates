'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  MapPin,
  MoveHorizontal,
  ArrowUpRight,
  Layers,
  Sparkles,
} from 'lucide-react'
import { normalizePlot, formatArea } from '../../lib/api'
import './ProjectShowcaseCarousel.css'

// Safe fallback data if the API is offline
const FALLBACK_PROJECTS = [
  {
    slug: 'somamangalam',
    name: 'Somamangalam',
    location: 'Chennai, Tamil Nadu',
    type: 'Residential Plot',
    approval: 'CMDA & DTCP Approved',
    area: '1200 Sq.ft.',
    totalPlots: 507,
    status: 'Available',
    image: '/images/somamangalam.jpg',
  },
  {
    slug: 'kolapakkam',
    name: 'Kolapakkam',
    location: 'Chennai, Tamil Nadu',
    type: 'Residential Plot',
    approval: 'CMDA Approved',
    area: '1200 Sq.ft.',
    totalPlots: 2,
    status: 'Available',
    image: '/images/kolapakkam.jpg',
  },
  {
    slug: 'jambodai',
    name: 'Jambodai',
    location: 'Chennai, Tamil Nadu',
    type: 'Residential Villa Plot',
    approval: 'DTCP Approved',
    area: '1200 Sq.ft.',
    totalPlots: 1,
    status: 'Sold',
    image: '/images/excellence-villa.jpg',
  },
  {
    slug: 'brammadesam',
    name: 'Brammadesam',
    location: 'Chennai, Tamil Nadu',
    type: 'Residential Plot',
    approval: 'DTCP Approved',
    area: '1200 Sq.ft.',
    totalPlots: 140,
    status: 'Sold',
    image: '/images/brammadesam.jpg',
  },
  {
    slug: 'nalmukkal',
    name: 'nalmukkal',
    location: 'Chennai, Tamil Nadu',
    type: 'Farmland & Sandalwood',
    approval: 'Panchayat Approved',
    area: 'Managed Farmland',
    totalPlots: 50,
    status: 'Sold',
    image: '/images/vedanthangal.jpg',
  },
  {
    slug: 'ozhalai-panchayath',
    name: 'ozhalai_panchayath',
    location: 'Chennai, Tamil Nadu',
    type: 'Residential Plot',
    approval: 'DTCP Approved',
    area: '1200 Sq.ft.',
    totalPlots: 80,
    status: 'Sold',
    image: '/images/ozhalai-panchayath.jpg',
  },
]

export default function ProjectShowcase({ projects = [] }) {
  const router = useRouter()
  const trackRef = useRef(null)

  // 1. Dynamic projects state connected to database
  const [items, setItems] = useState(() => {
    if (Array.isArray(projects) && projects.length > 0) {
      return projects.map(normalizePlot)
    }
    return FALLBACK_PROJECTS
  })

  useEffect(() => {
    let isMounted = true
    fetch('/api/plots')
      .then((res) => res.ok && res.json())
      .then((data) => {
        if (isMounted && data && Array.isArray(data.plots) && data.plots.length > 0) {
          setItems(data.plots.map(normalizePlot))
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Drag & Scroll State
  const [isMouseDown, setIsMouseDown] = useState(false)
  const dragStartX = useRef(0)
  const scrollStartLeft = useRef(0)
  const hasDragged = useRef(false)

  // 3. Navigation Controls with Smooth Looping
  const scrollPrev = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const cardWidth = el.querySelector('.ps-card-item')?.offsetWidth || 340
    const scrollAmount = cardWidth + 24

    // If at the very beginning, smoothly loop to the end
    if (el.scrollLeft <= 10) {
      el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
    }
  }, [])

  const scrollNext = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const cardWidth = el.querySelector('.ps-card-item')?.offsetWidth || 340
    const scrollAmount = cardWidth + 24

    // If at the end, smoothly loop back to the start
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 15) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') scrollPrev()
      if (e.key === 'ArrowRight') scrollNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [scrollPrev, scrollNext])

  // 4. Mouse Drag Handlers
  const handleMouseDown = (e) => {
    const el = trackRef.current
    if (!el) return
    setIsMouseDown(true)
    dragStartX.current = e.pageX - el.offsetLeft
    scrollStartLeft.current = el.scrollLeft
    hasDragged.current = false
  }

  const handleMouseMove = (e) => {
    if (!isMouseDown) return
    const el = trackRef.current
    if (!el) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const walk = (x - dragStartX.current) * 1.5
    if (Math.abs(walk) > 6) {
      hasDragged.current = true
    }
    el.scrollLeft = scrollStartLeft.current - walk
  }

  const handleMouseUp = () => {
    setIsMouseDown(false)
  }

  const handleMouseLeave = () => {
    setIsMouseDown(false)
  }

  // 5. Card Click Handler (Redirects to Project View Page unless sold out or dragged)
  const handleCardClick = (project, isSoldOut, e) => {
    if (hasDragged.current) {
      e.preventDefault()
      return
    }
    if (isSoldOut) {
      e.preventDefault()
      return // Sold out projects do not redirect
    }
    const slug = project.slug || project.id || project.projectId
    router.push(`/projects/${slug}`)
  }

  return (
    <section className="ps-slider-section" aria-label="Available Projects Showcase">
      <div className="ch-wrap">
        {/* ── 1. Section Header ── */}
        <div className="ps-slider__head">
          <div className="ps-slider__head-left">
            <h2 className="ps-slider__title-serif">Create your</h2>
            <div className="ps-slider__title-row">
              <span className="ps-slider__title-sans">space</span>
              <span className="ps-slider__title-cursive">
                with <span>US</span>
              </span>
            </div>
          </div>

          <div className="ps-slider__head-right">
            <div className="ps-slider__pill-tag">
              <Sparkles size={14} color="#B8964E" />
              <span>CMDA &amp; DTCP Approved</span>
            </div>

            {/* Left & Right Navigation Buttons */}
            <div className="ps-slider__nav-btns" aria-label="Slider navigation controls">
              <button
                type="button"
                onClick={scrollPrev}
                className="ps-slider__arrow-btn"
                aria-label="Previous projects"
                title="Previous projects"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={scrollNext}
                className="ps-slider__arrow-btn"
                aria-label="Next projects"
                title="Next projects"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* ── 2. Visible Drag Control Indicator ── */}
        <div className="ps-slider__subbar">
          <div className="ps-slider__drag-pill">
            <MoveHorizontal size={14} />
            <span>Drag or scroll to explore projects</span>
          </div>
          <div className="ps-slider__count-indicator">
            {items.length} Verified Projects
          </div>
        </div>

        {/* ── 3. Horizontal Scroll / Drag Slider Rail ── */}
        <div className="ps-slider__viewport">
          <div
            ref={trackRef}
            className="ps-slider__track"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          tabIndex={0}
          role="region"
          aria-label="Projects horizontal carousel"
        >
          {items.map((project, idx) => {
            const rawTitle = project.name || project.projectName || 'Crystal Estates Property'
            const title = rawTitle.replace(/_/g, ' ').trim()
            const projectSlug = project.slug || project.id || project.projectId

            // Database Sold Out / On Hold check
            const statusStr = String(project.status || '').trim().toLowerCase()
            const plotsArr = Array.isArray(project.plots) ? project.plots : []
            const allPlotsSold =
              plotsArr.length > 0 &&
              plotsArr.every((p) => String(p.status || '').toLowerCase() === 'sold')
            const isSoldOut =
              statusStr === 'sold' ||
              statusStr === 'sold out' ||
              statusStr === 'soldout' ||
              Boolean(project.isSoldOut) ||
              allPlotsSold ||
              (typeof project.availablePlots === 'number' &&
                project.availablePlots === 0 &&
                (project.totalPlots > 0 || plotsArr.length > 0))
            const isOnHold = !isSoldOut && (statusStr === 'on hold' || statusStr === 'onhold' || statusStr === 'reserved')
            const isLocked = isSoldOut || isOnHold
            const statusLabel = isSoldOut ? 'Sold Out' : isOnHold ? 'On Hold' : statusStr === 'booked' ? 'Booked' : 'Available'

            // Dynamic Image
            const imgSrc =
              project.coverImage ||
              project.image ||
              (Array.isArray(project.images) && project.images[0]) ||
              '/images/hero-estate.jpg'

            // Dynamic Specs
            const propType = project.type || project.propertyType || 'Residential Plot'
            const area = formatArea(project) || project.area || '1200 Sq.ft.'
            const totalPlots = project.totalPlots || plotsArr.length || null
            const approval = project.approval || project.approvalStatus || 'CMDA Approved'

            // Location
            const location =
              project.location ||
              [project.village, project.taluk, project.district].filter(Boolean).join(', ') ||
              'Chennai, Tamil Nadu'

            return (
              <article
                key={`${projectSlug}-${idx}`}
                onClick={(e) => handleCardClick(project, isLocked, e)}
                className={`ps-card-item ${isLocked ? 'ps-card-item--soldout' : ''}`}
                style={isLocked ? { cursor: 'default' } : undefined}
                aria-label={`${title} - ${statusLabel}`}
              >
                {/* Background Image */}
                <div className="ps-card-item__media">
                  <Image
                    src={imgSrc}
                    alt={title}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 290px, 380px"
                    className="ps-card-item__img"
                    onError={(e) => {
                      e.currentTarget.src = '/images/hero-estate.jpg'
                    }}
                  />
                  <div className="ps-card-item__scrim" />
                </div>

                {/* Top Floating Row: Status pill & Arrow */}
                <div className="ps-card-item__top-bar">
                  <div
                    className={`ps-card-item__status-pill ${
                      isLocked ? 'ps-card-item__status-pill--soldout' : ''
                    }`}
                  >
                    <span className="ps-card-item__dot" />
                    <span>{statusLabel}</span>
                  </div>

                  {!isLocked && (
                    <div className="ps-card-item__arrow-circle" aria-hidden="true">
                      <ArrowUpRight size={17} />
                    </div>
                  )}
                </div>

                {/* Bottom Content */}
                <div className="ps-card-item__content">
                  <h3 className="ps-card-item__title">{title}</h3>

                  <div className="ps-card-item__location">
                    <MapPin size={13} />
                    <span>{location}</span>
                  </div>

                  <p className="ps-card-item__desc">
                    {project.shortDescription ||
                      `Premium ${propType.toLowerCase()} with 100% verified legal scrutiny and ready patta.`}
                  </p>

                  {/* Spec Pills */}
                  <div className="ps-card-item__tags">
                    <span className="ps-card-item__tag">{propType}</span>
                    {area && <span className="ps-card-item__tag">{area}</span>}
                    {totalPlots && (
                      <span className="ps-card-item__tag">{totalPlots} Plots</span>
                    )}
                    {approval && (
                      <span className="ps-card-item__tag">{approval}</span>
                    )}
                  </div>

                  {/* Action Button */}
                  {isSoldOut ? (
                    <div
                      className="ps-card-item__cta-btn ps-card-item__cta-btn--soldout"
                      aria-disabled="true"
                    >
                      <span>Sold Out</span>
                    </div>
                  ) : (
                    <div className="ps-card-item__cta-btn">
                      <span>View Project Details</span>
                      <ArrowRight size={14} />
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/* ── 4. Bottom Social Proof ── */}
      <div className="ps-slider__foot">
        <div className="ps-slider__social-proof">
          <p className="ps-slider__social-text">
            <strong>1500+</strong> families are <em>satisfied</em> with our verified titles
            and have created their own dream spaces <em>with us</em>.
          </p>
        </div>
      </div>
    </div>
  </section>
  )
}
