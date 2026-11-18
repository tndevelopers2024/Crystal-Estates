'use client'

import { useRef, useState } from 'react'
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'
import { PillLink, Eyebrow } from './motion'

/* Scroll milestones (0 → 1 across the pinned section). */
const STEPS = [
  { label: 'Plot', at: 0 },
  { label: 'Foundation', at: 0.22 },
  { label: 'Walls', at: 0.38 },
  { label: 'Roof', at: 0.56 },
  { label: 'Home', at: 0.8 },
]

const MESSAGES = [
  {
    range: [0, 0.2],
    kicker: 'Chapter 01 — The land',
    title: ['It begins with', 'a plot.'],
    text: 'Clear title, marked boundary stones and an approved layout. The quiet start of something big.',
  },
  {
    range: [0.2, 0.38],
    kicker: 'Chapter 02 — The groundwork',
    title: ['Lay the', 'foundation.'],
    text: 'Every plot we sell is surveyed, demarcated and ready for registration, so you can build with confidence.',
  },
  {
    range: [0.38, 0.62],
    kicker: 'Chapter 03 — The build',
    title: ['Build your', 'dream home.'],
    text: 'Your design, your pace, on land that is truly and legally yours.',
  },
  {
    range: [0.62, 0.82],
    kicker: 'Chapter 04 — The roots',
    title: ['Grow', 'roots.'],
    text: 'Avenue trees, blacktop roads and neighbours who become family.',
  },
  {
    range: [0.82, 1.01],
    kicker: 'Chapter 05 — The legacy',
    title: ['A legacy for', 'generations.'],
    text: 'Land is the one asset that keeps growing with your family. Let us help you find yours.',
    cta: true,
  },
]

/* ── helpers ─────────────────────────────────────────── */

const box = { transformBox: 'fill-box' }

function useRise(p, [a, b]) {
  return useTransform(p, [a, b], [0, 1], { clamp: true })
}

function Message({ m, p, index, last }) {
  const [a, b] = m.range
  // Outgoing message finishes fading at the boundary before the next one fades in (no overlap).
  const fade = 0.035
  const input =
    index === 0 ? [0, b - fade, b] : last ? [a, a + fade, 1] : [a, a + fade, b - fade, b]
  const opacity = useTransform(p, input, index === 0 ? [1, 1, 0] : last ? [0, 1, 1] : [0, 1, 1, 0])
  const y = useTransform(p, input, index === 0 ? [0, 0, -30] : last ? [30, 0, 0] : [30, 0, 0, -30])
  const pointerEvents = useTransform(opacity, (v) => (v > 0.5 ? 'auto' : 'none'))

  return (
    <motion.div className="ch-build__msg" style={{ opacity, y, pointerEvents }}>
      <span className="ch-build__kicker">{m.kicker}</span>
      <h3 className="ch-build__title">
        {m.title[0]} <em className="ch-serif">{m.title[1]}</em>
      </h3>
      <p className="ch-build__text">{m.text}</p>
      {m.cta && (
        <PillLink href="/projects" className="ch-build__cta">
          Find your plot
        </PillLink>
      )}
    </motion.div>
  )
}

/* ── the scene ───────────────────────────────────────── */

