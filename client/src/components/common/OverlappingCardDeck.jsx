'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Car,
  FileCheck2,
  MapPin,
  Award,
  ShieldCheck,
  BadgeCheck,
  CheckCircle2,
  Receipt,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import './OverlappingCardDeck.css'

// 4 distinct luxury themes matching Crystal Estates' brand
const CARD_THEMES = [
  {
    auraBg: 'radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.22) 0%, rgba(167, 243, 208, 0.08) 50%, transparent 75%)',
    iconColor: '#0F3D2E',
    iconBg: 'rgba(15, 61, 46, 0.08)',
    defaultIcon: Car,
    defaultBadge: 'Verified Standard',
  },
  {
    auraBg: 'radial-gradient(circle at 50% 30%, rgba(217, 119, 6, 0.22) 0%, rgba(254, 240, 138, 0.1) 50%, transparent 75%)',
    iconColor: '#9E7A46',
    iconBg: 'rgba(197, 168, 128, 0.15)',
    defaultIcon: FileCheck2,
    defaultBadge: 'Clear Lineage',
  },
  {
    auraBg: 'radial-gradient(circle at 50% 30%, rgba(13, 148, 136, 0.22) 0%, rgba(153, 246, 228, 0.08) 50%, transparent 75%)',
    iconColor: '#0D9488',
    iconBg: 'rgba(13, 148, 136, 0.1)',
    defaultIcon: MapPin,
    defaultBadge: 'On-Ground Proof',
  },
  {
    auraBg: 'radial-gradient(circle at 50% 30%, rgba(5, 150, 105, 0.24) 0%, rgba(110, 231, 183, 0.1) 50%, transparent 75%)',
    iconColor: '#0F3D2E',
    iconBg: 'rgba(15, 61, 46, 0.08)',
    defaultIcon: Award,
    defaultBadge: '100% Guaranteed',
  },
]

// Intelligent icon resolver matching real estate keywords
function resolveIcon(item, idx) {
  if (item.icon) return item.icon

  const t = (item.title || '').toLowerCase()
  const d = (item.text || item.desc || '').toLowerCase()
  const combined = `${t} ${d}`

  if (combined.includes('cab') || combined.includes('pickup') || combined.includes('car') || combined.includes('doorstep') || combined.includes('visit')) {
    return Car
  }
  if (combined.includes('deed') || combined.includes('scrutiny') || combined.includes('lineage') || combined.includes('audit') || combined.includes('title')) {
    return FileCheck2
  }
  if (combined.includes('demarcation') || combined.includes('boundary') || combined.includes('stone') || combined.includes('corner') || combined.includes('road')) {
    return MapPin
  }
  if (combined.includes('developer') || combined.includes('transparency') || combined.includes('brokerage') || combined.includes('pricing') || combined.includes('fee')) {
    return Award
  }
  if (combined.includes('approval') || combined.includes('sanction') || combined.includes('dtcp') || combined.includes('cmda') || combined.includes('norm')) {
    return BadgeCheck
  }
  if (combined.includes('patta') || combined.includes('registration') || combined.includes('transfer')) {
    return CheckCircle2
  }
  if (combined.includes('research') || combined.includes('editorial') || combined.includes('principle')) {
    return Sparkles
  }

  return CARD_THEMES[idx % CARD_THEMES.length].defaultIcon || ShieldCheck
}

