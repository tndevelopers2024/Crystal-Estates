'use client'

import { Fragment, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export const EASE = [0.22, 1, 0.36, 1]

/**
 * Splits text into words that slide up once the block enters the viewport.
 */
export function WordsPullUp({ text, className = '', as: Tag = 'span', delay = 0, stagger = 0.08 }) {
  return (
    <WordsPullUpMultiStyle
      as={Tag}
      className={className}
      delay={delay}
      stagger={stagger}
      segments={[{ text }]}
    />
  )
}

/**
 * Same as WordsPullUp, but each segment keeps its own className
 * (e.g. a coloured accent inside a sans headline).
 */
export function WordsPullUpMultiStyle({ segments, className = '', as: Tag = 'span', delay = 0, stagger = 0.08 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const reduce = useReducedMotion()

  const words = []
  segments.forEach((seg, si) => {
    if (seg.br) {
      words.push({ br: true, key: `br-${si}` })
      return
    }
    seg.text.split(' ').filter(Boolean).forEach((w, wi) => {
      words.push({ word: w, className: seg.className || '', key: `${si}-${wi}` })
    })
  })

  let i = -1
  return (
    <Tag ref={ref} className={`ch-pullup ${className}`.trim()}>
      {words.map((w) => {
        if (w.br) return <br key={w.key} />
        i += 1
        return (
          <Fragment key={w.key}>
            <span className="ch-pullup__mask">
              <motion.span
                className={`ch-pullup__word ${w.className}`.trim()}
                initial={reduce ? false : { y: 20, opacity: 0 }}
                animate={inView || reduce ? { y: 0, opacity: 1 } : undefined}
                transition={{ duration: 0.7, ease: EASE, delay: delay + i * stagger }}
              >
                {w.word}
              </motion.span>
            </span>{' '}
          </Fragment>
        )
      })}
    </Tag>
  )
}

function RevealChar({ char, progress, range }) {
  const opacity = useTransform(progress, range, [0.2, 1])
  return <motion.span style={{ opacity }}>{char}</motion.span>
}

/**
 * Scroll-linked per-character opacity reveal for a paragraph.
 */
export function CharReveal({ text, className = '' }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.2'] })
  const chars = Array.from(text)
  const n = chars.length

  if (reduce) return <p className={className}>{text}</p>

  // Group characters by word so line-breaking stays natural.
  const words = []
  let idx = 0
  text.split(' ').forEach((word, wi) => {
    const items = Array.from(word).map((c) => ({ c, i: idx++ }))
    idx += 1 // the space
    words.push({ key: wi, items })
  })

  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((w) => (
        <Fragment key={w.key}>
          <span className="ch-charword" aria-hidden="true">
            {w.items.map(({ c, i }) => (
              <RevealChar
                key={i}
                char={c}
                progress={scrollYProgress}
                range={[Math.max(0, i / n - 0.1), Math.min(1, i / n + 0.05)]}
              />
            ))}
          </span>{' '}
        </Fragment>
      ))}
    </p>
  )
}

/**
 * Generic fade/rise-in wrapper.
 */
export function Reveal({ children, className = '', delay = 0, y = 24, scale = 1, as = 'div', ...rest }) {
  const reduce = useReducedMotion()
  const Comp = motion[as]
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y, scale }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  )
}

/**
 * Pill CTA with a circular arrow badge.
 */
export function PillLink({ href, children, variant = 'cream', onClick, className = '', ...props }) {
  const content = (
    <>
      <span className="ch-pill__label">{children}</span>
      <span className="ch-pill__icon" aria-hidden="true">
        <ArrowRight size={16} />
      </span>
    </>
  )
  const cls = `ch-pill ch-pill--${variant} ${className}`.trim()
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} {...props}>
        {content}
      </button>
    )
  }
  return (
    <Link href={href || '#'} className={cls} {...props}>
      {content}
    </Link>
  )
}

export function Eyebrow({ children, className = '' }) {
  return (
    <span className={`ch-eyebrow ${className}`.trim()}>
      <span className="ch-eyebrow__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

export function openSiteVisit(e) {
  if (e) e.preventDefault()
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-site-visit'))
}
