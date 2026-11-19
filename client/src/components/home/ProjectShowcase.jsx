'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, MapPin, Layers } from 'lucide-react'
import { Eyebrow, PillLink, EASE } from './motion'
import { formatArea } from '../../lib/api'

// Used only when the plots API is unreachable
const FALLBACK = [
  { slug: 'kolapakkam', name: 'Kolapakkam', location: 'Kolapakkam, Chennai', type: 'Residential', approval: 'CMDA Approved', image: '/images/kolapakkam.jpg' },
  { slug: 'somamangalam', name: 'Somamangalam', location: 'Somamangalam, Kanchipuram', type: 'Residential', approval: 'DTCP Approved', image: '/images/somamangalam.jpg' },
  { slug: 'brammadesam', name: 'Brammadesam', location: 'Brammadesam, Kanchipuram', type: 'Residential', approval: 'DTCP Approved', image: '/images/brammadesam.jpg' },
]

const titleCase = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** Normalise a plot/project record into what a showcase card needs. */
export function toProjectCard(p) {
  const plots = Array.isArray(p.plots) ? p.plots : []
  const available = plots.filter((x) => String(x.status || '').toLowerCase() === 'available').length
  const image =
    p.coverImage ||
    p.image ||
    (Array.isArray(p.images) && p.images.find((i) => i && !/layout|preview/i.test(i))) ||
    '/images/hero-estate.jpg'
  return {
    key: String(p.id || p.slug || p.name),
    href: p.href || `/projects/${p.slug || p.id}`,
    name: titleCase(p.name || p.projectName || 'Crystal Estates Property'),
    location: String(p.location || 'Chennai').split(',').slice(0, 2).join(','),
    type: p.type || p.propertyType || 'Residential',
    approval: p.approval || p.approvalStatus || '',
    area: formatArea(p),
    status: p.status || 'Available',
    total: plots.length,
    available,
    image,
  }
}

function ProjectTile({ card, index, featured }) {
  const reduce = useReducedMotion()
  const sold = String(card.status).toLowerCase().includes('sold')
  return (
    <motion.li
      className={`ps-card ${featured ? 'ps-card--featured' : ''}`}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.7, ease: EASE, delay: (index % 3) * 0.08 }}
    >
      <Link href={card.href} className="ps-card__link" aria-label={`View ${card.name} project details`}>
        <span className="ps-card__media">
          <Image
            src={card.image}
            alt=""
            fill
            sizes={featured ? '(max-width: 1023px) 100vw, 66vw' : '(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 33vw'}
            className="ps-card__img"
          />
          <span className="ps-card__shade" aria-hidden="true" />
          <span className={`ps-card__status ${sold ? 'is-sold' : ''}`}>
            <span className="ps-card__dot" aria-hidden="true" />
            {card.status}
          </span>
          <span className="ps-card__arrow" aria-hidden="true">
            <ArrowUpRight size={18} />
          </span>
        </span>

        <span className="ps-card__body">
          <span className="ps-card__name">{card.name}</span>
          <span className="ps-card__loc">
            <MapPin size={14} aria-hidden="true" />
            {card.location}
          </span>
          <span className="ps-card__tags">
            <span>{card.type}</span>
            {card.approval && <span>{card.approval}</span>}
            {card.total > 0 && (
              <span className="ps-card__stock">
                <Layers size={13} aria-hidden="true" />
                {card.available} of {card.total} plots left
              </span>
            )}
          </span>
        </span>
      </Link>
    </motion.li>
  )
}

/**
 * Image-led project grid placed right after the homepage hero so visitors
 * can jump straight into any project.
 */
export default function ProjectShowcase({ projects = [], limit = 6 }) {
  const source = projects.length > 0 ? projects : FALLBACK.map((f) => ({ ...f, href: '/projects' }))
  const cards = source.slice(0, limit).map(toProjectCard)

  return (
    <section className="ps" aria-labelledby="ps-title">
      <div className="ch-wrap">
        <div className="ps__head">
          <div>
            <Eyebrow>Our projects</Eyebrow>
            <h2 id="ps-title" className="ps__title">
              Explore approved <span className="ch-accent">plots &amp; farmland.</span>
            </h2>
          </div>
          <PillLink href="/projects" variant="dark" className="ps__all">
            View all projects
          </PillLink>
        </div>

        <ul className="ps__grid">
          {cards.map((card, i) => (
            <ProjectTile key={card.key} card={card} index={i} featured={i === 0 && cards.length > 2} />
          ))}
        </ul>
      </div>
    </section>
  )
}
