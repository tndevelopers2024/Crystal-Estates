import crypto from 'crypto'

/**
 * Land purchase & management: shared constants, validation helpers and the
 * money rules (balances, commission) used by the API and the Excel export.
 *
 * Collections (all prefixed land_):
 *   land_projects             one per land being purchased
 *   land_parties              landowners / vendors and brokers
 *   land_plots                plots of a project: details, customer, broker, commission
 *   land_price_logs           price history of a project
 *   land_documents            document log of a project (optional file in GridFS)
 *   land_payments             customer payments per plot
 *   land_commission_payments  commission paid to brokers per plot
 *   land_plot_logs            history of every plot
 */
export const C = {
  projects: 'land_projects',
  plots: 'land_plots',
  parties: 'land_parties',
  price: 'land_price_logs',
  docs: 'land_documents',
  payments: 'land_payments',
  comm: 'land_commission_payments',
  logs: 'land_plot_logs',
}

export const PROJECT_STATUSES = ['Negotiation', 'Agreement signed', 'Registered', 'Development', 'Selling', 'Completed']
export const PLOT_STATUSES = ['Available', 'Hold', 'Booked', 'Sold']
export const AREA_UNITS = ['Acres', 'Cents', 'Sq.ft', 'Grounds']
export const DOC_STATUSES = ['Pending', 'Received', 'Verified', 'Not required']
export const FACINGS = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West']
export const COMMISSION_TYPES = ['percent', 'fixed']

export const DEFAULT_DOC_TYPES = [
  'Parent deed',
  'Sale deed',
  'Agreement of sale',
  'Patta / Chitta',
  'Encumbrance certificate',
  'FMB sketch',
  'Layout approval',
  'Tax receipt',
  'Power of attorney',
  'Legal opinion',
  'Layout plan',
  'Other',
]

export const norm = (v) => (v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim())
export const text = (v, max) => norm(v).slice(0, max)
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/** '' / undefined → null; "1,20,000" → 120000; junk → NaN */
export function num(v) {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())
export const today = () => new Date().toISOString().slice(0, 10)
export const naturalCompare = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })

export const actorOf = (req) => ({ name: text(req.user?.name, 120) || 'CRM user', email: text(req.user?.email, 160) })

/** Commission payable for a plot: a percentage of the sale price, or a fixed amount. */
export function commissionAmount(commission, salePrice) {
  if (!commission || !(commission.value > 0)) return 0
  if (commission.type === 'percent') return round2(((Number(salePrice) || 0) * commission.value) / 100)
  return round2(commission.value)
}

/**
 * Plain-number view of everything loaded for a project (or all projects).
 * Used by list endpoints and the Excel export so both always agree.
 */
export async function loadLandData(db, projectId = null, { logs: withLogs = true } = {}) {
  const byProject = projectId ? { projectId } : {}
  const [projects, plots, parties, priceLogs, docs, payments, commPayments, logs] = await Promise.all([
    db.collection(C.projects).find(projectId ? { id: projectId } : {}, { projection: { _id: 0 } }).toArray(),
    db.collection(C.plots).find(byProject, { projection: { _id: 0 } }).toArray(),
    db.collection(C.parties).find({}, { projection: { _id: 0 } }).toArray(),
    db.collection(C.price).find(byProject, { projection: { _id: 0 } }).toArray(),
    db.collection(C.docs).find(byProject, { projection: { _id: 0, fileId: 0 } }).toArray(),
    db.collection(C.payments).find(byProject, { projection: { _id: 0 } }).toArray(),
    db.collection(C.comm).find(byProject, { projection: { _id: 0 } }).toArray(),
    withLogs ? db.collection(C.logs).find(byProject, { projection: { _id: 0 } }).toArray() : [],
  ])
  return { projects, plots, parties, priceLogs, docs, payments, commPayments, logs }
}

const sum = (rows, key = 'amount') => round2(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0))