function Scene({ p }) {
  // Land
  const outline = useRise(p, [0.02, 0.14])
  const stones = useRise(p, [0.08, 0.16])
  const dimension = useTransform(p, [0.1, 0.16, 0.3, 0.36], [0, 1, 1, 0])

  // Build
  const foundation = useRise(p, [0.22, 0.32])
  const walls = useRise(p, [0.38, 0.52])
  const roofY = useTransform(p, [0.54, 0.64], [-120, 0], { clamp: true })
  const roofO = useTransform(p, [0.54, 0.6], [0, 1], { clamp: true })
  const details = useRise(p, [0.6, 0.7])
  const trees = useRise(p, [0.64, 0.78])
  const bushes = useRise(p, [0.7, 0.8])
  const pathO = useRise(p, [0.66, 0.74])

  // Light
  const dusk = useTransform(p, [0.78, 0.96], [0, 1], { clamp: true })
  const tint = useTransform(p, [0.8, 0.98], [0, 0.42], { clamp: true })
  const glow = useTransform(p, [0.86, 0.96], [0, 1], { clamp: true })
  const sunY = useTransform(p, [0.7, 0.95], [0, 260])
  const sunO = useTransform(p, [0.82, 0.95], [1, 0])
  const moonO = useTransform(p, [0.9, 1], [0, 1])

  return (
    <svg className="ch-build__svg" viewBox="150 150 700 490" preserveAspectRatio="xMidYMax slice" role="img" aria-label="An empty plot gradually becoming a finished home">
      <defs>
        <linearGradient id="chSkyDay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFE9D6" />
          <stop offset="1" stopColor="#E2E6D4" />
        </linearGradient>
        <linearGradient id="chSkyDusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#081F18" />
          <stop offset="0.55" stopColor="#1C4234" />
          <stop offset="0.82" stopColor="#B8964E" />
        </linearGradient>
        <radialGradient id="chGlow">
          <stop offset="0" stopColor="#FFD48A" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFD48A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect width="1000" height="640" fill="url(#chSkyDay)" />
      <motion.rect width="1000" height="640" fill="url(#chSkyDusk)" style={{ opacity: dusk }} />

      {/* Sun and moon */}
      <motion.circle cx="760" cy="230" r="36" fill="#E8C47E" style={{ y: sunY, opacity: sunO }} />
      <motion.g style={{ opacity: moonO }}>
        <circle cx="260" cy="215" r="22" fill="#F3EBD3" />
        <circle cx="270" cy="208" r="20" fill="#0C271E" />
        {[[340, 190], [420, 250], [610, 180], [690, 235], [820, 200], [200, 270], [520, 205]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#F3EBD3" />
        ))}
      </motion.g>

      {/* Drifting clouds */}
      <g className="ch-cloud ch-cloud--a" fill="#FFFFFF" opacity="0.55">
        <ellipse cx="300" cy="250" rx="60" ry="13" />
        <ellipse cx="335" cy="240" rx="34" ry="12" />
      </g>
      <g className="ch-cloud ch-cloud--b" fill="#FFFFFF" opacity="0.45">
        <ellipse cx="620" cy="200" rx="52" ry="11" />
        <ellipse cx="595" cy="191" rx="30" ry="10" />
      </g>

      {/* Hills */}
      <path d="M0 430 C 160 360, 300 380, 420 420 S 700 360, 1000 410 L1000 480 L0 480 Z" fill="#9FB49B" />
      <path d="M0 460 C 200 420, 380 440, 560 462 S 860 430, 1000 450 L1000 490 L0 490 Z" fill="#7F9C78" />

      {/* Ground and road */}
      <rect x="0" y="472" width="1000" height="168" fill="#6E8C5A" />
      <rect x="0" y="598" width="1000" height="42" fill="#2D3431" />
      <line x1="0" y1="619" x2="1000" y2="619" stroke="#E1DCC6" strokeWidth="2" strokeDasharray="22 18" opacity="0.7" />

      {/* Plot */}
      <path d="M290 575 L710 575 L640 485 L360 485 Z" fill="#B59B69" opacity="0.9" />
      <motion.path
        d="M290 575 L710 575 L640 485 L360 485 Z"
        fill="none"
        stroke="#F2E4BE"
        strokeWidth="2.5"
        strokeDasharray="8 7"
        style={{ pathLength: outline }}
      />
      {[[290, 575], [710, 575], [640, 485], [360, 485]].map(([x, y], i) => (
        <motion.g key={i} style={{ ...box, transformOrigin: '50% 100%', scaleY: stones, opacity: stones }}>
          <rect x={x - 5} y={y - 16} width="10" height="16" rx="1.5" fill="#F4EFE1" />
          <rect x={x - 5} y={y - 16} width="10" height="5" rx="1.5" fill="#B8964E" />
        </motion.g>
      ))}
      <motion.g style={{ opacity: dimension }}>
        <text x="500" y="540" textAnchor="middle" className="ch-build__dim">40 ft × 60 ft · Approved plot</text>
      </motion.g>

      {/* Path to the road */}
      <motion.path d="M476 542 L524 542 L548 598 L452 598 Z" fill="#D9CDB0" style={{ opacity: pathO }} />

      {/* Foundation */}
      <motion.g style={{ ...box, transformOrigin: '50% 100%', scaleY: foundation, opacity: foundation }}>
        <rect x="358" y="524" width="284" height="18" fill="#B9B2A2" />
        <rect x="462" y="520" width="76" height="8" fill="#A39B89" />
      </motion.g>

      {/* Chimney (behind roof) */}
      <motion.rect x="576" y="300" width="22" height="60" fill="#5B4A3A" style={{ opacity: roofO }} />

      {/* Walls */}
      <motion.g style={{ ...box, transformOrigin: '50% 100%', scaleY: walls }}>
        <rect x="380" y="382" width="240" height="142" fill="#F1EADA" />
        <rect x="380" y="382" width="12" height="142" fill="#E3D9C2" />
        <rect x="608" y="382" width="12" height="142" fill="#E3D9C2" />
        <rect x="380" y="512" width="240" height="12" fill="#D8CDB3" />
      </motion.g>

      {/* Roof */}
      <motion.g style={{ y: roofY, opacity: roofO }}>
        <polygon points="356,388 500,290 644,388" fill="#0F3D2E" />
        <polyline points="356,388 500,290 644,388" fill="none" stroke="#B8964E" strokeWidth="4" strokeLinejoin="round" />
      </motion.g>

      {/* Windows and door */}
      <motion.g style={{ opacity: details }}>
        <rect x="408" y="414" width="52" height="48" rx="3" fill="#2B3E37" />
        <rect x="540" y="414" width="52" height="48" rx="3" fill="#2B3E37" />
        <path d="M434 414 V462 M408 438 H460 M566 414 V462 M540 438 H592" stroke="#F1EADA" strokeWidth="3" />
        <rect x="475" y="444" width="50" height="80" rx="3" fill="#0F3D2E" />
        <circle cx="517" cy="486" r="2.5" fill="#B8964E" />
      </motion.g>

      {/* Trees */}
      <motion.g style={{ ...box, transformOrigin: '50% 100%', scale: trees, opacity: trees }}>
        <rect x="249" y="506" width="10" height="56" fill="#5B4A3A" />
        <circle cx="254" cy="488" r="38" fill="#3F6B45" />
        <circle cx="230" cy="506" r="25" fill="#4D7C50" />
        <circle cx="279" cy="504" r="27" fill="#36603D" />
      </motion.g>
      <motion.g style={{ ...box, transformOrigin: '50% 100%', scale: trees, opacity: trees }}>
        <rect x="764" y="490" width="12" height="70" fill="#5B4A3A" />
        <circle cx="770" cy="462" r="48" fill="#36603D" />
        <circle cx="742" cy="488" r="30" fill="#4D7C50" />
        <circle cx="800" cy="486" r="32" fill="#3F6B45" />
      </motion.g>
      <motion.g style={{ ...box, transformOrigin: '50% 100%', scale: bushes, opacity: bushes }}>
        <ellipse cx="398" cy="540" rx="26" ry="14" fill="#4D7C50" />
        <ellipse cx="602" cy="540" rx="26" ry="14" fill="#4D7C50" />
        <ellipse cx="440" cy="544" rx="16" ry="9" fill="#3F6B45" />
        <ellipse cx="560" cy="544" rx="16" ry="9" fill="#3F6B45" />
      </motion.g>

      {/* Evening tint and glowing windows */}
      <motion.rect width="1000" height="640" fill="#04120D" style={{ opacity: tint }} />
      <motion.g style={{ opacity: glow }}>
        <ellipse cx="500" cy="470" rx="190" ry="110" fill="url(#chGlow)" opacity="0.5" />
        <rect x="408" y="414" width="52" height="48" rx="3" fill="#F7CD7E" />
        <rect x="540" y="414" width="52" height="48" rx="3" fill="#F7CD7E" />
        <path d="M434 414 V462 M408 438 H460 M566 414 V462 M540 438 H592" stroke="#6B5435" strokeWidth="3" />
        <ellipse cx="500" cy="572" rx="60" ry="16" fill="url(#chGlow)" />
      </motion.g>
    </svg>
  )
}

