'use client'

import React from 'react'
import Link from 'next/link'
import {
  Camera,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import GalleryClientView from '../../components/gallery/GalleryClientView'
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
import './gallery.css'

const QUALITY_PILLARS = [
  {
    num: '01',
    title: 'Physical Boundary Stones',
    text: 'Permanent concrete boundary stones surveyed and planted at all four corners of every residential and farm plot.',
  },
  {
    num: '02',
    title: 'Sanctioned Master Plans',
    text: 'Clear-scale layout sanction blueprints approved by CMDA, DTCP, or Panchayat with visible credential numbers.',
  },
  {
    num: '03',
    title: 'Blacktop Avenue Infrastructure',
    text: '30-foot and 40-foot wide avenue roads, EB electricity poles, perimeter fencing, and motorable physical access.',
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
      {/* ── 1. Hero Section ───────────────────────────────────── */}
      <section className="ch-gallery-hero" aria-labelledby="ch-gallery-hero-title">
        <div className="ch-wrap">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="ch-gallery-breadcrumb">
            <Link href="/">Home</Link>
            <span className="ch-gallery-breadcrumb__sep">/</span>
            <span className="ch-gallery-breadcrumb__current">Gallery</span>
          </nav>

          <div className="ch-gallery-hero__head">
            <Eyebrow>On-Ground Visual Portfolio · Assets Creator</Eyebrow>
            <h1 id="ch-gallery-hero-title" className="ch-gallery-hero__title">
              <WordsPullUpMultiStyle
                segments={[
                  { text: 'Visual proof of' },
                  { br: true },
                  { text: 'every boundary.', className: 'ch-accent' },
                ]}
              />
            </h1>
            <p className="ch-gallery-hero__lead">
              Explore authentic on-ground site photographs, drone aerial panoramas, approved master layout plans,
              and guided walkthrough tours across Chennai &amp; Kanchipuram corridors. Every boundary stone demarcated,
              every title verified.
            </p>

            <div className="ch-gallery-hero__ctas">
              <PillLink href="#enquire" variant="cream" onClick={openSiteVisit}>
                Book an In-Person Site Visit
              </PillLink>
              <PillLink href="/projects" variant="dark">
                Explore Verified Projects
              </PillLink>
            </div>

            {/* Live Visual Stats Row */}
            <div className="ch-gallery-stats-row">
              <div className="ch-gallery-stat-pill">
                <Camera size={16} style={{ color: '#b8964e' }} aria-hidden="true" />
                <strong>40+</strong>
                <span>Site Photos &amp; Drone Views</span>
              </div>
              <div className="ch-gallery-stat-pill">
                <Layers size={16} style={{ color: '#0f3d2e' }} aria-hidden="true" />
                <strong>100%</strong>
                <span>CMDA &amp; DTCP Approved Layouts</span>
              </div>
              <div className="ch-gallery-stat-pill">
                <ShieldCheck size={16} style={{ color: '#25d366' }} aria-hidden="true" />
                <strong>30-Yr</strong>
                <span>Legal Scrutiny Guaranteed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Corridors Marquee ──────────────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Gallery Catalog & Lightbox (hideHero enabled) ─── */}
      <GalleryClientView
        initialPlots={initialPlots}
        hideHero={true}
        title="Visual Project Gallery"
        badge="On-Ground Archive"
        subtitle="Captured moments from our on-ground sites, aerial drone panoramas, approved layouts, and guided walkthrough tours across Chennai."
      />

      {/* ── 4. The Visual Due Diligence Standard ──────────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-gallery-standards-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <Eyebrow>The Visual Due Diligence Standard</Eyebrow>
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
