'use client'

import React from 'react'
import ProjectsClientView from '../../components/projects/ProjectsClientView'
import { Reveal } from '../../components/home/motion'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import '../../components/home/home.css'
import './projects.css'

const GUARANTEES = [
  {
    num: '01',
    title: '100% Clear Title & 30-Yr Scrutiny',
    text: 'Every project goes through an exhaustive 30-year legal search and revenue scrutiny by senior title advocates before reaching you.',
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

export default function ProjectsClient({ initialProjects = [] }) {
  return (
    <div className="ch-home ch-projects-page">
      {/* ── 1. Editorial Minimal Page Header (Matches reference image) ── */}
      <section className="ce-projects-editorial-header" aria-labelledby="projects-page-title">
        <div className="ch-wrap">
          <div className="ce-projects-editorial-header__grid">
            <div className="ce-projects-editorial-header__left">
              <div className="ce-projects-editorial-header__bullet-tag">
                <span className="ce-projects-editorial-header__bullet" />
                <span>Crystal Estates</span>
              </div>
              <h1 id="projects-page-title" className="ce-projects-editorial-header__headline">
                The Land Behind<br />Your Legacy
              </h1>
            </div>
            <div className="ce-projects-editorial-header__right">
              <p className="ce-projects-editorial-header__desc">
                We approach every parcel with intention, balancing CMDA &amp; DTCP approval compliance, 100% legal scrutiny, and high-growth Chennai corridor value.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Interactive Catalog & Minimal Filter Console ───── */}
      <div id="catalog">
        <ProjectsClientView initialProjects={initialProjects} />
      </div>

      {/* ── 3. Buyer Assurance Strip ─────────────────────────── */}
      <section className="ch-about-shield" aria-labelledby="ch-projects-standards-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <h2 id="ch-projects-standards-title" className="ch-h2">
              Four promises kept on <span className="ch-accent">every parcel.</span>
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

      {/* ── 4. Landowner Testimonials ─────────────────────────── */}
      <Voices />

      {/* ── 5. Closing CTA Section ────────────────────────────── */}
      <Closing />
    </div>
  )
}
