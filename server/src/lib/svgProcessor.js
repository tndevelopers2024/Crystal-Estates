/**
 * Robust SVG Normalizer, Validator, and Dimension Extractor for Crystal Estates.
 *
 * Handles SVG files from diverse CAD, GIS, Illustrator, Inkscape, and manual sources:
 * - Validates root <svg> tags and well-formedness
 * - Robustly parses viewBox with commas, spaces, scientific notation, and negative offsets
 * - Extracts and converts width/height units (px, pt, mm, cm, in)
 * - Injects missing viewBox computed from width/height or element coordinates
 * - Ensures standard XML namespaces (xmlns, xmlns:xlink) required by browsers for <img> rendering
 * - Normalizes unescaped XML entities (e.g. bare & in labels)
 * - Safely strips <script> tags for security without modifying any geometry, paths, styles, or labels
 */

/**
 * Convert CSS/SVG length with unit to pixels
 * Standard web conversion: 96 dpi (1 in = 96px, 1 pt = 1.3333px, 1 mm = 3.7795px, 1 cm = 37.795px)
 */
export function convertUnitToPx(valStr, fallback = 1056) {
  if (!valStr || typeof valStr !== 'string') return fallback
  const trimmed = valStr.trim()
  const match = trimmed.match(/^([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s*(px|pt|mm|cm|in|%)?$/i)
  if (!match) return fallback

  const num = parseFloat(match[1])
  if (isNaN(num)) return fallback

  const unit = (match[2] || 'px').toLowerCase()
  switch (unit) {
    case 'pt':
      return Math.round(num * (96 / 72) * 100) / 100
    case 'mm':
      return Math.round(num * (96 / 25.4) * 100) / 100
    case 'cm':
      return Math.round(num * (96 / 2.54) * 100) / 100
    case 'in':
      return Math.round(num * 96 * 100) / 100
    case '%':
      return fallback // percentage cannot be converted without viewport
    case 'px':
    default:
      return num
  }
}

/**
 * Safely parse a viewBox string into numeric values.
 * Handles: "0, 0, 1000, 800", "0 0 1000 800", "0,0,1000,800", "-50 -20 1200 900"
 */
export function parseViewBoxValues(vbStr) {
  if (!vbStr || typeof vbStr !== 'string') return null
  const cleaned = vbStr.trim().replace(/,/g, ' ')
  const nums = cleaned.split(/\s+/).map(Number).filter((n) => !isNaN(n))
  if (nums.length >= 4) {
    const [minX, minY, width, height] = nums
    if (width > 0 && height > 0) {
      return {
        minX,
        minY,
        width,
        height,
        formatted: `${minX} ${minY} ${width} ${height}`,
      }
    }
  }
  return null
}

/**
 * Scan SVG content for coordinate boundaries if both viewBox and width/height are missing
 */
function scanElementCoordinates(svgContent) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  // 1. Scan rects: x, y, width, height
  const rectMatches = svgContent.matchAll(/<rect[^>]+>/gi)
  for (const m of rectMatches) {
    const tag = m[0]
    const x = parseFloat(tag.match(/\bx=["']([-0-9.]+)/i)?.[1] || 0)
    const y = parseFloat(tag.match(/\by=["']([-0-9.]+)/i)?.[1] || 0)
    const w = parseFloat(tag.match(/\bwidth=["']([-0-9.]+)/i)?.[1] || 0)
    const h = parseFloat(tag.match(/\bheight=["']([-0-9.]+)/i)?.[1] || 0)
    if (w > 0 && h > 0) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x + w > maxX) maxX = x + w
      if (y + h > maxY) maxY = y + h
    }
  }

  // 2. Scan path coordinates (first 500 coordinates to keep performance blazing fast)
  const pathMatches = svgContent.matchAll(/<path[^>]+d=["']([^"']+)["']/gi)
  let count = 0
  for (const pm of pathMatches) {
    if (count > 500) break
    const d = pm[1]
    const nums = d.match(/[-+]?(?:\d*\.\d+|\d+)/g)
    if (nums) {
      for (let i = 0; i < nums.length - 1; i += 2) {
        const x = parseFloat(nums[i])
        const y = parseFloat(nums[i + 1])
        if (!isNaN(x) && !isNaN(y)) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
        count++
        if (count > 500) break
      }
    }
  }

  if (minX !== Infinity && maxX !== -Infinity && maxX > minX && maxY > minY) {
    const pad = 20
    const finalMinX = Math.floor(minX - pad)
    const finalMinY = Math.floor(minY - pad)
    const finalW = Math.ceil(maxX - minX + pad * 2)
    const finalH = Math.ceil(maxY - minY + pad * 2)
    return {
      minX: finalMinX,
      minY: finalMinY,
      width: finalW,
      height: finalH,
      formatted: `${finalMinX} ${finalMinY} ${finalW} ${finalH}`,
    }
  }

  return null
}

/**
 * Validates and normalizes an SVG file buffer or string.
 *
 * @param {Buffer|string} input - Raw SVG buffer or string
 * @returns {{
 *   valid: boolean,
 *   error?: string,
 *   normalizedBuffer?: Buffer,
 *   normalizedSvg?: string,
 *   viewBox?: string,
 *   minX?: number,
 *   minY?: number,
 *   width?: number,
 *   height?: number,
 *   sizeBytes?: number
 * }}
 */
export function normalizeAndValidateSvg(input) {
  if (!input) {
    return { valid: false, error: 'No SVG content provided.' }
  }

  let svgText = ''
  if (Buffer.isBuffer(input)) {
    // Strip BOM if present
    if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
      svgText = input.subarray(3).toString('utf-8')
    } else {
      svgText = input.toString('utf-8')
    }
  } else if (typeof input === 'string') {
    svgText = input.replace(/^\uFEFF/, '')
  } else {
    return { valid: false, error: 'Invalid input type for SVG processing.' }
  }

  // 1. Check for root <svg tag
  const svgOpenMatch = svgText.match(/<svg\b([^>]*)>/i)
  if (!svgOpenMatch) {
    return {
      valid: false,
      error: 'Invalid SVG file: root <svg> element not found. Please ensure the file is an SVG vector layout.',
    }
  }

  const svgCloseMatch = svgText.match(/<\/svg\s*>/i)
  if (!svgCloseMatch) {
    // Attempt auto-closing if file was truncated right before </svg>
    svgText += '\n</svg>'
  }

  const rawAttrs = svgOpenMatch[1] || ''

  // 2. Parse viewBox
  let parsedVb = null
  const vbMatch = rawAttrs.match(/\bviewBox=["']([^"']+)["']/i)
  if (vbMatch && vbMatch[1]) {
    parsedVb = parseViewBoxValues(vbMatch[1])
  }

  // 3. Parse width & height
  let widthVal = null
  let heightVal = null
  const wMatch = rawAttrs.match(/\bwidth=["']([^"']+)["']/i)
  const hMatch = rawAttrs.match(/\bheight=["']([^"']+)["']/i)
  if (wMatch && wMatch[1]) {
    widthVal = convertUnitToPx(wMatch[1], null)
  }
  if (hMatch && hMatch[1]) {
    heightVal = convertUnitToPx(hMatch[1], null)
  }

  // 4. Resolve final coordinates
  let finalMinX = 0
  let finalMinY = 0
  let finalWidth = 1056
  let finalHeight = 816
  let finalViewBox = '0 0 1056 816'

  if (parsedVb) {
    finalMinX = parsedVb.minX
    finalMinY = parsedVb.minY
    finalWidth = parsedVb.width
    finalHeight = parsedVb.height
    finalViewBox = parsedVb.formatted
  } else if (widthVal && heightVal && widthVal > 0 && heightVal > 0) {
    finalMinX = 0
    finalMinY = 0
    finalWidth = widthVal
    finalHeight = heightVal
    finalViewBox = `0 0 ${widthVal} ${heightVal}`
  } else {
    // Scan element coordinates
    const scanned = scanElementCoordinates(svgText)
    if (scanned) {
      finalMinX = scanned.minX
      finalMinY = scanned.minY
      finalWidth = scanned.width
      finalHeight = scanned.height
      finalViewBox = scanned.formatted
    }
  }

  // 5. Build clean, browser-compatible root <svg> attributes
  let newAttrs = rawAttrs

  // Remove existing viewBox, width, height to rewrite cleanly
  newAttrs = newAttrs
    .replace(/\bviewBox=["'][^"']*["']/gi, '')
    .replace(/\bwidth=["'][^"']*["']/gi, '')
    .replace(/\bheight=["'][^"']*["']/gi, '')
    .trim()

  // Ensure xmlns is present
  if (!/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(newAttrs)) {
    newAttrs = newAttrs.replace(/\bxmlns=["'][^"']*["']/gi, '').trim()
    newAttrs += ' xmlns="http://www.w3.org/2000/svg"'
  }

  // Ensure xmlns:xlink is present if xlink: is used anywhere
  if (/xlink:[a-z]/i.test(svgText)) {
    if (!/xmlns:xlink=["']http:\/\/www\.w3\.org\/1999\/xlink["']/i.test(newAttrs)) {
      newAttrs += ' xmlns:xlink="http://www.w3.org/1999/xlink"'
    }
  }

  // Inject normalized viewBox and standard width/height
  newAttrs = `viewBox="${finalViewBox}" width="${finalWidth}" height="${finalHeight}" ${newAttrs}`.trim()
  newAttrs = newAttrs.replace(/\s+/g, ' ')

  // Replace old <svg ...> tag with normalized <svg ...>
  let normalizedSvg = svgText.replace(/<svg\b[^>]*>/i, `<svg ${newAttrs}>`)

  // 6. Security & Stability: Remove unsafe <script> elements
  normalizedSvg = normalizedSvg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  normalizedSvg = normalizedSvg.replace(/<script\b[^>]*\/>/gi, '')
  // Strip inline JavaScript handlers like onload="..." or onerror="..."
  normalizedSvg = normalizedSvg.replace(/\s+on[a-z]+=["'][^"']*["']/gi, '')

  // 7. Fix bare '&' in text content (escapes & to &amp; where not part of valid entity)
  normalizedSvg = normalizedSvg.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')

  const normalizedBuffer = Buffer.from(normalizedSvg, 'utf-8')

  return {
    valid: true,
    normalizedBuffer,
    normalizedSvg,
    viewBox: finalViewBox,
    minX: finalMinX,
    minY: finalMinY,
    width: Math.round(finalWidth * 100) / 100,
    height: Math.round(finalHeight * 100) / 100,
    sizeBytes: normalizedBuffer.length,
    originalSizeBytes: Buffer.isBuffer(input) ? input.length : Buffer.byteLength(input, 'utf-8'),
  }
}
