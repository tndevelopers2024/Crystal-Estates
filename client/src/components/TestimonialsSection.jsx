'use client'

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { Star, StarHalf, ChevronLeft, ChevronRight, Quote, ShieldCheck } from 'lucide-react'
import { Container } from './ui'
import defaultTestimonials from '../data/testimonials'

/**
 * Helper to get user initials for fallback avatar
 */
function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CE'
}

/**
 * StarRating component supporting half stars (e.g. 3.5, 4.0, 4.5, 5.0)
 */
function StarRating({ rating = 5 }) {
  const num = typeof rating === 'number' ? rating : parseFloat(rating) || 5
  const fullStars = Math.floor(num)
  const hasHalfStar = num % 1 >= 0.4
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalfStar ? 1 : 0))

  return (
    <div className="testimonial-rating-wrap" aria-label={`${num} out of 5 stars`}>
      <div className="testimonial-stars-row">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} size={16} className="star-icon star-icon--filled" />
        ))}
        {hasHalfStar && (
          <StarHalf key="half" size={16} className="star-icon star-icon--half" />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} size={16} className="star-icon star-icon--empty" />
        ))}
      </div>
      <span className="testimonial-rating-badge">
        {num.toFixed(1)}
      </span>
    </div>
  )
}

/**
 * Reusable TestimonialsSection Component
 * Modern, elevated presentation matching the site's editorial design system.
 */
