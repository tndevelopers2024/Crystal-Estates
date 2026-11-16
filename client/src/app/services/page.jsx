import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Compass,
} from 'lucide-react'
import EnquiryForm from '../../components/forms/EnquiryForm'
import TestimonialsSection from '../../components/TestimonialsSection'

export const metadata = {
  title: 'Land Services in Chennai | Direct Sales, Resale & Brokerage | Crystal Estates',
  description:
    'Explore Crystal Estates land solutions: Direct sales of CMDA/DTCP approved plots and managed sandalwood farmland, land purchase & resale, and transparent land brokerage.',
  openGraph: {
    title: 'Land Services in Chennai | Crystal Estates',
    description:
      'Direct sales of approved plots and managed sandalwood farmland, land purchase & resale, and land brokerage.',
    url: 'https://crystalestates.in/services',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Crystal Estates Services',
      },
    ],
  },
}

const serviceBlocks = [
  {
    id: 'direct-sales',
    badge: 'Core Competency',
    serviceNum: 'SERVICE 01',
    title: 'Direct Land Sales',
    subtitle: 'DTCP / CMDA Approved Plotted Layouts & Managed Sandalwood Farmland',
    description:
      'Purchase clear-title residential plots and high-value agro-forestry farm land directly from Crystal Estates with verified parent documents, individual patta, and physical demarcation stones.',
    howItWorks: [
      { step: '01', title: 'Plot Selection', desc: 'Browse available plotted layouts, extent measurements, and facing orientations.' },
      { step: '02', title: 'Guided Site Visit', desc: 'Complimentary weekend family pick-up to physically walk the land, inspect road access, and boundary stones.' },
      { step: '03', title: 'Legal Title Review', desc: 'Review 30-year parent deeds, nil-encumbrance certificate, and layout sanction copies with our legal team.' },
      { step: '04', title: 'Registration & Patta', desc: 'Execute spot sale deed registration at the SRO, followed by computerized online Patta name transfer.' },
    ],
    benefits: [
      'Zero brokerage fee on direct company developments',
      'Transparent pricing based on actual square-foot guide value',
      'Partnered with leading national banks for plot purchase loans',
      'Demarcated individual boundaries with permanent corner stones',
    ],
  },
  {
    id: 'purchase-resale',
    badge: 'Owner & Investor Solutions',
    serviceNum: 'SERVICE 02',
    title: 'Land Purchase & Resale',
    subtitle: 'Strategic Land Acquisition, Valuation Assessment & Structured Resale',
    description:
      'Whether you wish to liquidate an existing land parcel or rebalance your land portfolio, our property desk provides fair market valuations, document clearance, and seamless resale execution.',
    howItWorks: [
      { step: '01', title: 'Property Assessment', desc: 'Submit your survey number, location, and patta details for on-ground physical inspection.' },
      { step: '02', title: 'Valuation & Pricing', desc: 'Receive a fair market price assessment cross-referenced against recent sub-registrar registered transaction values.' },
      { step: '03', title: 'Title Due Diligence', desc: 'We verify revenue records, resolve minor document encumbrances, and prepare ready-to-sell document binders.' },
      { step: '04', title: 'Settlement & Resale', desc: 'Connect with verified cash buyers from our qualified investor network for transparent, timely closure.' },
    ],
    benefits: [
      'Realistic, data-backed land valuation with zero inflated false promises',
      'Rapid matchmaking with pre-vetted HNIs and institutional land buyers',
      'Complete resolution support for patta discrepancies and boundary rectifications',
      'Transparent settlement process with guaranteed legal safety',
    ],
  },
  {
    id: 'brokerage-advisory',
    badge: 'Ethical Intermediation',
    serviceNum: 'SERVICE 03',
    title: 'Land Brokerage & Title Advisory',
    subtitle: 'Transparent Brokerage, Boundary Survey Verification & Sub-Registrar Support',
    description:
      'Navigating unorganized land markets requires experienced stewardship. Our licensed land brokerage desk represents buyers and sellers with rigorous legal vetting, zero hidden commissions, and total documentation transparency.',
    howItWorks: [
      { step: '01', title: 'Requirement Profiling', desc: 'Define your desired land extent, budget limit, proximity to highways, and intended use.' },
      { step: '02', title: 'Curated Land Matching', desc: 'We source exclusively legally verified registered plots and acreage matching your parameters.' },
      { step: '03', title: 'Legal & Survey Audit', desc: 'Complete scrutiny of FMB sketches, revenue records, and physical boundary measurements prior to token.' },
      { step: '04', title: 'Registration Facilitation', desc: 'Drafting compliant sale deeds, calculating accurate stamp duty, and representing you through final execution.' },
    ],
    benefits: [
      '100% verified parent title link deeds before any agreement is signed',
      'Strictly zero hidden surcharges or middleman markups',
      'Direct assistance with Tamil Nadu revenue department & Taluk offices',
      'End-to-end liaison with qualified legal advocates specializing in land law',
    ],
  },
]

