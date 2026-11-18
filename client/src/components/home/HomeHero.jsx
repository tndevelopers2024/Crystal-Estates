'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { ShieldCheck, MapPin } from 'lucide-react'
import { WordsPullUpMultiStyle, PillLink, EASE, openSiteVisit } from './motion'
import { stats } from '../../data/site'

const HERO_VIDEO =
  'https://res.cloudinary.com/rlokioxu/video/upload/v1793966711/13282387_3840_2160_60fps_online-video-cutter.com_qarfsk.mp4'

export default function HomeHero() {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 1.12])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 90])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <section id="home" ref={ref} className="ch-hero" aria-label="Crystal Estates">
      <div className="ch-hero__frame">
        <motion.div className="ch-hero__media" style={reduce ? undefined : { scale: mediaScale }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/images/hero-estate.jpg"
            aria-hidden="true"
            suppressHydrationWarning
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        </motion.div>

        {/* Film grain */}
        <svg className="ch-hero__noise" aria-hidden="true">
          <filter id="ch-hero-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#ch-hero-noise)" />
        </svg>
        <div className="ch-hero__shade" aria-hidden="true" />

        {/* Floating chips */}
        <motion.div
          className="ch-hero__chip ch-hero__chip--a"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 1.1 }}
        >
          <ShieldCheck size={14} aria-hidden="true" /> CMDA &amp; DTCP approved layouts
        </motion.div>
        <motion.div
          className="ch-hero__chip ch-hero__chip--b"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 1.3 }}
        >
          <MapPin size={14} aria-hidden="true" /> Chennai &amp; Kanchipuram
        </motion.div>

        <motion.div
          className="ch-hero__content"
          style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
        >
          <div className="ch-hero__grid">
            <h1 className="ch-hero__title">
              <WordsPullUpMultiStyle
                delay={0.25}
                segments={[
                  { text: 'Creating assets.' },
                  { br: true },
                  { text: 'Building', className: '' },
                  { text: 'trust.', className: 'ch-accent' },
                ]}
              />
            </h1>
            <motion.div
              className="ch-hero__aside"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.8 }}
            >
              <p>
                Clear-titled residential plots, sandalwood farm land and approved layouts across
                Chennai&apos;s fastest-growing corridors. Securing your future, one plot at a time.
              </p>
              <div className="ch-hero__ctas">
                <PillLink href="/projects">Explore plots</PillLink>
                <button type="button" className="ch-textlink ch-textlink--light" onClick={openSiteVisit}>
                  Book a site visit
                </button>
              </div>
            </motion.div>
          </div>

          <dl className="ch-hero__stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>
                  {s.value}
                  {s.suffix}
                </dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
    </section>
  )
}
