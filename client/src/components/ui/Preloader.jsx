'use client'

import React, { useState, useEffect, useRef } from 'react'
import './Preloader.css'

/**
 * Crystal Estates Preloader Component
 * Preserves the original animated plot blueprint, typographic wordmark,
 * sprouting leaf accent, and progress meter from the design.
 */
export default function Preloader({ forceShow = false, isSuspense = false }) {
  const [isDone, setIsDone] = useState(false)
  const [isGone, setIsGone] = useState(false)
  const [pct, setPct] = useState(0)
  const [scaleX, setScaleX] = useState(0)
  const animFrameRef = useRef(null)

  useEffect(() => {
    // If this is a Suspense/loading fallback, avoid rendering a duplicate if one is already active
    if (isSuspense && typeof document !== 'undefined') {
      const existing = document.getElementById('pre')
      if (existing && !existing.classList.contains('done')) {
        setIsGone(true)
        return
      }
    }

    // Check if user has already seen preloader in this browser session (only when not forced)
    if (!forceShow && !isSuspense) {
      try {
        if (typeof window !== 'undefined' && sessionStorage.getItem('crystal_preloaded') === 'true') {
          setIsGone(true)
          return
        }
      } catch (_) {}
    }

    // Check for reduced motion preference
    const reduce = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

    // Snappy duration: ~950ms allows full animation to play without delaying the site
    const MIN_DURATION = reduce ? 150 : 950

    // Lock body scroll while preloader is active and reset scroll to top
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.scrollTo(0, 0)
    if (typeof window !== 'undefined' && window.__lenis) {
      window.__lenis.scrollTo(0, { immediate: true })
    }

    let loaded = typeof document !== 'undefined' && document.readyState === 'complete'

    const onLoad = () => {
      loaded = true
    }

    if (!loaded && typeof window !== 'undefined') {
      window.addEventListener('load', onLoad, { once: true })
    }

    // Safety timeout: Never get stuck waiting if an asset or third-party script hangs
    const safetyTimer = setTimeout(() => {
      loaded = true
    }, 2500)

    const start = performance.now()
    let shown = 0
    let doneTimer = null
    let goneTimer = null

    function tick(now) {
      const elapsed = now - start
      const t = Math.min(elapsed / MIN_DURATION, 1)
      let target = t < 1 ? Math.min(t * 100, loaded ? 100 : 90) : 100
      if (!loaded && t >= 1) target = 90

      // Faster easing for brisk, modern feel
      shown += (target - shown) * 0.28
      const v = Math.round(shown > 99.2 && target === 100 ? 100 : shown)

      setPct(v)
      setScaleX(v / 100)

      if (v >= 100) {
        doneTimer = setTimeout(() => {
          setIsDone(true)
          document.body.style.overflow = originalOverflow
          window.scrollTo(0, 0)
          if (typeof window !== 'undefined' && window.__lenis) {
            window.__lenis.scrollTo(0, { immediate: true })
          }

          try {
            sessionStorage.setItem('crystal_preloaded', 'true')
          } catch (_) {}

          goneTimer = setTimeout(() => {
            setIsGone(true)
          }, reduce ? 50 : 750)
        }, reduce ? 0 : 100)
        return
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)

    // Optional event listener to replay preloader on demand
    const handleReplay = () => {
      setIsGone(false)
      setIsDone(false)
      setPct(0)
      setScaleX(0)
      document.body.style.overflow = 'hidden'
      const replayStart = performance.now()
      let replayShown = 0

      function replayTick(now) {
        const t = Math.min((now - replayStart) / MIN_DURATION, 1)
        const target = t * 100
        replayShown += (target - replayShown) * 0.28
        const v = Math.round(replayShown > 99.2 ? 100 : replayShown)

        setPct(v)
        setScaleX(v / 100)

        if (v >= 100) {
          setTimeout(() => {
            setIsDone(true)
            document.body.style.overflow = originalOverflow
            setTimeout(() => {
              setIsGone(true)
            }, reduce ? 50 : 750)
          }, reduce ? 0 : 100)
          return
        }

        animFrameRef.current = requestAnimationFrame(replayTick)
      }

      animFrameRef.current = requestAnimationFrame(replayTick)
    }

    window.addEventListener('crystal-replay-preloader', handleReplay)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      clearTimeout(safetyTimer)
      clearTimeout(doneTimer)
      clearTimeout(goneTimer)
      window.removeEventListener('load', onLoad)
      window.removeEventListener('crystal-replay-preloader', handleReplay)
      document.body.style.overflow = originalOverflow
      window.scrollTo(0, 0)
      if (typeof window !== 'undefined' && window.__lenis) {
        window.__lenis.scrollTo(0, { immediate: true })
      }
    }
  }, [])

  if (isGone) return null

  return (
    <div
      id="pre"
      className={`crystal-preloader ${isDone ? 'done' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Crystal Estates"
    >
      {/* ── Background Plot Blueprint Line Drawing Animation ── */}
      <svg
        className="plots"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path className="road" pathLength="1" d="M0 300 H800" style={{ animationDelay: '.1s' }} />
        <path className="road" pathLength="1" d="M400 0 V600" style={{ animationDelay: '.2s' }} />
        <path className="road" pathLength="1" d="M0 120 L800 80" style={{ animationDelay: '.3s' }} />
        <path className="road" pathLength="1" d="M0 500 L800 540" style={{ animationDelay: '.4s' }} />
        <path pathLength="1" d="M60 120 H340 V260 H60 Z" style={{ animationDelay: '.3s' }} />
        <path pathLength="1" d="M460 100 H740 V260 H460 Z" style={{ animationDelay: '.45s' }} />
        <path pathLength="1" d="M60 340 H340 V480 H60 Z" style={{ animationDelay: '.6s' }} />
        <path pathLength="1" d="M200 120 V260 M60 190 H340" style={{ animationDelay: '.7s' }} />
        <path pathLength="1" d="M600 100 V260 M460 180 H740" style={{ animationDelay: '.8s' }} />
        <path pathLength="1" d="M200 340 V480 M60 410 H340" style={{ animationDelay: '.9s' }} />
        <path pathLength="1" d="M460 340 H740 V500 H460 Z" style={{ animationDelay: '.75s' }} />
        <path className="mine" pathLength="1" d="M600 340 H740 V420 H600 Z" />
      </svg>

      {/* ── Brand Typography with Letter Rise & Leaf Sprout ── */}
      <div className="brand">
        <div className="word" aria-hidden="true">
          <span><i style={{ '--n': 0 }}>C</i></span>
          <span><i style={{ '--n': 1 }}>R</i></span>
          <span><i style={{ '--n': 2 }}>Y</i></span>
          <span><i style={{ '--n': 3 }}>S</i></span>
          <span><i style={{ '--n': 4 }}>T</i></span>
          <span className="a">
            <i style={{ '--n': 5 }}>A</i>
            <b className="leaf">
              <svg viewBox="0 0 100 64">
                <path d="M2 60 C 10 22, 48 2, 98 4 C 92 44, 52 66, 2 60 Z" />
              </svg>
            </b>
          </span>
          <span><i style={{ '--n': 6 }}>L</i></span>
        </div>
        <div className="sub" aria-hidden="true">
          ESTATES
        </div>
      </div>

      {/* ── Progress Indicator Meter ── */}
      <div className="meter">
        <div className="bar">
          <b id="bar" style={{ transform: `scaleX(${scaleX})` }} />
        </div>
        <div className="pct" id="pct">
          {pct}%
        </div>
      </div>
    </div>
  )
}
