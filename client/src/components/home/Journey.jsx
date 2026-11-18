'use client'

import { useRef } from 'react'
import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion'
import { WordsPullUpMultiStyle, Eyebrow, EASE } from './motion'
import { steps } from '../../data/site'

export default function Journey() {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.6'] })
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })

  return (
    <section className="ch-journey" aria-labelledby="ch-journey-title">
      <div className="ch-wrap">
        <div className="ch-journey__head">
          <Eyebrow className="ch-eyebrow--light">How it works</Eyebrow>
          <h2 id="ch-journey-title" className="ch-h2 ch-h2--light">
            <WordsPullUpMultiStyle segments={[{ text: 'From first call' }, { br: true }, { text: 'to' }, { text: 'handover.', className: 'ch-accent' }]} />
          </h2>
          <p>A transparent, hassle-free path to owning your approved plot or farmland in Chennai.</p>
        </div>

        <div ref={ref} className="ch-journey__track">
          <div className="ch-journey__rail" aria-hidden="true">
            <motion.span className="is-x" style={{ scaleX: reduce ? 1 : line }} />
            <motion.span className="is-y" style={{ scaleY: reduce ? 1 : line }} />
          </div>
          <ol className="ch-journey__steps">
            {steps.map((s, i) => (
              <motion.li
                key={s.num}
                initial={reduce ? false : { opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                transition={{ duration: 0.8, ease: EASE, delay: i * 0.12 }}
              >
                <span className="ch-journey__node" aria-hidden="true" />
                <span className="ch-journey__num">{s.num}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
