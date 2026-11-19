'use client'

import React from 'react'
import { HelpCircle } from 'lucide-react'
import PageHeroHeader from '../../components/common/PageHeroHeader'
import FaqClientAccordion from '../../components/faq/FaqClientAccordion'
import { LocationsMarquee } from '../../components/home/Manifesto'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import '../../components/home/home.css'

export default function FaqClient() {
  return (
    <div className="ch-home ch-faq-page">
      <PageHeroHeader
        id="ch-faq-hero-title"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'FAQ' },
        ]}
        eyebrow="Buyer Knowledge Base · Assets Creator"
        titleSegments={[
          { text: 'Clear answers for' },
          { br: true },
          { text: 'confident buying.', className: 'ch-accent' },
        ]}
        lead="Transparent answers regarding land title verification, CMDA &amp; DTCP layout sanctions, sub-registrar registration, individual patta transfer, and guided site visits in Chennai."
        primaryCta={{
          label: 'Browse Questions',
          href: '#faq-content',
          variant: 'dark',
        }}
        secondaryCta={{
          label: 'Talk to an advisor',
          href: '/contact',
        }}
        stats={[
          { value: 100, suffix: '%', label: 'Patta Compliance' },
          { value: 30, suffix: '+', label: 'Years Title Audit' },
          { value: 0, suffix: '%', label: 'Hidden Brokerage' },
        ]}
        mainImage={{
          src: '/images/somamangalam.jpg',
          alt: 'Crystal Estates plot documentation scrutiny',
        }}
        subImage={{
          src: '/images/vedanthangal.jpg',
          alt: 'Physical layout boundary stones',
        }}
        chip={{
          icon: HelpCircle,
          text: 'Verified Land Buying Answers',
        }}
        sealText="ASSETS CREATOR · SINCE 2014 · CHENNAI ·"
      />

      <LocationsMarquee />

      <div id="faq-content">
        <FaqClientAccordion />
      </div>

      <Voices />
      <Closing />
    </div>
  )
}
