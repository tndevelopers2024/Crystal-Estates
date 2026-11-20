import * as THREE from 'three'

/**
 * Illustrative surroundings for the 3D plot layout: farmland, a lake, village
 * clusters, trees, a main road with traffic and birds.
 *
 * Nothing here touches the plot geometry. Trees inside the site are placed
 * only where a raster mask of the plots, unnumbered cells and roads shows
 * free ground, with a margin so crowns never sit on a plot or its number.
 *
 * World units = SVG units (≈ feet on the Somamangalam plan). x stays x,
 * SVG y becomes world z, both centred on the layout.
 */

const FIELD_GREENS = ['#7fb04a', '#94c25a', '#6a9a3c', '#a9c96a', '#5f8f3a', '#86b84e', '#9fbf5a']
const FIELD_BROWNS = ['#c8b07a', '#b89a63', '#d4bf8a', '#bfa46e']
const CROWNS = ['#3f7d3a', '#4f8f3f', '#2f6b34', '#5c9a44', '#3b7444', '#6aa04a', '#467f37']
const WALLS = ['#f4efe6', '#ece4d4', '#f7f3ea', '#e9dcc6', '#dfe6ea', '#f1e3c8', '#e8e0d0']
const ROOFS = ['#c4553a', '#b5482f', '#d9774e', '#8d8f93', '#a85b3a', '#c96a45']
const SHOPS = ['#e7d7b5', '#d9e2e6', '#f0dccb', '#cfd8cf']
const CARS = ['#d9dde2', '#c0392b', '#2c3e50', '#f1f1f1', '#e1b12c', '#2f6f9f', '#555b61', '#1f1f22', '#8e2b2b']

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

function canvasTexture(w, h, draw, repeat = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

/** Raster mask of the drawn layout → "is this SVG point free ground?" */
function freeGroundMask(vb, paths, margin, pad) {
  const ext = { x: vb.x - pad, y: vb.y - pad, w: vb.width + pad * 2, h: vb.height + pad * 2 }
  const scale = 1200 / Math.max(ext.w, ext.h)
  const W = Math.ceil(ext.w * scale)
  const H = Math.ceil(ext.h * scale)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.setTransform(scale, 0, 0, scale, -ext.x * scale, -ext.y * scale)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.lineWidth = margin * 2
  ctx.lineJoin = 'round'
  for (const d of paths) {
    try {
      const p = new Path2D(d)
      ctx.fill(p)
      ctx.stroke(p)
    } catch {
      /* skip malformed path */
    }
  }
  const data = ctx.getImageData(0, 0, W, H).data
  return (sx, sy) => {
    const px = Math.floor((sx - ext.x) * scale)
    const py = Math.floor((sy - ext.y) * scale)
    if (px < 0 || py < 0 || px >= W || py >= H) return false
    return data[(py * W + px) * 4 + 3] < 8
  }
}

/** Patch a standard material so instanced vertices sway with the wind. */
function addWind(material, uniforms, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iw = instanceMatrix[3].xyz;
          float hgt = max(transformed.y - 0.8, 0.0);
          float ph = iw.x * 0.031 + iw.z * 0.047;
          float sway = sin(uTime * 1.35 + ph) * 0.7 + sin(uTime * 2.9 + ph * 1.7) * 0.3;
          transformed.x += sway * ${strength.toFixed(3)} * hgt;
          transformed.z += cos(uTime * 1.1 + ph) * ${(strength * 0.6).toFixed(3)} * hgt;
        #endif`,
      )
  }
  material.customProgramCacheKey = () => `wind-${strength}`
  return material
}

