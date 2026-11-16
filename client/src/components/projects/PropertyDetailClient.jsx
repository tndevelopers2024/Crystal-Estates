'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  Share2,
} from 'lucide-react'
import { Button } from '../ui'
import EnquiryForm from '../forms/EnquiryForm'
import { ProjectCard } from './ProjectCard'
import PlotViewer from '../plot-viewer/PlotViewer'
import { resolveMapEmbedUrl, resolveMapDirectUrl } from '../../lib/api'

export default function PropertyDetailClient({ initialProject, staticAllProjects = [] }) {
  const [project, setProject] = useState(initialProject)
  const [allProjects, setAllProjects] = useState(staticAllProjects)
  const [lightboxIndex, setLightboxIndex] = useState(null)

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
      .catch(() => {})
  }, [initialProject])

  // Related projects (excluding current)
  const relatedProjects = allProjects
    .filter(
      (p) =>
        p.id !== project.id &&
        p._id !== project.id &&
        (!p.slug || p.slug !== project.slug)
    )
    .slice(0, 3)

  // ─────────────────────────────────────────────────────────────
  // 1. DYNAMIC SECTION 1: PROJECT LAYOUT DATA (SUPPORTS MULTIPLE PHASES)
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

  const layoutPhases = (rawPhases && rawPhases.length > 0)
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

  const [activePhaseIndex, setActivePhaseIndex] = useState(0)
  const currentPhase = layoutPhases[activePhaseIndex] || layoutPhases[0]
  const currentPhaseLayoutUrl = currentPhase?.layoutUrl || fallbackLayoutUrl
  const currentPhasePlots = currentPhase?.plots || []

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

  // ─────────────────────────────────────────────────────────────
  // 2. DYNAMIC SECTION 2: PROJECT IMAGES & VIDEOS
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
  // 3. DYNAMIC SECTION 3: MAP LOCATION DATA
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
      {/* 1. HERO SECTION (ALIGNED WITH ABOUT US DESIGN LANGUAGE)   */}
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
                className={`project-hero__badge ${
                  isSoldOut
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

                <div className="project-hero__meta-item project-hero__meta-price">
                  <span>{formattedPrice}</span>
                </div>
              </div>

              <Link href="/projects" className="project-hero__back-btn">
                <ArrowLeft size={15} />
                <span>Back to Projects Directory</span>
              </Link>
            </div>
          </div>

          {/* Wide Hero Architectural Banner */}
          <div className="project-hero__image-wrap">
            <Image
              src={primaryHeroImage}
              alt={project.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1360px"
              className="project-hero__image"
            />
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. SPECIFICATIONS & HIGHLIGHTS (WHITE BACKGROUND SECTION)  */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-detail-section project-detail-section--white">
        <div className="project-detail-container">
          <div className="project-specs-grid">
            {/* Left: Key Dimensions & Specifications Tiles */}
            <div className="project-specs-col">
              <span className="project-section-eyebrow">
                LAND SPECIFICATIONS
              </span>
              <h2 className="project-section-title">
                Key Dimensions &amp; Approvals
              </h2>
              <p className="project-section-subtitle">
                Official layout measurements and approval clearances for {project.name}.
              </p>

              <div className="project-specs-tiles">
                {(project.area || project.plotSizes) && (
                  <div className="project-spec-tile">
                    <span className="project-spec-label">Extent / Size</span>
                    <strong className="project-spec-val">{project.area || project.plotSizes}</strong>
                  </div>
                )}

                {project.plotSizes && (
                  <div className="project-spec-tile">
                    <span className="project-spec-label">Plot Sizes</span>
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
                  <span className="project-spec-label">Title Ownership</span>
                  <strong className="project-spec-val project-spec-val--green">
                    <FileCheck2 size={14} />
                    100% Individual Patta
                  </strong>
                </div>

                <div className="project-spec-tile">
                  <span className="project-spec-label">Sanction Status</span>
                  <strong className="project-spec-val project-spec-val--green">
                    <ShieldCheck size={14} />
                    {project.approval || 'DTCP / CMDA Verified'}
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

            {/* Right: Verified Legal & Infrastructure Checklist */}
            <div className="project-checklist-col">
              <div className="project-checklist-card">
                <span className="project-checklist-badge">
                  BUYER ASSURANCE
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
                      <p>Pre-cleared with nationalized and private banks for hassle-free plot loans.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. INTERACTIVE MASTER PLAN & PARCEL LAYOUT (WARM SECTION)  */}
      {/* ────────────────────────────────────────────────────────── */}
      {hasLayout && (
        <section className="project-detail-section project-detail-section--warm">
          <div className="project-detail-container">
            <div className="project-section-header">
              <span className="project-section-eyebrow">
                PROJECT MASTER PLAN
              </span>
              <h2 className="project-section-title">
                Interactive Parcel Layout &amp; Live Availability
              </h2>
              <p className="project-section-subtitle">
                Inspect surveyed boundaries, plot dimensions, internal road networks, and live availability for {project.name}.
              </p>
            </div>

            <div className="project-layout-wrapper">
              {/* Phase Switcher Tabs (if multi-phase) */}
              {layoutPhases.length > 1 && (
                <div className="project-layout-tabs">
                  <span className="project-layout-tabs__label">
                    Select Phase:
                  </span>
                  {layoutPhases.map((phase, idx) => {
                    const isSelected = idx === activePhaseIndex
                    const plotCount = (phase.plots || []).length
                    return (
                      <button
                        key={phase.id || idx}
                        type="button"
                        onClick={() => setActivePhaseIndex(idx)}
                        className={`project-layout-tab ${isSelected ? 'is-active' : ''}`}
                      >
                        <span>{phase.name}</span>
                        <span className="project-layout-tab__badge">
                          {plotCount} {plotCount === 1 ? 'Plot' : 'Plots'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Layout Viewer Display */}
              {(project.hasLayoutMap || isSvgLayout || currentPhasePlots.length > 0) && currentPhaseLayoutUrl ? (
                <div className="project-plot-viewer-box">
                  <PlotViewer
                    key={`${project.id || project.slug}-${currentPhase.id || activePhaseIndex}-${currentPhaseLayoutUrl}`}
                    initialPlots={currentPhasePlots}
                    phases={layoutPhases}
                    activePhase={activePhaseIndex}
                    onPhaseChange={(idx) => setActivePhaseIndex(idx)}
                    fetchUrl={null}
                    backgroundUrl={currentPhaseLayoutUrl}
                    metadata={{
                      title: `${project.name}${layoutPhases.length > 1 ? ` (${currentPhase.name})` : ''}`,
                      sNo: project.surveyNumber || '',
                      village: project.village || project.location || '',
                      taluk: project.taluk || '',
                      layoutBackgroundUrl: currentPhaseLayoutUrl,
                      viewBox: currentPhase.viewBox || project.viewBox || '0 0 1056 816',
                      layouts: layoutPhases,
                      phases: layoutPhases,
                    }}
                    whatsappNumber="919444000000"
                    backHref={`/projects/${project.slug || project.id}`}
                  />
                  <div className="project-layout-footer-btn">
                    <Button
                      href={`/layout-viewer?slug=${project.layoutSlug || project.slug || project.id}&phase=${encodeURIComponent(currentPhase.id || currentPhase.name)}`}
                      variant="outline"
                      size="sm"
                    >
                      <Maximize2 size={14} />
                      <span>Open Fullscreen Interactive Layout Viewer{layoutPhases.length > 1 ? ` (${currentPhase.name})` : ''}</span>
                    </Button>
                  </div>
                </div>
              ) : isPdfLayout ? (
                <div className="project-pdf-box">
                  <div className="project-pdf-frame">
                    <iframe
                      src={currentPhaseLayoutUrl}
                      title={`${project.name} ${currentPhase.name} Blueprint PDF`}
                    />
                  </div>
                  <div className="project-pdf-actions">
                    <span className="project-pdf-name">
                      <strong>{project.layoutFileName || `${currentPhase.name} Layout Blueprint (PDF)`}</strong>
                    </span>
                    <a
                      href={currentPhaseLayoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-pdf-btn"
                    >
                      <Download size={14} />
                      <span>Open / Download Blueprint PDF</span>
                    </a>
                  </div>
                </div>
              ) : isImageLayout || project.layoutImage ? (
                <div
                  className="project-image-layout-box"
                  onClick={() => {
                    const imgToOpen = currentPhaseLayoutUrl || project.layoutImage
                    const idx = projectImages.indexOf(imgToOpen)
                    if (idx >= 0) openLightbox(idx)
                  }}
                >
                  <img
                    src={currentPhaseLayoutUrl || project.layoutImage}
                    alt={`${project.name} ${currentPhase.name} Layout Plan`}
                    className="project-image-layout-img"
                  />
                  <div className="project-image-layout-badge">
                    <Maximize2 size={13} /> Click to expand blueprint
                  </div>
                </div>
              ) : currentPhaseLayoutUrl ? (
                <div className="project-layout-fallback">
                  <p>
                    Uploaded layout blueprint file (<strong>{project.layoutFileName || `${currentPhase.name} Blueprint File`}</strong>) is ready for download and viewing.
                  </p>
                  <a
                    href={currentPhaseLayoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--primary btn--sm"
                  >
                    <Layers size={14} />
                    <span>View / Download Sanctioned Layout File</span>
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. SITE PHOTOGRAPHS & VIDEOS (WHITE BACKGROUND SECTION)   */}
      {/* ────────────────────────────────────────────────────────── */}
      {hasMedia && (
        <section className="project-detail-section project-detail-section--white">
          <div className="project-detail-container">
            <div className="project-section-header">
              <span className="project-section-eyebrow">
                VISUAL DOCUMENTATION
              </span>
              <h2 className="project-section-title">
                {hasVideos ? 'Site Photographs & Video Walkthrough' : 'Site & Property Photographs'}
              </h2>
              <p className="project-section-subtitle">
                On-ground photography and aerial perspectives from {project.name}{project.location ? ` in ${project.location}` : ''}.
              </p>
            </div>

            {/* Photo Gallery Grid */}
            {hasImages && (
              <div
                className={`project-gallery-grid ${
                  projectImages.length === 1 ? 'project-gallery-grid--single' : ''
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
                {hasImages && (
                  <h3 className="project-videos-heading">
                    <Video size={18} />
                    <span>Project Video Walkthrough</span>
                  </h3>
                )}
                <div
                  className={`project-videos-grid ${
                    projectVideos.length === 1 ? 'project-videos-grid--single' : ''
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
      {/* 5. LOCATION MAP & DIRECT ENQUIRY (WARM BACKGROUND SECTION) */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-detail-section project-detail-section--warm">
        <div className="project-detail-container">
          <div className="project-section-header">
            <span className="project-section-eyebrow">
              GEOGRAPHICAL ACCESS &amp; SITE VISIT
            </span>
            <h2 className="project-section-title">
              Location Map &amp; Direct Consultation
            </h2>
            <p className="project-section-subtitle">
              Plan your visit or request complete title documentation from our senior land consultants.
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

                <div className="project-map-frame">
                  <a
                    href={mapDirectLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="project-map-direct-link"
                  >
                    <span>Open in Google Maps</span>
                    <ArrowUpRight size={13} />
                  </a>
                  <iframe
                    title={`${project.name} Location Map`}
                    loading="lazy"
                    allowFullScreen
                    src={mapEmbedSrc}
                  />
                </div>
              </div>
            )}

            {/* Right: Direct Enquiry Form Card */}
            <div className="project-enquiry-col">
              <EnquiryForm
                selectedPlot={project}
                prefillInterest={project.name}
                title={`Enquire for ${project.name}`}
                subtitle="Connect directly with our land advisory desk for verified documentation, pricing breakdown, or guided weekend site visit."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 6. SIMILAR LAND OPPORTUNITIES (WHITE BACKGROUND SECTION)  */}
      {/* ────────────────────────────────────────────────────────── */}
      {relatedProjects.length > 0 && (
        <section className="project-detail-section project-detail-section--white">
          <div className="project-detail-container">
            <div className="project-section-header">
              <span className="project-section-eyebrow">
                EXPLORE MORE PROPERTIES
              </span>
              <h2 className="project-section-title">
                Similar Land Opportunities in Chennai
              </h2>
              <p className="project-section-subtitle">
                Explore more approved residential plotted developments and managed agro-forestry farmland across Chennai corridors.
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
      {/* 7. IMAGE LIGHTBOX MODAL                                   */}
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
    </>
  )
}
