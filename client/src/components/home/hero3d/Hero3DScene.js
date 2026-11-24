import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildEnvironment } from '../../layout3d/environment'
import { STATUS } from '../../layout3d/status'
import { buildCloudLayer } from './CloudLayer'
import { buildOfficeModel } from './OfficeModel'

/**
 * Continuous 5-Scene Three.js Scroll Engine for Crystal Estates Hero.
 *
 * Trajectory:
 * Scene 01: High in the clouds (Sky View)
 * Scene 02: Aerial Property Reveal (Cloud descent into landscape)
 * Scene 03: Actual 3D Plot Layout Reveal (PBR layout, roads, labels, CRM statuses, interactive picking)
 * Scene 04: Crystal Estate Office Reveal (Glide to entrance avenue & architectural pavilion)
 * Scene 05: Crystal Estate Office & Registration (Architectural eye-level showcase)
 */

const PLOT_H = 4.0

function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function shapesFromPaths(ds) {
  if (!Array.isArray(ds) || !ds.length) return []
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

function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return x * x * (3 - 2 * x)
}

function cubicInterpolate(p0, p1, p2, p3, t) {
  const v0 = (p2 - p0) * 0.5
  const v1 = (p3 - p1) * 0.5
  const t2 = t * t
  const t3 = t * t2
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1
}

export default class Hero3DScene {
  constructor(container, { onHoverPlot, onSelectPlot, onSceneChange, onLoadingProgress, onReady } = {}) {
    this.container = container
    this.onHoverPlot = onHoverPlot
    this.onSelectPlot = onSelectPlot
    this.onSceneChange = onSceneChange
    this.onLoadingProgress = onLoadingProgress
    this.onReady = onReady
    this.disposed = false
    this.isReady = false
    this.currentSceneIdx = 0
    this.currentProgress = 0
    this.targetProgress = 0
    this.hoveredPlotIdx = -1
    this.selectedPlotIdx = -1
    this.small = typeof window !== 'undefined' && window.innerWidth < 768

    // 0. Asset Loading Manager
    this.loadingManager = new THREE.LoadingManager()
    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const pct = Math.round((itemsLoaded / itemsTotal) * 100)
      this.onLoadingProgress?.(Math.min(95, pct))
    }
    this.loadingManager.onLoad = () => {
      if (!this.disposed && this.isReady) {
        this.renderer.render(this.scene, this.camera)
      }
    }

