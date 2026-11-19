import React from 'react'
import SellYourLandClient from './SellYourLandClient'

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

export default function SellYourLandPage() {
  return <SellYourLandClient />
}
