'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import Image from 'next/image'
import {
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Camera,
  Layers,
  Plane,
  Video,
  Grid,
} from 'lucide-react'
import { galleryCategories, galleryMedia } from '../../data/galleryData'

/**
 * Build a deduplicated, dynamic gallery media list from database plots + curated media
 */
function buildDynamicMedia(plots = [], staticMedia = []) {
  const dynamicItems = []

  plots.forEach((p) => {
    const rawName = p.name || p.projectName || 'Crystal Estates Property'
    const plotTitle = rawName.replace(/_/g, ' ').trim()
    const location = p.location || 'Chennai, Tamil Nadu'
    const shortLoc = location.split(',')[0].trim()

    // 1. Site Photos from Plot Images
    const imgs = Array.isArray(p.images) && p.images.length > 0 ? p.images : p.image ? [p.image] : []
    imgs.forEach((img, i) => {
      if (img) {
        dynamicItems.push({
          id: `dyn-${p.id || p.projectId || p._id || p.slug}-img-${i}`,
          title: `${plotTitle} — Site View`,
          category: 'Site Photos',
          image: img,
          location: shortLoc,
          caption: p.description || `On-ground site photograph of ${plotTitle} plotted development in ${location}.`,
        })
      }
    })

    // 2. Layouts from Plot Sanction Maps
    const layoutImg = p.layoutImage || p.layoutBackgroundUrl || p.layoutUrl
    if (layoutImg) {
      dynamicItems.push({
        id: `dyn-${p.id || p.projectId || p._id || p.slug}-layout`,
        title: `${plotTitle} — Master Layout Blueprint`,
        category: 'Layouts',
        image: layoutImg,
        location: shortLoc,
        caption: `Official approved layout plan and plot demarcation map for ${plotTitle}.`,
      })
    }

    // 3. Videos
    if (Array.isArray(p.videos) && p.videos.length > 0) {
      p.videos.forEach((v, vi) => {
        const vUrl = typeof v === 'string' ? v : v?.url
        if (vUrl) {
          dynamicItems.push({
            id: `dyn-${p.id || p.projectId || p._id || p.slug}-vid-${vi}`,
            title: `${plotTitle} — Guided Video Walkthrough`,
            category: 'Videos',
            image: imgs[0] || '/images/hero-estate.jpg',
            videoUrl: vUrl,
            location: shortLoc,
            caption: `Complete guided video tour and drone footage of ${plotTitle}.`,
          })
        }
      })
    }
  })

  // Deduplicate against static media by image path
  const seen = new Set()
  const result = []

  // Dynamic plot items first
  dynamicItems.forEach((item) => {
    if (item.image && !seen.has(item.image)) {
      seen.add(item.image)
      result.push(item)
    }
  })

  // Then static media items
  staticMedia.forEach((item) => {
    if (item.image && !seen.has(item.image)) {
      seen.add(item.image)
      result.push(item)
    }
  })

  return result
}

/**
 * Returns dynamic sizing class for varied grid matching reference image
 * Pattern of 5 items:
 * [0] Wide (col-span-2)
 * [1] Tall (col-span-1)
 * [2] Square
 * [3] Square
 * [4] Tall
 */
function getItemSizeClass(index) {
  const mod = index % 5
  if (mod === 0) return 'modern-gallery-item--wide'
  if (mod === 1 || mod === 4) return 'modern-gallery-item--tall'
  return 'modern-gallery-item--square'
}

/**
 * Individual Gallery Card with hardware acceleration, lazy loading, and error handling
 */
