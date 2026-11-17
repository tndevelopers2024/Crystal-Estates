'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin,
  ArrowLeft,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Camera,
  Download,
  CheckCircle2,
  Video,
  ArrowUpRight,
  Compass,
  FileCheck2,
  ShieldCheck,
  Building2,
  Lock,
  Eye,
  PhoneCall,
  Sparkles,
} from 'lucide-react'
import { Button } from '../ui'
import EnquiryForm from '../forms/EnquiryForm'
import { ProjectCard } from './ProjectCard'
import PlotViewer from '../plot-viewer/PlotViewer'
import { resolveMapEmbedUrl, resolveMapDirectUrl } from '../../lib/api'
import { parseViewBox } from '../../lib/svgUtils'
import { business } from '../../data/site'

export default function PropertyDetailClient({ initialProject, staticAllProjects = [] }) {
  const [project, setProject] = useState(initialProject)
  const [allProjects, setAllProjects] = useState(staticAllProjects)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)

  // Lock body scroll and listen for Escape when fullscreen plot modal is open
  useEffect(() => {
    if (!isFullScreenOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullScreenOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullScreenOpen])

  // Fetch updated project details dynamically from MongoDB
  useEffect(() => {
    fetch('/api/plots')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plots) && data.plots.length > 0) {
          setAllProjects(data.plots)

          const found = data.plots.find(
            (p) =>
              p.slug === initialProject?.slug ||
              p.id === initialProject?.id ||
              p.projectId === initialProject?.projectId ||
              p.projectId === initialProject?.id ||
              p._id === initialProject?.id
          )
          if (found) setProject(found)
        }
      })
      .catch(() => { })
  }, [initialProject])

  // Related projects (excluding current)
  const relatedProjects = useMemo(() => {
    return allProjects
      .filter(
        (p) =>
          p.id !== project.id &&
          p._id !== project.id &&
          (!p.slug || p.slug !== project.slug)
      )
      .slice(0, 3)
  }, [allProjects, project])

  // ─────────────────────────────────────────────────────────────
  // 1. DYNAMIC SECTION: PROJECT LAYOUT DATA (SUPPORTS MULTIPLE PHASES)
  // ─────────────────────────────────────────────────────────────
  const rawPhases =
    Array.isArray(project.layouts) && project.layouts.length > 0
      ? project.layouts
      : Array.isArray(project.phases) && project.phases.length > 0
        ? project.phases
        : null

  const fallbackLayoutUrl =
    project.layoutBackgroundUrl ||
    project.layoutUrl ||
    project.layoutPlan ||
    project.layoutImage ||
    null

  const layoutPhases = useMemo(() => {
    return (rawPhases && rawPhases.length > 0)
      ? rawPhases.map((l, idx) => {
        const phaseName = (l.name || `Phase ${idx + 1}`).trim()
        let phasePlots = Array.isArray(l.plots) ? l.plots : []
        if (phasePlots.length > 0 && phasePlots.some((p) => p.phase)) {
          phasePlots = phasePlots.filter(
            (p) => !p.phase || String(p.phase).trim().toLowerCase() === phaseName.toLowerCase()
          )
        } else if (phasePlots.length === 0 && Array.isArray(project.plots) && project.plots.length > 0) {
          phasePlots = project.plots.filter(
            (p) => p.phase && String(p.phase).trim().toLowerCase() === phaseName.toLowerCase()
          )
          if (phasePlots.length === 0 && idx === 0 && rawPhases.length === 1) {
            phasePlots = project.plots
          }
        }
        return {
          id: l.id || `phase-${idx + 1}`,
          name: phaseName,
          layoutUrl: l.layoutUrl || l.layoutBackgroundUrl || fallbackLayoutUrl,
          plots: phasePlots,
          viewBox: l.viewBox || project.viewBox || '0 0 1056 816',
          width: l.width || project.width || 1056,
          height: l.height || project.height || 816,
        }
      })
      : [
        {
          id: 'phase-1',
          name: 'Phase 1',
          layoutUrl: fallbackLayoutUrl,
          plots: Array.isArray(project.plots) ? project.plots : [],
          viewBox: project.viewBox || '0 0 1056 816',
          width: project.width || 1056,
          height: project.height || 816,
        },
      ]
  }, [rawPhases, project, fallbackLayoutUrl])

  const [activePhaseIndex, setActivePhaseIndex] = useState(0)
  const [previewImgError, setPreviewImgError] = useState(false)
  const currentPhase = layoutPhases[activePhaseIndex] || layoutPhases[0]
  const currentPhaseLayoutUrl = currentPhase?.layoutUrl || fallbackLayoutUrl
  const currentPhasePlots = currentPhase?.plots || []

  useEffect(() => {
    setPreviewImgError(false)
  }, [currentPhaseLayoutUrl])

  const hasLayout = Boolean(
    project.hasLayoutMap ||
    fallbackLayoutUrl ||
    layoutPhases.some((p) => p.layoutUrl || (p.plots && p.plots.length > 0))
  )
  const isSvgLayout = Boolean(currentPhaseLayoutUrl && /\.svg($|\?)/i.test(currentPhaseLayoutUrl))
  const isPdfLayout = Boolean(currentPhaseLayoutUrl && /\.pdf($|\?)/i.test(currentPhaseLayoutUrl))
  const isImageLayout = Boolean(
    currentPhaseLayoutUrl && /\.(png|jpe?g|webp|gif)($|\?)/i.test(currentPhaseLayoutUrl)
  )

  // Layout stats
  const totalPhasePlots = currentPhasePlots.length || project.totalPlots || 0
  const availablePhasePlots = currentPhasePlots.filter(
    (p) => String(p.status).toLowerCase() === 'available'
  ).length || project.availablePlots || 0
  const bookedPhasePlots = totalPhasePlots - availablePhasePlots

  // ─────────────────────────────────────────────────────────────
  // 2. DYNAMIC SECTION: PROJECT IMAGES & VIDEOS
  // ─────────────────────────────────────────────────────────────
  const rawImages = [
    ...(Array.isArray(project.images) ? project.images : []),
    ...(Array.isArray(project.gallery) ? project.gallery : []),
    ...(typeof project.image === 'string' ? [project.image] : []),
  ].filter((img) => typeof img === 'string' && img.trim().length > 0)

  const projectImages = Array.from(new Set(rawImages))
  const hasImages = projectImages.length > 0

  const rawVideos = []
  if (Array.isArray(project.videos)) {
    project.videos.forEach((v) => {
      if (typeof v === 'string' && v.trim().length > 0) {
        rawVideos.push({ url: v.trim(), name: 'Project Video' })
      } else if (v && typeof v === 'object' && v.url) {
        rawVideos.push({
          url: String(v.url).trim(),
          name: v.name || 'Project Video',
          size: v.size || '',
        })
      }
    })
  }
  ;[project.video, project.videoUrl, project.youtubeUrl, project.video_url].forEach((v) => {
    if (typeof v === 'string' && v.trim().length > 0) {
      rawVideos.push({ url: v.trim(), name: 'Project Video' })
    }
  })

  const seenVideoUrls = new Set()
  const projectVideos = rawVideos.filter((v) => {
    if (!v.url || seenVideoUrls.has(v.url)) return false
    seenVideoUrls.add(v.url)
    return true
  })
  const hasVideos = projectVideos.length > 0
  const hasMedia = hasImages || hasVideos

  const getEmbedVideoUrl = (url) => {
    if (!url) return ''
    if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) return url
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/)
    if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`
    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return url
  }

  // ─────────────────────────────────────────────────────────────
  // 3. DYNAMIC SECTION: MAP LOCATION DATA
  // ─────────────────────────────────────────────────────────────
  const mapLocationInput =
    project.mapLocation ||
    project.mapUrl ||
    project.googleMapsUrl ||
    project.mapEmbedUrl ||
    project.location

  const hasLocation = Boolean(
    (mapLocationInput && typeof mapLocationInput === 'string' && mapLocationInput.trim().length > 0) ||
    project.coordinates
  )

  const mapEmbedSrc = resolveMapEmbedUrl(
    mapLocationInput,
    `${project.location || project.name} Chennai`
  )
  const mapDirectLink = resolveMapDirectUrl(
    mapLocationInput,
    `${project.location || project.name} Chennai`
  )

  // Lazy load map iframe when scrolled near viewport
  const [isMapInView, setIsMapInView] = useState(false)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (typeof IntersectionObserver === 'undefined') {
      setIsMapInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsMapInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(mapRef.current)
    return () => observer.disconnect()
  }, [])

  // Lightbox handlers
  const openLightbox = (idx) => setLightboxIndex(idx)
  const closeLightbox = () => setLightboxIndex(null)
  const nextImage = useCallback(
    () => setLightboxIndex((prev) => (prev + 1) % projectImages.length),
    [projectImages.length]
  )
  const prevImage = useCallback(
    () =>
      setLightboxIndex(
        (prev) => (prev - 1 + projectImages.length) % projectImages.length
      ),
    [projectImages.length]
  )

  useEffect(() => {
    if (lightboxIndex === null || projectImages.length === 0) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') nextImage()
      if (e.key === 'ArrowLeft') prevImage()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, nextImage, prevImage, projectImages.length])

  // Price formatting
  const formattedPrice =
    project.priceDisplay ||
    (project.price && project.price > 0
      ? `₹ ${(Number(project.price) / 100000).toFixed(1)} Lakhs`
      : 'Price on Request')

  const isSoldOut =
    project.status === 'Sold Out' ||
    project.status === 'Sold' ||
    (typeof project.availablePlots === 'number' &&
      project.availablePlots === 0 &&
      project.totalPlots > 0)

  // Primary image
  const primaryHeroImage =
    project.image ||
    (projectImages.length > 0 ? projectImages[0] : null) ||
    '/images/hero-estate.jpg'

  return (
    <>
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. PROJECT NAME SECTION (PROMINENTLY AT TOP)               */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-hero-section">
        <div className="project-hero-container">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="project-hero__breadcrumb">
            <Link href="/">Home</Link>
            <span className="project-hero__breadcrumb-sep">/</span>
            <Link href="/projects">Projects</Link>
            <span className="project-hero__breadcrumb-sep">/</span>
            <span className="project-hero__breadcrumb-current">{project.name}</span>
          </nav>

          {/* Heading & Badges Header */}
          <div className="project-hero__header">
            <div className="project-hero__badge-row">
              <span className="project-hero__badge">
                ASSETS CREATOR • {project.type ? project.type.toUpperCase() : 'PROJECT'}
              </span>
              {project.approval && (
                <span className="project-hero__badge project-hero__badge--gold">
                  {project.approval}
                </span>
              )}
              <span
                className={`project-hero__badge ${isSoldOut
                  ? 'project-hero__badge--sold'
                  : 'project-hero__badge--status'
                  }`}
              >
                {isSoldOut ? 'Sold Out' : project.status || 'Available'}
              </span>
            </div>

            <h1 className="project-hero__title">
              {project.name}
            </h1>

            <p className="project-hero__subtitle">
              {project.description ||
                `Verified ${project.type || 'property'} located in ${project.location || 'Chennai'}. 100% legally clear title patta with complete revenue document verification.`}
            </p>

            {/* Project Quick Meta & Action Bar */}
            <div className="project-hero__meta-bar">
              <div className="project-hero__meta-left">
                {project.location && (
                  <div className="project-hero__meta-item">
                    <MapPin size={15} className="project-hero__meta-icon" />
                    <span>{project.location}</span>
                  </div>
                )}

                {(project.area || project.plotSizes) && (
                  <div className="project-hero__meta-item">
                    <Compass size={15} className="project-hero__meta-icon" />
                    <span>{project.area || project.plotSizes}</span>
                  </div>
                )}

                {project.facing && (
                  <div className="project-hero__meta-item">
                    <Compass size={15} className="project-hero__meta-icon" />
                    <span>Facing: {project.facing}</span>
                  </div>
                )}

                <div className="project-hero__meta-item project-hero__meta-price">
                  <span>{formattedPrice}</span>
                </div>
              </div>

              {/* <Link href="/projects" className="project-hero__back-btn">
                <ArrowLeft size={15} />
                <span>Back to Projects Directory</span>
              </Link> */}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. PLOT SECTION (SVG LAYOUT PREVIEW WITH BOOK A PLOT BUTTON) */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-plot-section" id="plot-section">
        <div className="project-plot-container">
          {hasLayout ? (
            <div className="project-plot-card">
              {/* Top Header / Meta Bar above SVG Layout */}
              <div className="project-plot-card__header">
                <div className="project-plot-card__header-left">
                  <span className="project-live-indicator" />
                  <h3 className="project-plot-card__heading">
                    {project.name} Sanctioned Plot Layout
                  </h3>
                  <span className="project-plot-card__phase-badge">
                    {currentPhase.name}
                  </span>
                </div>

                <div className="project-plot-card__header-right">
                  {/* Phase Switcher Tabs (if multi-phase) */}
                  {layoutPhases.length > 1 && (
                    <div className="project-plot-phases">
                      {layoutPhases.map((phase, idx) => {
                        const isSelected = idx === activePhaseIndex
                        const plotCount = (phase.plots || []).length
                        return (
                          <button
                            key={phase.id || idx}
                            type="button"
                            onClick={() => setActivePhaseIndex(idx)}
                            className={`project-plot-phase-tab ${isSelected ? 'is-active' : ''}`}
                            title={`Switch to ${phase.name}`}
                          >
                            <span>{phase.name}</span>
                            <span className="project-plot-phase-badge">
                              {plotCount} Plots
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="project-plot-card__stats-plain">
                    {totalPhasePlots > 0 && (
                      <span className="project-plot-stat-plain">
                        <span className="project-plot-stat-plain__label">Total:</span>{' '}
                        <strong className="project-plot-stat-plain__count">{totalPhasePlots}</strong>
                      </span>
                    )}
                    {availablePhasePlots > 0 && (
                      <span className="project-plot-stat-plain project-plot-stat-plain--avail">
                        <span className="project-plot-stat-plain__label">Available:</span>{' '}
                        <strong className="project-plot-stat-plain__count">{availablePhasePlots}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Non-Interactive SVG Plot Layout Preview */}
              <div
                className="project-svg-preview-stage"
                onClick={() => setIsFullScreenOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setIsFullScreenOpen(true)
                  }
                }}
                title="Click to explore interactive plot layout in full screen"
                aria-label="Click to open interactive plot layout in full-screen view"
              >
                <div className="project-svg-preview-viewport">
                  {currentPhaseLayoutUrl && !previewImgError ? (
                    <div className="project-svg-preview-layers" style={{ pointerEvents: 'none' }}>
                      <img
                        src={currentPhaseLayoutUrl}
                        alt={`${project.name} ${currentPhase.name} Layout SVG`}
                        className="project-svg-preview-bg"
                        draggable={false}
                        onError={() => setPreviewImgError(true)}
                      />
                      {currentPhasePlots.some((p) => p.svgPath) && (
                        <svg
                          viewBox={parseViewBox(currentPhase.viewBox || project.viewBox, 1056, 816).viewBoxStr}
                          className="project-svg-preview-svg"
                        >
                          {currentPhasePlots.filter((p) => p.svgPath).map((plot) => (
                            <g
                              key={plot.id || plot.plotNo}
                              className={`pv-plot pv-plot--${plot.status}`}
                            >
                              <path
                                d={plot.svgPath}
                                className="pv-plot__boundary"
                              />
                            </g>
                          ))}
                        </svg>
                      )}
                    </div>
                  ) : currentPhaseLayoutUrl && previewImgError ? (
                    <div className="project-svg-preview-layers" style={{ pointerEvents: 'none' }}>
                      <div className="pv-blueprint-grid" style={{ position: 'absolute', inset: 0, opacity: 0.15 }} />
                      {currentPhasePlots.some((p) => p.svgPath) && (
                        <svg
                          viewBox={parseViewBox(currentPhase.viewBox || project.viewBox, 1056, 816).viewBoxStr}
                          className="project-svg-preview-svg"
                        >
                          {currentPhasePlots.filter((p) => p.svgPath).map((plot) => (
                            <g
                              key={plot.id || plot.plotNo}
                              className={`pv-plot pv-plot--${plot.status}`}
                            >
                              <path
                                d={plot.svgPath}
                                className="pv-plot__boundary"
                              />
                            </g>
                          ))}
                        </svg>
                      )}
                    </div>
                  ) : isPdfLayout ? (
                    <div className="project-pdf-frame" style={{ pointerEvents: 'none', height: '400px' }}>
                      <iframe
                        src={currentPhaseLayoutUrl}
                        title={`${project.name} ${currentPhase.name} Blueprint PDF`}
                      />
                    </div>
                  ) : (
                    <div className="project-svg-preview-empty">
                      <p>Layout map is being prepared for this phase.</p>
                    </div>
                  )}
                </div>

                {/* Prompt Pill to Open Fullscreen */}
                <div className="project-svg-preview-overlay-prompt">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsFullScreenOpen(true)
                    }}
                    className="project-svg-preview-prompt-pill"
                    title="Open interactive master plan in full-screen"
                    aria-label="Open full-screen interactive plot layout"
                  >
                    <Maximize2 size={13} />
                    <span>Click to open full-screen</span>
                  </button>
                </div>
              </div>

              {/* Action Area Below SVG Layout with "Book a Plot" Button */}
              <div className="project-plot-book-action-bar">
                <button
                  type="button"
                  onClick={() => setIsFullScreenOpen(true)}
                  className="project-book-plot-btn"
                  id="book-a-plot-btn"
                  aria-label="Book a Plot - Open full-screen interactive plot layout"
                >
                  <Layers size={18} />
                  <span>Book a Plot</span>
                  <span className="project-book-plot-btn__arrow" aria-hidden="true">
                    <ArrowUpRight size={17} />
                  </span>
                </button>

                <p className="project-plot-book-hint">
                  Click &ldquo;Book a Plot&rdquo; or &ldquo;Click to open full-screen&rdquo; to open the full-screen view and easily interact with plot details, measurements, and live booking.
                </p>
              </div>
            </div>
          ) : (
            /* Fallback if no layout blueprint is uploaded yet */
            <div className="project-plot-card project-plot-card--empty">
              <div className="project-plot-preview-overlay">
                <span className="project-plot-preview-badge">
                  <Layers size={14} />
                  <span>MASTER PLAN BLUEPRINT</span>
                </span>
                <h3 className="project-plot-preview-title">
                  Layout Demarcation in Progress
                </h3>
                <p className="project-plot-preview-desc">
                  Digital survey verification is currently being updated for {project.name}. Contact our land desk for sanctioned FMB sketches and individual layout copies.
                </p>
                <a href="#contact-section" className="project-book-plot-btn">
                  <span>Enquire for Layout Sketch</span>
                  <span className="project-book-plot-btn__arrow">
                    <ArrowUpRight size={16} />
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. PLOT DETAILS SECTION (DEDICATED SECTION BELOW PLOT)     */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-detail-section project-detail-section--white" id="plot-details">
        <div className="project-detail-container">
          <div className="project-section-header">
            <span className="project-section-eyebrow">
              PLOT SPECIFICATIONS &amp; PARAMETERS
            </span>
            <h2 className="project-section-title">
              Comprehensive Land Information &amp; Approvals
            </h2>
            <p className="project-section-subtitle">
              Verified survey extents, layout approvals, avenue widths, and ownership documentation for {project.name}.
            </p>
          </div>

          {/* Metric Strips (Inspired by Reference Image Horizontal Stat Rows) */}
          <div className="project-metric-rows">
            <div className="project-metric-row">
              <div className="project-metric-row__info">
                <strong className="project-metric-row__title">Standard Plotted Extents</strong>
                <p className="project-metric-row__desc">Carefully demarcated residential and farm parcel dimensions with clear corner stones.</p>
              </div>
              <div className="project-metric-row__stat">
                {project.area || project.plotSizes || '1200+ Sq.ft'}
              </div>
            </div>

            <div className="project-metric-row">
              <div className="project-metric-row__info">
                <strong className="project-metric-row__title">Individual Patta Ownership</strong>
                <p className="project-metric-row__desc">Guaranteed immediate online computerized Patta transfer directly in the buyer’s name.</p>
              </div>
              <div className="project-metric-row__stat project-metric-row__stat--green">
                100% Patta
              </div>
            </div>

            <div className="project-metric-row">
              <div className="project-metric-row__info">
                <strong className="project-metric-row__title">Parent Title Due Diligence</strong>
                <p className="project-metric-row__desc">Exhaustive 30-year legal link document vetting and nil-encumbrance certificate assurance.</p>
              </div>
              <div className="project-metric-row__stat">
                30+ Years
              </div>
            </div>

            <div className="project-metric-row">
              <div className="project-metric-row__info">
                <strong className="project-metric-row__title">Government Approval Clearance</strong>
                <p className="project-metric-row__desc">Sanctioned planning approvals compliant with road widths, OSR spaces, and bank loan pre-clearance.</p>
              </div>
              <div className="project-metric-row__stat project-metric-row__stat--gold">
                {project.approval || 'DTCP / CMDA'}
              </div>
            </div>
          </div>

          {/* 2-Column Specifications & Legal Checklist Grid */}
          <div className="project-specs-grid">
            {/* Left: Detailed Parameters Grid */}
            <div className="project-specs-col">
              <h3 className="project-subsection-title">
                Technical Land Specifications
              </h3>

              <div className="project-specs-tiles">
                {(project.area || project.plotSizes) && (
                  <div className="project-spec-tile">
                    <span className="project-spec-label">Extent / Land Area</span>
                    <strong className="project-spec-val">{project.area || project.plotSizes}</strong>
                  </div>
                )}

                {project.plotSizes && (
                  <div className="project-spec-tile">
                    <span className="project-spec-label">Available Plot Sizes</span>
                    <strong className="project-spec-val">{project.plotSizes}</strong>
                  </div>
                )}

                {project.facing && (
                  <div className="project-spec-tile">
                    <span className="project-spec-label">Facing Orientation</span>
                    <strong className="project-spec-val">{project.facing}</strong>
                  </div>
                )}

                <div className="project-spec-tile">
                  <span className="project-spec-label">Road Infrastructure</span>
                  <strong className="project-spec-val">30 ft &amp; 40 ft Blacktop Roads</strong>
                </div>

                <div className="project-spec-tile">
                  <span className="project-spec-label">Title Ownership</span>
                  <strong className="project-spec-val project-spec-val--green">
                    <FileCheck2 size={14} />
                    100% Individual Patta
                  </strong>
                </div>

                <div className="project-spec-tile">
                  <span className="project-spec-label">Sanction Authority</span>
                  <strong className="project-spec-val project-spec-val--green">
                    <ShieldCheck size={14} />
                    {project.approval || 'DTCP / CMDA Sanctioned'}
                  </strong>
                </div>

                {project.surveyNumber && (
                  <div className="project-spec-tile">
                    <span className="project-spec-label">Revenue Survey No.</span>
                    <strong className="project-spec-val">{project.surveyNumber}</strong>
                  </div>
                )}

                <div className="project-spec-tile project-spec-tile--price">
                  <span className="project-spec-label">Investment Price</span>
                  <strong className="project-spec-val project-spec-val--gold">{formattedPrice}</strong>
                </div>
              </div>
            </div>

            {/* Right: Buyer Assurance & Legal Checklist Card */}
            <div className="project-checklist-col">
              <div className="project-checklist-card">
                <span className="project-checklist-badge">
                  BUYER ASSURANCE MANDATE
                </span>
                <h3 className="project-checklist-title">
                  Legal &amp; Infrastructure Standards
                </h3>
                <p className="project-checklist-desc">
                  Every property curated by Crystal Estates fulfills our rigorous 6-point verification mandate before presentation.
                </p>

                <div className="project-checklist-items">
                  <div className="project-checklist-item">
                    <CheckCircle2 size={18} className="project-checklist-icon" />
                    <div>
                      <strong>30+ Years Parent Title Scrutiny</strong>
                      <p>Exhaustive legal link audit and nil-encumbrance certificate certification.</p>
                    </div>
                  </div>

                  <div className="project-checklist-item">
                    <CheckCircle2 size={18} className="project-checklist-icon" />
                    <div>
                      <strong>Computerized Patta Handover</strong>
                      <p>Complete revenue department liaison until physical patta transfer to your name.</p>
                    </div>
                  </div>

                  <div className="project-checklist-item">
                    <CheckCircle2 size={18} className="project-checklist-icon" />
                    <div>
                      <strong>Physical Demarcation Stones</strong>
                      <p>Boundary stones firmly demarcated on ground according to sanctioned FMB sketches.</p>
                    </div>
                  </div>

                  <div className="project-checklist-item">
                    <CheckCircle2 size={18} className="project-checklist-icon" />
                    <div>
                      <strong>Avenue Road Connectivity</strong>
                      <p>Wide internal blacktop/concrete avenues with planned avenue plantation and drainage.</p>
                    </div>
                  </div>

                  <div className="project-checklist-item">
                    <CheckCircle2 size={18} className="project-checklist-icon" />
                    <div>
                      <strong>Bank Approval Eligibility</strong>
                      <p>Pre-cleared with nationalized and private banks for hassle-free plot purchase loans.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. GALLERY (DEDICATED IMAGES & VIDEOS SECTION)            */}
      {/* ────────────────────────────────────────────────────────── */}
      {hasMedia && (
        <section className="project-detail-section project-detail-section--warm" id="gallery">
          <div className="project-detail-container">
            <div className="project-section-header">
              <span className="project-section-eyebrow">
                VISUAL DOCUMENTATION
              </span>
              <h2 className="project-section-title">
                Project Photographs &amp; Video Walkthrough
              </h2>
              <p className="project-section-subtitle">
                On-ground photography, perimeter boundaries, and video walkthrough of {project.name}{project.location ? ` in ${project.location}` : ''}.
              </p>
            </div>

            {/* Photo Gallery Grid */}
            {hasImages && (
              <div
                className={`project-gallery-grid ${projectImages.length === 1 ? 'project-gallery-grid--single' : ''
                  }`}
              >
                {projectImages.map((imgSrc, idx) => (
                  <div
                    key={idx}
                    onClick={() => openLightbox(idx)}
                    className="project-gallery-item"
                  >
                    <img
                      src={imgSrc}
                      alt={`${project.name} photo ${idx + 1}`}
                      className="project-gallery-img"
                    />
                    <div className="project-gallery-badge">
                      <Maximize2 size={13} /> Click to expand
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Video Walkthrough (if videos available) */}
            {hasVideos && (
              <div className="project-videos-wrapper">
                <div className="project-videos-heading-row">
                  <span className="project-section-eyebrow">AERIAL &amp; GROUND WALKTHROUGH</span>
                  <h3 className="project-videos-heading">
                    <Video size={19} />
                    <span>Watch Site Walkthrough</span>
                  </h3>
                </div>

                <div
                  className={`project-videos-grid ${projectVideos.length === 1 ? 'project-videos-grid--single' : ''
                    }`}
                >
                  {projectVideos.map((vidObj, vIdx) => {
                    const vidUrl = typeof vidObj === 'string' ? vidObj : vidObj.url
                    const vidName = typeof vidObj === 'object' && vidObj.name ? vidObj.name : `Video ${vIdx + 1}`
                    const isDirectVideo =
                      vidUrl.match(/\.(mp4|webm|ogg)($|\?)/i) ||
                      vidUrl.startsWith('/videos/') ||
                      vidUrl.includes('video-')
                    return (
                      <div key={vIdx} className="project-video-frame">
                        {isDirectVideo ? (
                          <video
                            controls
                            playsInline
                            preload="metadata"
                            src={vidUrl}
                            suppressHydrationWarning
                          />
                        ) : (
                          <iframe
                            src={getEmbedVideoUrl(vidUrl)}
                            title={`${project.name} ${vidName}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 5. MAP & CONTACT US (DEDICATED SECTION)                    */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-detail-section project-detail-section--white" id="contact-section">
        <div className="project-detail-container">
          <div className="project-section-header">
            <span className="project-section-eyebrow">
              LOCATION &amp; CONTACT US
            </span>
            <h2 className="project-section-title">
              Geographical Access &amp; Contact Us
            </h2>
            <p className="project-section-subtitle">
              Navigate road access to {project.name} or schedule a guided weekend site visit with our senior consultants.
            </p>
          </div>

          <div className={`project-map-enquiry-grid ${!hasLocation ? 'project-map-enquiry-grid--single' : ''}`}>
            {/* Left: Location Map Card */}
            {hasLocation && (
              <div className="project-map-card">
                <div className="project-map-card__header">
                  <div className="project-map-card__tag">
                    <MapPin size={14} />
                    <span>MAP NAVIGATION</span>
                  </div>
                  <h3 className="project-map-card__title">
                    Road Access &amp; Corridors
                  </h3>
                  <p className="project-map-card__desc">
                    Pinpoint geographical coordinates for {project.location || project.name}.
                  </p>
                </div>

                <div className="project-map-frame" ref={mapRef}>
                  <a
                    href={mapDirectLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="project-map-direct-link"
                  >
                    <span>Open in Google Maps</span>
                    <ArrowUpRight size={13} />
                  </a>
                  {isMapInView ? (
                    <iframe
                      title={`${project.name} Location Map`}
                      loading="lazy"
                      allowFullScreen
                      src={mapEmbedSrc}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        minHeight: '320px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(234, 243, 230, 0.6)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-manrope)',
                        background: '#0a2214',
                      }}
                    >
                      <span>Interactive map loading on scroll...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right: Direct Enquiry Form Card */}
            <div className="project-enquiry-col">
              <EnquiryForm
                selectedPlot={project}
                prefillInterest={project.name}
                title={`Contact Us for ${project.name}`}
                subtitle="Connect directly with our land advisory desk for verified documentation, pricing breakdown, or guided weekend site visit."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 6. SIMILAR LAND OPPORTUNITIES (DEDICATED SECTION)          */}
      {/* ────────────────────────────────────────────────────────── */}
      {relatedProjects.length > 0 && (
        <section className="project-detail-section project-detail-section--warm">
          <div className="project-detail-container">
            <div className="project-section-header">
              <span className="project-section-eyebrow">
                SIMILAR LAND OPPORTUNITIES
              </span>
              <h2 className="project-section-title">
                Other Approved Plots &amp; Farmland in Chennai
              </h2>
              <p className="project-section-subtitle">
                Explore more verified residential plotted developments and managed agro-forestry farmland across Chennai growth corridors.
              </p>
            </div>

            <div className="project-similar-grid">
              {relatedProjects.map((rel) => (
                <ProjectCard key={rel.id || rel._id} project={rel} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* IMAGE LIGHTBOX MODAL                                       */}
      {/* ────────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && projectImages.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image Lightbox"
          className="project-lightbox-overlay"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="project-lightbox-close"
            aria-label="Close Lightbox"
          >
            <X size={24} />
          </button>

          {projectImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                prevImage()
              }}
              className="project-lightbox-prev"
              aria-label="Previous Image"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <div
            className="project-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={projectImages[lightboxIndex]}
              alt={`${project.name} preview`}
              className="project-lightbox-img"
            />
            <p className="project-lightbox-caption">
              {project.name} — Photo {lightboxIndex + 1} of {projectImages.length}
            </p>
          </div>

          {projectImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                nextImage()
              }}
              className="project-lightbox-next"
              aria-label="Next Image"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* COMPLETE PLOT LAYOUT FULL-SCREEN VIEW (TRIGGERED BY BOOK A PLOT) */}
      {/* ────────────────────────────────────────────────────────── */}
      {isFullScreenOpen && (
        <div
          className="project-fullscreen-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${project.name} Fullscreen Plot Layout`}
        >
          {/* Fullscreen Interactive Plot Viewer with Unified Minimal Header */}
          <div className="project-fullscreen-body">
            <PlotViewer
              key={`fs-${project.id || project.slug}-${currentPhase.id || activePhaseIndex}-${currentPhaseLayoutUrl}`}
              initialPlots={currentPhasePlots}
              phases={layoutPhases}
              activePhase={activePhaseIndex}
              onPhaseChange={(idx) => setActivePhaseIndex(idx)}
              fetchUrl={null}
              backgroundUrl={currentPhaseLayoutUrl}
              metadata={{
                title: project.name,
                sNo: project.surveyNumber || '',
                village: project.village || project.location || '',
                taluk: project.taluk || '',
                layoutBackgroundUrl: currentPhaseLayoutUrl,
                viewBox: parseViewBox(currentPhase.viewBox || project.viewBox, 1056, 816).viewBoxStr,
                layouts: layoutPhases,
                phases: layoutPhases,
              }}
              whatsappNumber={business.whatsapp}
              onClose={() => setIsFullScreenOpen(false)}
              isModal={true}
            />
          </div>
        </div>
      )}
    </>
  )
}
