'use client'

import React from 'react'
import Link from 'next/link'
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowRight,
  MessageCircle,
  Navigation,
  ShieldCheck,
  Car,
  CheckCircle2,
} from 'lucide-react'
import {
  WordsPullUpMultiStyle,
  Eyebrow,
  Reveal,
  PillLink,
} from '../../components/home/motion'
import { LocationsMarquee } from '../../components/home/Manifesto'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import EnquiryForm from '../../components/forms/EnquiryForm'
import { business } from '../../data/site'
import '../../components/home/home.css'
import './contact.css'

const VISIT_PROMISES = [
  {
    num: '01',
    title: 'Complimentary Doorstep Cab',
    text: 'Dedicated AC car pickup and drop-off for your family across Chennai for weekend site visits to any layout.',
  },
  {
    num: '02',
    title: 'Original Deed Inspection',
    text: 'Inspect original 30-year parent deeds, revenue chitta, and encumbrance certificates in person at our office.',
  },
  {
    num: '03',
    title: 'Physical Site Demarcation',
    text: 'Walk actual 30-ft and 40-ft avenue blacktop roads, inspect surveyed corner stones, and verify motorable access.',
  },
  {
    num: '04',
    title: 'Direct Developer Transparency',
    text: 'Honest all-inclusive pricing with zero middleman commissions, hidden development fees, or brokerage charges.',
  },
]

