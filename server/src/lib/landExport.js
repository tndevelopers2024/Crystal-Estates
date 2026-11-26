import ExcelJS from 'exceljs'
import { C, loadLandData, indexLand, summarizePlots, acquisitionCost, round2, naturalCompare, withChanges, today, projectParties } from './land.js'

/**
 * Excel export of the land records, built with ExcelJS.
 *
 * Every sheet has a title block, a styled header row with filters, frozen
 * panes, real numbers and dates (not text), the Indian rupee format, zebra
 * rows and a totals row that uses SUBTOTAL so it follows the active filter.
 */

const GREEN = 'FF0F3D2E'
const SOFT = 'FFE2EDE8'
const ZEBRA = 'FFF6F8F7'
const LINE = 'FFD5DCD8'
const INK = 'FF1F2937'
const MUTED = 'FF6B7280'
const HEADER_ROW = 4

// Lakh / crore grouping for positive amounts, plain grouping for everything else
const MONEY = String.raw`[>=10000000]"₹"##\,##\,##\,##0;[>=100000]"₹"##\,##\,##0;"₹"#,##0`
const FORMATS = {
  money: MONEY,
  signed: '#,##0;[Red]-#,##0;0',
  date: 'dd-mmm-yyyy',
  datetime: 'dd-mmm-yyyy hh:mm',
  int: '#,##0',
  num: '#,##0.##',
  pct: '0.00"%"',
}