    // 1. Renderer Setup — with dark brand clear color to prevent white flashes
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    })
    renderer.setClearColor('#081510', 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.small ? 1.5 : 1.75))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = !this.small
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)
    this.renderer = renderer

    // 2. Scene & Atmospheric Environment
    const scene = new THREE.Scene()
    const hazeColor = new THREE.Color('#dce7ec')
    scene.background = hazeColor
    scene.fog = new THREE.Fog(hazeColor, 1200, 7500)
    this.scene = scene
    this.hazeColor = hazeColor

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 4, 30000)
    this.currentCamPos = new THREE.Vector3(0, 2600, 1600)
    this.currentTarget = new THREE.Vector3(0, 0, 0)
    this.camera.position.copy(this.currentCamPos)
    this.camera.lookAt(this.currentTarget)

    // 4. Lighting Rig
    scene.add(new THREE.HemisphereLight('#f0f6ff', '#586b3e', 1.05))

    const sun = new THREE.DirectionalLight('#fff4e0', 2.1)
    sun.castShadow = !this.small
    sun.position.set(-600, 1400, 600)
    if (sun.shadow) {
      sun.shadow.mapSize.set(2048, 2048)
      sun.shadow.bias = -0.0004
      const d = 1400
      Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 10, far: 3800 })
    }
    scene.add(sun)
    this.sun = sun

    // Soft sky fill
    const fillLight = new THREE.DirectionalLight('#a3cbe8', 0.5)
    fillLight.position.set(600, 800, -600)
    scene.add(fillLight)

    // Raycaster for plot selection in Scene 03
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2(-999, -999)
    this._bindEvents()

    // Animation & Resize Loop
    this.envUniforms = { uTime: { value: 0 } }
    this._clock = new THREE.Clock()
    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(container)

    const loop = () => {
      if (this.disposed) return
      this._raf = requestAnimationFrame(loop)
      this._tick()
    }
    loop()
  }

  /* ───────────── Layout & 3D Office Construction ───────────── */

  load({ viewBox, plots = [], roads = [], openSpaces = [], unmapped = [], records = new Map() }) {
    this.viewBox = viewBox || { x: 0, y: 0, width: 2245.47, height: 1588.21 }
    const cx = this.viewBox.x + this.viewBox.width / 2
    const cz = this.viewBox.y + this.viewBox.height / 2
    this.center = { cx, cz }
    const span = Math.max(this.viewBox.width, this.viewBox.height)
    this.span = span
    this.records = records

    const rootGroup = new THREE.Group()
    this.rootGroup = rootGroup
    this.scene.add(rootGroup)

    // 1. Procedural Clouds
    this.clouds = buildCloudLayer({ scene: this.scene, span, small: this.small })

    // 2. Surroundings (Farmland, lake, village clusters, trees, moving cars, flying birds)
    const allPaths = [...plots.map((p) => p.d), ...unmapped, ...roads].filter(Boolean)
    this.env = buildEnvironment({
      group: rootGroup,
      scene: this.scene,
      viewBox: this.viewBox,
      layoutPaths: allPaths,
      small: this.small,
      uniforms: this.envUniforms,
      reducedMotion: false,
    })

    // 3. Roads & Open Spaces from SVG
    const flat = (shapes, y, material) => {
      if (!shapes || !shapes.length) return null
      const g = new THREE.ShapeGeometry(shapes, 6)
      g.rotateX(Math.PI / 2)
      g.translate(-cx, y, -cz)
      const m = new THREE.Mesh(g, material)
      m.receiveShadow = true
      rootGroup.add(m)
      return g
    }

    const roadShapes = shapesFromPaths(roads).flat()
    flat(roadShapes, 0.05, new THREE.MeshStandardMaterial({ color: '#404449', roughness: 0.95, side: THREE.DoubleSide }))

    const greenShapes = shapesFromPaths(openSpaces).flat()
    flat(greenShapes, 0.1, new THREE.MeshStandardMaterial({ color: '#689f46', roughness: 0.98, side: THREE.DoubleSide }))

    // 4. Extruded Plots Mesh with Real CRM Statuses
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
      const plotInfo = plots[i] || {}
      const rec = records.get(plotInfo.key) || null

      this.plots.push({
        ...plotInfo,
        record: rec,
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
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 }),
      )
      this.plotMesh.castShadow = !this.small
      this.plotMesh.receiveShadow = !this.small
      rootGroup.add(this.plotMesh)

      this.colorAttr = merged.attributes.color
      this.normalAttr = merged.attributes.normal

      // Crisp dark plot borders
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(merged, 32),
        new THREE.LineBasicMaterial({ color: '#16191d', transparent: true, opacity: 0.38 }),
      )
      rootGroup.add(edges)
      this.plotEdges = edges

      // Paint plots with initial CRM colors
      this.paintAllPlots()
    }

    // 5. Crisp Canvas-Texture Labels for Plot Numbers
    this._addLabels()

    // 6. Selected Plot Highlight Mesh
    this.selMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: '#ffd54f', emissive: '#ffb300', emissiveIntensity: 0.45, roughness: 0.4 }),
    )
    this.selMesh.castShadow = true
    this.selMesh.visible = false
    rootGroup.add(this.selMesh)

    // 7. Architectural Crystal Estate Office & Welcome Lounge
    // Situated prominently on the estate entrance avenue:
    const siteH = (this.viewBox.height / 2) * 1.04
    const officeZ = siteH + 65
    const officeX = 90
    this.officePos = new THREE.Vector3(officeX, 0, officeZ)

    this.office = buildOfficeModel({
      group: rootGroup,
      position: { x: officeX, z: officeZ },
      small: this.small,
      loadingManager: this.loadingManager,
    })

    // Setup camera keyframes based on site proportions
    this._initKeyframes()
    this.setProgress(0)

    // Precompile shaders and render initial frame to GPU
    try {
      this.renderer.compile(this.scene, this.camera)
      this.renderer.render(this.scene, this.camera)
    } catch {
      /* fallback gracefully */
    }

    this.isReady = true
    this.onLoadingProgress?.(100)
    this.onReady?.()
  }

  paintAllPlots(highlightWave = -1) {
    if (!this.colorAttr || !this.plots.length) return
    const arr = this.colorAttr.array
    const nrm = this.normalAttr.array

    for (let i = 0; i < this.plots.length; i += 1) {
      const p = this.plots[i]
      const rec = p.record || this.records.get(p.key)
      const st = String(rec?.status || 'Available').toLowerCase()
      let hex = '#24ba74'

      if (st.includes('sold')) hex = '#c45a50'
      else if (st.includes('book') || st.includes('res')) hex = '#e0982d'
      else if (STATUS[st]?.color) hex = STATUS[st].color

      const base = new THREE.Color(hex)

      // Dynamic highlight wave during Scene 03 scrolling
      if (highlightWave >= 0) {
        const waveDist = Math.abs(p.center.z - highlightWave)
        if (waveDist < 120) {
          const boost = (1 - waveDist / 120) * 0.45
          base.lerp(new THREE.Color('#ffe28a'), boost)
        }
      }

      // Hover / Selection brightening
      if (i === this.hoveredPlotIdx) {
        base.lerp(new THREE.Color('#ffffff'), 0.55)
      }

      const side = base.clone().multiplyScalar(0.72)

      for (let v = p.start; v < p.start + p.count; v += 1) {
        const isTop = nrm[v * 3 + 1] > 0.5
        const c = isTop ? base : side
        arr[v * 3] = c.r
        arr[v * 3 + 1] = c.g
        arr[v * 3 + 2] = c.b
      }
    }

    this.colorAttr.needsUpdate = true
  }

  _addLabels() {
    if (!this.viewBox || !this.plots.length) return
    const { width, height } = this.viewBox
    const scale = Math.min(this.small ? 1.0 : 1.6, 4096 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(15, 20, 25, 0.95)'

    for (const p of this.plots) {
      const x = Number.isFinite(p.labelX) ? p.labelX : p.center.x + this.center.cx
      const y = Number.isFinite(p.labelY) ? p.labelY : p.center.z + this.center.cz
      const fit = Math.max(4.5, Math.min(8.5, Math.min(p.size.x, p.size.z) / Math.max(2.0, (p.no || '').length * 0.6)))
      ctx.font = `700 ${fit * scale}px Montserrat, system-ui, sans-serif`
      ctx.fillText(p.no || '', (x - this.viewBox.x) * scale, (y - this.viewBox.y) * scale)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(this.viewBox.x + width / 2 - this.center.cx, PLOT_H + 0.08, this.viewBox.y + height / 2 - this.center.cz)
    plane.renderOrder = 3
    this.labelPlane = plane
    this.rootGroup.add(plane)
  }

  /* ───────────── 5-Scene Camera Keyframe Trajectory ───────────── */

  _initKeyframes() {
    const off = this.officePos || new THREE.Vector3(90, 0, 890)

    // Keyframes define the continuous cinematic scroll path:
    this.keyframes = [
      // 0: Scene 01 (Sky View / Opening Hero)
      {
        p: 0.0,
        cam: new THREE.Vector3(0, 2650, 1650),
        target: new THREE.Vector3(0, 0, 0),
        fov: 42,
        fogNear: 1600,
        fogFar: 8500,
      },
      // 1: Scene 02 (Aerial Property Reveal - Cloud descent into landscape)
      {
        p: 0.22,
        cam: new THREE.Vector3(90, 1250, 1020),
        target: new THREE.Vector3(0, 0, 80),
        fov: 40,
        fogNear: 900,
        fogFar: 6500,
      },
      // 2: Scene 03 (Actual 3D Plot Layout Reveal - Isometric inspection)
      {
        p: 0.48,
        cam: new THREE.Vector3(-35, 460, 520),
        target: new THREE.Vector3(0, 10, -10),
        fov: 38,
        fogNear: 600,
        fogFar: 5000,
      },
      // 3: Scene 04 (Office Approach - Glide to entrance avenue)
      {
        p: 0.74,
        cam: new THREE.Vector3(off.x + 45, 68, off.z + 130),
        target: new THREE.Vector3(off.x, 14, off.z + 12),
        fov: 35,
        fogNear: 350,
        fogFar: 4200,
      },
      // 4: Scene 05 (Crystal Estate Office & Registration)
      {
        p: 1.0,
        cam: new THREE.Vector3(off.x + 22, 28, off.z + 74),
        target: new THREE.Vector3(off.x - 2, 13, off.z + 8),
        fov: 33,
        fogNear: 280,
        fogFar: 3800,
      },
    ]
  }

  setProgress(p) {
    this.targetProgress = Math.max(0, Math.min(1, p))
  }

  _interpolateCamera(p) {
    if (!this.keyframes || !this.keyframes.length) return
    const kfs = this.keyframes

    // Determine current interval
    let idx = 0
    while (idx < kfs.length - 1 && kfs[idx + 1].p <= p) {
      idx += 1
    }
    const nextIdx = Math.min(kfs.length - 1, idx + 1)
    const k0 = kfs[Math.max(0, idx - 1)]
    const k1 = kfs[idx]
    const k2 = kfs[nextIdx]
    const k3 = kfs[Math.min(kfs.length - 1, nextIdx + 1)]

    const segLen = k2.p - k1.p
    const segT = segLen <= 0 ? 0 : smoothstep(0, 1, (p - k1.p) / segLen)

    // Smooth cubic Hermite interpolation for camera position
    const cx = cubicInterpolate(k0.cam.x, k1.cam.x, k2.cam.x, k3.cam.x, segT)
    const cy = cubicInterpolate(k0.cam.y, k1.cam.y, k2.cam.y, k3.cam.y, segT)
    const cz = cubicInterpolate(k0.cam.z, k1.cam.z, k2.cam.z, k3.cam.z, segT)
    this.camera.position.set(cx, cy, cz)

    // Smooth target interpolation
    const tx = cubicInterpolate(k0.target.x, k1.target.x, k2.target.x, k3.target.x, segT)
    const ty = cubicInterpolate(k0.target.y, k1.target.y, k2.target.y, k3.target.y, segT)
    const tz = cubicInterpolate(k0.target.z, k1.target.z, k2.target.z, k3.target.z, segT)
    this.camera.lookAt(tx, ty, tz)

    // Smooth FOV & Fog
    const fov = k1.fov + (k2.fov - k1.fov) * segT
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }

    if (this.scene.fog) {
      this.scene.fog.near = k1.fogNear + (k2.fogNear - k1.fogNear) * segT
      this.scene.fog.far = k1.fogFar + (k2.fogFar - k1.fogFar) * segT
    }

    // Determine Scene index (0 to 4)
    let sceneIdx
    if (p < 0.20) sceneIdx = 0
    else if (p < 0.40) sceneIdx = 1
    else if (p < 0.65) sceneIdx = 2
    else if (p < 0.85) sceneIdx = 3
    else sceneIdx = 4

    if (sceneIdx !== this.currentSceneIdx) {
      this.currentSceneIdx = sceneIdx
      this.onSceneChange?.(sceneIdx)
    }

    // Scene 03 sector highlighting during scroll
    if (sceneIdx === 2) {
      // Map progress [0.40, 0.65] to Z-range across the site [-siteH, siteH]
      const siteH = this.viewBox ? this.viewBox.height * 0.4 : 350
      const scanT = (p - 0.40) / 0.25
      const waveZ = -siteH + scanT * (siteH * 2)
      this.paintAllPlots(waveZ)
    } else {
      this.paintAllPlots(-1)
    }
  }

  /* ───────────── Interactive Plot Raycasting ───────────── */

  _bindEvents() {
    this._onPointerMove = (e) => {
      // Only active during Scene 03 (Plot Layout Reveal)
      if (this.currentSceneIdx !== 2) {
        if (this.hoveredPlotIdx !== -1) {
          this.hoveredPlotIdx = -1
          this.paintAllPlots(-1)
          this.onHoverPlot?.(null)
          this.renderer.domElement.style.cursor = 'default'
        }
        return
      }

      const rect = this.renderer.domElement.getBoundingClientRect()
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      this._pickPlot(e.clientX, e.clientY)
    }

    this._onPointerUp = () => {
      if (this.currentSceneIdx !== 2) return
      if (this.hoveredPlotIdx >= 0) {
        const plot = this.plots[this.hoveredPlotIdx]
        this.selectedPlotIdx = this.hoveredPlotIdx
        this.onSelectPlot?.(plot)
      }
    }

    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove, { passive: true })
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp)
  }

  _pickPlot(clientX, clientY) {
    if (!this.plotMesh || !this.starts.length) return
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObject(this.plotMesh, false)

    if (hits.length > 0) {
      const v = hits[0].face.a
      let lo = 0
      let hi = this.starts.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (this.starts[mid] <= v) lo = mid
        else hi = mid - 1
      }

      if (lo !== this.hoveredPlotIdx) {
        this.hoveredPlotIdx = lo
        this.paintAllPlots()
        const plot = this.plots[lo]
        this.renderer.domElement.style.cursor = 'pointer'
        this.onHoverPlot?.(plot, { x: clientX, y: clientY })
      }
    } else if (this.hoveredPlotIdx !== -1) {
      this.hoveredPlotIdx = -1
      this.paintAllPlots()
      this.renderer.domElement.style.cursor = 'default'
      this.onHoverPlot?.(null)
    }
  }

  /* ───────────── Render & Resize ───────────── */

  resize() {
    if (!this.container || this.disposed) return
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w <= 0 || h <= 0) return

    this.small = w < 768
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  _tick() {
    this._clock.getDelta()
    const elapsed = this._clock.getElapsedTime()
    this.envUniforms.uTime.value = elapsed

    // Silk-smooth camera interpolation
    const diff = this.targetProgress - this.currentProgress
    if (Math.abs(diff) > 0.0001) {
      this.currentProgress += diff * 0.14
    } else {
      this.currentProgress = this.targetProgress
    }

    this._interpolateCamera(this.currentProgress)

    // Update clouds & surroundings
    if (this.clouds) this.clouds.update(elapsed, this.camera.position.y)
    if (this.env && this.env.update) this.env.update(elapsed)

    this.renderer.render(this.scene, this.camera)
  }

  /* ───────────── Clean Disposal ───────────── */

  dispose() {
    this.disposed = true
    if (this._raf) cancelAnimationFrame(this._raf)
    if (this._ro) this._ro.disconnect()

    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp)

    if (this.clouds) this.clouds.dispose()
    if (this.office) this.office.dispose()

    if (this.plotMesh) {
      this.plotMesh.geometry.dispose()
      this.plotMesh.material.dispose()
    }
    if (this.plotEdges) {
      this.plotEdges.geometry.dispose()
      this.plotEdges.material.dispose()
    }
    if (this.labelPlane) {
      this.labelPlane.geometry.dispose()
      this.labelPlane.material.map?.dispose()
      this.labelPlane.material.dispose()
    }

    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }
}
