'use client'

import React from 'react'
import { BadgeCheck } from 'lucide-react'
import ProjectsClientView from '../../components/projects/ProjectsClientView'
import PageHeroHeader from '../../components/common/PageHeroHeader'
import { Reveal, openSiteVisit } from '../../components/home/motion'
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
      {/* ── 1. Hero Section (Unified About-Us Header Style) ────── */}
      <PageHeroHeader
        id="ch-projects-hero-title"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Projects' },
        ]}
        eyebrow="Verified Land &amp; Plot Portfolio · Assets Creator"
        titleSegments={[
          { text: 'Curated plots in' },
          { br: true },
          { text: 'proven corridors.', className: 'ch-accent' },
        ]}
        lead="CMDA &amp; DTCP approved residential layouts, managed sandalwood farmland, and prime investment parcels across Chennai. 100% legally vetted with direct developer pricing."
        primaryCta={{
          label: 'Explore Verified Projects',
          href: '#catalog',
          variant: 'dark',
        }}
        secondaryCta={{
          label: 'Book a guided site visit',
          onClick: openSiteVisit,
        }}
        stats={[
          { value: 450, suffix: '+', label: 'Acres Delivered' },
          { value: 100, suffix: '%', label: 'Approval Compliant' },
          { value: 30, suffix: '+', label: 'Years Legal Audit' },
        ]}
        mainImage={{
          src: '/images/hero-estate.jpg',
          alt: 'Crystal Estates CMDA & DTCP plotted development layout',
        }}
        subImage={{
          src: '/images/kolapakkam.jpg',
          alt: 'Demarcated boundary stones at Kolapakkam project',
        }}
        chip={{
          icon: BadgeCheck,
          text: 'CMDA & DTCP Approved',
        }}
        sealText="ASSETS CREATOR · SINCE 2014 · CHENNAI ·"
      />

      {/* ── 2. Corridors Marquee ──────────────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Interactive Catalog & Filter Console ───────────── */}
      <div id="catalog">
        <ProjectsClientView initialProjects={initialProjects} />
      </div>

      {/* ── 4. Buyer Assurance Strip ──────────────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-projects-standards-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <h2 id="ch-projects-standards-title" className="ch-h2">
              Four promises kept on <span className="ch-accent">every parcel.</span>
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

      {/* ── 5. Landowner Testimonials ─────────────────────────── */}
      <Voices />

      {/* ── 6. Closing CTA Section ────────────────────────────── */}
      <Closing />
    </div>
  )
}
