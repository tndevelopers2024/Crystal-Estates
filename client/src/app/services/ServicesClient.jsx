'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ShieldCheck,
  CheckCircle2,
  Building2,
  Compass,
  ArrowRight,
  Scale,
  Landmark,
  Receipt,
  FileCheck2,
} from 'lucide-react'
import PageHeroHeader from '../../components/common/PageHeroHeader'
import {
  Eyebrow,
  Reveal,
  PillLink,
} from '../../components/home/motion'
import { LocationsMarquee } from '../../components/home/Manifesto'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import { CountUp } from '../../components/ui'
import '../../components/home/home.css'
import './services.css'

const OVERVIEW_CARDS = [
  {
    href: '#direct-sales',
    num: '01',
    icon: Building2,
    title: 'Direct Land Sales',
    desc: 'CMDA & DTCP approved plotted layouts and managed sandalwood farmland with direct developer pricing and zero brokerage.',
  },
  {
    href: '#purchase-resale',
    num: '02',
    icon: Scale,
    title: 'Land Purchase & Resale',
    desc: 'Strategic valuation assessment, document encumbrance clearance, and rapid matching with verified cash buyers.',
  },
  {
    href: '#brokerage-advisory',
    num: '03',
    icon: Compass,
    title: 'Brokerage & Advisory',
    desc: 'Experienced stewardship for unorganized land markets: 30-year parent title audits, FMB surveys, and Sub-Registrar support.',
  },
]

const SERVICES = [
  {
    id: 'direct-sales',
    num: '01',
    badge: 'Core Flagship',
    serviceTag: 'SERVICE 01',
    title: 'Direct Land Sales',
    subtitle: 'CMDA & DTCP Approved Plotted Developments & Managed Sandalwood Farmland',
    description:
      'Purchase clear-title residential plots and high-value agro-forestry farm land directly from Crystal Estates with verified parent documents, individual patta, and physical demarcation stones.',
    image: '/images/kolapakkam.jpg',
    imageTag: 'Approved Plotted Developments & Managed Farmland',
    benefits: [
      'Zero brokerage fee on direct company developments',
      'Transparent pricing based on actual square-foot guide value',
      'Partnered with leading national banks for plot purchase loans',
      'Demarcated individual boundaries with permanent corner stones',
    ],
    howItWorks: [
      { step: '01', title: 'Plot Selection', desc: 'Browse available plotted layouts, extent measurements, and facing orientations.' },
      { step: '02', title: 'Guided Site Visit', desc: 'Complimentary weekend family pick-up to physically walk the land, inspect road access, and boundary stones.' },
      { step: '03', title: 'Legal Title Review', desc: 'Review 30-year parent deeds, nil-encumbrance certificate, and layout sanction copies with our legal team.' },
      { step: '04', title: 'Registration & Patta', desc: 'Execute spot sale deed registration at the SRO, followed by computerized online Patta name transfer.' },
    ],
  },
  {
    id: 'purchase-resale',
    num: '02',
    badge: 'Owner & Investor Solutions',
    serviceTag: 'SERVICE 02',
    title: 'Land Purchase & Resale',
    subtitle: 'Strategic Land Acquisition, Valuation Assessment & Structured Resale',
    description:
      'Whether you wish to liquidate an existing land parcel or rebalance your land portfolio, our property desk provides fair market valuations, document clearance, and seamless resale execution.',
    image: '/images/vedanthangal.jpg',
    imageTag: 'Strategic Farmland & Acreage Portfolios',
    benefits: [
      'Realistic, data-backed land valuation with zero inflated false promises',
      'Rapid matchmaking with pre-vetted HNIs and institutional land buyers',
      'Complete resolution support for patta discrepancies and boundary rectifications',
      'Transparent settlement process with guaranteed legal safety',
    ],
    howItWorks: [
      { step: '01', title: 'Property Assessment', desc: 'Submit your survey number, location, and patta details for on-ground physical inspection.' },
      { step: '02', title: 'Valuation & Pricing', desc: 'Receive a fair market price assessment cross-referenced against recent sub-registrar registered transaction values.' },
      { step: '03', title: 'Title Due Diligence', desc: 'We verify revenue records, resolve minor document encumbrances, and prepare ready-to-sell document binders.' },
      { step: '04', title: 'Settlement & Resale', desc: 'Connect with verified cash buyers from our qualified investor network for transparent, timely closure.' },
    ],
  },
  {
    id: 'brokerage-advisory',
    num: '03',
    badge: 'Ethical Intermediation',
    serviceTag: 'SERVICE 03',
    title: 'Land Brokerage & Title Advisory',
    subtitle: 'Transparent Brokerage, Boundary Survey Verification & Sub-Registrar Support',
    description:
      'Navigating unorganized land markets requires experienced stewardship. Our licensed land brokerage desk represents buyers and sellers with rigorous legal vetting, zero hidden commissions, and total documentation transparency.',
    image: '/images/somamangalam.jpg',
    imageTag: '100% Verified Parent Lineage',
    benefits: [
      '100% verified parent title link deeds before any agreement is signed',
      'Strictly zero hidden surcharges or middleman markups',
      'Direct assistance with Tamil Nadu revenue department & Taluk offices',
      'End-to-end liaison with qualified legal advocates specializing in land law',
    ],
    howItWorks: [
      { step: '01', title: 'Requirement Profiling', desc: 'Define your desired land extent, budget limit, proximity to highways, and intended use.' },
      { step: '02', title: 'Curated Land Matching', desc: 'We source exclusively legally verified registered plots and acreage matching your parameters.' },
      { step: '03', title: 'Legal & Survey Audit', desc: 'Complete scrutiny of FMB sketches, revenue records, and physical boundary measurements prior to token.' },
      { step: '04', title: 'Registration Facilitation', desc: 'Drafting compliant sale deeds, calculating accurate stamp duty, and representing you through final execution.' },
    ],
  },
]

