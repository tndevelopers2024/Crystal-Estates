import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildEnvironment } from './environment'
import { formatPlotNumberOnly } from './parseLayoutSvg'

/**
 * Reusable Three.js scene for an interactive 3D plot layout.
 *
 * Geometry comes straight from the layout SVG (plot boundaries, roads, open
 * spaces) — x stays x, SVG y becomes world z, plots are extruded upwards.
 * All plots live in ONE merged mesh with per-vertex colours, so hundreds of
 * plots cost a single draw call; picking maps the hit vertex back to its plot.
 */

const PLOT_H = 4
const LIFT = 3.2
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Parse a list of path "d" strings into THREE.Shape arrays (index-aligned). */
function shapesFromPaths(ds) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg">${ds
    .map((d, i) => `<path data-i="${i}" d="${escAttr(d)}"/>`)
    .join('')}</svg>`
  const { paths } = new SVGLoader().parse(markup)
  const out = ds.map(() => [])
  for (const p of paths) {
    const i = Number(p.userData?.node?.getAttribute('data-i'))
    if (Number.isInteger(i) && out[i]) out[i].push(...SVGLoader.createShapes(p))
  }
  return out
}

export default class PlotScene {
  constructor(container, { onHover, onSelect, onFrame, onPick, pickMode = false } = {}) {
    this.onPick = onPick
    this.pickMode = pickMode
    this.container = container
    this.onHover = onHover
    this.onSelect = onSelect
    this.onFrame = onFrame
    this.plots = []
    this.starts = []
    this.hovered = -1
    this.selected = -1
    this.styles = []
    this.tween = null
    this.disposed = false
    this.small = container.clientWidth < 700
    this.envUniforms = { uTime: { value: 0 } }

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.small ? 1.5 : 1.75))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = !this.small
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.setAttribute('aria-label', '3D plot layout. Drag to rotate, scroll or pinch to zoom.')
    renderer.domElement.setAttribute('role', 'img')
    container.appendChild(renderer.domElement)
    this.renderer = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dfe9ec')
    this.scene = scene

    this.camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 6, 30000)
    this.controls = new OrbitControls(this.camera, renderer.domElement)
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      screenSpacePanning: false,
      maxPolarAngle: 1.32,
      rotateSpeed: 0.7,
      zoomSpeed: 0.9,
      autoRotateSpeed: 0.6,
    })
    // Map-style navigation: dragging moves across the layout (so you can always
    // travel from the selected plot to any other one); rotating is right-drag or
    // Ctrl/Shift + drag on a mouse, and two fingers on touch screens.
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }
    this.controls.addEventListener('start', () => {
      this.tween = null
    })

    scene.add(new THREE.HemisphereLight('#e4f1ff', '#6b7f45', 1.0))
    const sun = new THREE.DirectionalLight('#fff4de', 1.75)
    sun.castShadow = !this.small
    this.sun = sun
    scene.add(sun)

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this._down = null
    this._onMove = this._onMove.bind(this)
    this._onDown = this._onDown.bind(this)
    this._onUp = this._onUp.bind(this)
    this._onLeave = () => this._setHover(-1, null)
    renderer.domElement.addEventListener('pointermove', this._onMove)
    renderer.domElement.addEventListener('pointerdown', this._onDown)
    renderer.domElement.addEventListener('pointerup', this._onUp)
    renderer.domElement.addEventListener('pointerleave', this._onLeave)

    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(container)

    const loop = () => {
      if (this.disposed) return
      this._raf = requestAnimationFrame(loop)
      this._tick()
    }
    loop()
  }

  /* ───────────── Build ───────────── */

  load({ viewBox, plots, roads = [], openSpaces = [], unmapped = [] }) {
    this.viewBox = viewBox
    const cx = viewBox.x + viewBox.width / 2
    const cz = viewBox.y + viewBox.height / 2
    this.center = { cx, cz }
    const span = Math.max(viewBox.width, viewBox.height)
    this.span = span

    const group = new THREE.Group()
    this.group = group
    this.scene.add(group)

    // Illustrative surroundings (farmland, lake, villages, trees, traffic, birds).
    // Built from the layout paths only to keep trees off plots and roads.
    this.env = buildEnvironment({
      group,
      scene: this.scene,
      viewBox,
      layoutPaths: [...plots.map((p) => p.d), ...unmapped, ...roads],
      small: this.small,
      uniforms: this.envUniforms,
      reducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    })

    const flat = (shapes, y, material) => {
      if (!shapes.length) return null
      const g = new THREE.ShapeGeometry(shapes, 6)
      g.rotateX(Math.PI / 2)
      g.translate(-cx, y, -cz)
      const m = new THREE.Mesh(g, material)
      m.receiveShadow = true
      group.add(m)
      return g
    }

    // Roads and open spaces from the SVG
    const roadShapes = shapesFromPaths(roads).flat()
    flat(roadShapes, 0.05, new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.95, side: THREE.DoubleSide }))
    const greenShapes = shapesFromPaths(openSpaces).flat()
    flat(greenShapes, 0.1, new THREE.MeshStandardMaterial({ color: '#6fa64a', roughness: 1, side: THREE.DoubleSide }))

    // Unnumbered plot cells: neutral, lower, not pickable
    const cellShapes = shapesFromPaths(unmapped).flat()
    if (cellShapes.length) {
      const g = new THREE.ExtrudeGeometry(cellShapes, { depth: PLOT_H * 0.6, bevelEnabled: false, curveSegments: 4 })
      g.rotateX(Math.PI / 2)
      g.translate(-cx, PLOT_H * 0.6, -cz)
      const cells = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#d8d2c3', roughness: 0.9 }))
      cells.castShadow = !this.small
      cells.receiveShadow = !this.small
      group.add(cells)
      group.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(g, 30),
          new THREE.LineBasicMaterial({ color: '#1c1f24', transparent: true, opacity: 0.22 }),
        ),
      )
    }

    // Plots → one merged, vertex-coloured mesh
    const plotShapes = shapesFromPaths(plots.map((p) => p.d))
    const geoms = []
    this.plots = []
    this.starts = []
    let offset = 0
    plotShapes.forEach((shapes, i) => {
      if (!shapes.length) return
      const g = new THREE.ExtrudeGeometry(shapes, { depth: PLOT_H, bevelEnabled: false, curveSegments: 4 })
      g.rotateX(Math.PI / 2)
      g.translate(-cx, PLOT_H, -cz)
      g.deleteAttribute('uv')
      g.computeBoundingBox()
      const count = g.attributes.position.count
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3))
      const box = g.boundingBox
      this.plots.push({
        ...plots[i],
        geometry: g,
        start: offset,
        count,
        center: box.getCenter(new THREE.Vector3()),
        size: box.getSize(new THREE.Vector3()),
      })
      this.starts.push(offset)
      offset += count
      geoms.push(g)
    })

    if (geoms.length) {
      const merged = mergeGeometries(geoms, false)
      this.plotMesh = new THREE.Mesh(
        merged,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.02 }),
      )
      this.plotMesh.castShadow = !this.small
      this.plotMesh.receiveShadow = !this.small
      group.add(this.plotMesh)
      this.colorAttr = merged.attributes.color
      this.normalAttr = merged.attributes.normal
      // Thin dark outline around every plot top
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(merged, 30),
        new THREE.LineBasicMaterial({ color: '#1c1f24', transparent: true, opacity: 0.35 }),
      )
      group.add(edges)
    }

    this._addLabels()

    // Selected plot: raised gold copy + outline
    this.selMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: '#ffc21a', emissive: '#ffb000', emissiveIntensity: 0.25, roughness: 0.5 }),
    )
    this.selMesh.castShadow = true
    this.selMesh.visible = false
    this.selEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff' }))
    this.selMesh.add(this.selEdges)
    group.add(this.selMesh)

    // Sun + shadow camera sized to the site
    this.sun.position.set(-span * 0.35, span * 0.6, span * 0.3)
    Object.assign(this.sun.shadow.camera, { left: -span * 0.62, right: span * 0.62, top: span * 0.62, bottom: -span * 0.62, near: 1, far: span * 2 })
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0005

    this.controls.minDistance = 40
    this.controls.maxDistance = span * 2.4
    this.reset(false)
    return this.plots
  }

  _addLabels() {
    const { width, height } = this.viewBox
    const scale = Math.min(this.small ? 1.1 : 1.7, 4096 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(20,24,30,0.9)'
    for (const p of this.plots) {
      const displayNo = formatPlotNumberOnly(p.no)
      if (!displayNo) continue
      const cxPlot = p.center.x + this.center.cx
      const cyPlot = p.center.z + this.center.cz
      const halfW = p.size.x / 2
      const halfH = p.size.z / 2
      const hasValidLabel =
        Number.isFinite(p.labelX) &&
        Number.isFinite(p.labelY) &&
        p.labelX >= cxPlot - halfW &&
        p.labelX <= cxPlot + halfW &&
        p.labelY >= cyPlot - halfH &&
        p.labelY <= cyPlot + halfH
      const x = hasValidLabel ? p.labelX : cxPlot
      const y = hasValidLabel ? p.labelY : cyPlot
      const maxByWidth = (p.size.x * 0.78) / Math.max(1, displayNo.length * 0.65)
      const maxByHeight = p.size.z * 0.52
      let fit = Math.min(9, Math.min(p.size.x, p.size.z) * 0.36, maxByWidth, maxByHeight)
      fit = Math.max(3.2, fit)
      ctx.font = `700 ${fit * scale}px Montserrat, system-ui, sans-serif`
      const measured = ctx.measureText(displayNo).width
      const maxPxWidth = p.size.x * 0.82 * scale
      if (measured > maxPxWidth && maxPxWidth > 0) {
        fit = Math.max(2.5, fit * (maxPxWidth / measured))
        ctx.font = `700 ${fit * scale}px Montserrat, system-ui, sans-serif`
      }
      ctx.fillText(displayNo, (x - this.viewBox.x) * scale, (y - this.viewBox.y) * scale)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(this.viewBox.x + width / 2 - this.center.cx, PLOT_H + 0.06, this.viewBox.y + height / 2 - this.center.cz)
    plane.renderOrder = 2
    this.labelPlane = plane
    this.group.add(plane)
  }

  /* ───────────── Styling ───────────── */

  /** styles[i] = { color: '#hex', dim: bool } aligned with the plots returned by load() */
  setStyles(styles) {
    this.styles = styles
    for (let i = 0; i < this.plots.length; i += 1) this._paint(i)
    if (this.colorAttr) this.colorAttr.needsUpdate = true
  }

  _paint(i) {
    if (!this.colorAttr) return
    const p = this.plots[i]
    const st = this.styles[i] || { color: '#cfc8b8' }
    const base = new THREE.Color(st.color)
    if (st.dim) base.lerp(new THREE.Color('#d9d6cc'), 0.78)
    if (i === this.hovered && i !== this.selected) base.lerp(new THREE.Color('#ffffff'), 0.35)
    const side = base.clone().multiplyScalar(0.78)
    const arr = this.colorAttr.array
    const nrm = this.normalAttr.array
    for (let v = p.start; v < p.start + p.count; v += 1) {
      const c = nrm[v * 3 + 1] > 0.5 ? base : side
      arr[v * 3] = c.r
      arr[v * 3 + 1] = c.g
      arr[v * 3 + 2] = c.b
    }
  }

  /* ───────────── Interaction ───────────── */

  _pick(clientX, clientY) {
    if (!this.plotMesh) return -1
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const targets = this.selMesh.visible ? [this.selMesh, this.plotMesh] : [this.plotMesh]
    const hit = this.raycaster.intersectObjects(targets, false)[0]
    if (!hit) return -1
    if (hit.object === this.selMesh) return this.selected
    const v = hit.face.a
    let lo = 0
    let hi = this.starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.starts[mid] <= v) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  _setHover(i, evt) {
    if (i === this.hovered) {
      if (evt) this.onHover?.(i, evt)
      return
    }
    const prev = this.hovered
    this.hovered = i
    if (prev >= 0) this._paint(prev)
    if (i >= 0) this._paint(i)
    if (this.colorAttr) this.colorAttr.needsUpdate = true
    this.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab'
    this.onHover?.(i, evt)
  }

  _onMove(e) {
    if (e.pointerType === 'touch') return
    if (this._down && Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y) > 4) return
    if (this._moveRaf) return
    this._moveRaf = requestAnimationFrame(() => {
      this._moveRaf = null
      this._setHover(this._pick(e.clientX, e.clientY), { x: e.clientX, y: e.clientY })
    })
  }

  _onDown(e) {
    // Only the main button (or a finger) selects; right/middle drags move the camera
    if (e.button !== 0) {
      this._down = null
      return
    }
    this._down = { x: e.clientX, y: e.clientY, t: performance.now() }
  }

  _onUp(e) {
    const d = this._down
    this._down = null
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
    if (this.pickMode) {
      const p = this.groundPointSvg(e.clientX, e.clientY)
      if (p) this.onPick?.(p)
      return
    }
    const i = this._pick(e.clientX, e.clientY)
    this.onSelect?.(i >= 0 ? i : null)
  }

  /** Point under the cursor in layout (SVG) coordinates: plot tops first, then the ground. */
  groundPointSvg(clientX, clientY) {
    if (!this.center) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    let hit = this.plotMesh ? this.raycaster.intersectObject(this.plotMesh, false)[0]?.point : null
    if (!hit) {
      hit = new THREE.Vector3()
      if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null
    }
    return { x: hit.x + this.center.cx, y: hit.z + this.center.cz }
  }

  /** Screen position of a layout (SVG) point raised `h` units above the ground, or null if behind the camera. */
  projectSvg(x, y, h = 0) {
    if (!this.center) return null
    const v = new THREE.Vector3(x - this.center.cx, h, y - this.center.cz)
    v.project(this.camera)
    if (v.z > 1 || v.z < -1) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height }
  }

  /** Current camera pose, so a rebuild (new geometry from the CRM) can keep the view. */
  getView() {
    const pre = this._preSelectView
    return { pos: this.camera.position.clone(), target: this.controls.target.clone(), preSelect: pre ? { pos: pre.pos.clone(), target: pre.target.clone() } : null, placeOpen: Boolean(this._placeOpen) }
  }

  setView(view) {
    if (!view) return
    this.tween = null
    this._preSelectView = view.preSelect || null
    this._placeOpen = Boolean(view.placeOpen)
    this.camera.position.copy(view.pos)
    this.controls.target.copy(view.target)
    this.controls.update()
  }

  setSelected(i, { focus = true } = {}) {
    const prev = this.selected
    this.selected = i ?? -1
    if (prev >= 0) this._paint(prev)
    if (this.colorAttr) this.colorAttr.needsUpdate = true
    if (this.selected < 0) {
      this.selMesh.visible = false
      this._lift = null
      // Closing a plot: glide back to the view from before it was opened
      if (prev >= 0) {
        const back = this._preSelectView
        const moved = this._cameraMoved
        this._preSelectView = null
        this._cameraMoved = false
        if (this._placeOpen) {
          // a place card took over (opened from this plot): it owns the way back
          this._preSelectView = back
        } else if (moved) {
          // the camera was already sent somewhere else
        } else if (this.introState) this.pendingTween = null
        else if (back) this._animateTo(back.pos, back.target)
        else this.reset()
      } else this._preSelectView = null
      return
    }
    // Opening a plot from the normal view: remember that view (where the camera is heading, if it is moving)
    if (prev < 0) this._cameraMoved = false
    if (prev < 0 && !this.introState && !this._preSelectView) {
      this._preSelectView = this.tween
        ? { pos: this.tween.pos.clone(), target: this.tween.target.clone() }
        : { pos: this.camera.position.clone(), target: this.controls.target.clone() }
    }
    const p = this.plots[this.selected]
    this.selMesh.geometry = p.geometry
    this.selEdges.geometry.dispose()
    this.selEdges.geometry = new THREE.EdgesGeometry(p.geometry, 30)
    this.selMesh.position.y = 0
    this.selMesh.visible = true
    this._lift = { t0: performance.now(), dur: 380 }
    if (focus) this.focusPlot(this.selected)
  }

  /* ───────────── Camera ───────────── */

  _animateTo(pos, target, dur = 850) {
    this.tween = {
      t0: performance.now(),
      dur,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      pos,
      target,
    }
  }

  focusPlot(i) {
    const p = this.plots[i]
    if (!p) return
    const target = p.center.clone()
    target.y = PLOT_H
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    if (dir.y < 0.6) {
      dir.y = 0.6
      dir.normalize()
    }
    // Portrait screens see less horizontally, so pull back a little more
    const portrait = 1 / Math.sqrt(Math.min(this.camera.aspect, 1))
    const dist = Math.min(Math.max(Math.max(p.size.x, p.size.z) * 8, 300) * portrait, this.span)
    this._animateTo(target.clone().addScaledVector(dir, dist), target)
  }

  reset(animate = true) {
    if (this.selected >= 0 || this._placeOpen) {
      this._preSelectView = null
      this._cameraMoved = true
    }
    // Fit the whole site to the current aspect ratio, viewed from ~52° above the ground
    const vb = this.viewBox || { width: 1000, height: 1000 }
    const fit = Math.max(vb.height, vb.width / Math.max(this.camera.aspect, 0.1))
    const dist = Math.min((fit / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.18, this.controls.maxDistance || Infinity)
    const target = new THREE.Vector3(0, 0, vb.height * 0.06)
    const pos = new THREE.Vector3(0, dist * 0.68, dist * 0.73 + target.z)
    if (animate) this._animateTo(pos, target)
    else {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.controls.update()
    }
  }

  topView() {
    if (this.selected >= 0 || this._placeOpen) {
      this._preSelectView = null
      this._cameraMoved = true
    }
    const dist = (this.span || 1000) * 1.12
    const t = this.controls.target.clone()
    this._animateTo(new THREE.Vector3(t.x, dist, t.z + 0.01), t)
  }

  zoom(factor) {
    const t = this.controls.target
    const offset = this.camera.position.clone().sub(t)
    const len = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance)
    this._animateTo(t.clone().add(offset.setLength(len)), t.clone(), 380)
  }

  /** Move the camera target to SVG coordinates (minimap click). */
  panToSvg(x, y) {
    if (this.selected >= 0 || this._placeOpen) {
      this._preSelectView = null
      this._cameraMoved = true
    }
    const target = new THREE.Vector3(x - this.center.cx, 0, y - this.center.cz)
    const offset = this.camera.position.clone().sub(this.controls.target)
    this._animateTo(target.clone().add(offset), target, 600)
  }

  /** Where the camera rests: the end of a running move, or where it is now. */
  _restingView() {
    return this.tween
      ? { pos: this.tween.pos.clone(), target: this.tween.target.clone() }
      : { pos: this.camera.position.clone(), target: this.controls.target.clone() }
  }

  /** Open a place card: pan to it and remember the view to come back to. */
  focusPlace(x, y) {
    if (!this._preSelectView && !this.introState) this._preSelectView = this._restingView()
    this._placeOpen = true
    const target = new THREE.Vector3(x - this.center.cx, 0, y - this.center.cz)
    const offset = this.camera.position.clone().sub(this.controls.target)
    this._animateTo(target.clone().add(offset), target, 600)
  }

  /** Place card closed: go back, unless a plot was opened from it (the plot's close returns). */
  closePlace() {
    if (!this._placeOpen) return
    this._placeOpen = false
    if (this.selected >= 0) return
    const back = this._preSelectView
    this._preSelectView = null
    if (back && !this.introState) this._animateTo(back.pos, back.target)
  }

  setAutoRotate(on) {
    this.controls.autoRotate = Boolean(on)
  }

  getAzimuth() {
    return this.controls.getAzimuthalAngle()
  }

  /** Screen position above the selected plot (for the pinned label). */
  selectedScreenPoint() {
    if (this.selected < 0) return null
    const p = this.plots[this.selected]
    const v = p.center.clone()
    v.y = PLOT_H + LIFT + 1
    v.project(this.camera)
    if (v.z > 1) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height }
  }

  /** Visible ground rectangle in SVG coordinates (for the minimap viewport). */
  cameraTargetSvg() {
    const t = this.controls.target
    return { x: t.x + this.center.cx, y: t.z + this.center.cz }
  }

  /** Shift the view centre up by a fraction of the height (keeps a plot visible above a bottom sheet). */
  setViewShift(fraction = 0) {
    this.viewShift = fraction
    this.resize()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    if (this.viewShift) this.camera.setViewOffset(w, h, 0, h * this.viewShift, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  _tick() {
    const now = performance.now()
    if (this.tween) {
      const k = Math.min((now - this.tween.t0) / this.tween.dur, 1)
      const e = ease(k)
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.pos, e)
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.target, e)
      if (k >= 1) this.tween = null
    }
    if (this._lift && this.selMesh.visible) {
      const k = Math.min((now - this._lift.t0) / this._lift.dur, 1)
      this.selMesh.position.y = LIFT * ease(k)
      if (k >= 1) this._lift = null
    }
    this.controls.update()
    this._keepTargetOnSite()
    this.renderer.render(this.scene, this.camera)
    this.env?.update(now / 1000)
    // Haze starts beyond the area being looked at, however far the camera is
    if (this.scene.fog && this.span) {
      const d = this.camera.position.distanceTo(this.controls.target)
      this.scene.fog.near = d * 0.8
      this.scene.fog.far = d * 0.8 + this.span * 3
    }
    if (this.viewBox) this.onFrame?.(this)
  }

  /** Clamp the camera target to the layout (plus a margin), moving the camera with it. */
  _keepTargetOnSite() {
    const vb = this.viewBox
    if (!vb || this.tween) return
    const t = this.controls.target
    const hx = (vb.width / 2) * 1.15
    const hz = (vb.height / 2) * 1.15
    const x = THREE.MathUtils.clamp(t.x, -hx, hx)
    const z = THREE.MathUtils.clamp(t.z, -hz, hz)
    if (x === t.x && z === t.z) return
    const dx = x - t.x
    const dz = z - t.z
    t.x = x
    t.z = z
    this.camera.position.x += dx
    this.camera.position.z += dz
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this._raf)
    this._ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this._onMove)
    el.removeEventListener('pointerdown', this._onDown)
    el.removeEventListener('pointerup', this._onUp)
    el.removeEventListener('pointerleave', this._onLeave)
    this.controls.dispose()
    this.scene.traverse((o) => {
      o.geometry?.dispose?.()
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
      mats.forEach((m) => {
        m.map?.dispose?.()
        m.dispose?.()
      })
    })
    this.plots.forEach((p) => p.geometry.dispose())
    this.renderer.dispose()
    el.remove()
  }
}
