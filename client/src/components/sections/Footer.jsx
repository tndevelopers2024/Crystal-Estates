'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MapPin, Phone, Mail, ArrowUp, ArrowUpRight } from 'lucide-react'
import { business, socialLinks } from '../../data/site'
import FooterScene from '../footer/FooterScene'
import SocialIcon from '../footer/SocialIcon'
import './Footer.css'

const COMPANY = [
  { label: 'About Us', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'News & Insights', href: '/news' },
]

const QUICK_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'All Projects', href: '/projects' },
  { label: 'Sell Your Land', href: '/sell-your-land' },
  { label: 'FAQ', href: '/faq' },
]

// Shown until (or if) the live project list can't be loaded
const FALLBACK_PROJECTS = [
  { label: 'Kolapakkam', href: '/projects/kolapakkam' },
  { label: 'Somamangalam', href: '/projects/somamangalam' },
  { label: 'Brammadesam', href: '/projects/brammadesam' },
  { label: 'Jambodai', href: '/projects/jambodai' },
]

const titleCase = (s) => String(s || '').replace(/_/g, ' ').trim().replace(/\b[a-z]/g, (c) => c.toUpperCase())

const whatsappUrl = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
  "Hi Crystal Estates, I'm interested in purchasing land or residential plots in Chennai.",
)}`
const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(business.mapQuery)}`

function FooterColumn({ title, links }) {
  return (
    <nav className="sf-col" aria-label={title}>
      <h3 className="sf-col__title">{title}</h3>
      <ul>
        {links.map((l) => (
          <li key={`${l.label}-${l.href}`}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer" className="sf-link">
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="sf-link">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function Footer() {
  const pathname = usePathname()
  const [projects, setProjects] = useState(FALLBACK_PROJECTS)

  useEffect(() => {
    let active = true
    fetch('/api/plots')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = Array.isArray(data?.plots) ? data.plots : []
        if (!active || list.length === 0) return
        setProjects(
          list.slice(0, 5).map((p) => ({ label: titleCase(p.name || p.projectName), href: `/projects/${p.slug || p.id}` })),
        )
      })
      .catch(() => { })
    return () => {
      active = false
    }
  }, [])

  // The full-page layout viewer renders without the global footer.
  if (pathname?.startsWith('/layout-viewer') || /^\/projects\/[^/]+\/3d(\/|$)/.test(pathname || '')) return null

  const scrollToTop = () => {
    if (window.__lenis) window.__lenis.scrollTo(0)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const support = [
    { label: 'Contact Us', href: '/contact' },
    { label: business.phone, href: `tel:${business.phone.replace(/\s/g, '')}`, external: true },
    { label: 'WhatsApp', href: whatsappUrl, external: true },
    { label: 'Visit our office', href: mapsUrl, external: true },
  ]

  const socials = [...socialLinks, { label: 'WhatsApp', href: whatsappUrl }]

  return (
    <footer className="sf">
      <div className="sf__top">
        <div className="sf-brand">
          <Link href="/" className="sf-brand__logo" aria-label="Crystal Estates home">
            <Image src="/logo.png" alt="Crystal Estates" width={168} height={58} />
          </Link>
          <p className="sf-brand__tag">{business.tagline}</p>
          <p className="sf-brand__text">
            Clear-titled residential plots and managed farmland across Chennai, with every title verified before it
            reaches you.
          </p>
          <ul className="sf-brand__contact">
            <li>
              <Mail size={15} aria-hidden="true" />
              <a href={`mailto:${business.email}`}>{business.email}</a>
            </li>
            <li>
              <Phone size={15} aria-hidden="true" />
              <a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a>
            </li>
            <li>
              <MapPin size={15} aria-hidden="true" />
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                Valasaravakkam, Chennai
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>

        <div className="sf__cols">
          <FooterColumn title="Company" links={COMPANY} />
          <FooterColumn title="Quick Links" links={QUICK_LINKS} />
          <FooterColumn title="Projects" links={projects} />
          <FooterColumn title="Support" links={support} />
        </div>
      </div>

      <div className="sf__scene">
        <p className="sf__wordmark" aria-hidden="true">
          Crystal Estates
        </p>
        <FooterScene className="sf__plotscape" />

        <div className="sf__bar">
          <p className="sf__copy">
            &copy; {new Date().getFullYear()} {business.name}. All rights reserved.
          </p>
          <div className="sf__bar-right">
            <ul className="sf__social" aria-label="Social media">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}>
                    <SocialIcon name={s.label} size={16} />
                  </a>
                </li>
              ))}
            </ul>
            <button type="button" className="sf__top-btn" onClick={scrollToTop} aria-label="Back to top">
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
