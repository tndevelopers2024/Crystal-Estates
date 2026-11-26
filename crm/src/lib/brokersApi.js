import { getApiUrl } from './api'
import { downloadBlobUrl } from './landApi'

/**
 * Brokers for every module: the shared directory, the broker on a lead or a
 * plot booking, commission and its payments, the activity log and the Excel
 * report. The session token is added by lib/authFetch.
 */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(getApiUrl(`/api/brokers${path}`), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (HTTP ${res.status})`)
  return data
}
const id = encodeURIComponent

/* Directory */
export const listBrokers = () => call('')
export const createBroker = (broker) => call('', { method: 'POST', body: broker })
export const updateBroker = (brokerId, patch) => call(`/${id(brokerId)}`, { method: 'PATCH', body: patch })
export const deleteBroker = (brokerId) => call(`/${id(brokerId)}`, { method: 'DELETE' })
export const getBroker = (brokerId) => call(`/${id(brokerId)}`)
export const addBrokerNote = (brokerId, note) => call(`/${id(brokerId)}/notes`, { method: 'POST', body: { note } })

/**
 * Owners of a referral: a lead, a customer, or a plot booking.
 *   { type: 'lead', leadId }
 *   { type: 'customer', customerId }
 *   { type: 'booking', propertyId, plotUid, plotNo, phase }
 */
export const leadOwner = (leadId) => ({ type: 'lead', leadId })
export const customerOwner = (customerId) => ({ type: 'customer', customerId })
export const bookingOwner = (propertyId, plot) => ({ type: 'booking', propertyId, plotUid: plot.uid || '', plotNo: plot.plotNo, phase: plot.phase || '' })

export const getReferral = (owner) => call(`/referral?${new URLSearchParams(Object.entries(owner).filter(([, v]) => v !== undefined && v !== null))}`)
export const saveReferral = (owner, brokerId, commission) => call('/referral', { method: 'PUT', body: { owner, brokerId: brokerId || '', commission } })
export const addCommissionPayment = (owner, payment) => call('/commission-payments', { method: 'POST', body: { owner, ...payment } })
export const updateCommissionPayment = (paymentId, patch) => call(`/commission-payments/${id(paymentId)}`, { method: 'PATCH', body: patch })
export const deleteCommissionPayment = (paymentId) => call(`/commission-payments/${id(paymentId)}`, { method: 'DELETE' })

/** Excel report of one broker (or all brokers). */
export async function exportBrokersExcel(brokerId) {
  const res = await fetch(getApiUrl(`/api/brokers/export${brokerId ? `?brokerId=${id(brokerId)}` : ''}`))
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Export failed (HTTP ${res.status})`)
  }
  const disposition = res.headers.get('content-disposition') || ''
  const m = /filename\*=UTF-8''([^;]+)/i.exec(disposition) || /filename="([^"]+)"/i.exec(disposition)
  const filename = m ? decodeURIComponent(m[1]) : `Brokers-${new Date().toISOString().slice(0, 10)}.xlsx`
  await downloadBlobUrl(URL.createObjectURL(await res.blob()), filename)
  return filename
}
