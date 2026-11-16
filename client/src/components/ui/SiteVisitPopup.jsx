'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { business } from '../../data/site'
import './SiteVisitPopup.css'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function SiteVisitPopup() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [bubbleHidden, setBubbleHidden] = useState(false)
  const [step, setStep] = useState(1)
  const [projects, setProjects] = useState([])
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState('All')
  const [selectedPlot, setSelectedPlot] = useState(null)
  const [dayIndex, setDayIndex] = useState(0)
  const [timeOfDay, setTimeOfDay] = useState('Morning (10 AM – 1 PM)')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState({ name: false, phone: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [passCode, setPassCode] = useState('CE-1000')

  // Generate 5-day picker options starting from today
  const daysList = useMemo(() => {
    const list = []
    const today = new Date()
    for (let i = 0; i < 5; i++) {
      const d = new Date()
      d.setDate(today.getDate() + i)
      const dayName = i === 0 ? 'Today' : DAY_NAMES[d.getDay()]
      const dateNum = d.getDate()
      const monthName = MONTH_NAMES[d.getMonth()]
      const fullLabel = `${DAY_NAMES[d.getDay()]}, ${dateNum} ${monthName}`
      list.push({ dayName, dateNum, monthName, fullLabel })
    }
    return list
  }, [])

  // 1. Fetch real projects & actual plots from API
  useEffect(() => {
    fetch('/api/plots')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data.plots) ? data.plots : Array.isArray(data) ? data : []
        if (list.length > 0) {
          // Find projects that have plots or are available
          const validProjects = list.filter((p) => Array.isArray(p.plots) && p.plots.length > 0)
          const fallbackProjects = list.filter((p) => p.status !== 'Sold Out' && p.status !== 'Sold')
          const finalProjects = validProjects.length > 0 ? validProjects : fallbackProjects

          setProjects(finalProjects)

          // If current URL matches a project slug, pre-select it
          if (pathname) {
            const currentSlug = pathname.replace(/^\/projects\/?/, '').trim()
            const matchIdx = finalProjects.findIndex(
              (p) => p.slug === currentSlug || p.id === currentSlug || p.projectId === currentSlug
            )
            if (matchIdx >= 0) {
              setSelectedProjectIndex(matchIdx)
              return
            }
          }

          // Otherwise prefer project with the most available plots (e.g. Somamangalam)
          const bestIdx = finalProjects.reduce((best, cur, idx) => {
            const curAvail = (cur.plots || []).filter((x) => String(x.status).toLowerCase() === 'available').length
            const bestAvail = (finalProjects[best]?.plots || []).filter((x) => String(x.status).toLowerCase() === 'available').length
            return curAvail > bestAvail ? idx : best
          }, 0)
          setSelectedProjectIndex(bestIdx)
        }
      })
      .catch((err) => {
        console.warn('Could not fetch plots for site visit popup:', err)
      })
  }, [pathname])

  const currentProject = projects[selectedProjectIndex] || null

  // 2. Extract and format the actual plots from the currently selected project
  const actualPlotsData = useMemo(() => {
    if (!currentProject || !Array.isArray(currentProject.plots) || currentProject.plots.length === 0) {
      // Fallback 16 plots if project data is not yet loaded
      return [
        { uid: 'plot-1-0', n: '1', sq: 1200, s: 'a' },
        { uid: 'plot-2-1', n: '2', sq: 1200, s: 's' },
        { uid: 'plot-3-2', n: '3', sq: 1500, s: 'a' },
        { uid: 'plot-4-3', n: '4', sq: 1500, s: 'a' },
        { uid: 'plot-5-4', n: '5', sq: 1200, s: 'a' },
        { uid: 'plot-6-5', n: '6', sq: 2400, s: 'a' },
        { uid: 'plot-7-6', n: '7', sq: 2400, s: 's' },
        { uid: 'plot-8-7', n: '8', sq: 1500, s: 'a' },
        'road',
        { uid: 'plot-9-8', n: '9', sq: 1500, s: 's' },
        { uid: 'plot-10-9', n: '10', sq: 1200, s: 'a' },
        { uid: 'plot-11-10', n: '11', sq: 2400, s: 'a' },
        { uid: 'plot-12-11', n: '12', sq: 1200, s: 'a' },
        { uid: 'plot-13-12', n: '13', sq: 2400, s: 'a' },
        { uid: 'plot-14-13', n: '14', sq: 1500, s: 'a' },
        { uid: 'plot-15-14', n: '15', sq: 1200, s: 's' },
        { uid: 'plot-16-15', n: '16', sq: 1500, s: 'a' },
      ]
    }

    const items = []
    const rawList = currentProject.plots

    rawList.forEach((p, idx) => {
      // Insert road divider every 8 plots
      if (idx > 0 && idx % 8 === 0) {
        items.push('road')
      }

      const rawNo = String(p.plotNo || p.number || p.plotNumber || p.id || (idx + 1)).replace(/^Plot\s*/i, '').trim()
      const areaNum = parseInt(String(p.area || p.sqft || p.size || '').replace(/\D/g, '')) || 1200
      const isAvail = String(p.status || '').toLowerCase() === 'available'
      const uniqueUid = p.id ? `plot-${p.id}-${idx}` : `plot-${rawNo}-${idx}`

      items.push({
        uid: uniqueUid,
        id: p.id || idx,
        n: rawNo,
        sq: areaNum,
        s: isAvail ? 'a' : 's',
        raw: p,
      })
    })

    return items
  }, [currentProject])

  // Count available plots across the project
  const availablePlotsCount = useMemo(() => {
    return actualPlotsData.filter((p) => typeof p === 'object' && p.s === 'a').length
  }, [actualPlotsData])

  // Total free slots across all loaded projects
  const totalFreeSlots = useMemo(() => {
    let count = 0
    projects.forEach((p) => {
      if (Array.isArray(p.plots)) {
        count += p.plots.filter((x) => String(x.status).toLowerCase() === 'available').length
      }
    })
    return count > 0 ? count : (availablePlotsCount > 0 ? availablePlotsCount : 6)
  }, [projects, availablePlotsCount])

  // Distinct sizes available in current project
  const availableSizes = useMemo(() => {
    const numericSizes = actualPlotsData
      .filter((p) => typeof p === 'object' && p.sq)
      .map((p) => p.sq)
    return ['All', ...Array.from(new Set(numericSizes)).sort((a, b) => a - b)]
  }, [actualPlotsData])

  // Reset selected plot if project changes
  const handleProjectChange = (e) => {
    const idx = Number(e.target.value)
    setSelectedProjectIndex(idx)
    setSelectedSize('All')
    setSelectedPlot(null)
  }

  // Handle plot selection
  const handlePlotClick = (p) => {
    if (p.s === 's') return
    if (selectedPlot && selectedPlot.uid === p.uid) {
      setSelectedPlot(null)
    } else {
      setSelectedPlot(p)
    }
  }

  // Handle modal open / close
  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  // ESC key listener
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Reset state
  const resetForm = () => {
    setIsDone(false)
    setName('')
    setPhone('')
    setSelectedPlot(null)
    setSelectedSize('All')
    setDayIndex(0)
    setTimeOfDay('Morning (10 AM – 1 PM)')
    setErrors({ name: false, phone: false })
    setStep(1)
  }

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()

    let hasErr = false
    const newErrors = { name: false, phone: false }

    if (trimmedName.length < 2) {
      newErrors.name = true
      hasErr = true
    }
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      newErrors.phone = true
      hasErr = true
    }

    setErrors(newErrors)
    if (hasErr) return

    setIsSubmitting(true)

    const chosenDay = daysList[dayIndex]?.fullLabel || 'This Weekend'
    const projectName = currentProject?.name || 'Crystal Estates Layout'
    const plotString = selectedPlot
      ? `Plot ${selectedPlot.n} (${selectedPlot.sq.toLocaleString('en-IN')} sq.ft)`
      : 'Decide on site'

    const visitPayload = {
      name: trimmedName,
      phone: `+91${trimmedPhone}`,
      property: projectName,
      project: projectName,
      plot: plotString,
      date: chosenDay,
      datePreference: chosenDay,
      time: timeOfDay,
      status: 'Pending',
      source: 'Website - Plot Finder Site Visit Popup',
    }

    try {
      // 1. Post to visits endpoint
      await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitPayload),
      }).catch(() => {})

      // 2. Also register lead in enquiry pipeline
      await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...visitPayload,
          interest: `${projectName} - ${plotString}`,
          followUpDate: chosenDay,
          stage: 'sitevisit',
          isSiteVisit: true,
        }),
      }).catch(() => {})
    } catch (err) {
      console.warn('Booking post error:', err)
    }

    // Generate ticket code
    const generatedCode = `CE-${Math.floor(1000 + Math.random() * 9000)}`
    setPassCode(generatedCode)
    setIsSubmitting(false)
    setIsDone(true)

    // Trigger WhatsApp notification
    const whatsappMsg = `*New Site Visit Pass (${generatedCode})*\n\n👤 *Name:* ${trimmedName}\n📞 *Phone:* +91 ${trimmedPhone}\n📍 *Project:* ${projectName}\n🏡 *Selected Plot:* ${plotString}\n📅 *Date:* ${chosenDay}\n⏰ *Time:* ${timeOfDay}\n\nPlease confirm my visit and share the Google Maps site location pin.`
    setTimeout(() => {
      window.open(
        `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(whatsappMsg)}`,
        '_blank'
      )
    }, 700)
  }

  const selectedDayLabel = daysList[dayIndex]?.fullLabel || 'This Weekend'

  return (
    <div className={`pv ${isOpen ? 'open' : ''}`} id="pv">
      {/* ── Interactive Card ── */}
      <section
        className={`pv-card ${isDone ? 'done' : ''}`}
        id="pvCard"
        role="dialog"
        aria-label="Plot finder and site visit booking"
        aria-hidden={!isOpen}
      >
        {/* Card Top / Header */}
        <div className="pv-top">
          <div>
            <h3 className="pv-title">
              Find your plot,<br />visit it free
            </h3>
            <p className="pv-sub">Pick a plot, choose a day. We&apos;ll show you around.</p>
          </div>
          <button
            type="button"
            className="pv-x"
            onClick={closeModal}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="pv-steps">
          <i className="on" id="pvS1" />
          <i className={step === 2 ? 'on' : ''} id="pvS2" />
        </div>
        <div className="pv-steplabel">
          <b>{step === 1 ? '1 · Choose plot' : '2 · Your details'}</b>
          <span>{step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}</span>
        </div>

        {/* Views Container */}
        <div className="pv-views">
          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 1: CHOOSE PLOT                                       */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className={`pv-view ${step === 1 ? 'show' : ''}`} id="pvV1">
            {/* Project Selector (when projects are loaded) */}
            {projects.length > 1 && (
              <div style={{ marginBottom: '14px' }}>
                <span className="pv-lab">Select Project</span>
                <select
                  className="pv-project-select"
                  value={selectedProjectIndex}
                  onChange={handleProjectChange}
                  aria-label="Select Project Layout"
                >
                  {projects.map((proj, pIdx) => {
                    const avail = (proj.plots || []).filter(
                      (x) => String(x.status).toLowerCase() === 'available'
                    ).length
                    return (
                      <option key={`proj-${proj.id || proj._id || pIdx}-${pIdx}`} value={pIdx}>
                        {proj.name} ({avail > 0 ? `${avail} plots available` : 'Active Layout'})
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Size Filter Chips */}
            <span className="pv-lab">Plot size</span>
            <div className="pv-sizes" id="pvSizes">
              {availableSizes.map((sz) => {
                const isActive = selectedSize === sz
                return (
                  <button
                    key={sz}
                    type="button"
                    className={`pv-size ${isActive ? 'on' : ''}`}
                    onClick={() => setSelectedSize(sz)}
                  >
                    {sz === 'All' ? 'All sizes' : `${sz.toLocaleString('en-IN')} sq.ft`}
                  </button>
                )
              })}
            </div>

            {/* Interactive Layout Map Grid */}
            <span className="pv-lab">
              Tap an available plot · {currentProject?.name || 'Crystal Estates Layout'}
            </span>
            <div className="pv-map">
              <div className="pv-grid" id="pvGrid">
                {actualPlotsData.map((item, idx) => {
                  if (item === 'road') {
                    return (
                      <div key={`road-${idx}`} className="pv-road">
                        30 FT AVENUE ROAD
                      </div>
                    )
                  }

                  const isSold = item.s === 's'
                  const isSelected = selectedPlot && selectedPlot.uid === item.uid
                  const isDimmed = selectedSize !== 'All' && item.sq !== selectedSize && !isSelected

                  return (
                    <button
                      key={item.uid || `plot-${idx}`}
                      type="button"
                      disabled={isSold}
                      title={isSold ? 'Already booked' : `Plot ${item.n} (${item.sq} sq.ft) - Available`}
                      className={`pv-plot ${isSold ? 'sold' : ''} ${isSelected ? 'sel' : ''} ${
                        isDimmed ? 'dim' : ''
                      }`}
                      style={{ animationDelay: `${(idx % 16) * 0.025}s` }}
                      onClick={() => handlePlotClick(item)}
                    >
                      P{item.n}
                      <small>{item.sq.toLocaleString('en-IN')}</small>
                    </button>
                  )
                })}
              </div>

              {/* Map Legend */}
              <div className="pv-legend">
                <span>
                  <i style={{ background: '#e6f4ec', border: '1px solid #b8d9c6' }} />
                  Available
                </span>
                <span>
                  <i style={{ background: 'var(--terra)' }} />
                  Selected
                </span>
                <span>
                  <i style={{ background: 'var(--sold)' }} />
                  Booked
                </span>
              </div>
            </div>

            {/* Selected Plot Info Box */}
            <div className={`pv-pick ${selectedPlot ? 'ok' : ''}`} id="pvPick">
              {selectedPlot ? (
                <span>
                  ✓&nbsp;<b>Plot {selectedPlot.n}</b> ·{' '}
                  {selectedPlot.sq.toLocaleString('en-IN')} sq.ft ·{' '}
                  {currentProject?.name || 'Crystal Estates Layout'}
                </span>
              ) : (
                'No plot selected yet. You can also skip and decide on site.'
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="pv-btns">
              <button
                type="button"
                className="pv-btn main"
                id="pvNext"
                onClick={() => setStep(2)}
              >
                <span>Continue</span>
                <span className="arrow">→</span>
              </button>
            </div>
            <p className="pv-foot">Free site visit · Free pickup · No obligation</p>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 2: VISITOR DETAILS & SCHEDULING                      */}
          {/* ══════════════════════════════════════════════════════════ */}
          <form
            className={`pv-view ${step === 2 ? 'show' : ''}`}
            id="pvV2"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Name Input */}
            <div className={`pv-field ${errors.name ? 'err' : ''}`} id="pvNF">
              <span className="pv-lab">Your name</span>
              <input
                className="pv-in"
                id="pvName"
                placeholder="e.g. Priya Sundar"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) setErrors((prev) => ({ ...prev, name: false }))
                }}
                autoComplete="name"
              />
              <div className="pv-msg">Please enter your name</div>
            </div>

            {/* Mobile Number Input */}
            <div className={`pv-field ${errors.phone ? 'err' : ''}`} id="pvPF">
              <span className="pv-lab">Mobile number</span>
              <div className="pv-row">
                <div className="pv-cc">+91</div>
                <input
                  className="pv-in"
                  id="pvPhone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                    setPhone(val)
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: false }))
                  }}
                  autoComplete="tel-national"
                />
              </div>
              <div className="pv-msg">Enter a valid 10-digit mobile number</div>
            </div>

            {/* Visit Day Picker */}
            <div className="pv-field">
              <span className="pv-lab">Visit day</span>
              <div className="pv-days" id="pvDays">
                {daysList.map((d, dIdx) => {
                  const isSelectedDay = dayIndex === dIdx
                  return (
                    <button
                      key={dIdx}
                      type="button"
                      className={`pv-day ${isSelectedDay ? 'on' : ''}`}
                      onClick={() => setDayIndex(dIdx)}
                    >
                      {d.dayName}
                      <b>{d.dateNum}</b>
                      {d.monthName}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time of Day Segment Selector */}
            <div className="pv-field" style={{ marginBottom: 0 }}>
              <span className="pv-lab">Time of day</span>
              <div
                className={`pv-seg ${timeOfDay.includes('Evening') ? 'right' : ''}`}
                id="pvSeg"
              >
                <button
                  type="button"
                  className={timeOfDay.includes('Morning') ? 'on' : ''}
                  onClick={() => setTimeOfDay('Morning (10 AM – 1 PM)')}
                >
                  ☀ Morning
                </button>
                <button
                  type="button"
                  className={timeOfDay.includes('Evening') ? 'on' : ''}
                  onClick={() => setTimeOfDay('Evening (3 PM – 6 PM)')}
                >
                  🌇 Evening
                </button>
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="pv-btns">
              <button
                type="button"
                className="pv-btn ghost"
                onClick={() => setStep(1)}
                aria-label="Back to step 1"
              >
                ←
              </button>
              <button
                type="submit"
                className={`pv-btn main ${isSubmitting ? 'load' : ''}`}
                disabled={isSubmitting}
                id="pvSubmit"
              >
                {isSubmitting && <span className="pv-spin" />}
                <span>{isSubmitting ? 'Booking…' : 'Book Free Visit'}</span>
              </button>
            </div>
            <p className="pv-foot">🔒 We only call to confirm your visit.</p>
          </form>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SUCCESS TICKET PASS                                       */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="pv-pass" id="pvPass">
          <div className="pv-ok">
            <svg viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="17" />
              <path d="M12 21l6 6 11-13" />
            </svg>
            <div>
              <h4>You&apos;re all set!</h4>
              <p>We&apos;ll call to confirm shortly.</p>
            </div>
          </div>

          <div className="pv-ticket">
            <div className="pv-ticket-head">
              <div>
                <small>Site visit pass</small>
                <b>Crystal Estates</b>
              </div>
              <div className="pv-code" id="pvCode">
                {passCode}
              </div>
            </div>

            <div className="pv-ticket-body">
              <div>
                <small>Guest</small>
                <b id="pvTName">{name.split(' ')[0] || 'Guest'}</b>
              </div>
              <div>
                <small>Plot</small>
                <b id="pvTPlot">
                  {selectedPlot
                    ? `Plot ${selectedPlot.n} · ${selectedPlot.sq.toLocaleString('en-IN')} sq.ft`
                    : 'Decide on site'}
                </b>
              </div>
              <div>
                <small>Date</small>
                <b id="pvTDate">{selectedDayLabel}</b>
              </div>
              <div>
                <small>Time</small>
                <b id="pvTTime">{timeOfDay.split(' (')[0]}</b>
              </div>
            </div>

            <div className="pv-tear" />

            <div className="pv-ticket-foot">
              <div className="pv-bars" />
              <span>Show this pass to our site executive on arrival.</span>
            </div>
          </div>

          <button
            type="button"
            className="pv-done"
            onClick={() => {
              closeModal()
              setTimeout(resetForm, 400)
            }}
          >
            Done
          </button>
        </div>
      </section>

      {/* ── Launcher: Round Button + Live Floating Bubble ── */}
      <div className="pv-fab-wrap" id="pvFabWrap">
        {!bubbleHidden && (
          <div className="pv-bubble">
            <i
              role="button"
              aria-label="Dismiss speech bubble"
              onClick={(e) => {
                e.stopPropagation()
                setBubbleHidden(true)
              }}
            >
              ✕
            </i>
            <b>Plots open for visit</b>
            <span id="pvLeft">{totalFreeSlots} free slots</span> left this weekend
          </div>
        )}

        <button
          type="button"
          className="pv-fab"
          id="pvFab"
          aria-label="Book a free site visit"
          onClick={openModal}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 21V4" />
            <g className="flag">
              <path d="M5 4h12l-3 4 3 4H5" fill="rgba(255,255,255,.25)" />
            </g>
            <path d="M3 21h18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
