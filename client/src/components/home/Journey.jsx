'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import {
  PhoneCall,
  Car,
  LayoutGrid,
  ShieldCheck,
  Receipt,
  KeyRound,
} from 'lucide-react'
import './Journey.css'

const JOURNEY_STAGES = [
  {
    num: '01',
    title: 'Initial Enquiry & Guidance',
    desc: 'Share your preferred corridor, budget, and plot size for tailored layout recommendations with zero sales pressure.',
    icon: PhoneCall,
    image: '/images/hero-estate.jpg',
  },
  {
    num: '02',
    title: 'Guided Site Visit',
    desc: 'Weekend site tour with complimentary doorstep cab pick-up from Chennai to inspect boundary stones and access roads.',
    icon: Car,
    image: '/images/kolapakkam.jpg',
  },
  {
    num: '03',
    title: 'Plot Selection & Reservation',
    desc: 'Select your specific plot number on the sanctioned CMDA/DTCP masterplan and lock your allotment with an initial token.',
    icon: LayoutGrid,
    image: '/images/somamangalam.jpg',
  },
  {
    num: '04',
    title: '30-Year Legal Documentation',
    desc: 'Review 30-year high court legal search reports, parent deeds, sanction orders, and encumbrance certificates with full transparency.',
    icon: ShieldCheck,
    image: '/images/brammadesam.jpg',
  },
  {
    num: '05',
    title: 'Payment & Bank Loan Tie-ups',
    desc: 'Transparent all-inclusive pricing with zero hidden development fees, backed by plot loan sanction tie-ups with leading banks.',
    icon: Receipt,
    image: '/images/vedanthangal.jpg',
  },
  {
    num: '06',
    title: 'Registration & Final Handover',
    desc: 'Sale deed execution at the SRO, physical demarcation of boundary stones, spot patta transfer filing, and immediate possession.',
    icon: KeyRound,
    image: '/images/empty-plot.jpg',
  },
]

export default function Journey() {
  const [activeStage, setActiveStage] = useState(0)
  const sectionRef = useRef(null)
  const isHoveredRef = useRef(false)
  const totalStages = JOURNEY_STAGES.length

  // Track natural scroll progress through the section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.8', 'end 0.2'],
  })

  // Smooth orbital continuous rotation linked to page scroll
  const orbitRotate = useTransform(scrollYProgress, [0, 1], [0, 240])

  // Automatically advance active milestone as user scrolls down the page
  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (isHoveredRef.current) return
    const clamped = Math.max(0, Math.min(0.999, latest))
    const stageIdx = Math.min(totalStages - 1, Math.floor(clamped * totalStages))
    setActiveStage((prev) => (prev !== stageIdx ? stageIdx : prev))
  })

  const current = JOURNEY_STAGES[activeStage]

  return (
    <section ref={sectionRef} className="cj-section" aria-labelledby="cj-title">
      <div className="ch-wrap">
        <div className="cj-container">
          {/* ── Left Column: Section Intro with on-scroll entrance ── */}
          <motion.div
            className="cj-intro"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 id="cj-title" className="cj-title">
              From First Call<br />to Handover
            </h2>

            <p className="cj-subtitle">The Crystal Standard Process</p>

            <p className="cj-desc">
              Every land investment is backed by exhaustive legal scrutiny, accompanied surveys,
              and transparent milestones. Explore each step from your initial enquiry to physical
              plot possession.
            </p>
          </motion.div>

          {/* ── Center Column: Orbital Visual Hub with on-scroll rotation ── */}
          <motion.div
            className="cj-hub-col"
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <div className="cj-hub">
              {/* Concentric Orbital SVG Graphic that smoothly rotates on scroll */}
              <motion.svg
                className="cj-hub-orbits"
                viewBox="0 0 440 440"
                fill="none"
                aria-hidden="true"
                style={{ rotate: orbitRotate }}
              >
                {/* Outer orbit circle with dashed stroke */}
                <circle
                  cx="220"
                  cy="220"
                  r="195"
                  stroke="rgba(15, 61, 46, 0.16)"
                  strokeWidth="1.25"
                  strokeDasharray="4 6"
                />

                {/* Middle solid orbit arc */}
                <circle
                  cx="220"
                  cy="220"
                  r="170"
                  stroke="rgba(15, 61, 46, 0.22)"
                  strokeWidth="1.2"
                />

                {/* Inner subtle guide */}
                <circle
                  cx="220"
                  cy="220"
                  r="145"
                  stroke="rgba(15, 61, 46, 0.1)"
                  strokeWidth="1"
                />

                {/* Orbital planet nodes matching reference image */}
                <circle cx="220" cy="25" r="5" fill="#0F3D2E" />
                <circle cx="390" cy="220" r="4" fill="#10b981" />
                <circle cx="70" cy="140" r="5.5" fill="#b8964e" />
                <rect x="48" y="306" width="9" height="9" rx="2" fill="#0F3D2E" />
                <circle cx="360" cy="340" r="4.5" fill="#0F3D2E" />
                <circle cx="220" cy="415" r="3.5" fill="#94a3b8" />
              </motion.svg>

              {/* Central Circular Stage Window — Pure Image, No Overlays */}
              <div className="cj-hub-core">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.image}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    style={{ position: 'relative', width: '100%', height: '100%' }}
                  >
                    <Image
                      src={current.image}
                      alt={current.title}
                      fill
                      sizes="300px"
                      className="cj-hub-img"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* ── Right Column: All 6 Stages with on-scroll entrance & hover ── */}
          <div
            className="cj-stages-col"
            role="tablist"
            aria-label="Journey Milestones"
            onMouseEnter={() => {
              isHoveredRef.current = true
            }}
            onMouseLeave={() => {
              isHoveredRef.current = false
            }}
          >
            {JOURNEY_STAGES.map((s, idx) => {
              const Icon = s.icon
              const isActive = activeStage === idx

              return (
                <motion.div
                  key={s.num}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  className={`cj-stage-card ${isActive ? 'is-active' : ''}`}
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: idx * 0.06 }}
                  onClick={() => setActiveStage(idx)}
                  onMouseEnter={() => setActiveStage(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setActiveStage(idx)
                    }
                  }}
                >
                  <div className="cj-stage-icon-wrap">
                    <Icon size={19} strokeWidth={2.2} />
                  </div>

                  <div className="cj-stage-body">
                    <h3 className="cj-stage-title">{s.title}</h3>
                    <p className="cj-stage-desc">{s.desc}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
