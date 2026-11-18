import ServicesClient from './ServicesClient'

export const metadata = {
  title: 'Land Services in Chennai | Direct Sales, Resale & Brokerage | Crystal Estates',
  description:
    'Explore Crystal Estates land solutions: Direct sales of CMDA/DTCP approved plots and managed sandalwood farmland, land purchase & resale, and transparent land brokerage.',
  openGraph: {
    title: 'Land Services in Chennai | Crystal Estates',
    description:
      'Direct sales of approved plots and managed sandalwood farmland, land purchase & resale, and land brokerage.',
    url: 'https://crystalestates.in/services',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Crystal Estates Services',
      },
    ],
  },
}

export default function ServicesPage() {
  return <ServicesClient />
}
