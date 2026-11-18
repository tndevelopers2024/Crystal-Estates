'use client'

import React from 'react'
import PropertyDetailClient from '../../../components/projects/PropertyDetailClient'
import {
  Eyebrow,
  Reveal,
} from '../../../components/home/motion'
import { LocationsMarquee } from '../../../components/home/Manifesto'
import Voices from '../../../components/home/Voices'
import Closing from '../../../components/home/Closing'
import '../../../components/home/home.css'
import './project-detail.css'

const GUARANTEES = [
  {
    num: '01',
    title: '100% Clear Title & 30-Yr Scrutiny',
    text: 'Every parcel goes through an exhaustive 30-year legal search and revenue scrutiny by senior title advocates before presentation.',
  },
  {
    num: '02',
    title: 'CMDA & DTCP Norms Compliant',
    text: 'Layouts comply strictly with sanctioned masterplans, clear avenue road widths, OSR park allocations, and visible approval credentials.',
  },
  {
    num: '03',
    title: 'Physical Boundary Demarcation',
    text: 'Concrete boundary corner stones, avenue plantation, electricity lines, and motorable tar roads are physically in place.',
  },
  {
    num: '04',
    title: 'Spot Registration & Patta Transfer',
    text: 'End-to-end guidance through sub-registrar deed vetting, on-the-spot registration, and assisted individual patta name-transfer.',
  },
]

export default function ProjectDetailViewClient({ initialProject, staticAllProjects = [] }) {
  return (
    <div className="ch-home ch-project-detail-page">
      {/* ── 1. The Full Interactive Property Detail Suite ──────── */}
      <PropertyDetailClient
        initialProject={initialProject}
        staticAllProjects={staticAllProjects}
      />

      {/* ── 2. Growth Corridors Marquee ───────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. The 4 Commitments Due Diligence Strip ──────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-project-guarantees-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <Eyebrow>The Crystal Estates Guarantee</Eyebrow>
            <h2 id="ch-project-guarantees-title" className="ch-h2">
              Four promises, kept on <span className="ch-accent">every plot.</span>
            </h2>
          </div>

          <div className="ch-about-shield__steps">
            {GUARANTEES.map((g, idx) => (
              <Reveal key={g.num} delay={idx * 0.1} className="ch-about-shield-step">
                <div className="ch-about-shield-step__num">{g.num}</div>
                <h4>{g.title}</h4>
                <p>{g.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Landowner Voices Carousel ──────────────────────── */}
      <Voices />

      {/* ── 5. Closing Consultation Suite ─────────────────────── */}
      <Closing />
    </div>
  )
}
