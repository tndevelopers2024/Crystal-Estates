import { round2 } from './land.js'

const countsAsReceived = (p) => !['Bounced', 'Refunded', 'Cancelled', 'Failed', 'Pending', 'Pending clearance'].includes(p?.status)
const toIsoDate = (v) => {
  if (!v) return ''
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/**
 * Centralized payment aggregator across the entire CRM:
 *   1. payments (Leads, Customers, Properties)
 *   2. plot_activity (Direct plot payments without a paymentId mirror)
 *   3. broker_commission_payments (Broker commissions for leads, customers, bookings)
 *   4. land_payments (Land management plot buyer payments)
 *   5. land_commission_payments (Land management broker commission payments)
 */
export async function loadCentralPayments(db) {
  const [
    corePayments,
    plotActs,
    brokerCommPays,
    landPays,
    landCommPays,
    leads,
    customers,
    brokers,
    landPlots,
    landProjects,
    featuredPlots,
  ] = await Promise.all([
    db.collection('payments').find({}, { projection: { _id: 0 } }).sort({ paidOn: -1, createdAt: -1 }).toArray(),
    db.collection('plot_activity').find({ type: 'payment', paymentId: { $in: [null, ''] } }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(),
    db.collection('broker_commission_payments').find({}, { projection: { _id: 0 } }).sort({ date: -1, createdAt: -1 }).toArray(),
    db.collection('land_payments').find({}, { projection: { _id: 0 } }).sort({ date: -1, createdAt: -1 }).toArray(),
    db.collection('land_commission_payments').find({}, { projection: { _id: 0 } }).sort({ date: -1, createdAt: -1 }).toArray(),
    db.collection('leads').find({}, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, customerId: 1, dealValue: 1, referral: 1, property: 1, propertyId: 1 } }).toArray(),
    db.collection('customers').find({}, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, dealValue: 1, referral: 1 } }).toArray(),
    db.collection('land_parties').find({ type: 'broker' }, { projection: { _id: 0, id: 1, name: 1, phone: 1 } }).toArray(),
    db.collection('land_plots').find({}, { projection: { _id: 0, id: 1, projectId: 1, plotNo: 1, customer: 1, brokerId: 1, salePrice: 1 } }).toArray(),
    db.collection('land_projects').find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    db.collection('featured_plots').find({}, { projection: { _id: 0, id: 1, projectId: 1, name: 1 } }).toArray(),
  ])

  const leadMap = new Map(leads.map((l) => [l.id, l]))
  const custMap = new Map(customers.map((c) => [c.id, c]))
  const brokerMap = new Map(brokers.map((b) => [b.id, b]))
  const landPlotMap = new Map(landPlots.map((p) => [p.id, p]))
  const landProjMap = new Map(landProjects.map((p) => [p.id, p]))
  const propMap = new Map()
  for (const fp of featuredPlots) {
    if (fp.id) propMap.set(fp.id, fp)
    if (fp.projectId) propMap.set(fp.projectId, fp)
  }

  // Received totals per lead & customer for pending balance calculation
  const receivedByLead = new Map()
  const receivedByCust = new Map()
  for (const p of corePayments) {
    if (!countsAsReceived(p)) continue
    const amt = Number(p.amount) || 0
    if (p.leadId) receivedByLead.set(p.leadId, (receivedByLead.get(p.leadId) || 0) + amt)
    if (p.customerId) receivedByCust.set(p.customerId, (receivedByCust.get(p.customerId) || 0) + amt)
  }

  const out = []

  // 1. Core payments (Lead / Customer / Plot)
  for (const p of corePayments) {
    const lead = p.leadId ? leadMap.get(p.leadId) : null
    const cust = p.customerId ? custMap.get(p.customerId) : lead?.customerId ? custMap.get(lead.customerId) : null
    const brokerId = lead?.referral?.brokerId || cust?.referral?.brokerId || null
    const broker = brokerId ? brokerMap.get(brokerId) : null
    const deal = lead?.dealValue != null ? Number(lead.dealValue) : cust?.dealValue != null ? Number(cust.dealValue) : null
    const got = p.leadId ? (receivedByLead.get(p.leadId) || 0) : p.customerId ? (receivedByCust.get(p.customerId) || 0) : 0
    const prop = p.propertyId ? propMap.get(p.propertyId) : null

    out.push({
      ...p,
      sourceModule: p.plotLinked ? 'Plot' : p.customerId && !p.leadId ? 'Customer' : 'Lead / Customer',
      editable: true,
      editKind: 'core',
      customerId: p.customerId || lead?.customerId || cust?.id || null,
      leadName: p.customerName || p.leadName || cust?.name || lead?.name || 'Customer',
      customerPhone: cust?.phone || lead?.phone || '',
      propertyId: p.propertyId || prop?.id || lead?.propertyId || null,
      property: p.property || prop?.name || lead?.property || '—',
      status: p.status || 'Received',
      paidOn: toIsoDate(p.paidOn || p.createdAt),
      dealValue: deal,
      balance: deal != null ? round2(Math.max(deal - got, 0)) : null,
      brokerId,
      brokerName: broker?.name || '',
      brokerPhone: broker?.phone || '',
    })
  }

  // 2. Direct Plot payments from plot_activity (without paymentId)
  for (const a of plotActs) {
    const lead = a.leadId ? leadMap.get(a.leadId) : null
    const cust = lead?.customerId ? custMap.get(lead.customerId) : null
    const brokerId = lead?.referral?.brokerId || cust?.referral?.brokerId || null
    const broker = brokerId ? brokerMap.get(brokerId) : null
    const prop = a.propertyId ? propMap.get(a.propertyId) : null
    out.push({
      id: a.id,
      sourceModule: 'Plot',
      editable: true,
      editKind: 'plot_activity',
      leadId: a.leadId || null,
      customerId: cust?.id || lead?.customerId || null,
      leadName: lead?.name || a.buyerName || 'Plot Buyer',
      customerPhone: lead?.phone || '',
      propertyId: a.propertyId || prop?.id || null,
      property: a.propertyName || prop?.name || 'Property',
      plotUid: a.plotUid || null,
      plotNo: a.plotNo || '',
      unitAllotted: a.plotNo ? `Plot ${a.plotNo}` : '',
      paymentFor: a.note || a.title || 'Plot payment',
      amount: Number(a.amount) || 0,
      mode: a.mode || '—',
      referenceNo: a.referenceNo || '',
      status: a.status || 'Received',
      paidOn: toIsoDate(a.paidOn || a.createdAt),
      date: a.paidOn || '',
      note: a.note || '',
      dealValue: null,
      balance: null,
      brokerId,
      brokerName: broker?.name || '',
      brokerPhone: broker?.phone || '',
      createdAt: a.createdAt,
    })
  }

  // 3. Broker Commission Payments
  for (const cp of brokerCommPays) {
    const broker = brokerMap.get(cp.brokerId)
    const lead = cp.refs?.leadId ? leadMap.get(cp.refs.leadId) : null
    const cust = cp.refs?.customerId ? custMap.get(cp.refs.customerId) : lead?.customerId ? custMap.get(lead.customerId) : null
    out.push({
      id: cp.id,
      sourceModule: 'Broker Commission',
      editable: false,
      editKind: 'broker_commission',
      leadId: cp.refs?.leadId || null,
      customerId: cust?.id || cp.refs?.customerId || null,
      leadName: cp.refs?.label || cust?.name || lead?.name || broker?.name || 'Broker Commission',
      customerPhone: cust?.phone || lead?.phone || '',
      propertyId: cp.refs?.propertyId || null,
      property: cp.refs?.propertyName || cp.refs?.property || 'Commission Payout',
      plotNo: cp.refs?.plotNo || '',
      unitAllotted: cp.refs?.plotNo ? `Plot ${cp.refs.plotNo}` : '',
      paymentFor: 'Broker Commission',
      amount: Number(cp.amount) || 0,
      mode: cp.mode || '—',
      referenceNo: cp.referenceNo || '',
      status: 'Received',
      paidOn: toIsoDate(cp.date || cp.createdAt),
      date: cp.date || '',
      note: cp.note || '',
      dealValue: null,
      balance: null,
      brokerId: cp.brokerId || null,
      brokerName: broker?.name || '',
      brokerPhone: broker?.phone || '',
      createdAt: cp.createdAt,
    })
  }

  // 4. Land Management Buyer Payments
  for (const lp of landPays) {
    const plot = landPlotMap.get(lp.plotId)
    const proj = landProjMap.get(lp.projectId || plot?.projectId)
    const broker = plot?.brokerId ? brokerMap.get(plot.brokerId) : null
    out.push({
      id: lp.id,
      sourceModule: 'Land Management',
      editable: false,
      editKind: 'land_payment',
      leadId: null,
      customerId: null,
      leadName: plot?.customer?.name || 'Land Buyer',
      customerPhone: plot?.customer?.phone || '',
      propertyId: proj?.id || lp.projectId || null,
      property: proj?.name || 'Land Project',
      plotNo: plot?.plotNo || '',
      unitAllotted: plot?.plotNo ? `Plot ${plot.plotNo}` : '',
      paymentFor: lp.paymentFor || 'Land Plot Payment',
      amount: Number(lp.amount) || 0,
      mode: lp.mode || '—',
      referenceNo: lp.referenceNo || '',
      status: 'Received',
      paidOn: toIsoDate(lp.date || lp.createdAt),
      date: lp.date || '',
      note: lp.note || '',
      dealValue: plot?.salePrice ?? null,
      balance: null,
      brokerId: broker?.id || null,
      brokerName: broker?.name || '',
      brokerPhone: broker?.phone || '',
      createdAt: lp.createdAt,
    })
  }

  // 5. Land Management Commission Payments
  for (const lcp of landCommPays) {
    const plot = landPlotMap.get(lcp.plotId)
    const proj = landProjMap.get(lcp.projectId || plot?.projectId)
    const broker = brokerMap.get(lcp.brokerId)
    out.push({
      id: lcp.id,
      sourceModule: 'Land Commission',
      editable: false,
      editKind: 'land_commission',
      leadId: null,
      customerId: null,
      leadName: plot?.customer?.name || broker?.name || 'Land Commission',
      customerPhone: plot?.customer?.phone || '',
      propertyId: proj?.id || lcp.projectId || null,
      property: proj?.name || 'Land Project',
      plotNo: plot?.plotNo || '',
      unitAllotted: plot?.plotNo ? `Plot ${plot.plotNo}` : '',
      paymentFor: 'Land Broker Commission',
      amount: Number(lcp.amount) || 0,
      mode: lcp.mode || '—',
      referenceNo: lcp.referenceNo || '',
      status: 'Received',
      paidOn: toIsoDate(lcp.date || lcp.createdAt),
      date: lcp.date || '',
      note: lcp.note || '',
      dealValue: null,
      balance: null,
      brokerId: lcp.brokerId || null,
      brokerName: broker?.name || '',
      brokerPhone: broker?.phone || '',
      createdAt: lcp.createdAt,
    })
  }

  out.sort((a, b) => {
    const da = a.paidOn || toIsoDate(a.createdAt) || ''
    const dbDate = b.paidOn || toIsoDate(b.createdAt) || ''
    if (da !== dbDate) return dbDate.localeCompare(da)
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  })

  return out
}
