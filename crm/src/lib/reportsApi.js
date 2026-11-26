import { getApiUrl } from './api'
import { downloadBlobUrl } from './landApi'

/** Fetch unified plot, customer, and broker payment ledger for Management and Reports. */
export async function fetchPaymentReportsOverview() {
  const res = await fetch(getApiUrl('/api/reports/overview'))
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Could not load payment reports (HTTP ${res.status})`)
  }
  return data
}

/**
 * Download an independent ExcelJS workbook for one report type:
 *   type: 'plot-payments' | 'customer-payments' | 'broker-payments'
 *   scope: 'all' (default — full database) | 'filtered'
 */
export async function exportPaymentReportExcel(type, { scope = 'all', filters = {} } = {}) {
  const params = new URLSearchParams()
  if (scope === 'filtered') params.set('scope', 'filtered')
  for (const [k, v] of Object.entries(filters || {})) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v).trim())
    }
  }
  const qs = params.toString()
  const res = await fetch(getApiUrl(`/api/reports/export/${type}${qs ? `?${qs}` : ''}`))
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Export failed (HTTP ${res.status})`)
  }
  const disposition = res.headers.get('content-disposition') || ''
  const m = /filename\*=UTF-8''([^;]+)/i.exec(disposition) || /filename="([^"]+)"/i.exec(disposition)
  const fallback = `${type}-${new Date().toISOString().slice(0, 10)}.xlsx`
  const filename = m ? decodeURIComponent(m[1]) : fallback
  await downloadBlobUrl(URL.createObjectURL(await res.blob()), filename)
  return filename
}