export default function ServicesPage() {
  return (
    <main className="services-page-wrapper">
      {/* 1. Hero Section matching About Us Minimalist Structure */}
      <section className="services-hero-section">
        <div className="services-hero-container">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="services-hero__breadcrumb">
            <Link href="/">Home</Link>
            <span className="services-hero__breadcrumb-sep">/</span>
            <span className="services-hero__breadcrumb-current">Services</span>
          </nav>

          {/* Heading & Subtitle */}
          <div className="services-hero__header">
            <span className="services-hero__badge">
              OUR SERVICES
            </span>
            <h1 className="services-hero__title">
              Land &amp; Plot Services
            </h1>
            <p className="services-hero__subtitle">
              ASSETS CREATOR — Specialized land solutions across Chennai: Direct developer plot sales, land purchase &amp; resale, and transparent land brokerage.
            </p>
            <a href="#consultation" className="services-hero__cta">
              <span>Book a Consultation</span>
              <span className="services-hero__cta-arrow" aria-hidden="true">
                <ArrowUpRight size={16} />
              </span>
            </a>
          </div>

          {/* Wide Hero Image matching About Us architectural banner */}
          <div className="services-hero__image-wrap">
            <Image
              src="/images/hero-estate.jpg"
              alt="Crystal Estates Land & Property Services"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1360px"
              className="services-hero__image"
            />
          </div>
        </div>
      </section>

      {/* 2. Structured Service Blocks with Alternating White / Warm Backgrounds */}
      {serviceBlocks.map((svc, idx) => {
        const isWhiteBg = idx % 2 === 0
        return (
          <section
            key={svc.id}
            id={svc.id}
            className={`services-block-section ${isWhiteBg ? 'services-block-section--white' : 'services-block-section--warm'}`}
          >
            <div className="services-block-container">
              <div className="services-block-grid">
                {/* Left Column: Service Details & Key Benefits */}
                <div className="services-block-left">
                  <div className="services-block__header-tag">
                    <span className="services-block__badge">
                      {svc.badge}
                    </span>
                    <span className="services-block__num">
                      {svc.serviceNum}
                    </span>
                  </div>

                  <h2 className="services-block__title">
                    {svc.title}
                  </h2>

                  <p className="services-block__subtitle">
                    {svc.subtitle}
                  </p>

                  <p className="services-block__desc">
                    {svc.description}
                  </p>

                  {/* Grounded Benefits Box */}
                  <div className="services-benefits-box">
                    <h4 className="services-benefits-box__title">
                      Key Benefits &amp; Guarantees:
                    </h4>
                    <div className="services-benefits-grid">
                      {svc.benefits.map((b, bIdx) => (
                        <div key={bIdx} className="services-benefit-item">
                          <CheckCircle2 size={16} className="services-benefit-icon" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Step-by-Step Structured Cards */}
                <div className="services-block-right">
                  <div className="services-steps-card">
                    <h3 className="services-steps-card__heading">
                      How It Works — Step-by-Step
                    </h3>
                    <div className="services-steps-grid">
                      {svc.howItWorks.map((st) => (
                        <div key={st.step} className="services-step-item">
                          <div className="services-step-item__number">
                            {st.step}
                          </div>
                          <h4 className="services-step-item__title">
                            {st.title}
                          </h4>
                          <p className="services-step-item__desc">
                            {st.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )
      })}

      {/* 3. Reusable Consultation Section on Warm Background */}
      <section id="consultation" className="services-consultation-section">
        <div className="services-consultation-container">
          <div className="services-consultation-header">
            <span className="services-consultation-badge">
              FREE CONSULTATION
            </span>
            <h2 className="services-consultation-title">
              Consult with a Land Specialist
            </h2>
            <p className="services-consultation-subtitle">
              Tell us your requirements and our land advisors will assist you promptly with title copies, site visit bookings, or valuation.
            </p>
          </div>

          <div className="services-consultation-form-wrap">
            <EnquiryForm
              title="Book a Free Consultation"
              subtitle="Explore available plots, request document copies, or enquire about selling land."
            />
          </div>
        </div>
      </section>

      {/* 4. Testimonials placed directly above Footer */}
      <TestimonialsSection
        title="Landowner Confidence"
        subtitle="See why over 500+ landowners trust Crystal Estates for clear-titled land acquisition in Chennai."
      />
    </main>
  )
}
