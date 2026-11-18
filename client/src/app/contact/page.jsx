import React from 'react'
import ContactClient from './ContactClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Contact Crystal Estates | Land Advisors in Valasaravakkam, Chennai',
  description:
    'Contact Crystal Estates at No. 9, A.K.R. Nagar Main Road, Crystal Tower, Valasaravakkam, Chennai. Call +91 94440 00000 or WhatsApp for verified plots and farm land.',
  openGraph: {
    title: 'Contact Crystal Estates | Chennai Land Specialists',
    description:
      'Visit our office at Valasaravakkam, Chennai or book a free weekend site visit for plots and farmland.',
    url: 'https://crystalestates.in/contact',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Contact Crystal Estates',
      },
    ],
  },
}

export default function ContactPage() {
  return <ContactClient />
}
