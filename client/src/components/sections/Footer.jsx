'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MapPin, Phone, Mail, Clock, ArrowUpRight, ArrowUp, ArrowRight } from 'lucide-react'
import { WhatsAppIcon } from '../ui'
import { business, socialLinks } from '../../data/site'
import { mainNav } from '../../config/navigation'
import './Footer.css'

const SERVICES = [
  { label: 'Residential plots', href: '/services' },
  { label: 'Farm & sandalwood land', href: '/services' },
  { label: 'Land purchase & resale', href: '/services' },
  { label: 'Land brokerage', href: '/services' },
  { label: 'Sell your land', href: '/sell-your-land' },
  { label: 'FAQ & buying process', href: '/faq' },
]

const whatsappUrl = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
  "Hi Crystal Estates, I'm interested in purchasing land or residential plots in Chennai."
)}`
const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(business.mapQuery)}`

export default function Footer() {
  const pathname = usePathname()

  // The full-page layout viewer renders without the global footer.
  if (pathname?.startsWith('/layout-viewer')) return null

  const openSiteVisit = () => window.dispatchEvent(new CustomEvent('open-site-visit'))
  const scrollToTop = () => {
    if (window.__lenis) window.__lenis.scrollTo(0)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="cf">
      <div className="cf__panel">
        {/* Call to action */}
        <div className="cf__cta">
          <div>
            <span className="cf__eyebrow">
              <span className="cf__dot" aria-hidden="true" /> Weekend site visits · Free pick-up
            </span>
            <p className="cf__cta-title">
              Let&apos;s find <span className="cf__accent">your land.</span>
            </p>
          </div>
          <div className="cf__cta-actions">
            <button type="button" className="cf__pill cf__pill--cream" onClick={openSiteVisit}>
              Book a site visit
              <span className="cf__pill-icon" aria-hidden="true">
                <ArrowRight size={16} />
              </span>
            </button>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="cf__pill cf__pill--ghost">
              <WhatsAppIcon size={17} />
              WhatsApp us
            </a>
          </div>
        </div>

        {/* Columns */}
        <div className="cf__grid">
          <div className="cf__brand">
            <Link href="/" className="cf__logo" aria-label="Crystal Estates home">
              <Image src="/logo-white.png" alt="Crystal Estates" width={164} height={56} />
              <span>ASSETS CREATOR</span>
            </Link>
            <p>
              Chennai&apos;s land and plot asset creator: CMDA &amp; DTCP approved plots, managed
              sandalwood farm land and clear-titled acreage, all 100% legally verified.
            </p>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="cf__address">
              <MapPin size={16} aria-hidden="true" />
              <address>
                {business.address.line1}, {business.address.line2}, {business.address.city}
              </address>
              <ArrowUpRight size={14} className="cf__address-go" aria-hidden="true" />
            </a>
          </div>

          <nav className="cf__col" aria-label="Footer">
            <h3>Explore</h3>
            <ul>
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="cf__link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="cf__col">
            <h3>Services</h3>
            <ul>
              {SERVICES.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="cf__link">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="cf__col">
            <h3>Contact</h3>
            <ul className="cf__contact">
              <li>
                <Phone size={15} aria-hidden="true" />
                <a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a>
              </li>
              <li>
                <Mail size={15} aria-hidden="true" />
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </li>
              <li>
                <Clock size={15} aria-hidden="true" />
                <span>{business.hours}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Wordmark */}
        <p className="cf__wordmark" aria-hidden="true">
          Crystal Estates
        </p>

        {/* Bottom bar */}
        <div className="cf__bottom">
          <p className="cf__copy">
            &copy; {new Date().getFullYear()} Crystal Estates · Assets Creator. All rights reserved.
          </p>
          <ul className="cf__social">
            {socialLinks.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <button type="button" className="cf__top" onClick={scrollToTop} aria-label="Back to top">
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="cf__disclaimer">{business.disclaimer}</p>
      </div>
    </footer>
  )
}
