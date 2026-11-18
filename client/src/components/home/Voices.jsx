'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Star, BadgeCheck } from 'lucide-react'
import { Eyebrow, EASE } from './motion'
import { testimonials } from '../../data/testimonials'

const AUTOPLAY_MS = 7000

export default function Voices() {
  const reduce = useReducedMotion()
  const items = testimonials.slice(0, 6)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = items.length
  const t = items[index]

  useEffect(() => {
    if (reduce || paused || total < 2) return undefined
    const id = setTimeout(() => setIndex((i) => (i + 1) % total), AUTOPLAY_MS)
    return () => clearTimeout(id)
  }, [index, paused, reduce, total])

  const go = (dir) => setIndex((i) => (i + dir + total) % total)
  if (!t) return null

  return (
    <section
      className="ch-voices"
      aria-labelledby="ch-voices-title"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="ch-wrap ch-voices__grid">
        <div className="ch-voices__side">
          <Eyebrow>Landowner stories</Eyebrow>
          <h2 id="ch-voices-title" className="ch-voices__count">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span className="ch-voices__of">/ {String(total).padStart(2, '0')}</span>
          </h2>
          <div className="ch-voices__nav">
            <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial">
              <ArrowLeft size={18} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next testimonial">
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="ch-voices__bars" aria-hidden="true">
            {items.map((it, i) => (
              <span key={it.id} className={i === index ? 'is-on' : ''}>
                {i === index && !reduce && !paused && (
                  <motion.i
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
                  />
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="ch-voices__stage" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.figure
              key={t.id}
              initial={reduce ? false : { opacity: 0, y: 24, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? undefined : { opacity: 0, y: -16, filter: 'blur(6px)' }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <div className="ch-voices__stars" aria-label={`${t.rating} out of 5 stars`} role="img">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < Math.round(t.rating) ? 'is-filled' : ''} aria-hidden="true" />
                ))}
              </div>
              <blockquote>
                <p>&ldquo;{t.quote}&rdquo;</p>
              </blockquote>
              <figcaption>
                <span className="ch-voices__avatar" aria-hidden="true">
                  {t.name
                    .split(/[\s&]+/)
                    .filter((w) => w.replace(/\./g, '').length > 1)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')}
                </span>
                <span>
                  <strong>
                    {t.name}
                    {t.verified && <BadgeCheck size={14} aria-label="Verified buyer" />}
                  </strong>
                  <small>
                    {t.project} · {t.location}
                  </small>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
