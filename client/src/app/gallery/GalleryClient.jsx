'use client'

import React from 'react'
import { Camera } from 'lucide-react'
import GalleryClientView from '../../components/gallery/GalleryClientView'
import PageHeroHeader from '../../components/common/PageHeroHeader'
import { Reveal, openSiteVisit } from '../../components/home/motion'
import { LocationsMarquee } from '../../components/home/Manifesto'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import '../../components/home/home.css'
import './gallery.css'

const QUALITY_PILLARS = [
  {
    num: '01',
    title: 'Physical Boundary Stones',
    text: 'Permanent concrete boundary stones surveyed and planted at all four corners of every residential and farm plot.',
  },
  {
    num: '02',
    title: 'Blacktop Avenue Roads',
    text: 'Wide, motorable blacktop roads complete with rainwater drainage channels and street electrification infrastructure.',
  },
  {
    num: '03',
    title: 'Sanctioned Masterplans',
    text: 'Every plotted development adheres strictly to CMDA and DTCP layout sanctions, with complete OSR open space allocations.',
  },
  {
    num: '04',
    title: 'Verified Patta Transfer',
    text: 'Individual computerized revenue patta records vetted prior to sale deed execution at the Sub-Registrar Office.',
  },
]

export default function GalleryClient({ initialPlots = [] }) {
  return (
    <div className="ch-home ch-gallery-page">
      {/* ── 1. Hero Section (Unified About-Us Header Style) ────── */}
      <PageHeroHeader
        id="ch-gallery-hero-title"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Gallery' },
        ]}
        eyebrow="On-Ground Visual Portfolio · Assets Creator"
        titleSegments={[
          { text: 'Visual proof of' },
          { br: true },
          { text: 'every boundary.', className: 'ch-accent' },
        ]}
        lead="Explore authentic on-ground site photographs, drone aerial panoramas, and approved layout walkthroughs across Chennai corridors. Every boundary stone demarcated, every title verified."
        primaryCta={{
          label: 'Explore Visual Archive',
          href: '#gallery-catalog',
          variant: 'dark',
        }}
        secondaryCta={{
          label: 'Book an in-person visit',
          onClick: openSiteVisit,
        }}
        stats={[
          { value: 40, suffix: '+', label: 'Site & Drone Views' },
          { value: 100, suffix: '%', label: 'Ground Demarcated' },
          { value: 30, suffix: '-Yr', label: 'Legal Scrutiny' },
        ]}
        mainImage={{
          src: '/images/brammadesam.jpg',
          alt: 'Crystal Estates aerial drone layout view',
        }}
        subImage={{
          src: '/images/kolapakkam.jpg',
          alt: 'Demarcated plot boundary stones',
        }}
        chip={{
          icon: Camera,
          text: 'Authentic On-Ground Proof',
        }}
        sealText="ASSETS CREATOR · SINCE 2014 · CHENNAI ·"
      />

      {/* ── 2. Corridors Marquee ──────────────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Gallery Catalog & Lightbox (hideHero enabled) ─── */}
      <div id="gallery-catalog">
        <GalleryClientView
          initialPlots={initialPlots}
          hideHero={true}
          title="Visual Project Gallery"
          badge="On-Ground Archive"
          subtitle="Captured moments from our on-ground sites, aerial drone panoramas, approved layouts, and guided walkthrough tours across Chennai."
        />
      </div>

      {/* ── 4. The Visual Due Diligence Standard ──────────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-gallery-standards-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <h2 id="ch-gallery-standards-title" className="ch-h2">
              Four proofs kept on <span className="ch-accent">every site.</span>
            </h2>
          </div>

          <div className="ch-about-shield__steps">
            {QUALITY_PILLARS.map((p, idx) => (
              <Reveal key={p.num} delay={idx * 0.1} className="ch-about-shield-step">
                <div className="ch-about-shield-step__num">{p.num}</div>
                <h4>{p.title}</h4>
                <p>{p.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Landowner Voices ───────────────────────────────── */}
      <Voices />

      {/* ── 6. Consultation Pavilion ──────────────────────────── */}
      <Closing />
    </div>
  )
}
