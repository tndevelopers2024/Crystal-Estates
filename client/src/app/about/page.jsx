import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Target, Compass, ArrowUpRight, ShieldCheck } from 'lucide-react'
import StatsBar from '../../components/sections/StatsBar'
import TestimonialsSection from '../../components/TestimonialsSection'

export const metadata = {
  title: 'About Crystal Estates | Land & Plot Asset Creators in Chennai',
  description:
    'Learn about Crystal Estates, Chennai’s trusted land sales specialist. Our vision: To be the most trusted name in land transactions in Tamil Nadu. Our mission: Clear-title land, honest pricing, complete documentation.',
  openGraph: {
    title: 'About Crystal Estates | Land & Plot Asset Creators in Chennai',
    description:
      'Learn about Crystal Estates, Chennai’s trusted land sales specialist. Vision: To be the most trusted name in land transactions in Tamil Nadu.',
    url: 'https://crystalestates.in/about',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'About Crystal Estates Chennai',
      },
    ],
  },
}

export default function AboutPage() {
  return (
    <main className="about-page-wrapper">
      {/* 1. Modern Minimalist Hero matching reference image */}
      <section className="about-hero-section">
        <div className="about-hero-container">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="about-hero__breadcrumb">
            <Link href="/">Home</Link>
            <span className="about-hero__breadcrumb-sep">/</span>
            <span className="about-hero__breadcrumb-current">About Us</span>
          </nav>

          {/* Large Editorial Heading & Subtitle */}
          <div className="about-hero__header">
            <h1 className="about-hero__title">
              About Crystal Estates
            </h1>
            <p className="about-hero__subtitle">
              ASSETS CREATOR — Over a decade of verified clear-titled land transactions, DTCP/CMDA approvals, and generational agro-forestry investments across Chennai.
            </p>
            <Link href="/projects" className="about-hero__cta">
              <span>Explore Projects</span>
              <span className="about-hero__cta-arrow" aria-hidden="true">
                <ArrowUpRight size={16} />
              </span>
            </Link>
          </div>

          {/* Wide Hero Image matching reference architectural banner */}
          <div className="about-hero__image-wrap">
            <Image
              src="/images/hero-estate.jpg"
              alt="Crystal Estates Land & Property"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1360px"
              className="about-hero__image"
            />
          </div>
        </div>
      </section>

      {/* 2. Split Purpose Section matching reference layout (Left: Story & Architecture Image, Right: Feature Cards) */}
      <section className="about-purpose-section">
        <div className="about-purpose-container">
          <div className="about-purpose-grid">
            {/* Left Column: Purpose Story & Architectural Image Card */}
            <div className="about-purpose-left">
              <h2 className="about-purpose__title">
                The Assets Creator Story
              </h2>
              <p className="about-purpose__lead">
                Bridging the gap between discerning land buyers and 100% legally transparent plots and farmland across Tamil Nadu.
              </p>
              <p className="about-purpose__text">
                Established with an uncompromising ethos of transparency, <strong>Crystal Estates</strong> operates with a singular focus: <em>land and plot sales only</em>. In an industry often clouded by ambiguous titles, unverified layouts, and hidden fees, we set out to build a safe haven for family investors, NRI buyers, and agricultural land stewards.
              </p>
              <p className="about-purpose__text">
                Headquartered in Valasaravakkam, Chennai, we curate premium residential plotted developments approved by CMDA and DTCP, alongside flagship managed sandalwood farm lands near Vedanthangal. Every piece of land we offer is preceded by rigorous legal vetting, revenue record verification, individual patta, and physical demarcation stones.
              </p>

              {/* Lower Architecture Image Card matching reference bottom-left image */}
              <div className="about-purpose__image-card">
                <Image
                  src="/images/somamangalam.jpg"
                  alt="Crystal Estates Prime Corridors"
                  fill
                  sizes="(max-width: 1024px) 100vw, 650px"
                  className="about-purpose__image"
                />
              </div>
            </div>

            {/* Right Column: Stack of Rounded Feature Cards */}
            <div className="about-purpose-right">
              {/* Vision Card */}
              <div className="about-feature-card">
                <div className="about-feature-card__icon" aria-hidden="true">
                  <Compass size={22} />
                </div>
                <span className="about-feature-card__badge">
                  Our Vision
                </span>
                <h3 className="about-feature-card__title">
                  &ldquo;To be the most trusted name in land transactions in Tamil Nadu.&rdquo;
                </h3>
                <p className="about-feature-card__text">
                  We envision a future where every landowner steps onto their property with complete certainty, knowing their asset is secured by bulletproof legal titles, strategic growth locations, and enduring generational value.
                </p>
              </div>

              {/* Mission Card */}
              <div className="about-feature-card">
                <div className="about-feature-card__icon" aria-hidden="true">
                  <Target size={22} />
                </div>
                <span className="about-feature-card__badge">
                  Our Mission
                </span>
                <h3 className="about-feature-card__title">
                  &ldquo;Clear-title land, honest pricing, complete documentation.&rdquo;
                </h3>
                <p className="about-feature-card__text">
                  We dedicate our expertise to providing frictionless land ownership through strict legal due diligence, zero hidden surcharges, spot registration guidance, and end-to-end patta transfer support for every client.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Leadership Perspective Section */}
      <section className="about-leadership-section">
        <div className="about-leadership-container">
          <div className="about-leadership-card">
            <div className="about-leadership__photo-wrap">
              <div className="about-leadership__photo-box">
                <Image
                  src="/images/vedanthangal.jpg"
                  alt="Crystal Estates Management"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="about-leadership__photo-badge">
                <ShieldCheck size={14} className="about-leadership__photo-badge-icon" />
                <span>MANAGEMENT &amp; TITLE ADVISORY</span>
              </div>
            </div>

            <div>
              <span className="about-leadership__tag">
                MANAGEMENT MESSAGE
              </span>
              <h3 className="about-leadership__headline">
                Building Generational Security on Clear Soil
              </h3>
              <blockquote className="about-leadership__quote">
                &ldquo;Land is not merely an investment; it is the physical foundation upon which families build their future and pass down wealth. At Crystal Estates, our promise as ASSETS CREATORS is simple: we never compromise on parent deeds, we never sell land we wouldn’t proudly buy ourselves, and we stand beside every landowner from first site visit to the final patta transfer.&rdquo;
              </blockquote>
              <div className="about-leadership__author-box">
                <div className="about-leadership__author-name">
                  Ramesh Kumar &amp; Directors
                </div>
                <div className="about-leadership__author-sub">
                  Crystal Estates — Chennai, Tamil Nadu
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. StatsBar */}
      <StatsBar />

      {/* 5. TestimonialsSection */}
      <TestimonialsSection
        title="What Our Landowners Say"
        subtitle="Verified experiences from families and investors who have built lasting land assets with Crystal Estates across Chennai & Kanchipuram."
      />
    </main>
  )
}
