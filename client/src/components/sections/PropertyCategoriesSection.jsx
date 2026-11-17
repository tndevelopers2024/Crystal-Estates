'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, ArrowUpRight, Home, Trees, Building2, Landmark, Compass } from 'lucide-react'

const categories = [
  {
    id: 'residential',
    title: 'Residential Plots',
    tag: 'CMDA & DTCP Approved',
    description:
      'Gated community plots with blacktop roads, sweet groundwater, compound walls, and immediate construction clearance.',
    locations: 'Prime Residential Corridors',
    stat: 'Individual & Gated Plots',
    href: '/projects',
    image: '/images/somamangalam.jpg',
    icon: Home,
  },
  {
    id: 'farmland',
    title: 'Agricultural & Farm Land',
    tag: 'Managed Farmland',
    description:
      'Fertile agro-forestry farm lands planted with high-value trees, sweet water sources, and 24/7 plantation care.',
    locations: 'Fertile Agro Corridors',
    stat: 'Acreage & Farm Parcels',
    href: '/projects',
    image: '/images/vedanthangal.jpg',
    icon: Trees,
  },
  {
    id: 'commercial',
    title: 'Commercial & Highway Land',
    tag: 'High-Visibility Frontage',
    description:
      'Prime commercial frontages along major arterial corridors ideal for showrooms, logistics, institutions, and corporate warehouses.',
    locations: 'Arterial Highway Corridors',
    stat: 'Commercial Frontages',
    href: '/projects',
    image: '/images/kolapakkam.jpg',
    icon: Building2,
  },
  {
    id: 'bulk-investment',
    title: 'Bulk Land & Investment Parcels',
    tag: 'Strategic Land Banks',
    description:
      'Clear-titled large acreage for HNIs and family offices seeking generational wealth preservation with 30-year legal vetting.',
    locations: 'Strategic Growth Corridors',
    stat: '5+ Acres Multi-Acre Parcels',
    href: '/sell-your-land',
    image: '/images/brammadesam.jpg',
    icon: Landmark,
  },
]

export default function PropertyCategoriesSection({
  title = 'Property Categories',
  subtitle = 'Explore diversified land opportunities tailored for residential living, agro-forestry, and high-yield capital appreciation.',
  eyebrow = 'Diversified Land Assets',
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

    // Calculate approximate active card index
    const cards = el.querySelectorAll('.cat-horizon-card')
    if (cards.length > 0) {
      const cardWidth = cards[0].offsetWidth + 24
      const newIndex = Math.min(
        categories.length - 1,
        Math.max(0, Math.round(scrollLeft / cardWidth))
      )
      setActiveIndex(newIndex)
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

  const scrollToIndex = (index) => {
    const el = trackRef.current
    if (!el) return
    const cards = el.querySelectorAll('.cat-horizon-card')
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    }
  }

  const handleScroll = (direction) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('.cat-horizon-card')
    const scrollAmount = ((card?.offsetWidth || 440) + 24) * (direction === 'left' ? -1 : 1)
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
    <section className={`cat-horizon-sec ${className}`.trim()} aria-label="Property Categories">
      {/* Top Header Row with Eyebrow, Title & Controls */}
      <div className="cat-horizon-header">
        <div className="cat-horizon-header__intro">
          <div className="cat-horizon-badge">
            <Compass size={14} className="cat-horizon-badge__icon" />
            <span>{eyebrow}</span>
          </div>
          <h2 className="cat-horizon-title">{title}</h2>
          <p className="cat-horizon-subtitle">{subtitle}</p>
        </div>

        <div className="cat-horizon-header__controls">
          {/* Navigation Arrows */}
          <div className="cat-horizon-nav">
            <button
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className="cat-horizon-nav__btn"
              aria-label="Previous property category"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className="cat-horizon-nav__btn"
              aria-label="Next property category"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Category Quick-Filter Bar */}
      {/* <div className="cat-horizon-filter-bar">
        <div className="cat-horizon-filter-track">
          {categories.map((cat, idx) => (
            <button
              key={cat.id}
              onClick={() => scrollToIndex(idx)}
              className={`cat-horizon-filter-tab ${activeIndex === idx ? 'is-active' : ''}`}
            >
              <span className="cat-horizon-filter-tab__dot" />
              <span>{cat.title}</span>
            </button>
          ))}
        </div>
      </div> */}

      {/* Modern Horizontal Scroll Track */}
      <div className="cat-horizon-track-container">
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`cat-horizon-track ${isDragging ? 'is-dragging' : ''}`}
        >
          {categories.map((cat, idx) => {
            const Icon = cat.icon
            return (
              <article
                key={cat.id}
                className={`cat-horizon-card ${activeIndex === idx ? 'is-focused' : ''}`}
                onClickCapture={handleClickCapture}
              >
                <Link href={cat.href} className="cat-horizon-card__inner">
                  {/* Panoramic Image Header */}
                  <div className="cat-horizon-card__media">
                    <Image
                      src={cat.image}
                      alt={cat.title}
                      fill
                      sizes="(max-width: 768px) 90vw, (max-width: 1280px) 520px, 580px"
                      className="cat-horizon-card__img"
                    />
                    <div className="cat-horizon-card__gradient" />

                    {/* Top Tag & Number */}
                    <div className="cat-horizon-card__media-top">
                      <span className="cat-horizon-card__tag">{cat.tag}</span>
                      <span className="cat-horizon-card__num">0{idx + 1}</span>
                    </div>

                    {/* Floating Icon Badge */}
                    <div className="cat-horizon-card__icon-badge">
                      <Icon size={20} />
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="cat-horizon-card__body">
                    <div className="cat-horizon-card__main-info">
                      <h3 className="cat-horizon-card__title">{cat.title}</h3>
                      <p className="cat-horizon-card__desc">{cat.description}</p>
                    </div>

                    {/* Metadata pill badge */}
                    <div className="cat-horizon-card__meta">
                      <div className="cat-horizon-card__meta-loc">
                        <span className="cat-horizon-card__meta-label">Location Corridor</span>
                        <strong className="cat-horizon-card__meta-val">{cat.locations}</strong>
                      </div>
                      <div className="cat-horizon-card__meta-stat">
                        <span className="cat-horizon-card__meta-label">Asset Type</span>
                        <strong className="cat-horizon-card__meta-val">{cat.stat}</strong>
                      </div>
                    </div>

                    {/* Footer with Explore Link */}
                    <div className="cat-horizon-card__footer">
                      <span className="cat-horizon-card__cta-text">Explore Category</span>
                      <div className="cat-horizon-card__cta-btn" aria-hidden="true">
                        <ArrowUpRight size={17} />
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
