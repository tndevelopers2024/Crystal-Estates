import React from 'react'
import Link from 'next/link'
import GalleryClientView from '../../components/gallery/GalleryClientView'
import TestimonialsSection from '../../components/TestimonialsSection'
import { fetchPlots } from '../../lib/api'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Project Gallery | Site Photos & Layouts | Crystal Estates Chennai',
  description:
    'Visual project gallery of Crystal Estates: on-ground site photographs, drone aerial panoramas, approved master layout plans, and guided walkthrough videos across Chennai & Kanchipuram.',
  openGraph: {
    title: 'Project Gallery | Site Photos & Layouts | Crystal Estates',
    description:
      'On-ground site photographs, drone views, and approved layout plans across Chennai.',
    url: 'https://crystalestates.in/gallery',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Crystal Estates Gallery',
      },
    ],
  },
}

export default async function GalleryPage() {
  const plots = await fetchPlots()

  return (
    <main style={{ backgroundColor: 'var(--bg, #F7F3EA)', minHeight: '100vh', paddingTop: 'clamp(24px, 3vw, 40px)' }}>
      {/* Subtle Breadcrumb */}
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 clamp(16px, 4vw, 40px)', marginBottom: '8px' }}>
        <nav aria-label="Breadcrumb" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '500', color: '#71717A' }}>
          <Link href="/" style={{ color: '#71717A', textDecoration: 'none' }}>Home</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#18181B', fontWeight: '600' }}>Gallery</span>
        </nav>
      </div>

      {/* Redesigned Gallery Section matching Reference Design & Dynamic CMS Data */}
      <GalleryClientView
        initialPlots={plots}
        title="Photo Gallery"
        badge="Our Gallery"
        subtitle="Captured moments from our on-ground sites, aerial drone panoramas, approved layouts, and guided walkthrough tours across Chennai."
      />

      {/* Testimonials */}
      <TestimonialsSection
        title="Verified Landowner Confidence"
        subtitle="Every plot in our gallery is supported by clear titles, DTCP/CMDA approvals, and satisfied buyers."
      />
    </main>
  )
}
