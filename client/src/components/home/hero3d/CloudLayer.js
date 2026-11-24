import * as THREE from 'three'

/**
 * Procedural volumetric-style cloud layers for high-altitude aerial view.
 * Creates realistic, soft, billowy cloud formations that drift gently
 * across the sky above Crystal Estate.
 */

function createCloudTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Texture()

  ctx.clearRect(0, 0, size, size)

  // Composite multiple soft radial puffs to form a natural, irregular cloud texture
  const puffs = [
    { x: 0.50, y: 0.50, r: 0.38, a: 0.55 },
    { x: 0.35, y: 0.48, r: 0.30, a: 0.45 },
    { x: 0.65, y: 0.49, r: 0.32, a: 0.48 },
    { x: 0.42, y: 0.36, r: 0.26, a: 0.40 },
    { x: 0.58, y: 0.38, r: 0.28, a: 0.42 },
    { x: 0.30, y: 0.60, r: 0.24, a: 0.35 },
    { x: 0.70, y: 0.58, r: 0.25, a: 0.38 },
    { x: 0.48, y: 0.62, r: 0.28, a: 0.40 },
    { x: 0.50, y: 0.45, r: 0.45, a: 0.30 },
  ]

  for (const p of puffs) {
    const cx = p.x * size
    const cy = p.y * size
    const cr = p.r * size
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr)
    grad.addColorStop(0, `rgba(255, 255, 255, ${p.a})`)
    grad.addColorStop(0.4, `rgba(248, 250, 252, ${p.a * 0.75})`)
    grad.addColorStop(0.7, `rgba(238, 244, 248, ${p.a * 0.3})`)
    grad.addColorStop(1, 'rgba(230, 240, 248, 0)')

    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, cr, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

export function buildCloudLayer({ scene, span = 2200, small = false }) {
  const group = new THREE.Group()
  group.name = 'hero-clouds'
  scene.add(group)

  const cloudTex = createCloudTexture()
  const cloudMat = new THREE.MeshLambertMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    color: '#ffffff',
    side: THREE.DoubleSide,
  })

  // Two cloud tiers:
  // Tier 1: High scattered cirrocumulus layer (Y: 1700 - 2100)
  // Tier 2: Mid-altitude fluffy cumulus deck (Y: 1100 - 1500)
  const count = small ? 24 : 48
  const cloudGeo = new THREE.PlaneGeometry(1, 1)

  const clouds = []
  const instMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, count)
  instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  group.add(instMesh)

  const dummy = new THREE.Object3D()
  const col = new THREE.Color()

  for (let i = 0; i < count; i += 1) {
    const isHigh = i < count * 0.4
    const rad = (Math.random() * 0.85 + 0.15) * span * 1.6
    const angle = Math.random() * Math.PI * 2

    const x = Math.cos(angle) * rad
    const z = Math.sin(angle) * rad
    const y = isHigh ? 1650 + Math.random() * 350 : 1100 + Math.random() * 400

    const scaleW = (isHigh ? 900 : 750) + Math.random() * 600
    const scaleH = scaleW * (0.65 + Math.random() * 0.3)
    const rotZ = (Math.random() - 0.5) * 0.4
    const speed = (0.015 + Math.random() * 0.02) * (Math.random() < 0.5 ? 1 : -1)

    clouds.push({
      x,
      y,
      z,
      baseY: y,
      scaleW,
      scaleH,
      rotZ,
      speed,
      phase: Math.random() * Math.PI * 2,
    })

    dummy.position.set(x, y, z)
    dummy.rotation.set(-Math.PI / 2, 0, rotZ)
    dummy.scale.set(scaleW, scaleH, 1)
    dummy.updateMatrix()
    instMesh.setMatrixAt(i, dummy.matrix)

    // Slight sunlight / sky hue variation
    const brightness = isHigh ? 0.98 : 0.94 + Math.random() * 0.06
    col.setScalar(brightness)
    if (Math.random() > 0.5) col.add(new THREE.Color('#fff9eb').multiplyScalar(0.04))
    instMesh.setColorAt(i, col)
  }

  instMesh.instanceMatrix.needsUpdate = true
  if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true

  const update = (time, camY = 2500) => {
    // Opacity fades out smoothly as camera drops below the cloud layer
    // When camera is down at plot level (Y < 600), clouds soften to avoid blocking ground view
    const altitudeFade = Math.min(1, Math.max(0.12, (camY - 450) / 750))
    cloudMat.opacity = 0.86 * altitudeFade

    for (let i = 0; i < count; i += 1) {
      const c = clouds[i]
      const driftX = c.x + Math.sin(time * 0.1 + c.phase) * 35
      const driftZ = c.z + Math.cos(time * 0.08 + c.phase) * 25
      const driftY = c.baseY + Math.sin(time * 0.2 + c.phase) * 8

      dummy.position.set(driftX, driftY, driftZ)
      dummy.rotation.set(-Math.PI / 2, 0, c.rotZ + time * c.speed * 0.1)
      dummy.scale.set(c.scaleW, c.scaleH, 1)
      dummy.updateMatrix()
      instMesh.setMatrixAt(i, dummy.matrix)
    }
    instMesh.instanceMatrix.needsUpdate = true
  }

  const dispose = () => {
    cloudGeo.dispose()
    cloudMat.dispose()
    cloudTex.dispose()
    scene.remove(group)
  }

  return { group, update, dispose }
}
