'use client'

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar,
  CheckCircle2,
  Compass,
  ArrowRight,
  MapPin,
  ExternalLink,
  Phone,
  Send,
  Building2,
  ShieldCheck,
  Layers,
  ChevronDown,
} from 'lucide-react'
import { parseLayoutSvg, plotKey } from '../../layout3d/parseLayoutSvg'
import { buildPhases } from '../../layout3d/phases'
import Hero3DScene from './Hero3DScene'
import './hero3d.css'

const SCENE_CONFIGS = [
  { id: 'sky', label: '01 Sky', start: 0.0, end: 0.20 },
  { id: 'aerial', label: '02 Aerial', start: 0.20, end: 0.40 },
  { id: 'plots', label: '03 Plots', start: 0.40, end: 0.65 },
  { id: 'office', label: '04 Office', start: 0.65, end: 0.85 },
  { id: 'visit', label: '05 Visit', start: 0.85, end: 1.00 },
]

export default function Hero3DExperience({ initialProject }) {
  const containerRef = useRef(null)
  const canvasHolderRef = useRef(null)
  const sceneInstanceRef = useRef(null)

  const [activeSceneIdx, setActiveSceneIdx] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [hoveredPlot, setHoveredPlot] = useState(null)

  // Notify website's default preloader when 3D hero assets and initial frame are ready
  const handleReady = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crystal-hero-ready'))
    }
  }, [])

  // Safety Timeout: Never hang default preloader if network is constrained
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      handleReady()
    }, 2500)
    return () => clearTimeout(safetyTimer)
  }, [handleReady])

  // Booking / Registration Form State
  const [activeTab, setActiveTab] = useState('visit') // 'visit' | 'booking'
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    date: '',
    cabPickup: true,
    plotNo: '',
    sizePreference: '1200 sq.ft',
    facingPreference: 'East',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingRef, setBookingRef] = useState('')

  // ─────────────────────────────────────────────────────────────
  // 1. PROJECT & SVG DATA LOADING
  // ─────────────────────────────────────────────────────────────
  const [projectData, setProjectData] = useState(initialProject || null)

  useEffect(() => {
    if (!initialProject) {
      fetch('/api/plots/somamangalam')
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && data.plot) {
            setProjectData(data.plot)
          }
        })
        .catch(() => { })
    }
  }, [initialProject])

  // Extract layout URL & DB plots
  const phases = useMemo(() => buildPhases(projectData), [projectData])
  const activePhase = phases[0] || null

  const dbRecordsMap = useMemo(() => {
    const m = new Map()
    const list = activePhase?.plots || projectData?.plots || []
    for (const r of list) {
      const k = plotKey(r.plotNo)
      if (k && !m.has(k)) m.set(k, r)
    }
    return m
  }, [activePhase, projectData])

  // ─────────────────────────────────────────────────────────────
  // 2. INITIALIZE 3D SCENE
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = canvasHolderRef.current
    if (!container) return

    let cancelled = false
    const scene = new Hero3DScene(container, {
      onHoverPlot: (plot) => {
        if (!cancelled) setHoveredPlot(plot)
      },
      onSelectPlot: (plot) => {
        if (!cancelled && plot?.no) {
          setFormData((prev) => ({ ...prev, plotNo: plot.no }))
        }
      },
      onSceneChange: (idx) => {
        if (!cancelled) setActiveSceneIdx(idx)
      },
      onReady: () => {
        if (!cancelled) handleReady()
      },
    })
    sceneInstanceRef.current = scene

    // Load SVG geometry
    const rawUrl =
      activePhase?.layoutUrl ||
      projectData?.layoutUrl ||
      '/documents/layout-somangalam_phase-1_all_plots_redesigned-1795091449267.svg'

    const fetchSvg = async () => {
      let text = null
      const urlsToTry = [
        rawUrl,
        '/documents/Somangalam_Phase-1_Plots.svg',
        '/documents/layout-somangalam_phase-1_all_plots_redesigned-1795091449267.svg',
      ]

      for (const u of urlsToTry) {
        if (!u) continue
        try {
          const res = await fetch(u)
          if (res.ok) {
            text = await res.text()
            if (text && text.includes('<svg')) break
          }
        } catch {
          /* try next */
        }
      }

      if (cancelled) return

      const parsed = parseLayoutSvg(
        text,
        projectData?.plots || [],
        projectData?.viewBox || '0 0 2245 1588',
      )

      scene.load({
        viewBox: parsed.viewBox,
        plots: parsed.plots,
        roads: parsed.roads,
        openSpaces: parsed.openSpaces,
        unmapped: parsed.unmapped,
        records: dbRecordsMap,
      })
    }

    fetchSvg()

    return () => {
      cancelled = true
      scene.dispose()
      sceneInstanceRef.current = null
    }
  }, [activePhase, projectData, dbRecordsMap, handleReady])

  // ─────────────────────────────────────────────────────────────
  // 3. SCROLL PROGRESSION & SCENE SYNCHRONIZATION
  // ─────────────────────────────────────────────────────────────
  const onScroll = useCallback(() => {
    const section = containerRef.current
    if (!section) return
    const rect = section.getBoundingClientRect()
    const scrollable = rect.height - window.innerHeight
    if (scrollable <= 0) return

    const progress = Math.max(0, Math.min(1, -rect.top / scrollable))
    setScrollProgress(progress)

    if (sceneInstanceRef.current) {
      sceneInstanceRef.current.setProgress(progress)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [onScroll])

  // Jump to specific scene when clicking navigation dot
  const scrollToScene = (targetIdx) => {
    const section = containerRef.current
    if (!section) return
    const cfg = SCENE_CONFIGS[targetIdx]
    if (!cfg) return

    const scrollable = section.scrollHeight - window.innerHeight
    const targetScroll = section.offsetTop + cfg.start * scrollable
    window.scrollTo({ top: targetScroll, behavior: 'smooth' })
  }

  // ─────────────────────────────────────────────────────────────
  // 4. FORM HANDLERS & CRM INTEGRATION
  // ─────────────────────────────────────────────────────────────
  const handleInputChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData((prev) => ({ ...prev, [field]: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.phone.trim()) return

    setSubmitting(true)
    const refCode = `CE-${Math.floor(100000 + Math.random() * 900000)}`

    const isVisit = activeTab === 'visit'
    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      property: 'Crystal Estate - Somamangalam',
      interest: isVisit
        ? `Site Visit: ${formData.date || 'Flexible Weekend'} (Cab: ${formData.cabPickup ? 'Yes' : 'No'})`
        : `Plot Booking: Plot ${formData.plotNo || formData.sizePreference} (${formData.facingPreference} Facing)`,
      message: formData.message.trim() || `Reference Code: ${refCode}`,
      source: isVisit ? 'Website - Homepage 3D Site Visit' : 'Website - Homepage 3D Plot Booking',
      stage: 'new',
      timestamp: new Date().toISOString(),
    }

    try {
      await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => { })
    } catch {
      /* ignore network drop */
    }

    setBookingRef(refCode)
    setSubmitted(true)
    setSubmitting(false)
  }

  // Helper for scene stage opacity calculation
  const getStageStyle = (start, end) => {
    const p = scrollProgress
    if (p < start - 0.04 || p > end + 0.04) {
      return { opacity: 0, transform: 'translate3d(0, 24px, 0)', pointerEvents: 'none', visibility: 'hidden' }
    }
    const peakStart = start + 0.03
    const peakEnd = end - 0.03
    let opacity = 1
    let translateY = 0

    if (p < peakStart) {
      const t = (p - start) / Math.max(0.01, peakStart - start)
      opacity = Math.max(0, Math.min(1, t))
      translateY = (1 - opacity) * 20
    } else if (p > peakEnd) {
      const t = (p - peakEnd) / Math.max(0.01, end - peakEnd)
      opacity = Math.max(0, Math.min(1, 1 - t))
      translateY = -t * 20
    }

    return {
      opacity: opacity.toFixed(3),
      transform: `translate3d(0, ${translateY.toFixed(1)}px, 0)`,
      visibility: opacity > 0.02 ? 'visible' : 'hidden',
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    }
  }

  return (
    <section id="home" ref={containerRef} className="h3d-hero" aria-label="Crystal Estates 3D Interactive Journey">
      <div className="h3d-frame">
        {/* Branded static fallback preventing any white canvas flash */}
        <div className="h3d-canvas-fallback" aria-hidden="true" />

        {/* Fullscreen 3D WebGL Canvas */}
        <div ref={canvasHolderRef} className="h3d-canvas-container" />

        {/* Cinematic Vignettes for High Contrast Readability */}
        <div className="h3d-shade-bottom" aria-hidden="true" />
        <div className="h3d-shade-top" aria-hidden="true" />

        {/* ─────────────────────────────────────────────────────────────
            SCENE STAGES (5 Continuous Scroll Moments)
            ───────────────────────────────────────────────────────────── */}
        <div className="h3d-stages">
          {/* ── Scene 01: Sky View / Opening Hero (0.00 – 0.20) ── */}
          <div
            className={`h3d-stage h3d-stage--scene-0 ${activeSceneIdx === 0 ? 'h3d-stage--active' : ''}`}
            style={getStageStyle(0.0, 0.20)}
          >
            <div className="h3d-badge">
              <span className="h3d-badge__dot" />
              <span>Crystal Estates · Chennai</span>
            </div>
            <h1 className="h3d-headline">
              Discover a Place to<br />Call Your Own
            </h1>
            <p className="h3d-lead">
              Explore thoughtfully planned plots at Crystal Estate, where your next chapter begins.
            </p>
            <div className="h3d-features-chip">
              <span>CMDA &amp; DTCP Approved</span>
              <span>·</span>
              <span>100% Clear Title Guarantee</span>
            </div>
          </div>

          {/* ── Scene 02: Aerial Property Reveal (0.20 – 0.40) ── */}
          <div
            className={`h3d-stage h3d-stage--scene-1 ${activeSceneIdx === 1 ? 'h3d-stage--active' : ''}`}
            style={getStageStyle(0.20, 0.40)}
          >
            <div className="h3d-badge">
              <span className="h3d-badge__dot" />
              <span>Flagship Plotted Community</span>
            </div>
            <h2 className="h3d-headline">
              Your Future<br />Begins Here
            </h2>
            <p className="h3d-lead">
              Explore a thoughtfully planned community with clearly defined plots and convenient access.
            </p>
            <div className="h3d-features-chip">
              <span><strong>500+</strong> Demarcated Plots</span>
              <span>·</span>
              <span>40ft &amp; 30ft Blacktop Roads</span>
            </div>
          </div>

          {/* ── Scene 03: Actual 3D Plot Layout Reveal (0.40 – 0.65) ── */}
          <div
            className={`h3d-stage h3d-stage--scene-2 ${activeSceneIdx === 2 ? 'h3d-stage--active' : ''}`}
            style={getStageStyle(0.40, 0.65)}
          >
            <div className="h3d-badge">
              <span className="h3d-badge__dot" />
              <span>Interactive 3D Masterplan</span>
            </div>
            <h2 className="h3d-headline">
              Explore Every Plot.<br />Visualize Your Future.
            </h2>
            <p className="h3d-lead">
              Take a closer look at the available plots and discover the space that feels right for you.
            </p>

            {/* Live Status Legend */}
            <div className="h3d-legend">
              <div className="h3d-legend__item">
                <span className="h3d-legend__color h3d-legend__color--avail" /> Available
              </div>
              <div className="h3d-legend__item">
                <span className="h3d-legend__color h3d-legend__color--booked" /> Booked
              </div>
              <div className="h3d-legend__item">
                <span className="h3d-legend__color h3d-legend__color--sold" /> Sold
              </div>
            </div>

            {/* Hovered Plot Detail Card */}
            {hoveredPlot && (
              <div className="h3d-plot-card">
                <div className="h3d-plot-card__head">
                  <h3 className="h3d-plot-card__title">Plot No. {hoveredPlot.no}</h3>
                  <span
                    className={`h3d-plot-card__badge h3d-plot-card__badge--${String(
                      hoveredPlot.record?.status || 'available',
                    ).toLowerCase()}`}
                  >
                    {hoveredPlot.record?.status || 'Available'}
                  </span>
                </div>
                <div className="h3d-plot-card__specs">
                  <div className="h3d-plot-card__spec">
                    <label>Area</label>
                    <span>{hoveredPlot.record?.area || '1,200 sq.ft'}</span>
                  </div>
                  <div className="h3d-plot-card__spec">
                    <label>Facing</label>
                    <span>{hoveredPlot.record?.facing || 'East'}</span>
                  </div>
                  <div className="h3d-plot-card__spec">
                    <label>Dimensions</label>
                    <span>{hoveredPlot.record?.dimensions || "30' × 40'"}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="h3d-btn-group">
              <button
                type="button"
                className="h3d-btn-primary"
                onClick={() => scrollToScene(4)}
              >
                Book This Layout <ArrowRight size={14} />
              </button>
              <Link
                href="/projects/somamangalam/3d"
                className="h3d-btn-outline"
                target="_blank"
                rel="noreferrer"
              >
                Full 3D Viewer <ExternalLink size={13} />
              </Link>
            </div>
          </div>

          {/* ── Scene 04: Crystal Estate Office Reveal (0.65 – 0.85) ── */}
          <div
            className={`h3d-stage h3d-stage--scene-3 ${activeSceneIdx === 3 ? 'h3d-stage--active' : ''}`}
            style={getStageStyle(0.65, 0.85)}
          >
            <div className="h3d-badge">
              <span className="h3d-badge__dot" />
              <span>Crystal Estate Welcome Lounge</span>
            </div>
            <h2 className="h3d-headline">
              Let&apos;s Make Your<br />Visit Count
            </h2>
            <p className="h3d-lead">
              Step closer to Crystal Estate. Our team is ready to help you explore the property and find your ideal plot.
            </p>
            <div className="h3d-features-chip">
              <span>On-Site Client Pavilion</span>
              <span>·</span>
              <span>Open 7 Days a Week</span>
            </div>
          </div>

          {/* ── Scene 05: Site Visit Registration / Booking (0.85 – 1.00) ── */}
          <div
            className={`h3d-stage h3d-stage--scene-4 ${activeSceneIdx === 4 ? 'h3d-stage--active' : ''}`}
            style={getStageStyle(0.85, 1.00)}
          >
            <div className="h3d-booking-card">
              <div className="h3d-badge">
                <span className="h3d-badge__dot" />
                <span>Experience Crystal Estate</span>
              </div>
              <h2 className="h3d-headline" style={{ fontSize: 'clamp(22px, 2.5vw, 30px)' }}>
                Your Journey Starts Here
              </h2>
              <p className="h3d-lead" style={{ fontSize: '13.5px', marginBottom: '14px' }}>
                Experience Crystal Estate in person. Register for a visit or speak with our team about your preferred plot.
              </p>

              {/* Tabs: Register for Site Visit vs Enquire About Booking */}
              <div className="h3d-tabs">
                <button
                  type="button"
                  className={`h3d-tab ${activeTab === 'visit' ? 'h3d-tab--active' : ''}`}
                  onClick={() => {
                    setActiveTab('visit')
                    setSubmitted(false)
                  }}
                >
                  Register for Site Visit
                </button>
                <button
                  type="button"
                  className={`h3d-tab ${activeTab === 'booking' ? 'h3d-tab--active' : ''}`}
                  onClick={() => {
                    setActiveTab('booking')
                    setSubmitted(false)
                  }}
                >
                  Enquire About Plot Booking
                </button>
              </div>

              {!submitted ? (
                <form onSubmit={handleSubmit} className="h3d-form">
                  <div className="h3d-form-row">
                    <div className="h3d-input-group">
                      <label htmlFor="h3d-name">Your Full Name *</label>
                      <input
                        id="h3d-name"
                        type="text"
                        required
                        className="h3d-input"
                        placeholder="e.g. Ramesh Kumar"
                        value={formData.name}
                        onChange={handleInputChange('name')}
                      />
                    </div>
                    <div className="h3d-input-group">
                      <label htmlFor="h3d-phone">Phone Number *</label>
                      <input
                        id="h3d-phone"
                        type="tel"
                        required
                        className="h3d-input"
                        placeholder="+91 98400 12345"
                        value={formData.phone}
                        onChange={handleInputChange('phone')}
                      />
                    </div>
                  </div>

                  {activeTab === 'visit' ? (
                    <>
                      <div className="h3d-form-row">
                        <div className="h3d-input-group">
                          <label htmlFor="h3d-date">Preferred Date</label>
                          <input
                            id="h3d-date"
                            type="date"
                            className="h3d-input"
                            value={formData.date}
                            onChange={handleInputChange('date')}
                          />
                        </div>
                        <div className="h3d-input-group">
                          <label htmlFor="h3d-email">Email Address</label>
                          <input
                            id="h3d-email"
                            type="email"
                            className="h3d-input"
                            placeholder="name@domain.com"
                            value={formData.email}
                            onChange={handleInputChange('email')}
                          />
                        </div>
                      </div>
                      <label className="h3d-checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.cabPickup}
                          onChange={handleInputChange('cabPickup')}
                        />
                        <span>Complimentary AC cab pickup for family from Chennai</span>
                      </label>
                    </>
                  ) : (
                    <div className="h3d-form-row">
                      <div className="h3d-input-group">
                        <label htmlFor="h3d-plot">Preferred Plot # or Size</label>
                        <input
                          id="h3d-plot"
                          type="text"
                          className="h3d-input"
                          placeholder="e.g. Plot 108 or 1,200 sq.ft"
                          value={formData.plotNo}
                          onChange={handleInputChange('plotNo')}
                        />
                      </div>
                      <div className="h3d-input-group">
                        <label htmlFor="h3d-facing">Facing Preference</label>
                        <select
                          id="h3d-facing"
                          className="h3d-input"
                          value={formData.facingPreference}
                          onChange={handleInputChange('facingPreference')}
                          style={{ background: '#132820' }}
                        >
                          <option value="East">East Facing</option>
                          <option value="North">North Facing</option>
                          <option value="South">South Facing</option>
                          <option value="West">West Facing</option>
                          <option value="Corner">Corner Plot</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={submitting} className="h3d-submit-btn">
                    {submitting
                      ? 'Confirming with Advisor…'
                      : activeTab === 'visit'
                        ? 'Schedule Guided Site Visit'
                        : 'Lock-In Plot Enquiry'}
                  </button>
                </form>
              ) : (
                <div className="h3d-success-state">
                  <div className="h3d-success-badge">
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 className="h3d-success-title">
                    {activeTab === 'visit' ? 'Site Visit Registered!' : 'Plot Enquiry Received!'}
                  </h3>
                  <p className="h3d-success-desc">
                    Your reference pass is <strong>{bookingRef}</strong>. Our senior land advisor will call you to coordinate the guided tour and masterplan walkthrough.
                  </p>
                  <a
                    href={`https://wa.me/919444000000?text=${encodeURIComponent(
                      `Hello Crystal Estates, I have submitted a ${activeTab === 'visit' ? 'Site Visit' : 'Plot Booking'
                      } request (Pass: ${bookingRef}). Kindly confirm details.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h3d-btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Confirm on WhatsApp Directly <ArrowRight size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Scene Navigation Tracker (Right Edge) ── */}
        <nav className="h3d-nav" aria-label="3D Journey Progress">
          {SCENE_CONFIGS.map((cfg, idx) => (
            <button
              key={cfg.id}
              type="button"
              className={`h3d-nav-item ${activeSceneIdx === idx ? 'h3d-nav-item--active' : ''}`}
              onClick={() => scrollToScene(idx)}
              aria-label={`Jump to ${cfg.label}`}
            >
              <span className="h3d-nav-label">{cfg.label}</span>
              <span className="h3d-nav-dot" />
            </button>
          ))}
        </nav>

        {/* ── Scroll Indicator (Visible on Scene 01) ── */}
        {scrollProgress < 0.12 && (
          <div className="h3d-scroll-prompt">
            <span>Scroll to explore</span>
            <ChevronDown size={16} />
          </div>
        )}
      </div>
    </section>
  )
}