export default function OverlappingCardDeck({ items = [], className = '' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [activeMobileIdx, setActiveMobileIdx] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const deckRef = useRef(null)

  // Track viewport width for responsive interaction mode
  useEffect(() => {
    const checkWidth = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkWidth()
    window.addEventListener('resize', checkWidth, { passive: true })
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  // Mobile horizontal scroll tracking for dot indicators
  const handleScroll = useCallback(() => {
    if (!deckRef.current || !isMobile) return
    const el = deckRef.current
    const scrollLeft = el.scrollLeft
    const cardWidth = el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width + 16 : 300
    const idx = Math.round(scrollLeft / cardWidth)
    setActiveMobileIdx(Math.max(0, Math.min(items.length - 1, idx)))
  }, [isMobile, items.length])

  const scrollToCard = (index) => {
    if (!deckRef.current) return
    const el = deckRef.current
    const cardWidth = el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width + 16 : 300
    el.scrollTo({
      left: index * cardWidth,
      behavior: 'smooth',
    })
    setActiveMobileIdx(index)
  }

  if (!items || items.length === 0) return null

  const total = items.length
  const mid = (total - 1) / 2

  return (
    <div className={`ocd-wrapper ${className}`}>
      <div
        ref={deckRef}
        className="ocd-deck"
        onScroll={handleScroll}
        onMouseLeave={() => setHoveredIdx(null)}
        role="list"
        aria-label="Commitment and standard cards"
      >
        {items.map((item, idx) => {
          const theme = CARD_THEMES[idx % CARD_THEMES.length]
          const Icon = resolveIcon(item, idx)
          const isHovered = hoveredIdx === idx
          const isLeftOfHovered = hoveredIdx !== null && idx < hoveredIdx
          const isRightOfHovered = hoveredIdx !== null && idx > hoveredIdx

          // Dynamic resting fan angle and vertical arc calculation
          const offset = idx - mid
          const baseRotate = offset * 2.2
          const baseY = Math.pow(Math.abs(offset), 1.35) * 5

          // Compute dynamic transformation
          let currentTransform = ''
          let currentZIndex = idx + 1
          let currentOpacity = 1

          if (!isMobile) {
            if (isHovered) {
              currentTransform = 'translate3d(0, -28px, 0) rotate(0deg) scale(1.05)'
              currentZIndex = 50
              currentOpacity = 1
            } else if (isLeftOfHovered) {
              currentTransform = `translate3d(-28px, ${baseY + 4}px, 0) rotate(${baseRotate - 1.2}deg) scale(0.98)`
              currentZIndex = idx + 1
              currentOpacity = 0.88
            } else if (isRightOfHovered) {
              currentTransform = `translate3d(28px, ${baseY + 4}px, 0) rotate(${baseRotate + 1.2}deg) scale(0.98)`
              currentZIndex = idx + 1
              currentOpacity = 0.88
            } else {
              // Neutral resting state
              currentTransform = `translate3d(0, ${baseY}px, 0) rotate(${baseRotate}deg) scale(1)`
              currentZIndex = idx + 1
              currentOpacity = 1
            }
          }

          const cardStyle = isMobile
            ? {}
            : {
                transform: currentTransform,
                zIndex: currentZIndex,
                opacity: currentOpacity,
              }

          return (
            <div
              key={item.num || item.title || idx}
              className={`ocd-card ${isHovered ? 'is-hovered' : ''} ${activeMobileIdx === idx ? 'is-active' : ''}`}
              style={cardStyle}
              onMouseEnter={() => !isMobile && setHoveredIdx(idx)}
              onFocus={() => !isMobile && setHoveredIdx(idx)}
              onBlur={() => !isMobile && setHoveredIdx(null)}
              onClick={() => isMobile && scrollToCard(idx)}
              tabIndex={0}
              role="listitem"
            >
              {/* Soft ambient background glow */}
              <div
                className="ocd-card__aura"
                style={{ background: theme.auraBg }}
                aria-hidden="true"
              />

              {/* Card Header: Floating Icon & Numeral */}
              <div className="ocd-card__header">
                <div
                  className="ocd-card__icon-box"
                  style={{
                    backgroundColor: theme.iconBg,
                    color: theme.iconColor,
                  }}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="ocd-card__num">
                  {item.num || String(idx + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Card Body: Title, Hairline & Description */}
              <div className="ocd-card__body">
                <h4 className="ocd-card__title">{item.title}</h4>
                <div className="ocd-card__hairline" aria-hidden="true" />
                <p className="ocd-card__text">{item.text || item.desc}</p>
              </div>

              {/* Card Footer: Verified Pill Badge & Directional Arrow */}
              <div className="ocd-card__footer">
                <span className="ocd-card__pill">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A880]" aria-hidden="true" />
                  {item.badge || theme.defaultBadge}
                </span>
                <span className="ocd-card__arrow" aria-hidden="true">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile Swipe Pagination Dots */}
      <div className="ocd-dots" aria-hidden="true">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`ocd-dot ${activeMobileIdx === i ? 'is-active' : ''}`}
            onClick={() => scrollToCard(i)}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
