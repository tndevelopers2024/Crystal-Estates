'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Video,
  X,
  Camera,
  Sparkles,
} from 'lucide-react'

// Verified high-definition photography of Crystal Estates layout developments in Chennai
const FALLBACK_SITE_PHOTOS = [
  '/images/somamangalam.jpg',
  '/images/kolapakkam.jpg',
  '/images/brammadesam.jpg',
  '/images/ozhalai-panchayath.jpg',
  '/images/vedanthangal.jpg',
  '/images/hero-estate.jpg',
  '/images/excellence-villa.jpg',
  '/images/plot-1.jpg',
  '/images/plot-2.jpg',
  '/images/plot-3.jpg',
]

export default function ProjectGallery3D({
  project,
  images = [],
  videos = [],
  onOpenLightbox,
}) {
  // Filter out blueprint CAD drawings so the 3D gallery showcases authentic photography
  const displayImages = useMemo(() => {
    const isCadBlueprint = (url) => {
      if (typeof url !== 'string') return true
      const lower = url.toLowerCase()
      return (
        lower.includes('/plots/plot-') ||
        lower.includes('layout') ||
        lower.includes('blueprint') ||
        lower.includes('cad')
      )
    }

    const validUserPhotos = images.filter(
      (img) => typeof img === 'string' && img.trim().length > 0 && !isCadBlueprint(img)
    )

    const result = [...validUserPhotos]

    // Pad with authentic verified site photography so the 3D stage has at least 5 perspective cards
    for (const fb of FALLBACK_SITE_PHOTOS) {
      if (!result.includes(fb) && result.length < 5) {
        result.push(fb)
      }
    }

    while (result.length < 5) {
      result.push(...FALLBACK_SITE_PHOTOS.slice(0, 5 - result.length))
    }

    return result
  }, [images])

  const [activeIndex, setActiveIndex] = useState(0)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState(null)

  const total = displayImages.length

  const goTo = useCallback((idx) => {
    setActiveIndex((idx % total + total) % total)
  }, [total])

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo])
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isVideoModalOpen) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prev, next, isVideoModalOpen])

  // Touch Swipe Handlers
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return
    const diffX = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) next()
      else prev()
    }
    setTouchStartX(null)
  }

  // Active video link resolution
  const activeVideo = videos.length > 0 ? videos[activeVideoIndex] : null
  const videoUrl = activeVideo
    ? typeof activeVideo === 'string'
      ? activeVideo
      : activeVideo.url
    : null

  const getEmbedVideoUrl = (url) => {
    if (!url) return ''
    if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) return url
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/)
    if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1`
    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
    return url
  }

  const isDirectVideo = videoUrl && (
    videoUrl.match(/\.(mp4|webm|ogg)($|\?)/i) ||
    videoUrl.startsWith('/videos/') ||
    videoUrl.includes('video-')
  )

  // Current active image for ambient glow
  const currentImg = displayImages[activeIndex] || displayImages[0]

  // Project title & display location
  const rawProjectName = (project?.name || 'Project Overview').toUpperCase()
  const rawLocation = (project?.location || 'Chennai, Tamil Nadu').toUpperCase()
  const rawType = project?.propertyType || project?.type || 'CMDA & DTCP Approved'
  const projectType = rawType.replace(/^#/, '')

  // Generate 5 perspective card slots: offset -2, -1, 0, +1, +2
  const visibleOffsets = [-2, -1, 0, 1, 2]

  return (
    <section
      id="gallery"
      className="ce-gallery3d"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Project Visual Documentation"
    >
      {/* ── Dynamic Ambient Blur Background ── */}
      <div
        className="ce-gallery3d__backdrop"
        style={{ backgroundImage: `url(${currentImg})` }}
      />
      <div className="ce-gallery3d__vignette" />

      <div className="ce-gallery3d__inner">
        {/* ── Section Header ── */}
        <div className="ce-gallery3d__header">
          <div className="ce-gallery3d__eyebrow">
            <Sparkles size={14} color="#B8964E" />
            <span>Visual Documentation</span>
          </div>
          <h2 className="ce-gallery3d__title">
            Project Photographs &amp; Video Walkthrough
          </h2>
          <p className="ce-gallery3d__subtitle">
            On-ground photography, perimeter boundaries, and video walkthrough of{' '}
            <strong>{project?.name}</strong>
            {project?.location ? ` in ${project.location}` : ''}.
          </p>
        </div>

        {/* ── 3D Perspective Carousel Stage ── */}
        <div className="ce-gallery3d__stage">
          {visibleOffsets.map((offset) => {
            const itemIndex = (activeIndex + offset + total * 1000) % total
            const imgSrc = displayImages[itemIndex]
            const isCenter = offset === 0

            // 3D positioning calculations matching reference design
            let transform = 'translate(-50%, -50%) translateZ(90px) rotateY(0deg) scale(1)'
            let opacity = 1
            let zIndex = 30
            let cardRole = 'is-center'
            let filter = 'brightness(1)'

            if (offset === 0) {
              transform = 'translate(-50%, -50%) translateZ(90px) rotateY(0deg) scale(1)'
              opacity = 1
              zIndex = 30
              cardRole = 'is-center'
              filter = 'brightness(1)'
            } else if (offset === -1) {
              transform = 'translate(calc(-50% - var(--p3d-spacing-1)), -50%) translateZ(-30px) rotateY(24deg) scale(0.86)'
              opacity = 0.82
              zIndex = 20
              cardRole = 'is-side'
              filter = 'brightness(0.85)'
            } else if (offset === 1) {
              transform = 'translate(calc(-50% + var(--p3d-spacing-1)), -50%) translateZ(-30px) rotateY(-24deg) scale(0.86)'
              opacity = 0.82
              zIndex = 20
              cardRole = 'is-side'
              filter = 'brightness(0.85)'
            } else if (offset === -2) {
              transform = 'translate(calc(-50% - var(--p3d-spacing-2)), -50%) translateZ(-110px) rotateY(38deg) scale(0.72)'
              opacity = 0.48
              zIndex = 10
              cardRole = 'is-outer'
              filter = 'brightness(0.65)'
            } else if (offset === 2) {
              transform = 'translate(calc(-50% + var(--p3d-spacing-2)), -50%) translateZ(-110px) rotateY(-38deg) scale(0.72)'
              opacity = 0.48
              zIndex = 10
              cardRole = 'is-outer'
              filter = 'brightness(0.65)'
            }

            return (
              <div
                key={`${itemIndex}-${offset}`}
                onClick={() => {
                  if (!isCenter) goTo(itemIndex)
                }}
                className={`ce-gallery3d__card ${cardRole}`}
                style={{
                  transform,
                  opacity,
                  zIndex,
                  filter,
                }}
              >
                {/* Background Image */}
                <img
                  src={imgSrc}
                  alt={`${project?.name || 'Project'} photo ${itemIndex + 1}`}
                  className="ce-gallery3d__card-img"
                  loading={isCenter ? 'eager' : 'lazy'}
                  onError={(e) => {
                    // Fallback gracefully to primary project image if an uploaded link is broken
                    e.currentTarget.src = FALLBACK_SITE_PHOTOS[0]
                  }}
                />

                {/* Shading & Vignette Layer */}
                <div className="ce-gallery3d__card-scrim" />

                {/* ── CENTER CARD OVERLAYS (Matching reference design) ── */}
                {isCenter && (
                  <div className="ce-gallery3d__overlay">
                    {/* Top Row: Category Badge & Expand Icon */}
                    <div className="ce-gallery3d__top-row">
                      <span className="ce-gallery3d__badge">
                        #{projectType}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onOpenLightbox) onOpenLightbox(itemIndex)
                        }}
                        className="ce-gallery3d__expand-btn"
                        title="View Full High-Resolution Photo"
                        aria-label="Expand photo"
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>

                    {/* Center: Frosted Glass Walkthrough Play Button */}
                    <div className="ce-gallery3d__play-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsVideoModalOpen(true)
                        }}
                        className="ce-gallery3d__play-btn"
                        title="Watch Video Walkthrough"
                        aria-label="Play video walkthrough"
                      >
                        <span className="ce-gallery3d__play-pulse" />
                        <Play className="ce-gallery3d__play-icon" />
                      </button>
                    </div>

                    {/* Bottom: Project Title & Tagline Overlay (Matching reference) */}
                    <div className="ce-gallery3d__bottom-row">
                      <h3 className="ce-gallery3d__project-name">
                        {rawProjectName}
                        <span className="ce-gallery3d__project-subname">
                          {' '}– {rawLocation}
                        </span>
                      </h3>
                      {/* Accent Gold Divider Line */}
                      <div className="ce-gallery3d__divider" />
                      <p className="ce-gallery3d__tagline">
                        {project?.tagline || '100% Clear Title Patta · Spot Registration · Direct Owner Sale'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Left Floating Navigation Arrow (Positioned flanking the cards) ── */}
          <button
            type="button"
            onClick={prev}
            className="ce-gallery3d__arrow ce-gallery3d__arrow--prev"
            aria-label="Previous image"
            title="Previous image (Left Arrow)"
          >
            <ChevronLeft size={28} />
          </button>

          {/* ── Right Floating Navigation Arrow (Positioned flanking the cards) ── */}
          <button
            type="button"
            onClick={next}
            className="ce-gallery3d__arrow ce-gallery3d__arrow--next"
            aria-label="Next image"
            title="Next image (Right Arrow)"
          >
            <ChevronRight size={28} />
          </button>
        </div>

        {/* ── Pagination Indicator Pills ── */}
        <div className="ce-gallery3d__pagination">
          {displayImages.map((_, idx) => {
            const isActive = idx === activeIndex
            return (
              <button
                key={idx}
                type="button"
                onClick={() => goTo(idx)}
                className={`ce-gallery3d__dot ${isActive ? 'is-active' : ''}`}
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={isActive ? 'true' : undefined}
              />
            )
          })}
        </div>

        {/* ── Secondary Action Bar (Photos Count + Video Walkthrough Trigger) ── */}
        <div className="ce-gallery3d__actions">
          <button
            type="button"
            onClick={() => onOpenLightbox && onOpenLightbox(activeIndex)}
            className="ce-gallery3d__action-btn ce-gallery3d__action-btn--photos"
          >
            <Camera size={15} color="#B8964E" />
            <span>View all {displayImages.length} high-res photographs</span>
          </button>

          <button
            type="button"
            onClick={() => setIsVideoModalOpen(true)}
            className="ce-gallery3d__action-btn ce-gallery3d__action-btn--video"
          >
            <Video size={15} color="#6ee7b7" />
            <span>
              {videos.length > 0 ? 'Watch Site Walkthrough Video' : 'Guided Video Tour'}
            </span>
          </button>
        </div>
      </div>

      {/* ── VIDEO WALKTHROUGH MODAL ── */}
      {isVideoModalOpen && (
        <div
          className="ce-gallery3d__modal-backdrop"
          onClick={() => setIsVideoModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-modal-title"
        >
          <div
            className="ce-gallery3d__modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="ce-gallery3d__modal-head">
              <div className="ce-gallery3d__modal-title-box">
                <div className="ce-gallery3d__modal-icon">
                  <Video size={18} />
                </div>
                <div>
                  <h4 id="video-modal-title" className="ce-gallery3d__modal-title">
                    {project?.name} · Video Walkthrough
                  </h4>
                  <p className="ce-gallery3d__modal-sub">
                    {videos.length > 0
                      ? `Viewing clip ${activeVideoIndex + 1} of ${videos.length}`
                      : 'Crystal Estates On-Ground Site Walkthrough'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVideoModalOpen(false)}
                className="ce-gallery3d__modal-close"
                aria-label="Close video player"
              >
                <X size={20} />
              </button>
            </div>

            {/* Video Player Frame */}
            <div className="ce-gallery3d__modal-player">
              {videoUrl ? (
                isDirectVideo ? (
                  <video
                    controls
                    autoPlay
                    playsInline
                    src={videoUrl}
                  />
                ) : (
                  <iframe
                    src={getEmbedVideoUrl(videoUrl)}
                    title={`${project?.name} video walkthrough`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )
              ) : (
                /* Fallback preview if project has no direct video uploaded yet */
                <div className="ce-gallery3d__fallback-box">
                  <div className="ce-gallery3d__fallback-icon">
                    <Video size={28} />
                  </div>
                  <h5 className="ce-gallery3d__fallback-h">
                    Live Drone &amp; Site Walkthrough
                  </h5>
                  <p className="ce-gallery3d__fallback-p">
                    Request an instant high-definition video walkthrough recording of {project?.name} delivered directly to your WhatsApp.
                  </p>
                  <a
                    href={`https://wa.me/919940024000?text=${encodeURIComponent(
                      `Hello Crystal Estates, please send the video walkthrough of ${project?.name} in ${project?.location || 'Chennai'}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ce-gallery3d__wa-btn"
                  >
                    <span>Receive Walkthrough on WhatsApp</span>
                  </a>
                </div>
              )}
            </div>

            {/* Multiple Videos Selector (if project has more than 1 video) */}
            {videos.length > 1 && (
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                background: 'rgba(0, 0, 0, 0.4)'
              }}>
                {videos.map((v, vIdx) => {
                  const label = typeof v === 'object' && v.name ? v.name : `Video ${vIdx + 1}`
                  const isCur = vIdx === activeVideoIndex
                  return (
                    <button
                      key={vIdx}
                      type="button"
                      onClick={() => setActiveVideoIndex(vIdx)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: isCur ? '#B8964E' : 'rgba(255, 255, 255, 0.1)',
                        color: isCur ? '#000000' : '#cbd5e1',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
