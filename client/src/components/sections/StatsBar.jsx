'use client'

import React, { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap, isReducedMotion } from '../../lib/gsap'
import { CountUp } from '../ui'
import { ShieldCheck, MapPin, Users, Award } from 'lucide-react'

const statIcons = [ShieldCheck, MapPin, Users, Award]

const defaultStats = [
  {
    value: 15,
    suffix: '+',
    label: 'Years of Trust',
    desc: 'Uncompromising legal transparency and client trust since 2014.',
    tag: 'Since 2014',
  },
  {
    value: 50,
    suffix: '+',
    label: 'Projects Delivered',
    desc: 'CMDA & DTCP plotted layouts and managed farmland communities.',
    tag: 'Chennai & Kanchi',
  },
  {
    value: 2000,
    suffix: '+',
    label: 'Happy Families',
    desc: 'Generational wealth secured through clear-title land assets.',
    tag: 'Landowners',
  },
  {
    value: 100,
    suffix: '%',
    label: 'Clear Titles & Patta',
    desc: 'Strict 30-year parent deed legal vetting and individual patta.',
    tag: 'Guaranteed',
  },
]

/**
 * Reusable Modern StatsBar component matching the Featured Projects UI design language
 */
export default function StatsBar({
  eyebrow = 'Our Milestones',
  title = 'A Proven Decade in Numbers',
  subtitle = 'Over a decade of legally verified land acquisitions, DTCP & CMDA approved layouts, and families empowered across prime Chennai corridors.',
  items = defaultStats,
  className = '',
  hideHeader = false,
}) {
  const sectionRef = useRef(null)

  useGSAP(
    () => {
      if (isReducedMotion()) return
      const cards = sectionRef.current?.querySelectorAll('.modern-stat-card')
      if (!cards || cards.length === 0) return

      // Use IntersectionObserver to reliably trigger entrance animation without freezing elements at opacity: 0
      if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                gsap.fromTo(
                  cards,
                  { opacity: 0, y: 24 },
                  {
                    opacity: 1,
                    y: 0,
                    duration: 0.65,
                    stagger: 0.1,
                    ease: 'power2.out',
                    clearProps: 'opacity,transform',
                  }
                )
                observer.disconnect()
              }
            })
          },
          { threshold: 0.1 }
        )
        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
      }
    },
    { scope: sectionRef },
  )

  return (
    <section className={`modern-stats-section ${className}`.trim()} ref={sectionRef}>
      <div className="modern-stats-container">
        {!hideHeader && (
          <div className="modern-stats-header">
            {eyebrow && <span className="modern-stats-badge">{eyebrow}</span>}
            {title && <h2 className="modern-stats-title">{title}</h2>}
            {subtitle && <p className="modern-stats-subtitle">{subtitle}</p>}
          </div>
        )}

        <div className="modern-stats-grid">
          {items.map((s, idx) => {
            const Icon = statIcons[idx % statIcons.length]
            return (
              <div key={idx} className="modern-stat-card">
                <div className="modern-stat-card__top">
                  <div className="modern-stat-card__icon-wrap">
                    <Icon size={20} className="modern-stat-card__icon" />
                  </div>
                  {s.tag && <span className="modern-stat-card__tag">{s.tag}</span>}
                </div>

                <div className="modern-stat-card__number">
                  <CountUp to={s.value} suffix={s.suffix} />
                </div>

                <div className="modern-stat-card__label">{s.label}</div>
                {s.desc && <p className="modern-stat-card__desc">{s.desc}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
