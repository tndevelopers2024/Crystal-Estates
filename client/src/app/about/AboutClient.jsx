'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Compass,
  Target,
  ShieldCheck,
  FileCheck2,
  BadgeCheck,
  Car,
  Landmark,
  Receipt,
  Sparkles,
} from 'lucide-react'
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
import { CountUp } from '../../components/ui'
import '../../components/home/home.css'
import './about.css'

const STATS = [
  { value: 450, suffix: '+', label: 'Acres Delivered', desc: 'Plotted layouts and managed sandalwood farmland across Chennai & Kanchipuram.' },
  { value: 1200, suffix: '+', label: 'Happy Landowners', desc: 'Generational wealth secured through clean, clear-titled real estate.' },
  { value: 30, suffix: '+', label: 'Years Legal Scrutiny', desc: 'Every parent deed traced back thirty years by senior title advocates.' },
  { value: 100, suffix: '%', label: 'Approval Compliance', desc: 'Layouts comply strictly with CMDA, DTCP, and revenue department norms.' },
  { value: 2, suffix: '-Hr', label: 'Advisory Response', desc: 'Fast turnaround for layout documentation, pricing, and weekend cab pick-up.' },
  { value: 0, suffix: '%', label: 'Hidden Brokerages', desc: 'Transparent all-inclusive pricing with zero middleman markups.' },
]

const PILLARS = [
  {
    icon: Receipt,
    title: 'Direct Developer Pricing',
    text: 'Zero broker markups, zero development surcharges. You get honest, all-inclusive pricing straight from the asset creators.',
  },
  {
    icon: ShieldCheck,
    title: 'Exhaustive 30-Year Audit',
    text: 'Revenue records, encumbrance certificates, and complete parent deed chains are scrutinised by our legal desk before any plot reaches you.',
  },
  {
    icon: Landmark,
    title: 'Physical Demarcation & Roads',
    text: 'Every plot is surveyed with concrete boundary stones, wide motorable blacktop avenue roads, and groundwater feasibility tested.',
  },
  {
    icon: FileCheck2,
    title: 'Spot Patta Transfer Support',
    text: 'Hands-on assistance with sub-registrar draft vetting, registration scheduling, and prompt individual revenue patta name-transfer.',
  },
]

const SHIELD_STEPS = [
  {
    num: '01',
    title: '30-Year Title Scrutiny',
    text: 'Senior high court advocates audit encumbrance certificates and complete parent deed lineage back thirty years.',
  },
  {
    num: '02',
    title: 'Sanctioned Approvals',
    text: 'Every project strictly complies with CMDA or DTCP layout regulations, with approval numbers transparently displayed.',
  },
  {
    num: '03',
    title: 'On-Ground Demarcation',
    text: 'Permanent boundary corner stones, avenue plantation, electricity connectivity, and clear road access are verified.',
  },
  {
    num: '04',
    title: 'Registration & Patta',
    text: 'Flawless document execution at the sub-registrar office followed by dedicated tracking for individual patta transfer.',
  },
]