export function TestimonialsSection({
  title = 'What Our Landowners Say',
  subtitle = 'Authentic reviews and real experiences from families and investors who secured their plots and farmland with Crystal Estates.',
  badge = 'VERIFIED BUYER REVIEWS',
  limit,
  variant = 'slider',
  className = '',
}) {
  const [testimonials, setTestimonials] = useState(defaultTestimonials)
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardsPerView, setCardsPerView] = useState(3)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  // Reduced motion preference
  const prefersReducedMotion = useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined') return () => {}
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false),
    () => false
  )

  const touchStartX = useRef(null)
  const touchEndX = useRef(null)
  const sliderRef = useRef(null)

  // Data fetching fallback
  useEffect(() => {
    let isMounted = true
    fetch('/api/testimonials', { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.testimonials || data?.data || []
        if (isMounted && items.length > 0) {
          setTestimonials(items)
        }
      })
      .catch(() => {
        if (isMounted) setTestimonials(defaultTestimonials)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Responsive cardsPerView detector
  useEffect(() => {
    const updateCardsPerView = () => {
      const width = window.innerWidth
      if (width < 768) {
        setCardsPerView(1)
      } else if (width < 1024) {
        setCardsPerView(2)
      } else {
        setCardsPerView(3)
      }
    }
    updateCardsPerView()
    window.addEventListener('resize', updateCardsPerView)
    return () => window.removeEventListener('resize', updateCardsPerView)
  }, [])

  const items = Array.isArray(testimonials)
    ? limit ? testimonials.slice(0, limit) : testimonials
    : []

  const maxIndex = Math.max(0, items.length - cardsPerView)
  const safeIndex = Math.min(currentIndex, maxIndex)

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1))
  }, [maxIndex])

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1))
  }, [maxIndex])

  // Autoplay slider
  useEffect(() => {
    if (variant !== 'slider' || prefersReducedMotion || isHovered || isFocused || items.length <= cardsPerView) {
      return
    }
    const timer = setInterval(() => {
      goNext()
    }, 6000)
    return () => clearInterval(timer)
  }, [variant, prefersReducedMotion, isHovered, isFocused, items.length, cardsPerView, goNext])

  // Touch Swipe handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = null
  }

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 40) {
      if (diff > 0) goNext()
      else goPrev()
    }
    touchStartX.current = null
    touchEndX.current = null
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goPrev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      goNext()
    }
  }

  if (!items || items.length === 0) {
    return null
  }

  const gap = 24
  const slideOffset = `calc(-${safeIndex} * ((100% + ${gap}px) / ${cardsPerView}))`

  return (
    <section
      id="testimonials"
      className={`modern-testimonials-section ${className}`.trim()}
      aria-label="Landowner Testimonials"
    >
      <Container>
        {/* Header Block matching About Us & Reference System */}
        <div className="modern-testimonials-header">
          <div className="modern-testimonials-header__left">
            <span className="modern-testimonials-badge">
              {badge}
            </span>
            <h2 className="modern-testimonials-title">
              {title}
            </h2>
            {subtitle && (
              <p className="modern-testimonials-subtitle">
                {subtitle}
              </p>
            )}
          </div>

          {/* Dual Navigation Controls */}
          {variant === 'slider' && items.length > cardsPerView && (
            <div className="modern-testimonials-nav" aria-label="Slider Controls">
              <button
                type="button"
                onClick={goPrev}
                className="modern-testimonials-nav-btn"
                aria-label="Previous testimonial"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="modern-testimonials-nav-btn"
                aria-label="Next testimonial"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Carousel Slider Viewport */}
        <div
          className="modern-testimonials-viewport"
          ref={sliderRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Customer Testimonials Carousel"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={handleKeyDown}
        >
          <div
            className={`modern-testimonials-track ${
              prefersReducedMotion ? 'is-reduced-motion' : ''
            }`}
            style={{
              transform: `translateX(${slideOffset})`,
            }}
          >
            {items.map((item, idx) => {
              const cardWidthCalc = `calc((100% - ${(cardsPerView - 1) * gap}px) / ${cardsPerView})`
              return (
                <article
                  key={item.id || idx}
                  className="modern-testimonial-card"
                  style={{
                    flex: `0 0 ${cardWidthCalc}`,
                    width: cardWidthCalc,
                    minWidth: cardWidthCalc,
                    maxWidth: cardWidthCalc,
                  }}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${idx + 1} of ${items.length}`}
                >
                {/* Card Top: Stars & Quote Icon */}
                <div className="modern-testimonial-card__header">
                  <StarRating rating={item.rating || 5} />
                  <Quote size={20} className="modern-testimonial-card__quote-icon" aria-hidden="true" />
                </div>

                {/* Real-world review quote */}
                <blockquote className="modern-testimonial-card__quote">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>

                {/* Author Information */}
                <div className="modern-testimonial-card__footer">
                  <div className="modern-testimonial-card__avatar">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <span
                      className="modern-testimonial-card__avatar-fallback"
                      style={{ display: item.photo ? 'none' : 'flex' }}
                    >
                      {getInitials(item.name)}
                    </span>
                  </div>

                  <div className="modern-testimonial-card__meta">
                    <div className="modern-testimonial-card__name-row">
                      <h3 className="modern-testimonial-card__name">{item.name}</h3>
                      <span className="modern-testimonial-card__verified" title="Verified Landowner">
                        <ShieldCheck size={13} />
                        <span>Verified</span>
                      </span>
                    </div>
                    <p className="modern-testimonial-card__sub">
                      {[item.role, item.location].filter(Boolean).join(' • ')}
                    </p>
                    {item.project && (
                      <span className="modern-testimonial-card__project-badge">
                        {item.project} {item.date ? `• ${item.date}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </article>
              )
            })}
          </div>
        </div>

        {/* Dots Pagination */}
        {variant === 'slider' && items.length > cardsPerView && (
          <div className="modern-testimonials-dots" role="tablist" aria-label="Slide pagination">
            {[...Array(maxIndex + 1)].map((_, dIdx) => (
              <button
                key={dIdx}
                type="button"
                role="tab"
                aria-selected={dIdx === safeIndex}
                className={`modern-testimonials-dot ${dIdx === safeIndex ? 'is-active' : ''}`}
                onClick={() => setCurrentIndex(dIdx)}
                aria-label={`Go to slide ${dIdx + 1}`}
              />
            ))}
          </div>
        )}
      </Container>
    </section>
  )
}

export default TestimonialsSection
