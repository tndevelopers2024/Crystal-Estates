import ExcelJS from 'exceljs'
import { PARTIES, brokerDetail, parseRupees } from './brokers.js'
import { round2, today } from './land.js'
import { addSheet } from './landExport.js'
import { loadCentralPayments } from './centralPayments.js'

const isReceived = (p) => !['Bounced', 'Refunded', 'Cancelled'].includes(p?.status)
const clean = (v) => String(v ?? '').trim()
const payDate = (p) => p?.paidOn || (p?.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '')

function paymentStatusLabel(totalAmount, paidAmount) {
  if (totalAmount == null || !(totalAmount > 0)) {
    return paidAmount > 0 ? 'Paid (No total set)' : 'No total set'
  }
  if (paidAmount <= 0) return 'Pending'
  if (paidAmount >= totalAmount) return 'Paid in full'
  return 'Partial'
}

/**
 * Build unified, reconciled payment datasets for:
 *   1. Plot Payments (every plot with booking, price, or payments)
 *   2. Customer Payments (every customer profile + linked lead/direct payments)
 *   3. Broker Payments & Commission (every broker across leads, customers, plots, land)
 */
export async function buildPaymentReportsData(db) {
  const [featuredPlots, bookings, payments, customers, leads, brokers] = await Promise.all([
    db.collection('featured_plots').find({}, { projection: { _id: 0 } }).toArray(),
    db.collection('plot_bookings').find({}, { projection: { _id: 0 } }).toArray(),
    db.collection('payments').find({}, { projection: { _id: 0 } }).sort({ paidOn: -1, createdAt: -1 }).toArray(),
    db.collection('customers').find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray(),
    db.collection('leads').find({}, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, propertyId: 1, property: 1, unit: 1, dealValue: 1, stage: 1, customerId: 1, referral: 1 } }).toArray(),
    db.collection(PARTIES).find({ type: 'broker' }, { projection: { _id: 0 } }).toArray(),
  ])

  const propById = new Map()
  for (const p of featuredPlots) {
    if (p.id) propById.set(p.id, p)
    if (p.projectId) propById.set(p.projectId, p)
  }

  const bookingMap = new Map()
  for (const b of bookings) {
    const key = b.plotUid ? `${b.propertyId}::uid::${b.plotUid}` : `${b.propertyId}::no::${b.phase || ''}::${b.plotNo}`
    bookingMap.set(key, b)
  }

  const leadMap = new Map(leads.map((l) => [l.id, l]))
  const brokerMap = new Map(brokers.map((b) => [b.id, b]))

  /* ── 1. Plot Payments ────────────────────────────────────── */
  const plotRows = []
  const matchedPaymentIds = new Set()

  for (const prop of featuredPlots) {
    const plots = Array.isArray(prop.plots) ? prop.plots : []
    for (const pl of plots) {
      const plotNo = clean(pl.plotNo || pl.number || pl.id)
      if (!plotNo) continue
      const phase = clean(pl.phase)
      const uid = clean(pl.uid)
      const bKey = uid ? `${prop.id}::uid::${uid}` : `${prop.id}::no::${phase}::${plotNo}`
      const bk = bookingMap.get(bKey) || (prop.projectId ? bookingMap.get(uid ? `${prop.projectId}::uid::${uid}` : `${prop.projectId}::no::${phase}::${plotNo}`) : null)

      const plotPayments = payments.filter((p) => {
        const propMatch = p.propertyId === prop.id || (prop.projectId && p.propertyId === prop.projectId) || (!p.propertyId && clean(p.property).toLowerCase() === clean(prop.name).toLowerCase())
        if (!propMatch) return false
        if (uid && p.plotUid && p.plotUid === uid) return true
        if (p.plotNo && clean(p.plotNo).toLowerCase() === plotNo.toLowerCase() && (!phase || !p.phase || clean(p.phase).toLowerCase() === phase.toLowerCase())) return true
        if (p.unitAllotted && clean(p.unitAllotted).toLowerCase() === `plot ${plotNo}`.toLowerCase()) return true
        return false
      })
      for (const p of plotPayments) matchedPaymentIds.add(p.id)

      const bookingLead = bk?.booking?.leadId ? leadMap.get(bk.booking.leadId) : null
      const totalAmount = parseRupees(bk?.booking?.totalPrice) ?? parseRupees(pl.price) ?? (bookingLead?.dealValue != null ? Number(bookingLead.dealValue) : null)
      const amountPaid = round2(plotPayments.filter(isReceived).reduce((s, p) => s + (Number(p.amount) || 0), 0))
      const pendingBalance = totalAmount != null ? round2(Math.max(totalAmount - amountPaid, 0)) : null

      const statusGroup = clean(pl.status || 'Available')
      const hasActivity = Boolean(bk?.booking?.buyerName || plotPayments.length > 0 || ['booked', 'reserved', 'sold', 'registered'].includes(statusGroup.toLowerCase()))
      if (!hasActivity && totalAmount == null) continue

      plotRows.push({
        id: `${prop.id}:${uid || `${phase}#${plotNo}`}`,
        propertyId: prop.id,
        propertyName: prop.name || 'Property',
        location: prop.location || '',
        phase,
        plotNo,
        plotUid: uid || null,
        plotStatus: statusGroup,
        buyerName: bk?.booking?.buyerName || bookingLead?.name || plotPayments[0]?.leadName || '',
        buyerPhone: bk?.booking?.phone || bookingLead?.phone || '',
        leadId: bk?.booking?.leadId || plotPayments[0]?.leadId || null,
        customerId: bookingLead?.customerId || plotPayments[0]?.customerId || null,
        totalAmount,
        amountPaid,
        pendingBalance,
        paymentStatus: paymentStatusLabel(totalAmount, amountPaid),
        paymentCount: plotPayments.length,
        lastPaymentDate: plotPayments[0] ? payDate(plotPayments[0]) : '',
        transactions: plotPayments.map((p) => ({
          id: p.id,
          date: payDate(p),
          paymentFor: p.paymentFor || 'Payment',
          amount: Number(p.amount) || 0,
          mode: p.mode || '',
          referenceNo: p.referenceNo || '',
          status: p.status || 'Received',
          note: p.note || '',
          customerName: p.customerName || p.leadName || '',
        })),
      })
    }
  }

  plotRows.sort((a, b) => (b.amountPaid - a.amountPaid) || a.propertyName.localeCompare(b.propertyName) || String(a.plotNo).localeCompare(String(b.plotNo), undefined, { numeric: true }))

  const plotSummary = {
    totalPlots: plotRows.length,
    totalAmount: round2(plotRows.reduce((s, r) => s + (r.totalAmount || 0), 0)),
    totalPaid: round2(plotRows.reduce((s, r) => s + r.amountPaid, 0)),
    pendingBalance: round2(plotRows.reduce((s, r) => s + (r.pendingBalance || 0), 0)),
    transactionCount: plotRows.reduce((s, r) => s + r.paymentCount, 0),
  }

  /* ── 2. Customer Payments ────────────────────────────────── */
  const customerRows = customers.map((c) => {
    const leadIds = new Set(c.leadIds || [])
    const custPayments = payments.filter((p) => p.customerId === c.id || (p.leadId && leadIds.has(p.leadId)))
    const linkedLeads = [...leadIds].map((lid) => leadMap.get(lid)).filter(Boolean)
    const leadDealTotal = linkedLeads.some((l) => l.dealValue != null)
      ? linkedLeads.reduce((s, l) => s + (Number(l.dealValue) || 0), 0)
      : null
    const totalAmount = c.dealValue != null ? Number(c.dealValue) : leadDealTotal
    const amountPaid = round2(custPayments.filter(isReceived).reduce((s, p) => s + (Number(p.amount) || 0), 0))
    const pendingBalance = totalAmount != null ? round2(Math.max(totalAmount - amountPaid, 0)) : null

    const brokerId = c.referral?.brokerId || linkedLeads.find((l) => l.referral?.brokerId)?.referral?.brokerId || null
    const broker = brokerId ? brokerMap.get(brokerId) : null

    return {
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      city: c.city || '',
      isDirectCustomer: !broker,
      brokerId: broker?.id || null,
      brokerName: broker?.name || 'Direct Customer',
      totalAmount,
      amountPaid,
      pendingBalance,
      paymentStatus: paymentStatusLabel(totalAmount, amountPaid),
      paymentCount: custPayments.length,
      lastPaymentDate: custPayments[0] ? payDate(custPayments[0]) : '',
      transactions: custPayments.map((p) => ({
        id: p.id,
        date: payDate(p),
        paymentFor: p.paymentFor || 'Payment',
        amount: Number(p.amount) || 0,
        mode: p.mode || '',
        referenceNo: p.referenceNo || '',
        property: p.property || '',
        plotNo: p.plotNo || p.unitAllotted || '',
        status: p.status || 'Received',
        note: p.note || '',
      })),
    }
  })

  customerRows.sort((a, b) => (b.amountPaid - a.amountPaid) || a.name.localeCompare(b.name))

  const customerSummary = {
    totalCustomers: customerRows.length,
    customersWithPayments: customerRows.filter((c) => c.paymentCount > 0).length,
    totalAmount: round2(customerRows.reduce((s, r) => s + (r.totalAmount || 0), 0)),
    totalPaid: round2(customerRows.reduce((s, r) => s + r.amountPaid, 0)),
    pendingBalance: round2(customerRows.reduce((s, r) => s + (r.pendingBalance || 0), 0)),
    transactionCount: customerRows.reduce((s, r) => s + r.paymentCount, 0),
  }

  /* ── 3. Broker Payments & Commission ─────────────────────── */
  const brokerDetails = (await Promise.all(brokers.map((b) => brokerDetail(db, b.id)))).filter(Boolean)
  brokerDetails.sort((a, b) => (b.stats.payable - a.stats.payable) || a.broker.name.localeCompare(b.broker.name))

  const brokerRows = brokerDetails.map((d) => {
    const dc = d.broker.defaultCommission
    const usualCommission = dc ? (dc.type === 'percent' ? `${dc.value}%` : `₹${Number(dc.value).toLocaleString('en-IN')} fixed`) : '—'
    const status = !(d.stats.payable > 0)
      ? 'Not set'
      : d.stats.paid <= 0
        ? 'Pending'
        : d.stats.paid >= d.stats.payable
          ? 'Paid'
          : 'Part paid'
    return {
      id: d.broker.id,
      name: d.broker.name,
      phone: d.broker.phone || '',
      email: d.broker.email || '',
      active: d.broker.active !== false,
      usualCommission,
      referralCount: d.stats.referrals,
      totalCommission: d.stats.payable,
      commissionPaid: d.stats.paid,
      pendingCommission: d.stats.pending,
      commissionStatus: status,
      referrals: d.referrals,
      transactions: d.payments.map((p) => ({
        id: p.id,
        date: p.date || '',
        module: p.module || '',
        ref: p.ref || '',
        amount: Number(p.amount) || 0,
        mode: p.mode || '',
        referenceNo: p.referenceNo || '',
        note: p.note || '',
        by: p.by?.name || '',
      })),
    }
  })

  const brokerSummary = {
    totalBrokers: brokerRows.length,
    totalReferrals: brokerRows.reduce((s, r) => s + r.referralCount, 0),
    totalCommission: round2(brokerRows.reduce((s, r) => s + r.totalCommission, 0)),
    commissionPaid: round2(brokerRows.reduce((s, r) => s + r.commissionPaid, 0)),
    pendingCommission: round2(brokerRows.reduce((s, r) => s + r.pendingCommission, 0)),
    transactionCount: brokerRows.reduce((s, r) => s + r.transactions.length, 0),
  }

  return {
    plots: plotRows,
    customers: customerRows,
    brokers: brokerRows,
    summaries: {
      plots: plotSummary,
      customers: customerSummary,
      brokers: brokerSummary,
    },
  }
}

