import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  ArrowRight,
  Tag,
  ShieldCheck,
  FileCheck2,
  PhoneCall,
  CheckCircle2,
} from 'lucide-react'
import TestimonialsSection from '../../../components/TestimonialsSection'
import ArticleShareBar from '../../../components/news/ArticleShareBar'
import { newsArticles } from '../../../data/news'

// Helper to get initials from author name
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return (name.slice(0, 2) || 'CE').toUpperCase()
}

export function generateStaticParams() {
  return newsArticles.map((a) => ({
    slug: a.slug,
  }))
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const { slug } = resolvedParams || {}
  const article = newsArticles.find((a) => a.slug === slug)

  if (!article) {
    return {
      title: 'Article Not Found | Crystal Estates',
      description: 'The requested article could not be found.',
    }
  }

  return {
    title: `${article.title} | Crystal Estates`,
    description: article.excerpt || article.title,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: `https://crystalestates.in/news/${article.slug}`,
      siteName: 'Crystal Estates',
      images: [
        {
          url: article.image || '/images/hero-estate.jpg',
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
  }
}

export default async function NewsArticleDetailPage({ params }) {
  const resolvedParams = await params
  const { slug } = resolvedParams || {}
  const article = newsArticles.find((a) => a.slug === slug)

  if (!article) {
    notFound()
  }

  // Related articles (up to 3 other articles)
  const otherArticles = newsArticles.filter((a) => a.slug !== article.slug).slice(0, 3)

  return (
    <main className="article-page-wrapper">
      {/* 1. Hero Section matching About Us Minimalist Structure */}
      <section className="article-hero-section">
        <div className="article-hero-container">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="article-hero__breadcrumb">
            <Link href="/">Home</Link>
            <span className="article-hero__breadcrumb-sep">/</span>
            <Link href="/news">News</Link>
            <span className="article-hero__breadcrumb-sep">/</span>
            <span className="article-hero__breadcrumb-current">{article.category}</span>
          </nav>

          {/* Heading & Meta Header */}
          <div className="article-hero__header">
            <div className="article-hero__badge-row">
              <span className="article-hero__badge">
                ASSETS CREATOR • {article.category}
              </span>
            </div>

            <h1 className="article-hero__title">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="article-hero__subtitle">
                {article.excerpt}
              </p>
            )}

            {/* Author, Date & Back Button Bar */}
            <div className="article-hero__meta-bar">
              <div className="article-hero__meta-left">
                <div className="article-hero__meta-item">
                  <div className="article-hero__avatar" aria-hidden="true">
                    {getInitials(article.author)}
                  </div>
                  <span>{article.author}</span>
                </div>

                <div className="article-hero__meta-item">
                  <Calendar size={14} className="article-hero__meta-icon" />
                  <span>{article.date}</span>
                </div>

                <div className="article-hero__meta-item">
                  <Clock size={14} className="article-hero__meta-icon" />
                  <span>{article.readTime}</span>
                </div>
              </div>

              <Link href="/news" className="article-hero__back-btn">
                <ArrowLeft size={15} />
                <span>Back to All Articles</span>
              </Link>
            </div>
          </div>

          {/* Wide Hero Image matching About Us architectural banner */}
          <div className="article-hero__image-wrap">
            <Image
              src={article.image || '/images/hero-estate.jpg'}
              alt={article.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1360px"
              className="article-hero__image"
            />
          </div>
        </div>
      </section>

      {/* 2. Structured Article Content Section with Clean White Background */}
      <section className="article-content-section">
        <div className="article-content-container">
          <div className="article-content-grid">
            {/* Main Editorial Reading Column */}
            <article className="article-main-column">
              {/* Article HTML Prose */}
              <div
                className="article-prose"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />

              {/* Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="article-tags-wrap">
                  <span className="article-tags-label">
                    <Tag size={15} />
                    <span>Tags:</span>
                  </span>
                  {article.tags.map((tag) => (
                    <span key={tag} className="article-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Interactive Share Bar */}
              <ArticleShareBar title={article.title} slug={article.slug} />

              {/* Author Profile Box */}
              <div className="article-author-card">
                <div className="article-author-card__avatar">
                  {getInitials(article.author)}
                </div>
                <div className="article-author-card__info">
                  <div className="article-author-card__name-row">
                    <h4 className="article-author-card__name">{article.author}</h4>
                    <span className="article-author-card__badge">
                      <ShieldCheck size={13} />
                      <span>Verified Contributor</span>
                    </span>
                  </div>
                  <p className="article-author-card__desc">
                    Specialist at Crystal Estates with deep domain expertise in Chennai land acquisitions, DTCP/CMDA approvals, individual patta registrations, and agro-forestry farmland investments.
                  </p>
                </div>
              </div>
            </article>

            {/* Right Sticky Sidebar */}
            <aside className="article-sidebar">
              {/* Key Highlights Card */}
              <div className="article-sidebar__card">
                <span className="article-sidebar__card-eyebrow">
                  ARTICLE HIGHLIGHTS
                </span>
                <h3 className="article-sidebar__card-title">
                  Quick Summary
                </h3>

                <ul className="article-sidebar__specs">
                  <li className="article-sidebar__spec-item">
                    <span className="article-sidebar__spec-label">Category</span>
                    <span className="article-sidebar__spec-val">{article.category}</span>
                  </li>
                  <li className="article-sidebar__spec-item">
                    <span className="article-sidebar__spec-label">Published</span>
                    <span className="article-sidebar__spec-val">{article.date}</span>
                  </li>
                  <li className="article-sidebar__spec-item">
                    <span className="article-sidebar__spec-label">Reading Time</span>
                    <span className="article-sidebar__spec-val">{article.readTime}</span>
                  </li>
                  <li className="article-sidebar__spec-item">
                    <span className="article-sidebar__spec-label">Title Status</span>
                    <span className="article-sidebar__spec-val article-sidebar__spec-val--green">
                      <FileCheck2 size={13} />
                      100% Clear Patta
                    </span>
                  </li>
                  <li className="article-sidebar__spec-item">
                    <span className="article-sidebar__spec-label">Due Diligence</span>
                    <span className="article-sidebar__spec-val article-sidebar__spec-val--green">
                      <CheckCircle2 size={13} />
                      30-Yr Legal Check
                    </span>
                  </li>
                </ul>
              </div>

              {/* Consultation / Advisory CTA Card */}
              <div className="article-sidebar__advisory-card">
                <span className="article-sidebar__advisory-badge">
                  EXPERT ADVISORY
                </span>
                <h3 className="article-sidebar__advisory-title">
                  Looking for Verified Land in Chennai?
                </h3>
                <p className="article-sidebar__advisory-text">
                  Our legal counsel &amp; land advisors conduct thorough 30-year parent document audits, DTCP/CMDA sanction checks, and individual patta handover.
                </p>

                <div className="article-sidebar__advisory-contacts">
                  <Link href="/contact" className="article-sidebar__advisory-btn">
                    <span>Talk to Our Team</span>
                    <ArrowRight size={15} />
                  </Link>

                  <a
                    href="tel:+919884455555"
                    className="article-sidebar__advisory-call"
                  >
                    <PhoneCall size={14} />
                    <span>+91 98844 55555</span>
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* 3. Related Updates Section with Warm Neutral Flow */}
      {otherArticles.length > 0 && (
        <section className="article-related-section">
          <div className="article-related-container">
            <div className="article-related__header">
              <span className="article-related__eyebrow">MORE INSIGHTS</span>
              <h2 className="article-related__title">
                Related Land &amp; Market Updates
              </h2>
              <p className="article-related__subtitle">
                Explore more expert analyses, legal breakdowns, and corridor appreciation reports from Crystal Estates.
              </p>
            </div>

            <div className="article-related__grid">
              {otherArticles.map((rel) => (
                <article key={rel.id || rel.slug} className="article-related-card">
                  <Link
                    href={`/news/${rel.slug}`}
                    className="article-related-card__image-box"
                    aria-label={rel.title}
                  >
                    <Image
                      src={rel.image || '/images/hero-estate.jpg'}
                      alt={rel.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 420px"
                      className="article-related-card__image"
                    />
                    <span className="article-related-card__badge">
                      {rel.category}
                    </span>
                  </Link>

                  <div className="article-related-card__body">
                    <div className="article-related-card__meta">
                      <span className="article-related-card__meta-item">
                        <Calendar size={13} />
                        {rel.date}
                      </span>
                      <span className="article-related-card__meta-item">
                        <Clock size={13} />
                        {rel.readTime}
                      </span>
                    </div>

                    <h3 className="article-related-card__title">
                      <Link href={`/news/${rel.slug}`}>
                        {rel.title}
                      </Link>
                    </h3>

                    <p className="article-related-card__excerpt">
                      {rel.excerpt}
                    </p>

                    <div className="article-related-card__footer">
                      <Link
                        href={`/news/${rel.slug}`}
                        className="article-related-card__link"
                      >
                        <span>Read Full Story</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. Landowner Confidence Testimonials */}
      <TestimonialsSection
        title="Landowner Confidence"
        subtitle="Transparent documentation and verified guidance are at the heart of our service."
      />
    </main>
  )
}
