import React from 'react'
import {
  DollarSign,
  ShieldCheck,
  Users,
  FileCheck2,
} from 'lucide-react'
import { PageHero } from '../../components/ui'
import SellLandFormClient from '../../components/forms/SellLandFormClient'
import TestimonialsSection from '../../components/TestimonialsSection'

export const metadata = {
  title: 'Sell Your Land in Chennai | Direct Land Acquisition | Crystal Estates',
  description:
    'Sell your land or residential plots through Crystal Estates. Direct buyer matching, transparent valuation, clear-title due diligence, and spot registration in Chennai & Kanchipuram.',
  openGraph: {
    title: 'Sell Your Land in Chennai | Crystal Estates',
    description:
      'Sell your land or plots through Crystal Estates. Direct buyer matching, fair valuation, and spot registration.',
    url: 'https://crystalestates.in/sell-your-land',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Sell Your Land Crystal Estates',
      },
    ],
  },
}

const benefits = [
  {
    icon: Users,
    title: 'Access to 2,000+ Verified Buyers',
    desc: 'Connect directly with pre-screened families, NRI investors, and corporate land purchasers ready for immediate transactions.',
  },
  {
    icon: DollarSign,
    title: 'Accurate Market Valuation',
    desc: 'We assess genuine market pricing derived from recent sub-registrar registered deeds rather than speculative estimates.',
  },
  {
    icon: ShieldCheck,
    title: 'Free Title & Revenue Audit',
    desc: 'Our legal and revenue experts review your parent deeds, survey records, and patta to prepare a clean, marketable document dossier.',
  },
  {
    icon: FileCheck2,
    title: 'Zero Distress, Total Transparency',
    desc: 'You maintain full control of terms with clear brokerage agreements, guaranteed milestone escrow safety, and zero hidden deductions.',
  },
]

const steps = [
  { num: '01', title: 'Submit Property Details', desc: 'Share your land location, survey number, extent, and available documentation online or via phone.' },
  { num: '02', title: 'Inspection & Due Diligence', desc: 'Our technical team conducts a discreet physical site survey and verifies revenue records.' },
  { num: '03', title: 'Pricing & Exclusive Marketing', desc: 'We align on a realistic target price and showcase your land to our qualified buyer base.' },
  { num: '04', title: 'Agreement & Registration', desc: 'Receive advance token, execute the formal sale agreement, and complete closing at the Sub-Registrar Office.' },
]

export default function SellYourLandPage() {
  return (
    <main>
      <PageHero
        title="Sell Your Land with Confidence"
        subtitle="ASSETS CREATOR — Partner with Chennai's trusted land specialists for transparent valuation, rapid buyer matching, and hassle-free registration."
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Sell Your Land' },
        ]}
      />

      {/* Benefits */}
      <section className="split-sec split-sec--white">
        <div className="split-sec__grid">
          <aside className="split-sec__aside">
            <span className="featured-showcase-sidebar__badge">For Landowners</span>
            <h2 className="featured-showcase-sidebar__title">Why Sell Through Crystal Estates?</h2>
            <p className="featured-showcase-sidebar__subtitle">
              Total safety, fair valuation, and end-to-end documentation assistance for every landowner.
            </p>
          </aside>
          <div className="split-sec__content split-sec__cards">
            {benefits.map((b) => {
              const Icon = b.icon
              return (
                <article key={b.title} className="split-card">
                  <span className="split-card__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3 className="split-card__title">{b.title}</h3>
                  <p className="split-card__text">{b.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4-Step Process */}
      <section className="split-sec split-sec--soft">
        <div className="split-sec__grid">
          <aside className="split-sec__aside">
            <span className="featured-showcase-sidebar__badge">The Selling Process</span>
            <h2 className="featured-showcase-sidebar__title">Our 4-Step Selling Process</h2>
            <p className="featured-showcase-sidebar__subtitle">
              Transparent, structured, and fast-track closure for landowners.
            </p>
          </aside>
          <ol className="split-sec__content split-sec__cards">
            {steps.map((st) => (
              <li key={st.num} className="split-card">
                <span className="split-card__num">{st.num}</span>
                <h3 className="split-card__title">{st.title}</h3>
                <p className="split-card__text">{st.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Landowner Intake Form */}
      <section className="split-sec split-sec--white" id="assessment">
        <div className="split-sec__grid">
          <aside className="split-sec__aside">
            <span className="featured-showcase-sidebar__badge">Free Assessment</span>
            <h2 className="featured-showcase-sidebar__title">Submit Your Property for Assessment</h2>
            <p className="featured-showcase-sidebar__subtitle">
              Share your land specifications to schedule an evaluation with our acquisitions team.
            </p>
          </aside>
          <div className="split-sec__content">
            <SellLandFormClient />
          </div>
        </div>
      </section>

      <TestimonialsSection
        title="Verified Landowner Experiences"
        subtitle="Trusted by landowners, agriculturalists, and families across Chennai and Kanchipuram."
      />
    </main>
  )
}
