'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { formatArea, formatPrice } from '../../lib/api'

/**
 * Clean up area text (e.g. remove trailing dots like '1200...... Sq.ft.')
 */
function cleanAreaText(plot) {
  const formatted = formatArea(plot)
  if (!formatted) return '1200 Sq.ft.'
  return formatted.replace(/\.{2,}/g, '').trim()
}

/**
 * Format price cleanly
 */
function cleanPriceText(plot) {
  if (plot.priceDisplay) return plot.priceDisplay.replace(/\.{2,}/g, '').trim()
  if (plot.price) return formatPrice(plot.price)
  return 'Price on Request'
}

/**
 * Single Featured Project Card matching reference UI
 */
function ShowcaseCard({ project }) {
  const fallbackImage = '/images/hero-estate.jpg'
  const primaryImage =
    project.image ||
    (Array.isArray(project.images) && project.images[0]) ||
    (Array.isArray(project.gallery) && project.gallery[0]) ||
    fallbackImage

  const [imgSrc, setImgSrc] = useState(primaryImage)

  useEffect(() => {
    setImgSrc(primaryImage)
  }, [primaryImage])

  const handleImageError = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    if (imgSrc && typeof imgSrc === 'string' && imgSrc.startsWith('/images/plots/') && !imgSrc.startsWith('http')) {
      const fullUrl = `${apiUrl.replace(/\/$/, '')}${imgSrc}`
      if (imgSrc !== fullUrl) {
        setImgSrc(fullUrl)
        return
      }
    }
    const slugImage = project?.slug ? `/images/${project.slug}.jpg` : null
    if (slugImage && imgSrc !== slugImage && imgSrc !== fallbackImage) {
      setImgSrc(slugImage)
      return
    }
    setImgSrc(fallbackImage)
  }

  const projectSlug = project.slug || project.id || project.projectId || project._id
  const projectUrl = `/projects/${projectSlug}`
  const rawTitle = project.name || project.projectName || 'Crystal Estates Property'
  const title = rawTitle.replace(/_/g, ' ').trim()
  const location = project.location || 'Chennai, Tamil Nadu'
  const shortLocation = location.split(',')[0].trim()
  const area = cleanAreaText(project)
  const propType = project.type || project.propertyType || 'Residential'
  const status = project.status || 'Available'
  const statusLower = String(status).trim().toLowerCase()
  const isSold = statusLower.includes('sold')
  const isOnHold = !isSold && (statusLower === 'on hold' || statusLower === 'onhold' || statusLower === 'reserved')
  const isLocked = isSold || isOnHold
  const lockedLabel = isSold ? 'Sold Out' : 'On Hold'
  const isAvailable = !isLocked && (statusLower === 'available' || statusLower === 'booking open' || statusLower === 'booked')
  const totalPlots = project.totalPlots || (Array.isArray(project.plots) ? project.plots.length : 0)

  // Curate 3 clean pill badges for the image bottom
  const pills = []
  if (shortLocation && shortLocation.toLowerCase() !== title.toLowerCase()) {
    pills.push(shortLocation)
  }
  if (propType) {
    pills.push(propType)
  }
  if (area && area !== 'Individual Plots') {
    pills.push(area)
  } else if (totalPlots > 0) {
    pills.push(`${totalPlots} Plots`)
  }
  if (pills.length < 3 && project.approval) {
    pills.push(project.approval)
  }
  if (pills.length < 3) {
    pills.push(isLocked ? lockedLabel : statusLower === 'booked' ? 'Booked' : 'Available')
  }

  const cardInner = (
    <>
      {/* Large Rounded Image Container */}
      <div className="featured-showcase-card__image-container">
        <Image
          src={imgSrc}
          alt={title}
          fill
          unoptimized
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 360px, 400px"
          className="featured-showcase-card__image"
          onError={handleImageError}
        />
        {/* Subtle bottom gradient to ensure pills are crystal clear */}
        <div className="featured-showcase-card__gradient" />

        {/* Frosted Glass Pill Badges at Bottom of Image */}
        <div className="featured-showcase-card__pills">
          {pills.slice(0, 3).map((pill, idx) => (
            <span key={idx} className="featured-showcase-card__pill">
              {pill}
            </span>
          ))}
        </div>
      </div>

      {/* Card Footer: Title and Diagonal Arrow Circle Button */}
      <div className="featured-showcase-card__footer">
        <h3 className="featured-showcase-card__title">
          {title}
        </h3>
        {isLocked ? (
          <div className="featured-showcase-card__sold-badge" aria-hidden="true">
            {lockedLabel}
          </div>
        ) : (
          <div className="featured-showcase-card__arrow-btn" aria-hidden="true">
            <ArrowUpRight size={18} className="featured-showcase-card__arrow-icon" />
          </div>
        )}
      </div>
    </>
  )

  return (
    <article className={`featured-showcase-card ${isLocked ? 'featured-showcase-card--sold' : ''} group`}>
      {isLocked ? (
        <div className="featured-showcase-card__link featured-showcase-card__link--sold" style={{ cursor: 'default' }} role="presentation">
          {cardInner}
        </div>
      ) : (
        <Link href={projectUrl} className="featured-showcase-card__link" aria-label={`View ${title}`}>
          {cardInner}
        </Link>
      )}
    </article>
  )
}

