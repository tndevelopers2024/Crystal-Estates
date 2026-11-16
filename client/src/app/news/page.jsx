import React from 'react'
import NewsClientView from '../../components/news/NewsClientView'
import TestimonialsSection from '../../components/TestimonialsSection'
import { newsArticles } from '../../data/news'

export const metadata = {
  title: 'News & Updates | Land Investment Insights | Crystal Estates',
  description:
    'Stay updated with Chennai real estate regulations, CMDA and DTCP approvals, patta guidelines, and managed sandalwood farm land insights from Crystal Estates.',
  openGraph: {
    title: 'News & Updates | Crystal Estates Chennai',
    description:
      'Chennai real estate regulations, CMDA & DTCP approvals, and land investment insights.',
    url: 'https://crystalestates.in/news',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Crystal Estates News & Updates',
      },
    ],
  },
}

export default function NewsPage() {
  return (
    <main className="modern-news-page">
      <NewsClientView articles={newsArticles} />

      <div style={{ marginTop: 'clamp(48px, 6vw, 84px)' }}>
        <TestimonialsSection
          title="Trusted Land Advice"
          subtitle="Transparent insights and authentic buyer satisfaction have made Crystal Estates Chennai’s premier land asset creator."
        />
      </div>
    </main>
  )
}