export default function AboutClient() {
  return (
    <div className="ch-home ch-about">
      {/* ── 1. Hero Section ───────────────────────────────────── */}
      <section className="ch-about-hero" aria-labelledby="ch-about-hero-title">
        <div className="ch-wrap">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="ch-about-breadcrumb">
            <Link href="/">Home</Link>
            <span className="ch-about-breadcrumb__sep">/</span>
            <span className="ch-about-breadcrumb__current">About Us</span>
          </nav>

          <div className="ch-about-hero__head">
            <Eyebrow>About Crystal Estates · Assets Creator</Eyebrow>
            <h1 id="ch-about-hero-title" className="ch-about-hero__title">
              <WordsPullUpMultiStyle
                segments={[
                  { text: 'A decade of clear soil,' },
                  { br: true },
                  { text: 'uncompromising trust.', className: 'ch-accent' },
                ]}
              />
            </h1>
            <p className="ch-about-hero__lead">
              Founded on an unwavering mandate: land transactions in Tamil Nadu should be transparent, verifiable,
              and enduring. We curate CMDA &amp; DTCP-approved plotted developments and managed sandalwood estates
              that secure your family&apos;s generational future.
            </p>

            <div className="ch-about-hero__ctas">
              <PillLink href="/projects" variant="cream">
                Explore Verified Projects
              </PillLink>
              <PillLink href="#enquire" variant="dark" onClick={openSiteVisit}>
                Book a Guided Site Visit
              </PillLink>
            </div>
          </div>

          {/* Panoramic Architectural Banner */}
          <Reveal className="ch-about-hero__banner" y={30}>
            <div className="ch-about-hero__banner-img">
              <Image
                src="/images/hero-estate.jpg"
                alt="Crystal Estates curated residential and farm developments"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 1360px"
              />
            </div>
            <div className="ch-about-hero__banner-shade" aria-hidden="true" />
            <div className="ch-about-hero__chip ch-about-hero__chip--left">
              <span className="ch-about-hero__chip-dot" aria-hidden="true" />
              <span>100% Legally Scrutinized Soil &amp; Direct Developer Ownership</span>
            </div>
            <div className="ch-about-hero__chip ch-about-hero__chip--right">
              <span className="ch-about-hero__chip-star" aria-hidden="true">★</span>
              <span>15+ Years Track Record Across Prime Chennai Corridors</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 2. Corridors Marquee ──────────────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Origin Story & Manifesto ───────────────────────── */}
      <section className="ch-about-story" aria-labelledby="ch-about-story-title">
        <div className="ch-wrap ch-about-story__grid">
          {/* Left Column: Narrative & Photo Card */}
          <div className="ch-about-story__narrative">
            <Eyebrow>Our Origin &amp; Philosophy</Eyebrow>
            <h2 id="ch-about-story-title" className="ch-about-story__title">
              Building generational security on clear soil.
            </h2>
            <p className="ch-about-story__lead">
              Bridging the trust deficit between discerning landowners and 100% legally transparent plots across Tamil Nadu.
            </p>
            <p className="ch-about-story__text">
              Established with an uncompromising ethos of transparency, <strong>Crystal Estates</strong> operates with a
              singular, disciplined focus: <em>land and plot sales only</em>. In an industry often clouded by ambiguous titles,
              unverified revenue sketches, and hidden broker fees, we set out to build a safe haven for family investors,
              NRI buyers, and agricultural land stewards.
            </p>
            <p className="ch-about-story__text">
              Headquartered in Valasaravakkam, Chennai, we develop high-demand residential layouts approved by CMDA and DTCP,
              alongside our flagship 15-acre managed sandalwood farmland community near Vedanthangal. Every layout we introduce
              is preceded by rigorous legal title search, revenue record verification, individual patta, and physical demarcation stones.
            </p>

            <Reveal className="ch-about-story__image-card" y={28}>
              <Image
                src="/images/somamangalam.jpg"
                alt="Approved residential layout with wide avenue roads"
                fill
                sizes="(max-width: 900px) 100vw, 640px"
              />
              <span className="ch-about-story__image-tag">
                <BadgeCheck size={14} aria-hidden="true" />
                <span>Demarcated Avenue Corridors</span>
              </span>
            </Reveal>
          </div>

          {/* Right Column: 4 Core Pillar Cards */}
          <div className="ch-about-pillars-stack">
            {PILLARS.map((p, idx) => {
              const Icon = p.icon
              return (
                <Reveal key={p.title} delay={idx * 0.1} className="ch-about-pillar-card">
                  <div className="ch-about-pillar-card__icon" aria-hidden="true">
                    <Icon size={22} />
                  </div>
                  <div className="ch-about-pillar-card__content">
                    <h3>{p.title}</h3>
                    <p>{p.text}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 4. Vision & Mission Pavilion ──────────────────────── */}
      <section className="ch-about-vm" aria-labelledby="ch-about-vm-title">
        <div className="ch-wrap">
          <div className="ch-about-vm__head">
            <Eyebrow>The Compounding Mandate</Eyebrow>
            <h2 id="ch-about-vm-title" className="ch-h2">
              Vision &amp; mission in harmony.
            </h2>
          </div>

          <div className="ch-about-vm__grid">
            {/* Vision Card */}
            <Reveal className="ch-about-vm-card" delay={0.05}>
              <div className="ch-about-vm-card__top">
                <div className="ch-about-vm-card__icon-box" aria-hidden="true">
                  <Compass size={24} />
                </div>
                <span className="ch-about-vm-card__badge">Long-term Vision</span>
              </div>
              <h3>&ldquo;To be the most trusted name in land transactions across Tamil Nadu.&rdquo;</h3>
              <p>
                We envision a real estate ecosystem where every landowner steps onto their property with complete certainty,
                knowing their asset is secured by bulletproof legal titles, strategic growth corridors, and enduring generational appreciation.
              </p>
            </Reveal>

            {/* Mission Card */}
            <Reveal className="ch-about-vm-card" delay={0.15}>
              <div className="ch-about-vm-card__top">
                <div className="ch-about-vm-card__icon-box" aria-hidden="true">
                  <Target size={24} />
                </div>
                <span className="ch-about-vm-card__badge">Daily Mandate</span>
              </div>
              <h3>&ldquo;Clear-title land, honest pricing, complete documentation.&rdquo;</h3>
              <p>
                We dedicate our expertise to providing frictionless land ownership through strict legal due diligence, zero hidden surcharges,
                spot registration guidance, and end-to-end patta transfer support for every client.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 5. Proven Milestones in Numbers ───────────────────── */}
      <section className="ch-about-stats" aria-labelledby="ch-about-stats-title">
        <div className="ch-wrap">
          <div className="ch-about-stats__head">
            <Eyebrow className="ch-eyebrow--light">Proven Milestones</Eyebrow>
            <h2 id="ch-about-stats-title" className="ch-h2 ch-h2--light">
              A decade forged in concrete &amp; soil.
            </h2>
          </div>

          <div className="ch-about-stats__grid">
            {STATS.map((s, idx) => (
              <Reveal key={s.label} delay={idx * 0.08} className="ch-about-stat-card">
                <div className="ch-about-stat-card__num">
                  <CountUp to={s.value} suffix={s.suffix} />
                </div>
                <div className="ch-about-stat-card__label">{s.label}</div>
                <p className="ch-about-stat-card__desc">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. The 4-Step Legal Verification Shield ───────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-about-shield-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <Eyebrow>The Crystal Quality Guarantee</Eyebrow>
            <h2 id="ch-about-shield-title" className="ch-h2">
              Four steps kept on <span className="ch-accent">every plot.</span>
            </h2>
          </div>

          <div className="ch-about-shield__steps">
            {SHIELD_STEPS.map((step, idx) => (
              <Reveal key={step.num} delay={idx * 0.1} className="ch-about-shield-step">
                <div className="ch-about-shield-step__num">{step.num}</div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Leadership & Corporate Governance ──────────────── */}
      <section className="ch-about-lead" aria-labelledby="ch-about-lead-title">
        <div className="ch-wrap">
          <div className="ch-about-lead__card">
            <div className="ch-about-lead__photo">
              <Image
                src="/images/vedanthangal.jpg"
                alt="Crystal Estates Management and Land Advisory"
                fill
                sizes="(max-width: 900px) 100vw, 480px"
              />
              <div className="ch-about-lead__photo-badge">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>MANAGEMENT &amp; TITLE ADVISORY</span>
              </div>
            </div>

            <div className="ch-about-lead__content">
              <Eyebrow>Management Perspective</Eyebrow>
              <blockquote className="ch-about-lead__quote">
                &ldquo;Land is not merely an investment; it is the physical foundation upon which families build their future
                and pass down wealth. At Crystal Estates, our promise as ASSETS CREATORS is simple: we never compromise on
                parent deeds, we never sell land we wouldn&apos;t proudly buy ourselves, and we stand beside every landowner
                from first site visit to final patta transfer.&rdquo;
              </blockquote>
              <div className="ch-about-lead__author">
                Ramesh Kumar &amp; Directors
              </div>
              <div className="ch-about-lead__role">
                Crystal Estates — Valasaravakkam, Chennai
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Landowner Voices ───────────────────────────────── */}
      <Voices />

      {/* ── 9. Consultation Suite ─────────────────────────────── */}
      <Closing />
    </div>
  )
}
