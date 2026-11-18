'use client'

import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import EnquiryForm from '../forms/EnquiryForm'
import { WordsPullUpMultiStyle, Eyebrow, Reveal } from './motion'
import { business } from '../../data/site'

const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(business.mapQuery)}`

export default function Closing() {
  const reduce = useReducedMotion()
  return (
    <section id="enquire" className="ch-closing" aria-labelledby="ch-closing-title">
      <div className="ch-closing__frame">
        {/* Soft floating orbs */}
        {!reduce && (
          <>
            <motion.span
              className="ch-closing__orb ch-closing__orb--a"
              animate={{ y: [0, -24, 0], x: [0, 12, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
            <motion.span
              className="ch-closing__orb ch-closing__orb--b"
              animate={{ y: [0, 20, 0], x: [0, -16, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
          </>
        )}

        <div className="ch-closing__grid">
          <div className="ch-closing__copy">
            <Eyebrow className="ch-eyebrow--light">Enquire</Eyebrow>
            <h2 id="ch-closing-title" className="ch-closing__title">
              <WordsPullUpMultiStyle segments={[{ text: 'Your plot is' }, { br: true }, { text: 'waiting.', className: 'ch-accent' }]} />
            </h2>
            <p>
              Talk to our land advisors about clear-title documentation, weekend site visits and
              transparent pricing. We reply within two hours.
            </p>

            <ul className="ch-closing__contact">
              <li>
                <Phone size={16} aria-hidden="true" />
                <a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a>
              </li>
              <li>
                <Mail size={16} aria-hidden="true" />
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </li>
              <li>
                <MapPin size={16} aria-hidden="true" />
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  {business.address.line2}, {business.address.city}
                </a>
              </li>
              <li>
                <Clock size={16} aria-hidden="true" />
                <span>{business.hours}</span>
              </li>
            </ul>
          </div>

          <Reveal className="ch-closing__form" y={40}>
            <EnquiryForm title="Request a consultation" subtitle="Share a few details and a land advisor will call you back." />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