/* ── section ─────────────────────────────────────────── */

export default function PlotToHome() {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.35 })
  const finished = useMotionValue(1)
  const p = reduce ? finished : smooth

  const [step, setStep] = useState(0)
  useMotionValueEvent(p, 'change', (v) => {
    let idx = 0
    STEPS.forEach((s, i) => {
      if (v >= s.at) idx = i
    })
    setStep((prev) => (prev === idx ? prev : idx))
  })
  const bar = useTransform(p, [0, 1], [0, 1])

  if (reduce) {
    return (
      <section className="ch-build ch-build--static" aria-labelledby="ch-build-title">
        <div className="ch-wrap ch-build__static">
          <div>
            <Eyebrow className="ch-eyebrow--light">From plot to home</Eyebrow>
            <h2 id="ch-build-title" className="ch-build__title">
              Build your <em className="ch-serif">dream home.</em>
            </h2>
            <ol className="ch-build__list">
              {MESSAGES.map((m) => (
                <li key={m.kicker}>
                  <strong>
                    {m.title[0]} {m.title[1]}
                  </strong>{' '}
                  {m.text}
                </li>
              ))}
            </ol>
            <PillLink href="/projects">Find your plot</PillLink>
          </div>
          <div className="ch-build__frame">
            <Scene p={finished} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={ref} className="ch-build" aria-labelledby="ch-build-title">
      <div className="ch-build__sticky">
        <div className="ch-wrap ch-build__grid">
          <div className="ch-build__copy">
            <Eyebrow className="ch-eyebrow--light">From plot to home</Eyebrow>
            <h2 id="ch-build-title" className="ch-sr">
              Build your dream home on a Crystal Estates plot
            </h2>
            <div className="ch-build__msgs">
              {MESSAGES.map((m, i) => (
                <Message key={m.kicker} m={m} p={p} index={i} last={i === MESSAGES.length - 1} />
              ))}
            </div>

            <ol className="ch-build__steps" aria-label="Build progress">
              {STEPS.map((s, i) => (
                <li key={s.label} className={i <= step ? 'is-on' : ''} aria-current={i === step ? 'step' : undefined}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {s.label}
                </li>
              ))}
            </ol>
          </div>

          <div className="ch-build__frame">
            <Scene p={p} />
            <div className="ch-build__progress" aria-hidden="true">
              <motion.span style={{ scaleX: bar }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
