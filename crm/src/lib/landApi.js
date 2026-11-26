import { getApiUrl } from './api'
import { compressForUpload, plotDocumentProblem, sendMultipart } from './plotDocumentsApi'
import { listBrokers, createBroker, updateBroker, deleteBroker } from './brokersApi'

/**
 * Land purchase & management API. The session token is added by lib/authFetch.
 * Every call resolves to the parsed JSON or throws an Error with the server's
 * message, so screens can show it as is.
 */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(getApiUrl(`/api/land${path}`), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (HTTP ${res.status})`)
  return data
}
const q = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  return s.toString() ? `?${s}` : ''
}
const id = encodeURIComponent

/* Landowners / vendors and brokers */
// Brokers use the shared brokers API (leads, properties and land all use the same people)
export const listParties = (type) => (type === 'broker' ? listBrokers() : call(`/parties${q({ type })}`)).then((d) => ({ ...d, parties: d.parties || d.brokers }))
export const createParty = (party) => (party.type === 'broker' ? createBroker(party) : call('/parties', { method: 'POST', body: party }))
export const updateParty = (partyId, patch) => (patch.type === 'broker' ? updateBroker(partyId, patch) : call(`/parties/${id(partyId)}`, { method: 'PATCH', body: patch }))
export const deleteParty = (partyId, type) => (type === 'broker' ? deleteBroker(partyId) : call(`/parties/${id(partyId)}`, { method: 'DELETE' }))

/* Projects */
export const listProjects = () => call('/projects')
export const getProject = (projectId) => call(`/projects/${id(projectId)}`)
export const createProject = (project) => call('/projects', { method: 'POST', body: project })
export const updateProject = (projectId, patch) => call(`/projects/${id(projectId)}`, { method: 'PATCH', body: patch })
export const deleteProject = (projectId) => call(`/projects/${id(projectId)}`, { method: 'DELETE' })

/* Price log */
export const listPriceLog = (projectId) => call(`/projects/${id(projectId)}/price-log`)
export const addPriceEntry = (projectId, entry) => call(`/projects/${id(projectId)}/price-log`, { method: 'POST', body: entry })
export const updatePriceEntry = (entryId, patch) => call(`/price-log/${id(entryId)}`, { method: 'PATCH', body: patch })
export const deletePriceEntry = (entryId) => call(`/price-log/${id(entryId)}`, { method: 'DELETE' })

/* Plots */
export const listPlots = (projectId) => call(`/projects/${id(projectId)}/plots`)
export const createPlot = (projectId, plot) => call(`/projects/${id(projectId)}/plots`, { method: 'POST', body: plot })
export const createPlotsBulk = (projectId, spec) => call(`/projects/${id(projectId)}/plots/bulk`, { method: 'POST', body: spec })
export const getPlot = (plotId) => call(`/plots/${id(plotId)}`)
export const updatePlot = (plotId, patch) => call(`/plots/${id(plotId)}`, { method: 'PATCH', body: patch })
export const deletePlot = (plotId) => call(`/plots/${id(plotId)}`, { method: 'DELETE' })
export const addPlotNote = (plotId, note, target = 'plot') => call(`/plots/${id(plotId)}/notes`, { method: 'POST', body: { note, target } })
export const updatePlotNote = (noteId, note) => call(`/notes/${id(noteId)}`, { method: 'PATCH', body: { note } })
export const deletePlotNote = (noteId) => call(`/notes/${id(noteId)}`, { method: 'DELETE' })
export const listCustomers = (projectId) => call(`/projects/${id(projectId)}/customers`)

/* Customer payments */
export const listProjectPayments = (projectId) => call(`/projects/${id(projectId)}/payments`)
export const addPayment = (plotId, payment) => call(`/plots/${id(plotId)}/payments`, { method: 'POST', body: payment })
export const updatePayment = (paymentId, patch) => call(`/payments/${id(paymentId)}`, { method: 'PATCH', body: patch })
export const deletePayment = (paymentId) => call(`/payments/${id(paymentId)}`, { method: 'DELETE' })

/* Broker commission */
export const listCommissions = (projectId) => call(`/projects/${id(projectId)}/commissions`)
export const addCommissionPayment = (plotId, payment) => call(`/plots/${id(plotId)}/commission-payments`, { method: 'POST', body: payment })
export const updateCommissionPayment = (paymentId, patch) => call(`/commission-payments/${id(paymentId)}`, { method: 'PATCH', body: patch })
export const deleteCommissionPayment = (paymentId) => call(`/commission-payments/${id(paymentId)}`, { method: 'DELETE' })

/* Document log */
export const listLandDocuments = (projectId) => call(`/projects/${id(projectId)}/documents`)
export const updateLandDocument = (docId, patch) => call(`/documents/${id(docId)}`, { method: 'PATCH', body: patch })
export const deleteLandDocument = (docId) => call(`/documents/${id(docId)}`, { method: 'DELETE' })

const DOC_FIELDS = ['docType', 'title', 'refNo', 'docDate', 'status', 'heldBy', 'notes', 'plotId']

/** Create a log entry, with an optional file (images are compressed first). */
export async function createLandDocument(projectId, fields, file, { onProgress, onStage } = {}) {
  if (file) {
    const problem = plotDocumentProblem(file)
    if (problem) throw new Error(problem)
  }
  const form = new FormData()
  for (const k of DOC_FIELDS) if (fields[k] !== undefined && fields[k] !== null) form.append(k, fields[k])
  if (file) {
    onStage?.('Compressing…')
    const packed = await compressForUpload(file)
    form.append('originalName', file.name)
    form.append('originalSize', String(packed.originalSize))
    form.append('file', packed.file, packed.file.name)
  }
  onStage?.('Saving…')
  return sendMultipart('POST', `/api/land/projects/${id(projectId)}/documents`, form, onProgress)
}

export async function replaceLandDocumentFile(docId, file, { onProgress, onStage } = {}) {
  const problem = plotDocumentProblem(file)
  if (problem) throw new Error(problem)
  onStage?.('Compressing…')
  const packed = await compressForUpload(file)
  const form = new FormData()
  form.append('originalName', file.name)
  form.append('originalSize', String(packed.originalSize))
  form.append('file', packed.file, packed.file.name)
  onStage?.('Uploading…')
  return sendMultipart('PUT', `/api/land/documents/${id(docId)}/file`, form, onProgress)
}

/** Layout plan (reference drawing of a project) */
export async function uploadLayoutPlan(projectId, file, { onProgress, onStage } = {}) {
  const problem = plotDocumentProblem(file)
  if (problem) throw new Error(problem)
  onStage?.('Compressing…')
  const packed = await compressForUpload(file)
  const form = new FormData()
  form.append('file', packed.file, packed.file.name)
  onStage?.('Uploading…')
  return sendMultipart('POST', `/api/land/projects/${id(projectId)}/layout`, form, onProgress)
}
export const deleteLayoutPlan = (projectId) => call(`/projects/${id(projectId)}/layout`, { method: 'DELETE' })

/** Open a stored file through the signed-in API as a temporary object URL. */
async function blobUrl(path) {
  const res = await fetch(getApiUrl(`/api/land${path}`))
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Could not open the file (HTTP ${res.status})`)
  }
  return URL.createObjectURL(await res.blob())
}
export const landDocumentBlobUrl = (docId) => blobUrl(`/documents/${id(docId)}/file`)
export const layoutPlanBlobUrl = (projectId) => blobUrl(`/projects/${id(projectId)}/layout`)

export async function downloadBlobUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * Download an Excel workbook (built on the server with ExcelJS).
 * type: all | project | projects | plots | price-log | documents | payments | commissions | brokers | vendors | history
 */
export async function exportLandExcel({ type = 'all', projectId } = {}) {
  const res = await fetch(getApiUrl(`/api/land/export${q({ type, projectId })}`))
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Export failed (HTTP ${res.status})`)
  }
  const disposition = res.headers.get('content-disposition') || ''
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition) || /filename="([^"]+)"/i.exec(disposition)
  const filename = match ? decodeURIComponent(match[1]) : `Land-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`
  await downloadBlobUrl(URL.createObjectURL(await res.blob()), filename)
  return filename
}
