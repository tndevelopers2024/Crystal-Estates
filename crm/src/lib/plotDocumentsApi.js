import { getApiUrl } from './api'
import { readToken } from './authFetch'

/**
 * Plot documents (stored privately on the server, see server/src/routes/plotDocuments.js).
 * Files are opened through the signed-in API, never through a public URL.
 */
export const PLOT_DOC_MAX_MB = 15
export const PLOT_DOC_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png'
const OK_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png' }
const OK_EXT = /\.(pdf|jpe?g|png)$/i

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(getApiUrl(path), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (HTTP ${res.status})`)
  return data
}

export const listPlotDocuments = ({ propertyId, plotUid, plotNo, phase }) =>
  call(`/api/plot-documents?${new URLSearchParams({ propertyId, plotUid: plotUid || '', plotNo: plotNo || '', phase: phase || '' })}`)
export const renamePlotDocument = (id, label) => call(`/api/plot-documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: { label } })
export const deletePlotDocument = (id) => call(`/api/plot-documents/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** Returns an error message, or null if the file can be uploaded. */
export function plotDocumentProblem(file) {
  if (!file) return 'Choose a file.'
  if (!OK_TYPES[file.type] && !OK_EXT.test(file.name)) return `“${file.name}” is not a PDF, JPG or PNG file.`
  if (file.size > PLOT_DOC_MAX_MB * 1024 * 1024) return `“${file.name}” is larger than ${PLOT_DOC_MAX_MB} MB.`
  if (file.size === 0) return `“${file.name}” is empty.`
  return null
}

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable image'))
    }
    img.src = url
  })

/**
 * Shrink photos and scans before upload while keeping text legible:
 * longest side capped at 2560 px, JPEG quality 0.85 (PNG becomes JPEG only
 * when that is clearly smaller). PDFs are sent as-is; the server compresses
 * them losslessly. The original is kept whenever compression doesn't help.
 */
export async function compressForUpload(file) {
  const isImage = /^image\/(jpe?g|png)$/i.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)
  if (!isImage || typeof document === 'undefined') return { file, originalSize: file.size }
  try {
    const { img, url } = await loadImage(file)
    const MAX = 2560
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff' // transparent PNG areas become white, not black
    ctx.fillRect(0, 0, w, h)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name)
    const worth = blob && blob.size < file.size * (isPng ? 0.8 : 0.95)
    if (!worth) return { file, originalSize: file.size }
    const name = file.name.replace(/\.(jpe?g|png)$/i, '') + '.jpg'
    return { file: new File([blob], name, { type: 'image/jpeg' }), originalSize: file.size }
  } catch {
    return { file, originalSize: file.size }
  }
}

/** multipart upload with progress (XHR: fetch has no upload progress). */
function send(method, path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, getApiUrl(path))
    const token = readToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let data = {}
      try {
        data = JSON.parse(xhr.responseText || '{}')
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.success !== false) resolve(data)
      else reject(new Error(data.error || (xhr.status === 401 ? 'Your session has ended. Sign in again.' : `Upload failed (HTTP ${xhr.status})`)))
    }
    xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'))
    xhr.send(form)
  })
}

export async function uploadPlotDocument({ propertyId, plotUid, plotNo, phase, label, file, onProgress, onStage }) {
  onStage?.('Compressing…')
  const packed = await compressForUpload(file)
  onStage?.('Uploading…')
  const form = new FormData()
  form.append('propertyId', propertyId)
  form.append('plotUid', plotUid || '')
  form.append('plotNo', plotNo || '')
  form.append('phase', phase || '')
  form.append('label', label)
  form.append('originalName', file.name)
  form.append('originalSize', String(packed.originalSize))
  form.append('file', packed.file, packed.file.name)
  return send('POST', '/api/plot-documents', form, onProgress)
}

export async function replacePlotDocument(id, file, { onProgress, onStage } = {}) {
  onStage?.('Compressing…')
  const packed = await compressForUpload(file)
  onStage?.('Uploading…')
  const form = new FormData()
  form.append('originalName', file.name)
  form.append('originalSize', String(packed.originalSize))
  form.append('file', packed.file, packed.file.name)
  return send('PUT', `/api/plot-documents/${encodeURIComponent(id)}/file`, form, onProgress)
}

/** Fetch the file with the session token and return a temporary object URL. */
export async function plotDocumentBlobUrl(id) {
  const res = await fetch(getApiUrl(`/api/plot-documents/${encodeURIComponent(id)}/file`))
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Could not open the document (HTTP ${res.status})`)
  }
  return URL.createObjectURL(await res.blob())
}

export async function downloadPlotDocument(doc) {
  const url = await plotDocumentBlobUrl(doc.id)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const formatBytes = (n) => {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`
  return `${(v / 1024 / 1024).toFixed(1)} MB`
}

/* ── Sending documents (WhatsApp / email) ───────────────────────── */

/** Which channels the server can really send through, with a reason when not. */
export const fetchShareConfig = () => call('/api/document-shares/config')

/** Customers registered for a plot (booking, paying leads, leads for the plot). */
export const fetchPlotRecipients = ({ propertyId, plotUid, plotNo, phase }) =>
  call(`/api/document-shares/recipients?${new URLSearchParams({ propertyId, plotUid: plotUid || '', plotNo: plotNo || '', phase: phase || '' })}`)

/**
 * Send documents. recipient: { type: 'lead', leadId } | { type: 'booking' }.
 * idempotencyKey makes repeats safe (e.g. `payment:<id>`).
 * Resolves to { results: [{ channel, status, error, to, duplicate }] }.
 */
export const sendPlotDocuments = (body) => call('/api/document-shares', { method: 'POST', body })

export const fetchShareHistory = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
  return call(`/api/document-shares?${q}`)
}

/** A random key for one user action (send click, payment form). */
export const newRequestKey = (prefix = 'req') =>
  `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
