'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import './explore-guide.css'

/* ───────── The character ─────────
   A friendly kid guide (swept brown hair, white tee with a green leaf,
   olive trousers, white sneakers). `mood` swaps the face; the rig classes
   let CSS move arms and legs for walking, dangling and pointing. */
function Face({ mood }) {
  if (mood === 'surprised') {
    return (
      <g>
        <path d="M63 44 Q69 39 75 43" stroke="#4a2c17" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M85 43 Q91 39 97 44" stroke="#4a2c17" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="70" cy="55" r="6" fill="#fff" />
        <circle cx="91" cy="55" r="6" fill="#fff" />
        <circle cx="71" cy="55.5" r="3" fill="#1f1a17" />
        <circle cx="92" cy="55.5" r="3" fill="#1f1a17" />
        <ellipse cx="83" cy="73" rx="4.5" ry="5.5" fill="#7a2e22" />
        <ellipse cx="83" cy="75" rx="2.6" ry="2" fill="#ef8f86" />
      </g>
    )
  }
  if (mood === 'happy') {
    return (
      <g>
        <path d="M63 46 Q69 42 75 45" stroke="#4a2c17" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M86 45 Q92 42 98 46" stroke="#4a2c17" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M64 57 Q70 50 76 57" stroke="#1f1a17" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M85 57 Q91 50 97 57" stroke="#1f1a17" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M74 68 Q83 82 93 68 Z" fill="#7a2e22" />
        <path d="M78 74 Q83 79 88 74 Q83 72 78 74 Z" fill="#ef8f86" />
      </g>
    )
  }
  // idle: soft smile, big eyes that blink
  return (
    <g>
      <path d="M63 47 Q69 44 75 46" stroke="#4a2c17" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M86 46 Q92 44 98 47" stroke="#4a2c17" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <g className="ce-guide__eyes">
        <ellipse cx="70" cy="56" rx="4.2" ry="5.6" fill="#1f1a17" />
        <ellipse cx="91" cy="56" rx="4.2" ry="5.6" fill="#1f1a17" />
        <circle cx="71.6" cy="54" r="1.6" fill="#fff" />
        <circle cx="92.6" cy="54" r="1.6" fill="#fff" />
      </g>
      <path d="M76 69 Q83 76 90 69" stroke="#7a2e22" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </g>
  )
}

function GuideCharacter({ mood }) {
  return (
    <svg className="ce-guide__svg" viewBox="0 0 150 188" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="eg-skin" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffe3cc" />
          <stop offset="0.7" stopColor="#f6c9a4" />
          <stop offset="1" stopColor="#e2a57c" />
        </radialGradient>
        <linearGradient id="eg-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5a34" />
          <stop offset="0.6" stopColor="#5e3a1f" />
          <stop offset="1" stopColor="#3f2614" />
        </linearGradient>
        <linearGradient id="eg-tee" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6e8e1" />
        </linearGradient>
        <linearGradient id="eg-pants" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5e7f45" />
          <stop offset="1" stopColor="#46653a" />
        </linearGradient>
        <radialGradient id="eg-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="rgba(15,30,25,0.32)" />
          <stop offset="1" stopColor="rgba(15,30,25,0)" />
        </radialGradient>
      </defs>

      <ellipse className="ce-guide__shadow" cx="80" cy="183" rx="32" ry="4.5" fill="url(#eg-shadow)" />

      <g className="ce-guide__body">
        {/* Back arm */}
        <g className="ce-guide__arm ce-guide__arm--back">
          <rect x="49" y="92" width="12" height="36" rx="6" fill="url(#eg-skin)" />
          <rect x="48" y="88" width="15" height="15" rx="7" fill="#eef0ea" />
        </g>
        {/* Back leg */}
        <g className="ce-guide__leg ce-guide__leg--back">
          <rect x="60" y="126" width="16" height="50" rx="8" fill="#46653a" />
          <rect x="54" y="168" width="28" height="14" rx="7" fill="#f4f4f1" />
          <rect x="54" y="177" width="28" height="5" rx="2.5" fill="#cfcac0" />
        </g>
        {/* Torso: white tee + leaf emblem */}
        <rect x="52" y="84" width="48" height="50" rx="17" fill="url(#eg-tee)" />
        <circle cx="86" cy="101" r="6.5" fill="#0f3d2e" />
        <path d="M83 104 Q83 96 90 97 Q90 104 83 104 Z" fill="#7cc48a" />
        <rect x="52" y="124" width="48" height="12" rx="6" fill="url(#eg-pants)" />
        {/* Front leg */}
        <g className="ce-guide__leg ce-guide__leg--front">
          <rect x="76" y="126" width="16" height="50" rx="8" fill="url(#eg-pants)" />
          <rect x="72" y="168" width="31" height="14" rx="7" fill="#ffffff" />
          <rect x="72" y="177" width="31" height="5" rx="2.5" fill="#d6d1c7" />
          <path d="M80 170 L90 170" stroke="#d9d4ca" strokeWidth="1.6" strokeLinecap="round" />
        </g>

        {/* Head */}
        <g className="ce-guide__head">
          <rect x="72" y="76" width="14" height="12" rx="5" fill="#e8b58d" />
          <circle cx="80" cy="54" r="33" fill="url(#eg-skin)" />
          <ellipse cx="49" cy="58" rx="5" ry="7" fill="#eab088" />
          <ellipse cx="64" cy="66" rx="5" ry="3" fill="#f39a8c" opacity="0.45" />
          <ellipse cx="99" cy="66" rx="4.5" ry="3" fill="#f39a8c" opacity="0.45" />
          <Face mood={mood} />
          {/* Swept hair */}
          <path
            d="M46 56 Q40 22 72 16 Q100 10 112 34 Q114 44 110 50 Q104 36 92 33 Q96 42 88 44 Q86 34 74 32 Q64 34 58 40 Q52 46 52 58 Z"
            fill="url(#eg-hair)"
          />
          <path d="M96 18 Q118 20 116 40 Q110 30 100 28 Z" fill="#6b4426" />
          <path d="M60 24 Q74 16 90 20" stroke="#a87448" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
        </g>

        {/* Front arm — points at the message */}
        <g className="ce-guide__arm ce-guide__arm--front">
          <rect x="94" y="89" width="34" height="12" rx="6" fill="url(#eg-skin)" />
          <rect x="90" y="86" width="16" height="16" rx="7" fill="#ffffff" />
          <circle cx="129" cy="95" r="6.5" fill="url(#eg-skin)" />
          <rect x="130" y="90" width="11" height="4.6" rx="2.3" fill="#f2c39d" />
        </g>
      </g>
    </svg>
  )
}

