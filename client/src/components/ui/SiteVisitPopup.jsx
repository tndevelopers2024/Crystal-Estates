'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { business } from '../../data/site'
import './SiteVisitPopup.css'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function SiteVisitPopup() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [bubbleHidden, setBubbleHidden] = useState(false)
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0)
  const [preselectedPlotNo, setPreselectedPlotNo] = useState(null)
  const [dayIndex, setDayIndex] = useState(0)
  const [timeOfDay, setTimeOfDay] = useState('Morning (10 AM – 1 PM)')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState({ name: false, phone: false })
  const [submitError, setSubmitError] = useState('')
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

  // Fetch real projects from CRM database
  useEffect(() => {
    let isMounted = true

    function loadProjects() {
      if (projects.length > 0) return
      setProjectsLoading(true)
      fetch('/api/plots')
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return
          const list = Array.isArray(data.plots) ? data.plots : Array.isArray(data) ? data : []
          const activeProjects = list.filter((p) => {
            const st = String(p.status || '').toLowerCase()
            return st !== 'sold out' && st !== 'sold'
          })
          const finalProjects = activeProjects.length > 0 ? activeProjects : list
          setProjects(finalProjects)

          if (finalProjects.length > 0 && pathname) {
            const currentSlug = pathname.replace(/^\/projects\/?/, '').split('/')[0].trim()
            const matchIdx = finalProjects.findIndex(
              (p) => p.slug === currentSlug || p.id === currentSlug || p.projectId === currentSlug
            )
            if (matchIdx >= 0) {
              setSelectedProjectIndex(matchIdx)
            }
          }
        })
        .catch((err) => {
          console.warn('Could not fetch projects for site visit popup:', err)
        })
        .finally(() => {
          if (isMounted) setProjectsLoading(false)
        })
    }

    if (isOpen) {
      loadProjects()
    } else if (projects.length === 0 && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(loadProjects, { timeout: 5000 })
      return () => {
        isMounted = false
        window.cancelIdleCallback(idleId)
      }
    }

    return () => {
      isMounted = false
    }
  }, [isOpen, pathname, projects.length])

  const currentProject = projects[selectedProjectIndex] || null

  // Total available plots across loaded projects for the floating bubble
  const totalFreeSlots = useMemo(() => {
    let count = 0
    projects.forEach((p) => {
      if (Array.isArray(p.plots)) {
        count += p.plots.filter((x) => String(x.status).toLowerCase() === 'available').length
      }
    })
    return count
  }, [projects])

  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  // Other components open the popup with window.dispatchEvent(new CustomEvent('open-site-visit'))
  useEffect(() => {
    const onOpen = (e) => {
      setPreselectedPlotNo(e?.detail?.plotNo || null)
      setIsOpen(true)
    }
    window.addEventListener('open-site-visit', onOpen)
    return () => window.removeEventListener('open-site-visit', onOpen)
  }, [])

  // ESC key listener
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const resetForm = () => {
    setIsDone(false)
    setName('')
    setPhone('')
    setPreselectedPlotNo(null)
    setDayIndex(0)
    setTimeOfDay('Morning (10 AM – 1 PM)')
    setErrors({ name: false, phone: false })
    setSubmitError('')
  }

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
    setSubmitError('')
    if (hasErr) return

    setIsSubmitting(true)

    const chosenDay = daysList[dayIndex]?.fullLabel || 'This Weekend'
    const projectName = currentProject?.name || 'Crystal Estates Layout'
    const projectId = currentProject?.id || currentProject?.projectId || null
    const plotNote = preselectedPlotNo ? ` | Plot: ${preselectedPlotNo}` : ''

    const enquiryPayload = {
      name: trimmedName,
      phone: `+91${trimmedPhone}`,
      property: projectName,
      propertyId: projectId,
      interest: preselectedPlotNo ? `${projectName} - Plot ${preselectedPlotNo}` : projectName,
      unit: preselectedPlotNo ? `Plot ${preselectedPlotNo}` : 'Not allotted',
      datePreference: chosenDay,
      followUpDate: chosenDay,
      time: timeOfDay,
      notes: `Preferred Visit: ${chosenDay} (${timeOfDay})${plotNote}`,
      source: 'Website - Site Visit Popup',
      isSiteVisit: true,
    }

    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enquiryPayload),
      })
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`)
      }

      const generatedCode = `CE-${Math.floor(1000 + Math.random() * 9000)}`
      setPassCode(generatedCode)
      setIsDone(true)

      const whatsappMsg = `*New Site Visit Pass (${generatedCode})*\n\n👤 *Name:* ${trimmedName}\n📞 *Phone:* +91 ${trimmedPhone}\n📍 *Project:* ${projectName}${preselectedPlotNo ? `\n🏡 *Plot:* ${preselectedPlotNo}` : ''}\n📅 *Date:* ${chosenDay}\n⏰ *Time:* ${timeOfDay}\n\nPlease confirm my visit and share the Google Maps site location pin.`
      setTimeout(() => {
        window.open(
          `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(whatsappMsg)}`,
          '_blank'
        )
      }, 700)
    } catch (err) {
      console.warn('Booking post error:', err)
      setSubmitError('Could not submit your booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedDayLabel = daysList[dayIndex]?.fullLabel || 'This Weekend'

  return (
    <div className={`pv ${isOpen ? 'open' : ''}`} id="pv">
      {/* ── Interactive Card ── */}
      <section
        className={`pv-card ${isDone ? 'done' : ''}`}
        id="pvCard"
        role="dialog"
        aria-label="Book a free site visit"
        aria-hidden={!isOpen}
      >
        {/* Card Top / Header */}
        <div className="pv-top">
          <div>
            <h3 className="pv-title">
              Book a free<br />site visit
            </h3>
            <p className="pv-sub">Choose a project and day. We&apos;ll show you around.</p>
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

        {/* Single-Step Booking Form */}
        <div className="pv-views">
          <form
            className="pv-view show"
            id="pvV2"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Project Selector */}
            <div className="pv-field">
              <span className="pv-lab">Select Project</span>
              <select
                className="pv-project-select"
                id="pvProject"
                value={selectedProjectIndex}
                onChange={(e) => setSelectedProjectIndex(Number(e.target.value))}
                aria-label="Select Project"
                disabled={projectsLoading || projects.length === 0}
              >
                {projects.length === 0 ? (
                  <option value={0}>
                    {projectsLoading ? 'Loading projects…' : 'No projects available'}
                  </option>
                ) : (
                  projects.map((proj, pIdx) => (
                    <option key={`proj-${proj.id || proj._id || pIdx}-${pIdx}`} value={pIdx}>
                      {proj.name}{proj.location ? ` · ${proj.location}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

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

            {submitError && (
              <p className="pv-msg" style={{ display: 'block', marginTop: '10px', color: '#dc2626' }}>
                {submitError}
              </p>
            )}

            {/* Submit Action */}
            <div className="pv-btns">
              <button
                type="submit"
                className={`pv-btn main ${isSubmitting ? 'load' : ''}`}
                disabled={isSubmitting || projects.length === 0}
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
                <small>Project</small>
                <b id="pvTPlot">{currentProject?.name || 'Crystal Estates'}</b>
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
            {totalFreeSlots > 0 ? (
              <>
                <span id="pvLeft">{totalFreeSlots} free slots</span> left this weekend
              </>
            ) : (
              'Book a free guided tour'
            )}
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
