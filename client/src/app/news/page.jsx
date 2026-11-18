import React from 'react'
import NewsClient from './NewsClient'
import { newsArticles } from '../../data/news'

export const dynamic = 'force-dynamic'

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
  return <NewsClient initialArticles={newsArticles || []} />
}
