import * as THREE from 'three'

/**
 * Architectural 3D representation of the Crystal Estate Site Office & Welcome Centre.
 * Located at the estate entrance avenue facing the main road.
 *
 * Branding Requirements:
 * - Uses the ACTUAL Crystal Estate logo (/logo-white.png) with authentic leaf emblem,
 *   proportions (2.94:1 ratio), colors, and typography.
 * - Realistic physical architectural signage with dark bronze backplate, champagne gold trim,
 *   subtle emissive glow, and physical architectural spotlighting.
 * - Entrance driveway monument totem featuring the authentic logo.
 * - Floor-to-ceiling glass curtain walls with subtle reflections and glowing interior.
 * - Landscaped entrance plaza with pavers, ornamental palms, box hedges, flagpoles, and visitor parking.
 */

function makeWoodTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#8f5c2c'
  ctx.fillRect(0, 0, 256, 256)

  // Warm teak wood slat lines
  const slats = 16
  const h = 256 / slats
  for (let i = 0; i < slats; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#9c6633' : '#7f4f24'
    ctx.fillRect(0, i * h, 256, h - 2)
    ctx.fillStyle = '#422810'
    ctx.fillRect(0, (i + 1) * h - 2, 256, 2)
  }

  return canvas
}

function makePaverTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#9b9487'
  ctx.fillRect(0, 0, 256, 256)

  ctx.strokeStyle = '#6f695f'
  ctx.lineWidth = 2
  const grid = 16
  for (let x = 0; x <= 256; x += grid) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 256)
    ctx.stroke()
  }
  for (let y = 0; y <= 256; y += grid) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y)
    ctx.stroke()
  }

  return canvas
}

