const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

export function getApiUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${cleanPath}`
}

/**
 * Resolve client website URL (Next.js frontend)
 * Reads VITE_CLIENT_URL / VITE_WEBSITE_URL, or defaults to production Vercel frontend or localhost:3000
 */
export function getClientUrl(path = '') {
  let base = (import.meta.env.VITE_CLIENT_URL || import.meta.env.VITE_WEBSITE_URL || '').replace(/\/$/, '')
  if (!base) {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      // If deployed on Vercel without VITE_CLIENT_URL, derive default web frontend domain by stripping -crm
      // e.g. https://crystal-estates-crm.vercel.app -> https://crystal-estates.vercel.app
      base = window.location.origin.replace(/-crm(?=\.|$)/, '')
    } else {
      base = 'http://localhost:3000'
    }
  }
  if (!path) return base
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}

/**
 * Upload single image to backend
 */
export async function uploadPlotImage(file) {
  const formData = new FormData()
  formData.append('image', file)

  const res = await fetch(getApiUrl('/api/upload/image'), {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Upload failed: HTTP ${res.status}`)
  }

  return await res.json()
}

/**
 * Upload property document (PDF, DOC, Patta, etc.) to backend
 */
export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('document', file)

  const res = await fetch(getApiUrl('/api/upload/document'), {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Document upload failed: HTTP ${res.status}`)
  }

  return await res.json()
}

/**
 * Upload drone or site video to backend
 */
export async function uploadVideo(file) {
  const formData = new FormData()
  formData.append('video', file)

  const res = await fetch(getApiUrl('/api/upload/video'), {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Video upload failed: HTTP ${res.status}`)
  }

  return await res.json()
}

/**
 * Upload layout blueprint file of any format (PDF, CAD, SVG, image, doc) directly without conversion
 */
export async function uploadLayoutFile(file, projectName = '') {
  const formData = new FormData()
  formData.append('layoutFile', file)
  if (projectName) {
    formData.append('projectName', projectName)
  }

  const res = await fetch(getApiUrl('/api/upload/layout-file'), {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Layout file upload failed: HTTP ${res.status}`)
  }

  return await res.json()
}

/**
 * Upload converted SVG layout to backend
 */
export async function uploadLayoutSvg({ svgContent, layoutSlug, projectName, viewBox, width, height }) {
  const res = await fetch(getApiUrl('/api/upload/layout-svg'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      svgContent,
      layoutSlug,
      projectName,
      viewBox,
      width,
      height,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Layout SVG upload failed: HTTP ${res.status}`)
  }

  return await res.json()
}

/**
 * Fetch all plots from backend
 */
export async function fetchPlots() {
  const res = await fetch(getApiUrl('/api/plots'))
  if (!res.ok) throw new Error(`Failed to load plots: HTTP ${res.status}`)
  return await res.json()
}

/**
 * Save new plot to database
 */
