'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, ArrowUpRight, ShieldCheck, Ruler, IndianRupee, Layers } from 'lucide-react'
import { formatPrice } from '../../lib/api'

/**
 * Modern News-Style ProjectCard Component
 * Delivers an editorial, premium presentation matching the redesigned News & Featured Projects UI.
 * Fully responsive across all devices (320px to 1920px).
 */
export function ProjectCard({ project, className = '' }) {
  if (!project) return null

  const isFlagship = Boolean(project?.isFlagship || project?.featured)
  const fallbackImage = '/images/hero-estate.jpg'

  const primaryImage =
    project.image ||
    (Array.isArray(project.images) && project.images[0]) ||
    (Array.isArray(project.gallery) && project.gallery[0]) ||
    fallbackImage

  const [imgSrc, setImgSrc] = useState(primaryImage)

  useEffect(() => {
    setImgSrc(primaryImage)
  }, [primaryImage])

  const handleImageError = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    if (imgSrc && typeof imgSrc === 'string' && imgSrc.startsWith('/images/plots/') && !imgSrc.startsWith('http')) {
      const fullUrl = `${apiUrl.replace(/\/$/, '')}${imgSrc}`
      if (imgSrc !== fullUrl) {
        setImgSrc(fullUrl)
        return
      }
    }
    const slugImage = project?.slug ? `/images/${project.slug}.jpg` : null
    if (slugImage && imgSrc !== slugImage && imgSrc !== fallbackImage) {
      setImgSrc(slugImage)
      return
    }
    setImgSrc(fallbackImage)
  }

  const projectSlug = project.slug || project.id || project.projectId
  const projectUrl = `/projects/${projectSlug}`

  // Format Area display
  const areaDisplay = (() => {
    const sanitize = (val) => String(val || '').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim()
    if (project.totalLandArea) return sanitize(project.totalLandArea)
    if (project.availableArea) return sanitize(project.availableArea)
    if (typeof project.area === 'number') return `${project.area.toLocaleString('en-IN')} ${project.unit || 'sq.ft'}`
    if (typeof project.area === 'string' && project.area.trim()) {
      const num = Number(project.area)
      return !isNaN(num) ? `${num.toLocaleString('en-IN')} ${project.unit || 'sq.ft'}` : sanitize(project.area)
    }
    if (project.plotSizes) return sanitize(project.plotSizes)
    return 'Individual Plots'
  })()

  // Format Price display
  const priceDisplay = (() => {
    if (project.priceDisplay) return project.priceDisplay
    if (project.priceFormatted) return project.priceFormatted
    if (project.price) return formatPrice(project.price)
    return 'Price on Request'
  })()

  // Format Location display
  const locationDisplay =
    project.location ||
    [project.village, project.taluk, project.district].filter(Boolean).join(', ') ||
    'Chennai'

  const propType = project.propertyType || project.type || 'Residential Plot'
  const propStatus = project.status || project.badge || 'Available'
  const rawTitle = project.name || project.projectName || 'Crystal Estates Property'
  const propTitle = rawTitle.replace(/_/g, ' ').trim()

  const statusStr = String(propStatus || '').trim().toLowerCase()
  const isSoldOut =
    statusStr === 'sold' ||
    statusStr === 'sold out' ||
    statusStr === 'soldout' ||
    Boolean(project.isSoldOut) ||
    (typeof project.availablePlots === 'number' &&
      project.availablePlots === 0 &&
      (project.totalPlots > 0 || (Array.isArray(project.plots) && project.plots.length > 0)))

  // Description / Narrative
  const description =
    project.description ||
    project.shortDescription ||
    project.overview ||
    project.tagline ||
    `Clear-titled ${propType.toLowerCase()} opportunity in ${locationDisplay} featuring complete legal scrutiny, DTCP/CMDA compliance, and direct road connectivity.`

  const totalPlots = project.totalPlots || (Array.isArray(project.plots) ? project.plots.length : 0)
  const approval = project.approval || project.approvalStatus || '100% Clear Title Patta'

  return (
    <article className={`news-project-card ${isFlagship ? 'news-project-card--flagship' : ''} ${className}`.trim()}>
      <Link href={projectUrl} className="news-project-card__link" aria-label={`View ${propTitle}`}>
        {/* 1. News-Style Rounded Image Container */}
        <div className="news-project-card__image-box">
          <Image
            src={imgSrc}
            alt={propTitle}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="news-project-card__image"
            loading="lazy"
            onError={handleImageError}
          />
          <div className="news-project-card__image-gradient" />

          {/* Top Badges */}
          <div className="news-project-card__badges-row">
            <span className="news-project-card__type-badge">
              {propType}
            </span>

            <span className={`news-project-card__status-badge ${isSoldOut ? 'is-soldout' : 'is-available'}`}>
              <span className="news-project-card__status-dot" />
              <span>{isSoldOut ? 'Sold Out' : propStatus}</span>
            </span>
          </div>
        </div>

        {/* 2. Structured Editorial Content Body */}
        <div className="news-project-card__content">
          {/* Location & Approval Meta */}
          <div className="news-project-card__meta-row">
            <div className="news-project-card__location" title={locationDisplay}>
              <MapPin size={14} className="news-project-card__meta-icon" />
              <span>{locationDisplay}</span>
            </div>

            <div className="news-project-card__approval" title={approval}>
              <ShieldCheck size={14} className="news-project-card__meta-icon" />
              <span>{approval}</span>
            </div>
          </div>

          {/* Project Title */}
          <h3 className="news-project-card__title">
            {propTitle}
          </h3>

          {/* Project Description (News-Style Excerpt) */}
          <p className="news-project-card__excerpt">
            {description}
          </p>

          {/* Specs Bar (Extent, Price & Plots) */}
          <div className="news-project-card__specs-grid">
            <div className="news-project-card__spec-item">
              <span className="news-project-card__spec-label">
                <Ruler size={12} />
                <span>Size / Extent</span>
              </span>
              <strong className="news-project-card__spec-value">{areaDisplay}</strong>
            </div>

            <div className="news-project-card__spec-item">
              <span className="news-project-card__spec-label">
                <IndianRupee size={12} />
                <span>Price</span>
              </span>
              <strong className="news-project-card__spec-value news-project-card__spec-value--price">
                {priceDisplay}
              </strong>
            </div>

            {totalPlots > 0 && (
              <div className="news-project-card__spec-item">
                <span className="news-project-card__spec-label">
                  <Layers size={12} />
                  <span>Layout</span>
                </span>
                <strong className="news-project-card__spec-value">{totalPlots} Plots</strong>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="news-project-card__footer">
            <span className="news-project-card__cta-text">
              {isSoldOut ? 'View Project Archive' : 'Explore Project'}
            </span>
            <div className="news-project-card__cta-btn" aria-hidden="true">
              <ArrowUpRight size={16} />
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}

export default ProjectCard
