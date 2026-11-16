'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, ArrowRight, User } from 'lucide-react'

// Helper to get initials from author name
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return (name.slice(0, 2) || 'CE').toUpperCase()
}

export default function NewsClientView({ articles = [] }) {
  const [activeCategory, setActiveCategory] = useState('All')

  // Extract distinct categories from articles
  const categories = ['All', ...new Set(articles.map((a) => a.category).filter(Boolean))]

  // Filter articles based on active category
  const filteredArticles =
    activeCategory === 'All'
      ? articles
      : articles.filter((a) => a.category === activeCategory)

  // Top featured article vs rest
  const featuredArticle = filteredArticles[0]
  const restArticles = filteredArticles.slice(1)

  return (
    <div className="modern-news-container">
      {/* Subtle Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="modern-news-breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span style={{ color: '#18181B', fontWeight: '600' }}>News &amp; Insights</span>
      </nav>

      {/* Editorial Header matching Reference Image ("Visual insights to sell homes faster") */}
      <div className="modern-news-header">
        <span className="modern-news-badge">Real Estate &amp; Land Intelligence</span>
        <h1 className="modern-news-title">
          Visual insights to build<br />
          wealth <em>faster</em>
        </h1>
        <p className="modern-news-subtitle">
          Market trends, regulatory updates, patta verification insights, and agro-forestry investment intelligence across Chennai &amp; Tamil Nadu.
        </p>
      </div>

      {/* Category Filter Tabs */}
      {categories.length > 2 && (
        <div className="modern-news-tabs" role="tablist" aria-label="News categories">
          {categories.map((cat) => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(cat)}
                className={`modern-news-tab ${isActive ? 'is-active' : ''}`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {/* 1. Featured Top Article (Split 2-Column Layout matching Reference Image) */}
      {featuredArticle && (
        <section className="modern-news-featured-grid" aria-label="Featured Story">
          {/* Left Column: Cinematic Rounded Image Card */}
          <Link
            href={`/news/${featuredArticle.slug}`}
            className="modern-news-featured-image-box"
            aria-label={`Read featured story: ${featuredArticle.title}`}
          >
            <Image
              src={featuredArticle.image || '/images/hero-estate.jpg'}
              alt={featuredArticle.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 680px"
              className="modern-news-featured-image"
            />
          </Link>

          {/* Right Column: Editorial Card */}
          <Link
            href={`/news/${featuredArticle.slug}`}
            className="modern-news-featured-card"
            aria-label={`Read ${featuredArticle.title}`}
          >
            <div>
              <span className="modern-news-category-pill">
                {featuredArticle.category}
              </span>
              <h2 className="modern-news-featured-title">
                {featuredArticle.title}
              </h2>
              <p className="modern-news-featured-excerpt">
                {featuredArticle.excerpt}
              </p>
            </div>

            <div className="modern-news-author-row">
              <div className="modern-news-author">
                <div className="modern-news-author-avatar" aria-hidden="true">
                  {getInitials(featuredArticle.author)}
                </div>
                <span className="modern-news-author-name">
                  {featuredArticle.author}
                </span>
              </div>
              <span className="modern-news-date">
                {featuredArticle.date}
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* 2. Subsequent Articles Grid (3-Column Layout matching Reference Image) */}
      {restArticles.length > 0 && (
        <section className="modern-news-grid" aria-label="More Articles">
          {restArticles.map((art) => (
            <Link
              key={art.id || art.slug}
              href={`/news/${art.slug}`}
              className="modern-news-card group"
              aria-label={`Read article: ${art.title}`}
            >
              <div className="modern-news-card__image-box">
                <Image
                  src={art.image || '/images/hero-estate.jpg'}
                  alt={art.title}
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                  className="modern-news-card__image"
                />
              </div>

              <div className="modern-news-card__content">
                <span className="modern-news-category-pill">
                  {art.category}
                </span>

                <h3 className="modern-news-card__title">
                  {art.title}
                </h3>

                <p className="modern-news-card__excerpt">
                  {art.excerpt}
                </p>

                <div className="modern-news-card__footer">
                  <span style={{ fontWeight: '500' }}>
                    {art.author.split('(')[0].trim()}
                  </span>
                  <span>{art.date}</span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
