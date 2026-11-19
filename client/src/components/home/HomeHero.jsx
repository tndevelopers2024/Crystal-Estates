'use client'

import React, { useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { openSiteVisit } from './motion'

const HERO_VIDEO =
  'https://res.cloudinary.com/rlokioxu/video/upload/v1793966711/13282387_3840_2160_60fps_online-video-cutter.com_qarfsk.mp4'

export default function HomeHero() {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 1.08])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])

  return (
    <section id="home" ref={ref} className="ch-hero" aria-label="Crystal Estates Home Hero">
      <div className="ch-hero__frame">
        {/* Full-width, full-screen background video & poster image */}
        <motion.div
          className="ch-hero__media"
          style={reduce ? undefined : { scale: mediaScale }}
        >
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

        {/* Subtle black overlay with 10% opacity as requested */}
        <div className="ch-hero__overlay-10" aria-hidden="true" />

        {/* Soft bottom vignette gradient for optimal text readability */}
        <div className="ch-hero__shade" aria-hidden="true" />

        {/* Minimal Bottom-Left Hero Content (Matches Reference Image) */}
        <motion.div
          className="ch-hero__content"
          style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
        >
          <div className="ch-hero__left-content">
            <h1 className="ch-hero__headline">
              Building the future<br />that you can own.
            </h1>
            <p className="ch-hero__lead">
              We create CMDA &amp; DTCP approved plotted communities and clear-title lands across Chennai.
            </p>
            <div className="ch-hero__actions">
              <button
                type="button"
                onClick={openSiteVisit}
                className="ch-hero__cta-primary"
                aria-label="Get In Touch"
              >
                Get In Touch
              </button>
              <Link href="/projects" className="ch-hero__cta-secondary" aria-label="Explore Plots">
                <span>Explore plots</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
