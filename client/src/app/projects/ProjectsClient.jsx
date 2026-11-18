'use client'

import React from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  BadgeCheck,
  Car,
  CheckCircle2,
} from 'lucide-react'
import ProjectsClientView from '../../components/projects/ProjectsClientView'
import {
  WordsPullUpMultiStyle,
  Eyebrow,
  Reveal,
  PillLink,
  openSiteVisit,
} from '../../components/home/motion'
import { LocationsMarquee } from '../../components/home/Manifesto'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import '../../components/home/home.css'
import './projects.css'

const GUARANTEES = [
  {
    num: '01',
    title: '100% Clear Title & 30-Yr Scrutiny',
    text: 'Every project goes through an exhaustive 30-year legal search and revenue scrutiny by senior title advocates before reaching you.',
  },
  {
    num: '02',
    title: 'CMDA & DTCP Norms Compliant',
    text: 'Layouts comply strictly with sanctioned masterplans, clear avenue road widths, OSR park allocations, and visible approval credentials.',
  },
  {
    num: '03',
    title: 'Physical Boundary Demarcation',
    text: 'Concrete boundary corner stones, avenue plantation, electricity lines, and motorable tar roads are physically in place.',
  },
  {
    num: '04',
    title: 'Spot Registration & Patta Transfer',
    text: 'End-to-end guidance through sub-registrar deed vetting, on-the-spot registration, and assisted individual patta name-transfer.',
  },
]

export default function ProjectsClient({ initialProjects = [] }) {
  return (
    <div className="ch-home ch-projects-page">
      {/* ── 1. Hero Section ───────────────────────────────────── */}
      <section className="ch-projects-hero" aria-labelledby="ch-projects-hero-title">
        <div className="ch-wrap">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="ch-projects-breadcrumb">
            <Link href="/">Home</Link>
            <span className="ch-projects-breadcrumb__sep">/</span>
            <span className="ch-projects-breadcrumb__current">Projects</span>
          </nav>

          <div className="ch-projects-hero__head">
            <Eyebrow>Verified Land &amp; Plot Portfolio · Assets Creator</Eyebrow>
            <h1 id="ch-projects-hero-title" className="ch-projects-hero__title">
              <WordsPullUpMultiStyle
                segments={[
                  { text: 'Curated plots in' },
                  { br: true },
                  { text: 'proven corridors.', className: 'ch-accent' },
                ]}
              />
            </h1>
            <p className="ch-projects-hero__lead">
              CMDA &amp; DTCP approved residential layouts, managed sandalwood farmland, and high-growth
              investment parcels across prime Chennai and Kanchipuram corridors. Every parcel is 100% legally vetted
              with direct developer pricing.
            </p>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}>
              <PillLink href="#enquire" variant="cream" onClick={openSiteVisit}>
                Book a Guided Site Visit
              </PillLink>
              <PillLink href="/contact" variant="dark">
                Contact Land Advisor
              </PillLink>
            </div>

            {/* Quick Trust Pills */}
            <div className="ch-projects-trust-row">
              <div className="ch-projects-trust-item">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>100% Clear Title &amp; Patta Assured</span>
              </div>
              <div className="ch-projects-trust-item">
                <BadgeCheck size={16} aria-hidden="true" />
                <span>CMDA &amp; DTCP Approved Layouts</span>
              </div>
              <div className="ch-projects-trust-item">
                <Car size={16} aria-hidden="true" />
                <span>Accompanied Weekend Cab Pick-up</span>
              </div>
              <div className="ch-projects-trust-item">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Zero Brokerage or Hidden Surcharges</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Corridors Marquee ──────────────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Interactive Catalog & Filter Console ───────────── */}
      <ProjectsClientView initialProjects={initialProjects} />

      {/* ── 4. The 4 Guarantees Strip ─────────────────────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-guarantees-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <Eyebrow>The Crystal Estates Guarantee</Eyebrow>
            <h2 id="ch-guarantees-title" className="ch-h2">
              Four promises, kept on <span className="ch-accent">every plot.</span>
            </h2>
          </div>

          <div className="ch-about-shield__steps">
            {GUARANTEES.map((g, idx) => (
              <Reveal key={g.num} delay={idx * 0.1} className="ch-about-shield-step">
                <div className="ch-about-shield-step__num">{g.num}</div>
                <h4>{g.title}</h4>
                <p>{g.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Verified Landowner Stories ─────────────────────── */}
      <Voices />

      {/* ── 6. Closing Consultation Suite ─────────────────────── */}
      <Closing />
    </div>
  )
}
