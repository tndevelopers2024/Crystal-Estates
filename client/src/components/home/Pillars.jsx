'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useInView, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { ShieldCheck, BadgeCheck, FileCheck2, Receipt, Car, Landmark } from 'lucide-react'
import { WordsPullUpMultiStyle, Eyebrow } from './motion'

const PILLARS = [
  { icon: ShieldCheck, title: '100% clear titles', badge: '30-year legal search', text: 'Every property goes through an exhaustive 30-year legal search and title scrutiny before it reaches you.' },
  { icon: BadgeCheck, title: 'DTCP & CMDA approved', badge: 'Norms compliant', text: 'Layouts comply strictly with CMDA and DTCP norms, with approval credentials shown for every project.' },
  { icon: FileCheck2, title: 'Registration support', badge: 'Spot patta transfer', text: 'Hands-on help with sub-registrar scheduling, draft vetting and patta transfer, start to finish.' },
  { icon: Receipt, title: 'Transparent pricing', badge: 'Zero hidden charges', text: 'Honest, all-inclusive pricing with no hidden development charges or brokerage surprises.' },
  { icon: Car, title: 'Site visit assistance', badge: 'Complimentary cab', text: 'Weekend pick-up from Chennai with an accompanied walk of the boundary stones and access roads.' },
  { icon: Landmark, title: 'Bank loan guidance', badge: 'Leading banks', text: 'Tie-ups with nationalised and private banks for fast plot loans with minimal paperwork.' },
]

function Pillar({ item, index }) {
  const ref = useRef(null)
  const lit = useInView(ref, { margin: '-42% 0px -42% 0px' })
  const Icon = item.icon
  return (
    <li ref={ref} className={`ch-pillars__item ${lit ? 'is-lit' : ''}`}>
      <span className="ch-pillars__num">{String(index + 1).padStart(2, '0')}</span>
      <div className="ch-pillars__body">
        <div className="ch-pillars__row">
          <h3>{item.title}</h3>
          <span className="ch-pillars__badge">
            <Icon size={13} aria-hidden="true" /> {item.badge}
          </span>
        </div>
        <p>{item.text}</p>
      </div>
    </li>
  )
}

export default function Pillars() {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])

  return (
    <section ref={ref} className="ch-pillars" aria-labelledby="ch-pillars-title">
      <div className="ch-wrap ch-pillars__grid">
        <div className="ch-pillars__aside">
          <div className="ch-pillars__sticky">
            <Eyebrow>Why Crystal Estates</Eyebrow>
            <h2 id="ch-pillars-title" className="ch-h2">
              <WordsPullUpMultiStyle segments={[{ text: 'Six promises,' }, { br: true }, { text: 'kept on', className: '' }, { text: 'every plot.', className: 'ch-accent' }]} />
            </h2>
            <div className="ch-pillars__image">
              <motion.div className="ch-pillars__image-inner" style={reduce ? undefined : { y: imgY }}>
                <Image src="/images/kolapakkam.jpg" alt="Approved residential layout at Kolapakkam" fill sizes="(max-width: 900px) 100vw, 40vw" />
              </motion.div>
            </div>
          </div>
        </div>

        <ol className="ch-pillars__list">
          {PILLARS.map((p, i) => (
            <Pillar key={p.title} item={p} index={i} />
          ))}
        </ol>
      </div>
    </section>
  )
}
