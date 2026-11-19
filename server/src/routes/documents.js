import { Router } from 'express'
import crypto from 'crypto'
import { getDb } from '../config/db.js'

/**
 * Customer documents: payment receipts, booking confirmations, payment
 * statements and uploaded files shared with a customer for a plot.
 *
 * `customer_documents` stores a snapshot of the customer, plot, booking and
 * payments at the time of sharing, so a sent document never changes later.
 * Customers open documents through GET /api/documents/:id/view?t=<token>;
 * the random token is the only way in.
 */
const router = Router()
const COLLECTION = 'customer_documents'

const BUSINESS = {
  name: 'Crystal Estates',
  tagline: 'Assets Creator',
  address: 'No. 9, A.K.R. Nagar Main Road, Crystal Tower, Ground Floor A, Valasaravakkam, Chennai 600087',
  phone: '+91 94440 00000',
  email: 'info@crystalestates.in',
}

const norm = (v) => (v === undefined || v === null ? '' : String(v).trim())
const esc = (v) =>
  norm(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
const rupees = (n) => (Number.isFinite(Number(n)) && n !== null && n !== '' ? `₹${Math.round(Number(n)).toLocaleString('en-IN')}` : '—')
const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? norm(d) : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "₹ 42 Lakhs" / "4200000" / "1.2 Cr" → rupees */
function parseRupees(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const s = String(value).toLowerCase().replace(/,/g, '')
  const m = s.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  let n = parseFloat(m[1])
  if (/\bcr|crore/.test(s)) n *= 10000000
  else if (/lakh|lac/.test(s)) n *= 100000
  return Math.round(n)
}

// uid first; plot number + phase as fallback (the CRM generates uids for
// plots stored without one, so the stored record may not carry it)
const samePlot = (p, uid, no, phase) =>
  (uid && p.uid === uid) ||
  (norm(no) && norm(p.plotNo).toLowerCase() === norm(no).toLowerCase() && (!phase || norm(p.phase) === norm(phase)))

/**
 * Collect everything a document needs from the database.
 * input: { leadId, customer?, propertyId, plotUid, plotNo, phase, paymentId }
 */
export async function buildSnapshot(db, input) {
  const { leadId, propertyId, plotUid, plotNo, phase, paymentId } = input

  const lead = leadId ? await db.collection('leads').findOne({ id: leadId }, { projection: { _id: 0, activity: 0, upcomingFollowUps: 0 } }) : null
  const customer = {
    leadId: lead?.id || null,
    name: norm(lead?.name || input.customer?.name),
    phone: norm(lead?.phone || input.customer?.phone),
    email: norm(lead?.email || input.customer?.email),
  }

  let project = null
  let plot = null
  if (propertyId) {
    const prop = await db.collection('featured_plots').findOne(
      { $or: [{ id: propertyId }, { projectId: propertyId }] },
      { projection: { _id: 0, id: 1, projectId: 1, name: 1, location: 1, approval: 1, approvalStatus: 1, plots: 1 } },
    )
    if (prop) {
      project = { id: prop.id, projectId: prop.projectId, name: prop.name, location: prop.location, approval: prop.approvalStatus || prop.approval || '' }
      const found = (prop.plots || []).find((p) => samePlot(p, plotUid, plotNo, phase))
      if (found || plotNo) {
        const src = found || { plotNo, phase }
        plot = {
          uid: src.uid || plotUid || null,
          plotNo: norm(src.plotNo),
          phase: norm(src.phase),
          area: norm(src.area),
          dimensions: norm(src.dimensions),
          facing: norm(src.facing),
          status: norm(src.status),
          listPrice: norm(src.price),
        }
      }
    }
  }

  let booking = null
  if (project && plot) {
    const bdoc = await db.collection('plot_bookings').findOne(
      { propertyId: project.id, ...(plot.uid ? { plotUid: plot.uid } : { plotNo: plot.plotNo }) },
      { projection: { _id: 0, booking: 1 } },
    )
    booking = bdoc?.booking || null
  }

  // Payments: lead payments (for this plot when known) + plot-log payments
  const payments = []
  const seen = new Set()
  const add = (p) => {
    const key = p.paymentId || p.id
    if (seen.has(key)) return
    seen.add(key)
    payments.push(p)
  }

  if (customer.leadId) {
    const leadPays = await db.collection('payments').find({ leadId: customer.leadId }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray()
    for (const p of leadPays) {
      if (plot && p.plotNo && norm(p.plotNo).toLowerCase() !== plot.plotNo.toLowerCase()) continue
      add({ id: p.id, paymentId: p.id, date: p.paidOn || p.createdAt, paymentFor: p.paymentFor, amount: Number(p.amount) || 0, mode: p.mode, referenceNo: p.referenceNo })
    }
  }
  if (project && plot) {
    const plotPays = await db
      .collection('plot_activity')
      .find({ propertyId: project.id, type: 'payment', ...(plot.uid ? { $or: [{ plotUid: plot.uid }, { plotNo: plot.plotNo }] } : { plotNo: plot.plotNo }) }, { projection: { _id: 0 } })
      .sort({ createdAt: 1 })
      .toArray()
    for (const a of plotPays) {
      add({ id: a.id, paymentId: a.paymentId || a.id, date: a.paidOn || a.createdAt, paymentFor: a.note || 'Payment', amount: Number(a.amount) || 0, mode: a.mode, referenceNo: a.referenceNo })
    }
  }
  payments.sort((a, b) => new Date(a.date) - new Date(b.date))

  const agreed = parseRupees(booking?.totalPrice) ?? parseRupees(plot?.listPrice)
  const received = payments.reduce((s, p) => s + p.amount, 0)
  const selectedPayment = paymentId ? payments.find((p) => p.paymentId === paymentId || p.id === paymentId) : payments[payments.length - 1]

  return {
    business: BUSINESS,
    customer,
    project,
    plot,
    booking,
    payments,
    totals: { agreed, received, balance: agreed != null ? Math.max(agreed - received, 0) : null },
    payment: selectedPayment || null,
  }
}

const TEMPLATE_KIND = (type) => {
  const t = norm(type).toLowerCase()
  if (t.includes('receipt')) return 'receipt'
  if (t.includes('booking')) return 'booking'
  if (t.includes('statement')) return 'statement'
  return 'cover'
}

/** Full standalone HTML for a document (used for preview and the customer link). */
export function renderDocumentHtml(doc) {
  const s = doc.snapshot || {}
  const kind = TEMPLATE_KIND(doc.type)
  const c = s.customer || {}
  const pr = s.project || {}
  const pl = s.plot || {}
  const b = s.booking || {}
  const t = s.totals || {}
  const p = s.payment || {}

  const row = (k, v) => (norm(v) ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : '')
  const plotTable = `
    <table class="kv">
      ${row('Project', pr.name)}${row('Location', pr.location)}${row('Approval', pr.approval)}
      ${row('Plot', pl.plotNo ? `Plot ${pl.plotNo}${pl.phase ? ` · ${pl.phase}` : ''}` : '')}
      ${row('Area', pl.area)}${row('Dimensions', pl.dimensions)}${row('Facing', pl.facing)}
    </table>`
  const customerTable = `
    <table class="kv">
      ${row('Name', c.name)}${row('Phone', c.phone)}${row('Email', c.email)}
    </table>`

  let body = ''
  if (kind === 'receipt') {
    body = `
      <div class="amount-box">
        <span>Amount received</span>
        <strong>${esc(rupees(p.amount))}</strong>
        <small>${esc([p.paymentFor, p.mode, p.referenceNo && `Ref ${p.referenceNo}`].filter(Boolean).join(' · '))}</small>
        <small>Paid on ${esc(fmtDate(p.date))}</small>
      </div>
      <div class="grid"><section><h3>Received from</h3>${customerTable}</section><section><h3>Towards</h3>${plotTable}</section></div>
      ${t.agreed != null ? `<div class="totals"><div><span>Agreed price</span><b>${esc(rupees(t.agreed))}</b></div><div><span>Total received</span><b>${esc(rupees(t.received))}</b></div><div><span>Balance due</span><b>${esc(rupees(t.balance))}</b></div></div>` : ''}`
  } else if (kind === 'booking') {
    body = `
      <p class="lead">We are pleased to confirm the booking of the plot below in the name of <b>${esc(b.buyerName || c.name)}</b>.</p>
      <div class="grid"><section><h3>Buyer</h3><table class="kv">${row('Name', b.buyerName || c.name)}${row('Phone', b.phone || c.phone)}${row('Email', b.email || c.email)}${row('Booking date', fmtDate(b.bookedOn))}</table></section><section><h3>Plot</h3>${plotTable}</section></div>
      <div class="totals"><div><span>Agreed price</span><b>${esc(rupees(t.agreed))}</b></div><div><span>Paid so far</span><b>${esc(rupees(t.received))}</b></div><div><span>Balance due</span><b>${esc(rupees(t.balance))}</b></div></div>
      ${b.notes ? `<p class="note"><b>Terms / notes:</b> ${esc(b.notes)}</p>` : ''}`
  } else if (kind === 'statement') {
    const rows = (s.payments || [])
      .map((x, i) => `<tr><td>${i + 1}</td><td>${esc(fmtDate(x.date))}</td><td>${esc(x.paymentFor)}</td><td>${esc(x.mode)}</td><td>${esc(x.referenceNo)}</td><td class="num">${esc(rupees(x.amount))}</td></tr>`)
      .join('')
    body = `
      <div class="grid"><section><h3>Customer</h3>${customerTable}</section><section><h3>Plot</h3>${plotTable}</section></div>
      <table class="ledger"><thead><tr><th>#</th><th>Date</th><th>For</th><th>Mode</th><th>Reference</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty">No payments recorded yet.</td></tr>'}</tbody></table>
      <div class="totals"><div><span>Agreed price</span><b>${esc(rupees(t.agreed))}</b></div><div><span>Total received</span><b>${esc(rupees(t.received))}</b></div><div><span>Balance due</span><b>${esc(rupees(t.balance))}</b></div></div>`
  } else {
    body = `
      <div class="grid"><section><h3>Customer</h3>${customerTable}</section><section><h3>Plot</h3>${plotTable}</section></div>
      ${doc.file?.url ? `<div class="file"><p>Attached file</p><a href="${esc(doc.file.absoluteUrl || doc.file.url)}" target="_blank" rel="noopener">${esc(doc.file.name || 'Open document')}</a></div>` : ''}`
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.title || doc.type)} · ${esc(BUSINESS.name)}</title>
<style>
  :root{--g:#0F3D2E;--gold:#B8964E;--ink:#18181B;--mut:#5e6660;--line:#e7e2d6}
  *{box-sizing:border-box}body{margin:0;background:#f4f2ec;font-family:Montserrat,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink)}
  .page{max-width:820px;margin:24px auto;background:#fff;border:1px solid var(--line);border-radius:18px;padding:40px 44px}
  header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid var(--g);padding-bottom:18px}
  .brand b{font-size:22px;color:var(--g);letter-spacing:-.02em}.brand span{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:600}
  .brand small{display:block;font-size:11.5px;color:var(--mut);margin-top:8px;max-width:330px;line-height:1.5}
  .meta{text-align:right}.meta h1{margin:0;font-size:20px;color:var(--ink)}.meta p{margin:4px 0 0;font-size:12px;color:var(--mut)}
  .lead{font-size:15px;line-height:1.6;margin:22px 0 0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:24px}
  h3{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin:0 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  .kv th{text-align:left;color:var(--mut);font-weight:500;padding:5px 10px 5px 0;width:38%;vertical-align:top}.kv td{padding:5px 0;font-weight:600}
  .ledger{margin-top:26px}.ledger th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);text-align:left;border-bottom:1px solid var(--line);padding:8px 6px}
  .ledger td{border-bottom:1px solid #f1eee6;padding:9px 6px}.num{text-align:right}.empty{text-align:center;color:var(--mut);padding:18px}
  .amount-box{margin-top:24px;background:var(--g);color:#f3efe4;border-radius:14px;padding:22px 24px;display:flex;flex-direction:column;gap:4px}
  .amount-box span{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d8c08a}.amount-box strong{font-size:34px;letter-spacing:-.02em}.amount-box small{font-size:12.5px;opacity:.85}
  .totals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px}.totals div{border:1px solid var(--line);border-radius:12px;padding:12px 14px}
  .totals span{display:block;font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}.totals b{font-size:17px}
  .note,.msg{font-size:13px;line-height:1.6;background:#faf8f2;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-top:22px}
  .file{margin-top:22px;border:1px dashed var(--gold);border-radius:12px;padding:16px}.file p{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--mut)}.file a{color:var(--g);font-weight:700}
  footer{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--mut);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .print{position:fixed;right:18px;bottom:18px;background:var(--g);color:#fff;border:0;border-radius:999px;padding:12px 20px;font:600 13px Montserrat,system-ui,sans-serif;cursor:pointer}
  @media (max-width:640px){.page{margin:0;border-radius:0;padding:24px 18px}header{flex-direction:column}.meta{text-align:left}.grid,.totals{grid-template-columns:1fr}.ledger{font-size:12px}}
  @media print{body{background:#fff}.page{margin:0;border:0;border-radius:0;max-width:none}.print{display:none}}
</style></head><body>
<main class="page">
  <header>
    <div class="brand"><b>${esc(BUSINESS.name)}</b><span>${esc(BUSINESS.tagline)}</span><small>${esc(BUSINESS.address)}<br>${esc(BUSINESS.phone)} · ${esc(BUSINESS.email)}</small></div>
    <div class="meta"><h1>${esc(doc.title || doc.type)}</h1><p>No. ${esc(doc.number || 'DRAFT')}</p><p>${esc(fmtDate(doc.createdAt || new Date()))}</p></div>
  </header>
  ${body}
  ${doc.message ? `<p class="msg">${esc(doc.message)}</p>` : ''}
  <footer><span>This is a computer-generated document from ${esc(BUSINESS.name)}.</span><span>${esc(BUSINESS.phone)}</span></footer>
</main>
${doc.number ? '<button class="print" onclick="window.print()">Download / Print PDF</button>' : ''}
</body></html>`
}

function sanitizeInput(body = {}) {
  return {
    leadId: norm(body.leadId) || null,
    customer: body.customer
      ? { name: norm(body.customer.name).slice(0, 120), phone: norm(body.customer.phone).slice(0, 30), email: norm(body.customer.email).slice(0, 160) }
      : null,
    propertyId: norm(body.propertyId) || null,
    plotUid: norm(body.plotUid) || null,
    plotNo: norm(body.plotNo) || null,
    phase: norm(body.phase) || null,
    paymentId: norm(body.paymentId) || null,
    type: norm(body.type).slice(0, 80) || 'Other document',
    title: norm(body.title).slice(0, 140),
    message: norm(body.message).slice(0, 2000),
    file: body.file?.url
      ? { url: norm(body.file.url).slice(0, 500), name: norm(body.file.name).slice(0, 200), size: norm(body.file.size).slice(0, 40) }
      : null,
    channels: Array.isArray(body.channels) ? body.channels.map((c) => norm(c).slice(0, 20)).slice(0, 6) : [],
  }
}

/** POST /api/documents/render — HTML preview of a draft (nothing saved) */
router.post('/render', async (req, res) => {
  try {
    const input = sanitizeInput(req.body)
    const db = await getDb()
    const snapshot = await buildSnapshot(db, input)
    const html = renderDocumentHtml({ ...input, snapshot, title: input.title || input.type })
    return res.json({ success: true, html, snapshot })
  } catch (err) {
    console.error('Document render error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/** GET /api/documents?leadId=&propertyId=&plotUid=&plotNo= — newest first */
router.get('/', async (req, res) => {
  try {
    const { leadId, propertyId, plotUid, plotNo } = req.query
    const filter = {}
    if (leadId) filter['snapshot.customer.leadId'] = leadId
    if (propertyId) filter.propertyId = propertyId
    if (plotUid || plotNo) {
      filter.$or = [plotUid && { plotUid }, plotNo && { plotNo: norm(plotNo) }].filter(Boolean)
    }
    const db = await getDb()
    const documents = await db
      .collection(COLLECTION)
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(300)
      .toArray()
    return res.json({ success: true, documents })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

/** POST /api/documents — save a document (snapshot taken now) and get its share link */
router.post('/', async (req, res) => {
  try {
    const input = sanitizeInput(req.body)
    if (!input.leadId && !input.customer?.name) {
      return res.status(400).json({ success: false, error: 'Select a customer' })
    }
    const db = await getDb()
    const snapshot = await buildSnapshot(db, input)
    if (TEMPLATE_KIND(input.type) === 'receipt' && !snapshot.payment) {
      return res.status(400).json({ success: false, error: 'This customer has no payment to issue a receipt for' })
    }
    if (TEMPLATE_KIND(input.type) === 'cover' && !input.file) {
      return res.status(400).json({ success: false, error: 'Upload a file for this document type' })
    }

    const count = await db.collection(COLLECTION).countDocuments()
    const doc = {
      id: `doc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      token: crypto.randomBytes(18).toString('hex'),
      number: `CE-D-${String(count + 1).padStart(5, '0')}`,
      ...input,
      title: input.title || input.type,
      snapshot,
      createdBy: req.body?.actor ? { name: norm(req.body.actor.name).slice(0, 120), email: norm(req.body.actor.email).slice(0, 160) } : null,
      createdAt: new Date(),
    }
    await db.collection(COLLECTION).insertOne(doc)

    // Keep the plot's own history in step
    if (snapshot.project && snapshot.plot) {
      await db.collection('plot_activity').insertOne({
        id: `pa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        propertyId: snapshot.project.id,
        propertyName: snapshot.project.name,
        phase: snapshot.plot.phase || null,
        plotUid: snapshot.plot.uid || null,
        plotNo: snapshot.plot.plotNo,
        type: 'document',
        title: `${doc.title} shared with ${snapshot.customer.name || 'customer'}`,
        note: [doc.number, input.channels.length ? `via ${input.channels.join(', ')}` : ''].filter(Boolean).join(' · '),
        documentId: doc.id,
        changes: [],
        actor: doc.createdBy || { name: 'CRM user', email: '' },
        createdAt: new Date(),
      })
    }

    const { _id, ...clean } = doc
    return res.status(201).json({ success: true, document: clean })
  } catch (err) {
    console.error('Document create error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/** GET /api/documents/:id/view?t=token — the customer-facing document page */
router.get('/:id/view', async (req, res) => {
  try {
    const db = await getDb()
    const doc = await db.collection(COLLECTION).findOne({ id: req.params.id }, { projection: { _id: 0 } })
    const token = norm(req.query.t)
    if (!doc || !token || token.length !== doc.token.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(doc.token))) {
      return res.status(404).send('Document not found')
    }
    if (doc.file?.url && !/^https?:/i.test(doc.file.url)) {
      doc.file.absoluteUrl = `${req.protocol}://${req.get('host')}${doc.file.url}`
    }
    res.set('Cache-Control', 'private, no-store')
    res.set('X-Robots-Tag', 'noindex')
    return res.type('html').send(renderDocumentHtml(doc))
  } catch (err) {
    return res.status(500).send('Could not open document')
  }
})

/** DELETE /api/documents/:id — remove a document record (uploaded file is kept) */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb()
    const result = await db.collection(COLLECTION).deleteOne({ id: req.params.id })
    if (!result.deletedCount) return res.status(404).json({ success: false, error: 'Document not found' })
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
