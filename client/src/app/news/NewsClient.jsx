'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Calendar,
  Clock,
  ArrowRight,
  Search,
  ShieldCheck,
  Scale,
  Sparkles,
  BookOpen,
  X,
  PhoneCall,
  MessageCircle,
  Newspaper,
  CheckCircle2,
} from 'lucide-react'
import {
  WordsPullUpMultiStyle,
  Eyebrow,
  Reveal,
  PillLink,
  openSiteVisit,
} from '../../components/home/motion'
import { LocationsMarquee } from '../../components/home/Manifesto'
import Voices from '../../components/home/Voices'
import Closing from '../../components/home/Closing'
import '../../components/home/home.css'
import './news.css'

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return (name.slice(0, 2) || 'CE').toUpperCase()
}

const EDITORIAL_PRINCIPLES = [
  {
    num: '01',
    title: 'On-Ground Field Verification',
    text: 'Every insight and corridor report is verified on the ground with revenue survey maps and live infrastructure developments across Chennai & Kanchipuram.',
  },
  {
    num: '02',
    title: 'Revenue Advocate Scrutiny',
    text: 'Legal breakdowns covering patta, chitta, parent deeds, and encumbrance certificates are thoroughly vetted by practicing property counsels.',
  },
  {
    num: '03',
    title: 'Sanction Authority Clarity',
    text: 'Unbiased breakdowns between DTCP, CMDA, and local panchayat mandates to protect land buyers from unapproved layout hazards.',
  },
  {
    num: '04',
    title: 'Zero Brokerage Bias',
    text: 'Objective, data-backed land market analyses designed for families and long-term soil asset builders with transparent developer pricing.',
  },
]

