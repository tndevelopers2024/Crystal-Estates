import AboutClient from './AboutClient'

export const metadata = {
  title: 'About Crystal Estates | Land & Plot Asset Creators in Chennai',
  description:
    'Learn about Crystal Estates, Chennai’s trusted land sales specialist. Over a decade of verified clear-titled land transactions, DTCP & CMDA approvals, and generational agro-forestry investments across Chennai.',
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
  return <AboutClient />
}