export async function createPlot(plotData) {
  const res = await fetch(getApiUrl('/api/plots'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(plotData),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to create plot: HTTP ${res.status}`)
  }

  return await res.json()
}

/**
 * Update existing plot in database
 */
export async function updatePlot(id, updates) {
  const res = await fetch(getApiUrl(`/api/plots/${id}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to update plot: HTTP ${res.status}`)
  }

  return await res.json()
}

/**
 * Delete plot
 */
export async function deletePlot(id) {
  const res = await fetch(getApiUrl(`/api/plots/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`)
  return await res.json()
}

/**
 * Fetch all leads from MongoDB API
 */
export async function fetchLeads() {
  const res = await fetch(getApiUrl('/api/leads'))
  if (!res.ok) throw new Error(`Failed to fetch leads: HTTP ${res.status}`)
  return await res.json()
}

/**
 * Create a new lead in MongoDB
 */
export async function createLead(leadData) {
  const res = await fetch(getApiUrl('/api/leads'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(leadData),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to create lead: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Update a lead stage, agent, advance, or notes in MongoDB
 */
export async function updateLead(id, updates) {
  const res = await fetch(getApiUrl(`/api/leads/${id}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to update lead: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Delete a lead from MongoDB
 */
export async function deleteLead(id) {
  const res = await fetch(getApiUrl(`/api/leads/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to delete lead: HTTP ${res.status}`)
  return await res.json()
}

/**
 * Record an advance payment for a lead (creates payment record in MongoDB)
 */
export async function recordLeadPayment(id, paymentData) {
  const res = await fetch(getApiUrl(`/api/leads/${id}/payments`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(paymentData),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to record payment: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Schedule a follow-up for a lead in MongoDB
 */
export async function scheduleLeadFollowUp(id, followUpData) {
  const res = await fetch(getApiUrl(`/api/leads/${id}/followups`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(followUpData),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to schedule follow-up: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Toggle completion of a follow-up item
 */
export async function toggleLeadFollowUp(id, fuId) {
  const res = await fetch(getApiUrl(`/api/leads/${id}/followups/${fuId}/toggle`), {
    method: 'PATCH',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to toggle follow-up: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Add a quick note to a lead and record in activity timeline
 */
export async function addLeadNote(id, note) {
  const res = await fetch(getApiUrl(`/api/leads/${id}/notes`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ note }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to add note: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Fetch dynamic lead metadata (projects, agents, sources, stages, payment options)
 */
export async function fetchLeadsMeta() {
  const res = await fetch(getApiUrl('/api/leads/meta'))
  if (!res.ok) throw new Error('Failed to load lead metadata')
  return await res.json()
}

/**
 * Fetch all payments recorded across all leads
 */
export async function fetchAllPayments() {
  const res = await fetch(getApiUrl('/api/leads/payments/all'))
  if (!res.ok) throw new Error('Failed to load payments')
  return await res.json()
}

/**
 * Authentication: Login
 */
export async function loginUser(email, password) {
  const res = await fetch(getApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Login failed. Please check your credentials.')
  }
  return data
}

/**
 * Authentication: Request password reset
 */
export async function forgotPasswordUser(email) {
  const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send reset link.')
  }
  return data
}

/**
 * Authentication: Reset password
 */
export async function resetPasswordUser({ email, resetToken, otp, newPassword }) {
  const res = await fetch(getApiUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, resetToken, otp, newPassword }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset password.')
  }
  return data
}

/**
 * Authentication: Fetch current user
 */
export async function fetchCurrentUser(token) {
  const res = await fetch(getApiUrl('/api/auth/me'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error('Session invalid')
  return await res.json()
}

/**
 * Layout & Plot Management APIs
 */
export async function fetchLayoutDetails(slug) {
  const res = await fetch(getApiUrl(`/api/plots/layout/${slug}`))
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to fetch layout: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function saveLayoutPlots(slug, plots) {
  const res = await fetch(getApiUrl(`/api/plots/layout/${slug}/plots`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plots }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to save layout plots: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function addOrUpdateLayoutPlot(slug, plotData) {
  const res = await fetch(getApiUrl(`/api/plots/layout/${slug}/plot`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plotData),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to save plot: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function deleteLayoutPlot(slug, plotNo) {
  const res = await fetch(getApiUrl(`/api/plots/layout/${slug}/plot/${plotNo}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to delete plot: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Site Visits APIs
 */
export async function fetchSiteVisits() {
  const res = await fetch(getApiUrl('/api/visits'))
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to load site visits: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function createSiteVisit(visitData) {
  const res = await fetch(getApiUrl('/api/visits'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(visitData),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to schedule site visit: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function updateSiteVisit(id, updates) {
  const res = await fetch(getApiUrl(`/api/visits/${id}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to update site visit: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function deleteSiteVisit(id) {
  const res = await fetch(getApiUrl(`/api/visits/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to delete site visit: HTTP ${res.status}`)
  }
  return await res.json()
}



/**
 * Plot activity log (bookings, payments, every plot change)
 */
export async function fetchPlotActivity({ propertyId, plotUid, plotNo, phase, limit } = {}) {
  const params = new URLSearchParams()
  if (propertyId) params.set('propertyId', propertyId)
  if (plotUid) params.set('plotUid', plotUid)
  if (plotNo) params.set('plotNo', plotNo)
  if (phase) params.set('phase', phase)
  if (limit) params.set('limit', String(limit))
  const res = await fetch(getApiUrl(`/api/plot-activity?${params.toString()}`))
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to load plot history: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function addPlotActivity(entry) {
  const res = await fetch(getApiUrl('/api/plot-activity'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to save entry: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function fetchPlotBookings(propertyId) {
  const res = await fetch(getApiUrl(`/api/plot-activity/bookings?propertyId=${encodeURIComponent(propertyId)}`))
  if (!res.ok) throw new Error(`Failed to load bookings: HTTP ${res.status}`)
  return await res.json()
}

export async function savePlotBooking(entry) {
  const res = await fetch(getApiUrl('/api/plot-activity/booking'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to save booking: HTTP ${res.status}`)
  }
  return await res.json()
}

/**
 * Editable dropdown option lists (payment types, modes, document types)
 */
export async function fetchOptions(list) {
  const res = await fetch(getApiUrl(`/api/crm-options/${encodeURIComponent(list)}`))
  if (!res.ok) throw new Error(`Failed to load options: HTTP ${res.status}`)
  return await res.json()
}

export async function addOption(list, value) {
  const res = await fetch(getApiUrl(`/api/crm-options/${encodeURIComponent(list)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Failed to add option: HTTP ${res.status}`)
  return data
}

export async function deleteOption(list, value) {
  const res = await fetch(getApiUrl(`/api/crm-options/${encodeURIComponent(list)}`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Failed to delete option: HTTP ${res.status}`)
  return data
}

/**
 * Payments (beyond recordLeadPayment / fetchAllPayments)
 */
/** Correct a recorded lead payment (amount, date, mode, reference, status, note). */
export async function updateLeadPayment(paymentId, patch) {
  const res = await fetch(getApiUrl(`/api/leads/payments/${encodeURIComponent(paymentId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Failed to update the payment: HTTP ${res.status}`)
  return data
}

/** Correct or remove a payment or note entered on a plot's history. */
export async function updatePlotEntry(entryId, patch) {
  const res = await fetch(getApiUrl(`/api/plot-activity/${encodeURIComponent(entryId)}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Failed to update the entry: HTTP ${res.status}`)
  return data
}
export async function deletePlotEntry(entryId, actor) {
  const res = await fetch(getApiUrl(`/api/plot-activity/${encodeURIComponent(entryId)}`), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Failed to delete the entry: HTTP ${res.status}`)
  return data
}

export async function deletePayment(paymentId) {
  const res = await fetch(getApiUrl(`/api/leads/payments/${encodeURIComponent(paymentId)}`), { method: 'DELETE' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Failed to delete payment: HTTP ${res.status}`)
  return data
}

/** A 404 "Route not found" means the API server is an older build without this feature. */
function apiError(res, data, fallback) {
  if (res.status === 404 && /route not found/i.test(String(data?.error || ''))) {
    return new Error('This feature needs the latest API server. Please redeploy the server and try again.')
  }
  return new Error(data?.error || `${fallback}: HTTP ${res.status}`)
}

/**
 * Customer documents (receipts, booking confirmations, statements, uploads)
 */
export async function fetchDocuments(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  const res = await fetch(getApiUrl(`/api/documents?${params.toString()}`))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 404 && /route not found/i.test(String(data?.error || ''))) {
      return { success: true, documents: [], serverNeedsUpdate: true }
    }
    throw apiError(res, data, 'Failed to load documents')
  }
  return data
}

export async function renderDocumentPreview(draft) {
  const res = await fetch(getApiUrl('/api/documents/render'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw apiError(res, data, 'Preview failed')
  return data
}

export async function createDocument(draft) {
  const res = await fetch(getApiUrl('/api/documents'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw apiError(res, data, 'Could not create document')
  return data
}

export async function deleteDocument(id) {
  const res = await fetch(getApiUrl(`/api/documents/${encodeURIComponent(id)}`), { method: 'DELETE' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw apiError(res, data, 'Failed to delete document')
  return data
}

/** Customer-facing link for a saved document */
export function getDocumentShareUrl(doc) {
  return getApiUrl(`/api/documents/${encodeURIComponent(doc.id)}/view?t=${encodeURIComponent(doc.token)}`)
}

/* ───────────── Customers (signed-in CRM users only) ───────────── */

function authHeaders(extra = {}) {
  let token = ''
  try {
    token = localStorage.getItem('ce_crm_token') || ''
  } catch {
    /* storage unavailable */
  }
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

async function customerRequest(path, { method = 'GET', body, fallback } = {}) {
  const res = await fetch(getApiUrl(path), {
    method,
    headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = apiError(res, data, fallback || 'Request failed')
    err.status = res.status
    err.existingId = data.existingId
    throw err
  }
  return data
}

export function fetchCustomers({ q = '', status = 'active', limit = 50, skip = 0 } = {}) {
  const params = new URLSearchParams({ status, limit: String(limit), skip: String(skip) })
  if (q) params.set('q', q)
  return customerRequest(`/api/customers?${params.toString()}`, { fallback: 'Could not load customers' })
}

export function fetchCustomer(id) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}`, { fallback: 'Could not load customer' })
}

export function createCustomer(data) {
  return customerRequest('/api/customers', { method: 'POST', body: data, fallback: 'Could not create customer' })
}

export function updateCustomer(id, data) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, fallback: 'Could not update customer' })
}

export function deleteCustomer(id) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE', fallback: 'Could not delete customer' })
}

export function addCustomerActivity(id, entry) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}/activity`, { method: 'POST', body: entry, fallback: 'Could not save activity' })
}

export function updateCustomerActivity(id, activityId, entry) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}/activity/${encodeURIComponent(activityId)}`, {
    method: 'PATCH',
    body: entry,
    fallback: 'Could not update activity',
  })
}

export function deleteCustomerActivity(id, activityId) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}/activity/${encodeURIComponent(activityId)}`, {
    method: 'DELETE',
    fallback: 'Could not delete activity',
  })
}

export function importCustomersFromLeads() {
  return customerRequest('/api/customers/import-from-leads', { method: 'POST', body: {}, fallback: 'Could not import customers' })
}

export function addCustomerPayment(id, payment) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}/payments`, { method: 'POST', body: payment, fallback: 'Could not record payment' })
}

export function updateCustomerPayment(id, paymentId, patch) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'PATCH',
    body: patch,
    fallback: 'Could not update payment',
  })
}

export function deleteCustomerPayment(id, paymentId) {
  return customerRequest(`/api/customers/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'DELETE',
    fallback: 'Could not delete payment',
  })
}
