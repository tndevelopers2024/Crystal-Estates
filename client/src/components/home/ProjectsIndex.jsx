'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { WordsPullUpMultiStyle, Eyebrow, PillLink, EASE, openSiteVisit } from './motion'
import { formatArea } from '../../lib/api'

// Shown only when the plots API is unreachable. Mirrors the approved layouts named across the site.
const FALLBACK = [
  { slug: 'kolapakkam', name: 'Kolapakkam', location: 'Kolapakkam, Chennai', type: 'Residential Plot', approval: 'CMDA Approved', image: '/images/kolapakkam.jpg' },
  { slug: 'somamangalam', name: 'Somamangalam', location: 'Somamangalam, Kanchipuram', type: 'Residential Plot', approval: 'DTCP Approved', image: '/images/somamangalam.jpg' },
  { slug: 'brammadesam', name: 'Brammadesam', location: 'Brammadesam, Kanchipuram', type: 'Residential Plot', approval: 'DTCP Approved', image: '/images/brammadesam.jpg' },
  { slug: 'ozhalai-panchayath', name: 'Ozhalai Panchayath', location: 'Ozhalai, Chengalpattu', type: 'Residential Plot', approval: 'RERA Registered', image: '/images/ozhalai-panchayath.jpg' },
  { slug: 'vedanthangal', name: 'Vedanthangal Sandalwood Farm', location: 'Vedanthangal, Chengalpattu', type: 'Farm Land', approval: '15 Acres · Managed', image: '/images/vedanthangal.jpg' },
]

function toRow(p) {
  const name = String(p.name || p.projectName || 'Crystal Estates Property')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
  const image = p.image || (Array.isArray(p.images) && p.images[0]) || '/images/hero-estate.jpg'
  return {
    key: String(p.id || p.slug || name),
    href: p.href || `/projects/${p.slug || p.id}`,
    name,
    location: String(p.location || 'Chennai').split(',').slice(0, 2).join(','),
    type: p.type || p.propertyType || 'Residential Plot',
    meta: p.approval || formatArea(p),
    status: p.status || 'Available',
    image,
  }
}

export default function ProjectsIndex({ projects = [] }) {
  const reduce = useReducedMotion()
  const source = projects.length > 0 ? projects : FALLBACK.map((f) => ({ ...f, href: '/projects' }))
  const rows = source.slice(0, 6).map(toRow)
  const [active, setActive] = useState(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 180, damping: 22, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 180, damping: 22, mass: 0.4 })

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - rect.left)
    y.set(e.clientY - rect.top)
  }

  const current = rows.find((r) => r.key === active)

  return (
    <section className="ch-projects" aria-labelledby="ch-projects-title">
      <div className="ch-wrap">
        <div className="ch-projects__head">
          <div>
            <Eyebrow>Featured projects</Eyebrow>
            <h2 id="ch-projects-title" className="ch-h2">
              <WordsPullUpMultiStyle
                segments={[{ text: 'Land worth' }, { text: 'owning.', className: 'ch-accent' }]}
              />
            </h2>
          </div>
          <p className="ch-projects__lede">
            CMDA &amp; DTCP approved plots and managed sandalwood farm land across prime Chennai
            corridors. Hover a project to preview it.
          </p>
        </div>

        <div
          className="ch-projects__list"
          onMouseMove={handleMove}
          onMouseLeave={() => setActive(null)}
        >
          {rows.map((r, i) => (
            <motion.div
              key={r.key}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -8% 0px' }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
            >
              <Link
                href={r.href}
                className={`ch-projects__row ${active && active !== r.key ? 'is-dim' : ''}`}
                onMouseEnter={() => setActive(r.key)}
                onFocus={() => setActive(r.key)}
                onBlur={() => setActive(null)}
              >
                <span className="ch-projects__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="ch-projects__thumb">
                  <Image src={r.image} alt="" fill sizes="96px" />
                </span>
                <span className="ch-projects__name">{r.name}</span>
                <span className="ch-projects__loc">{r.location}</span>
                <span className="ch-projects__meta">
                  <span>{r.type}</span>
                  <span>{r.meta}</span>
                </span>
                <span className="ch-projects__arrow" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              </Link>
            </motion.div>
          ))}

          <AnimatePresence>
            {current && !reduce && (
              <motion.div
                key="preview"
                className="ch-projects__preview"
                style={{ x: sx, y: sy }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.35, ease: EASE }}
                aria-hidden="true"
              >
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={current.key}
                    className="ch-projects__preview-img"
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                  >
                    <Image src={current.image} alt="" fill sizes="320px" />
                  </motion.div>
                </AnimatePresence>
                <span className="ch-projects__preview-status">{current.status}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="ch-projects__foot">
          <PillLink href="/projects" variant="dark">
            View all projects
          </PillLink>
          <button type="button" className="ch-textlink" onClick={openSiteVisit}>
            Book a guided site visit
          </button>
        </div>
      </div>
    </section>
  )
}