export function buildEnvironment({ group, scene, viewBox: vb, layoutPaths, small, uniforms, reducedMotion }) {
  const rand = rng(20251119)
  const W = vb.width / 2
  const H = vb.height / 2
  const span = Math.max(vb.width, vb.height)
  const R = span * (small ? 2.4 : 3)
  const siteW = W * 1.04
  const siteH = H * 1.04
  const roadZ = siteH + 190
  const sideRoadX = siteW + 300
  const lake = { x: -siteW - span * 0.2, z: -siteH - span * 0.11, rx: span * 0.17, rz: span * 0.08 }
  const villages = [
    { x: -siteW - 560, z: H * 0.3, r: 240, n: 58 },
    { x: sideRoadX + 330, z: -H * 0.35, r: 250, n: 62 },
    { x: siteW * 0.75, z: roadZ + 470, r: 270, n: 66 },
    { x: -siteW * 0.4, z: roadZ + 520, r: 250, n: 58 },
    { x: siteW * 0.3, z: -siteH - 470, r: 210, n: 44 },
    { x: -siteW - 420, z: roadZ + 420, r: 210, n: 42 },
  ]
  const scaleN = small ? 0.5 : 1

  const inLake = (x, z, pad = 0) => ((x - lake.x) / (lake.rx + pad)) ** 2 + ((z - lake.z) / (lake.rz + pad)) ** 2 < 1
  const inSite = (x, z, pad = 0) => Math.abs(x) < siteW + pad && Math.abs(z) < siteH + pad
  const onRoad = (x, z, pad = 0) => Math.abs(z - roadZ) < 26 + pad || (Math.abs(x - sideRoadX) < 18 + pad && z < roadZ)
  const inVillage = (x, z, pad = 0) => villages.some((v) => Math.hypot(x - v.x, z - v.z) < v.r + pad)

  /* ───── Sky, haze, light ───── */
  const haze = new THREE.Color('#dfe9ec')
  scene.background = haze
  scene.fog = new THREE.Fog(haze, span * 1.3, span * 4.2)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(span * 9, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color('#8fbbd8') }, bottom: { value: haze.clone() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; varying vec3 vDir; void main(){ float h = smoothstep(0.02, 0.55, vDir.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0); \n#include <colorspace_fragment>\n }',
    }),
  )
  sky.renderOrder = -10
  scene.add(sky)

  /* ───── Ground: meadow base + mown grass on the site ───── */
  const base = new THREE.Mesh(new THREE.PlaneGeometry(span * 14, span * 14), new THREE.MeshLambertMaterial({ color: '#7d9a4f' }))
  base.rotation.x = -Math.PI / 2
  base.position.y = -3
  base.receiveShadow = true
  group.add(base)

  const mown = canvasTexture(256, 256, (ctx, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? '#8fbd5c' : '#7fb04e'
      ctx.fillRect((i * w) / 8, 0, w / 8, h)
    }
    const r = rng(3)
    for (let i = 0; i < 1400; i += 1) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '40,70,20' : '190,220,140'},${0.08 + r() * 0.1})`
      ctx.fillRect(r() * w, r() * h, 1.5, 1.5)
    }
  })
  mown.repeat.set(vb.width / 260, vb.height / 260)
  const site = new THREE.Mesh(
    new THREE.PlaneGeometry(siteW * 2, siteH * 2),
    new THREE.MeshStandardMaterial({ map: mown, roughness: 1 }),
  )
  site.rotation.x = -Math.PI / 2
  site.position.y = -0.1
  site.receiveShadow = true
  group.add(site)

  // Low hedge kerb around the site boundary
  const kerbMat = new THREE.MeshLambertMaterial({ color: '#c9c1a8' })
  ;[
    [0, -siteH, siteW * 2, 3],
    [0, siteH, siteW * 2, 3],
    [-siteW, 0, 3, siteH * 2],
    [siteW, 0, 3, siteH * 2],
  ].forEach(([x, z, w, d]) => {
    const k = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), kerbMat)
    k.position.set(x, 0.6, z)
    group.add(k)
  })

  /* ───── Farmland patchwork ───── */
  const stripes = (vertical) =>
    canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 16; i += 1) {
        ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
        if (vertical) ctx.fillRect((i * w) / 16, 0, w / 16, h)
        else ctx.fillRect(0, (i * h) / 16, w, h / 16)
      }
    }, false)
  const fieldGeo = new THREE.PlaneGeometry(1, 1)
  fieldGeo.rotateX(-Math.PI / 2)
  const cell = small ? 320 : 230
  const pieces = []
  for (let gx = -R; gx < R; gx += cell) {
    for (let gz = -R; gz < R; gz += cell) {
      let parts = [[gx, gz, cell, cell]]
      const roll = rand()
      if (roll < 0.4) {
        const k = 0.35 + rand() * 0.3
        parts = [[gx, gz, cell * k, cell], [gx + cell * k, gz, cell * (1 - k), cell]]
      } else if (roll < 0.7) {
        const k = 0.35 + rand() * 0.3
        parts = [[gx, gz, cell, cell * k], [gx, gz + cell * k, cell, cell * (1 - k)]]
      }
      for (const [x0, z0, w, d] of parts) {
        const x = x0 + w / 2
        const z = z0 + d / 2
        const hw = w / 2
        const hd = d / 2
        if (Math.hypot(x, z) > R) continue
        if (Math.abs(x) < siteW + 90 + hw && Math.abs(z) < siteH + 90 + hd) continue
        if (Math.abs(z - roadZ) < 34 + hd) continue
        if (Math.abs(x - sideRoadX) < 26 + hw && z - hd < roadZ) continue
        if (inLake(x, z, Math.max(hw, hd) + 40)) continue
        if (villages.some((v) => Math.hypot(x - v.x, z - v.z) < v.r + Math.max(hw, hd) * 0.6)) continue
        const brown = rand() < 0.28
        const pal = brown ? FIELD_BROWNS : FIELD_GREENS
        pieces.push({ x, z, w: w - 7, d: d - 7, color: pal[Math.floor(rand() * pal.length)], vertical: rand() < 0.5, dy: rand() * 0.08 })
      }
    }
  }
  ;[false, true].forEach((vertical) => {
    const list = pieces.filter((p) => p.vertical === vertical)
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(fieldGeo, new THREE.MeshLambertMaterial({ map: stripes(vertical) }), list.length)
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    list.forEach((p, i) => {
      m.makeScale(p.w, 1, p.d).setPosition(p.x, -2.2 + p.dy * 6, p.z)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.set(p.color).offsetHSL(0, 0, (rand() - 0.5) * 0.05))
    })
    mesh.receiveShadow = false
    group.add(mesh)
  })

  /* ───── Roads (traffic runs on the main road only) ───── */
  const roadTex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3f4348'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(0, 3, w, 2)
    ctx.fillRect(0, h - 5, w, 2)
    ctx.fillStyle = '#f3f0e6'
    ctx.fillRect(0, h / 2 - 1, w * 0.55, 2)
  })
  roadTex.repeat.set((R * 2) / 110, 1)
  const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 46), new THREE.MeshLambertMaterial({ map: roadTex }))
  mainRoad.rotation.x = -Math.PI / 2
  mainRoad.position.set(0, -0.6, roadZ)
  group.add(mainRoad)
  const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 60), new THREE.MeshLambertMaterial({ color: '#b9ad8a' }))
  shoulder.rotation.x = -Math.PI / 2
  shoulder.position.set(0, -1.4, roadZ)
  group.add(shoulder)

  const sideLen = roadZ + R
  const sideRoad = new THREE.Mesh(new THREE.PlaneGeometry(30, sideLen), new THREE.MeshLambertMaterial({ color: '#8a826c' }))
  sideRoad.rotation.x = -Math.PI / 2
  sideRoad.position.set(sideRoadX, -1.0, roadZ - sideLen / 2)
  group.add(sideRoad)

  // Entrance road from the main road to the site boundary
  const entry = new THREE.Mesh(new THREE.PlaneGeometry(34, roadZ - siteH - 23), new THREE.MeshLambertMaterial({ color: '#5b5f63' }))
  entry.rotation.x = -Math.PI / 2
  entry.position.set(-siteW * 0.32, -0.2, (roadZ + siteH - 23) / 2)
  group.add(entry)

  /* ───── Lake with animated water ───── */
  const shore = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshLambertMaterial({ color: '#cbbf98' }))
  shore.rotation.x = -Math.PI / 2
  shore.scale.set(lake.rx + 30, lake.rz + 22, 1)
  shore.position.set(lake.x, -1.2, lake.z)
  group.add(shore)

  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      deep: { value: new THREE.Color('#1f5a78') },
      shallow: { value: new THREE.Color('#4b93aa') },
      skyCol: { value: new THREE.Color('#d6eaf2') },
      sunDir: { value: new THREE.Vector3(-0.45, 0.75, 0.4).normalize() },
    },
  ])
  waterUniforms.uTime = uniforms.uTime
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.ShaderMaterial({
      fog: true,
      uniforms: waterUniforms,
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec3 vWorld;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyCol; uniform vec3 sunDir;
        varying vec3 vWorld;
        varying vec2 vUv;
        void main() {
          vec2 p = vWorld.xz * 0.11;
          float t = uTime;
          float a1 = p.x * 1.7 + t * 1.1, a2 = p.y * 2.3 - t * 0.9, a3 = (p.x + p.y) * 1.1 + t * 1.6, a4 = (p.x - p.y) * 3.1 - t * 2.1;
          float w = sin(a1) + sin(a2) + 0.6 * sin(a3) + 0.3 * sin(a4);
          float nx = 0.07 * (1.7 * cos(a1) + 0.66 * cos(a3) + 0.93 * cos(a4));
          float nz = 0.07 * (2.3 * cos(a2) + 0.66 * cos(a3) - 0.93 * cos(a4));
          vec3 n = normalize(vec3(-nx, 1.0, -nz));
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          float edge = smoothstep(0.32, 0.5, length(vUv - 0.5));
          vec3 col = mix(deep, shallow, 0.25 + 0.05 * w + 0.55 * edge);
          col = mix(col, skyCol, clamp(fres * 0.55, 0.0, 0.55));
          float spec = pow(max(dot(reflect(-sunDir, n), v), 0.0), 90.0);
          col += vec3(1.0, 0.97, 0.9) * spec * 0.9;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.scale.set(lake.rx, lake.rz, 1)
  water.position.set(lake.x, 0.4, lake.z)
  group.add(water)

  /* ───── Villages: houses, shops, dirt pads ───── */
  const padMat = new THREE.MeshLambertMaterial({ color: '#cdbf98' })
  const houses = []
  villages.forEach((v) => {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(v.r + 34, 40), padMat)
    pad.rotation.x = -Math.PI / 2
    pad.position.set(v.x, -1.3, v.z)
    pad.scale.set(1, 0.82 + rand() * 0.3, 1)
    group.add(pad)
    const placed = []
    const n = Math.round(v.n * scaleN)
    for (let tries = 0; placed.length < n && tries < n * 12; tries += 1) {
      const ang = rand() * Math.PI * 2
      const rr = Math.sqrt(rand()) * v.r
      const x = v.x + Math.cos(ang) * rr
      const z = v.z + Math.sin(ang) * rr * 0.85
      if (onRoad(x, z, 22) || inLake(x, z, 30) || inSite(x, z, 60)) continue
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 38)) continue
      placed.push([x, z])
      const shop = rand() < 0.14
      houses.push({
        x,
        z,
        w: shop ? 34 + rand() * 18 : 18 + rand() * 12,
        d: shop ? 24 + rand() * 10 : 17 + rand() * 11,
        h: shop ? 12 + rand() * 8 : 11 + rand() * 9,
        yaw: rand() < 0.7 ? Math.round(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.3 : rand() * Math.PI,
        shop,
        wall: (shop ? SHOPS : WALLS)[Math.floor(rand() * (shop ? SHOPS : WALLS).length)],
        roof: ROOFS[Math.floor(rand() * ROOFS.length)],
        roofH: 6 + rand() * 6,
      })
    }
  })
  if (houses.length) {
    const box = new THREE.BoxGeometry(1, 1, 1)
    box.translate(0, 0.5, 0)
    const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2 * 1.12, 1, 4)
    roofGeo.rotateY(Math.PI / 4)
    roofGeo.translate(0, 0.5, 0)
    const bodies = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), houses.length)
    const roofsList = houses.filter((h) => !h.shop)
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial(), Math.max(roofsList.length, 1))
    const awnings = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), Math.max(houses.length - roofsList.length, 1))
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    let ri = 0
    let ai = 0
    houses.forEach((h, i) => {
      o.position.set(h.x, -0.3, h.z)
      o.rotation.set(0, h.yaw, 0)
      o.scale.set(h.w, h.h, h.d)
      o.updateMatrix()
      bodies.setMatrixAt(i, o.matrix)
      bodies.setColorAt(i, c.set(h.wall))
      if (!h.shop) {
        o.position.y = h.h - 0.3
        o.scale.set(h.w, h.roofH, h.d)
        o.updateMatrix()
        roofs.setMatrixAt(ri, o.matrix)
        roofs.setColorAt(ri, c.set(h.roof))
        ri += 1
      } else {
        // Shop: flat roof with a coloured awning band
        o.position.set(h.x, h.h * 0.55, h.z)
        o.scale.set(h.w * 1.02, 2.2, h.d * 1.08)
        o.updateMatrix()
        awnings.setMatrixAt(ai, o.matrix)
        awnings.setColorAt(ai, c.set(['#c0392b', '#2f6f9f', '#e1a12c', '#2e8b57'][ai % 4]))
        ai += 1
      }
    })
    roofs.count = ri
    awnings.count = ai
    bodies.castShadow = roofs.castShadow = !small
    group.add(bodies, roofs, awnings)
  }

  /* ───── Trees & bushes ───── */
  const trees = []
  const bushes = []
  const addTree = (x, z, s, list = trees) => list.push({ x, z, s, yaw: rand() * Math.PI * 2, c: CROWNS[Math.floor(rand() * CROWNS.length)] })

  // Inside the site: only on free ground (mask of plots, cells and roads + margin)
  const free = freeGroundMask(vb, layoutPaths, 13, vb.width * 0.02)
  const cx = vb.x + W
  const cz = vb.y + H
  const insideTarget = Math.round((small ? 520 : 1150) * 1)
  for (let tries = 0, n = 0; n < insideTarget && tries < insideTarget * 14; tries += 1) {
    const x = (rand() * 2 - 1) * (siteW - 10)
    const z = (rand() * 2 - 1) * (siteH - 10)
    if (!free(x + cx, z + cz)) continue
    // Small clumps read more natural than an even spray
    addTree(x, z, 5.5 + rand() * 3.5)
    n += 1
    if (rand() < 0.35) {
      const bx = x + (rand() - 0.5) * 22
      const bz = z + (rand() - 0.5) * 22
      if (free(bx + cx, bz + cz)) addTree(bx, bz, 2.6 + rand() * 1.6, bushes)
    }
  }

  // Tree belt just outside the boundary
  const belt = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    for (let d = 0; d < len; d += small ? 34 : 24) {
      const k = d / len
      for (let row = 0; row < 2; row += 1) {
        if (rand() < 0.15) continue
        const off = 22 + row * 26 + rand() * 10
        const nx = -(z1 - z0) / len
        const nz = (x1 - x0) / len
        const x = x0 + (x1 - x0) * k + nx * off + (rand() - 0.5) * 10
        const z = z0 + (z1 - z0) * k + nz * off + (rand() - 0.5) * 10
        if (!onRoad(x, z, 14)) addTree(x, z, 8 + rand() * 5)
      }
    }
  }
  belt(-siteW, -siteH, siteW, -siteH)
  belt(siteW, -siteH, siteW, siteH)
  belt(siteW, siteH, -siteW, siteH)
  belt(-siteW, siteH, -siteW, -siteH)

  // Avenue trees along both sides of the main road
  for (let x = -R; x < R; x += small ? 90 : 62) {
    ;[-1, 1].forEach((side) => {
      const px = x + (rand() - 0.5) * 20
      const pz = roadZ + side * (40 + rand() * 8)
      if (rand() < 0.8 && Math.hypot(px, pz) < R && !inSite(px, pz, 30)) addTree(px, pz, 8 + rand() * 4)
    })
  }

  // Ring around the lake
  for (let a = 0; a < Math.PI * 2; a += small ? 0.11 : 0.07) {
    if (rand() < 0.25) continue
    const k = 1 + (40 + rand() * 40) / Math.max(lake.rx, lake.rz)
    addTree(lake.x + Math.cos(a) * lake.rx * k, lake.z + Math.sin(a) * lake.rz * (k + 0.15), 8 + rand() * 5)
  }

  // Copses and hedgerow trees scattered across the farmland
  const copses = Math.round(170 * scaleN)
  for (let i = 0; i < copses; i += 1) {
    const ang = rand() * Math.PI * 2
    const rr = Math.sqrt(rand()) * R
    const x0 = Math.cos(ang) * rr
    const z0 = Math.sin(ang) * rr
    if (inSite(x0, z0, 120) || inLake(x0, z0, 40) || onRoad(x0, z0, 40)) continue
    const n = 3 + Math.floor(rand() * 9)
    for (let j = 0; j < n; j += 1) {
      const x = x0 + (rand() - 0.5) * 90
      const z = z0 + (rand() - 0.5) * 90
      if (inSite(x, z, 70) || inLake(x, z, 20) || onRoad(x, z, 22) || inVillage(x, z, -30)) continue
      addTree(x, z, 9 + rand() * 6)
    }
  }
  // A few trees between the village houses
  villages.forEach((v) => {
    for (let i = 0; i < Math.round(16 * scaleN); i += 1) {
      const ang = rand() * Math.PI * 2
      const rr = Math.sqrt(rand()) * (v.r + 20)
      const x = v.x + Math.cos(ang) * rr
      const z = v.z + Math.sin(ang) * rr
      if (!houses.some((h) => Math.hypot(h.x - x, h.z - z) < 22) && !onRoad(x, z, 20)) addTree(x, z, 7 + rand() * 4)
    }
  })

  const crownGeo = new THREE.IcosahedronGeometry(1, 1)
  crownGeo.scale(1, 1.12, 1)
  crownGeo.translate(0, 2.05, 0)
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.3, 5)
  trunkGeo.translate(0, 0.65, 0)
  const bushGeo = new THREE.IcosahedronGeometry(1, 1)
  bushGeo.scale(1, 0.7, 1)
  bushGeo.translate(0, 0.55, 0)

  const crownMat = addWind(new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), uniforms, reducedMotion ? 0 : 0.045)
  const bushMat = addWind(new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), uniforms, reducedMotion ? 0 : 0.03)
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, trees.length)
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#6e5136' }), trees.length)
  const o = new THREE.Object3D()
  const col = new THREE.Color()
  trees.forEach((t, i) => {
    o.position.set(t.x, -0.2, t.z)
    o.rotation.set(0, t.yaw, 0)
    o.scale.set(t.s, t.s * (0.9 + rand() * 0.35), t.s)
    o.updateMatrix()
    crowns.setMatrixAt(i, o.matrix)
    trunks.setMatrixAt(i, o.matrix)
    crowns.setColorAt(i, col.set(t.c).offsetHSL(0, 0, (rand() - 0.5) * 0.06))
  })
  crowns.castShadow = trunks.castShadow = !small
  crowns.receiveShadow = !small
  group.add(trunks, crowns)

  if (bushes.length) {
    const bush = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length)
    bushes.forEach((b, i) => {
      o.position.set(b.x, -0.2, b.z)
      o.rotation.set(0, b.yaw, 0)
      o.scale.set(b.s * 1.3, b.s, b.s * 1.3)
      o.updateMatrix()
      bush.setMatrixAt(i, o.matrix)
      bush.setColorAt(i, col.set(CROWNS[i % CROWNS.length]).offsetHSL(0, 0.05, 0.05))
    })
    group.add(bush)
  }

  /* ───── Cars on the main road ───── */
  const carBody = new THREE.BoxGeometry(20, 5.6, 9.5)
  carBody.translate(0, 3.4, 0)
  const cabin = new THREE.BoxGeometry(10.5, 4.4, 8.4)
  cabin.translate(-1.5, 8.4, 0)
  const carGeo = mergeBoxes(carBody, cabin)
  const carCount = small ? 14 : 30
  const cars = []
  for (let i = 0; i < carCount; i += 1) {
    const dir = i % 2 ? 1 : -1
    const bus = rand() < 0.12
    cars.push({ dir, x: (rand() * 2 - 1) * R, speed: (bus ? 34 : 45) + rand() * 30, lane: roadZ - dir * 10.5, bus, color: bus ? '#e1b12c' : CARS[Math.floor(rand() * CARS.length)] })
  }
  const carMesh = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), carCount)
  cars.forEach((cr, i) => carMesh.setColorAt(i, col.set(cr.color)))
  carMesh.frustumCulled = false
  group.add(carMesh)

  /* ───── Birds ───── */
  const birdGeo = new THREE.BufferGeometry()
  birdGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 1.6, 0, 0, -1.2, -7, 0, -0.6, 0, 0, -1.2, 0, 0, 1.6, 7, 0, -0.6], 3),
  )
  birdGeo.computeVertexNormals()
  const birdMat = new THREE.MeshBasicMaterial({ color: '#2d3236', side: THREE.DoubleSide })
  birdMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
          transformed.y += sin(uTime * 8.5 + ph) * abs(transformed.x) * 0.55;
        #endif`,
      )
  }
  birdMat.customProgramCacheKey = () => 'bird'
  const flocks = Array.from({ length: small ? 2 : 3 }, (_, f) => ({
    rx: span * (0.55 + f * 0.18),
    rz: span * (0.38 + f * 0.12),
    alt: 230 + f * 60,
    w: (0.022 + f * 0.006) * (f % 2 ? -1 : 1),
    phase: f * 2.1,
    birds: Array.from({ length: small ? 6 : 8 }, () => ({ ox: (rand() - 0.5) * 70, oz: (rand() - 0.5) * 70, oy: (rand() - 0.5) * 24, b: rand() * 6, s: 1.3 + rand() * 0.5 })),
  }))
  const birdCount = flocks.reduce((a, f) => a + f.birds.length, 0)
  const birdMesh = new THREE.InstancedMesh(birdGeo, birdMat, birdCount)
  birdMesh.frustumCulled = false
  group.add(birdMesh)

  const dummy = new THREE.Object3D()
  let last = null
  const update = (seconds) => {
    const t = reducedMotion ? 0 : seconds
    uniforms.uTime.value = t
    const dt = last === null ? 0 : Math.min(seconds - last, 0.1)
    last = seconds
    const step = reducedMotion ? 0 : dt

    cars.forEach((cr, i) => {
      cr.x += cr.dir * cr.speed * step
      if (cr.x > R) cr.x = -R
      if (cr.x < -R) cr.x = R
      dummy.position.set(cr.x, -0.5, cr.lane)
      dummy.rotation.set(0, cr.dir > 0 ? 0 : Math.PI, 0)
      dummy.scale.set(cr.bus ? 2.1 : 1, cr.bus ? 1.35 : 1, cr.bus ? 1.15 : 1)
      dummy.updateMatrix()
      carMesh.setMatrixAt(i, dummy.matrix)
    })
    carMesh.instanceMatrix.needsUpdate = true

    let bi = 0
    flocks.forEach((f) => {
      const a = (reducedMotion ? 0.4 : seconds) * f.w + f.phase
      const fx = Math.cos(a) * f.rx
      const fz = Math.sin(a * 1.3) * f.rz
      const vx = -Math.sin(a) * f.rx * f.w
      const vz = Math.cos(a * 1.3) * f.rz * 1.3 * f.w
      const yaw = Math.atan2(vx, vz)
      f.birds.forEach((b) => {
        dummy.position.set(fx + b.ox, f.alt + b.oy + Math.sin(t * 1.4 + b.b) * 4, fz + b.oz)
        dummy.rotation.set(0, yaw, Math.sin(t * 0.8 + b.b) * 0.15)
        dummy.scale.setScalar(b.s)
        dummy.updateMatrix()
        birdMesh.setMatrixAt(bi, dummy.matrix)
        bi += 1
      })
    })
    birdMesh.instanceMatrix.needsUpdate = true
  }
  update(0)

  return { update, sky, counts: { trees: trees.length, bushes: bushes.length, houses: houses.length, fields: pieces.length } }
}

function mergeBoxes(a, b) {
  const g = new THREE.BufferGeometry()
  const pos = [...a.attributes.position.array, ...b.attributes.position.array]
  const nrm = [...a.attributes.normal.array, ...b.attributes.normal.array]
  const off = a.attributes.position.count
  const idx = [...a.index.array, ...Array.from(b.index.array, (i) => i + off)]
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}
