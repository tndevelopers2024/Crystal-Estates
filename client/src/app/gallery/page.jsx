import React from 'react'
import GalleryClient from './GalleryClient'
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
  return <GalleryClient initialPlots={plots || []} />
}
