'use client'

import React from 'react'
import { Mail } from 'lucide-react'
import SiteVisitForm from '../forms/SiteVisitForm'
import { openSiteVisit } from './motion'
import { business } from '../../data/site'

export default function Closing() {
  const handleOpenVisit = () => {
    // Focus the first name field in the site visit form or open popup
    const input = document.getElementById('site-visit-first-name')
    if (input) {
      input.focus()
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      openSiteVisit()
    }
  }

  return (
    <section id="enquire" className="ch-closing" aria-labelledby="ch-closing-title">
      <div className="ch-wrap ch-closing__wrap">
        {/* Simple heading and short supporting description at the top (matches reference image) */}
        <div className="ch-closing__header">
          <h2 id="ch-closing-title" className="ch-closing__title">
            Your plot is waiting<br />
            <span className="ch-closing__title-muted">and ready for your vision</span>
          </h2>
          <p className="ch-closing__subtitle">
            Tell us about your land goals, and we'll help you secure verified CMDA &amp; DTCP plots with 100% legal clarity and guided site visits.
          </p>
        </div>

        {/* Clean, minimal, modern two-column layout */}
        <div className="ch-closing__grid">
          {/* Left Column: Compact Dark Card */}
          <div className="ch-closing__left-col">
            <div className="ch-closing__dark-card">
              <span className="ch-closing__card-pill">Guided Site Tour</span>

              <h3 className="ch-closing__card-title">
                Let's schedule<br />a site visit
              </h3>
              <p className="ch-closing__card-desc">
                Pick a date that works for you and let's explore your future plotted layout in person.
              </p>

              <button
                type="button"
                onClick={handleOpenVisit}
                className="ch-closing__card-cta"
              >
                Book a site visit
              </button>
            </div>

            {/* Email contact note below dark card (matches reference image) */}
            <div className="ch-closing__email-note">
              <div className="ch-closing__email-icon-box" aria-hidden="true">
                <Mail size={15} />
              </div>
              <div className="ch-closing__email-text">
                <span className="ch-closing__email-label">Do you prefer email?</span>
                <a href={`mailto:${business.email}`} className="ch-closing__email-link">
                  {business.email}
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Clean & Minimal Site Visit Form */}
          <div className="ch-closing__right-col">
            <SiteVisitForm />
          </div>
        </div>
      </div>
    </section>
  )
}
