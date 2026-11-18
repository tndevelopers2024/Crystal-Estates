'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { MousePointer2, Home, LandPlot } from 'lucide-react'
import { WordsPullUpMultiStyle, Eyebrow, PillLink, EASE } from './motion'

/*
 * Swap these for a matched pair (same camera angle) for the strongest effect:
 * the empty plot as it is today, and the finished home on that same plot.
 */
const LAND_SRC = '/images/plot-1.jpg'
const HOUSE_SRC =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80'

const SPOT_AREA = 0.3 // share of the section revealed around the cursor

export default function DreamReveal() {
  const sectionRef = useRef(null)
  const houseRef = useRef(null)
  const ringRef = useRef(null)
  const reduce = useReducedMotion()

  const [touchMode, setTouchMode] = useState(false)
  const [showHome, setShowHome] = useState(false)
  const [hinted, setHinted] = useState(false)
  const [active, setActive] = useState(false)

  // Pick desktop spotlight vs. touch/tablet toggle.
  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (max-width: 899px)')
    const update = () => setTouchMode(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Desktop: smooth, lerped spotlight driven by CSS variables (no React re-renders per frame).
  useEffect(() => {
    if (touchMode) return undefined
    const section = sectionRef.current
    const house = houseRef.current
    const ring = ringRef.current
    if (!section || !house) return undefined

    const state = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, maxR: 0, inside: false }
    let raf = 0

    const measure = () => {
      const { width, height } = section.getBoundingClientRect()
      state.maxR = Math.sqrt((SPOT_AREA * width * height) / Math.PI)
      if (state.inside) state.tr = state.maxR
    }
    measure()

    const tick = () => {
      const k = reduce ? 1 : 0.14
      state.x += (state.tx - state.x) * k
      state.y += (state.ty - state.y) * k
      state.r += (state.tr - state.r) * (reduce ? 1 : 0.1)
      house.style.setProperty('--x', `${state.x}px`)
      house.style.setProperty('--y', `${state.y}px`)
      house.style.setProperty('--r', `${state.r}px`)
      if (ring) {
        ring.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) translate(-50%, -50%)`
        ring.style.width = `${state.r * 2}px`
        ring.style.height = `${state.r * 2}px`
        ring.style.opacity = state.r > 4 ? '1' : '0'
      }
      const settled =
        Math.abs(state.tx - state.x) < 0.3 &&
        Math.abs(state.ty - state.y) < 0.3 &&
        Math.abs(state.tr - state.r) < 0.3
      raf = settled ? 0 : requestAnimationFrame(tick)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      const rect = section.getBoundingClientRect()
      state.tx = e.clientX - rect.left
      state.ty = e.clientY - rect.top
      if (!state.inside) {
        // Start the circle where the cursor enters instead of sliding in from a corner.
        state.x = state.tx
        state.y = state.ty
        state.inside = true
        state.tr = state.maxR
        setActive(true)
        setHinted(true)
      }
      kick()
    }
    const onLeave = () => {
      state.inside = false
      state.tr = 0
      setActive(false)
      kick()
    }

    section.addEventListener('pointermove', onMove)
    section.addEventListener('pointerleave', onLeave)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      section.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', measure)
    }
  }, [touchMode, reduce])

  const homeVisible = touchMode ? showHome : active
  const modeClass = touchMode ? 'ch-reveal--touch' : 'ch-reveal--spot'

  return (
    <section
      ref={sectionRef}
      className={`ch-reveal ${modeClass} ${touchMode && showHome ? 'is-home' : ''}`}
      aria-labelledby="ch-reveal-title"
    >
      {/* Layer 1 — the land today */}
      <div className="ch-reveal__layer ch-reveal__layer--land">
        <img src={LAND_SRC} alt="An approved, demarcated plotted layout with blacktop roads" />
        <div className="ch-reveal__shade" aria-hidden="true" />
        <div className="ch-reveal__copy ch-reveal__copy--land">
          <Eyebrow className="ch-eyebrow--light">Today · An approved plot</Eyebrow>
          <h2 id="ch-reveal-title" className="ch-reveal__title">
            <WordsPullUpMultiStyle
              segments={[{ text: 'Every home' }, { br: true }, { text: 'starts with' }, { text: 'land.', className: 'ch-accent' }]}
            />
          </h2>
          <motion.p
            className="ch-reveal__text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
          >
            Clear title, marked boundary stones and blacktop roads. The quiet start of something big.
          </motion.p>
        </div>
      </div>

      {/* Layer 2 — the home tomorrow, revealed by the spotlight (desktop) or the toggle (touch) */}
      <div ref={houseRef} className="ch-reveal__layer ch-reveal__layer--house" aria-hidden={!homeVisible}>
        <img src={HOUSE_SRC} alt="A finished family home built on the plot" loading="lazy" />
        <div className="ch-reveal__shade ch-reveal__shade--house" aria-hidden="true" />
        <div className="ch-reveal__copy ch-reveal__copy--house">
          <Eyebrow className="ch-eyebrow--light">Tomorrow · Your home</Eyebrow>
          <p className="ch-reveal__title ch-reveal__title--house">
            Build your <em className="ch-accent">dream home.</em>
          </p>
          <p className="ch-reveal__text">Your design, your pace, on land that is truly and legally yours.</p>
        </div>
      </div>

      {/* Desktop: soft ring that tracks the spotlight edge */}
      {!touchMode && <div ref={ringRef} className="ch-reveal__ring" aria-hidden="true" />}

      {/* Desktop hint */}
      {!touchMode && (
        <AnimatePresence>
          {!hinted && (
            <motion.div
              className="ch-reveal__hint"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <MousePointer2 size={15} aria-hidden="true" /> Move your cursor to see the home
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Touch: Plot / Home toggle */}
      {touchMode && (
        <div className="ch-reveal__toggle" role="group" aria-label="Show the plot or the finished home">
          <button type="button" className={!showHome ? 'is-on' : ''} aria-pressed={!showHome} onClick={() => setShowHome(false)}>
            <LandPlot size={15} aria-hidden="true" /> Plot today
          </button>
          <button type="button" className={showHome ? 'is-on' : ''} aria-pressed={showHome} onClick={() => setShowHome(true)}>
            <Home size={15} aria-hidden="true" /> Your home
          </button>
        </div>
      )}

      <div className="ch-reveal__cta">
        <PillLink href="/projects">Find your plot</PillLink>
      </div>
    </section>
  )
}
