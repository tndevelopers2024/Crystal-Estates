'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Crumb,
  MapPin,
  Camera,
  Layers,
  Plane,
  Video,
  Grid,
  ShieldCheck,
  Expand,
} from 'lucide-react'
import { galleryCategories, galleryMedia } from '../../data/galleryData'
import './Gallery.css'

const FALLBACK_IMAGE = '/images/hero-estate.jpg'

/** Ensure server-relative paths start with "/" (some records store "plots/…"). */
function normalizePath(src) {
  if (!src || typeof src !== 'string') return ''
  if (/^(https?:)?\/\//.test(src) || src.startsWith('/') || src.startsWith('data:')) return src
  return `/${src}`
}

const isSvg = (src) => /\.svg(\?|$)/i.test(src || '')

/**
 * Build a deduplicated gallery list from database plots + curated media.
 *
 * Performance note: master-plan SVGs are 1–28 MB each and stall the main
 * thread when rasterised during scroll, so layouts always use the lightweight
 * PNG `layoutPreview`. A raw SVG is never placed in the grid.
 */
function buildDynamicMedia(plots = [], staticMedia = []) {
  const dynamicItems = []

  plots.forEach((p) => {
    const key = p.id || p.projectId || p._id || p.slug
    const plotTitle = (p.name || p.projectName || 'Crystal Estates Property').replace(/_/g, ' ').trim()
    const location = p.location || 'Chennai, Tamil Nadu'
    const shortLoc = location.split(',')[0].trim()
    const layoutPreview = normalizePath(p.layoutPreview)

    // 1. Site photos — skip the layout preview, which belongs under "Layouts"
    const rawImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : p.image ? [p.image] : []
    const photos = rawImages
      .map(normalizePath)
      .filter((img) => img && img !== layoutPreview && !isSvg(img) && !/layout/i.test(img))

    photos.forEach((img, i) => {
      dynamicItems.push({
        id: `dyn-${key}-img-${i}`,
        title: plotTitle,
        category: 'Site Photos',
        image: img,
        location: shortLoc,
        caption: `On-ground site photograph of ${plotTitle}, ${location}.`,
      })
    })

    // 2. Layouts — raster preview only
    if (layoutPreview && !isSvg(layoutPreview)) {
      dynamicItems.push({
        id: `dyn-${key}-layout`,
        title: `${plotTitle} Master Layout`,
        category: 'Layouts',
        image: layoutPreview,
        location: shortLoc,
        caption: `Approved layout plan and plot demarcation map for ${plotTitle}.`,
      })
    }

    // 3. Videos
    if (Array.isArray(p.videos)) {
      p.videos.forEach((v, vi) => {
        const vUrl = typeof v === 'string' ? v : v?.url
        if (vUrl) {
          dynamicItems.push({
            id: `dyn-${key}-vid-${vi}`,
            title: `${plotTitle} Video Walkthrough`,
            category: 'Videos',
            image: photos[0] || FALLBACK_IMAGE,
            videoUrl: vUrl,
            location: shortLoc,
            caption: `Guided video tour of ${plotTitle}.`,
          })
        }
      })
    }
  })

  const seen = new Set()
  const result = []
  ;[...dynamicItems, ...staticMedia].forEach((item) => {
    if (item.image && !isSvg(item.image) && !seen.has(item.image)) {
      seen.add(item.image)
      result.push(item)
    }
  })
  return result
}

/**
 * Bento tile size. Layout plans are portrait, so they always get a tall tile;
 * photos cycle through wide / standard tiles. `grid-auto-flow: dense` closes gaps.
 */
function getTileClass(item, index) {
  if (item.category === 'Layouts') return 'gx-card--tall'
  return index % 5 === 0 ? 'gx-card--wide' : ''
}

const CATEGORY_ICONS = {
  All: Grid,
  'Site Photos': Camera,
  Layouts: Layers,
  'Drone Views': Plane,
  Videos: Video,
}

/** Static, lightweight plot-subdivision drawing used as the hero backdrop. */
function PlotPattern() {
  const plots = []
  const cols = 9
  const rows = 4
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = 40 + c * 92 + (c >= 4 ? 36 : 0)
      const y = 40 + r * 70 + (r >= 2 ? 34 : 0)
      plots.push(<rect key={`${r}-${c}`} x={x} y={y} width="84" height="62" rx="3" />)
    }
  }
  return (
    <svg className="gx-hero__pattern" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g className="gx-hero__pattern-roads">
        <rect x="0" y="174" width="900" height="26" />
        <rect x="408" y="0" width="28" height="400" />
      </g>
      <g className="gx-hero__pattern-plots">{plots}</g>
      <rect className="gx-hero__pattern-highlight" x="224" y="250" width="84" height="62" rx="3" />
    </svg>
  )
}