const GalleryCard = memo(function GalleryCard({ item, index, onOpen, isPriority }) {
  const [imgSrc, setImgSrc] = useState(item.image || '/images/hero-estate.jpg')
  const isVideo = item.category === 'Videos'
  const sizeClass = getItemSizeClass(index)

  useEffect(() => {
    setImgSrc(item.image || '/images/hero-estate.jpg')
  }, [item.image])

  const handleError = () => {
    setImgSrc('/images/hero-estate.jpg')
  }

  return (
    <article
      onClick={() => onOpen(item, index)}
      className={`modern-gallery-item ${sizeClass}`}
      tabIndex={0}
      role="button"
      aria-label={`View ${item.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item, index)
        }
      }}
    >
      <Image
        src={imgSrc}
        alt={item.title || 'Crystal Estates Gallery Image'}
        fill
        priority={isPriority}
        loading={isPriority ? 'eager' : 'lazy'}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="modern-gallery-image"
        onError={handleError}
      />

      {/* Video Play Button Overlay */}
      {isVideo && (
        <div className="modern-gallery-play-btn" aria-hidden="true">
          <Play size={22} fill="currentColor" style={{ marginLeft: '3px' }} />
        </div>
      )}

      {/* Bottom Overlay with Pills and Info */}
      <div className="modern-gallery-overlay">
        <div className="modern-gallery-overlay__pills">
          <span className="modern-gallery-overlay__pill">
            {item.category}
          </span>
          {item.location && (
            <span className="modern-gallery-overlay__pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={11} />
              <span>{item.location.split(',')[0]}</span>
            </span>
          )}
        </div>
        <h3 className="modern-gallery-overlay__title">
          {item.title}
        </h3>
        {item.caption && (
          <p className="modern-gallery-overlay__caption">
            {item.caption}
          </p>
        )}
      </div>
    </article>
  )
})

export default function GalleryClientView({
  initialPlots = [],
  title = 'Photo Gallery',
  subtitle = 'Captured moments from our on-ground sites, aerial drone panoramas, approved layouts, and guided walkthrough tours across Chennai.',
  badge = 'Our Gallery',
}) {
  const [activeTab, setActiveTab] = useState('All')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [activeVideo, setActiveVideo] = useState(null)
  const [mediaList, setMediaList] = useState(() => {
    if (Array.isArray(initialPlots) && initialPlots.length > 0) {
      return buildDynamicMedia(initialPlots, galleryMedia)
    }
    return galleryMedia
  })

  // Synchronize or fallback fetch plots if needed
  useEffect(() => {
    if (Array.isArray(initialPlots) && initialPlots.length > 0) {
      setMediaList(buildDynamicMedia(initialPlots, galleryMedia))
      return
    }

    fetch('/api/plots')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plots) && data.plots.length > 0) {
          setMediaList(buildDynamicMedia(data.plots, galleryMedia))
        }
      })
      .catch(() => {})
  }, [initialPlots])

  const filteredMedia =
    activeTab === 'All'
      ? mediaList
      : mediaList.filter((item) => item.category === activeTab)

  const openMedia = useCallback((item, idx) => {
    if (item.category === 'Videos' && item.videoUrl) {
      setActiveVideo(item)
    } else {
      setLightboxIndex(idx)
    }
  }, [])

  const closeLightbox = () => setLightboxIndex(null)
  const closeVideoModal = () => setActiveVideo(null)

  const nextImage = useCallback(
    () => setLightboxIndex((prev) => (prev + 1) % filteredMedia.length),
    [filteredMedia.length]
  )

  const prevImage = useCallback(
    () =>
      setLightboxIndex(
        (prev) => (prev - 1 + filteredMedia.length) % filteredMedia.length
      ),
    [filteredMedia.length]
  )

  useEffect(() => {
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
  }, [lightboxIndex, nextImage, prevImage])

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'All':
        return <Grid size={13} />
      case 'Site Photos':
        return <Camera size={13} />
      case 'Layouts':
        return <Layers size={13} />
      case 'Drone Views':
        return <Plane size={13} />
      case 'Videos':
        return <Video size={13} />
      default:
        return null
    }
  }

  const activeLightboxItem = lightboxIndex !== null ? filteredMedia[lightboxIndex] : null

  return (
    <section className="modern-gallery-section">
      <div className="modern-gallery-container">
        {/* Header matching Reference Image Layout */}
        <div className="modern-gallery-header">
          <div className="modern-gallery-header__left">
            <span className="modern-gallery-badge">
              {badge}
            </span>
            <h1 className="modern-gallery-title">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="modern-gallery-subtitle">
              {subtitle}
            </p>
          )}
        </div>

        {/* Interactive Category Filter Tabs */}
        <div className="modern-gallery-tabs" role="tablist" aria-label="Gallery category filter">
          {galleryCategories.map((cat) => {
            const isActive = activeTab === cat
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(cat)}
                className={`modern-gallery-tab ${isActive ? 'is-active' : ''}`}
              >
                {getCategoryIcon(cat)}
                <span>{cat}</span>
              </button>
            )
          })}
        </div>

        {/* Dynamic Varied Image Grid - Non-overlapping & Performance Optimized */}
        <div className="modern-gallery-grid">
          {filteredMedia.map((item, idx) => (
            <GalleryCard
              key={item.id || idx}
              item={item}
              index={idx}
              onOpen={openMedia}
              isPriority={idx < 2}
            />
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && activeLightboxItem && (
        <div
          className="modern-gallery-lightbox"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image Lightbox"
        >
          <div
            className="modern-gallery-lightbox__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="modern-gallery-lightbox__close"
              aria-label="Close lightbox"
            >
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

            <div className="modern-gallery-lightbox__img-box">
              <Image
                src={activeLightboxItem.image || '/images/hero-estate.jpg'}
                alt={activeLightboxItem.title || 'Crystal Estates'}
                fill
                priority
                sizes="(max-width: 1200px) 100vw, 1200px"
                className="modern-gallery-lightbox__img"
              />
            </div>

            <div className="modern-gallery-lightbox__info">
              <div className="modern-gallery-lightbox__header">
                <span className="modern-gallery-lightbox__badge">
                  {activeLightboxItem.category}
                </span>
                <span className="modern-gallery-lightbox__counter">
                  {lightboxIndex + 1} / {filteredMedia.length}
                </span>
              </div>
              <h3 className="modern-gallery-lightbox__title">
                {activeLightboxItem.title}
              </h3>
              {activeLightboxItem.caption && (
                <p className="modern-gallery-lightbox__caption">
                  {activeLightboxItem.caption}
                </p>
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

      {/* Video Modal Player */}
      {activeVideo && (
        <div
          className="modern-gallery-lightbox"
          onClick={closeVideoModal}
          role="dialog"
          aria-modal="true"
          aria-label="Video Walkthrough"
        >
          <div
            className="modern-gallery-lightbox__dialog modern-gallery-lightbox__dialog--video"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeVideoModal}
              className="modern-gallery-lightbox__close"
              aria-label="Close video"
            >
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
              <span className="modern-gallery-lightbox__badge">
                {activeVideo.category}
              </span>
              <h3 className="modern-gallery-lightbox__title">
                {activeVideo.title}
              </h3>
              {activeVideo.caption && (
                <p className="modern-gallery-lightbox__caption">
                  {activeVideo.caption}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
