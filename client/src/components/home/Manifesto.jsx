'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ShieldCheck, BadgeCheck, Landmark, FileCheck2 } from 'lucide-react'
import { CharReveal, Eyebrow, Reveal, PillLink } from './motion'

const LOCATIONS = ['Kolapakkam', 'Somamangalam', 'Brammadesam', 'Ozhalai Panchayath', 'Vedanthangal', 'Valasaravakkam']
const BADGES = [
  { icon: ShieldCheck, label: 'Clear patta' },
  { icon: BadgeCheck, label: 'DTCP' },
  { icon: FileCheck2, label: 'CMDA' },
  { icon: Landmark, label: 'Bank approved' },
]

export function LocationsMarquee() {
  const reduce = useReducedMotion()
  const row = [...LOCATIONS, ...LOCATIONS]
  return (
    <div className="ch-marquee" aria-label="Our locations">
      <motion.div
        className="ch-marquee__track"
        animate={reduce ? undefined : { x: ['0%', '-50%'] }}
        transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
      >
        {row.map((loc, i) => (
          <span key={i} className="ch-marquee__item" aria-hidden={i >= LOCATIONS.length}>
            {loc}
            <span className="ch-marquee__sep" aria-hidden="true">✦</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

export default function Manifesto() {
  return (
    <section className="ch-manifesto" aria-labelledby="ch-manifesto-title">
      <div className="ch-wrap">
        <div className="ch-manifesto__head">
          <Eyebrow>About Crystal Estates · Since 2014</Eyebrow>
          <h2 id="ch-manifesto-title" className="ch-sr">About Crystal Estates</h2>
        </div>

        <CharReveal
          className="ch-manifesto__text"
          text="We believe owning land should be a proud, secure and transparent milestone. From Valasaravakkam, we guide every buyer through site selection, thirty-year title verification, patta documentation and long-term farm management — with zero pressure and complete clarity."
        />

        <div className="ch-manifesto__foot">
          <Reveal className="ch-manifesto__image" y={40}>
            <Image
              src="/images/excellence-villa.jpg"
              alt="Approved plotted development with demarcated boundaries and blacktop avenue roads"
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
            />
            <span className="ch-manifesto__tag">Approved plotted development</span>
          </Reveal>

          <div className="ch-manifesto__cols">
            <Reveal delay={0.05}>
              <h3>Expert guidance &amp; legal vetting</h3>
              <p>
                Title vetting back 30+ years, complete encumbrance certificate audits and seamless
                patta registration by our legal desk.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <h3>A curated land portfolio</h3>
              <p>
                From the 15-acre managed sandalwood farm near Vedanthangal to approved residential
                layouts in Kolapakkam, Somamangalam and Brammadesam.
              </p>
            </Reveal>
            <Reveal delay={0.25} className="ch-manifesto__badges">
              {BADGES.map(({ icon: Icon, label }) => (
                <span key={label}>
                  <Icon size={14} aria-hidden="true" /> {label}
                </span>
              ))}
            </Reveal>
            <Reveal delay={0.3}>
              <PillLink href="/about" variant="dark">
                Our story
              </PillLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