const GalleryCard = memo(function GalleryCard({ item, index, onOpen, isPriority }) {
  const [failed, setFailed] = useState(false)
  const imgSrc = failed || !item.image ? FALLBACK_IMAGE : item.image
  const ref = useRef(null)
  const isVideo = item.category === 'Videos'
  const isLayout = item.category === 'Layouts'

  // Fade/slide in once when the card first enters the viewport
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const tileClass = getTileClass(item, index)

  return (
    <article
      ref={ref}
      className={`gx-card ${tileClass} ${isLayout ? 'gx-card--layout' : ''}`}
      style={{ '--gx-delay': `${(index % 3) * 70}ms` }}
    >
      <button
        type="button"
        className="gx-card__button"
        onClick={() => onOpen(item, index)}
        aria-label={`Open ${item.title}`}
      >
        <span className="gx-card__media">
          <Image
            src={imgSrc}
            alt={item.title || 'Crystal Estates gallery image'}
            fill
            priority={isPriority}
            sizes={
              tileClass === 'gx-card--wide'
                ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw'
                : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            }
            className="gx-card__img"
            onError={() => setFailed(true)}
          />
        </span>

        {isVideo && (
          <span className="gx-card__play" aria-hidden="true">
            <Play size={20} fill="currentColor" />
          </span>
        )}

        <span className="gx-card__expand" aria-hidden="true">
          <Expand size={15} />
        </span>

        <span className="gx-card__info">
          <span className="gx-card__meta">
            <span className="gx-card__tag">{item.category}</span>
            {item.location && (
              <span className="gx-card__loc">
                <MapPin size={11} aria-hidden="true" />
                {item.location.split(',')[0]}
              </span>
            )}
          </span>
          <span className="gx-card__title">{item.title}</span>
        </span>
      </button>
    </article>
  )
})

