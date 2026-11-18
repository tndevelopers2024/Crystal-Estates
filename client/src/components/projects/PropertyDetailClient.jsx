'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  Compass,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react'
import EnquiryForm from '../forms/EnquiryForm'
import { ProjectCard } from './ProjectCard'
import PlotViewer from '../plot-viewer/PlotViewer'
import { resolveMapEmbedUrl, resolveMapDirectUrl } from '../../lib/api'
import { parseViewBox } from '../../lib/svgUtils'
import { business } from '../../data/site'
import { Eyebrow, PillLink, openSiteVisit } from '../home/motion'

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

  return (
    <>
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. INTERACTIVE PLOT SELECTION (FIRST ON THE PAGE)          */}
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
      {/* 2. PROJECT OVERVIEW (name, badges, key facts, CTAs)        */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="project-overview" aria-labelledby="project-overview-title">
        <div className="project-overview__inner">
          <div className="project-overview__intro">
            <Eyebrow className="ch-eyebrow--light">
              Assets Creator · {project.type || 'Project'}
            </Eyebrow>

            <h1 id="project-overview-title" className="project-overview__title">
              {project.name}
            </h1>

            <div className="project-overview__badges">
              {project.approval && (
                <span className="project-overview__badge project-overview__badge--gold">
                  <ShieldCheck size={14} aria-hidden="true" />
                  {project.approval}
                </span>
              )}
              <span
                className={`project-overview__badge ${
                  isSoldOut ? 'project-overview__badge--sold' : 'project-overview__badge--live'
                }`}
              >
                <span className="project-overview__dot" aria-hidden="true" />
                {isSoldOut ? 'Sold Out' : project.status || 'Available'}
              </span>
            </div>

            <p className="project-overview__desc">
              {project.description ||
                `Verified ${project.type || 'property'} located in ${project.location || 'Chennai'}. 100% legally clear title patta with complete revenue document verification.`}
            </p>

            <div className="project-overview__actions">
              <PillLink variant="cream" onClick={openSiteVisit}>
                Book a site visit
              </PillLink>
              <a
                href={`https://wa.me/${business?.whatsapp || '919444000000'}?text=${encodeURIComponent(
                  `Hi, I'm interested in ${project.name}. Please share plot availability and pricing.`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="ch-textlink ch-textlink--light"
              >
                Enquire on WhatsApp
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <aside className="project-overview__card" aria-label={`${project.name} key facts`}>
            <dl className="project-overview__facts">
              <div className="project-overview__fact">
                <dt>
                  <MapPin size={15} aria-hidden="true" />
                  Location
                </dt>
                <dd>{project.location || 'Chennai, Tamil Nadu'}</dd>
              </div>
              <div className="project-overview__fact">
                <dt>
                  <Layers size={15} aria-hidden="true" />
                  Plot sizes
                </dt>
                <dd>{project.area || project.plotSizes || 'On request'}</dd>
              </div>
              <div className="project-overview__fact">
                <dt>
                  <Compass size={15} aria-hidden="true" />
                  Facing
                </dt>
                <dd>{project.facing || 'Multiple'}</dd>
              </div>
              <div className="project-overview__fact project-overview__fact--price">
                <dt>Price</dt>
                <dd>{formattedPrice}</dd>
              </div>
            </dl>

            {inventory.total > 0 && (
              <div className="project-overview__stock">
                <div className="project-overview__stock-head">
                  <span>
                    <strong>{inventory.available}</strong> of {inventory.total} plots available
                  </span>
                  <span>{Math.round((inventory.available / inventory.total) * 100)}%</span>
                </div>
                <div
                  className="project-overview__stock-bar"
                  role="progressbar"
                  aria-label="Plots available"
                  aria-valuemin={0}
                  aria-valuemax={inventory.total}
                  aria-valuenow={inventory.available}
                >
                  <span style={{ width: `${(inventory.available / inventory.total) * 100}%` }} />
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. TECHNICAL SPECIFICATIONS & BUYER ASSURANCE STRIP        */}
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

          {/* Metric Strips */}
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
