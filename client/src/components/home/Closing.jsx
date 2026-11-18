'use client'

import { Phone, MapPin, Clock, Car, ShieldCheck, FileCheck2, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import EnquiryForm from '../forms/EnquiryForm'
import { WhatsAppIcon } from '../ui'
import { WordsPullUpMultiStyle, Reveal } from './motion'
import { business } from '../../data/site'

const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(business.mapQuery)}`
const whatsappUrl = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
  'Hi Crystal Estates, I would like to enquire about available residential and farm plots in Chennai.'
)}`

export default function Closing() {
  const reduce = useReducedMotion()

  return (
    <section id="enquire" className="ch-closing" aria-labelledby="ch-closing-title">
      {/* Subtle ambient lighting & pattern */}
      <div className="ch-closing__bg-pattern" aria-hidden="true" />
      {!reduce && (
        <>
          <motion.div
            className="ch-closing__glow ch-closing__glow--left"
            animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.95, 0.7] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
          <motion.div
            className="ch-closing__glow ch-closing__glow--right"
            animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.85, 0.6] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
        </>
      )}

      <div className="ch-wrap">
        <div className="ch-closing__grid">
          {/* Left Column: Narrative, Pillars & Quick Connect */}
          <div className="ch-closing__narrative">
            <div className="ch-closing__status">
              <span className="ch-closing__status-dot" aria-hidden="true" />
              <span className="ch-closing__status-text">Land Advisory Desk · Fast 2-Hour Response</span>
            </div>

            <h2 id="ch-closing-title" className="ch-closing__heading">
              <WordsPullUpMultiStyle
                segments={[
                  { text: 'Your plot is' },
                  { br: true },
                  { text: 'waiting.', className: 'ch-accent' },
                ]}
              />
            </h2>

            <p className="ch-closing__lead">
              Connect directly with our Chennai land specialists. Inspect original 30-year parent documentation,
              walk demarcated boundaries, and secure transparent, all-inclusive pricing with zero surprises.
            </p>

            {/* Value Proposition Cards */}
            <div className="ch-closing__perks">
              <div className="ch-closing__perk">
                <div className="ch-closing__perk-icon" aria-hidden="true">
                  <Car size={20} />
                </div>
                <div className="ch-closing__perk-text">
                  <h4>Complimentary Weekend Cab</h4>
                  <p>Private pick-up & drop from your Chennai doorstep with an accompanied layout boundary tour.</p>
                </div>
              </div>

              <div className="ch-closing__perk">
                <div className="ch-closing__perk-icon" aria-hidden="true">
                  <ShieldCheck size={20} />
                </div>
                <div className="ch-closing__perk-text">
                  <h4>100% CMDA &amp; DTCP Norms</h4>
                  <p>Exhaustive legal scrutiny, 30-year encumbrance search, and original parent documents ready to inspect.</p>
                </div>
              </div>

              <div className="ch-closing__perk">
                <div className="ch-closing__perk-icon" aria-hidden="true">
                  <FileCheck2 size={20} />
                </div>
                <div className="ch-closing__perk-text">
                  <h4>Spot Patta Transfer Support</h4>
                  <p>End-to-end liaison with the Sub-Registrar and assistance for fast, individual patta name-transfer.</p>
                </div>
              </div>
            </div>

            {/* Direct Quick-Contact Bar */}
            <div className="ch-closing__quick-contact">
              <div className="ch-closing__actions">
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="ch-closing__btn-call">
                  <Phone size={15} aria-hidden="true" />
                  <span>Call {business.phone}</span>
                </a>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ch-closing__btn-wa"
                >
                  <WhatsAppIcon size={17} aria-hidden="true" />
                  <span>WhatsApp Advisor</span>
                </a>
              </div>

              <div className="ch-closing__info-row">
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="ch-closing__info-item">
                  <MapPin size={14} aria-hidden="true" />
                  <span>{business.address.line2}, {business.address.city}</span>
                </a>
                <div className="ch-closing__info-item">
                  <Clock size={14} aria-hidden="true" />
                  <span>{business.hours}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Elevated Luxury Consultation Card */}
          <Reveal className="ch-closing__form-wrap" y={28}>
            <div className="ch-closing__card-frame">
              <div className="ch-closing__card-top-accent" aria-hidden="true" />
              <div className="ch-closing__card-badge">
                <Sparkles size={13} aria-hidden="true" />
                <span>DIRECT CONSULTATION DESK</span>
              </div>
              <EnquiryForm
                className="ch-closing__enquiry-form"
                title="Schedule a Site Visit"
                subtitle="Share your preferred layout or location. A senior land advisor will assist you."
              />
              <div className="ch-closing__card-footer">
                <span className="ch-closing__lock-icon" aria-hidden="true">🔒</span>
                <span>Zero brokerage · 100% confidential · Direct developer pricing</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
