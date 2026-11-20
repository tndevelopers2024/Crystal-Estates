'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  BadgeCheck,
  FileCheck2,
  Receipt,
  Car,
  Landmark,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react'
import './SixPromises.css'

const PROMISES = [
  {
    num: '1',
    badge: '30-Yr Search',
    title: '100% Clear Titles',
    desc: 'Every property goes through an exhaustive 30-year legal search and high-court title scrutiny before it reaches you.',
    icon: ShieldCheck,
    tint: true,
    align: 'left',
    proofs: [
      '30-Year High Court legal search report verified by senior counsel',
      'Current Encumbrance Certificate (EC) with zero unrecorded claims',
    ],
  },
  {
    num: '2',
    badge: 'Norms Compliant',
    title: 'DTCP & CMDA Approved',
    desc: 'Layouts comply strictly with CMDA and DTCP norms, with visible approval credentials and sanctioned masterplans for every project.',
    icon: BadgeCheck,
    tint: false,
    align: 'right',
    proofs: [
      'Sanctioned layout masterplan credentials displayed for verification',
      'Strict compliance with public open space (OSR) and road width norms',
    ],
  },
  {
    num: '3',
    badge: 'Spot Patta',
    title: 'Registration Support',
    desc: 'Hands-on help with sub-registrar office scheduling, token generation, draft vetting, and spot patta transfer, start to finish.',
    icon: FileCheck2,
    tint: false,
    align: 'left',
    proofs: [
      'Dedicated SRO liaison officer for token generation & draft vetting',
      'Direct online submission for computerized Patta name transfer',
    ],
  },
  {
    num: '4',
    badge: 'Zero Hidden',
    title: 'Transparent Pricing',
    desc: 'Honest, all-inclusive sq.ft pricing with zero hidden development charges, brokerage surprises, or unrecorded fees.',
    icon: Receipt,
    tint: true,
    align: 'right',
    proofs: [
      'All-inclusive per sq.ft rate schedule provided upfront in writing',
      'Zero brokerage fees, unrecorded development charges, or surprises',
    ],
  },
  {
    num: '5',
    badge: 'Complimentary Cab',
    title: 'Site Visit Assistance',
    desc: 'Complimentary weekend cab pick-up from Chennai locations with an accompanied walk of boundary stones and access roads.',
    icon: Car,
    tint: false,
    align: 'left',
    proofs: [
      'Complimentary door-step cab pick-up from Chennai on weekends',
      'Accompanied on-site walk of physical boundary stones and roads',
    ],
  },
  {
    num: '6',
    badge: 'Leading Banks',
    title: 'Bank Loan Guidance',
    desc: 'Direct tie-ups with leading nationalised and private banks for fast plot loan sanction with minimal documentation and paperwork.',
    icon: Landmark,
    tint: true,
    align: 'right',
    proofs: [
      'Pre-approved layout status with leading nationalized & private banks',
      'Minimal documentation with fast-track loan sanction assistance',
    ],
  },
]