export default function GalleryClientView({
  initialPlots = [],
  title = 'Photo Gallery',
  subtitle = 'Captured moments from our on-ground sites, aerial drone panoramas, approved layouts, and guided walkthrough tours across Chennai.',
  badge = 'Our Gallery',
  hideHero = false,
}) {
  const [activeTab, setActiveTab] = useState('All')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [activeVideo, setActiveVideo] = useState(null)
  const hasInitialPlots = Array.isArray(initialPlots) && initialPlots.length > 0
  const [fetchedPlots, setFetchedPlots] = useState(null)

  // Client-side fallback only when the server render had no plots
  useEffect(() => {
    if (hasInitialPlots) return
    let active = true
    fetch('/api/plots')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && Array.isArray(data.plots) && data.plots.length > 0) {
          setFetchedPlots(data.plots)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [hasInitialPlots])

  const mediaList = useMemo(
    () => buildDynamicMedia(hasInitialPlots ? initialPlots : fetchedPlots || [], galleryMedia),
    [hasInitialPlots, initialPlots, fetchedPlots],
  )

  const counts = useMemo(() => {
    const c = { All: mediaList.length }
    mediaList.forEach((m) => {
      c[m.category] = (c[m.category] || 0) + 1
    })
    return c
  }, [mediaList])

  const projectCount = useMemo(
    () => new Set(mediaList.map((m) => m.location).filter(Boolean)).size,
    [mediaList],
  )

  // Only show categories that actually have media
  const tabs = galleryCategories.filter((cat) => cat === 'All' || counts[cat] > 0)

  const filteredMedia = useMemo(
    () => (activeTab === 'All' ? mediaList : mediaList.filter((item) => item.category === activeTab)),
    [activeTab, mediaList],
  )

  const openMedia = useCallback((item, idx) => {
    if (item.category === 'Videos' && item.videoUrl) setActiveVideo(item)
    else setLightboxIndex(idx)
  }, [])

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const closeVideoModal = useCallback(() => setActiveVideo(null), [])

  const nextImage = useCallback(
    () => setLightboxIndex((prev) => (prev + 1) % filteredMedia.length),
    [filteredMedia.length],
  )
  const prevImage = useCallback(
    () => setLightboxIndex((prev) => (prev - 1 + filteredMedia.length) % filteredMedia.length),
    [filteredMedia.length],
  )

  const modalOpen = lightboxIndex !== null || activeVideo !== null

  // Pause smooth scrolling + lock page while a modal is open
  useEffect(() => {
    if (!modalOpen) return
    const lenis = typeof window !== 'undefined' ? window.__lenis : null
    lenis?.stop()
    const prevOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      lenis?.start()
      document.documentElement.style.overflow = prevOverflow
    }
  }, [modalOpen])

  useEffect(() => {
    if (!modalOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        closeLightbox()
        closeVideoModal()
      }
      if (lightboxIndex !== null) {
        if (e.key === 'ArrowRight') nextImage()
        if (e.key === 'ArrowLeft') prevImage()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [modalOpen, lightboxIndex, nextImage, prevImage, closeLightbox, closeVideoModal])

  const activeLightboxItem = lightboxIndex !== null ? filteredMedia[lightboxIndex] : null

  return (
    <>
      {/* Hero */}
      {!hideHero && (
        <section className="gx-hero" aria-labelledby="gallery-title">
          <PlotPattern />

          <div className="gx-hero__floats" aria-hidden="true">
            <span className="gx-float gx-float--one">
              <MapPin size={14} /> {counts['Site Photos'] || 0} site photos
            </span>
            <span className="gx-float gx-float--two">
              <Layers size={14} /> {counts.Layouts || 0} approved layouts
            </span>
            <span className="gx-float gx-float--three">
              <ShieldCheck size={14} /> DTCP &amp; CMDA approved
            </span>
          </div>

          <div className="gx-hero__inner">
            <nav aria-label="Breadcrumb" className="gx-hero__crumbs">
              <Link href="/">Home</Link>
              <Crumb size={13} aria-hidden="true" />
              <span aria-current="page">Gallery</span>
            </nav>
            <span className="featured-showcase-sidebar__badge">{badge}</span>
            <h1 id="gallery-title" className="gx-hero__title">{title}</h1>
            {subtitle && <p className="gx-hero__subtitle">{subtitle}</p>}

            <dl className="gx-hero__stats">
              <div>
                <dt>Media</dt>
                <dd>{counts.All}</dd>
              </div>
              <div>
                <dt>Projects</dt>
                <dd>{projectCount}</dd>
              </div>
              <div>
                <dt>Layouts</dt>
                <dd>{counts.Layouts || 0}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {/* Gallery */}
      <section className="gx-section" aria-label="Gallery">
        <div className="gx-container">
          <div className="gx-tabs" role="tablist" aria-label="Gallery category filter">
            {tabs.map((cat) => {
              const Icon = CATEGORY_ICONS[cat]
              const isActive = activeTab === cat
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(cat)
                    setLightboxIndex(null)
                  }}
                  className={`gx-tab ${isActive ? 'is-active' : ''}`}
                >
                  {Icon && <Icon size={14} aria-hidden="true" />}
                  <span>{cat}</span>
                  <span className="gx-tab__count">{counts[cat] || 0}</span>
                </button>
              )
            })}
          </div>

          {filteredMedia.length > 0 ? (
            <div className="gx-grid" key={activeTab}>
              {filteredMedia.map((item, idx) => (
                <GalleryCard
                  key={item.id || `${item.image}-${idx}`}
                  item={item}
                  index={idx}
                  onOpen={openMedia}
                  isPriority={idx < 2}
                />
              ))}
            </div>
          ) : (
            <p className="gx-empty">No media in this category yet. Check back soon.</p>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {activeLightboxItem && (
        <div
          className="modern-gallery-lightbox"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={activeLightboxItem.title}
          data-lenis-prevent
        >
          <div className="modern-gallery-lightbox__dialog" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={closeLightbox} className="modern-gallery-lightbox__close" aria-label="Close">
              <X size={20} />
            </button>

            {filteredMedia.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  className="modern-gallery-lightbox__nav-btn modern-gallery-lightbox__nav-btn--prev"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  className="modern-gallery-lightbox__nav-btn modern-gallery-lightbox__nav-btn--next"
                  aria-label="Next image"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            <div
              className={`modern-gallery-lightbox__img-box ${
                activeLightboxItem.category === 'Layouts' ? 'gx-lightbox-layout' : ''
              }`}
            >
              <Image
                src={activeLightboxItem.image || FALLBACK_IMAGE}
                alt={activeLightboxItem.title || 'Crystal Estates'}
                fill
                sizes="(max-width: 1200px) 100vw, 1100px"
                className="modern-gallery-lightbox__img"
              />
            </div>

            <div className="modern-gallery-lightbox__info">
              <div className="modern-gallery-lightbox__header">
                <span className="modern-gallery-lightbox__badge">{activeLightboxItem.category}</span>
                <span className="modern-gallery-lightbox__counter">
                  {lightboxIndex + 1} / {filteredMedia.length}
                </span>
              </div>
              <h3 className="modern-gallery-lightbox__title">{activeLightboxItem.title}</h3>
              {activeLightboxItem.caption && (
                <p className="modern-gallery-lightbox__caption">{activeLightboxItem.caption}</p>
              )}
              {activeLightboxItem.location && (
                <div className="modern-gallery-lightbox__loc">
                  <MapPin size={13} style={{ color: '#B8964E' }} />
                  <span>{activeLightboxItem.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video modal */}
      {activeVideo && (
        <div
          className="modern-gallery-lightbox"
          onClick={closeVideoModal}
          role="dialog"
          aria-modal="true"
          aria-label={activeVideo.title}
          data-lenis-prevent
        >
          <div
            className="modern-gallery-lightbox__dialog modern-gallery-lightbox__dialog--video"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={closeVideoModal} className="modern-gallery-lightbox__close" aria-label="Close video">
              <X size={20} />
            </button>
            <div className="modern-gallery-video-container">
              <iframe
                src={`${activeVideo.videoUrl}${activeVideo.videoUrl.includes('?') ? '&' : '?'}autoplay=1&rel=0`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="modern-gallery-video-frame"
              />
            </div>
            <div className="modern-gallery-lightbox__info">
              <span className="modern-gallery-lightbox__badge">{activeVideo.category}</span>
              <h3 className="modern-gallery-lightbox__title">{activeVideo.title}</h3>
              {activeVideo.caption && <p className="modern-gallery-lightbox__caption">{activeVideo.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
