'use client'

import React, { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import {
  Compass,
  Target,
  ShieldCheck,
  FileCheck2,
  BadgeCheck,
  Landmark,
  Receipt,
  Quote,
  ChevronRight,
} from 'lucide-react'
import {
  WordsPullUpMultiStyle,
  Eyebrow,
  Reveal,
  PillLink,
  openSiteVisit,
  EASE,
} from '../../components/home/motion'
import { LocationsMarquee } from '../../components/home/Manifesto'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import { CountUp } from '../../components/ui'
import '../../components/home/home.css'
import './about.css'

const HERO_STATS = [
  { value: 10, suffix: '+', label: 'Years of trust' },
  { value: 1200, suffix: '+', label: 'Happy landowners' },
  { value: 450, suffix: '+', label: 'Acres delivered' },
]

const MILESTONES = [
  {
    tag: '2014',
    title: 'Founded in Valasaravakkam, Chennai',
    text: 'Crystal Estates opens its doors with one disciplined focus: land and plot sales only, with every title verified before it reaches a buyer.',
  },
  {
    tag: 'Approved layouts',
    title: 'CMDA & DTCP plotted developments',
    text: 'Residential layouts across Kolapakkam, Somamangalam and Brammadesam, each with sanctioned approvals, demarcation stones and blacktop avenue roads.',
  },
  {
    tag: 'Farmland',
    title: '15-acre managed sandalwood estate',
    text: 'Our flagship agro-forestry community near Vedanthangal Bird Sanctuary brings managed farmland ownership within reach of family investors.',
  },
  {
    tag: 'Today',
    title: '1,200+ landowners, zero title disputes',
    text: 'Families, NRI buyers and land stewards trust us for clear soil, honest pricing and support from first site visit to final patta transfer.',
  },
]

const PILLARS = [
  {
    icon: Receipt,
    title: 'Direct Developer Pricing',
    short: 'Zero broker markups',
    text: 'Zero broker markups, zero development surcharges. You get honest, all-inclusive pricing straight from the asset creators.',
    points: ['All-inclusive quotes', 'No middleman commission', 'Price locked at booking'],
    image: '/images/kolapakkam.jpg',
  },
  {
    icon: ShieldCheck,
    title: 'Exhaustive 30-Year Audit',
    short: 'Legal desk first',
    text: 'Revenue records, encumbrance certificates, and complete parent deed chains are scrutinised by our legal desk before any plot reaches you.',
    points: ['30-year parent deed chain', 'Encumbrance certificate check', 'Revenue record verification'],
    image: '/images/somamangalam.jpg',
  },
  {
    icon: Landmark,
    title: 'Physical Demarcation & Roads',
    short: 'Ready on the ground',
    text: 'Every plot is surveyed with concrete boundary stones, wide motorable blacktop avenue roads, and groundwater feasibility tested.',
    points: ['Concrete boundary stones', 'Blacktop avenue roads', 'Groundwater tested'],
    image: '/images/brammadesam.jpg',
  },
  {
    icon: FileCheck2,
    title: 'Spot Patta Transfer Support',
    short: 'Until the patta is yours',
    text: 'Hands-on assistance with sub-registrar draft vetting, registration scheduling, and prompt individual revenue patta name-transfer.',
    points: ['Draft deed vetting', 'Registration scheduling', 'Individual patta transfer'],
    image: '/images/vedanthangal.jpg',
  },
]

const STATS = [
  { value: 450, suffix: '+', label: 'Acres Delivered', desc: 'Plotted layouts and managed sandalwood farmland across Chennai & Kanchipuram.' },
  { value: 1200, suffix: '+', label: 'Happy Landowners', desc: 'Generational wealth secured through clean, clear-titled real estate.' },
  { value: 30, suffix: '+', label: 'Years Legal Scrutiny', desc: 'Every parent deed traced back thirty years by senior title advocates.' },
  { value: 100, suffix: '%', label: 'Approval Compliance', desc: 'Layouts comply strictly with CMDA, DTCP, and revenue department norms.' },
  { value: 2, suffix: '-Hr', label: 'Advisory Response', desc: 'Fast turnaround for layout documentation, pricing, and weekend cab pick-up.' },
  { value: 0, suffix: '%', label: 'Hidden Brokerages', desc: 'Transparent all-inclusive pricing with zero middleman markups.' },
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

/* ── Hero: split headline + layered, parallax photo collage ───────────── */
function AboutHero() {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const mainY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 80])
  const subY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -60])

  return (
    <section ref={ref} className="ab-hero" aria-labelledby="ab-hero-title">
      <div className="ch-wrap ab-hero__grid">
        <div className="ab-hero__copy">
          <nav aria-label="Breadcrumb" className="ab-crumbs">
            <Link href="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span aria-current="page">About Us</span>
          </nav>

          <Eyebrow>About Crystal Estates · Assets Creator</Eyebrow>
          <h1 id="ab-hero-title" className="ab-hero__title">
            <WordsPullUpMultiStyle
              segments={[
                { text: 'A decade of clear soil,' },
                { br: true },
                { text: 'uncompromising trust.', className: 'ch-accent' },
              ]}
            />
          </h1>
          <Reveal as="p" className="ab-hero__lead" delay={0.3}>
            Founded on an unwavering mandate: land transactions in Tamil Nadu should be transparent, verifiable and
            enduring. We curate CMDA &amp; DTCP-approved plotted developments and managed sandalwood estates that
            secure your family&apos;s generational future.
          </Reveal>

          <Reveal className="ab-hero__ctas" delay={0.4}>
            <PillLink href="/projects" variant="dark">
              Explore Verified Projects
            </PillLink>
            <button type="button" className="ch-textlink" onClick={openSiteVisit}>
              Book a guided site visit
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </Reveal>

          <Reveal className="ab-hero__stats" delay={0.5}>
            {HERO_STATS.map((s) => (
              <div key={s.label} className="ab-hero__stat">
                <span className="ab-hero__stat-num">
                  <CountUp to={s.value} suffix={s.suffix} />
                </span>
                <span className="ab-hero__stat-label">{s.label}</span>
              </div>
            ))}
          </Reveal>
        </div>

        <div className="ab-hero__visual">
          <motion.div className="ab-hero__img ab-hero__img--main" style={{ y: mainY }}>
            <Image
              src="/images/hero-estate.jpg"
              alt="Crystal Estates approved plotted development with avenue roads"
              fill
              priority
              sizes="(max-width: 1023px) 90vw, 560px"
            />
          </motion.div>
          <motion.div className="ab-hero__img ab-hero__img--sub" style={{ y: subY }}>
            <Image
              src="/images/kolapakkam.jpg"
              alt="Demarcated plot with boundary stone at Kolapakkam"
              fill
              sizes="(max-width: 1023px) 45vw, 280px"
            />
          </motion.div>

          <div className="ab-hero__chip">
            <BadgeCheck size={16} aria-hidden="true" />
            <span>100% clear-title soil</span>
          </div>

          <svg className="ab-hero__seal" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <path id="ab-seal-path" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
            </defs>
            <circle cx="60" cy="60" r="58" className="ab-hero__seal-bg" />
            <text className="ab-hero__seal-text">
              <textPath href="#ab-seal-path">ASSETS CREATOR · SINCE 2014 · CHENNAI ·</textPath>
            </text>
            <path
              d="M60 44 l4.7 9.6 10.6 1.5 -7.7 7.5 1.8 10.5 -9.4 -5 -9.4 5 1.8 -10.5 -7.7 -7.5 10.6 -1.5z"
              className="ab-hero__seal-star"
            />
          </svg>
        </div>
      </div>
    </section>
  )
}

