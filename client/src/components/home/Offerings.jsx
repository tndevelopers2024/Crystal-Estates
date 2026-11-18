'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, ArrowRight, Home, Trees, ScrollText, Handshake } from 'lucide-react'
import { WordsPullUpMultiStyle, Eyebrow, EASE } from './motion'

const OFFERINGS = [
  {
    icon: Home,
    title: 'Residential Plots',
    text: 'Approved plotted layouts in fast-appreciating Chennai corridors, ready for immediate registration.',
    points: ['CMDA & DTCP approved', 'Blacktop avenue roads', 'Clear demarcation'],
    href: '/projects',
  },
  {
    icon: Trees,
    title: 'Farm & Sandalwood Land',
    text: 'Managed agro-forestry land with drip irrigation, round-the-clock care and individual patta.',
    points: ['15-acre Vedanthangal estate', 'Professional farm management', 'Solar fencing & CCTV'],
    href: '/projects',
  },
  {
    icon: ScrollText,
    title: 'Registered Land & Titles',
    text: 'Legally vetted land with verified parent documents, encumbrance certificates and revenue records.',
    points: ['30-year title search', 'EC & patta verification', 'Spot registration guidance'],
    href: '/services',
  },
  {
    icon: Handshake,
    title: 'Purchase & Resale',
    text: 'Strategic acquisition, precise valuation and reliable resale support for landowners and investors.',
    points: ['Transparent brokerage', 'Zero hidden fees', 'Bulk land & acreage'],
    href: '/sell-your-land',
  },
]

export default function Offerings() {
  const reduce = useReducedMotion()
  return (
    <section className="ch-offer" aria-labelledby="ch-offer-title">
      <div className="ch-wrap">
        <div className="ch-offer__head">
          <Eyebrow>What we offer</Eyebrow>
          <h2 id="ch-offer-title" className="ch-h2">
            <WordsPullUpMultiStyle
              segments={[{ text: 'Every kind of land,' }, { br: true }, { text: 'one trusted', className: '' }, { text: 'partner.', className: 'ch-serif' }]}
            />
          </h2>
        </div>

        <div className="ch-offer__grid">
          {OFFERINGS.map((o, i) => {
            const Icon = o.icon
            return (
              <motion.article
                key={o.title}
                className="ch-offer__card"
                initial={reduce ? false : { opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.8, ease: EASE, delay: i * 0.15 }}
              >
                <div className="ch-offer__top">
                  <span className="ch-offer__icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.6} />
                  </span>
                  <span className="ch-offer__num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3>{o.title}</h3>
                <p>{o.text}</p>
                <ul>
                  {o.points.map((pt) => (
                    <li key={pt}>
                      <Check size={14} aria-hidden="true" /> {pt}
                    </li>
                  ))}
                </ul>
                <Link href={o.href} className="ch-offer__more">
                  Learn more
                  <ArrowRight size={15} style={{ transform: 'rotate(-45deg)' }} aria-hidden="true" />
                </Link>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
