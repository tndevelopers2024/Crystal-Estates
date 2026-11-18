'use client'

import React, { useState } from 'react'
import { Plus, Minus, HelpCircle, Phone } from 'lucide-react'
import { Button } from '../ui'
import { faqCategories, allFaqs } from '../../data/faqsData'

function FaqAccordionItem({ faq, isOpen, onToggle }) {
  return (
    <div className={`faq-card ${isOpen ? 'faq-card--open' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="faq-card__trigger"
      >
        <span className="faq-card__question">{faq.q}</span>
        <span className="faq-card__icon">
          {isOpen ? <Minus size={18} /> : <Plus size={18} />}
        </span>
      </button>
      {isOpen && (
        <div className="faq-card__answer">
          <p>{faq.a}</p>
        </div>
      )}
    </div>
  )
}

/**
 * FAQ list in the site's split layout: sticky sidebar (heading, category
 * filters, help card) on the left and the accordion filling the right column.
 */
export default function FaqClientAccordion() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [openIndex, setOpenIndex] = useState(0)

  const filteredFaqs =
    activeCategory === 'All'
      ? allFaqs
      : allFaqs.filter((f) => f.category === activeCategory)

  return (
    <section className="split-sec split-sec--soft" aria-label="Frequently asked questions">
      <div className="split-sec__grid">
        <aside className="split-sec__aside">
          <span className="featured-showcase-sidebar__badge">Help Centre</span>
          <h2 className="featured-showcase-sidebar__title">Answers Before You Buy</h2>
          <p className="featured-showcase-sidebar__subtitle">
            Filter by topic to find what you need about approvals, titles, registration and site visits.
          </p>

          <div className="split-sec__filters" role="group" aria-label="FAQ categories">
            {faqCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={activeCategory === cat}
                className={`split-sec__filter ${activeCategory === cat ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat)
                  setOpenIndex(0)
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="split-sec__help-card">
            <HelpCircle size={26} className="split-sec__help-icon" aria-hidden="true" />
            <h3>Have a specific question about a land parcel?</h3>
            <p>
              Our legal desk and property consultants can explain survey records, parent deeds, or loan eligibility directly.
            </p>
            <div className="split-sec__help-actions">
              <Button href="/contact" variant="primary" size="sm">
                Contact Legal Desk
              </Button>
              <Button href="tel:+919444000000" variant="outline" size="sm">
                <Phone size={14} /> Call +91 94440 00000
              </Button>
            </div>
          </div>
        </aside>

        <div className="split-sec__content faq-list">
          {filteredFaqs.map((faq, idx) => (
            <FaqAccordionItem
              key={`${activeCategory}-${idx}`}
              faq={faq}
              isOpen={openIndex === idx}
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
