'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Star, StarHalf, ArrowLeft, ArrowRight, Quote, ShieldCheck } from 'lucide-react'
import defaultTestimonials from '../data/testimonials'

/**
 * Initials for the fallback avatar
 */
function getInitials(name = '') {
  return name
    .split(' ')
    .filter((part) => /[A-Za-z]/.test(part) && part.replace(/\./g, '').length > 1)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CE'
}

function toRating(value) {
  const num = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(num) ? Math.min(5, Math.max(0, num)) : 5
}

/**
 * Star row supporting half stars (3.5, 4.0, 4.5, 5.0)
 */
function StarRating({ rating = 5, size = 15 }) {
  const num = toRating(rating)
  const fullStars = Math.floor(num)
  const hasHalfStar = num % 1 >= 0.4
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalfStar ? 1 : 0))

  return (
    <div className="testimonial-showcase-stars" aria-label={`${num.toFixed(1)} out of 5 stars`} role="img">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} size={size} className="testimonial-showcase-star is-filled" aria-hidden="true" />
      ))}
      {hasHalfStar && <StarHalf size={size} className="testimonial-showcase-star is-filled" aria-hidden="true" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} size={size} className="testimonial-showcase-star" aria-hidden="true" />
      ))}
    </div>
  )
}

function TestimonialCard({ item, index, total }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = Boolean(item.photo) && !photoFailed
  const rating = toRating(item.rating || 5)

  return (
    <article
      className="testimonial-showcase-card"
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}`}
    >
      <div className="testimonial-showcase-card__top">
        <span className="testimonial-showcase-card__quote-mark" aria-hidden="true">
          <Quote size={18} />
        </span>
        <div className="testimonial-showcase-card__score">
          <StarRating rating={rating} size={14} />
          <span>{rating.toFixed(1)}</span>
        </div>
      </div>

      <blockquote className="testimonial-showcase-card__quote">{item.quote}</blockquote>

      <div className="testimonial-showcase-card__footer">
        <div className="testimonial-showcase-card__avatar">
          {showPhoto ? (
            <img src={item.photo} alt="" loading="lazy" onError={() => setPhotoFailed(true)} />
          ) : (
            <span aria-hidden="true">{getInitials(item.name)}</span>
          )}
        </div>

        <div className="testimonial-showcase-card__meta">
          <div className="testimonial-showcase-card__name-row">
            <h3 className="testimonial-showcase-card__name">{item.name}</h3>
            {item.verified !== false && (
              <span className="testimonial-showcase-card__verified" title="Verified landowner">
                <ShieldCheck size={13} aria-hidden="true" />
                Verified
              </span>
            )}
          </div>
          {(item.role || item.location) && (
            <p className="testimonial-showcase-card__sub">
              {[item.role, item.location].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {item.project && (
        <span className="testimonial-showcase-card__project">
          {item.project}
          {item.date ? ` · ${item.date}` : ''}
        </span>
      )}
    </article>
  )
}

/**
 * Customer testimonials, laid out like the Featured Projects showcase:
 * a sticky sidebar (badge, heading, rating summary, arrows) and a
 * drag-scrollable card track that bleeds off the right edge.
 */
export function TestimonialsSection({
  title = 'What Our Landowners Say',
  subtitle = 'Authentic reviews and real experiences from families and investors who secured their plots and farmland with Crystal Estates.',
  badge = 'Verified Buyer Reviews',
  limit,
  className = '',
}) {
  const [testimonials, setTestimonials] = useState(defaultTestimonials)
  const trackRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })
  const hasMoved = useRef(false)

  // Fallback fetch only when the bundled list is empty
  useEffect(() => {
    if (testimonials && testimonials.length > 0) return
    let isMounted = true
    fetch('/api/testimonials', { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.testimonials || data?.data || []
        if (isMounted && list.length > 0) setTestimonials(list)
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [testimonials])

  const items = Array.isArray(testimonials) ? (limit ? testimonials.slice(0, limit) : testimonials) : []

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
  }, [checkScrollState, items.length])

  const scrollByCard = (direction) => {
    const el = trackRef.current
    if (!el) return
    const cardWidth = el.querySelector('.testimonial-showcase-card')?.offsetWidth || 380
    el.scrollBy({ left: (cardWidth + 24) * (direction === 'left' ? -1 : 1), behavior: 'smooth' })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      scrollByCard('left')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      scrollByCard('right')
    }
  }

  const handleMouseDown = (e) => {
    const el = trackRef.current
    if (!el) return
    setIsDragging(true)
    hasMoved.current = false
    dragStart.current = { x: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    const el = trackRef.current
    if (!el) return
    const walk = (e.pageX - el.offsetLeft - dragStart.current.x) * 1.5
    if (Math.abs(walk) > 5) hasMoved.current = true
    el.scrollLeft = dragStart.current.scrollLeft - walk
  }

  const handleMouseUpOrLeave = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (hasMoved.current) {
      const preventClick = (clickEvent) => {
        clickEvent.stopPropagation()
        clickEvent.preventDefault()
        window.removeEventListener('click', preventClick, true)
      }
      window.addEventListener('click', preventClick, true)
    }
  }

  if (items.length === 0) return null

  const average = items.reduce((sum, t) => sum + toRating(t.rating || 5), 0) / items.length

  return (
    <section
      id="testimonials"
      className={`featured-showcase-section testimonial-showcase-section ${className}`.trim()}
      aria-label="Customer testimonials"
    >
      <div className="featured-showcase-container">
        <div className="featured-showcase-sidebar">
          <div className="featured-showcase-sidebar__top">
            <span className="featured-showcase-sidebar__badge">{badge}</span>
            <h2 className="featured-showcase-sidebar__title">{title}</h2>
            {subtitle && <p className="featured-showcase-sidebar__subtitle">{subtitle}</p>}

            <div className="testimonial-showcase-summary">
              <span className="testimonial-showcase-summary__score">{average.toFixed(1)}</span>
              <div className="testimonial-showcase-summary__meta">
                <StarRating rating={Math.round(average * 2) / 2} size={15} />
                <span>
                  From {items.length} verified landowner {items.length === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            </div>
          </div>

          <div className="featured-showcase-sidebar__nav">
            <button
              type="button"
              onClick={() => scrollByCard('left')}
              disabled={!canScrollLeft}
              className="featured-showcase-nav-btn"
              aria-label="Previous testimonials"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard('right')}
              disabled={!canScrollRight}
              className="featured-showcase-nav-btn"
              aria-label="Next testimonials"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="featured-showcase-track-wrapper">
          <div
            ref={trackRef}
            className={`featured-showcase-track testimonial-showcase-track ${isDragging ? 'is-dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onKeyDown={handleKeyDown}
            role="region"
            aria-roledescription="carousel"
            aria-label="Customer testimonials carousel"
            tabIndex={0}
          >
            {items.map((item, idx) => (
              <TestimonialCard key={item.id || idx} item={item} index={idx} total={items.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default TestimonialsSection