/* ── Journey: sticky story + scroll-filled milestone timeline ─────────── */
function Journey() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] })
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section className="ab-journey" aria-labelledby="ab-journey-title">
      <div className="ch-wrap ab-journey__grid">
        <div className="ab-journey__intro">
          <Eyebrow>Our Origin &amp; Philosophy</Eyebrow>
          <h2 id="ab-journey-title" className="ab-h2">
            Building generational security on <span className="ch-accent">clear soil.</span>
          </h2>
          <p className="ab-journey__text">
            In an industry often clouded by ambiguous titles, unverified revenue sketches and hidden broker fees, we set
            out to build a safe haven for family investors, NRI buyers and agricultural land stewards. Every layout we
            introduce is preceded by rigorous legal title search, revenue record verification, individual patta and
            physical demarcation stones.
          </p>
          <Reveal className="ab-journey__photo" y={28}>
            <Image
              src="/images/somamangalam.jpg"
              alt="Approved residential layout with wide avenue roads"
              fill
              sizes="(max-width: 1023px) 100vw, 520px"
            />
            <span className="ab-journey__photo-tag">
              <BadgeCheck size={14} aria-hidden="true" />
              Demarcated avenue corridors
            </span>
          </Reveal>
        </div>

        <ol ref={ref} className="ab-timeline">
          <span className="ab-timeline__rail" aria-hidden="true">
            <motion.span className="ab-timeline__fill" style={{ scaleY: fill }} />
          </span>
          {MILESTONES.map((m, idx) => (
            <Reveal as="li" key={m.title} className="ab-timeline__item" delay={idx * 0.05}>
              <span className="ab-timeline__dot" aria-hidden="true" />
              <span className="ab-timeline__tag">{m.tag}</span>
              <h3 className="ab-timeline__title">{m.title}</h3>
              <p className="ab-timeline__text">{m.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ── Values: interactive tabs with animated detail panel ──────────────── */
function Values() {
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()
  const current = PILLARS[active]
  const Icon = current.icon

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
    const next = (active + dir + PILLARS.length) % PILLARS.length
    setActive(next)
    document.getElementById(`ab-value-tab-${next}`)?.focus()
  }

  return (
    <section className="ab-values" aria-labelledby="ab-values-title">
      <div className="ch-wrap">
        <div className="ab-values__head">
          <Eyebrow>What We Stand For</Eyebrow>
          <h2 id="ab-values-title" className="ab-h2">
            Four principles behind <span className="ch-accent">every plot we sell.</span>
          </h2>
        </div>

        <div className="ab-values__body">
          <div className="ab-values__tabs" role="tablist" aria-label="Our principles" onKeyDown={onKeyDown}>
            {PILLARS.map((p, idx) => {
              const TabIcon = p.icon
              const selected = idx === active
              return (
                <button
                  key={p.title}
                  id={`ab-value-tab-${idx}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="ab-value-panel"
                  tabIndex={selected ? 0 : -1}
                  className={`ab-values__tab ${selected ? 'is-active' : ''}`}
                  onClick={() => setActive(idx)}
                >
                  <span className="ab-values__tab-num">0{idx + 1}</span>
                  <span className="ab-values__tab-icon" aria-hidden="true">
                    <TabIcon size={18} />
                  </span>
                  <span className="ab-values__tab-text">
                    <span className="ab-values__tab-title">{p.title}</span>
                    <span className="ab-values__tab-short">{p.short}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div
            id="ab-value-panel"
            role="tabpanel"
            aria-labelledby={`ab-value-tab-${active}`}
            className="ab-values__panel"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.title}
                className="ab-values__panel-inner"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <div className="ab-values__media">
                  <Image src={current.image} alt="" fill sizes="(max-width: 1023px) 100vw, 640px" />
                  <span className="ab-values__media-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                </div>
                <div className="ab-values__detail">
                  <h3>{current.title}</h3>
                  <p>{current.text}</p>
                  <ul>
                    {current.points.map((pt) => (
                      <li key={pt}>
                        <BadgeCheck size={16} aria-hidden="true" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AboutClient() {
  return (
    <div className="ch-home ch-about">
      {/* 1. Hero */}
      <AboutHero />

      {/* 2. Corridors marquee */}
      <LocationsMarquee />

      {/* 3. Origin story & milestone timeline */}
      <Journey />

      {/* 4. Principles (interactive tabs) */}
      <Values />

      {/* 5. Vision & mission */}
      <section className="ab-vm" aria-labelledby="ab-vm-title">
        <div className="ch-wrap">
          <div className="ab-vm__head">
            <Eyebrow className="ch-eyebrow--light">The Compounding Mandate</Eyebrow>
            <h2 id="ab-vm-title" className="ab-h2 ab-h2--light">
              Vision &amp; mission <span className="ch-accent">in harmony.</span>
            </h2>
          </div>

          <div className="ab-vm__grid">
            <Reveal className="ab-vm__col" delay={0.05}>
              <span className="ab-vm__label">
                <Compass size={16} aria-hidden="true" />
                Our vision
              </span>
              <p className="ab-vm__quote">
                To be the most trusted name in land transactions across Tamil Nadu.
              </p>
              <p className="ab-vm__text">
                A real estate ecosystem where every landowner steps onto their property with complete certainty, secured by
                bulletproof legal titles, strategic growth corridors and enduring appreciation.
              </p>
            </Reveal>

            <Reveal className="ab-vm__col" delay={0.15}>
              <span className="ab-vm__label">
                <Target size={16} aria-hidden="true" />
                Our mission
              </span>
              <p className="ab-vm__quote">Clear-title land, honest pricing, complete documentation.</p>
              <p className="ab-vm__text">
                Frictionless land ownership through strict legal due diligence, zero hidden surcharges, spot registration
                guidance and end-to-end patta transfer support for every client.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 6. Milestones in numbers */}
      <section className="ab-stats" aria-labelledby="ab-stats-title">
        <div className="ch-wrap">
          <div className="ab-stats__head">
            <Eyebrow>Proven Milestones</Eyebrow>
            <h2 id="ab-stats-title" className="ab-h2">
              A decade forged in <span className="ch-accent">concrete &amp; soil.</span>
            </h2>
          </div>
          <div className="ab-stats__grid">
            {STATS.map((s, idx) => (
              <Reveal key={s.label} delay={(idx % 3) * 0.08} className="ab-stat">
                <span className="ab-stat__num">
                  <CountUp to={s.value} suffix={s.suffix} />
                </span>
                <span className="ab-stat__label">{s.label}</span>
                <p className="ab-stat__desc">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7. 4-step legal verification (shared guarantee strip) */}
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

      {/* 8. Leadership perspective */}
      <section className="ab-lead" aria-labelledby="ab-lead-title">
        <div className="ch-wrap">
          <Reveal className="ab-lead__card" y={32}>
            <div className="ab-lead__photo">
              <Image
                src="/images/excellence-villa.jpg"
                alt="Crystal Estates management and land advisory"
                fill
                sizes="(max-width: 1023px) 100vw, 520px"
              />
              <span className="ab-lead__badge">
                <ShieldCheck size={14} aria-hidden="true" />
                Management &amp; title advisory
              </span>
            </div>

            <div className="ab-lead__content">
              <Quote size={40} className="ab-lead__mark" aria-hidden="true" />
              <h2 id="ab-lead-title" className="ch-sr">
                Management perspective
              </h2>
              <blockquote className="ab-lead__quote">
                Land is not merely an investment; it is the physical foundation upon which families build their future.
                Our promise as Assets Creators is simple: we never compromise on parent deeds, we never sell land we
                wouldn&apos;t proudly buy ourselves, and we stand beside every landowner from first site visit to final
                patta transfer.
              </blockquote>
              <div className="ab-lead__author">
                <span className="ab-lead__name">Ramesh Kumar &amp; Directors</span>
                <span className="ab-lead__role">Crystal Estates · Valasaravakkam, Chennai</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 9. Landowner voices */}
      <Voices />

      {/* 10. Consultation */}
      <Closing />
    </div>
  )
}
