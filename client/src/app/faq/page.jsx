import React from 'react'
import FaqClient from './FaqClient'

export const metadata = {
  title: 'Frequently Asked Questions (FAQ) | Crystal Estates Chennai',
  description:
    'Answers to questions about buying land in Chennai: DTCP & CMDA approvals, clear patta titles, 30-year EC verification, spot registration, and sandalwood farm land management.',
  openGraph: {
    title: 'Frequently Asked Questions | Crystal Estates Chennai',
    description:
      'Clear answers to questions about buying land, approvals, registration, and documentation in Chennai.',
    url: 'https://crystalestates.in/faq',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Crystal Estates FAQ',
      },
    ],
  },
}

export default function FaqPage() {
  return <FaqClient />
}
