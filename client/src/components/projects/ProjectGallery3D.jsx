'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Video,
  X,
  Sparkles,
} from 'lucide-react'

export default function ProjectGallery3D({
  project,
  images = [],
  videos = [],
  onOpenLightbox,
}) {
  // Normalize and classify project media items dynamically from CRM
  const mediaItems = useMemo(() => {
    const items = []
    const seenUrls = new Set()

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

    // 1. Process project videos from CRM
    if (Array.isArray(videos)) {
      videos.forEach((v, idx) => {
        const url = typeof v === 'string' ? v.trim() : (v?.url ? String(v.url).trim() : '')
        if (!url || seenUrls.has(url)) return
        seenUrls.add(url)
        const name = typeof v === 'object' && v.name ? v.name : `Video Walkthrough ${idx + 1}`
        items.push({
          id: `video-${idx}`,
          type: 'video',
          url,
          thumbnail: (typeof v === 'object' && v.thumbnail) || project?.image || '/images/hero-bg.jpg',
          title: name,
        })
      })
    }

    // 2. Process project photos from CRM
    if (Array.isArray(images)) {
      let photoCount = 0
      images.forEach((img, idx) => {
        if (typeof img !== 'string' || !img.trim()) return
        const trimmed = img.trim()
        if (seenUrls.has(trimmed) || isCadBlueprint(trimmed)) return

        const lower = trimmed.toLowerCase()
        const isVideo =
          lower.includes('youtube.com') ||
          lower.includes('youtu.be') ||
          lower.includes('vimeo.com') ||
          lower.endsWith('.mp4') ||
          lower.endsWith('.webm') ||
          lower.endsWith('.mov')

        seenUrls.add(trimmed)

        if (isVideo) {
          items.push({
            id: `video-extra-${idx}`,
            type: 'video',
            url: trimmed,
            thumbnail: project?.image || '/images/hero-bg.jpg',
            title: `${project?.name || 'Project'} Video Walkthrough`,
          })
        } else {
          items.push({
            id: `image-${idx}`,
            type: 'image',
            url: trimmed,
            thumbnail: trimmed,
            title: `${project?.name || 'Project'} Photograph ${photoCount + 1}`,
            photoIndex: photoCount,
          })
          photoCount++
        }
      })
    }

    return items
  }, [images, videos, project])

  const [activeIndex, setActiveIndex] = useState(0)
  const [activeVideoModal, setActiveVideoModal] = useState(null)
  const [touchStartX, setTouchStartX] = useState(null)

  const total = mediaItems.length

  const goTo = useCallback((idx) => {
    if (total === 0) return
    setActiveIndex((idx % total + total) % total)
  }, [total])

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo])
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeVideoModal) {
        if (e.key === 'Escape') setActiveVideoModal(null)
        return
      }
      if (total <= 1) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prev, next, activeVideoModal, total])

  // Touch handlers
  const handleTouchStart = (e) => {
    if (total <= 1) return
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e) => {
    if (touchStartX === null || total <= 1) return
    const diffX = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) next()
      else prev()
    }
    setTouchStartX(null)
  }

  // If a project has no uploaded images or videos, hide the section completely
  if (total === 0) {
    return null
  }

  const getEmbedVideoUrl = (url) => {
    if (!url) return ''
    if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) return url
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/)
    if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1`
    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
    return url
  }

  const isDirectVideo = (url) => {
    if (!url) return false
    return (
      url.match(/\.(mp4|webm|ogg)($|\?)/i) ||
      url.startsWith('/videos/') ||
      url.includes('video-')
    )
  }

  const rawProjectName = (project?.name || 'Project Overview').toUpperCase()
  const rawLocation = (project?.location || 'Chennai, Tamil Nadu').toUpperCase()
  const rawType = project?.propertyType || project?.type || 'CMDA & DTCP Approved'
  const projectType = rawType.replace(/^#/, '')

  const currentItem = mediaItems[activeIndex] || mediaItems[0]

  // Determine offsets for multi-item carousel
  const visibleOffsets = total === 2 ? [-1, 0, 1] : total >= 5 ? [-2, -1, 0, 1, 2] : [-1, 0, 1]

  return (
    <section
      id="gallery"
      className="ce-gallery3d"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Project Visual Documentation"
    >
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

        {/* ── Case A: Single Media Item (Clean Centered Showcase) ── */}
        {total === 1 ? (
          <div className="ce-gallery3d__single-stage">
            <div
              className="ce-gallery3d__card is-center ce-gallery3d__card--single"
              onClick={() => {
                if (currentItem.type === 'video') {
                  setActiveVideoModal(currentItem)
                } else if (onOpenLightbox && typeof currentItem.photoIndex === 'number') {
                  onOpenLightbox(currentItem.photoIndex)
                }
              }}
            >
              <img
                src={currentItem.thumbnail}
                alt={currentItem.title}
                className="ce-gallery3d__card-img"
              />
              <div className="ce-gallery3d__card-scrim" />

              <div className="ce-gallery3d__overlay">
                <div className="ce-gallery3d__top-row">
                  {currentItem.type === 'video' ? (
                    <span className="ce-gallery3d__badge ce-gallery3d__badge--video">
                      <Video size={13} aria-hidden="true" />
                      <span>Video Walkthrough</span>
                    </span>
                  ) : (
                    <span className="ce-gallery3d__badge">
                      #{projectType}
                    </span>
                  )}

                  {currentItem.type === 'image' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onOpenLightbox && typeof currentItem.photoIndex === 'number') {
                          onOpenLightbox(currentItem.photoIndex)
                        }
                      }}
                      className="ce-gallery3d__expand-btn"
                      title="View Full High-Resolution Photo"
                      aria-label="Expand photo"
                    >
                      <Maximize2 size={16} />
                    </button>
                  )}
                </div>

                {/* PLAY BUTTON OVERLAY ONLY ON VIDEO THUMBNAILS */}
                {currentItem.type === 'video' && (
                  <div className="ce-gallery3d__play-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveVideoModal(currentItem)
                      }}
                      className="ce-gallery3d__play-btn"
                      title="Watch Video Walkthrough"
                      aria-label="Play video walkthrough"
                    >
                      <span className="ce-gallery3d__play-pulse" />
                      <Play className="ce-gallery3d__play-icon" />
                    </button>
                  </div>
                )}

                <div className="ce-gallery3d__bottom-row">
                  <h3 className="ce-gallery3d__project-name">
                    {rawProjectName}
                    <span className="ce-gallery3d__project-subname">
                      {' '}– {rawLocation}
                    </span>
                  </h3>
                  <div className="ce-gallery3d__divider" />
                  <p className="ce-gallery3d__tagline">
                    {project?.tagline || '100% Clear Title Patta · Spot Registration · Direct Owner Sale'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Case B: Multiple Media Items (Interactive 3D Carousel) ── */
          <div className="ce-gallery3d__stage">
            {visibleOffsets.map((offset) => {
              const itemIndex = (activeIndex + offset + total * 1000) % total
              const item = mediaItems[itemIndex]
              const isCenter = offset === 0

              let transform = 'translate(-50%, -50%) translateZ(80px) rotateY(0deg) scale(1)'
              let opacity = 1
              let zIndex = 30
              let cardRole = 'is-center'
              let filter = 'brightness(1)'

              if (offset === 0) {
                transform = 'translate(-50%, -50%) translateZ(80px) rotateY(0deg) scale(1)'
                opacity = 1
                zIndex = 30
                cardRole = 'is-center'
                filter = 'brightness(1)'
              } else if (offset === -1) {
                transform = 'translate(calc(-50% - var(--p3d-spacing-1, 280px)), -50%) translateZ(-30px) rotateY(22deg) scale(0.86)'
                opacity = 0.82
                zIndex = 20
                cardRole = 'is-side'
                filter = 'brightness(0.88)'
              } else if (offset === 1) {
                transform = 'translate(calc(-50% + var(--p3d-spacing-1, 280px)), -50%) translateZ(-30px) rotateY(-22deg) scale(0.86)'
                opacity = 0.82
                zIndex = 20
                cardRole = 'is-side'
                filter = 'brightness(0.88)'
              } else if (offset === -2) {
                transform = 'translate(calc(-50% - var(--p3d-spacing-2, 520px)), -50%) translateZ(-100px) rotateY(36deg) scale(0.72)'
                opacity = 0.45
                zIndex = 10
                cardRole = 'is-outer'
                filter = 'brightness(0.7)'
              } else if (offset === 2) {
                transform = 'translate(calc(-50% + var(--p3d-spacing-2, 520px)), -50%) translateZ(-100px) rotateY(-36deg) scale(0.72)'
                opacity = 0.45
                zIndex = 10
                cardRole = 'is-outer'
                filter = 'brightness(0.7)'
              }

              return (
                <div
                  key={`${item.id}-${offset}`}
                  onClick={() => {
                    if (!isCenter) {
                      goTo(itemIndex)
                    } else if (item.type === 'video') {
                      setActiveVideoModal(item)
                    } else if (onOpenLightbox && typeof item.photoIndex === 'number') {
                      onOpenLightbox(item.photoIndex)
                    }
                  }}
                  className={`ce-gallery3d__card ${cardRole}`}
                  style={{
                    transform,
                    opacity,
                    zIndex,
                    filter,
                  }}
                >
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="ce-gallery3d__card-img"
                    loading={isCenter ? 'eager' : 'lazy'}
                  />

                  <div className="ce-gallery3d__card-scrim" />

                  {/* Overlays on center card */}
                  {isCenter && (
                    <div className="ce-gallery3d__overlay">
                      <div className="ce-gallery3d__top-row">
                        {item.type === 'video' ? (
                          <span className="ce-gallery3d__badge ce-gallery3d__badge--video">
                            <Video size={13} aria-hidden="true" />
                            <span>Video Walkthrough</span>
                          </span>
                        ) : (
                          <span className="ce-gallery3d__badge">
                            #{projectType}
                          </span>
                        )}

                        {item.type === 'image' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onOpenLightbox && typeof item.photoIndex === 'number') {
                                onOpenLightbox(item.photoIndex)
                              }
                            }}
                            className="ce-gallery3d__expand-btn"
                            title="View Full High-Resolution Photo"
                            aria-label="Expand photo"
                          >
                            <Maximize2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* PLAY BUTTON OVERLAY ONLY ON VIDEO THUMBNAILS */}
                      {item.type === 'video' && (
                        <div className="ce-gallery3d__play-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveVideoModal(item)
                            }}
                            className="ce-gallery3d__play-btn"
                            title="Watch Video Walkthrough"
                            aria-label="Play video walkthrough"
                          >
                            <span className="ce-gallery3d__play-pulse" />
                            <Play className="ce-gallery3d__play-icon" />
                          </button>
                        </div>
                      )}

                      <div className="ce-gallery3d__bottom-row">
                        <h3 className="ce-gallery3d__project-name">
                          {rawProjectName}
                          <span className="ce-gallery3d__project-subname">
                            {' '}– {rawLocation}
                          </span>
                        </h3>
                        <div className="ce-gallery3d__divider" />
                        <p className="ce-gallery3d__tagline">
                          {project?.tagline || '100% Clear Title Patta · Spot Registration · Direct Owner Sale'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Side Card subtle video indicator */}
                  {!isCenter && item.type === 'video' && (
                    <div className="ce-gallery3d__side-video-badge">
                      <Play size={16} fill="currentColor" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={prev}
              className="ce-gallery3d__arrow ce-gallery3d__arrow--prev"
              aria-label="Previous media"
              title="Previous (Left Arrow)"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              type="button"
              onClick={next}
              className="ce-gallery3d__arrow ce-gallery3d__arrow--next"
              aria-label="Next media"
              title="Next (Right Arrow)"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {/* Pagination Dots (Only if multiple items) */}
        {total > 1 && (
          <div className="ce-gallery3d__pagination">
            {mediaItems.map((_, idx) => {
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
        )}
      </div>

      {/* ── VIDEO WALKTHROUGH MODAL ── */}
      {activeVideoModal && (
        <div
          className="ce-gallery3d__modal-backdrop"
          onClick={() => setActiveVideoModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-modal-title"
        >
          <div
            className="ce-gallery3d__modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
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
                    {activeVideoModal.title || 'Site Walkthrough Video'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="ce-gallery3d__modal-close"
                aria-label="Close video player"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ce-gallery3d__modal-player">
              {isDirectVideo(activeVideoModal.url) ? (
                <video
                  controls
                  autoPlay
                  playsInline
                  src={activeVideoModal.url}
                />
              ) : (
                <iframe
                  src={getEmbedVideoUrl(activeVideoModal.url)}
                  title={`${project?.name} video walkthrough`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