export default function ContactClient() {
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    business.mapQuery
  )}&t=&z=15&ie=UTF8&iwloc=&output=embed`

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    business.mapQuery
  )}`

  return (
    <div className="ch-home ch-contact-page">
      {/* ── 1. Hero Section ───────────────────────────────────── */}
      <section className="ch-contact-hero" aria-labelledby="ch-contact-hero-title">
        <div className="ch-wrap">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="ch-contact-breadcrumb">
            <Link href="/">Home</Link>
            <span className="ch-contact-breadcrumb__sep">/</span>
            <span className="ch-contact-breadcrumb__current">Contact Us</span>
          </nav>

          <div className="ch-contact-hero__head">
            <Eyebrow>Valasaravakkam Headquarters · Assets Creator</Eyebrow>
            <h1 id="ch-contact-hero-title" className="ch-contact-hero__title">
              <WordsPullUpMultiStyle
                segments={[
                  { text: 'Speak directly with' },
                  { br: true },
                  { text: 'our land advisors.', className: 'ch-accent' },
                ]}
              />
            </h1>
            <p className="ch-contact-hero__lead">
              Schedule an accompanied weekend site visit with complimentary family pickup, or visit our
              Valasaravakkam corporate office to review original revenue records, parent title deeds, and
              sanctioned layout masterplans in person.
            </p>

            <div className="ch-contact-hero__ctas">
              <PillLink href="#enquiry-section" variant="cream">
                Send an Online Enquiry
              </PillLink>
              <PillLink
                href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
                  'Hi Crystal Estates, I would like to consult on plots and farmland in Chennai.'
                )}`}
                variant="dark"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={15} aria-hidden="true" />
                Chat on WhatsApp
              </PillLink>
            </div>

            {/* Live Trust Metrics Row */}
            <div className="ch-contact-stats-row">
              <div className="ch-contact-stat-pill">
                <Clock size={16} style={{ color: '#b8964e' }} aria-hidden="true" />
                <strong>2 Hours</strong>
                <span>Typical Response Time</span>
              </div>
              <div className="ch-contact-stat-pill">
                <Car size={16} style={{ color: '#0f3d2e' }} aria-hidden="true" />
                <strong>Doorstep Cab</strong>
                <span>Weekend Family Pickup</span>
              </div>
              <div className="ch-contact-stat-pill">
                <ShieldCheck size={16} style={{ color: '#25d366' }} aria-hidden="true" />
                <strong>100%</strong>
                <span>In-Person Document Scrutiny</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Growth Corridors Marquee ───────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Primary Contact & Office Hub Grid ──────────────── */}
      <section id="enquiry-section" className="ch-contact-main" aria-label="Contact Details & Enquiry">
        <div className="ch-wrap">
          <div className="ch-contact-grid">
            {/* Left Column: Office & Contact Cards */}
            <div className="ch-contact-info-col">
              <div className="ch-contact-info-col__head">
                <Eyebrow>Office &amp; Headquarters</Eyebrow>
                <h2>Visit Our Valasaravakkam Office</h2>
                <p>
                  We welcome prospective landowners and investors to sit with our legal and property advisors.
                  Inspect original parent title deeds, DTCP/CMDA approvals, and cadastral survey sketches.
                </p>
              </div>

              <div className="ch-contact-cards">
                {/* 1. Address Card */}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ch-contact-card"
                  aria-label="Get directions to our Valasaravakkam Office"
                >
                  <div className="ch-contact-card__icon-wrap" aria-hidden="true">
                    <MapPin size={22} />
                  </div>
                  <div className="ch-contact-card__body">
                    <div className="ch-contact-card__badge-row">
                      <span className="ch-contact-card__badge">Registered Office</span>
                      <span className="ch-contact-card__sub-badge">Behind Singer Mano House</span>
                    </div>
                    <h3 className="ch-contact-card__title">Crystal Tower, Ground Floor A</h3>
                    <p className="ch-contact-card__text">
                      {business.address.line1}, {business.address.line2}, {business.address.city}
                    </p>
                    <span className="ch-contact-card__link">
                      <span>Get Directions on Google Maps</span>
                      <Navigation size={13} aria-hidden="true" />
                    </span>
                  </div>
                </a>

                {/* 2. Direct Phone Support */}
                <a
                  href={`tel:${business.phone.replace(/\s/g, '')}`}
                  className="ch-contact-card"
                  aria-label={`Call us directly at ${business.phone}`}
                >
                  <div className="ch-contact-card__icon-wrap" aria-hidden="true">
                    <Phone size={22} />
                  </div>
                  <div className="ch-contact-card__body">
                    <div className="ch-contact-card__badge-row">
                      <span className="ch-contact-card__badge">Direct Phone Line</span>
                      <span className="ch-contact-card__sub-badge">Mon – Sat, 9:30 AM – 7 PM</span>
                    </div>
                    <h3 className="ch-contact-card__title">{business.phone}</h3>
                    <p className="ch-contact-card__text">
                      Immediate voice assistance for plot availability, spot patta transfer, and site visit scheduling.
                    </p>
                    <span className="ch-contact-card__link">
                      <span>Tap to Call Advisor</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </div>
                </a>

                {/* 3. WhatsApp Concierge */}
                <a
                  href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
                    'Hi Crystal Estates, I would like to inspect plots and schedule a visit.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ch-contact-card"
                  aria-label="Chat on WhatsApp"
                >
                  <div className="ch-contact-card__icon-wrap" aria-hidden="true">
                    <MessageCircle size={22} />
                  </div>
                  <div className="ch-contact-card__body">
                    <div className="ch-contact-card__badge-row">
                      <span className="ch-contact-card__badge">WhatsApp Concierge</span>
                      <span className="ch-contact-card__sub-badge">Fastest Response</span>
                    </div>
                    <h3 className="ch-contact-card__title">Instant WhatsApp Helpdesk</h3>
                    <p className="ch-contact-card__text">
                      Receive instant layout masterplans, pricing sheets, and Google location pins directly in chat.
                    </p>
                    <span className="ch-contact-card__link">
                      <span>Open WhatsApp Chat</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </div>
                </a>

                {/* 4. Email Support */}
                <a
                  href={`mailto:${business.email}`}
                  className="ch-contact-card"
                  aria-label={`Email us at ${business.email}`}
                >
                  <div className="ch-contact-card__icon-wrap" aria-hidden="true">
                    <Mail size={22} />
                  </div>
                  <div className="ch-contact-card__body">
                    <div className="ch-contact-card__badge-row">
                      <span className="ch-contact-card__badge">Official Correspondence</span>
                      <span className="ch-contact-card__sub-badge">Corporate Inquiries</span>
                    </div>
                    <h3 className="ch-contact-card__title">{business.email}</h3>
                    <p className="ch-contact-card__text">
                      Send institutional requirements, resale documentation, or legal verification queries.
                    </p>
                    <span className="ch-contact-card__link">
                      <span>Write an Email</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </div>
                </a>
              </div>
            </div>

            {/* Right Column: Grounded Modern Form Box */}
            <div className="ch-contact-form-col">
              <div className="ch-contact-form-box">
                <div className="ch-contact-form-box__header">
                  <span className="ch-contact-form-box__badge">
                    <CheckCircle2 size={13} aria-hidden="true" />
                    ONLINE CONSULTATION SUITE
                  </span>
                  <h3 className="ch-contact-form-box__title">Book a Visit or Send an Enquiry</h3>
                  <p className="ch-contact-form-box__desc">
                    Share your preferred plot budget, location, and requirement. Our senior land manager will
                    get back to you within 2 hours.
                  </p>
                </div>

                <EnquiryForm
                  title="Schedule Your Consultation"
                  subtitle="Complimentary weekend family cab pick-up available on request."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Full-Width Architectural Map Section ───────────── */}
      <section className="ch-contact-map-sec" aria-labelledby="ch-contact-map-title">
        <div className="ch-wrap">
          <div className="ch-contact-map-head">
            <Eyebrow>Location &amp; Directions</Eyebrow>
            <h2 id="ch-contact-map-title">Find Our Headquarters on the Map</h2>
            <p>
              Situated in Crystal Tower on A.K.R. Nagar Main Road in Valasaravakkam, Chennai. Convenient
              highway access via Arcot Road and Outer Ring Road with dedicated visitor parking.
            </p>
          </div>

          <div className="ch-contact-map-frame-box">
            <div className="ch-contact-map-floating-badge">
              <span className="ch-contact-map-floating-badge__dot" aria-hidden="true" />
              <span>Office Open · Mon – Sat (9:30 AM – 7:00 PM)</span>
            </div>
            <iframe
              title="Crystal Estates Chennai Headquarters"
              width="100%"
              height="100%"
              loading="lazy"
              allowFullScreen
              src={mapEmbedUrl}
            />
          </div>
        </div>
      </section>

      {/* ── 5. The 4 Visit Guarantees ─────────────────────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-visit-guarantees-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <Eyebrow>The Guided Visit Standard</Eyebrow>
            <h2 id="ch-visit-guarantees-title" className="ch-h2">
              Four commitments on <span className="ch-accent">every visit.</span>
            </h2>
          </div>

          <div className="ch-about-shield__steps">
            {VISIT_PROMISES.map((p, idx) => (
              <Reveal key={p.num} delay={idx * 0.1} className="ch-about-shield-step">
                <div className="ch-about-shield-step__num">{p.num}</div>
                <h4>{p.title}</h4>
                <p>{p.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Landowner Voices Carousel ──────────────────────── */}
      <Voices />

      {/* ── 7. Closing Consultation Pavilion ──────────────────── */}
      <Closing />
    </div>
  )
}
