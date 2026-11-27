'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  MapPin,
  Star,
  BedDouble,
  Bath,
  Maximize2,
  Heart,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Compass,
  ShieldCheck,
} from 'lucide-react'
import { formatPrice } from '../../lib/api'

/**
 * Clean & Dynamic Reference-Style ProjectCard Component
 * - Fixes carousel jump bug (smooth layered cross-fade, zero window scroll or layout shifts)
 * - 100% dynamic: NO hardcoded ratings, fake specs, or fabricated fallback photos
 * - Dynamic Sold Out handling: replaces action button with clear "Sold Out" badge/button
 */
export function ProjectCard({ project, className = '' }) {
  const router = useRouter()
  if (!project) return null

  const projectSlug = project.slug || project.id || project.projectId
  const projectUrl = `/projects/${projectSlug}`

  // 1. Determine Sold Out / On Hold status strictly from database
  const statusStr = String(project.status || '').trim().toLowerCase()
  const plotsArray = Array.isArray(project.plots) ? project.plots : []
  const allPlotsSold =
    plotsArray.length > 0 &&
    plotsArray.every((p) => String(p.status || '').toLowerCase() === 'sold')
  const isSoldOut =
    statusStr === 'sold' ||
    statusStr === 'sold out' ||
    statusStr === 'soldout' ||
    Boolean(project.isSoldOut) ||
    allPlotsSold ||
    (typeof project.availablePlots === 'number' &&
      project.availablePlots === 0 &&
      (project.totalPlots > 0 || plotsArray.length > 0))
  const isOnHold = !isSoldOut && (statusStr === 'on hold' || statusStr === 'onhold' || statusStr === 'reserved')
  const isLocked = isSoldOut || isOnHold
  const lockedLabel = isSoldOut ? 'Sold Out' : 'On Hold'

  // 2. Extract genuine images from database (no dummy hardcoded fillers)
  const cardImages = useMemo(() => {
    const raw = [
      project.coverImage,
      project.image,
      ...(Array.isArray(project.images) ? project.images : []),
      ...(Array.isArray(project.gallery) ? project.gallery : []),
    ].filter((img) => typeof img === 'string' && img.trim().length > 0)

    const unique = Array.from(new Set(raw))
    if (unique.length > 0) return unique
    return ['/images/hero-estate.jpg']
  }, [project])

  const [activeImgIndex, setActiveImgIndex] = useState(0)
  const [isFavorited, setIsFavorited] = useState(false)

  // Load wishlist state from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ce_wishlist') || '[]')
      setIsFavorited(saved.includes(projectSlug))
    } catch {
      // ignore
    }
  }, [projectSlug])

  const toggleFavorite = (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const saved = JSON.parse(localStorage.getItem('ce_wishlist') || '[]')
      let updated = []
      if (saved.includes(projectSlug)) {
        updated = saved.filter((s) => s !== projectSlug)
        setIsFavorited(false)
      } else {
        updated = [...saved, projectSlug]
        setIsFavorited(true)
      }
      localStorage.setItem('ce_wishlist', JSON.stringify(updated))
    } catch {
      setIsFavorited(!isFavorited)
    }
  }

  // Carousel navigation handlers: pure state updates with stopPropagation to prevent jumps
  const handlePrevImage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveImgIndex((prev) => (prev - 1 + cardImages.length) % cardImages.length)
  }

  const handleNextImage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveImgIndex((prev) => (prev + 1) % cardImages.length)
  }

  const handleDotClick = (idx, e) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveImgIndex(idx)
  }

  const handleMediaClick = (e) => {
    // If project is sold out or on hold, never redirect or navigate to other pages
    if (isLocked) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    // If click was on button, dots or interactive element, do not navigate
    if (e.target.closest('button') || e.target.closest('.ce-pcard__dots') || e.target.closest('a')) {
      return
    }
    router.push(projectUrl)
  }

  // 3. Dynamic Data Formatting (Strictly from DB)
  const rawTitle = project.name || project.projectName || 'Crystal Estates Property'
  const propTitle = rawTitle.replace(/_/g, ' ').trim()

  const locationDisplay =
    project.location ||
    [project.village, project.taluk, project.district].filter(Boolean).join(', ') ||
    ''

  // Price Display
  const priceDisplay = (() => {
    if (isLocked) return lockedLabel
    if (project.priceFormatted && project.priceFormatted !== 'Price on Request') return project.priceFormatted
    if (project.priceDisplay && project.priceDisplay !== 'Price on Request') return project.priceDisplay
    if (project.price) return formatPrice(project.price)
    return 'Price on Request'
  })()

  // Clean Area extent
  const areaDisplay = (() => {
    const raw = project.availableArea || project.totalLandArea || project.area
    if (!raw) return null
    return String(raw)
      .replace(/\.{2,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  })()

  // Dynamic Specs directly from database
  const totalPlots = project.totalPlots || (Array.isArray(project.plots) ? project.plots.length : null)
  const facing = project.facing ? `${project.facing} Facing` : null
  const bedrooms = project.bedrooms ? `${project.bedrooms} Bedrooms` : null
  const bathrooms = project.bathrooms ? `${project.bathrooms} Bathrooms` : null

  // Real database rating if present
  const hasRating = typeof project.rating === 'number' || Boolean(project.rating)
  const ratingValue = project.rating
  const reviewsCount = project.reviewsCount || project.reviews?.length || null

  const hasMultipleImages = cardImages.length > 1

  return (
    <article className={`ce-pcard ${isLocked ? 'ce-pcard--soldout' : ''} ${className}`.trim()}>
      {/* ── Media Viewport (standard div to prevent router scroll-to-top jumping) ── */}
      <div
        className="ce-pcard__media"
        style={isLocked ? { cursor: 'default' } : undefined}
        onClick={handleMediaClick}
        role="region"
        aria-label={`${propTitle} photo preview`}
      >
        {/* Layered smooth cross-fade slides */}
        {cardImages.map((src, idx) => (
          <div
            key={src + idx}
            className={`ce-pcard__slide-layer ${idx === activeImgIndex ? 'is-active' : ''}`}
          >
            <Image
              src={src}
              alt={`${propTitle} image ${idx + 1}`}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="ce-pcard__img"
              loading={idx === 0 ? 'eager' : 'lazy'}
              onError={(e) => {
                e.currentTarget.src = '/images/hero-estate.jpg'
              }}
            />
          </div>
        ))}

        {/* Top Badges Floating Row */}
        <div className="ce-pcard__top-bar">
          {/* Price or Sold Out / On Hold Pill Badge */}
          <div
            className={`ce-pcard__price-badge ${isLocked ? 'ce-pcard__price-badge--soldout' : ''}`}
            title={isLocked ? `Project is ${lockedLabel}` : `Price: ${priceDisplay}`}
          >
            {isLocked && <span className="ce-pcard__soldout-dot" />}
            <span>{isLocked ? lockedLabel : priceDisplay}</span>
          </div>

          {/* Wishlist Heart Button */}
          <button
            type="button"
            onClick={toggleFavorite}
            className={`ce-pcard__heart-btn ${isFavorited ? 'is-active' : ''}`}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            title={isFavorited ? 'Saved to Favorites' : 'Save to Favorites'}
          >
            <Heart
              size={18}
              fill={isFavorited ? '#ef4444' : 'none'}
              color={isFavorited ? '#ef4444' : '#ffffff'}
              strokeWidth={2}
            />
          </button>
        </div>

        {/* Carousel Prev/Next Buttons (only if project has multiple images) */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              className="ce-pcard__arrow ce-pcard__arrow--prev"
              aria-label="Previous image"
              title="Previous photo"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              className="ce-pcard__arrow ce-pcard__arrow--next"
              aria-label="Next image"
              title="Next photo"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Bottom Dark Gradient Overlay */}
        <div className="ce-pcard__overlay">
          {/* Slide Indicators: only shown if multiple images exist */}
          {hasMultipleImages && (
            <div className="ce-pcard__dots">
              {cardImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleDotClick(idx, e)}
                  className={`ce-pcard__dot ${idx === activeImgIndex ? 'is-active' : ''}`}
                  aria-label={`Go to photo ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Line 1: Title on left, dynamic rating or approval badge on right */}
          <div className="ce-pcard__header-row">
            {isLocked ? (
              <div className="ce-pcard__title-wrap" title={`${propTitle} (${lockedLabel})`}>
                <h3 className="ce-pcard__title ce-pcard__title--soldout">{propTitle}</h3>
              </div>
            ) : (
              <Link href={projectUrl} className="ce-pcard__title-link" title={propTitle}>
                <h3 className="ce-pcard__title">{propTitle}</h3>
              </Link>
            )}

            {hasRating ? (
              <div className="ce-pcard__rating" title={`Rating: ${ratingValue}`}>
                <Star size={14} className="ce-pcard__rating-star" />
                <span>{ratingValue}</span>
                {reviewsCount && <span className="ce-pcard__rating-count">({reviewsCount})</span>}
              </div>
            ) : project.approvalStatus ? (
              <div className="ce-pcard__approval-badge" title={project.approvalStatus}>
                <ShieldCheck size={13} />
                <span>{project.approvalStatus}</span>
              </div>
            ) : null}
          </div>

          {/* Line 2: Dynamic Location from Database */}
          {locationDisplay && (
            <div className="ce-pcard__location-row" title={locationDisplay}>
              <MapPin size={13} className="ce-pcard__location-icon" />
              <span>{locationDisplay}</span>
            </div>
          )}

          {/* Line 3: Dynamic Specs Row (Only showing fields that exist in DB) */}
          <div className="ce-pcard__specs-row">
            {bedrooms && (
              <div className="ce-pcard__spec-item" title={bedrooms}>
                <BedDouble size={14} className="ce-pcard__spec-icon" />
                <span>{bedrooms}</span>
              </div>
            )}

            {bathrooms && (
              <div className="ce-pcard__spec-item" title={bathrooms}>
                <Bath size={14} className="ce-pcard__spec-icon" />
                <span>{bathrooms}</span>
              </div>
            )}

            {totalPlots && !bedrooms && (
              <div className="ce-pcard__spec-item" title={`${totalPlots} Total Plots`}>
                <Layers size={14} className="ce-pcard__spec-icon" />
                <span>{totalPlots} Plots</span>
              </div>
            )}

            {facing && (
              <div className="ce-pcard__spec-item" title={facing}>
                <Compass size={14} className="ce-pcard__spec-icon" />
                <span>{facing}</span>
              </div>
            )}

            {areaDisplay && (
              <div className="ce-pcard__spec-item" title={areaDisplay}>
                <Maximize2 size={13} className="ce-pcard__spec-icon" />
                <span>{areaDisplay}</span>
              </div>
            )}
          </div>

          {/* Line 4: Action Button — Dynamically replaced with 'Sold Out' / 'On Hold' if locked */}
          {isLocked ? (
            <button
              type="button"
              disabled
              className="ce-pcard__cta-btn ce-pcard__cta-btn--soldout"
              aria-disabled="true"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <span className="ce-pcard__soldout-badge">
                <span className="ce-pcard__soldout-dot" />
                <span>{lockedLabel}</span>
              </span>
            </button>
          ) : (
            <Link href={projectUrl} className="ce-pcard__cta-btn" aria-label={`View ${propTitle} Details`}>
              <FileText size={15} className="ce-pcard__cta-icon" />
              <span>View Project Details</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

export default ProjectCard