const DEFAULT_MSG = (
  <>
    You can view this project in <b>3D Plot Layout!</b>
  </>
)

export default function ExploreGuide({ href, projectName }) {
  const router = useRouter()
  const stageRef = useRef(null)
  const walkerRef = useRef(null)
  const pos = useRef({ x: 0, y: 0, tilt: 0 })
  const drag = useRef(null)
  const physics = useRef(0)
  const msgTimer = useRef(0)

  const [phase, setPhase] = useState('idle') // idle → walking → ready
  const [mood, setMood] = useState('idle')
  const [state, setState] = useState('rest') // rest | dragging | falling
  const [msg, setMsg] = useState(null)
  const [flip, setFlip] = useState(false)
  const [squash, setSquash] = useState(0)

  const apply = useCallback(() => {
    const el = walkerRef.current
    if (!el) return
    const { x, y, tilt } = pos.current
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg)`
  }, [])

  const say = useCallback((m, ms = 0) => {
    clearTimeout(msgTimer.current)
    setMsg(m)
    if (ms) msgTimer.current = setTimeout(() => setMsg(null), ms)
  }, [])

  // Keep the bubble on whichever side has room
  const updateFlip = useCallback(() => {
    const stage = stageRef.current
    const el = walkerRef.current
    if (!stage || !el) return
    const charW = el.querySelector('.ce-guide__char')?.offsetWidth || 100
    const bubbleW = Math.min(250, stage.clientWidth - charW - 24)
    setFlip(pos.current.x + charW + bubbleW + 16 > stage.clientWidth)
  }, [])

  // Draggable anywhere on screen: x across the stage, y up to the top of the viewport
  const bounds = useCallback(() => {
    const stage = stageRef.current
    const char = walkerRef.current?.querySelector('.ce-guide__char')
    const charW = char?.offsetWidth || 100
    const charH = char?.offsetHeight || 130
    const groundY = stage ? stage.getBoundingClientRect().bottom : window.innerHeight
    return {
      minX: 0,
      maxX: Math.max(0, (stage?.clientWidth || 300) - charW),
      minY: -Math.max(0, groundY - charH - 8),
      maxY: 0,
    }
  }, [])

  /* Only around the project header and plot layout: it steps aside further
     down the page so it never sits on top of other sections' content */
  const [away, setAway] = useState(false)
  useEffect(() => {
    const targets = [stageRef.current?.closest('section'), document.getElementById('plot-section')].filter(Boolean)
    if (!targets.length) return undefined
    const visible = new Map()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => visible.set(en.target, en.isIntersecting))
        setAway(![...visible.values()].some(Boolean))
      },
      { threshold: 0.05 },
    )
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [])

  /* Walk into the corner once the site's splash screen (#pre) has gone */
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let t = 0
    const wait = () => {
      const pre = document.getElementById('pre')
      if (pre && !pre.classList.contains('done')) {
        t = setTimeout(wait, 250)
        return
      }
      t = setTimeout(() => setPhase(reduce ? 'ready' : 'walking'), reduce ? 0 : 700)
    }
    wait()
    return () => clearTimeout(t)
  }, [])

  // After the CSS walk finishes, hand position over to the drag transform
  const onWalkEnd = (e) => {
    if (e.target !== walkerRef.current) return
    setPhase('ready')
  }
  useEffect(() => {
    if (phase !== 'ready') return
    const stage = stageRef.current
    const el = walkerRef.current
    if (!stage || !el) return
    // Measure where the CSS walk stops, then drive position with transforms from here on
    el.style.left = ''
    const target = el.offsetLeft
    el.style.left = '0px'
    pos.current = { x: Math.min(Math.max(target, 0), bounds().maxX), y: 0, tilt: 0 }
    apply()
    updateFlip()
    setMood('happy')
    const t = setTimeout(() => setMood('idle'), 1400)
    return () => clearTimeout(t)
  }, [phase, apply, bounds, updateFlip])

  useEffect(() => {
    const onResize = () => {
      if (phase !== 'ready') return
      const b = bounds()
      pos.current.x = Math.min(Math.max(pos.current.x, b.minX), b.maxX)
      apply()
      updateFlip()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [phase, apply, bounds, updateFlip])

  useEffect(
    () => () => {
      cancelAnimationFrame(physics.current)
      clearTimeout(msgTimer.current)
    },
    [],
  )

  /* Gravity drop with a couple of bounces and a squash on landing */
  const fall = useCallback(() => {
    cancelAnimationFrame(physics.current)
    let vy = 0
    let last = performance.now()
    let bounces = 0
    setState('falling')
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now
      vy += 2600 * dt
      pos.current.y += vy * dt
      pos.current.tilt *= 0.86
      if (pos.current.y >= 0) {
        pos.current.y = 0
        if (Math.abs(vy) > 260 && bounces < 2) {
          setSquash(Math.min(Math.abs(vy) / 1600, 0.28))
          setTimeout(() => setSquash(0), 110)
          vy = -vy * 0.38
          bounces += 1
        } else {
          pos.current.tilt = 0
          apply()
          setSquash(0.12)
          setTimeout(() => setSquash(0), 140)
          setState('rest')
          setMood('happy')
          say('Boing! Tap me to explore in 3D', 2600)
          setTimeout(() => setMood('idle'), 1600)
          updateFlip()
          return
        }
      }
      apply()
      physics.current = requestAnimationFrame(step)
    }
    physics.current = requestAnimationFrame(step)
  }, [apply, say, updateFlip])

  /* Pointer: drag anywhere above the ground line, tap to open 3D */
  const onPointerDown = (e) => {
    if (phase !== 'ready' || e.button > 0) return
    cancelAnimationFrame(physics.current)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* pointer already released — dragging still works without capture */
    }
    drag.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: pos.current.x,
      oy: pos.current.y,
      lastX: e.clientX,
      moved: false,
      b: bounds(),
    }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) < 5) return
    if (!d.moved) {
      d.moved = true
      setState('dragging')
      setMood('surprised')
      say('Wheee!')
    }
    const vx = e.clientX - d.lastX
    d.lastX = e.clientX
    pos.current.x = Math.min(Math.max(d.ox + dx, d.b.minX), d.b.maxX)
    pos.current.y = Math.min(Math.max(d.oy + dy, d.b.minY), d.b.maxY)
    pos.current.tilt = Math.max(-18, Math.min(18, pos.current.tilt * 0.7 + vx * 1.2))
    apply()
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      // A tap: little hop of joy, then off to the 3D view
      setMood('happy')
      setState('hop')
      setTimeout(() => router.push(href), 380)
      return
    }
    say(null)
    if (pos.current.y < -2) fall()
    else {
      pos.current.tilt = 0
      apply()
      setState('rest')
      setMood('idle')
      updateFlip()
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(href)
    }
  }

  const ready = phase === 'ready'
  const showBubble = phase === 'ready' && state !== 'falling'
  const message = msg || DEFAULT_MSG

  return (
    <div ref={stageRef} className={`ce-guide ce-guide--${phase} ce-guide--${state}${away && state === 'rest' ? ' is-away' : ''}`}>
      <div
        ref={walkerRef}
        className={`ce-guide__walker${flip ? ' is-flipped' : ''}`}
        onAnimationEnd={onWalkEnd}
      >
        <div
          className="ce-guide__char"
          role="link"
          tabIndex={ready ? 0 : -1}
          aria-label={`Explore ${projectName} in 3D. You can also drag me around.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerEnter={() => state === 'rest' && mood === 'idle' && setMood('happy')}
          onPointerLeave={() => state === 'rest' && setMood('idle')}
          onKeyDown={onKeyDown}
          style={squash ? { transform: `scale(${1 + squash * 0.6}, ${1 - squash})` } : undefined}
        >
          <GuideCharacter mood={mood} />
        </div>

        {showBubble && (
          <button type="button" className="ce-guide__bubble" onClick={() => router.push(href)} aria-label={`Explore ${projectName} in 3D`}>
            <span key={typeof message === 'string' ? message : 'default'} className="ce-guide__msg">
              {message}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