/**
 * FeaturedProjectsCarousel
 * Modern horizontal scrollable showcase matching reference image
 */
export default function FeaturedProjectsCarousel({
  projects = [],
  title = 'Featured Land & Plot Projects',
  subtitle = 'CMDA & DTCP approved plots and managed sandalwood farm lands across prime Chennai corridors.',
  eyebrow = 'Featured Projects',
  className = '',
}) {
  const trackRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })
  const hasMoved = useRef(false)

  // Update arrow states based on scroll position
  const checkScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 10)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
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
  }, [checkScrollState, projects])

  // Scroll smooth step
  const handleScroll = (direction) => {
    const el = trackRef.current
    if (!el) return
    const cardWidth = el.querySelector('.featured-showcase-card')?.offsetWidth || 380
    const scrollAmount = (cardWidth + 24) * (direction === 'left' ? -1 : 1)
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  // Mouse drag-to-scroll implementation
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
    const walk = (x - dragStart.current.x) * 1.5
    if (Math.abs(walk) > 5) {
      hasMoved.current = true
    }
    el.scrollLeft = dragStart.current.scrollLeft - walk
  }

  const handleMouseUpOrLeave = (e) => {
    if (isDragging) {
      setIsDragging(false)
      // If user dragged, prevent link clicks inside
      if (hasMoved.current) {
        const preventClick = (clickEvent) => {
          clickEvent.stopPropagation()
          clickEvent.preventDefault()
          window.removeEventListener('click', preventClick, true)
        }
        window.addEventListener('click', preventClick, true)
      }
    }
  }

  return (
    <section className={`featured-showcase-section ${className}`.trim()}>
      <div className="featured-showcase-container">
        {/* Left Column / Header Block */}
        <div className="featured-showcase-sidebar">
          <div className="featured-showcase-sidebar__top">
            {/* Pill Tag at Top */}
            <span className="featured-showcase-sidebar__badge">
              {eyebrow}
            </span>

            {/* Main Section Heading */}
            <h2 className="featured-showcase-sidebar__title">
              {title}
            </h2>

            {/* Description Subtitle */}
            {subtitle && (
              <p className="featured-showcase-sidebar__subtitle">
                {subtitle}
              </p>
            )}
          </div>

          {/* Bottom Navigation Arrow Buttons */}
          <div className="featured-showcase-sidebar__nav">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className="featured-showcase-nav-btn featured-showcase-nav-btn--prev"
              aria-label="Scroll left"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className="featured-showcase-nav-btn featured-showcase-nav-btn--next"
              aria-label="Scroll right"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Right Column / Horizontal Scroll Track */}
        <div className="featured-showcase-track-wrapper">
          <div
            ref={trackRef}
            className={`featured-showcase-track ${isDragging ? 'is-dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            role="region"
            aria-label="Featured projects carousel"
            tabIndex={0}
          >
            {projects.map((project) => (
              <ShowcaseCard key={project.id || project._id || project.slug} project={project} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
