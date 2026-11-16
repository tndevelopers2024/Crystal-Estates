'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, ArrowUpRight, Calendar, Clock, Newspaper } from 'lucide-react'
import { newsArticles } from '../../data/news'

export default function LatestUpdatesSection({
  title = 'Latest Property Updates',
  subtitle = 'Market trends, regulatory updates, CMDA/DTCP insights, and land appreciation analysis across Chennai.',
  eyebrow = 'Market Intelligence',
  className = '',
}) {
  const trackRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })
  const hasMoved = useRef(false)

  const updates = newsArticles

  const checkScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 15)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15)
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
    const card = el.querySelector('.updates-reel-card')
    const scrollAmount = ((card?.offsetWidth || 380) + 24) * (direction === 'left' ? -1 : 1)
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

  const handleClickCapture = (e) => {
    if (hasMoved.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <section className={`updates-reel-sec ${className}`.trim()} aria-label="Latest Property Updates">
      <div className="updates-reel-container">
        {/* Header */}
        <div className="updates-reel-header">
          <div className="updates-reel-header__intro">
            <div className="updates-reel-badge">
              <Newspaper size={14} className="updates-reel-badge__icon" />
              <span>{eyebrow}</span>
            </div>
            <h2 className="updates-reel-title">{title}</h2>
            <p className="updates-reel-subtitle">{subtitle}</p>
          </div>

          <div className="updates-reel-header__actions">
            <Link href="/news" className="updates-reel-all-btn">
              <span>View All News</span>
              <ArrowUpRight size={15} />
            </Link>

            <div className="updates-reel-nav">
              <button
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                className="updates-reel-nav-btn"
                aria-label="Previous property update"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                className="updates-reel-nav-btn"
                aria-label="Next property update"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Editorial Track */}
        <div className="updates-reel-track-wrapper">
          <div
            ref={trackRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`updates-reel-track ${isDragging ? 'is-dragging' : ''}`}
          >
            {updates.map((item, idx) => (
              <article
                key={item.id || idx}
                className="updates-reel-card"
                onClickCapture={handleClickCapture}
              >
                <Link href={`/news/${item.slug}`} className="updates-reel-card__inner">
                  <div className="updates-reel-card__media">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 85vw, (max-width: 1200px) 380px, 420px"
                      className="updates-reel-card__img"
                    />
                    <div className="updates-reel-card__gradient" />
                    <span className="updates-reel-card__category">{item.category}</span>
                  </div>

                  <div className="updates-reel-card__body">
                    <div className="updates-reel-card__meta">
                      <span className="updates-reel-card__meta-item">
                        <Calendar size={13} />
                        <span>{item.date}</span>
                      </span>
                      <span className="updates-reel-card__meta-sep">•</span>
                      <span className="updates-reel-card__meta-item">
                        <Clock size={13} />
                        <span>{item.readTime}</span>
                      </span>
                    </div>

                    <h3 className="updates-reel-card__title">
                      {item.title}
                    </h3>

                    <p className="updates-reel-card__excerpt">{item.excerpt}</p>

                    <div className="updates-reel-card__footer">
                      <span className="updates-reel-card__cta-text">Read Article</span>
                      <div className="updates-reel-card__cta-icon" aria-hidden="true">
                        <ArrowUpRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
