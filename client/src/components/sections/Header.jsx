'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { mainNav } from '../../config/navigation'
import './Header.css'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [inHero, setInHero] = useState(true)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isHome = pathname === '/'

  // Track scroll position: within hero section vs scrolled past hero
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY

      if (isHome) {
        const heroEl = document.getElementById('home')
        const rawHeight = heroEl?.offsetHeight || 0
        const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800
        const heroHeight = rawHeight > 200 ? rawHeight : winHeight
        const insideHero = scrollY < heroHeight - 80
        setInHero(insideHero)
        setScrolled(!insideHero && scrollY > 20)
      } else {
        setInHero(false)
        setScrolled(scrollY > 20)
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isHome])

  // Close mobile drawer on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Close mobile drawer on resize above 1024px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Dedicated full-page layout viewer renders clean without global navigation menu
  if (pathname?.startsWith('/layout-viewer')) {
    return null
  }

  // Check if a nav link is active
  const isItemActive = (href) => {
    if (href === '/') return pathname === '/'
    if (href === '/projects') return pathname === '/projects' || pathname?.startsWith('/projects/')
    if (href === '/news') return pathname === '/news' || pathname?.startsWith('/news/')
    return pathname === href || pathname?.startsWith(`${href}/`)
  }

  const handleGetInTouch = (e) => {
    e.preventDefault()
    setOpen(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-site-visit'))
    }
  }

  // Centered navigation items (includes Home before About Us)
  const desktopLinks = mainNav

  return (
    <>
      <header
        className={`header-ref ${inHero ? 'header-ref--in-hero' : ''} ${
          scrolled ? 'header-ref--scrolled' : ''
        } ${!isHome ? 'header-ref--inner' : ''}`}
      >
      <div className="header-ref__wrapper">
        <div className="header-ref__bar">
          {/* Logo on Left */}
          <Link
            href="/"
            className="header-ref__brand"
            onClick={() => setOpen(false)}
            aria-label="Crystal Estates - Home"
          >
            <div className="header-ref__brand-wrap">
              <Image
                src="/logo-white.png"
                alt="Crystal Estates"
                width={136}
                height={46}
                priority
                className="header-ref__brand-img"
              />
              <span className="header-ref__brand-tagline">ASSETS CREATOR</span>
            </div>
          </Link>

          {/* Centered Navigation Links (Desktop >= 1024px) */}
          <nav className="header-ref__nav" aria-label="Main Navigation">
            {desktopLinks.map((item) => {
              const active = isItemActive(item.href)
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`header-ref__nav-link ${
                    active ? 'header-ref__nav-link--active' : ''
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right Action: Get In Touch Button & Mobile Burger */}
          <div className="header-ref__actions">
            <button
              type="button"
              onClick={handleGetInTouch}
              className="header-ref__get-in-touch-btn"
              aria-label="Get in Touch with Crystal Estates"
            >
              Get In Touch
            </button>

            <button
              type="button"
              className="header-ref__burger"
              onClick={() => setOpen((prev) => !prev)}
              aria-label={open ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              aria-expanded={open}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Down Drawer (< 1024px) */}
        {open && (
          <div className="header-ref__mobile-drawer" role="dialog" aria-modal="true">
            <div className="header-ref__mobile-links">
              {mainNav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="header-ref__mobile-link"
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="header-ref__mobile-footer">
              <button
                type="button"
                onClick={handleGetInTouch}
                className="header-ref__mobile-cta"
              >
                Get In Touch
              </button>
            </div>
          </div>
        )}
      </div>
    </header>

    {/* Top spacing / layout offset for non-home pages to prevent fixed header from overlapping page content */}
    {!isHome && <div className="header-ref-spacer" aria-hidden="true" />}
  </>
  )
}
