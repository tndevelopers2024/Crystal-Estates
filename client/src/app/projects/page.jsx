import React from 'react'
import Link from 'next/link'
import { ShieldCheck, BadgeCheck, FileCheck, Car, Compass } from 'lucide-react'
import ProjectsClientView from '../../components/projects/ProjectsClientView'
import TestimonialsSection from '../../components/TestimonialsSection'
import { fetchPlots } from '../../lib/api'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Plots & Land Projects in Chennai | Crystal Estates',
  description:
    'Explore verified residential plots, agricultural lands, and bulk land opportunities across Chennai and Kanchipuram. DTCP and CMDA approved layouts with 100% clear titles.',
  openGraph: {
    title: 'Plots & Land Projects in Chennai | Crystal Estates',
    description:
      'Explore verified residential plots, agricultural lands, and bulk land opportunities across Chennai. DTCP and CMDA approved layouts with 100% clear titles.',
    url: 'https://crystalestates.in/projects',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Plots and Land in Chennai',
      },
    ],
  },
}

export default async function ProjectsPage() {
  const plots = await fetchPlots()

  return (
    <main className="modern-projects-page">
      {/* 1. Modern Minimalist Editorial Header matching redesigned site */}
      <section className="modern-projects-hero">
        <div className="modern-projects-container">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="modern-projects-breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span className="modern-projects-breadcrumb__active">Projects</span>
          </nav>

          {/* Editorial Title & Subtitle */}
          <div className="modern-projects-header">
            <div className="modern-projects-badge">
              <Compass size={14} className="modern-projects-badge__icon" />
              <span>Verified Land &amp; Plot Portfolio</span>
            </div>
            <h1 className="modern-projects-title">
              Our Land &amp; Plot Projects
            </h1>
            <p className="modern-projects-subtitle">
              CMDA &amp; DTCP approved residential layouts, managed agro-forestry farmland, and high-growth investment parcels across prime Chennai and Kanchipuram corridors.
            </p>
          </div>

          {/* Quick Trust Pillars Banner */}
          <div className="modern-projects-trust-row">
            <div className="modern-projects-trust-item">
              <ShieldCheck size={16} className="modern-projects-trust-icon" />
              <span>100% Clear Title &amp; Patta Assured</span>
            </div>
            <div className="modern-projects-trust-item">
              <BadgeCheck size={16} className="modern-projects-trust-icon" />
              <span>DTCP &amp; CMDA Approved Layouts</span>
            </div>
            <div className="modern-projects-trust-item">
              <FileCheck size={16} className="modern-projects-trust-icon" />
              <span>Spot Sub-Registrar Guidance</span>
            </div>
            <div className="modern-projects-trust-item">
              <Car size={16} className="modern-projects-trust-icon" />
              <span>Complimentary Site Visit Cabs</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Filter Bar & News-Style Projects Grid */}
      <ProjectsClientView initialProjects={plots || []} />

      {/* 3. Verified Landowner Testimonials Section */}
      <TestimonialsSection
        title="What Landowners Say"
        subtitle="Authentic reviews from families and investors who secured their plots and farmland through Crystal Estates."
      />
    </main>
  )
}
