import * as THREE from 'three'

/**
 * Intro globe for the 3D layout.
 *
 * A unit sphere whose north pole sits at the world origin (the centre of the
 * site). The scene scales the globe together with the landscape, so zooming
 * in reads as one continuous move from orbit down to the plots.
 *
 * Around the pole the surface is painted as meadow and farmland, so when the
 * site appears there the colours already match; further out it becomes
 * continents and ocean. `hole` (in unit-sphere units) opens a soft circle at
 * the pole through which the real landscape shows.
 */

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mix = (a, b, t) => a + (b - a) * t
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** Equirectangular texture: farmland around the pole, then continents and ocean. */
function globeTexture() {
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const r = rng(7)
  const gw = 64
  const gh = 32
  const grid = new Float32Array(gw * gh).map(() => r())
  const noise = (x, y) => {
    const gx = ((x % gw) + gw) % gw
    const gy = Math.min(gh - 1.001, Math.max(0, y))
    const x0 = Math.floor(gx)
    const y0 = Math.floor(gy)
    const tx = gx - x0
    const ty = gy - y0
    const s = (t) => t * t * (3 - 2 * t)
    const v = (i, j) => grid[(j % gh) * gw + (i % gw)]
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * s(tx)
    const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * s(tx)
    return a + (b - a) * s(ty)
  }
  // Farmland palette (matches the landscape's fields and meadow)
  const FIELDS = [
    [127, 176, 74],
    [148, 194, 90],
    [106, 154, 60],
    [169, 201, 106],
    [200, 176, 122],
    [184, 154, 99],
  ]
  const img = ctx.createImageData(W, H)
  const fr = rng(19)
  const patch = Array.from({ length: 64 * 16 }, () => FIELDS[Math.floor(fr() * FIELDS.length)])
  for (let y = 0; y < H; y += 1) {
    const lat = y / H // 0 = north pole
    for (let x = 0; x < W; x += 1) {
      const u = x / W
      const n = noise(u * 16, lat * 16) * 0.6 + noise(u * 37, lat * 37) * 0.3 + noise(u * 83, lat * 83) * 0.1
      // Continents / ocean
      let R
      let G
      let B
      if (n + Math.max(0, 0.3 - lat) * 2 > 0.56) {
        const t = Math.min(1, (n - 0.5) * 3)
        R = 96 + 60 * t
        G = 150 + 25 * (1 - t)
        B = 72 + 20 * t
      } else {
        const d = Math.min(1, (0.56 - n) * 3)
        R = 28 - 12 * d
        G = 104 - 34 * d
        B = 140 - 18 * d
      }
      // Farmland near the pole: a patchwork in the landscape's colours
      const farm = 1 - smooth(0.1, 0.24, lat)
      if (farm > 0) {
        const p = patch[(Math.floor(lat * 160) % 16) * 64 + Math.floor(u * 64)]
        const meadow = [125, 154, 79]
        const f = n > 0.45 ? p : meadow
        R = mix(R, f[0], farm)
        G = mix(G, f[1], farm)
        B = mix(B, f[2], farm)
      }
      const i = (y * W + x) * 4
      img.data[i] = R
      img.data[i + 1] = G
      img.data[i + 2] = B
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  // Faint gold graticule, kept away from the farmland
  ctx.strokeStyle = 'rgba(232, 205, 140, 0.16)'
  ctx.lineWidth = 1
  for (let k = 1; k < 12; k += 1) {
    ctx.beginPath()
    ctx.moveTo((k * W) / 12, H * 0.22)
    ctx.lineTo((k * W) / 12, H)
    ctx.stroke()
  }
  for (let k = 2; k < 6; k += 1) {
    ctx.beginPath()
    ctx.moveTo(0, (k * H) / 6)
    ctx.lineTo(W, (k * H) / 6)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function createGlobe({ small = false } = {}) {
  // Unit sphere, north pole at the origin. `root` is scaled by the scene.
  const root = new THREE.Group()
  const uniforms = { uHole: { value: 0 }, uFeather: { value: 0.001 } }

  const geo = new THREE.SphereGeometry(1, small ? 96 : 160, small ? 56 : 96)
  geo.translate(0, -1, 0)

  const mat = new THREE.MeshStandardMaterial({
    map: globeTexture(),
    roughness: 0.85,
    metalness: 0.02,
    transparent: true,
    // Paints over the landscape everywhere except the opening at the pole.
    // Front faces of a sphere never overlap, so no depth test is needed.
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHole = uniforms.uHole
    shader.uniforms.uFeather = uniforms.uFeather
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRad;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRad = length(position.xz);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uHole;\nuniform float uFeather;\nvarying float vRad;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(uHole, uHole + uFeather, vRad);')
  }
  mat.customProgramCacheKey = () => 'globe-hole'
  const globe = new THREE.Mesh(geo, mat)
  globe.frustumCulled = false
  globe.renderOrder = 5
  root.add(globe)

  // Soft atmosphere glow
  const atmoMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    uniforms: { uOpacity: { value: 1 } },
    vertexShader:
      'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform float uOpacity; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.66 - dot(vN, vec3(0.0, 0.0, 1.0))), 2.6); gl_FragColor = vec4(0.42, 0.72, 1.0, 1.0) * i * uOpacity; }',
  })
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.12, 48, 24), atmoMat)
  atmo.position.y = -1
  atmo.renderOrder = 4
  root.add(atmo)

  // Gold pin + pulsing ring at the pole (the site), drawn on top of the globe
  const pin = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({ color: '#d4ad52', emissive: '#b8862a', emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.4, transparent: true, depthTest: false })
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), gold)
  head.position.y = 0.16
  const stem = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.13, 20), gold)
  stem.rotation.x = Math.PI
  stem.position.y = 0.075
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 48), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.002
  ;[head, stem, ring].forEach((m) => {
    m.renderOrder = 7
  })
  pin.add(head, stem, ring)
  root.add(pin)

  // Distant stars (not scaled with the globe)
  const starCount = small ? 700 : 1400
  const starPos = new Float32Array(starCount * 3)
  const r = rng(11)
  for (let i = 0; i < starCount; i += 1) {
    const u = r() * 2 - 1
    const t = r() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    starPos.set([s * Math.cos(t) * 9000, u * 9000, s * Math.sin(t) * 9000], i * 3)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({ color: '#dfe9ff', size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })
  const stars = new THREE.Points(starGeo, starMat)

  let spinAngle = 0
  let pulse = 0
  let pinFade = 1

  return {
    root,
    stars,
    /** Idle animation; `spinRate` eases to 0 as the zoom begins so the surface settles under the site. */
    tick(dt, spinRate = 1) {
      const step = Math.min(dt, 0.05)
      spinAngle += step * 0.12 * spinRate
      globe.rotation.y = spinAngle
      pulse = (pulse + step * 0.9) % 1
      ring.scale.setScalar(1 + pulse * 2.2)
      ringMat.opacity = 0.85 * (1 - pulse) * pinFade
      head.position.y = 0.16 + Math.sin(spinAngle * 18) * 0.012
    },
    set({ hole, feather, globeOpacity, atmoOpacity, pinOpacity, starOpacity }) {
      if (hole !== undefined) uniforms.uHole.value = hole
      if (feather !== undefined) uniforms.uFeather.value = Math.max(feather, 1e-4)
      if (globeOpacity !== undefined) {
        mat.opacity = globeOpacity
        globe.visible = globeOpacity > 0.005
      }
      if (atmoOpacity !== undefined) {
        atmoMat.uniforms.uOpacity.value = atmoOpacity
        atmo.visible = atmoOpacity > 0.005
      }
      if (pinOpacity !== undefined) {
        pinFade = pinOpacity
        gold.opacity = pinOpacity
        pin.visible = pinOpacity > 0.005
      }
      if (starOpacity !== undefined) {
        starMat.opacity = starOpacity
        stars.visible = starOpacity > 0.005
      }
    },
    dispose() {
      ;[root, stars].forEach((obj) => {
        obj.traverse((o) => {
          o.geometry?.dispose?.()
          o.material?.map?.dispose?.()
          o.material?.dispose?.()
        })
        obj.parent?.remove(obj)
      })
    },
  }
}
