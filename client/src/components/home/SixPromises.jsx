'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, BadgeCheck, FileCheck2, Receipt, Car, Landmark } from 'lucide-react'
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
  },
  {
    num: '2',
    badge: 'Norms Compliant',
    title: 'DTCP & CMDA Approved',
    desc: 'Layouts comply strictly with CMDA and DTCP norms, with visible approval credentials and sanctioned masterplans for every project.',
    icon: BadgeCheck,
    tint: false,
    align: 'right',
  },
  {
    num: '3',
    badge: 'Spot Patta',
    title: 'Registration Support',
    desc: 'Hands-on help with sub-registrar office scheduling, token generation, draft vetting, and spot patta transfer, start to finish.',
    icon: FileCheck2,
    tint: false,
    align: 'left',
  },
  {
    num: '4',
    badge: 'Zero Hidden',
    title: 'Transparent Pricing',
    desc: 'Honest, all-inclusive sq.ft pricing with zero hidden development charges, brokerage surprises, or unrecorded fees.',
    icon: Receipt,
    tint: true,
    align: 'right',
  },
  {
    num: '5',
    badge: 'Complimentary Cab',
    title: 'Site Visit Assistance',
    desc: 'Complimentary weekend cab pick-up from Chennai locations with an accompanied walk of boundary stones and access roads.',
    icon: Car,
    tint: false,
    align: 'left',
  },
  {
    num: '6',
    badge: 'Leading Banks',
    title: 'Bank Loan Guidance',
    desc: 'Direct tie-ups with leading nationalised and private banks for fast plot loan sanction with minimal documentation and paperwork.',
    icon: Landmark,
    tint: true,
    align: 'right',
  },
]

export default function SixPromises() {
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

          {/* Milestone Indicator on Header Right */}
          <div className="sp-header__timeline" aria-hidden="true">
            <div className="sp-header__time-prev">Since 2014</div>
            <div className="sp-header__time-curr">100% Verified</div>
          </div>
        </div>

        {/* Staggered Flowchart Flow */}
        <div className="sp-flow">
          {PROMISES.map((item, index) => {
            const Icon = item.icon
            const isLeft = item.align === 'left'
            const hasNext = index < PROMISES.length - 1

            return (
              <React.Fragment key={item.num}>
                {/* Row with Staggered Card */}
                <div className={`sp-row ${isLeft ? 'sp-row--left' : 'sp-row--right'}`}>
                  <motion.div
                    className={`sp-card ${item.tint ? 'sp-card--tint' : 'sp-card--white'}`}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                  >
                    {/* Vertical dark pill badge */}
                    <div className="sp-card__capsule" title={item.badge}>
                      <span className="sp-card__capsule-text">{item.badge}</span>
                    </div>

                    {/* Card Content */}
                    <div className="sp-card__content">
                      <div className="sp-card__header">
                        <div className="sp-card__icon-box">
                          <Icon size={18} strokeWidth={2.2} />
                        </div>
                        <h3 className="sp-card__title">
                          <span className="sp-card__num">{item.num}</span>
                          <span className="sp-card__name">{item.title}</span>
                        </h3>
                      </div>
                      <p className="sp-card__desc">{item.desc}</p>
                    </div>
                  </motion.div>
                </div>

                {/* Connector Path to Next Step */}
                {hasNext && (
                  <div className="sp-connector-wrap" aria-hidden="true">
                    {isLeft ? (
                      /* Left-to-Right Connector */
                      <svg
                        className="sp-connector sp-connector--ltr"
                        width="200"
                        height="70"
                        viewBox="0 0 200 70"
                        fill="none"
                      >
                        <path
                          d="M 0 12 L 165 12 Q 185 12 185 32 L 185 58"
                          stroke="#94a3b8"
                          strokeWidth="1.75"
                          strokeDasharray="4 4"
                          strokeLinecap="round"
                        />
                        <polygon points="180,56 185,66 190,56" fill="#94a3b8" />
                      </svg>
                    ) : (
                      /* Right-to-Left Connector */
                      <svg
                        className="sp-connector sp-connector--rtl"
                        width="200"
                        height="70"
                        viewBox="0 0 200 70"
                        fill="none"
                      >
                        <path
                          d="M 200 12 L 35 12 Q 15 12 15 32 L 15 58"
                          stroke="#94a3b8"
                          strokeWidth="1.75"
                          strokeDasharray="4 4"
                          strokeLinecap="round"
                        />
                        <polygon points="10,56 15,66 20,56" fill="#94a3b8" />
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