/** Lookup maps and per-plot money, derived from loaded data. */
export function indexLand(data) {
  const partyById = new Map(data.parties.map((p) => [p.id, p]))
  const projectById = new Map(data.projects.map((p) => [p.id, p]))
  const paymentsByPlot = new Map()
  for (const p of data.payments) (paymentsByPlot.get(p.plotId) || paymentsByPlot.set(p.plotId, []).get(p.plotId)).push(p)
  const commByPlot = new Map()
  for (const p of data.commPayments) (commByPlot.get(p.plotId) || commByPlot.set(p.plotId, []).get(p.plotId)).push(p)

  const plots = data.plots.map((plot) => {
    const paid = sum(paymentsByPlot.get(plot.id) || [])
    const commPaid = sum(commByPlot.get(plot.id) || [])
    const payable = plot.brokerId ? commissionAmount(plot.commission, plot.salePrice) : 0
    return {
      ...plot,
      paid,
      balance: plot.salePrice != null ? round2(plot.salePrice - paid) : null,
      commissionPayable: payable,
      commissionPaid: commPaid,
      commissionPending: round2(payable - commPaid),
      // Plain-words status for lists and exports
      paymentStatus: !plot.customer?.name ? null : plot.salePrice == null ? 'Price not set' : paid <= 0 ? 'Unpaid' : paid >= plot.salePrice ? 'Paid' : 'Part paid',
      commissionStatus: !plot.brokerId ? null : !(payable > 0) ? 'Not set' : commPaid <= 0 ? 'Pending' : commPaid >= payable ? 'Paid' : 'Part paid',
      lastPaymentDate: (paymentsByPlot.get(plot.id) || []).map((p) => p.date).sort().pop() || null,
    }
  })
  plots.sort((a, b) => naturalCompare(a.block || '', b.block || '') || naturalCompare(a.plotNo, b.plotNo))
  return { partyById, projectById, plots, plotById: new Map(plots.map((p) => [p.id, p])) }
}

/** Counts and totals of one project's plots. */
export function summarizePlots(plots) {
  const count = (s) => plots.filter((p) => p.status === s).length
  const sold = plots.filter((p) => p.status === 'Booked' || p.status === 'Sold')
  const saleValue = round2(sold.reduce((s, p) => s + (p.salePrice || 0), 0))
  const received = round2(plots.reduce((s, p) => s + p.paid, 0))
  return {
    total: plots.length,
    available: count('Available'),
    hold: count('Hold'),
    booked: count('Booked'),
    sold: count('Sold'),
    area: round2(plots.reduce((s, p) => s + (Number(p.area) || 0), 0)),
    saleValue,
    received,
    pending: round2(sold.reduce((s, p) => s + (p.balance || 0), 0)),
    commissionPayable: round2(plots.reduce((s, p) => s + p.commissionPayable, 0)),
    commissionPaid: round2(plots.reduce((s, p) => s + p.commissionPaid, 0)),
  }
}

/**
 * The people tied to a project: landowner, vendor and any number of brokers.
 * Projects saved before the split have one "vendorId"; when that party is a
 * landowner it is shown as the landowner.
 */
export function projectParties(project, partyById) {
  let landownerId = project.landownerId || null
  let vendorId = project.vendorId || null
  if (!landownerId && vendorId && (partyById.get(vendorId)?.kind || 'Landowner') === 'Landowner') {
    landownerId = vendorId
    vendorId = null
  }
  const brokerIds = Array.isArray(project.brokerIds) ? project.brokerIds : []
  return { landownerId, vendorId, brokerIds }
}

/** Price-log entries newest first, each with the change from the entry before it (in date order). */
export function withChanges(rows) {
  const asc = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : new Date(a.createdAt) - new Date(b.createdAt)))
  let prev = null
  const out = asc.map((r) => {
    const change = prev && prev.totalPrice != null && r.totalPrice != null ? round2(r.totalPrice - prev.totalPrice) : null
    const pct = change != null && prev.totalPrice ? round2((change / prev.totalPrice) * 100) : null
    prev = r
    return { ...r, change, changePercent: pct }
  })
  return out.reverse()
}

/** Total cost of acquiring the land: price plus registration and other costs. */
export function acquisitionCost(project) {
  const p = project.purchase || {}
  return round2((project.landPrice || 0) + (p.stampDuty || 0) + (p.registrationCharges || 0) + (p.otherCosts || 0))
}
