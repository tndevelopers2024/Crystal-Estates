/**
 * Safely parse a viewBox string into valid numeric dimensions.
 * Handles comma-separated, space-separated, negative coordinates, and malformed strings.
 * Never returns NaN or zero/negative dimensions.
 *
 * @param {string} vbStr - e.g. "0, 0, 1056, 816", "0 0 2245.46 1588.21", "-50 -20 1200 900"
 * @param {number} defaultW - Fallback width
 * @param {number} defaultH - Fallback height
 * @returns {{ minX: number, minY: number, width: number, height: number, viewBoxStr: string }}
 */
export function parseViewBox(vbStr, defaultW = 1056, defaultH = 816) {
  if (!vbStr || typeof vbStr !== 'string') {
    return {
      minX: 0,
      minY: 0,
      width: defaultW,
      height: defaultH,
      viewBoxStr: `0 0 ${defaultW} ${defaultH}`,
    }
  }

  const cleaned = vbStr.trim().replace(/,/g, ' ')
  const nums = cleaned
    .split(/\s+/)
    .map(Number)
    .filter((n) => !isNaN(n))

  if (nums.length >= 4) {
    const minX = nums[0]
    const minY = nums[1]
    const width = nums[2] > 0 ? nums[2] : defaultW
    const height = nums[3] > 0 ? nums[3] : defaultH
    return {
      minX,
      minY,
      width,
      height,
      viewBoxStr: `${minX} ${minY} ${width} ${height}`,
    }
  }

  return {
    minX: 0,
    minY: 0,
    width: defaultW,
    height: defaultH,
    viewBoxStr: `0 0 ${defaultW} ${defaultH}`,
  }
}

/**
 * Extract only the numeric plot number for on-map rendering, stripping
 * trailing letters, side descriptions, or parenthetical notes.
 * Keeps Roman numerals or non-numeric identifiers intact when no digits exist.
 */
export function formatPlotNumberOnly(plotNo) {
  const raw = String(plotNo ?? '').trim()
  if (!raw) return ''
  const match = raw.match(/^(?:plot\s*(?:no\.?\s*)?)?(\d+)/i)
  return match ? match[1] : raw
}
