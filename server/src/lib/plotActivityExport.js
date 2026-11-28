import ExcelJS from 'exceljs'
import { PARTIES, BOOKINGS, BROKER_PAYMENTS, parseRupees } from './brokers.js'
import { round2, today, commissionAmount } from './land.js'

const clean = (v) => String(v ?? '').trim()
const isReceived = (p) => !['Bounced', 'Refunded', 'Cancelled', 'Failed'].includes(p?.status)
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const STATUS_STYLE = {
  available: { fill: 'FFE8F5EE', font: 'FF0F3D2E' },
  booked: { fill: 'FFFEF3C7', font: 'FF92400E' },
  sold: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  registered: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  blocked: { fill: 'FFE2E8F0', font: 'FF334155' },
  reserved: { fill: 'FFE2E8F0', font: 'FF334155' },
  received: { fill: 'FFE8F5EE', font: 'FF0F3D2E' },
  paid: { fill: 'FFE8F5EE', font: 'FF0F3D2E' },
  completed: { fill: 'FFE8F5EE', font: 'FF0F3D2E' },
  confirmed: { fill: 'FFE0F2FE', font: 'FF075985' },
  scheduled: { fill: 'FFE0F2FE', font: 'FF075985' },
  pending: { fill: 'FFFEF3C7', font: 'FF92400E' },
  'pending clearance': { fill: 'FFFEF3C7', font: 'FF92400E' },
  cancelled: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  failed: { fill: 'FFFEE2E2', font: 'FF991B1B' },
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateOnly(d) {
  if (!d) return ''
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim()
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toISOString().slice(0, 10)
}

function buildStyledSheet(workbook, { title, subtitle, columns, rows, currencyCols = [], statusCols = [] }) {
  const ws = workbook.addWorksheet(title, {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const colCount = Math.max(columns.length, 1)
  ws.mergeCells(1, 1, 1, colCount)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `Crystal Estates — ${title}`
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F3D2E' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 24

  ws.mergeCells(2, 1, 2, colCount)
  const subCell = ws.getCell(2, 1)
  subCell.value = subtitle
  subCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } }
  subCell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(2).height = 18

  ws.getRow(3).height = 8

  const headerRow = ws.getRow(4)
  headerRow.height = 24
  columns.forEach((c, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = c.header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D2E' } }
    cell.alignment = { vertical: 'middle', horizontal: c.align || 'left', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F3D2E' } },
      bottom: { style: 'thin', color: { argb: 'FF0F3D2E' } },
    }
  })

  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + rows.length, column: colCount },
    }
  }

  rows.forEach((r, rIdx) => {
    const row = ws.getRow(5 + rIdx)
    const zebra = rIdx % 2 === 1
    columns.forEach((c, cIdx) => {
      const cell = row.getCell(cIdx + 1)
      const val = r[c.key]
      cell.value = val === undefined || val === null || val === '' ? '—' : val
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'top', horizontal: c.align || 'left', wrapText: true }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      if (zebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
      if (currencyCols.includes(c.key) && typeof val === 'number') {
        cell.numFmt = '₹#,##0'
        cell.alignment = { vertical: 'top', horizontal: 'right' }
      }
      if (statusCols.includes(c.key) && val) {
        const st = STATUS_STYLE[String(val).trim().toLowerCase()]
        if (st) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } }
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: st.font } }
          cell.alignment = { vertical: 'top', horizontal: 'center' }
        }
      }
    })
  })

  // Auto-size columns within sensible bounds
  columns.forEach((c, idx) => {
    let maxLen = c.header.length + 2
    for (const r of rows) {
      const s = String(r[c.key] ?? '')
      for (const line of s.split('\n')) {
        if (line.length > maxLen) maxLen = line.length
      }
    }
    ws.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 3, c.minWidth || 12), c.maxWidth || 42)
  })

  return ws
}