export default function SixPromises() {
  const [activeCard, setActiveCard] = useState(0)
  const [expandedCards, setExpandedCards] = useState({ 0: true })

  const toggleExpand = useCallback((idx, e) => {
    e.stopPropagation()
    setExpandedCards((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
    setActiveCard(idx)
  }, [])

  const handleCardClick = useCallback((idx) => {
    setActiveCard(idx)
    setExpandedCards((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
  }, [])

  return (
    <section className="sp-section" aria-labelledby="sp-title">
      <div className="ch-wrap">
        {/* Section Header */}
        <div className="sp-header">
          <div className="sp-header__left">
            <span className="sp-header__pill">
              <span className="sp-header__pill-dot" />
              The Crystal Standard
            </span>
            <h2 id="sp-title" className="sp-header__title">
              Six Promises, Kept on Every Plot
            </h2>
            <p className="sp-header__desc">
              Beyond just land acquisition, we safeguard every investment with rigorous verification—from
              30-year high court legal scrutiny to on-site boundary surveys and spot patta transfers.
            </p>
          </div>

          {/* Interactive Milestone Indicator on Header Right */}
          <div className="sp-header__timeline" aria-label="Promise Step Navigator">
            <div className="sp-header__time-prev">Since 2014</div>
            <div className="sp-header__time-curr">
              <span className="sp-curr-dot" />
              Promise {activeCard + 1} of 6 Active
            </div>
          </div>
        </div>

        {/* Staggered Flowchart Flow */}
        <div className="sp-flow">
          {PROMISES.map((item, index) => {
            const Icon = item.icon
            const isLeft = item.align === 'left'
            const hasNext = index < PROMISES.length - 1
            const isActive = activeCard === index
            const isExpanded = !!expandedCards[index]
            const isConnectorActive = activeCard === index

            return (
              <React.Fragment key={item.num}>
                {/* Row with Staggered Card */}
                <div className={`sp-row ${isLeft ? 'sp-row--left' : 'sp-row--right'}`}>
                  <motion.div
                    className={`sp-card ${item.tint ? 'sp-card--tint' : 'sp-card--white'} ${
                      isActive ? 'is-active' : ''
                    }`}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.4 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                    onViewportEnter={() => setActiveCard(index)}
                    onClick={() => handleCardClick(index)}
                    onMouseEnter={() => setActiveCard(index)}
                  >
                    {/* Vertical dark pill badge */}
                    <div className="sp-card__capsule" title={item.badge}>
                      <span className="sp-card__capsule-text">{item.badge}</span>
                    </div>

                    {/* Card Content */}
                    <div className="sp-card__content">
                      <div className="sp-card__header">
                        <div className="sp-card__header-left">
                          <div className="sp-card__icon-box">
                            <Icon size={18} strokeWidth={2.2} />
                          </div>
                          <h3 className="sp-card__title">
                            <span className="sp-card__num">{item.num}</span>
                            <span className="sp-card__name">{item.title}</span>
                          </h3>
                        </div>

                        {/* Interactive Verification Proof Toggle */}
                        <div
                          className="sp-card__action"
                          onClick={(e) => toggleExpand(index, e)}
                          title="View verified proof details"
                          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          <span style={{ whiteSpace: 'nowrap' }}>{isExpanded ? 'Less' : 'Proof'}</span>
                          <ChevronDown
                            size={14}
                            className={`sp-card__chevron ${isExpanded ? 'is-rotated' : ''}`}
                            style={{ flexShrink: 0 }}
                          />
                        </div>
                      </div>

                      <p className="sp-card__desc">{item.desc}</p>

                      {/* Expandable Verification Proof Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="sp-card__proofs"
                          >
                            <div className="sp-card__proof-list">
                              {item.proofs.map((proof, pIdx) => (
                                <div key={pIdx} className="sp-card__proof-item">
                                  <CheckCircle2 size={14} className="sp-proof-check" />
                                  <span>{proof}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </div>

                {/* Interactive Connector Path to Next Step */}
                {hasNext && (
                  <div className="sp-connector-wrap" aria-hidden="true">
                    {isLeft ? (
                      /* Left-to-Right Connector */
                      <svg
                        className={`sp-connector sp-connector--ltr ${
                          isConnectorActive ? 'is-active' : ''
                        }`}
                        width="200"
                        height="70"
                        viewBox="0 0 200 70"
                        fill="none"
                      >
                        <path
                          d="M 0 12 L 165 12 Q 185 12 185 32 L 185 58"
                          stroke="#10b981"
                          strokeWidth={isConnectorActive ? '2.4' : '2'}
                          strokeDasharray="6 4"
                          strokeLinecap="round"
                        />
                        <polygon
                          points="179,54 185,66 191,54"
                          fill="#10b981"
                        />
                      </svg>
                    ) : (
                      /* Right-to-Left Connector */
                      <svg
                        className={`sp-connector sp-connector--rtl ${
                          isConnectorActive ? 'is-active' : ''
                        }`}
                        width="200"
                        height="70"
                        viewBox="0 0 200 70"
                        fill="none"
                      >
                        <path
                          d="M 200 12 L 35 12 Q 15 12 15 32 L 15 58"
                          stroke="#10b981"
                          strokeWidth={isConnectorActive ? '2.4' : '2'}
                          strokeDasharray="6 4"
                          strokeLinecap="round"
                        />
                        <polygon
                          points="9,54 15,66 21,54"
                          fill="#10b981"
                        />
                      </svg>
                    )}
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}
