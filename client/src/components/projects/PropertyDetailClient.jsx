'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  MapPin,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  CheckCircle2,
  Video,
  ArrowUpRight,
  FileCheck2,
  ShieldCheck,
  Check,
} from 'lucide-react'
import EnquiryForm from '../forms/EnquiryForm'
import PlotViewer from '../plot-viewer/PlotViewer'
import ExploreGuide from './ExploreGuide'
import ProjectGallery3D from './ProjectGallery3D'
import { resolveMapEmbedUrl, resolveMapDirectUrl } from '../../lib/api'
import { parseViewBox } from '../../lib/svgUtils'
import { business } from '../../data/site'
import { Eyebrow, PillLink } from '../home/motion'

export default function PropertyDetailClient({ initialProject, staticAllProjects = [] }) {
  const [project, setProject] = useState(initialProject)
  const [allProjects, setAllProjects] = useState(staticAllProjects)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  const [selectedPlot, setSelectedPlot] = useState(null)

  // Lock body scroll while the full-view plot modal is open. Escape is handled
  // by the PlotViewer itself: first press clears a selected plot, next closes.
  useEffect(() => {
    if (!isFullScreenOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Pause smooth scrolling so wheel/touch go to the layout, not the page behind
    const lenis = window.__lenis
    lenis?.stop()

    return () => {
      document.body.style.overflow = originalOverflow
      lenis?.start()
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
          // Merge so fields the server already normalized (e.g. `area`) are
          // not blanked when the raw API record lacks them
          if (found) {
            const fresh = Object.fromEntries(
              Object.entries(found).filter(([, v]) => v !== null && v !== undefined && v !== ''),
            )
            setProject((prev) => ({ ...prev, ...fresh }))
          }
        }
      })
      .catch(() => { })
  }, [initialProject])

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
  const currentPhase = layoutPhases[activePhaseIndex] || layoutPhases[0]
  const currentPhaseLayoutUrl = currentPhase?.layoutUrl || fallbackLayoutUrl
  const currentPhasePlots = useMemo(() => {
    return currentPhase?.plots || []
  }, [currentPhase])

  const handlePhaseChange = (idx) => {
    setActivePhaseIndex(idx)
    setSelectedPlot(null)
  }

  const hasLayout = Boolean(
    project.hasLayoutMap ||
    fallbackLayoutUrl ||
    layoutPhases.some((p) => p.layoutUrl || (p.plots && p.plots.length > 0))
  )

  // ─────────────────────────────────────────────────────────────
  // 2. DYNAMIC SECTION: PROJECT IMAGES & VIDEOS
  // ─────────────────────────────────────────────────────────────
  const isCadBlueprint = (url) => {
    if (typeof url !== 'string') return true
    const lower = url.toLowerCase()
    return (
      lower.includes('/plots/plot-') ||
      lower.endsWith('.svg') ||
      lower.includes('blueprint') ||
      lower.includes('cad')
    )
  }

  const rawImages = [
    ...(Array.isArray(project.images) ? project.images : []),
    ...(Array.isArray(project.gallery) ? project.gallery : []),
    ...(typeof project.image === 'string' ? [project.image] : []),
  ].filter((img) => typeof img === 'string' && img.trim().length > 0 && !isCadBlueprint(img))

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
  // Starts false on both server and client so hydration markup matches
  const [isMapInView, setIsMapInView] = useState(false)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setIsMapInView(true), 0)
      return () => clearTimeout(t)
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

  // Live availability across every phase, from the plots themselves
  const inventory = (() => {
    const all = layoutPhases.flatMap((p) => (Array.isArray(p.plots) ? p.plots : []))
    const list = all.length > 0 ? all : Array.isArray(project.plots) ? project.plots : []
    return {
      total: list.length,
      available: list.filter((p) => String(p.status || 'Available').toLowerCase() === 'available').length,
    }
  })()

  const isSoldOut =
    project.status === 'Sold Out' ||
    project.status === 'Sold' ||
    (typeof project.availablePlots === 'number' &&
      project.availablePlots === 0 &&
      project.totalPlots > 0)

  // Derived dynamic CRM metrics & specs for Land Information & Approvals
  const totalPlotsCount = Number(project.totalPlots) || inventory.total || 0
  const availablePlotsCount =
    typeof project.availablePlots === 'number'
      ? project.availablePlots
      : (typeof inventory.available === 'number' ? inventory.available : 0)
  const bookedOrSoldPlotsCount = Math.max(0, totalPlotsCount - availablePlotsCount)
  const occupancyPercent =
    totalPlotsCount > 0
      ? Math.round(((totalPlotsCount - availablePlotsCount) / totalPlotsCount) * 100)
      : (isSoldOut ? 100 : 0)
  const cleanedArea = (project.area || project.totalLandArea || project.plotSizes || '1200 Sq.ft.')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const displayImage = project.coverImage || project.image || '/images/hero-bg.jpg'
  const displayPreview = project.layoutPreview || project.layoutImage || displayImage

  return (
    <>
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. EDITORIAL HERO & INTERACTIVE PHASE / 3D CONSOLE (TOP)   */}
      {/* Matches the Projects Page Top Hero Section UI              */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="ce-projects-editorial-header project-detail-editorial-hero" aria-labelledby="project-editorial-title">
        <div className="ch-wrap">
          <div className="project-hero-simple">
            <div className="project-hero-simple__main">
              <h1 id="project-editorial-title" className="ce-projects-editorial-header__headline">
                {project.name}
              </h1>
              <div className="project-editorial-pills">
                {project.approval && (
                  <span className="project-editorial-pill project-editorial-pill--gold">
                    <ShieldCheck size={14} aria-hidden="true" />
                    <span>{project.approval}</span>
                  </span>
                )}
                <span
                  className={`project-editorial-pill ${
                    isSoldOut ? 'project-editorial-pill--sold' : 'project-editorial-pill--available'
                  }`}
                >
                  <span className="project-editorial-pill__dot" aria-hidden="true" />
                  <span>{isSoldOut ? 'Sold Out' : project.status || 'Available'}</span>
                </span>
              </div>
            </div>

          </div>

          {hasLayout && (
            <ExploreGuide
              href={`/projects/${project.slug || project.id}/3d?phase=${activePhaseIndex + 1}`}
              projectName={project.name}
            />
          )}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. INTERACTIVE PLOT SELECTION (2D FULL-WIDTH LAYOUT)       */}
      {/* ────────────────────────────────────────────────────────── */}
      <section
        className="project-plot-section project-plot-section--full"
        id="plot-section"
        aria-labelledby="plot-section-title"
      >
        <div className="project-plot-container">
          {/* Visual header hidden; heading kept for screen readers */}
          <h2 id="plot-section-title" className="ch-sr">
            {project.name} interactive plot layout
          </h2>

          {hasLayout ? (
            <div
              className="project-embedded-viewer-card"
              style={{
                // Layout proportions let small screens size the map box to the plan
                '--layout-ratio': (() => {
                  const vb = parseViewBox(currentPhase?.viewBox || project.viewBox, 1056, 816)
                  return `${vb.width} / ${vb.height}`
                })(),
              }}
            >
              <PlotViewer
                key={`top-viewer-${project.id || project.slug}-${currentPhase?.id || activePhaseIndex}-${currentPhaseLayoutUrl}`}
                initialPlots={currentPhasePlots}
                phases={layoutPhases}
                activePhase={activePhaseIndex}
                onPhaseChange={handlePhaseChange}
                onPlotSelect={(p) => setSelectedPlot(p)}
                fetchUrl={null}
                backgroundUrl={currentPhaseLayoutUrl}
                metadata={{
                  title: project.name,
                  name: project.name,
                  sNo: project.surveyNumber || '',
                  village: project.village || project.location || '',
                  taluk: project.taluk || '',
                  layoutBackgroundUrl: currentPhaseLayoutUrl,
                  layoutUrl: currentPhaseLayoutUrl,
                  viewBox: parseViewBox(currentPhase?.viewBox || project.viewBox, 1056, 816).viewBoxStr,
                  layouts: layoutPhases,
                  phases: layoutPhases,
                }}
                viewBox={parseViewBox(currentPhase?.viewBox || project.viewBox, 1056, 816).viewBoxStr}
                whatsappNumber={business?.whatsapp || '919444000000'}
                className="project-embedded-plot-viewer"
                isModal={false}
                onToggleFullscreen={() => setIsFullScreenOpen(true)}
                fitWholeLayout
              />
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
      {/* 3. TECHNICAL SPECIFICATIONS & BUYER ASSURANCE STRIP        */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-detail-section project-detail-section--white" id="plot-details">
        <div className="project-detail-container">
          <div className="project-section-header">
            <span className="project-section-eyebrow">
              CRM VERIFIED SPECIFICATIONS
            </span>
            <h2 className="project-section-title">
              Comprehensive Land Information &amp; Approvals
            </h2>
            <p className="project-section-subtitle">
              Verified survey extents, layout approvals, avenue widths, and ownership records for {project.name}.
            </p>
          </div>

          {/* Bento Grid: 3 Metric Cards (Inspired by Reference Image) */}
          <div className="project-land-info-bento">
            {/* Card 1: Dark Visual Hero Stat Card with Speedometer / Gauge */}
            <div className="project-bento-card project-bento-card--hero">
              <div
                className="project-bento-card__bg"
                style={{ backgroundImage: `url(${displayImage})` }}
              />
              <div className="project-bento-card__hero-top">
                <div className="project-bento-hero-badges">
                  <span className="project-bento-badge">
                    PROJECT ID: {project.projectId || project.id || 'CE-VERIFIED'}
                  </span>
                  <span className={`project-bento-badge project-bento-badge--${isSoldOut ? 'sold' : 'active'}`}>
                    {isSoldOut ? 'Sold Out' : (project.status || 'Available')}
                  </span>
                </div>
                <div className="project-bento-hero-title-wrap">
                  <h3 className="project-bento-hero-title">{project.name}</h3>
                  <p className="project-bento-hero-location">
                    <MapPin size={13} />
                    {project.location || 'Chennai, Tamil Nadu'}
                  </p>
                </div>
              </div>

              <div className="project-bento-card__hero-bottom">
                <div className="project-bento-hero-stat">
                  <span className="project-bento-hero-stat__label">
                    {isSoldOut ? 'Project Status' : 'Plot Availability'}
                  </span>
                  <div className="project-bento-hero-stat__num">
                    {isSoldOut ? (
                      <span className="project-bento-sold-tag">100% Sold</span>
                    ) : (
                      <>
                        <strong>{availablePlotsCount}</strong>
                        <span className="project-bento-hero-stat__denom">
                          {totalPlotsCount > 0 ? ` / ${totalPlotsCount} Plots` : ' Plots'}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="project-bento-hero-stat__detail">
                    {cleanedArea} Standard Parcels
                  </span>
                </div>

                <div className="project-gauge-box">
                  <svg viewBox="0 0 120 70" className="project-gauge-svg" aria-hidden="true">
                    <path
                      d="M 15 62 A 45 45 0 0 1 105 62"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.16)"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 15 62 A 45 45 0 0 1 105 62"
                      fill="none"
                      stroke="#B8964E"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray="141.37"
                      strokeDashoffset={141.37 * (1 - Math.min(100, Math.max(0, occupancyPercent)) / 100)}
                    />
                    <circle cx="60" cy="62" r="4" fill="#ffffff" />
                    <line
                      x1="60"
                      y1="62"
                      x2={60 + 35 * Math.cos((Math.PI * (180 - (Math.min(100, Math.max(0, occupancyPercent)) / 100) * 180)) / 180)}
                      y2={62 - 35 * Math.sin((Math.PI * (180 - (Math.min(100, Math.max(0, occupancyPercent)) / 100) * 180)) / 180)}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="project-gauge-caption">
                    <span className="project-gauge-pct">{occupancyPercent}%</span>
                    <span className="project-gauge-sub">{isSoldOut ? 'Sold Out' : 'Booked'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Light Clean Card - Plot Extents & Infrastructure */}
            <div className="project-bento-card project-bento-card--light">
              <div className="project-bento-card__head">
                <div className="project-bento-icon-badge">
                  <Maximize2 size={20} />
                </div>
                <h3 className="project-bento-card-title">Land Extent &amp; Infrastructure</h3>
                <p className="project-bento-card-desc">
                  Accurate survey demarcations with planned road access and layout parameters.
                </p>
              </div>

              <div className="project-bento-specs-list">
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Extent / Land Area</span>
                  <span className="project-bento-spec-val">{cleanedArea}</span>
                </div>
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Facing Orientation</span>
                  <span className="project-bento-spec-val">{project.facing || 'East Facing'}</span>
                </div>
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Property Classification</span>
                  <span className="project-bento-spec-val">{project.propertyType || project.type || 'Residential'}</span>
                </div>
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Road Infrastructure</span>
                  <span className="project-bento-spec-val">30 ft &amp; 40 ft Blacktop Roads</span>
                </div>
              </div>
            </div>

            {/* Card 3: Light Clean Card - Approvals & Title Guarantee */}
            <div className="project-bento-card project-bento-card--light">
              <div className="project-bento-card__head">
                <div className="project-bento-icon-badge">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="project-bento-card-title">Approvals &amp; Title Guarantee</h3>
                <p className="project-bento-card-desc">
                  Sanctioned planning clearances, title ownership, and due diligence verification.
                </p>
              </div>

              <div className="project-bento-specs-list">
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Sanction Authority</span>
                  <span className="project-bento-spec-val project-bento-spec-val--green">
                    <CheckCircle2 size={14} />
                    {project.approval || project.approvalStatus || 'Clear Title & Patta'}
                  </span>
                </div>
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Title Ownership</span>
                  <span className="project-bento-spec-val project-bento-spec-val--green">
                    <CheckCircle2 size={14} />
                    100% Individual Patta
                  </span>
                </div>
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Parent Title Scrutiny</span>
                  <span className="project-bento-spec-val">30+ Years Scrutinized</span>
                </div>
                <div className="project-bento-spec-item">
                  <span className="project-bento-spec-label">Investment Price</span>
                  <span className="project-bento-spec-val project-bento-spec-val--gold">
                    {formattedPrice}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Split Bento Cards Row (Inspired by Reference Image 1) */}
          <div className="project-land-info-splits">
            {/* Split Card 1: Light Theme - Physical Demarcation */}
            <div className="project-split-card project-split-card--light">
              <div className="project-split-card__content">
                <div className="project-split-card__badge-row">
                  <span className="project-split-pill">
                    <Layers size={13} />
                    On-Ground Demarcation
                  </span>
                </div>
                <span className="project-split-subhead">Technical Land Delivery</span>
                <h3 className="project-split-title">Physical Boundary &amp; Avenue Access</h3>
                <p className="project-split-desc">
                  Every parcel is demarcated with firm corner stones compliant with revenue records, bordered by 30 ft and 40 ft blacktop avenues.
                </p>
                <div className="project-split-bullets">
                  <span className="project-split-bullet">
                    <Check size={13} className="project-split-bullet-icon" />
                    Boundary Corner Stones
                  </span>
                  <span className="project-split-bullet">
                    <Check size={13} className="project-split-bullet-icon" />
                    30 &amp; 40 ft Blacktop Roads
                  </span>
                  <span className="project-split-bullet">
                    <Check size={13} className="project-split-bullet-icon" />
                    Avenue Tree Plantation
                  </span>
                </div>
              </div>
              <div className="project-split-card__media">
                <img
                  src={displayImage}
                  alt={`${project.name} on-ground development`}
                  className="project-split-img"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Split Card 2: Dark Emerald Theme - Title Clearance & Bank Finance */}
            <div className="project-split-card project-split-card--dark">
              <div className="project-split-card__content">
                <div className="project-split-card__badge-row">
                  <span className="project-split-pill project-split-pill--gold">
                    <FileCheck2 size={13} />
                    Buyer Due Diligence
                  </span>
                </div>
                <span className="project-split-subhead">Legal &amp; Banking Eligibility</span>
                <h3 className="project-split-title">Clear Title &amp; Bank Loan Pre-Clearance</h3>
                <p className="project-split-desc">
                  Comprehensive 30-year parent link document audit with guaranteed immediate computerized Patta transfer and nationalized bank loan approvals.
                </p>
                <div className="project-split-bullets">
                  <span className="project-split-bullet">
                    <Check size={13} className="project-split-bullet-icon" />
                    Computerized Patta Handover
                  </span>
                  <span className="project-split-bullet">
                    <Check size={13} className="project-split-bullet-icon" />
                    Pre-Approved Bank Loans
                  </span>
                  <span className="project-split-bullet">
                    <Check size={13} className="project-split-bullet-icon" />
                    Nil Encumbrance Certificate
                  </span>
                </div>
              </div>
              <div className="project-split-card__media">
                <img
                  src={displayPreview}
                  alt={`${project.name} layout and approval plan`}
                  className="project-split-img"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. GALLERY (3D PERSPECTIVE CAROUSEL & VIDEO WALKTHROUGH)   */}
      {/* ────────────────────────────────────────────────────────── */}
      {hasMedia && (
        <ProjectGallery3D
          project={project}
          images={projectImages}
          videos={projectVideos}
          onOpenLightbox={openLightbox}
        />
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
                        fontFamily: 'var(--font-body)',
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
                selectedPlot={selectedPlot ? `${project.name} - Plot ${selectedPlot.plotNo}` : project}
                prefillInterest={selectedPlot ? `${project.name} - Plot ${selectedPlot.plotNo}` : project.name}
                title={`Contact Us for ${selectedPlot ? `${project.name} (Plot ${selectedPlot.plotNo})` : project.name}`}
                subtitle="Connect directly with our land advisory desk for verified documentation, pricing breakdown, or guided weekend site visit."
              />
            </div>
          </div>
        </div>
      </section>

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
      {/* COMPLETE PLOT LAYOUT FULL-SCREEN VIEW (TRIGGERED BY BUTTON)*/}
      {/* ────────────────────────────────────────────────────────── */}
      {isFullScreenOpen && (
        <div
          className="project-fullscreen-modal"
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label={`${project.name} Fullscreen Plot Layout`}
        >
          <div className="project-fullscreen-body">
            <PlotViewer
              key={`fs-${project.id || project.slug}-${currentPhase?.id || activePhaseIndex}-${currentPhaseLayoutUrl}`}
              initialPlots={currentPhasePlots}
              phases={layoutPhases}
              activePhase={activePhaseIndex}
              onPhaseChange={(idx) => handlePhaseChange(idx)}
              onPlotSelect={(p) => setSelectedPlot(p)}
              fetchUrl={null}
              backgroundUrl={currentPhaseLayoutUrl}
              metadata={{
                title: project.name,
                name: project.name,
                sNo: project.surveyNumber || '',
                village: project.village || project.location || '',
                taluk: project.taluk || '',
                layoutBackgroundUrl: currentPhaseLayoutUrl,
                layoutUrl: currentPhaseLayoutUrl,
                viewBox: parseViewBox(currentPhase?.viewBox || project.viewBox, 1056, 816).viewBoxStr,
                layouts: layoutPhases,
                phases: layoutPhases,
              }}
              viewBox={parseViewBox(currentPhase?.viewBox || project.viewBox, 1056, 816).viewBoxStr}
              whatsappNumber={business?.whatsapp || '919444000000'}
              onClose={() => setIsFullScreenOpen(false)}
              fitWholeLayout
              isModal={true}
            />
          </div>
        </div>
      )}
    </>
  )
}