const STATS = [
  { value: 450, suffix: '+', label: 'Acres Delivered', desc: 'Plotted layouts and managed sandalwood farmland across Chennai & Kanchipuram.' },
  { value: 1200, suffix: '+', label: 'Satisfied Landowners', desc: 'Direct buyers, resale investors, and agricultural land stewards.' },
  { value: 30, suffix: '+', label: 'Years Legal Scrutiny', desc: 'Every parent deed traced back thirty years by senior property advocates.' },
  { value: 100, suffix: '%', label: 'Regulatory Compliance', desc: 'Strict adherence to CMDA, DTCP, and Tamil Nadu revenue department norms.' },
  { value: 2, suffix: '-Hr', label: 'Advisory Callback', desc: 'Direct turnaround for layout documentation, pricing, and weekend cab pick-up.' },
  { value: 0, suffix: '%', label: 'Hidden Brokerages', desc: 'Transparent all-inclusive pricing with zero middleman markups.' },
]

export default function ServicesClient() {
  return (
    <div className="ch-home ch-services-page">
      {/* ── 1. Hero Section (Unified About-Us Header Style) ────── */}
      <PageHeroHeader
        id="ch-services-hero-title"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Services' },
        ]}
        eyebrow="Comprehensive Land Solutions · Assets Creator"
        titleSegments={[
          { text: 'Specialized land expertise,' },
          { br: true },
          { text: 'unbroken transparency.', className: 'ch-accent' },
        ]}
        lead="From approved plotted layouts and managed agro-forestry to strategic land resale and Sub-Registrar liaison, Crystal Estates delivers friction-free land solutions."
        primaryCta={{
          label: 'Explore Land Solutions',
          href: '#direct-sales',
          variant: 'dark',
        }}
        secondaryCta={{
          label: 'Talk to a land advisor',
          href: '/contact',
        }}
        stats={[
          { value: 3, suffix: '', label: 'Specialized Desks' },
          { value: 1200, suffix: '+', label: 'Landowners Advised' },
          { value: 0, suffix: '%', label: 'Hidden Brokerage' },
        ]}
        mainImage={{
          src: '/images/somamangalam.jpg',
          alt: 'Direct land sales and development advisory in Chennai',
        }}
        subImage={{
          src: '/images/vedanthangal.jpg',
          alt: 'Physical boundary demarcation and survey verification',
        }}
        chip={{
          icon: Scale,
          text: '30-Yr Legal Scrutiny',
        }}
        sealText="ASSETS CREATOR · SINCE 2014 · CHENNAI ·"
      />

      {/* ── 2. Corridors Marquee ──────────────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Quick Overview Cards ───────────────────────────── */}
      <section className="ch-services-overview" aria-labelledby="ch-services-overview-title">
        <div className="ch-wrap">
          <div className="ch-services-overview__head">
            <Eyebrow>Three Core Solutions</Eyebrow>
            <h2 id="ch-services-overview-title" className="ch-h2">
              End-to-end stewardship for <span className="ch-accent">every landowner.</span>
            </h2>
          </div>

          <div className="ch-services-overview__grid">
            {OVERVIEW_CARDS.map((card, idx) => {
              const Icon = card.icon
              return (
                <Reveal key={card.title} delay={idx * 0.1}>
                  <a href={card.href} className="ch-services-ov-card">
                    <div className="ch-services-ov-card__icon" aria-hidden="true">
                      <Icon size={24} />
                    </div>
                    <div className="ch-services-ov-card__num">{card.num}</div>
                    <h3>{card.title}</h3>
                    <p>{card.desc}</p>
                    <div className="ch-services-ov-card__link">
                      <span>Explore Service Details</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </div>
                  </a>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 4. Deep-Dive Service Showcases ────────────────────── */}
      {SERVICES.map((svc, idx) => {
        const isFlipped = idx % 2 === 1
        const bgTheme = idx % 2 === 0 ? 'ch-service-showcase--paper' : 'ch-service-showcase--bone'
        return (
          <section
            key={svc.id}
            id={svc.id}
            className={`ch-service-showcase ${bgTheme} ${isFlipped ? 'ch-service-showcase--flipped' : ''}`}
            aria-labelledby={`service-heading-${svc.id}`}
          >
            <div className="ch-wrap">
              <div className="ch-service-showcase__grid">
                {/* Details Column */}
                <div className="ch-service-showcase__details">
                  <div className="ch-service-showcase__badge-row">
                    <span className="ch-service-showcase__badge">{svc.badge}</span>
                    <span className="ch-service-showcase__num">{svc.serviceTag}</span>
                  </div>

                  <h2 id={`service-heading-${svc.id}`} className="ch-service-showcase__title">
                    {svc.title}
                  </h2>
                  <p className="ch-service-showcase__subtitle">{svc.subtitle}</p>
                  <p className="ch-service-showcase__desc">{svc.description}</p>

                  <Reveal className="ch-service-showcase__photo-card" y={20}>
                    <Image
                      src={svc.image}
                      alt={svc.title}
                      fill
                      sizes="(max-width: 900px) 100vw, 620px"
                    />
                    <div className="ch-service-showcase__photo-tag">
                      <ShieldCheck size={14} aria-hidden="true" />
                      <span>{svc.imageTag}</span>
                    </div>
                  </Reveal>

                  <div className="ch-service-benefits">
                    <h4>Key Guarantees &amp; Benefits:</h4>
                    <div className="ch-service-benefits__list">
                      {svc.benefits.map((b, bIdx) => (
                        <div key={bIdx} className="ch-service-benefit-item">
                          <CheckCircle2 size={16} aria-hidden="true" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* How It Works Column */}
                <Reveal className="ch-service-steps-card" y={30}>
                  <div className="ch-service-steps-card__head">
                    <h3>How It Works</h3>
                    <span className="ch-service-steps-card__badge">Structured Pathway</span>
                  </div>

                  <div className="ch-service-steps-grid">
                    {svc.howItWorks.map((st) => (
                      <div key={st.step} className="ch-service-step-item">
                        <div className="ch-service-step-item__num">{st.step}</div>
                        <div className="ch-service-step-item__content">
                          <h4>{st.title}</h4>
                          <p>{st.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </section>
        )
      })}

      {/* ── 5. Proven Milestones in Numbers ───────────────────── */}
      <section className="ch-services-stats" aria-labelledby="ch-services-stats-title">
        <div className="ch-wrap">
          <div className="ch-services-stats__head">
            <Eyebrow className="ch-eyebrow--light">Proven Milestones</Eyebrow>
            <h2 id="ch-services-stats-title" className="ch-h2 ch-h2--light">
              Results forged across <span className="ch-accent">every corridor.</span>
            </h2>
          </div>

          <div className="ch-services-stats__grid">
            {STATS.map((s, idx) => (
              <Reveal key={s.label} delay={idx * 0.08} className="ch-services-stat-card">
                <div className="ch-services-stat-card__num">
                  <CountUp to={s.value} suffix={s.suffix} />
                </div>
                <div className="ch-services-stat-card__label">{s.label}</div>
                <p className="ch-services-stat-card__desc">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Landowner Voices ───────────────────────────────── */}
      <Voices />

      {/* ── 7. Consultation Suite ─────────────────────────────── */}
      <div id="consultation">
        <Closing />
      </div>
    </div>
  )
}