/* ── Independent ExcelJS Workbooks ────────────────────────── */

function newWorkbook() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Crystal Estates CRM'
  wb.created = new Date()
  return wb
}

function makeSubtitle(scopeLabel, countLabel, by) {
  const ts = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  return `Crystal Estates · ${scopeLabel} · ${countLabel} · Exported ${ts} by ${by}`
}

export function filterPlotRows(rows, { q = '', propertyId = '', status = '' } = {}) {
  const ql = clean(q).toLowerCase()
  return rows.filter((r) => {
    if (propertyId && r.propertyId !== propertyId) return false
    if (status && r.paymentStatus !== status) return false
    if (ql && !`${r.propertyName} ${r.plotNo} ${r.buyerName} ${r.buyerPhone}`.toLowerCase().includes(ql)) return false
    return true
  })
}

export function filterCustomerRows(rows, { q = '', status = '' } = {}) {
  const ql = clean(q).toLowerCase()
  return rows.filter((r) => {
    if (status && r.paymentStatus !== status) return false
    if (ql && !`${r.name} ${r.phone} ${r.email} ${r.city} ${r.brokerName}`.toLowerCase().includes(ql)) return false
    return true
  })
}

export function filterBrokerRows(rows, { q = '', status = '' } = {}) {
  const ql = clean(q).toLowerCase()
  return rows.filter((r) => {
    if (status && r.commissionStatus !== status) return false
    if (ql && !`${r.name} ${r.phone} ${r.email}`.toLowerCase().includes(ql)) return false
    return true
  })
}