export async function buildPlotActivityWorkbook(db, { propertyId, scope = 'project', phase = '', plotUids = [], plotNos = [], by = 'CRM User' }) {
  const property = await db
    .collection('featured_plots')
    .findOne({ $or: [{ id: propertyId }, { projectId: propertyId }] }, { projection: { _id: 0 } })
  if (!property) {
    const err = new Error('Project not found')
    err.status = 404
    throw err
  }

  const ids = [propertyId, property.id, property.projectId].filter(Boolean)
  const propName = property.name || property.projectName || 'Project'

  // Resolve plots for this project (optionally filtered by phase)
  let rawPlots = []
  const phases = Array.isArray(property.layouts) && property.layouts.length > 0
    ? property.layouts
    : Array.isArray(property.phases) && property.phases.length > 0
      ? property.phases
      : null

  if (phases) {
    for (const ph of phases) {
      const phName = clean(ph.name)
      if (phase && phName.toLowerCase() !== clean(phase).toLowerCase()) continue
      const list = Array.isArray(ph.plots) ? ph.plots : []
      for (const p of list) rawPlots.push({ ...p, phase: p.phase || phName })
    }
  }
  if (rawPlots.length === 0 && Array.isArray(property.plots)) {
    rawPlots = property.plots.filter((p) => !phase || clean(p.phase).toLowerCase() === clean(phase).toLowerCase())
  }

  // Filter plots according to scope
  const uidSet = new Set(plotUids.map(clean).filter(Boolean))
  const noSet = new Set(plotNos.map((n) => clean(n).toLowerCase()).filter(Boolean))
  const selectedPlots = scope === 'project'
    ? rawPlots
    : rawPlots.filter((p) => (p.uid && uidSet.has(clean(p.uid))) || noSet.has(clean(p.plotNo).toLowerCase()))

  if (selectedPlots.length === 0) {
    const err = new Error('No matching plots found for export')
    err.status = 404
    throw err
  }

  const propRe = new RegExp(`^${escapeRegex(propName)}$`, 'i')

  const [activities, bookings, payments, leads, customers, visits, brokers, brokerPays, docs] = await Promise.all([
    db.collection('plot_activity').find({ propertyId: { $in: ids } }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(),
    db.collection(BOOKINGS).find({ propertyId: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
    db.collection('payments').find({ $or: [{ propertyId: { $in: ids } }, { property: propRe }] }, { projection: { _id: 0 } }).sort({ paidOn: -1, createdAt: -1 }).toArray(),
    db.collection('leads').find({ $or: [{ propertyId: { $in: ids } }, { property: propRe }] }, { projection: { _id: 0 } }).toArray(),
    db.collection('customers').find({}, { projection: { _id: 0 } }).toArray(),
    db.collection('site_visits').find({ $or: [{ propertyId: { $in: ids } }, { property: propRe }] }, { projection: { _id: 0 } }).sort({ visitDate: -1, createdAt: -1 }).toArray(),
    db.collection(PARTIES).find({ type: 'broker' }, { projection: { _id: 0 } }).toArray(),
    db.collection(BROKER_PAYMENTS).find({}, { projection: { _id: 0 } }).toArray(),
    db.collection('plot_documents').find({ propertyId: { $in: ids } }, { projection: { _id: 0, fileId: 0 } }).toArray(),
  ])

  const customerById = new Map(customers.map((c) => [c.id, c]))
  const customerByPhone = new Map(customers.filter((c) => c.phone).map((c) => [clean(c.phone), c]))
  const leadById = new Map(leads.map((l) => [l.id, l]))
  const brokerById = new Map(brokers.map((b) => [b.id, b]))

  const plotDetailsRows = []
  const customerRows = []
  const brokerRows = []
  const visitRows = []
  const paymentRows = []
  const activityRows = []

  const seenCustomerKeys = new Set()
  const seenBrokerKeys = new Set()
  const seenVisitIds = new Set()
  const seenPaymentIds = new Set()
  const seenActivityIds = new Set()

  for (const pl of selectedPlots) {
    const plotNo = clean(pl.plotNo || pl.number || pl.id)
    const ph = clean(pl.phase)
    const uid = clean(pl.uid)
    const plotRe = new RegExp(`(^|[^0-9A-Za-z])${escapeRegex(plotNo)}([^0-9A-Za-z]|$)`, 'i')

    const matchesPlot = (rec) => {
      if (uid && rec.plotUid && clean(rec.plotUid) === uid) return true
      if (rec.plotNo && clean(rec.plotNo).toLowerCase() === plotNo.toLowerCase()) {
        if (!ph || !rec.phase || clean(rec.phase).toLowerCase() === ph.toLowerCase()) return true
      }
      return false
    }

    const bkDoc = bookings.find(matchesPlot)
    const bk = bkDoc?.booking || null
    const linkedLead = bk?.leadId ? leadById.get(bk.leadId) : null

    const plotLeads = leads.filter(
      (l) =>
        (bk?.leadId && l.id === bk.leadId) ||
        (l.unit && plotRe.test(String(l.unit))),
    )

    const plotPaymentsDirect = payments.filter(
      (p) => matchesPlot(p) || (p.unitAllotted && plotRe.test(String(p.unitAllotted))),
    )
    const plotActivities = activities.filter(matchesPlot)
    const plotActivityPayments = plotActivities.filter((a) => a.type === 'payment')
    const plotDocs = docs.filter(matchesPlot)

    // Reconcile payment rows without duplicates
    const combinedPayments = []
    for (const p of plotPaymentsDirect) {
      if (seenPaymentIds.has(p.id)) continue
      seenPaymentIds.add(p.id)
      combinedPayments.push({
        id: p.id,
        date: fmtDateOnly(p.paidOn || p.createdAt),
        amount: Number(p.amount) || 0,
        mode: p.mode || '',
        ref: p.referenceNo || '',
        status: p.status || 'Received',
        customerName: p.customerName || p.leadName || bk?.buyerName || '',
        note: p.note || p.paymentFor || '',
      })
    }
    for (const ap of plotActivityPayments) {
      if (ap.paymentId && seenPaymentIds.has(ap.paymentId)) continue
      if (seenPaymentIds.has(ap.id)) continue
      seenPaymentIds.add(ap.id)
      combinedPayments.push({
        id: ap.id,
        date: fmtDateOnly(ap.paidOn || ap.createdAt),
        amount: Number(ap.amount) || 0,
        mode: ap.mode || '',
        ref: ap.referenceNo || '',
        status: ap.status || 'Received',
        customerName: ap.customerName || bk?.buyerName || '',
        note: ap.note || '',
      })
    }

    const totalAgreed = parseRupees(bk?.totalPrice) ?? parseRupees(pl.price) ?? (linkedLead?.dealValue != null ? Number(linkedLead.dealValue) : null)
    const totalPaid = round2(combinedPayments.filter(isReceived).reduce((s, p) => s + p.amount, 0))
    const balance = totalAgreed != null ? round2(Math.max(totalAgreed - totalPaid, 0)) : null

    // 1. Plot Details Sheet Row
    plotDetailsRows.push({
      project: propName,
      phase: ph || 'Phase 1',
      plotNo,
      status: clean(pl.status || 'Available'),
      width: pl.width || '',
      length: pl.length || '',
      area: pl.area || '',
      frontage: pl.frontage || '',
      rearWidth: pl.rearWidth || '',
      leftSideLength: pl.leftSideLength || '',
      rightSideLength: pl.rightSideLength || '',
      facing: pl.facing || '',
      roadWidth: pl.roadWidth || '',
      type: pl.type || '',
      surveyNo: pl.surveyNo || '',
      listPrice: parseRupees(pl.price) ?? (pl.price || ''),
      agreedPrice: totalAgreed ?? '',
      totalPaid,
      outstandingBalance: balance ?? '',
      buyerName: bk?.buyerName || linkedLead?.name || '',
      docsCount: plotDocs.length,
    })

    // 2. Customer Details Rows
    const custCandidates = []
    if (bk?.buyerName) {
      const cust = (linkedLead?.customerId && customerById.get(linkedLead.customerId)) || (bk.phone && customerByPhone.get(clean(bk.phone)))
      custCandidates.push({
        key: `${plotNo}::booking::${clean(bk.phone || bk.buyerName)}`,
        name: bk.buyerName,
        phone: bk.phone || cust?.phone || '',
        email: bk.email || cust?.email || '',
        address: cust?.address || '',
        stage: linkedLead?.stage || 'Booked',
        bookedOn: bk.bookedOn || '',
        agreedPrice: parseRupees(bk.totalPrice) ?? '',
        notes: bk.notes || '',
      })
    }
    for (const ld of plotLeads) {
      const key = `${plotNo}::lead::${ld.id}`
      if (bk?.leadId === ld.id) continue
      const cust = (ld.customerId && customerById.get(ld.customerId)) || (ld.phone && customerByPhone.get(clean(ld.phone)))
      custCandidates.push({
        key,
        name: ld.name || '',
        phone: ld.phone || cust?.phone || '',
        email: ld.email || cust?.email || '',
        address: cust?.address || '',
        stage: ld.stage || '',
        bookedOn: '',
        agreedPrice: ld.dealValue != null ? Number(ld.dealValue) : '',
        notes: ld.notes || '',
      })
    }
    for (const c of custCandidates) {
      if (seenCustomerKeys.has(c.key)) continue
      seenCustomerKeys.add(c.key)
      customerRows.push({
        project: propName,
        phase: ph || 'Phase 1',
        plotNo,
        ...c,
      })
    }

    // 3. Broker Details Rows
    const refSources = [
      ...(bkDoc?.referral?.brokerId ? [{ ref: bkDoc.referral, customer: bk?.buyerName || '' }] : []),
      ...plotLeads.filter((l) => l.referral?.brokerId).map((l) => ({ ref: l.referral, customer: l.name || '' })),
    ]
    for (const { ref, customer } of refSources) {
      const bKey = `${plotNo}::${ref.brokerId}::${customer}`
      if (seenBrokerKeys.has(bKey)) continue
      seenBrokerKeys.add(bKey)
      const broker = brokerById.get(ref.brokerId)
      const payable = ref.commission && totalAgreed ? commissionAmount(ref.commission, totalAgreed) : (ref.commission?.type === 'fixed' ? ref.commission.value : null)
      const paid = brokerPays
        .filter((bp) => bp.brokerId === ref.brokerId && (bp.plotNo === plotNo || bp.leadId === bk?.leadId))
        .reduce((s, bp) => s + (Number(bp.amount) || 0), 0)
      brokerRows.push({
        project: propName,
        phase: ph || 'Phase 1',
        plotNo,
        brokerName: broker?.name || ref.brokerId,
        brokerPhone: broker?.phone || '',
        brokerEmail: broker?.email || '',
        customerName: customer,
        commissionTerms: ref.commission ? (ref.commission.type === 'percent' ? `${ref.commission.value}%` : `₹${Number(ref.commission.value).toLocaleString('en-IN')}`) : '—',
        commissionPayable: payable ?? '',
        commissionPaid: paid,
      })
    }

    // 4. Site Visits Rows
    const leadIdSet = new Set(plotLeads.map((l) => l.id))
    const plotVisits = visits.filter(
      (v) => (v.leadId && leadIdSet.has(v.leadId)) || (v.notes && plotRe.test(String(v.notes))),
    )
    for (const v of plotVisits) {
      const vKey = `${plotNo}::${v.id}`
      if (seenVisitIds.has(vKey)) continue
      seenVisitIds.add(vKey)
      visitRows.push({
        project: propName,
        phase: ph || 'Phase 1',
        plotNo,
        customerName: v.leadName || '',
        customerPhone: v.leadPhone || '',
        visitDate: v.dateLabel || v.visitDate || '',
        visitTime: v.visitTime || '',
        status: v.status || 'Scheduled',
        agent: v.assignedAgent?.name || '',
        notes: v.notes || '',
      })
    }

    // 5. Payment History Rows
    for (const pm of combinedPayments) {
      paymentRows.push({
        project: propName,
        phase: ph || 'Phase 1',
        plotNo,
        customerName: pm.customerName,
        paidOn: pm.date,
        amount: pm.amount,
        mode: pm.mode,
        referenceNo: pm.ref,
        status: pm.status,
        outstandingBalance: balance ?? '',
        note: pm.note,
      })
    }

    // 6. Activity Logs Rows
    for (const act of plotActivities) {
      if (seenActivityIds.has(act.id)) continue
      seenActivityIds.add(act.id)
      const changes = Array.isArray(act.changes) ? act.changes : []
      const prevVal = changes.map((c) => `${c.label || c.field}: ${c.from || '—'}`).join('; ')
      const nextVal = changes.map((c) => `${c.label || c.field}: ${c.to || '—'}`).join('; ')
      activityRows.push({
        project: propName,
        phase: ph || 'Phase 1',
        plotNo,
        dateTime: fmtDate(act.createdAt),
        type: act.type || 'update',
        title: act.title || '',
        previousValue: prevVal,
        updatedValue: nextVal,
        actor: act.actor?.name || 'CRM User',
        notes: act.note || '',
      })
    }
  }

  const scopeLabel =
    scope === 'project'
      ? `All Plots (${selectedPlots.length})`
      : selectedPlots.length === 1
        ? `Plot ${clean(selectedPlots[0].plotNo)}`
        : `${selectedPlots.length} Selected Plots`
  const subtitle = `Project: ${propName}${phase ? ` (${phase})` : ''}  |  Scope: ${scopeLabel}  |  Exported: ${today()} by ${by}`

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Crystal Estates CRM'
  workbook.created = new Date()

  buildStyledSheet(workbook, {
    title: 'Plot Details',
    subtitle,
    columns: [
      { key: 'project', header: 'Project', minWidth: 16 },
      { key: 'phase', header: 'Phase', minWidth: 12 },
      { key: 'plotNo', header: 'Plot No', minWidth: 12 },
      { key: 'status', header: 'Plot Status', minWidth: 13 },
      { key: 'width', header: 'Width', minWidth: 11 },
      { key: 'length', header: 'Length', minWidth: 11 },
      { key: 'area', header: 'Area', minWidth: 14 },
      { key: 'frontage', header: 'Frontage', minWidth: 12 },
      { key: 'rearWidth', header: 'Rear Width', minWidth: 12 },
      { key: 'leftSideLength', header: 'Left Side Length', minWidth: 15 },
      { key: 'rightSideLength', header: 'Right Side Length', minWidth: 15 },
      { key: 'facing', header: 'Facing', minWidth: 12 },
      { key: 'roadWidth', header: 'Road Width', minWidth: 12 },
      { key: 'type', header: 'Plot Type', minWidth: 16 },
      { key: 'surveyNo', header: 'Survey No.', minWidth: 14 },
      { key: 'listPrice', header: 'List Price', minWidth: 14, align: 'right' },
      { key: 'agreedPrice', header: 'Agreed Price', minWidth: 14, align: 'right' },
      { key: 'totalPaid', header: 'Total Paid', minWidth: 14, align: 'right' },
      { key: 'outstandingBalance', header: 'Outstanding Balance', minWidth: 18, align: 'right' },
      { key: 'buyerName', header: 'Buyer', minWidth: 18 },
      { key: 'docsCount', header: 'Documents', minWidth: 11, align: 'center' },
    ],
    rows: plotDetailsRows,
    currencyCols: ['listPrice', 'agreedPrice', 'totalPaid', 'outstandingBalance'],
    statusCols: ['status'],
  })

  buildStyledSheet(workbook, {
    title: 'Customer Details',
    subtitle,
    columns: [
      { key: 'project', header: 'Project', minWidth: 16 },
      { key: 'phase', header: 'Phase', minWidth: 12 },
      { key: 'plotNo', header: 'Plot No', minWidth: 12 },
      { key: 'name', header: 'Customer Name', minWidth: 20 },
      { key: 'phone', header: 'Contact Number', minWidth: 16 },
      { key: 'email', header: 'Email', minWidth: 22 },
      { key: 'address', header: 'Address', minWidth: 26 },
      { key: 'stage', header: 'Stage / Status', minWidth: 14 },
      { key: 'bookedOn', header: 'Booking Date', minWidth: 14 },
      { key: 'agreedPrice', header: 'Agreed Price', minWidth: 15, align: 'right' },
      { key: 'notes', header: 'Booking / Lead Notes', minWidth: 28 },
    ],
    rows: customerRows,
    currencyCols: ['agreedPrice'],
  })

  buildStyledSheet(workbook, {
    title: 'Broker Details',
    subtitle,
    columns: [
      { key: 'project', header: 'Project', minWidth: 16 },
      { key: 'phase', header: 'Phase', minWidth: 12 },
      { key: 'plotNo', header: 'Plot No', minWidth: 12 },
      { key: 'brokerName', header: 'Broker Name', minWidth: 20 },
      { key: 'brokerPhone', header: 'Broker Contact', minWidth: 16 },
      { key: 'brokerEmail', header: 'Broker Email', minWidth: 22 },
      { key: 'customerName', header: 'Customer Name', minWidth: 20 },
      { key: 'commissionTerms', header: 'Commission Rate', minWidth: 15 },
      { key: 'commissionPayable', header: 'Commission Payable', minWidth: 18, align: 'right' },
      { key: 'commissionPaid', header: 'Commission Paid', minWidth: 16, align: 'right' },
    ],
    rows: brokerRows,
    currencyCols: ['commissionPayable', 'commissionPaid'],
  })

  buildStyledSheet(workbook, {
    title: 'Site Visits',
    subtitle,
    columns: [
      { key: 'project', header: 'Project', minWidth: 16 },
      { key: 'phase', header: 'Phase', minWidth: 12 },
      { key: 'plotNo', header: 'Plot No', minWidth: 12 },
      { key: 'customerName', header: 'Customer Name', minWidth: 20 },
      { key: 'customerPhone', header: 'Contact Number', minWidth: 16 },
      { key: 'visitDate', header: 'Visit Date', minWidth: 14 },
      { key: 'visitTime', header: 'Scheduled Time', minWidth: 18 },
      { key: 'status', header: 'Visit Status', minWidth: 14 },
      { key: 'agent', header: 'Assigned Agent', minWidth: 16 },
      { key: 'notes', header: 'Visit Notes', minWidth: 28 },
    ],
    rows: visitRows,
    statusCols: ['status'],
  })

  buildStyledSheet(workbook, {
    title: 'Payment History',
    subtitle,
    columns: [
      { key: 'project', header: 'Project', minWidth: 16 },
      { key: 'phase', header: 'Phase', minWidth: 12 },
      { key: 'plotNo', header: 'Plot No', minWidth: 12 },
      { key: 'customerName', header: 'Customer Name', minWidth: 20 },
      { key: 'paidOn', header: 'Payment Date', minWidth: 14 },
      { key: 'amount', header: 'Amount', minWidth: 15, align: 'right' },
      { key: 'mode', header: 'Payment Method', minWidth: 16 },
      { key: 'referenceNo', header: 'Transaction / Ref ID', minWidth: 18 },
      { key: 'status', header: 'Payment Status', minWidth: 16 },
      { key: 'outstandingBalance', header: 'Outstanding Balance', minWidth: 18, align: 'right' },
      { key: 'note', header: 'Notes', minWidth: 26 },
    ],
    rows: paymentRows,
    currencyCols: ['amount', 'outstandingBalance'],
    statusCols: ['status'],
  })

  buildStyledSheet(workbook, {
    title: 'Activity Logs',
    subtitle,
    columns: [
      { key: 'project', header: 'Project', minWidth: 16 },
      { key: 'phase', header: 'Phase', minWidth: 12 },
      { key: 'plotNo', header: 'Plot No', minWidth: 12 },
      { key: 'dateTime', header: 'Date & Time', minWidth: 20 },
      { key: 'type', header: 'Activity Type', minWidth: 14 },
      { key: 'title', header: 'Activity', minWidth: 28 },
      { key: 'previousValue', header: 'Previous Value', minWidth: 24 },
      { key: 'updatedValue', header: 'Updated Value', minWidth: 24 },
      { key: 'actor', header: 'Updated By', minWidth: 18 },
      { key: 'notes', header: 'Notes', minWidth: 26 },
    ],
    rows: activityRows,
  })

  const safeSlug = propName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const suffix = scope === 'project' ? 'all-plots' : selectedPlots.length === 1 ? `plot-${clean(selectedPlots[0].plotNo).replace(/[^a-z0-9]+/gi, '-')}` : `${selectedPlots.length}-plots`
  return {
    workbook,
    filename: `${safeSlug}-${suffix}-activity-${today()}.xlsx`,
  }
}