const thin = { style: 'thin', color: { argb: LINE } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

const toDate = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T00:00:00Z` : v)
  return Number.isNaN(d.getTime()) ? null : d
}

function cellValue(col, raw) {
  if (raw === undefined || raw === null || raw === '') return null
  if (col.type === 'date' || col.type === 'datetime') return toDate(raw)
  if (['money', 'signed', 'int', 'num', 'pct'].includes(col.type)) {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return String(raw)
}

const colLetter = (n) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}

/**
 * columns: [{ header, key, type?, width?, wrap?, total? }]
 * rows: plain objects keyed by column key.
 */
export function addSheet(wb, { name, title, subtitle, columns, rows }) {
  const ws = wb.addWorksheet(name.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }],
    properties: { tabColor: { argb: GREEN } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })
  const n = columns.length

  // Title block
  ws.mergeCells(1, 1, 1, Math.max(n, 2))
  const t = ws.getCell(1, 1)
  t.value = title
  t.font = { name: 'Calibri', size: 15, bold: true, color: { argb: GREEN } }
  t.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 26
  ws.mergeCells(2, 1, 2, Math.max(n, 2))
  const s = ws.getCell(2, 1)
  s.value = subtitle
  s.font = { name: 'Calibri', size: 10, italic: true, color: { argb: MUTED } }

  // Header row
  const header = ws.getRow(HEADER_ROW)
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { vertical: 'middle', horizontal: ['money', 'signed', 'int', 'num', 'pct'].includes(c.type) ? 'right' : 'left', wrapText: true }
    cell.border = BORDER
  })
  header.height = 30

  // Data rows
  const first = HEADER_ROW + 1
  rows.forEach((r, ri) => {
    const row = ws.getRow(first + ri)
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = cellValue(c, r[c.key])
      if (FORMATS[c.type]) cell.numFmt = FORMATS[c.type]
      cell.font = { name: 'Calibri', size: 11, color: { argb: INK } }
      cell.alignment = {
        vertical: 'top',
        horizontal: ['money', 'signed', 'int', 'num', 'pct'].includes(c.type) ? 'right' : c.type === 'date' || c.type === 'datetime' ? 'center' : 'left',
        wrapText: Boolean(c.wrap),
      }
      cell.border = BORDER
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
    })
  })
  const last = first + rows.length - 1

  // Column widths: header or the longest value, within sensible bounds
  columns.forEach((c, i) => {
    let w = c.width
    if (!w) {
      const longest = rows.reduce((m, r) => {
        const v = r[c.key]
        const len = v == null ? 0 : c.type === 'money' ? 14 : c.type === 'date' ? 12 : c.type === 'datetime' ? 17 : String(v).length
        return Math.max(m, len)
      }, 0)
      w = Math.min(Math.max(c.header.length + 3, longest + 2, 10), c.wrap ? 48 : 40)
    }
    ws.getColumn(i + 1).width = w
  })

  if (rows.length === 0) {
    ws.mergeCells(first, 1, first, Math.max(n, 2))
    const e = ws.getCell(first, 1)
    e.value = 'No records yet.'
    e.font = { name: 'Calibri', size: 11, italic: true, color: { argb: MUTED } }
    e.alignment = { horizontal: 'center' }
    return ws
  }

  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: last, column: n } }

  // Totals (SUBTOTAL ignores rows hidden by the filter)
  if (columns.some((c) => c.total)) {
    const tr = ws.getRow(last + 1)
    columns.forEach((c, i) => {
      const cell = tr.getCell(i + 1)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN } }
      cell.border = { top: { style: 'medium', color: { argb: GREEN } }, bottom: thin, left: thin, right: thin }
      if (i === 0) cell.value = 'Total'
      if (c.total) {
        const L = colLetter(i + 1)
        const result = round2(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0))
        cell.value = { formula: `SUBTOTAL(109,${L}${first}:${L}${last})`, result }
        cell.numFmt = FORMATS[c.type] || FORMATS.num
        cell.alignment = { horizontal: 'right' }
      }
    })
  }
  return ws
}

/* ───────────── Sheets ───────────── */

const sourceLabel = (p) => (p.source === 'broker' ? 'Through broker' : 'Direct')

function sheetsFor(ctx) {
  const { data, idx, scopeLabel } = ctx
  const projectName = (id) => idx.projectById.get(id)?.name || ''
  const partyName = (id) => idx.partyById.get(id)?.name || ''
  const plotsOf = (projectId) => idx.plots.filter((p) => p.projectId === projectId)
  const subtitle = (extra = '') => `Crystal Estates · ${scopeLabel} · Exported ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} by ${ctx.by}${extra ? ` · ${extra}` : ''}`
  const orderedPlots = [...idx.plots].sort((a, b) => naturalCompare(projectName(a.projectId), projectName(b.projectId)) || naturalCompare(a.block || '', b.block || '') || naturalCompare(a.plotNo, b.plotNo))

  const S = {}

  S.projects = () => {
    const rows = [...data.projects]
      .sort((a, b) => naturalCompare(a.name, b.name))
      .map((p) => {
        const sum = summarizePlots(plotsOf(p.id))
        const pu = p.purchase || {}
        const people = projectParties(p, idx.partyById)
        return {
          name: p.name,
          status: p.status,
          village: p.village,
          taluk: p.taluk,
          district: p.district,
          state: p.state,
          survey: p.surveyNumbers,
          area: p.totalArea,
          unit: p.areaUnit,
          landowner: partyName(people.landownerId),
          vendor: partyName(people.vendorId),
          brokers: people.brokerIds.map(partyName).filter(Boolean).join(', '),
          price: p.landPrice,
          rate: p.rate,
          priceDate: p.priceDate,
          stamp: pu.stampDuty,
          regCharges: pu.registrationCharges,
          other: pu.otherCosts,
          cost: acquisitionCost(p),
          paidOwner: pu.paidToOwner,
          balanceOwner: p.landPrice != null ? round2(p.landPrice - (pu.paidToOwner || 0)) : null,
          agreement: pu.agreementDate,
          registration: pu.registrationDate,
          regNo: pu.registrationNo,
          plots: sum.total,
          available: sum.available,
          hold: sum.hold,
          booked: sum.booked,
          sold: sum.sold,
          saleValue: sum.saleValue,
          received: sum.received,
          pending: sum.pending,
          notes: [p.notes, pu.notes].filter(Boolean).join(' | '),
        }
      })
    return addSheet(ctx.wb, {
      name: 'Projects',
      title: 'Land projects',
      subtitle: subtitle(`${rows.length} project${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Project', key: 'name', width: 28 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Village', key: 'village' },
        { header: 'Taluk', key: 'taluk' },
        { header: 'District', key: 'district' },
        { header: 'State', key: 'state' },
        { header: 'Survey numbers', key: 'survey', width: 22, wrap: true },
        { header: 'Total area', key: 'area', type: 'num', total: false },
        { header: 'Area unit', key: 'unit', width: 10 },
        { header: 'Landowner', key: 'landowner', width: 24 },
        { header: 'Vendor', key: 'vendor', width: 24 },
        { header: 'Brokers', key: 'brokers', width: 28, wrap: true },
        { header: 'Land price (₹)', key: 'price', type: 'money', total: true },
        { header: 'Rate per unit (₹)', key: 'rate', type: 'money' },
        { header: 'Price as on', key: 'priceDate', type: 'date' },
        { header: 'Stamp duty (₹)', key: 'stamp', type: 'money', total: true },
        { header: 'Registration charges (₹)', key: 'regCharges', type: 'money', total: true },
        { header: 'Other costs (₹)', key: 'other', type: 'money', total: true },
        { header: 'Total acquisition cost (₹)', key: 'cost', type: 'money', total: true },
        { header: 'Paid to owner (₹)', key: 'paidOwner', type: 'money', total: true },
        { header: 'Balance to owner (₹)', key: 'balanceOwner', type: 'money', total: true },
        { header: 'Agreement date', key: 'agreement', type: 'date' },
        { header: 'Registration date', key: 'registration', type: 'date' },
        { header: 'Registration no.', key: 'regNo', width: 18 },
        { header: 'Plots', key: 'plots', type: 'int', total: true },
        { header: 'Available', key: 'available', type: 'int', total: true },
        { header: 'Hold', key: 'hold', type: 'int', total: true },
        { header: 'Booked', key: 'booked', type: 'int', total: true },
        { header: 'Sold', key: 'sold', type: 'int', total: true },
        { header: 'Sale value (₹)', key: 'saleValue', type: 'money', total: true },
        { header: 'Received (₹)', key: 'received', type: 'money', total: true },
        { header: 'Pending (₹)', key: 'pending', type: 'money', total: true },
        { header: 'Notes', key: 'notes', width: 40, wrap: true },
      ],
      rows,
    })
  }

  S.plots = () => {
    const rows = orderedPlots.map((p) => ({
      project: projectName(p.projectId),
      block: p.block,
      plotNo: p.plotNo,
      area: p.area,
      dimensions: p.dimensions,
      facing: p.facing,
      road: p.roadWidth,
      survey: p.surveyNo,
      rate: p.rate,
      listPrice: p.listPrice,
      status: p.status,
      customer: p.customer?.name,
      phone: p.customer?.phone,
      email: p.customer?.email,
      address: p.customer?.address,
      source: p.customer || p.brokerId ? sourceLabel(p) : '',
      broker: partyName(p.brokerId),
      saleDate: p.saleDate,
      salePrice: p.salePrice,
      paid: p.paid,
      balance: p.balance,
      commission: p.commissionPayable,
      commissionPaid: p.commissionPaid,
      commissionPending: p.commissionPending,
      payStatus: p.paymentStatus,
      commStatus: p.commissionStatus,
      notes: p.notes,
    }))
    return addSheet(ctx.wb, {
      name: 'Plots',
      title: 'Plot details',
      subtitle: subtitle(`${rows.length} plot${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Block', key: 'block', width: 10 },
        { header: 'Plot no.', key: 'plotNo', width: 10 },
        { header: 'Area (sq.ft)', key: 'area', type: 'num', total: true },
        { header: 'Dimensions', key: 'dimensions', width: 14 },
        { header: 'Facing', key: 'facing', width: 12 },
        { header: 'Road width', key: 'road', width: 12 },
        { header: 'Survey no.', key: 'survey', width: 14 },
        { header: 'Rate (₹ / sq.ft)', key: 'rate', type: 'money' },
        { header: 'List price (₹)', key: 'listPrice', type: 'money', total: true },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Address', key: 'address', width: 30, wrap: true },
        { header: 'Source', key: 'source', width: 15 },
        { header: 'Broker', key: 'broker', width: 22 },
        { header: 'Sale date', key: 'saleDate', type: 'date' },
        { header: 'Sale price (₹)', key: 'salePrice', type: 'money', total: true },
        { header: 'Paid (₹)', key: 'paid', type: 'money', total: true },
        { header: 'Balance (₹)', key: 'balance', type: 'money', total: true },
        { header: 'Commission payable (₹)', key: 'commission', type: 'money', total: true },
        { header: 'Commission paid (₹)', key: 'commissionPaid', type: 'money', total: true },
        { header: 'Commission pending (₹)', key: 'commissionPending', type: 'money', total: true },
        { header: 'Payment status', key: 'payStatus', width: 15 },
        { header: 'Commission status', key: 'commStatus', width: 17 },
        { header: 'Notes', key: 'notes', width: 34, wrap: true },
      ],
      rows,
    })
  }

  S.priceLog = () => {
    const rows = []
    for (const pr of [...data.projects].sort((a, b) => naturalCompare(a.name, b.name))) {
      for (const e of withChanges(data.priceLogs.filter((x) => x.projectId === pr.id))) {
        rows.push({ project: pr.name, date: e.date, rate: e.rate, unit: e.rateUnit, total: e.totalPrice, change: e.change, pct: e.changePercent, reason: e.reason, by: e.by?.name, at: e.createdAt })
      }
    }
    return addSheet(ctx.wb, {
      name: 'Price Log',
      title: 'Price log',
      subtitle: subtitle(`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}, newest first within each project`),
      columns: [
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Date', key: 'date', type: 'date' },
        { header: 'Rate per unit (₹)', key: 'rate', type: 'money' },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Total price (₹)', key: 'total', type: 'money' },
        { header: 'Change (₹)', key: 'change', type: 'signed' },
        { header: 'Change (%)', key: 'pct', type: 'pct' },
        { header: 'Reason / note', key: 'reason', width: 40, wrap: true },
        { header: 'Recorded by', key: 'by', width: 18 },
        { header: 'Recorded on', key: 'at', type: 'datetime' },
      ],
      rows,
    })
  }

  S.documents = () => {
    const rows = [...data.docs]
      .sort((a, b) => naturalCompare(projectName(a.projectId), projectName(b.projectId)) || new Date(b.createdAt) - new Date(a.createdAt))
      .map((d) => ({
        project: projectName(d.projectId),
        plot: d.plotNo ? `Plot ${d.plotNo}` : 'Whole project',
        type: d.docType,
        title: d.title,
        ref: d.refNo,
        date: d.docDate,
        status: d.status,
        heldBy: d.heldBy,
        file: d.file ? d.file.name : 'No file attached',
        size: d.file ? Math.round(d.file.size / 1024) : null,
        notes: d.notes,
        by: d.by?.name,
        at: d.createdAt,
      }))
    return addSheet(ctx.wb, {
      name: 'Document Log',
      title: 'Document log',
      subtitle: subtitle(`${rows.length} document${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Applies to', key: 'plot', width: 14 },
        { header: 'Document type', key: 'type', width: 24 },
        { header: 'Title', key: 'title', width: 30, wrap: true },
        { header: 'Reference no.', key: 'ref', width: 18 },
        { header: 'Document date', key: 'date', type: 'date' },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Held by', key: 'heldBy', width: 20 },
        { header: 'File', key: 'file', width: 28 },
        { header: 'Size (KB)', key: 'size', type: 'int' },
        { header: 'Notes', key: 'notes', width: 36, wrap: true },
        { header: 'Added by', key: 'by', width: 18 },
        { header: 'Added on', key: 'at', type: 'datetime' },
      ],
      rows,
    })
  }

  S.vendors = () => {
    const used = new Map()
    for (const p of data.projects) {
      const people = projectParties(p, idx.partyById)
      for (const id of new Set([people.landownerId, people.vendorId].filter(Boolean))) (used.get(id) || used.set(id, []).get(id)).push(p.name)
    }
    const list = data.parties.filter((p) => p.type === 'vendor' && (!ctx.projectId || used.has(p.id))).sort((a, b) => a.name.localeCompare(b.name))
    const rows = list.map((v) => ({ name: v.name, kind: v.kind, phone: v.phone, alt: v.altPhone, email: v.email, address: v.address, projects: (used.get(v.id) || []).join(', '), count: (used.get(v.id) || []).length, active: v.active === false ? 'Inactive' : 'Active', notes: v.notes }))
    return addSheet(ctx.wb, {
      name: 'Landowners & Vendors',
      title: 'Landowners and vendors',
      subtitle: subtitle(`${rows.length} record${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Type', key: 'kind', width: 12 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Alternate phone', key: 'alt', width: 16 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Address', key: 'address', width: 34, wrap: true },
        { header: 'Projects', key: 'projects', width: 32, wrap: true },
        { header: 'No. of projects', key: 'count', type: 'int', total: true },
        { header: 'Status', key: 'active', width: 11 },
        { header: 'Notes', key: 'notes', width: 34, wrap: true },
      ],
      rows,
    })
  }

  S.brokers = () => {
    const byBroker = new Map()
    for (const p of idx.plots) if (p.brokerId) (byBroker.get(p.brokerId) || byBroker.set(p.brokerId, []).get(p.brokerId)).push(p)
    const onProject = new Set(data.projects.flatMap((p) => p.brokerIds || []))
    const list = data.parties.filter((p) => p.type === 'broker' && (!ctx.projectId || byBroker.has(p.id) || onProject.has(p.id))).sort((a, b) => a.name.localeCompare(b.name))
    const rows = list.map((b) => {
      const plots = byBroker.get(b.id) || []
      const dc = b.defaultCommission
      return {
        name: b.name,
        phone: b.phone,
        alt: b.altPhone,
        email: b.email,
        address: b.address,
        usual: dc ? (dc.type === 'percent' ? `${dc.value}%` : `₹${dc.value.toLocaleString('en-IN')} fixed`) : '',
        active: b.active === false ? 'Inactive' : 'Active',
        plots: plots.length,
        saleValue: round2(plots.reduce((s, p) => s + (p.salePrice || 0), 0)),
        payable: round2(plots.reduce((s, p) => s + p.commissionPayable, 0)),
        paid: round2(plots.reduce((s, p) => s + p.commissionPaid, 0)),
        pending: round2(plots.reduce((s, p) => s + p.commissionPending, 0)),
        notes: b.notes,
      }
    })
    return addSheet(ctx.wb, {
      name: 'Brokers',
      title: 'Brokers',
      subtitle: subtitle(`${rows.length} broker${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Broker', key: 'name', width: 26 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Alternate phone', key: 'alt', width: 16 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Address', key: 'address', width: 32, wrap: true },
        { header: 'Usual commission', key: 'usual', width: 18 },
        { header: 'Status', key: 'active', width: 11 },
        { header: 'Plots assigned', key: 'plots', type: 'int', total: true },
        { header: 'Sale value (₹)', key: 'saleValue', type: 'money', total: true },
        { header: 'Commission payable (₹)', key: 'payable', type: 'money', total: true },
        { header: 'Commission paid (₹)', key: 'paid', type: 'money', total: true },
        { header: 'Commission pending (₹)', key: 'pending', type: 'money', total: true },
        { header: 'Notes', key: 'notes', width: 32, wrap: true },
      ],
      rows,
    })
  }

  S.commission = () => {
    const rows = orderedPlots
      .filter((p) => p.brokerId)
      .map((p) => ({
        project: projectName(p.projectId),
        plot: p.plotNo,
        broker: partyName(p.brokerId),
        customer: p.customer?.name,
        status: p.status,
        salePrice: p.salePrice,
        type: p.commission ? (p.commission.type === 'percent' ? 'Percentage' : 'Fixed amount') : 'Not set',
        value: p.commission?.value,
        payable: p.commissionPayable,
        paid: p.commissionPaid,
        pending: p.commissionPending,
        status: p.commissionStatus,
        note: p.commission?.note,
      }))
    return addSheet(ctx.wb, {
      name: 'Commission',
      title: 'Broker commission by plot',
      subtitle: subtitle(`${rows.length} plot${rows.length === 1 ? '' : 's'} sold through brokers`),
      columns: [
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Plot no.', key: 'plot', width: 10 },
        { header: 'Broker', key: 'broker', width: 24 },
        { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Sale price (₹)', key: 'salePrice', type: 'money', total: true },
        { header: 'Commission basis', key: 'type', width: 16 },
        { header: 'Rate / amount', key: 'value', type: 'num' },
        { header: 'Payable (₹)', key: 'payable', type: 'money', total: true },
        { header: 'Paid (₹)', key: 'paid', type: 'money', total: true },
        { header: 'Pending (₹)', key: 'pending', type: 'money', total: true },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Note', key: 'note', width: 30, wrap: true },
      ],
      rows,
    })
  }

  S.commissionPayments = () => {
    const rows = [...data.commPayments]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((c) => ({
        date: c.date,
        project: projectName(c.projectId),
        plot: idx.plotById.get(c.plotId)?.plotNo,
        broker: partyName(c.brokerId),
        amount: c.amount,
        mode: c.mode,
        ref: c.referenceNo,
        note: c.note,
        by: c.by?.name,
      }))
    return addSheet(ctx.wb, {
      name: 'Commission Payments',
      title: 'Commission paid to brokers',
      subtitle: subtitle(`${rows.length} payment${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Date', key: 'date', type: 'date' },
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Plot no.', key: 'plot', width: 10 },
        { header: 'Broker', key: 'broker', width: 24 },
        { header: 'Amount (₹)', key: 'amount', type: 'money', total: true },
        { header: 'Mode', key: 'mode', width: 20 },
        { header: 'Reference no.', key: 'ref', width: 18 },
        { header: 'Note', key: 'note', width: 32, wrap: true },
        { header: 'Recorded by', key: 'by', width: 18 },
      ],
      rows,
    })
  }

  S.payments = () => {
    const rows = [...data.payments]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((p) => {
        const plot = idx.plotById.get(p.plotId)
        return {
          date: p.date,
          project: projectName(p.projectId),
          block: plot?.block,
          plot: plot?.plotNo,
          customer: plot?.customer?.name,
          phone: plot?.customer?.phone,
          source: plot ? sourceLabel(plot) : '',
          broker: partyName(plot?.brokerId),
          label: p.label,
          amount: p.amount,
          mode: p.mode,
          ref: p.referenceNo,
          note: p.note,
          by: p.by?.name,
        }
      })
    return addSheet(ctx.wb, {
      name: 'Customer Payments',
      title: 'Customer payments',
      subtitle: subtitle(`${rows.length} payment${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Date', key: 'date', type: 'date' },
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Block', key: 'block', width: 10 },
        { header: 'Plot no.', key: 'plot', width: 10 },
        { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Source', key: 'source', width: 15 },
        { header: 'Broker', key: 'broker', width: 22 },
        { header: 'Payment for', key: 'label', width: 20 },
        { header: 'Amount (₹)', key: 'amount', type: 'money', total: true },
        { header: 'Mode', key: 'mode', width: 20 },
        { header: 'Reference no.', key: 'ref', width: 18 },
        { header: 'Note', key: 'note', width: 32, wrap: true },
        { header: 'Recorded by', key: 'by', width: 18 },
      ],
      rows,
    })
  }

  S.paymentSummary = () => {
    const rows = orderedPlots
      .filter((p) => p.customer?.name)
      .map((p) => ({
        project: projectName(p.projectId),
        plot: p.plotNo,
        customer: p.customer.name,
        phone: p.customer.phone,
        status: p.status,
        salePrice: p.salePrice,
        paid: p.paid,
        balance: p.balance,
        last: p.lastPaymentDate,
      }))
    return addSheet(ctx.wb, {
      name: 'Payment Balances',
      title: 'Customer payment balances by plot',
      subtitle: subtitle(`${rows.length} customer plot${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Plot no.', key: 'plot', width: 10 },
        { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Sale price (₹)', key: 'salePrice', type: 'money', total: true },
        { header: 'Paid (₹)', key: 'paid', type: 'money', total: true },
        { header: 'Balance (₹)', key: 'balance', type: 'money', total: true },
        { header: 'Last payment', key: 'last', type: 'date' },
      ],
      rows,
    })
  }

  S.customers = () => {
    const rows = orderedPlots
      .filter((p) => p.customer?.name)
      .map((p) => ({
        project: projectName(p.projectId),
        plot: p.plotNo,
        block: p.block,
        name: p.customer.name,
        phone: p.customer.phone,
        email: p.customer.email,
        address: p.customer.address,
        plotStatus: p.status,
        source: sourceLabel(p),
        broker: partyName(p.brokerId),
        saleDate: p.saleDate,
        salePrice: p.salePrice,
        paid: p.paid,
        balance: p.balance,
        payStatus: p.paymentStatus,
        last: p.lastPaymentDate,
        commission: p.commissionPayable,
        commPaid: p.commissionPaid,
        commPending: p.commissionPending,
        commStatus: p.commissionStatus,
      }))
    return addSheet(ctx.wb, {
      name: 'Customers',
      title: 'Plot customers',
      subtitle: subtitle(`${rows.length} customer${rows.length === 1 ? '' : 's'}`),
      columns: [
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Plot no.', key: 'plot', width: 10 },
        { header: 'Block', key: 'block', width: 10 },
        { header: 'Customer', key: 'name', width: 24 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Address', key: 'address', width: 30, wrap: true },
        { header: 'Plot status', key: 'plotStatus', width: 12 },
        { header: 'Source', key: 'source', width: 15 },
        { header: 'Broker', key: 'broker', width: 22 },
        { header: 'Sale date', key: 'saleDate', type: 'date' },
        { header: 'Sale price (₹)', key: 'salePrice', type: 'money', total: true },
        { header: 'Paid (₹)', key: 'paid', type: 'money', total: true },
        { header: 'Balance (₹)', key: 'balance', type: 'money', total: true },
        { header: 'Payment status', key: 'payStatus', width: 15 },
        { header: 'Last payment', key: 'last', type: 'date' },
        { header: 'Commission payable (₹)', key: 'commission', type: 'money', total: true },
        { header: 'Commission paid (₹)', key: 'commPaid', type: 'money', total: true },
        { header: 'Commission pending (₹)', key: 'commPending', type: 'money', total: true },
        { header: 'Commission status', key: 'commStatus', width: 17 },
      ],
      rows,
    })
  }

  S.notes = () => {
    const rows = data.logs
      .filter((l) => l.type === 'note')
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .map((l) => ({
        at: l.at,
        project: projectName(l.projectId),
        plot: l.plotNo,
        about: l.target === 'customer' ? `Customer: ${l.customerName || ''}` : 'Plot',
        note: l.details,
        by: l.by?.name,
        edited: l.editedAt,
      }))
    return addSheet(ctx.wb, {
      name: 'Plot Notes',
      title: 'Notes on plots and customers',
      subtitle: subtitle(`${rows.length} note${rows.length === 1 ? '' : 's'}, newest first`),
      columns: [
        { header: 'Date and time', key: 'at', type: 'datetime' },
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Plot no.', key: 'plot', width: 10 },
        { header: 'About', key: 'about', width: 28 },
        { header: 'Note', key: 'note', width: 60, wrap: true },
        { header: 'Added by', key: 'by', width: 18 },
        { header: 'Last edited', key: 'edited', type: 'datetime' },
      ],
      rows,
    })
  }

  S.history = () => {
    const rows = [...data.logs]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .map((l) => ({
        at: l.at,
        project: projectName(l.projectId),
        plot: l.plotNo,
        type: l.type,
        title: l.title,
        details: l.details,
        changes: (l.changes || []).map((c) => `${c.label}: ${c.from} → ${c.to}`).join('\n'),
        by: l.by?.name,
      }))
    return addSheet(ctx.wb, {
      name: 'Plot History',
      title: 'Plot history',
      subtitle: subtitle(`${rows.length} event${rows.length === 1 ? '' : 's'}, newest first`),
      columns: [
        { header: 'When', key: 'at', type: 'datetime' },
        { header: 'Project', key: 'project', width: 26 },
        { header: 'Plot no.', key: 'plot', width: 10 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Event', key: 'title', width: 38, wrap: true },
        { header: 'Details', key: 'details', width: 30, wrap: true },
        { header: 'Changes', key: 'changes', width: 44, wrap: true },
        { header: 'By', key: 'by', width: 18 },
      ],
      rows,
    })
  }

  return S
}

const WHOLE = ['projects', 'plots', 'customers', 'priceLog', 'documents', 'vendors', 'brokers', 'commission', 'commissionPayments', 'payments', 'paymentSummary', 'history', 'notes']
const SETS = {
  all: WHOLE,
  project: WHOLE,
  projects: ['projects'],
  plots: ['plots'],
  customers: ['customers'],
  notes: ['notes'],
  'price-log': ['priceLog'],
  documents: ['documents'],
  payments: ['payments', 'paymentSummary'],
  commissions: ['commission', 'commissionPayments'],
  brokers: ['brokers'],
  vendors: ['vendors'],
  history: ['history'],
}
const LABEL = { all: 'All records', project: 'Project', projects: 'Projects', plots: 'Plots', customers: 'Customers', notes: 'Notes', 'price-log': 'Price log', documents: 'Document log', payments: 'Customer payments', commissions: 'Commission', brokers: 'Brokers', vendors: 'Landowners and vendors', history: 'Plot history' }

const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 50)

/**
 * type: all | project | projects | plots | price-log | documents | payments | commissions | brokers | vendors | history
 * projectId: limits the workbook to one project.
 */
export async function buildWorkbook(db, { type = 'all', projectId = null, by = 'CRM user' }) {
  const data = await loadLandData(db, projectId)
  const idx = indexLand(data)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Crystal Estates CRM'
  wb.created = new Date()
  wb.title = 'Land records'

  const project = projectId ? data.projects[0] : null
  const scopeLabel = project ? `Project: ${project.name}` : 'All projects'
  const ctx = { wb, data, idx, projectId, scopeLabel, by }
  const sheets = sheetsFor(ctx)
  for (const key of SETS[type] || WHOLE) sheets[key]()

  const filename = `Land-${safe(project ? project.name : 'All-projects')}-${safe(LABEL[type] || type)}-${today()}.xlsx`
  return { workbook: wb, filename }
}

export { C }