/** 1. Plot Payments ExcelJS Workbook */
export async function buildPlotPaymentsWorkbook(db, { filters = {}, scope = 'all', by = 'CRM user' } = {}) {
  const data = await buildPaymentReportsData(db)
  const rows = scope === 'filtered' ? filterPlotRows(data.plots, filters) : data.plots
  const wb = newWorkbook()
  const scopeText = scope === 'filtered' ? 'Filtered plot records' : 'All plot records'

  addSheet(wb, {
    name: 'Plot Payments',
    title: 'Plot Payments & Balances',
    subtitle: makeSubtitle(scopeText, `${rows.length} plot${rows.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Property / Project', key: 'propertyName', width: 26 },
      { header: 'Phase', key: 'phase', width: 12 },
      { header: 'Plot No.', key: 'plotNo', width: 12 },
      { header: 'Plot Status', key: 'plotStatus', width: 14 },
      { header: 'Buyer / Customer', key: 'buyerName', width: 24 },
      { header: 'Phone', key: 'buyerPhone', width: 16 },
      { header: 'Total Amount (₹)', key: 'totalAmount', type: 'money', total: true },
      { header: 'Amount Paid (₹)', key: 'amountPaid', type: 'money', total: true },
      { header: 'Pending Balance (₹)', key: 'pendingBalance', type: 'money', total: true },
      { header: 'Payment Status', key: 'paymentStatus', width: 18 },
      { header: 'Payments', key: 'paymentCount', type: 'int', total: true },
      { header: 'Last Payment', key: 'lastPaymentDate', type: 'date' },
    ],
    rows,
  })

  const txns = rows.flatMap((r) =>
    r.transactions.map((t) => ({
      propertyName: r.propertyName,
      plotNo: r.plotNo,
      buyerName: r.buyerName || t.customerName,
      ...t,
    })),
  )
  txns.sort((a, b) => (a.date < b.date ? 1 : -1))

  addSheet(wb, {
    name: 'Plot Transactions',
    title: 'Plot Payment History',
    subtitle: makeSubtitle(scopeText, `${txns.length} transaction${txns.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Date', key: 'date', type: 'date' },
      { header: 'Property / Project', key: 'propertyName', width: 26 },
      { header: 'Plot No.', key: 'plotNo', width: 12 },
      { header: 'Customer', key: 'buyerName', width: 24 },
      { header: 'Payment For', key: 'paymentFor', width: 20 },
      { header: 'Amount (₹)', key: 'amount', type: 'money', total: true },
      { header: 'Method', key: 'mode', width: 22 },
      { header: 'Reference No.', key: 'referenceNo', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Notes', key: 'note', width: 32, wrap: true },
    ],
    rows: txns,
  })

  return {
    workbook: wb,
    filename: `Plot-Payments-${today()}.xlsx`,
  }
}

/** 2. Customer Payments ExcelJS Workbook */
export async function buildCustomerPaymentsWorkbook(db, { filters = {}, scope = 'all', by = 'CRM user' } = {}) {
  const data = await buildPaymentReportsData(db)
  const rows = scope === 'filtered' ? filterCustomerRows(data.customers, filters) : data.customers
  const wb = newWorkbook()
  const scopeText = scope === 'filtered' ? 'Filtered customers' : 'All customers'

  addSheet(wb, {
    name: 'Customer Payments',
    title: 'Customer Payments & Balances',
    subtitle: makeSubtitle(scopeText, `${rows.length} customer${rows.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Customer Name', key: 'name', width: 26 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Broker / Direct', key: 'brokerName', width: 22 },
      { header: 'Total Amount (₹)', key: 'totalAmount', type: 'money', total: true },
      { header: 'Total Paid (₹)', key: 'amountPaid', type: 'money', total: true },
      { header: 'Pending Balance (₹)', key: 'pendingBalance', type: 'money', total: true },
      { header: 'Payment Status', key: 'paymentStatus', width: 18 },
      { header: 'Payments', key: 'paymentCount', type: 'int', total: true },
      { header: 'Last Payment', key: 'lastPaymentDate', type: 'date' },
    ],
    rows,
  })

  const txns = rows.flatMap((r) =>
    r.transactions.map((t) => ({
      customerName: r.name,
      phone: r.phone,
      ...t,
    })),
  )
  txns.sort((a, b) => (a.date < b.date ? 1 : -1))

  addSheet(wb, {
    name: 'Customer Transactions',
    title: 'Customer Payment History',
    subtitle: makeSubtitle(scopeText, `${txns.length} transaction${txns.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Date', key: 'date', type: 'date' },
      { header: 'Customer', key: 'customerName', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Property / Project', key: 'property', width: 24 },
      { header: 'Plot / Unit', key: 'plotNo', width: 14 },
      { header: 'Payment For', key: 'paymentFor', width: 20 },
      { header: 'Amount (₹)', key: 'amount', type: 'money', total: true },
      { header: 'Method', key: 'mode', width: 22 },
      { header: 'Reference No.', key: 'referenceNo', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Notes', key: 'note', width: 32, wrap: true },
    ],
    rows: txns,
  })

  return {
    workbook: wb,
    filename: `Customer-Payments-${today()}.xlsx`,
  }
}

/** 3. Broker Payments & Commission ExcelJS Workbook */
export async function buildBrokerPaymentsWorkbook(db, { filters = {}, scope = 'all', by = 'CRM user' } = {}) {
  const data = await buildPaymentReportsData(db)
  const rows = scope === 'filtered' ? filterBrokerRows(data.brokers, filters) : data.brokers
  const wb = newWorkbook()
  const scopeText = scope === 'filtered' ? 'Filtered brokers' : 'All brokers'

  addSheet(wb, {
    name: 'Broker Commissions',
    title: 'Broker Payments & Commission Summary',
    subtitle: makeSubtitle(scopeText, `${rows.length} broker${rows.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Broker Name', key: 'name', width: 26 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Usual Commission', key: 'usualCommission', width: 18 },
      { header: 'Referrals', key: 'referralCount', type: 'int', total: true },
      { header: 'Total Commission (₹)', key: 'totalCommission', type: 'money', total: true },
      { header: 'Commission Paid (₹)', key: 'commissionPaid', type: 'money', total: true },
      { header: 'Pending Commission (₹)', key: 'pendingCommission', type: 'money', total: true },
      { header: 'Status', key: 'commissionStatus', width: 16 },
    ],
    rows,
  })

  const MODULE_LABEL = { lead: 'Lead', customer: 'Customer', property: 'Property', land: 'Land' }
  const referrals = rows.flatMap((b) =>
    b.referrals.map((r) => ({
      brokerName: b.name,
      module: MODULE_LABEL[r.module] || r.module,
      customerName: r.name,
      phone: r.phone || '',
      detail: r.detail || '',
      dealValue: r.dealValue,
      basis: r.commission ? (r.commission.type === 'percent' ? `${r.commission.value}%` : 'Fixed') : 'Not set',
      payable: r.payable,
      paid: r.paid,
      pending: r.pending,
      status: r.status,
    })),
  )

  addSheet(wb, {
    name: 'Broker Referrals',
    title: 'Broker-wise Referrals & Commission',
    subtitle: makeSubtitle(scopeText, `${referrals.length} referral${referrals.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Broker', key: 'brokerName', width: 24 },
      { header: 'Module', key: 'module', width: 12 },
      { header: 'Customer / Buyer', key: 'customerName', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Property / Detail', key: 'detail', width: 30 },
      { header: 'Deal Value (₹)', key: 'dealValue', type: 'money', total: true },
      { header: 'Commission Basis', key: 'basis', width: 16 },
      { header: 'Payable (₹)', key: 'payable', type: 'money', total: true },
      { header: 'Paid (₹)', key: 'paid', type: 'money', total: true },
      { header: 'Pending (₹)', key: 'pending', type: 'money', total: true },
      { header: 'Status', key: 'status', width: 16 },
    ],
    rows: referrals,
  })

  const txns = rows.flatMap((b) =>
    b.transactions.map((t) => ({
      brokerName: b.name,
      ...t,
      module: MODULE_LABEL[t.module] || t.module,
    })),
  )
  txns.sort((a, b) => (a.date < b.date ? 1 : -1))

  addSheet(wb, {
    name: 'Commission Payments',
    title: 'Broker Commission Payment History',
    subtitle: makeSubtitle(scopeText, `${txns.length} payment${txns.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Date', key: 'date', type: 'date' },
      { header: 'Broker', key: 'brokerName', width: 24 },
      { header: 'Module', key: 'module', width: 12 },
      { header: 'For', key: 'ref', width: 28 },
      { header: 'Amount (₹)', key: 'amount', type: 'money', total: true },
      { header: 'Method', key: 'mode', width: 22 },
      { header: 'Reference No.', key: 'referenceNo', width: 18 },
      { header: 'Notes', key: 'note', width: 30, wrap: true },
      { header: 'Recorded By', key: 'by', width: 18 },
    ],
    rows: txns,
  })

  return {
    workbook: wb,
    filename: `Broker-Payments-Commission-${today()}.xlsx`,
  }
}

export function filterCentralPayments(rows, filters = {}) {
  const {
    q = '',
    dateFrom = '',
    dateTo = '',
    customerId = '',
    broker = '',
    propertyId = '',
    plotNo = '',
    mode = '',
    status = '',
    paymentFor = '',
    sourceModule = '',
  } = filters
  const ql = clean(q).toLowerCase()
  const pl = clean(plotNo).toLowerCase()
  return rows.filter((p) => {
    if (dateFrom && (!p.paidOn || p.paidOn < dateFrom)) return false
    if (dateTo && (!p.paidOn || p.paidOn > dateTo)) return false
    if (customerId && p.customerId !== customerId && p.leadId !== customerId) return false
    if (broker === '__none' ? p.brokerId : broker && p.brokerName !== broker) return false
    if (propertyId && p.propertyId !== propertyId && clean(p.property).toLowerCase() !== clean(propertyId).toLowerCase()) return false
    if (pl && !clean(p.plotNo || p.unitAllotted).toLowerCase().includes(pl)) return false
    if (mode && p.mode !== mode) return false
    if (status && (p.status || 'Received') !== status) return false
    if (paymentFor && p.paymentFor !== paymentFor) return false
    if (sourceModule && p.sourceModule !== sourceModule) return false
    if (ql && ![p.id, p.leadName, p.brokerName, p.plotNo, p.unitAllotted, p.referenceNo, p.paymentFor, p.property, p.note].some((v) => String(v || '').toLowerCase().includes(ql))) {
      return false
    }
    return true
  })
}

/** 4. Centralized All-Payments ExcelJS Workbook */
export async function buildCentralPaymentsWorkbook(db, { filters = {}, scope = 'all', by = 'CRM user' } = {}) {
  const all = await loadCentralPayments(db)
  const rows = scope === 'filtered' ? filterCentralPayments(all, filters) : all
  const wb = newWorkbook()
  const scopeText = scope === 'filtered' ? 'Filtered payment records' : 'All centralized payment records'

  addSheet(wb, {
    name: 'All Payments',
    title: 'Centralized Payments Register',
    subtitle: makeSubtitle(scopeText, `${rows.length} payment${rows.length === 1 ? '' : 's'}`, by),
    columns: [
      { header: 'Date', key: 'paidOn', type: 'date' },
      { header: 'Module', key: 'sourceModule', width: 18 },
      { header: 'Customer / Recipient', key: 'leadName', width: 24 },
      { header: 'Broker', key: 'brokerName', width: 22 },
      { header: 'Project / Property', key: 'property', width: 24 },
      { header: 'Plot / Unit', key: 'plotDisplay', width: 14 },
      { header: 'Payment Type', key: 'paymentFor', width: 20 },
      { header: 'Method', key: 'mode', width: 20 },
      { header: 'Reference / Txn ID', key: 'referenceNo', width: 20 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Amount (₹)', key: 'amount', type: 'money', total: true },
      { header: 'Pending Balance (₹)', key: 'balance', type: 'money', total: true },
      { header: 'Notes', key: 'note', width: 32, wrap: true },
    ],
    rows: rows.map((p) => ({
      ...p,
      plotDisplay: p.plotNo ? `Plot ${p.plotNo}` : p.unitAllotted && p.unitAllotted !== 'Not allotted' ? p.unitAllotted : '',
    })),
  })

  return {
    workbook: wb,
    filename: `All-Payments-${today()}.xlsx`,
  }
}
