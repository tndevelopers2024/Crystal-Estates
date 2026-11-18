'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Calendar,
  Clock,
  ArrowLeft,
  ArrowRight,
  Tag,
  ShieldCheck,
  FileCheck2,
  PhoneCall,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react'
import ArticleShareBar from '../../../components/news/ArticleShareBar'
import {
  Eyebrow,
  Reveal,
  PillLink,
} from '../../../components/home/motion'
import { LocationsMarquee } from '../../../components/home/Manifesto'
import Voices from '../../../components/home/Voices'
import Closing from '../../../components/home/Closing'
import { business } from '../../../data/site'
import '../../../components/home/home.css'
import '../news.css'
import './news-detail.css'

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return (name.slice(0, 2) || 'CE').toUpperCase()
}

export default function NewsDetailClient({ article, otherArticles = [] }) {
  if (!article) return null

  return (
    <div className="ch-home ch-news-detail-page">
      {/* ── 1. Hero Section ───────────────────────────────────── */}
      <section className="ch-nd-hero" aria-labelledby="ch-nd-hero-title">
        <div className="ch-wrap">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="ch-nd-breadcrumb">
            <Link href="/">Home</Link>
            <span className="ch-nd-breadcrumb__sep">/</span>
            <Link href="/news">News &amp; Insights</Link>
            <span className="ch-nd-breadcrumb__sep">/</span>
            <span className="ch-nd-breadcrumb__current">{article.title}</span>
          </nav>

          <div className="ch-nd-hero__head">
            <Eyebrow>Land Intelligence &amp; Market Research · {article.category}</Eyebrow>
            <h1 id="ch-nd-hero-title" className="ch-nd-hero__title">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="ch-nd-hero__lead">
                {article.excerpt}
              </p>
            )}

            {/* Author, Date & Back Action Bar */}
            <div className="ch-nd-hero__meta-bar">
              <div className="ch-nd-hero__meta-left">
                <div className="ch-nd-hero__author">
                  <div className="ch-nd-hero__author-avatar" aria-hidden="true">
                    {getInitials(article.author)}
                  </div>
                  <span className="ch-nd-hero__author-name">{article.author}</span>
                </div>

                <div className="ch-nd-hero__meta-item">
                  <Calendar size={14} aria-hidden="true" />
                  <span>{article.date}</span>
                </div>

                <div className="ch-nd-hero__meta-item">
                  <Clock size={14} aria-hidden="true" />
                  <span>{article.readTime}</span>
                </div>
              </div>

              <Link href="/news" className="ch-nd-hero__back-link">
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Back to All Articles</span>
              </Link>
            </div>
          </div>

          {/* Wide Hero Image Banner */}
          <div className="ch-nd-hero__image-wrap">
            <Image
              src={article.image || '/images/hero-estate.jpg'}
              alt={article.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1360px"
              className="ch-nd-hero__image"
            />
          </div>
        </div>
      </section>

      {/* ── 2. Growth Corridors Marquee ───────────────────────── */}
      <LocationsMarquee />

      {/* ── 3. Article Content & Sidebar Grid ─────────────────── */}
      <section className="ch-nd-content-sec" aria-label="Article Content">
        <div className="ch-wrap">
          <div className="ch-nd-grid">
            {/* Main Editorial Reading Column */}
            <article className="ch-nd-main-col">
              {/* Article HTML Prose */}
              <div
                className="ch-nd-prose"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />

              {/* Tags */}
              {article.tags && article.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '32px 0 20px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--ch-muted)', fontWeight: '600' }}>
                    <Tag size={14} /> Tags:
                  </span>
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        background: 'var(--ch-bone)',
                        color: 'var(--ch-green)',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Interactive Share Bar */}
              <ArticleShareBar title={article.title} slug={article.slug} />

              {/* Author Profile Card */}
              <div className="ch-nd-author-card">
                <div className="ch-nd-author-card__avatar" aria-hidden="true">
                  {getInitials(article.author)}
                </div>
                <div className="ch-nd-author-card__info">
                  <div className="ch-nd-author-card__name-row">
                    <h3 className="ch-nd-author-card__name">{article.author}</h3>
                    <span className="ch-nd-author-card__badge">
                      <ShieldCheck size={12} aria-hidden="true" />
                      <span>Verified Contributor</span>
                    </span>
                  </div>
                  <p className="ch-nd-author-card__desc">
                    Specialist at Crystal Estates with deep domain expertise in Chennai land acquisitions,
                    DTCP/CMDA approvals, individual patta registrations, and agro-forestry farmland investments.
                  </p>
                </div>
              </div>
            </article>

            {/* Right Sticky Sidebar */}
            <aside className="ch-nd-sidebar">
              {/* Key Highlights Card */}
              <div className="ch-nd-sidebar__card">
                <span className="ch-nd-sidebar__eyebrow">ARTICLE HIGHLIGHTS</span>
                <h3 className="ch-nd-sidebar__title">Quick Summary</h3>

                <ul className="ch-nd-sidebar__specs">
                  <li className="ch-nd-sidebar__spec-item">
                    <span className="ch-nd-sidebar__spec-label">Category</span>
                    <span className="ch-nd-sidebar__spec-val">{article.category}</span>
                  </li>
                  <li className="ch-nd-sidebar__spec-item">
                    <span className="ch-nd-sidebar__spec-label">Published</span>
                    <span className="ch-nd-sidebar__spec-val">{article.date}</span>
                  </li>
                  <li className="ch-nd-sidebar__spec-item">
                    <span className="ch-nd-sidebar__spec-label">Reading Time</span>
                    <span className="ch-nd-sidebar__spec-val">{article.readTime}</span>
                  </li>
                  <li className="ch-nd-sidebar__spec-item">
                    <span className="ch-nd-sidebar__spec-label">Title Status</span>
                    <span className="ch-nd-sidebar__spec-val ch-nd-sidebar__spec-val--green">
                      <FileCheck2 size={13} aria-hidden="true" />
                      100% Clear Patta
                    </span>
                  </li>
                  <li className="ch-nd-sidebar__spec-item">
                    <span className="ch-nd-sidebar__spec-label">Due Diligence</span>
                    <span className="ch-nd-sidebar__spec-val ch-nd-sidebar__spec-val--green">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      30-Yr Legal Check
                    </span>
                  </li>
                </ul>
              </div>

              {/* Expert Advisory CTA Card */}
              <div className="ch-nd-advisory-card">
                <span className="ch-nd-advisory-badge">EXPERT ADVISORY</span>
                <h3 className="ch-nd-advisory-title">
                  Looking for Verified Land in Chennai?
                </h3>
                <p className="ch-nd-advisory-text">
                  Our legal counsel &amp; land advisors conduct thorough 30-year parent document audits,
                  DTCP/CMDA sanction checks, and individual patta handover.
                </p>

                <div className="ch-nd-advisory-actions">
                  <PillLink
                    href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
                      `Hi Crystal Estates, I read your article "${article.title}" and would like to consult on verified land opportunities.`
                    )}`}
                    variant="cream"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={15} style={{ marginRight: '6px' }} aria-hidden="true" />
                    Enquire on WhatsApp
                  </PillLink>
                  <a
                    href={`tel:${business.phone.replace(/\s/g, '')}`}
                    className="ch-nd-advisory-call"
                  >
                    <PhoneCall size={14} aria-hidden="true" />
                    <span>Call {business.phone}</span>
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── 4. Related Insights Grid ──────────────────────────── */}
      {otherArticles.length > 0 && (
        <section className="ch-nd-related-sec" aria-labelledby="ch-nd-related-title">
          <div className="ch-wrap">
            <div className="ch-nd-related-head">
              <Eyebrow>More Insights</Eyebrow>
              <h2 id="ch-nd-related-title">
                Related Land &amp; Market <span className="ch-accent">Updates</span>
              </h2>
              <p>
                Explore more expert analyses, legal breakdowns, and corridor appreciation reports from Crystal Estates.
              </p>
            </div>

            <div className="ch-news-grid">
              {otherArticles.map((rel, idx) => (
                <Reveal key={rel.id || rel.slug} delay={idx * 0.08}>
                  <Link
                    href={`/news/${rel.slug}`}
                    className="ch-news-card"
                    aria-label={`Read article: ${rel.title}`}
                  >
                    <div className="ch-news-card__img-box">
                      <Image
                        src={rel.image || '/images/hero-estate.jpg'}
                        alt={rel.title}
                        fill
                        loading="lazy"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                        className="ch-news-card__img"
                      />
                      <span className="ch-news-card__badge">
                        {rel.category}
                      </span>
                    </div>

                    <div className="ch-news-card__content">
                      <div className="ch-news-card__meta-bar">
                        <span className="ch-news-card__meta-item">
                          <Calendar size={13} aria-hidden="true" />
                          <span>{rel.date}</span>
                        </span>
                        <span className="ch-news-card__meta-item">
                          <Clock size={13} aria-hidden="true" />
                          <span>{rel.readTime}</span>
                        </span>
                      </div>

                      <h3 className="ch-news-card__title">
                        {rel.title}
                      </h3>

                      <p className="ch-news-card__excerpt">
                        {rel.excerpt}
                      </p>

                      <div className="ch-news-card__footer">
                        <div className="ch-news-card__author-info">
                          <div className="ch-news-card__author-avatar" aria-hidden="true">
                            {getInitials(rel.author)}
                          </div>
                          <span>{rel.author.split('(')[0].trim()}</span>
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
          </div>
        </section>
      )}

      {/* ── 5. Landowner Voices Carousel ──────────────────────── */}
      <Voices />

      {/* ── 6. Closing Consultation Suite ─────────────────────── */}
      <Closing />
    </div>
  )
}