export default function NewsClient({ initialArticles = [] }) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set(initialArticles.map((a) => a.category).filter(Boolean))
    return ['All', ...Array.from(set)]
  }, [initialArticles])

  // Filtered articles based on category & search term
  const filteredArticles = useMemo(() => {
    return initialArticles.filter((art) => {
      const matchesCategory =
        activeCategory === 'All' || art.category === activeCategory

      const q = searchQuery.trim().toLowerCase()
      if (!q) return matchesCategory

      const matchesSearch =
        art.title?.toLowerCase().includes(q) ||
        art.excerpt?.toLowerCase().includes(q) ||
        art.category?.toLowerCase().includes(q) ||
        art.author?.toLowerCase().includes(q)

      return matchesCategory && matchesSearch
    })
  }, [initialArticles, activeCategory, searchQuery])

  // Count per category for pills
  const getCategoryCount = (cat) => {
    if (cat === 'All') return initialArticles.length
    return initialArticles.filter((a) => a.category === cat).length
  }

  // Spotlight featured story vs grid cards
  const isSearchOrFilterActive = activeCategory !== 'All' || searchQuery.trim().length > 0
  const featuredArticle = !isSearchOrFilterActive ? filteredArticles[0] : null
  const gridArticles = !isSearchOrFilterActive
    ? filteredArticles.slice(1)
    : filteredArticles

  return (
    <div className="ch-home ch-news-page">
      {/* ── 1. Hero Section ───────────────────────────────────── */}
      <section className="ch-news-hero" aria-labelledby="ch-news-hero-title">
        <div className="ch-wrap">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="ch-news-breadcrumb">
            <Link href="/">Home</Link>
            <span className="ch-news-breadcrumb__sep">/</span>
            <span className="ch-news-breadcrumb__current">News &amp; Insights</span>
          </nav>

          <div className="ch-news-hero__head">
            <Eyebrow>Land Intelligence &amp; Market Research · Assets Creator</Eyebrow>
            <h1 id="ch-news-hero-title" className="ch-news-hero__title">
              <WordsPullUpMultiStyle
                segments={[
                  { text: 'Market intelligence &' },
                  { br: true },
                  { text: 'regulatory clarity.', className: 'ch-accent' },
                ]}
              />
            </h1>
            <p className="ch-news-hero__lead">
              Stay informed with verified Chennai real estate regulations, CMDA and DTCP layout approvals,
              revenue patta &amp; chitta guidelines, and managed sandalwood farmland insights curated directly
              by the Crystal Estates research desk.
            </p>

            <div className="ch-news-hero__ctas">
              <PillLink href="#articles" variant="cream">
                Read Latest Insights
              </PillLink>
              <PillLink href="#enquire" variant="dark" onClick={openSiteVisit}>
                Consult a Land Specialist
              </PillLink>
            </div>

            {/* Live Trust Metrics Row */}
            <div className="ch-news-stats-row">
              <div className="ch-news-stat-pill">
                <Newspaper size={16} style={{ color: '#b8964e' }} aria-hidden="true" />
                <strong>{initialArticles.length}</strong>
                <span>Research Reports</span>
              </div>
              <div className="ch-news-stat-pill">
                <Scale size={16} style={{ color: '#0f3d2e' }} aria-hidden="true" />
                <strong>100%</strong>
                <span>DTCP &amp; CMDA Legal Guides</span>
              </div>
              <div className="ch-news-stat-pill">
                <ShieldCheck size={16} style={{ color: '#25d366' }} aria-hidden="true" />
                <strong>30-Yr</strong>
                <span>Revenue Patta Due Diligence</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Growth Corridors Marquee ───────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. News Catalog & Filter Console ──────────────────── */}
      <section id="articles" className="ch-news-section" aria-label="News Articles Catalog">
        <div className="ch-wrap">
          {/* Interactive Console Toolbar */}
          <div className="ch-news-console">
            <div className="ch-news-console__top">
              {/* Category Pills */}
              <div className="ch-news-tabs" role="tablist" aria-label="Article categories">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveCategory(cat)}
                      className={`ch-news-tab ${isActive ? 'is-active' : ''}`}
                    >
                      <span>{cat === 'All' ? 'All Intelligence' : cat}</span>
                      <span className="ch-news-tab__count">{getCategoryCount(cat)}</span>
                    </button>
                  )
                })}
              </div>

              {/* Instant Search Bar */}
              <div className="ch-news-search">
                <Search size={16} className="ch-news-search__icon" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles, legal guides, corridors..."
                  className="ch-news-search__input"
                  aria-label="Search articles"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="ch-news-search__clear"
                    aria-label="Clear search query"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="ch-news-meta-counter">
              Showing <strong>{filteredArticles.length}</strong> of{' '}
              <strong>{initialArticles.length}</strong> land intelligence insights
            </div>
          </div>

          {/* Empty Search State */}
          {filteredArticles.length === 0 && (
            <div className="ch-news-empty">
              <div className="ch-news-empty__icon" aria-hidden="true">
                <BookOpen size={28} />
              </div>
              <h3 className="ch-news-empty__title">No matching articles found</h3>
              <p className="ch-news-empty__text">
                We couldn&apos;t find any articles matching &ldquo;{searchQuery}&rdquo;. Try another keyword
                or browse our full archive.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setActiveCategory('All')
                }}
                className="ch-news-tab is-active"
                style={{ margin: '0 auto' }}
              >
                Reset Search Filters
              </button>
            </div>
          )}

          {/* 3A. Spotlight Featured Story (Shown on Default Unfiltered View) */}
          {featuredArticle && (
            <div className="ch-news-featured">
              <Link
                href={`/news/${featuredArticle.slug}`}
                className="ch-news-featured-card"
                aria-label={`Read featured story: ${featuredArticle.title}`}
              >
                <div className="ch-news-featured__img-box">
                  <Image
                    src={featuredArticle.image || '/images/hero-estate.jpg'}
                    alt={featuredArticle.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 700px"
                    className="ch-news-featured__img"
                  />
                  <div className="ch-news-featured__badges">
                    <span className="ch-news-badge-spotlight">
                      <Sparkles size={12} aria-hidden="true" />
                      Featured Intelligence
                    </span>
                    <span className="ch-news-badge-category">
                      {featuredArticle.category}
                    </span>
                  </div>
                </div>

                <div className="ch-news-featured__content">
                  <div>
                    <span className="ch-news-featured__eyebrow">
                      Editorial Highlight · {featuredArticle.readTime}
                    </span>
                    <h2 className="ch-news-featured__title">
                      {featuredArticle.title}
                    </h2>
                    <p className="ch-news-featured__excerpt">
                      {featuredArticle.excerpt}
                    </p>
                  </div>

                  <div className="ch-news-featured__meta-row">
                    <div className="ch-news-author">
                      <div className="ch-news-author__avatar" aria-hidden="true">
                        {getInitials(featuredArticle.author)}
                      </div>
                      <div className="ch-news-author__info">
                        <span className="ch-news-author__name">{featuredArticle.author}</span>
                        <span className="ch-news-author__date">{featuredArticle.date}</span>
                      </div>
                    </div>

                    <span className="ch-news-featured__cta">
                      <span>Read Full Analysis</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* 3B. Subsequent Articles Grid */}
          {gridArticles.length > 0 && (
            <div className="ch-news-grid" role="feed" aria-label="Articles Grid">
              {gridArticles.map((art, idx) => (
                <Reveal key={art.id || art.slug} delay={idx * 0.08}>
                  <Link
                    href={`/news/${art.slug}`}
                    className="ch-news-card"
                    aria-label={`Read article: ${art.title}`}
                  >
                    <div className="ch-news-card__img-box">
                      <Image
                        src={art.image || '/images/hero-estate.jpg'}
                        alt={art.title}
                        fill
                        loading="lazy"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                        className="ch-news-card__img"
                      />
                      <span className="ch-news-card__badge">
                        {art.category}
                      </span>
                    </div>

                    <div className="ch-news-card__content">
                      <div className="ch-news-card__meta-bar">
                        <span className="ch-news-card__meta-item">
                          <Calendar size={13} aria-hidden="true" />
                          <span>{art.date}</span>
                        </span>
                        <span className="ch-news-card__meta-item">
                          <Clock size={13} aria-hidden="true" />
                          <span>{art.readTime}</span>
                        </span>
                      </div>

                      <h3 className="ch-news-card__title">
                        {art.title}
                      </h3>

                      <p className="ch-news-card__excerpt">
                        {art.excerpt}
                      </p>

                      <div className="ch-news-card__footer">
                        <div className="ch-news-card__author-info">
                          <div className="ch-news-card__author-avatar" aria-hidden="true">
                            {getInitials(art.author)}
                          </div>
                          <span>{art.author.split('(')[0].trim()}</span>
                        </div>

                        <span className="ch-news-card__link">
                          <span>Read Story</span>
                          <ArrowRight size={13} aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}

          {/* 3C. Market Digest / Direct Advisory Banner */}
          <div className="ch-news-digest">
            <div className="ch-news-digest__inner">
              <div className="ch-news-digest__info">
                <span className="ch-news-digest__eyebrow">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  Quarterly Market Intelligence
                </span>
                <h3 className="ch-news-digest__title">
                  Want verified Chennai land reports <span className="ch-accent">delivered to you?</span>
                </h3>
                <p className="ch-news-digest__text">
                  Get upcoming DTCP layout sanction notifications, infrastructure corridor appreciation
                  indexes, and Tamil Nadu revenue guidelines directly from our research desk.
                </p>
              </div>

              <div className="ch-news-digest__actions">
                <PillLink
                  href="https://wa.me/919884455555?text=Hi%20Crystal%20Estates,%20please%20share%20the%20latest%20Chennai%20land%20market%20intelligence%20reports."
                  variant="cream"
                >
                  <MessageCircle size={15} aria-hidden="true" />
                  Request via WhatsApp
                </PillLink>
                <PillLink href="#enquire" variant="dark" onClick={openSiteVisit}>
                  <PhoneCall size={15} aria-hidden="true" />
                  Consult Legal Desk
                </PillLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Editorial Due Diligence & Research Standards ───── */}
      <section className="ch-about-shield" aria-labelledby="ch-news-standards-title">
        <div className="ch-wrap">
          <div className="ch-about-shield__head">
            <Eyebrow>The Crystal Estates Editorial Standard</Eyebrow>
            <h2 id="ch-news-standards-title" className="ch-h2">
              Four principles behind <span className="ch-accent">our research.</span>
            </h2>
          </div>

          <div className="ch-about-shield__steps">
            {EDITORIAL_PRINCIPLES.map((p, idx) => (
              <Reveal key={p.num} delay={idx * 0.1} className="ch-about-shield-step">
                <div className="ch-about-shield-step__num">{p.num}</div>
                <h4>{p.title}</h4>
                <p>{p.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Landowner Voices Carousel ──────────────────────── */}
      <Voices />

      {/* ── 6. Closing Consultation Pavilion ──────────────────── */}
      <Closing />
    </div>
  )
}