function makeSubtitleTexture(text, width = 512, height = 64) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.clearRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 24px Montserrat, system-ui, sans-serif'
  ctx.fillStyle = '#d4af37'
  ctx.letterSpacing = '3px'
  ctx.fillText(text.toUpperCase(), width / 2, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function buildOfficeModel({ group, position = { x: 120, z: 890 }, small = false, loadingManager = null }) {
  const officeGroup = new THREE.Group()
  officeGroup.name = 'crystal-estate-office'
  officeGroup.position.set(position.x, 0, position.z)
  group.add(officeGroup)

  const geometries = []
  const materials = []
  const textures = []

  const track = (g, m, t) => {
    if (g) geometries.push(g)
    if (m) materials.push(m)
    if (t) textures.push(t)
  }

  // Load the ACTUAL authentic Crystal Estate logo
  const textureLoader = loadingManager ? new THREE.TextureLoader(loadingManager) : new THREE.TextureLoader()
  const logoTexture = textureLoader.load('/logo-white.png')
  logoTexture.colorSpace = THREE.SRGBColorSpace
  logoTexture.anisotropy = 8
  logoTexture.minFilter = THREE.LinearMipmapLinearFilter
  track(null, null, logoTexture)

  // Common materials
  const paverTex = new THREE.CanvasTexture(makePaverTexture())
  paverTex.wrapS = paverTex.wrapT = THREE.RepeatWrapping
  paverTex.repeat.set(8, 6)
  const plazaMat = new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.85, metalness: 0.1 })
  track(null, plazaMat, paverTex)

  const woodTex = new THREE.CanvasTexture(makeWoodTexture())
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping
  woodTex.repeat.set(2, 4)
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0.05 })
  track(null, woodMat, woodTex)

  const limestoneMat = new THREE.MeshStandardMaterial({ color: '#ede7db', roughness: 0.8, metalness: 0.05 })
  const graniteMat = new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.35, metalness: 0.2 })
  const bronzeMat = new THREE.MeshStandardMaterial({ color: '#26292b', roughness: 0.3, metalness: 0.85 })
  const goldMat = new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.25, metalness: 0.9, emissive: '#b8964e', emissiveIntensity: 0.35 })
  const signBackplateMat = new THREE.MeshStandardMaterial({ color: '#091c15', roughness: 0.4, metalness: 0.5 })

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#3d6375',
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.65,
    thickness: 1.5,
    transparent: true,
    opacity: 0.72,
    reflectivity: 0.9,
  })
  const interiorGlowMat = new THREE.MeshBasicMaterial({ color: '#ffe4b5' })
  const grassMat = new THREE.MeshStandardMaterial({ color: '#557e38', roughness: 0.9 })
  const hedgeMat = new THREE.MeshStandardMaterial({ color: '#2e5b27', roughness: 0.95, flatShading: true })

  // Realistic Physical Signage Material with Authentic Crystal Estate Logo
  const logoSignMat = new THREE.MeshStandardMaterial({
    map: logoTexture,
    transparent: true,
    alphaTest: 0.04,
    roughness: 0.2,
    metalness: 0.15,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: logoTexture,
    emissiveIntensity: 0.55,
    side: THREE.DoubleSide,
  })

  track(null, limestoneMat)
  track(null, graniteMat)
  track(null, bronzeMat)
  track(null, goldMat)
  track(null, signBackplateMat)
  track(null, glassMat)
  track(null, interiorGlowMat)
  track(null, grassMat)
  track(null, hedgeMat)
  track(null, logoSignMat)

  // 1. Entrance Plaza & Driveway Base
  const plazaGeo = new THREE.BoxGeometry(140, 0.4, 95)
  plazaGeo.translate(0, 0.2, 8)
  const plaza = new THREE.Mesh(plazaGeo, plazaMat)
  plaza.receiveShadow = true
  officeGroup.add(plaza)
  track(plazaGeo)

  // 2. Foundation Plinth & Steps
  const plinthGeo = new THREE.BoxGeometry(86, 1.2, 52)
  plinthGeo.translate(0, 0.6, 0)
  const plinth = new THREE.Mesh(plinthGeo, graniteMat)
  plinth.receiveShadow = true
  plinth.castShadow = !small
  officeGroup.add(plinth)
  track(plinthGeo)

  // Steps
  const stepsGeo = new THREE.BoxGeometry(26, 0.6, 8)
  stepsGeo.translate(0, 0.3, 29)
  const steps = new THREE.Mesh(stepsGeo, graniteMat)
  steps.receiveShadow = true
  officeGroup.add(steps)
  track(stepsGeo)

  // 3. Main Pavilion Walls
  const wallGeo = new THREE.BoxGeometry(82, 18, 48)
  wallGeo.translate(0, 10.2, 0)
  const walls = new THREE.Mesh(wallGeo, limestoneMat)
  walls.castShadow = !small
  walls.receiveShadow = true
  officeGroup.add(walls)
  track(wallGeo)

  // Parapet roof trim
  const roofTrimGeo = new THREE.BoxGeometry(84, 1.6, 50)
  roofTrimGeo.translate(0, 19.8, 0)
  const roofTrim = new THREE.Mesh(roofTrimGeo, bronzeMat)
  roofTrim.castShadow = !small
  officeGroup.add(roofTrim)
  track(roofTrimGeo)

  // 4. Large Glass Curtain Wall (Front Facade)
  const glassGeo = new THREE.PlaneGeometry(62, 14.5)
  const frontGlass = new THREE.Mesh(glassGeo, glassMat)
  frontGlass.position.set(0, 9.5, 24.1)
  officeGroup.add(frontGlass)
  track(glassGeo)

  // Dark Aluminum Window Mullions
  const mullionGeo = new THREE.BoxGeometry(1.2, 14.5, 0.6)
  ;[-20, -7, 7, 20].forEach((mx) => {
    const m = new THREE.Mesh(mullionGeo, bronzeMat)
    m.position.set(mx, 9.5, 24.2)
    officeGroup.add(m)
  })
  track(mullionGeo)

  const transomGeo = new THREE.BoxGeometry(62, 0.8, 0.6)
  transomGeo.translate(0, 8.5, 24.2)
  const transom = new THREE.Mesh(transomGeo, bronzeMat)
  officeGroup.add(transom)
  track(transomGeo)

  // 5. Welcoming Interior Setup
  const deskGeo = new THREE.BoxGeometry(14, 4.2, 4.5)
  deskGeo.translate(0, 3.3, 14)
  const desk = new THREE.Mesh(deskGeo, bronzeMat)
  officeGroup.add(desk)
  track(deskGeo)

  const deskGlowGeo = new THREE.BoxGeometry(12, 2.2, 0.4)
  deskGlowGeo.translate(0, 3.1, 16.3)
  const deskGlow = new THREE.Mesh(deskGlowGeo, goldMat)
  officeGroup.add(deskGlow)
  track(deskGlowGeo)

  // Interior Model Display Table
  const tableGeo = new THREE.BoxGeometry(10, 3.2, 10)
  tableGeo.translate(-16, 2.8, 12)
  const table = new THREE.Mesh(tableGeo, limestoneMat)
  officeGroup.add(table)
  track(tableGeo)

  const miniSiteGeo = new THREE.BoxGeometry(8, 0.5, 8)
  miniSiteGeo.translate(-16, 4.6, 12)
  const miniSite = new THREE.Mesh(miniSiteGeo, grassMat)
  officeGroup.add(miniSite)
  track(miniSiteGeo)

  // Interior warm point light shining through the glass
  const interiorLight = new THREE.PointLight('#ffe4b5', 1.8, 65)
  interiorLight.position.set(0, 12, 10)
  officeGroup.add(interiorLight)

  // 6. Projecting Architectural Canopy / Portico
  const canopyGeo = new THREE.BoxGeometry(44, 2.2, 22)
  canopyGeo.translate(0, 16.5, 34)
  const canopy = new THREE.Mesh(canopyGeo, bronzeMat)
  canopy.castShadow = !small
  officeGroup.add(canopy)
  track(canopyGeo)

  // Teak timber soffit underneath the canopy
  const soffitGeo = new THREE.PlaneGeometry(43, 21)
  soffitGeo.rotateX(Math.PI / 2)
  soffitGeo.translate(0, 15.35, 34)
  const soffit = new THREE.Mesh(soffitGeo, woodMat)
  officeGroup.add(soffit)
  track(soffitGeo)

  // Structural Steel Canopy Support Columns
  const colGeo = new THREE.CylinderGeometry(0.7, 0.7, 15, 12)
  ;[-19, 19].forEach((cx) => {
    const colMesh = new THREE.Mesh(colGeo, bronzeMat)
    colMesh.position.set(cx, 8.2, 43.5)
    colMesh.castShadow = !small
    officeGroup.add(colMesh)
  })
  track(colGeo)

  // Warm LED downlight spot fixtures on canopy ceiling
  const spotGeo = new THREE.CircleGeometry(0.9, 12)
  spotGeo.rotateX(Math.PI / 2)
  ;[-12, 0, 12].forEach((sx) => {
    const s = new THREE.Mesh(spotGeo, interiorGlowMat)
    s.position.set(sx, 15.3, 34)
    officeGroup.add(s)
  })
  track(spotGeo)

  // ─────────────────────────────────────────────────────────────
  // 7. AUTHENTIC CRYSTAL ESTATE OFFICE LOGO SIGNAGE (Main Facia)
  // Ratio of original logo (668 x 227) is 2.9427 : 1
  // ─────────────────────────────────────────────────────────────
  const signWidth = 36
  const signHeight = 11.5
  const logoWidth = 26.5
  const logoHeight = logoWidth / 2.9427 // ~9.0 units, preserving exact proportions

  // A. Architectural Signboard Backplate (Dark Bronze with Gold Trim)
  const signBackGeo = new THREE.BoxGeometry(signWidth, signHeight, 0.6)
  signBackGeo.translate(0, 18.2, 45.1)
  const signBack = new THREE.Mesh(signBackGeo, signBackplateMat)
  officeGroup.add(signBack)
  track(signBackGeo)

  // Gold Trim Border
  const signTrimGeo = new THREE.BoxGeometry(signWidth + 0.6, signHeight + 0.6, 0.3)
  signTrimGeo.translate(0, 18.2, 45.0)
  const signTrim = new THREE.Mesh(signTrimGeo, goldMat)
  officeGroup.add(signTrim)
  track(signTrimGeo)

  // B. Authentic Crystal Estate Logo Mesh
  const logoGeo = new THREE.PlaneGeometry(logoWidth, logoHeight)
  const logoMesh = new THREE.Mesh(logoGeo, logoSignMat)
  logoMesh.position.set(0, 18.7, 45.45)
  officeGroup.add(logoMesh)
  track(logoGeo)

  // C. Subtitle "SITE OFFICE & EXPERIENCE CENTRE" under logo
  const subTex = makeSubtitleTexture('SITE OFFICE & EXPERIENCE CENTRE', 512, 64)
  track(null, null, subTex)
  const subMat = new THREE.MeshBasicMaterial({ map: subTex, transparent: true })
  track(null, subMat)
  const subGeo = new THREE.PlaneGeometry(24, 2.8)
  const subMesh = new THREE.Mesh(subGeo, subMat)
  subMesh.position.set(0, 14.1, 45.45)
  officeGroup.add(subMesh)
  track(subGeo)

  // D. Physical Spotlight Fixtures on Sign
  const signLight1 = new THREE.PointLight('#fff3db', 1.6, 25)
  signLight1.position.set(-8, 22.5, 48)
  const signLight2 = new THREE.PointLight('#fff3db', 1.6, 25)
  signLight2.position.set(8, 22.5, 48)
  officeGroup.add(signLight1, signLight2)

  // ─────────────────────────────────────────────────────────────
  // 8. ENTRANCE DRIVEWAY MONUMENT TOTEM SIGN (With Actual Logo)
  // ─────────────────────────────────────────────────────────────
  const totemBaseGeo = new THREE.BoxGeometry(16, 1.4, 4.5)
  totemBaseGeo.translate(28, 0.7, 52)
  const totemBase = new THREE.Mesh(totemBaseGeo, graniteMat)
  totemBase.castShadow = !small
  officeGroup.add(totemBase)
  track(totemBaseGeo)

  const totemBodyGeo = new THREE.BoxGeometry(14, 9, 2.5)
  totemBodyGeo.translate(28, 5.5, 52)
  const totemBody = new THREE.Mesh(totemBodyGeo, signBackplateMat)
  totemBody.castShadow = !small
  officeGroup.add(totemBody)
  track(totemBodyGeo)

  // Totem Gold Trim
  const totemTrimGeo = new THREE.BoxGeometry(14.4, 9.4, 0.4)
  totemTrimGeo.translate(28, 5.5, 52)
  const totemTrim = new THREE.Mesh(totemTrimGeo, goldMat)
  officeGroup.add(totemTrim)
  track(totemTrimGeo)

  // Totem Logo Face
  const totemLogoGeo = new THREE.PlaneGeometry(12, 12 / 2.9427)
  const totemLogo = new THREE.Mesh(totemLogoGeo, logoSignMat)
  totemLogo.position.set(28, 6.5, 53.3)
  officeGroup.add(totemLogo)
  track(totemLogoGeo)

  // Totem Ground Uplight
  const totemLight = new THREE.PointLight('#ffe8b8', 1.5, 18)
  totemLight.position.set(28, 1.2, 55.5)
  officeGroup.add(totemLight)

  // ─────────────────────────────────────────────────────────────
  // 9. Landscaping & Site Elements Around Office
  // ─────────────────────────────────────────────────────────────
  // Manicured Box Hedges
  const hedgeGeo = new THREE.BoxGeometry(22, 2.2, 3)
  ;[-24, 24].forEach((hx) => {
    const h = new THREE.Mesh(hedgeGeo, hedgeMat)
    h.position.set(hx, 1.3, 26)
    h.castShadow = !small
    officeGroup.add(h)
  })
  track(hedgeGeo)

  // Palm trees flanking the entrance
  const palmTrunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 16, 7)
  palmTrunkGeo.translate(0, 8, 0)
  const palmCrownGeo = new THREE.ConeGeometry(4.8, 3.8, 6)
  palmCrownGeo.translate(0, 16.5, 0)

  const palmPositions = [
    { x: -38, z: 32 },
    { x: -44, z: 12 },
    { x: 38, z: 32 },
    { x: 44, z: 12 },
  ]
  palmPositions.forEach((pos) => {
    const trunk = new THREE.Mesh(palmTrunkGeo, bronzeMat)
    trunk.position.set(pos.x, 0, pos.z)
    trunk.castShadow = !small
    const crown = new THREE.Mesh(palmCrownGeo, hedgeMat)
    crown.position.set(pos.x, 0, pos.z)
    crown.castShadow = !small
    officeGroup.add(trunk, crown)
  })
  track(palmTrunkGeo)
  track(palmCrownGeo)

  // Flagpoles (Trio)
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 22, 8)
  poleGeo.translate(0, 11, 0)
  const flagGeo = new THREE.PlaneGeometry(5, 3)
  flagGeo.translate(2.5, 20, 0)
  const flagMat = new THREE.MeshBasicMaterial({ color: '#134e3a', side: THREE.DoubleSide })
  track(null, flagMat)

  ;[-12, -7, -2].forEach((fx, idx) => {
    const pole = new THREE.Mesh(poleGeo, bronzeMat)
    pole.position.set(fx - 28, 0, 44)
    const flag = new THREE.Mesh(flagGeo, idx === 1 ? goldMat : flagMat)
    flag.position.set(fx - 28, 0, 44)
    flag.rotation.y = 0.2
    officeGroup.add(pole, flag)
  })
  track(poleGeo)
  track(flagGeo)

  // Visitor Parking Bays with 2 Executive Vehicles
  const carBodyGeo = new THREE.BoxGeometry(18, 4.8, 8.5)
  carBodyGeo.translate(0, 2.8, 0)
  const carCabinGeo = new THREE.BoxGeometry(9.5, 3.8, 7.5)
  carCabinGeo.translate(-1, 7.1, 0)
  const carMat1 = new THREE.MeshStandardMaterial({ color: '#1a2228', metalness: 0.85, roughness: 0.2 })
  const carMat2 = new THREE.MeshStandardMaterial({ color: '#dfe3e8', metalness: 0.7, roughness: 0.3 })
  track(null, carMat1)
  track(null, carMat2)

  const car1 = new THREE.Group()
  car1.add(new THREE.Mesh(carBodyGeo, carMat1))
  car1.add(new THREE.Mesh(carCabinGeo, carMat1))
  car1.position.set(-52, 0, 36)
  car1.rotation.y = Math.PI / 2
  car1.scale.set(0.85, 0.85, 0.85)
  officeGroup.add(car1)

  const car2 = new THREE.Group()
  car2.add(new THREE.Mesh(carBodyGeo, carMat2))
  car2.add(new THREE.Mesh(carCabinGeo, carMat2))
  car2.position.set(-52, 0, 20)
  car2.rotation.y = Math.PI / 2
  car2.scale.set(0.85, 0.85, 0.85)
  officeGroup.add(car2)
  track(carBodyGeo)
  track(carCabinGeo)

  // Exterior Architectural Bollard Lights
  const bollardGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.5, 8)
  bollardGeo.translate(0, 1.25, 0)
  const bollardCapGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 8)
  bollardCapGeo.translate(0, 2.3, 0)
  ;[
    { x: -16, z: 42 },
    { x: 16, z: 42 },
    { x: -28, z: 32 },
    { x: 28, z: 32 },
  ].forEach((bp) => {
    const b = new THREE.Mesh(bollardGeo, bronzeMat)
    b.position.set(bp.x, 0, bp.z)
    const cap = new THREE.Mesh(bollardCapGeo, interiorGlowMat)
    cap.position.set(bp.x, 0, bp.z)
    officeGroup.add(b, cap)
  })
  track(bollardGeo)
  track(bollardCapGeo)

  const officeCenter = new THREE.Vector3(position.x, 18, position.z + 24)

  const dispose = () => {
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
    textures.forEach((t) => t.dispose())
    group.remove(officeGroup)
  }

  return { officeGroup, officeCenter, dispose }
}
