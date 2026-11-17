'use client'

import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Lenis Smooth Scroll Provider with Robust Navigation Scroll Management
 * - Buttery-smooth momentum scrolling for wheel and touch
 * - Enforces immediate, instant scroll-to-top on route navigation
 * - Prevents footer flash and eliminates scroll position carryover
 * - Disables native browser scrollRestoration conflict
 */
export default function SmoothScroll({ children }) {
  const lenisRef = useRef(null)
  const pathname = usePathname()
  const prevPathnameRef = useRef(pathname)

  // 1. Disable browser's native automatic scroll restoration to avoid conflicts
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // 2. Initialize Lenis instance
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      return
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      infinite: false,
    })

    lenisRef.current = lenis
    window.__lenis = lenis

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    const rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
      if (window.__lenis === lenis) {
        delete window.__lenis
      }
    }
  }, [])

  // 3. Reset scroll position immediately on pathname change before browser paint
  useIsomorphicLayoutEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname

      // Reset Lenis internal scroll state immediately
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true })
      }
      // Reset native browser scroll state instantly
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [pathname])

  // 4. Capture link clicks: Reset scroll immediately when user clicks internal navigation link
  useEffect(() => {
    const handleLinkClick = (e) => {
      const anchor = e.target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Ignore external links, mailto, tel, target="_blank"
      if (
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.target === '_blank'
      ) {
        return
      }

      // Ignore hash anchors on the same page
      if (href.startsWith('#')) return

      try {
        const targetUrl = new URL(anchor.href, window.location.href)
        if (targetUrl.pathname !== window.location.pathname) {
          // Immediately reset scroll to 0 so the new page never paints at previous scroll offset
          if (lenisRef.current) {
            lenisRef.current.scrollTo(0, { immediate: true })
          }
          window.scrollTo(0, 0)
          document.documentElement.scrollTop = 0
          document.body.scrollTop = 0
        }
      } catch (_) {}
    }

    document.addEventListener('click', handleLinkClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleLinkClick, { capture: true })
    }
  }, [])

  return <>{children}</>
}

