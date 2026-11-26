/**
 * Land purchase & management API: CRUD, money rules (balances, commission),
 * history, document files and the Excel export (ExcelJS).
 * Runs against a small in-memory stand-in for the Mongo driver and for file
 * storage, never the real database. Needs module mocking:
 *   npm run test:land        (node --experimental-test-module-mocks --test test-unit/land.test.js)
 */
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import multer from 'multer'
import ExcelJS from 'exceljs'

const src = (p) => new URL(`../src/${p}`, import.meta.url).href

/* ── in-memory Mongo ── */
function matchQ(doc, q) {
  return Object.entries(q).every(([k, cond]) => {
    if (k === '$or') return cond.some((c) => matchQ(doc, c))
    const v = doc[k]
    if (cond instanceof RegExp) return typeof v === 'string' && cond.test(v)
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('$in' in cond) return cond.$in.some((x) => x === v || (x == null && v == null))
      if ('$ne' in cond) return cond.$ne === null ? v != null : v !== cond.$ne
    }
    if (Array.isArray(v)) return v.includes(cond)
    return cond === null ? v == null : v === cond
  })
}
const project = (doc, proj) => {
  const d = structuredClone(doc)
  if (!proj) return d
  const keys = Object.keys(proj).filter((k) => k !== '_id')
  if (keys.length && proj[keys[0]] === 1) return Object.fromEntries(keys.filter((k) => k in d).map((k) => [k, d[k]]))
  for (const k of keys) delete d[k]
  return d
}
function makeDb() {
  const cols = {}
  const col = (name) =>
    (cols[name] ||= {
      rows: [],
      find(q = {}, o = {}) {
        let rows = this.rows.filter((d) => matchQ(d, q))
        const c = {
          sort(spec) {
            const [[k, dir]] = Object.entries(spec)
            rows = [...rows].sort((a, b) => (a[k] < b[k] ? -dir : a[k] > b[k] ? dir : 0))
            return c
          },
          limit(n) { rows = rows.slice(0, n); return c },
          async toArray() { return rows.map((r) => project(r, o.projection)) },
        }
        return c
      },
      async findOne(q = {}, o = {}) { const r = this.rows.find((d) => matchQ(d, q)); return r ? project(r, o.projection) : null },
      async insertOne(d) { this.rows.push(structuredClone(d)); return { insertedId: d.id } },
      async insertMany(ds) { ds.forEach((d) => this.rows.push(structuredClone(d))) },
      async replaceOne(q, d) { const i = this.rows.findIndex((r) => matchQ(r, q)); if (i >= 0) this.rows[i] = structuredClone(d) },
      async updateOne(q, u) { const r = this.rows.find((d) => matchQ(d, q)); if (r) Object.assign(r, structuredClone(u.$set || {})) },
      async updateMany(q, u) { this.rows.filter((d) => matchQ(d, q)).forEach((r) => Object.assign(r, structuredClone(u.$set || {}))) },
      async deleteOne(q) { const i = this.rows.findIndex((r) => matchQ(r, q)); if (i >= 0) this.rows.splice(i, 1) },
      async deleteMany(q) { this.rows = this.rows.filter((r) => !matchQ(r, q)) },
      async findOneAndDelete(q) { const i = this.rows.findIndex((r) => matchQ(r, q)); return i >= 0 ? this.rows.splice(i, 1)[0] : null },
      async countDocuments(q = {}) { return this.rows.filter((d) => matchQ(d, q)).length },
      async createIndex() {},
    })
  return { collection: col, cols }
}
const db = makeDb()

/* ── file storage stand-in (the real GridFS lives in plotDocuments.js) ── */
const files = new Map()
const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })
const TYPES = [
  { mime: 'application/pdf', ext: 'pdf', t: (b) => b.slice(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: 'png', t: (b) => b[0] === 0x89 && b[1] === 0x50 },
]
mock.module(src('config/db.js'), { namedExports: { getDb: async () => db, getClient: async () => null, closeDb: async () => {} } })
mock.module(src('routes/plotDocuments.js'), {
  namedExports: {
    sniff: (b) => TYPES.find((x) => b.length > 8 && x.t(b)) || null,
    cleanName: (v, ext) => `${String(v || 'document').replace(/\.[a-z0-9]{1,5}$/i, '') || 'document'}.${ext}`,
    single: (rq, rs, next) => up.single('file')(rq, rs, (e) => (e ? rs.status(400).json({ success: false, error: e.message }) : next())),
    storeFile: async (_d, buf) => { const id = `f${files.size + 1}`; files.set(id, buf); return { fileId: id, encoding: null, storedSize: buf.length } },
    readPlotDocumentFile: async (_d, doc) => files.get(doc.fileId),
    dropFile: async (_d, id) => { files.delete(id) },
  },
})

const router = (await import(src('routes/land.js'))).default
let role = { superAdmin: true, permissions: {} }
const app = express()
app.use(express.json())
app.use((r, _s, n) => ((r.user = { name: 'Tester', email: 't@example.com' }), (r.role = role), n()))
app.use('/api/land', router)
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api/land`
const call = async (method, p, body) => {
  const res = await fetch(base + p, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, ...(await res.json().catch(() => ({}))) }
}
const get = (p) => call('GET', p)
const post = (p, b) => call('POST', p, b)
const patch = (p, b) => call('PATCH', p, b)
const del = (p) => call('DELETE', p)
test.after(() => server.close())

const S = {} // shared state across ordered tests

test('parties: validation, duplicates, usage', async () => {
  assert.equal((await post('/parties', { type: 'vendor', name: '' })).status, 400)
  assert.equal((await post('/parties', { type: 'vendor', name: 'X', phone: 'abc' })).status, 400)
  const v = await post('/parties', { type: 'vendor', name: 'Ramasamy', kind: 'Landowner', phone: '98765 43210' })
  const vd = await post('/parties', { type: 'vendor', name: 'Kumar Agency', kind: 'Vendor' })
  assert.equal(vd.status, 201)
  S.vendorParty = vd.party
  assert.equal(v.status, 201)
  S.vendor = v.party
  assert.equal((await post('/parties', { type: 'vendor', name: 'ramasamy' })).status, 409)
  const b = await post('/parties', { type: 'broker', name: 'Suresh', phone: '9000000001', defaultCommission: { type: 'percent', value: 2 } })
  assert.equal(b.status, 201)
  S.broker = b.party
  const second = await post('/parties', { type: 'broker', name: 'Mani' })
  assert.equal(second.status, 201)
  S.broker2 = second.party
  assert.equal((await post('/parties', { type: 'broker', name: 'Bad', defaultCommission: { type: 'percent', value: 150 } })).status, 400)
  const list = await get('/parties?type=broker')
  assert.deepEqual(list.parties.map((p) => p.name), ['Mani', 'Suresh'])
  assert.equal((await patch(`/parties/${S.broker.id}`, { phone: '9000000002' })).party.phone, '9000000002')
  const temp = (await post('/parties', { type: 'broker', name: 'Temporary' })).party
  assert.equal((await del(`/parties/${temp.id}`)).success, true)
})

test('project: opening price becomes the first price-log line, summary, duplicates', async () => {
  assert.equal((await post('/projects', { name: '' })).status, 400)
  assert.equal((await post('/projects', { name: 'P', totalArea: -1 })).status, 400)
  assert.equal((await post('/projects', { name: 'P', vendorId: 'nope' })).status, 400)
  assert.equal((await post('/projects', { name: 'P', landownerId: S.vendorParty.id })).status, 400, 'a vendor is not a landowner')
  assert.equal((await post('/projects', { name: 'P', vendorId: S.vendor.id })).status, 400, 'a landowner is not a vendor')
  assert.equal((await post('/projects', { name: 'P', brokerIds: ['nope'] })).status, 400)
  assert.equal((await post('/projects', { name: 'P', brokerIds: [S.vendor.id] })).status, 400, 'only brokers can be project brokers')
  const r = await post('/projects', { name: 'Green Valley', village: 'Somamangalam', district: 'Kancheepuram', totalArea: 10, areaUnit: 'Acres', landownerId: S.vendor.id, vendorId: S.vendorParty.id, brokerIds: [S.broker.id, S.broker.id, S.broker2.id], rate: 500000, priceDate: '2026-01-01', status: 'Registered', purchase: { stampDuty: 100000, registrationCharges: 50000, paidToOwner: 1000000 } })
  assert.equal(r.status, 201)
  S.project = r.project
  assert.equal(r.project.landPrice, 5000000, 'total = rate x area')
  assert.equal(r.project.rate, 500000)
  assert.equal(r.project.acquisitionCost, 5150000)
  assert.equal(r.project.balanceToOwner, 4000000)
  assert.equal(r.project.landownerName, 'Ramasamy')
  assert.equal(r.project.vendorName, 'Kumar Agency')
  assert.deepEqual(r.project.brokerNames, ['Suresh', 'Mani'], 'several brokers, no duplicates')
  const detail = await get(`/projects/${r.project.id}`)
  assert.equal(detail.landowner.name, 'Ramasamy')
  assert.equal(detail.vendor.name, 'Kumar Agency')
  assert.deepEqual(detail.brokers.map((b) => b.name), ['Suresh', 'Mani'])
  assert.equal(r.project.priceLogCount, 1)
  assert.equal((await post('/projects', { name: 'green valley' })).status, 409)
  const vendors = (await get('/parties?type=vendor')).parties
  assert.equal(vendors.find((x) => x.id === S.vendor.id).usage, 1)
  assert.equal((await del(`/parties/${S.vendor.id}`)).status, 409, 'landowner in use cannot be deleted')
  assert.equal((await del(`/parties/${S.vendorParty.id}`)).status, 409, 'vendor in use cannot be deleted')
  assert.equal((await del(`/parties/${S.broker2.id}`)).status, 409, 'a broker on a project cannot be deleted')
  assert.equal((await get('/parties?type=broker')).parties.find((x) => x.id === S.broker2.id).projects, 1)
  // changing the brokers of a project, then the removed one can go
  assert.deepEqual((await patch(`/projects/${r.project.id}`, { brokerIds: [S.broker.id] })).project.brokerNames, ['Suresh'])
  assert.equal((await del(`/parties/${S.broker2.id}`)).success, true)
  // legacy record: one "vendorId" pointing at a landowner is shown as the landowner
  const old = await post('/projects', { name: 'Old record' })
  db.cols.land_projects.rows.find((x) => x.id === old.project.id).vendorId = S.vendor.id
  const legacy = (await get(`/projects/${old.project.id}`))
  assert.equal(legacy.project.landownerName, 'Ramasamy')
  assert.equal(legacy.project.vendorName, '')
  assert.equal((await patch(`/projects/${old.project.id}`, { notes: 'edited' })).project.landownerId, S.vendor.id, 'edit keeps the legacy landowner')
  await del(`/projects/${old.project.id}`)
})

test('price log: history, change %, latest entry drives the project price', async () => {
  const pid = S.project.id
  assert.equal((await post(`/projects/${pid}/price-log`, { date: '2026-01-01' })).status, 400)
  assert.equal((await post(`/projects/${pid}/price-log`, { rate: 1 })).status, 400, 'date required')
  const a = await post(`/projects/${pid}/price-log`, { date: '2026-03-01', rate: 550000, reason: 'Negotiated up' })
  assert.equal(a.status, 201)
  assert.equal(a.entry.totalPrice, 5500000)
  const b = await post(`/projects/${pid}/price-log`, { date: '2026-06-01', totalPrice: 5250000, reason: 'Revised' })
  assert.equal(b.entry.rate, 525000)
  const log = await get(`/projects/${pid}/price-log`)
  assert.equal(log.entries.length, 3)
  assert.equal(log.entries[0].date, '2026-06-01')
  assert.equal(log.entries[0].change, -250000)
  assert.equal(log.entries[0].changePercent, -4.55)
  assert.equal((await get(`/projects/${pid}`)).project.landPrice, 5250000)
  assert.equal((await del(`/price-log/${b.entry.id}`)).success, true)
  assert.equal((await get(`/projects/${pid}`)).project.landPrice, 5500000, 'reverts to the previous entry')
  const e = await patch(`/price-log/${a.entry.id}`, { date: '2026-03-01', rate: 560000, totalPrice: 5600000, reason: 'Typo fixed' })
  assert.equal(e.entry.reason, 'Typo fixed')
  assert.equal((await get(`/projects/${pid}`)).project.landPrice, 5600000)
})

test('plots: create, duplicate, bulk, status rules', async () => {
  const pid = S.project.id
  assert.equal((await post(`/projects/${pid}/plots`, { plotNo: '' })).status, 400)
  const p = await post(`/projects/${pid}/plots`, { plotNo: 'A1', block: 'A', area: 1200, dimensions: '30x40', facing: 'East', rate: 2500 })
  assert.equal(p.status, 201)
  assert.equal(p.plot.listPrice, 3000000, 'list price = rate x area')
  S.plot = p.plot
  assert.equal((await post(`/projects/${pid}/plots`, { plotNo: 'a1' })).status, 409)
  assert.equal((await post(`/projects/${pid}/plots`, { plotNo: 'A2', status: 'Booked' })).status, 400, 'booked needs a customer')
  const bulk = await post(`/projects/${pid}/plots/bulk`, { prefix: 'A', from: 1, to: 4, area: 1000, block: 'A' })
  assert.equal(bulk.created, 3)
  assert.deepEqual(bulk.skipped, ['A1'])
  assert.equal((await post(`/projects/${pid}/plots/bulk`, { from: 5, to: 1 })).status, 400)
  const list = await get(`/projects/${pid}/plots`)
  assert.deepEqual(list.plots.map((x) => x.plotNo), ['A1', 'A2', 'A3', 'A4'])
})

test('customer, broker and commission on a plot', async () => {
  const id = S.plot.id
  assert.equal((await patch(`/plots/${id}`, { customer: { name: 'Asha', phone: '12' } })).status, 400)
  assert.equal((await patch(`/plots/${id}`, { source: 'broker' })).status, 400, 'broker required')
  const r = await patch(`/plots/${id}`, {
    customer: { name: 'Asha', phone: '98765 43210', email: 'asha@example.com' },
    source: 'broker',
    brokerId: S.broker.id,
    commission: { type: 'percent', value: 2 },
    salePrice: 3000000,
    saleDate: '2026-07-01',
    status: 'Booked',
  })
  assert.equal(r.status, 200, JSON.stringify(r))
  assert.equal(r.plot.commissionPayable, 60000)
  assert.match(r.plot.customer.id, /^lc-/, 'the customer has an id')
  S.customerId = r.plot.customer.id
  assert.equal(r.plot.paymentStatus, 'Unpaid')
  assert.equal(r.plot.commissionStatus, 'Pending')
  // editing the same customer keeps the id
  assert.equal((await patch(`/plots/${id}`, { customer: { ...r.plot.customer, phone: '98765 43211' } })).plot.customer.id, S.customerId)
  assert.equal(r.plot.brokerName, 'Suresh')
  assert.equal(r.plot.balance, 3000000)
  assert.equal((await del(`/parties/${S.broker.id}`)).status, 409, 'broker with plots cannot be deleted')
})

test('customer payments: balance, overpayment, edit, delete', async () => {
  const id = S.plot.id
  assert.equal((await post(`/plots/${id}/payments`, { amount: 0, date: '2026-07-02' })).status, 400)
  assert.equal((await post(`/plots/${id}/payments`, { amount: 5000, date: 'x' })).status, 400)
  const a = await post(`/plots/${id}/payments`, { amount: 500000, date: '2026-07-02', label: 'Booking advance', mode: 'UPI', referenceNo: 'U1' })
  assert.equal(a.status, 201)
  assert.equal(a.plot.paid, 500000)
  assert.equal(a.payment.customerId, S.customerId)
  assert.equal(a.payment.customerName, 'Asha')
  assert.equal(a.plot.paymentStatus, 'Part paid')
  assert.equal(a.plot.balance, 2500000)
  assert.equal((await post(`/plots/${id}/payments`, { amount: 2600000, date: '2026-07-03' })).status, 400, 'more than the balance')
  const b = await post(`/plots/${id}/payments`, { amount: 1000000, date: '2026-08-01', label: 'Part payment' })
  assert.equal(b.plot.balance, 1500000)
  assert.equal(b.plot.lastPaymentDate, '2026-08-01')
  assert.equal((await patch(`/payments/${b.payment.id}`, { amount: 1500000 })).plot.balance, 1000000)
  assert.equal((await patch(`/plots/${id}`, { salePrice: 1000000 })).status, 400, 'sale price below paid')
  assert.equal((await del(`/payments/${b.payment.id}`)).plot.paid, 500000)
  const removeCustomer = await patch(`/plots/${id}`, { customer: null, status: 'Available' })
  assert.equal(removeCustomer.status, 409, 'a customer with payments cannot be removed')
  const noCustomer = await post(`/plots/${(await get(`/projects/${S.project.id}/plots`)).plots[1].id}/payments`, { amount: 1, date: '2026-07-02' })
  assert.equal(noCustomer.status, 400)
})

test('commission payments: pending, limits, protections', async () => {
  const id = S.plot.id
  const a = await post(`/plots/${id}/commission-payments`, { amount: 20000, date: '2026-08-05', mode: 'Cash' })
  assert.equal(a.status, 201)
  assert.equal(a.plot.commissionPaid, 20000)
  assert.equal(a.plot.commissionPending, 40000)
  assert.equal(a.plot.commissionStatus, 'Part paid')
  assert.equal((await post(`/plots/${id}/commission-payments`, { amount: 50000, date: '2026-08-06' })).status, 400, 'above pending')
  assert.equal((await patch(`/plots/${id}`, { source: 'direct' })).status, 409, 'cannot go direct with commission paid')
  const list = await get(`/projects/${S.project.id}/commissions`)
  assert.equal(list.commissions[0].pending, 40000)
  assert.equal(list.payments.length, 1)
  S.commPay = a.payment
  // a direct plot has no broker to pay
  const other = (await get(`/projects/${S.project.id}/plots`)).plots[2]
  assert.equal((await post(`/plots/${other.id}/commission-payments`, { amount: 1, date: '2026-08-06' })).status, 400)
})

test('each plot has its own broker and customer; nothing is mixed', async () => {
  const plots = (await get(`/projects/${S.project.id}/plots`)).plots
  const other = plots.find((x) => x.plotNo === 'A3')
  S.broker3 = (await post('/parties', { type: 'broker', name: 'Third Broker' })).party
  const r = await patch(`/plots/${other.id}`, { customer: { name: 'Ravi' }, source: 'broker', brokerId: S.broker3.id, commission: { type: 'fixed', value: 40000 }, salePrice: 1500000, status: 'Booked' })
  assert.equal(r.status, 200, JSON.stringify(r))
  assert.equal(r.plot.brokerName, 'Third Broker')
  assert.equal(r.plot.commissionPayable, 40000)
  const first = (await get(`/plots/${S.plot.id}`)).plot
  assert.equal(first.brokerName, 'Suresh', 'the other plot keeps its broker')
  assert.equal(first.commissionPayable, 60000)
  const pay = await post(`/plots/${other.id}/payments`, { amount: 100000, date: '2026-08-10', mode: 'Cash' })
  assert.equal(pay.plot.paid, 100000)
  assert.equal((await get(`/plots/${S.plot.id}`)).plot.paid, 500000, 'payments stay with their plot')
  // a direct sale needs no broker at all
  const direct = plots.find((x) => x.plotNo === 'A4')
  const d = await patch(`/plots/${direct.id}`, { customer: { name: 'Meena' }, source: 'direct', salePrice: 1000000, status: 'Sold' })
  assert.equal(d.plot.brokerId, null)
  assert.equal(d.plot.commissionStatus, null)
  assert.equal((await post(`/plots/${direct.id}/commission-payments`, { amount: 1, date: '2026-08-11' })).status, 400)
  // tidy up so the later tests see one customer
  await del(`/payments/${pay.payment.id}`)
  await patch(`/plots/${other.id}`, { customer: null, source: 'direct', status: 'Available', salePrice: null })
  await patch(`/plots/${direct.id}`, { customer: null, status: 'Available', salePrice: null })
})

test('plot history records every change', async () => {
  await post(`/plots/${S.plot.id}/notes`, { note: 'Registration planned for September' })
  assert.equal((await post(`/plots/${S.plot.id}/notes`, { note: '  ' })).status, 400)
  const cn = await post(`/plots/${S.plot.id}/notes`, { note: 'Prefers calls after 6 pm', target: 'customer' })
  assert.equal(cn.status, 201)
  const emptyPlot = (await get(`/projects/${S.project.id}/plots`)).plots[2]
  assert.equal((await post(`/plots/${emptyPlot.id}/notes`, { note: 'x', target: 'customer' })).status, 400, 'no customer to write about')
  const notes = (await get(`/plots/${S.plot.id}`)).logs.filter((l) => l.type === 'note')
  const planNote = notes.find((n) => n.target === 'plot')
  const callNote = notes.find((n) => n.target === 'customer')
  assert.equal(callNote.customerId, S.customerId)
  assert.equal(callNote.customerName, 'Asha')
  assert.equal(callNote.by.name, 'Tester')
  assert.ok(callNote.at, 'notes keep the date and time')
  const edited = await patch(`/notes/${planNote.id}`, { note: 'Registration moved to October' })
  assert.equal(edited.note.details, 'Registration moved to October')
  assert.ok(edited.note.editedAt && edited.note.editedBy.name === 'Tester')
  assert.equal((await patch(`/notes/${planNote.id}`, { note: '' })).status, 400)
  assert.equal((await del(`/notes/${planNote.id}`)).success, true)
  assert.equal((await del(`/notes/${planNote.id}`)).status, 404)
  // history entries are not notes: they can't be edited through the notes API
  const status = (await get(`/plots/${S.plot.id}`)).logs.find((l) => l.type === 'status')
  assert.equal((await patch(`/notes/${status.id}`, { note: 'hack' })).status, 404)
  // customers of the project
  const customers = (await get(`/projects/${S.project.id}/customers`)).customers
  assert.equal(customers.length, 1)
  assert.equal(customers[0].name, 'Asha')
  assert.equal(customers[0].plotNo, 'A1')
  assert.equal(customers[0].brokerName, 'Suresh')
  assert.equal(customers[0].paymentStatus, 'Part paid')
  assert.equal(customers[0].commissionStatus, 'Part paid')
  const d = await get(`/plots/${S.plot.id}`)
  const types = d.logs.map((l) => l.type)
  for (const t of ['created', 'status', 'customer', 'broker', 'commission', 'payment', 'note']) assert.ok(types.includes(t), `history has ${t}`)
  assert.equal(d.project.name, 'Green Valley')
  assert.equal(d.payments.length, 1)
  assert.equal(d.commPayments.length, 1)
})

test('document log: file upload, validation, link to a plot, replace, delete', async () => {
  const pid = S.project.id
  assert.equal((await post(`/projects/${pid}/documents`, { title: 'x' })).status, 400, 'type required')
  assert.equal((await post(`/projects/${pid}/documents`, { docType: 'Sale deed', plotId: 'nope' })).status, 400)
  const j = await post(`/projects/${pid}/documents`, { docType: 'Parent deed', refNo: 'PD-1', docDate: '2020-05-01', status: 'Received', heldBy: 'Office safe' })
  assert.equal(j.status, 201)
  assert.equal(j.document.file, null)

  const form = new FormData()
  form.append('docType', 'Sale deed')
  form.append('title', 'Sale deed A1')
  form.append('plotId', S.plot.id)
  form.append('file', new Blob([Buffer.from('%PDF-1.4 hello world')], { type: 'application/pdf' }), 'deed.pdf')
  const up1 = await fetch(`${base}/projects/${pid}/documents`, { method: 'POST', body: form }).then((r) => r.json())
  assert.equal(up1.success, true, JSON.stringify(up1))
  assert.equal(up1.document.plotNo, 'A1')
  assert.equal(up1.document.file.ext, 'pdf')
  assert.ok(!('fileId' in up1.document), 'storage id is never exposed')
  const bytes = await fetch(`${base}/documents/${up1.document.id}/file`)
  assert.equal(bytes.headers.get('content-type'), 'application/pdf')
  assert.equal(Buffer.from(await bytes.arrayBuffer()).toString(), '%PDF-1.4 hello world')

  const bad = new FormData()
  bad.append('docType', 'Sale deed')
  bad.append('file', new Blob([Buffer.from('MZ not a document at all')]), 'x.pdf')
  assert.equal((await fetch(`${base}/projects/${pid}/documents`, { method: 'POST', body: bad }).then((r) => r.json())).success, false)

  assert.equal((await patch(`/documents/${j.document.id}`, { status: 'Verified' })).document.status, 'Verified')
  const rep = new FormData()
  rep.append('file', new Blob([Buffer.from('%PDF-1.4 second')], { type: 'application/pdf' }), 'v2.pdf')
  const r2 = await fetch(`${base}/documents/${up1.document.id}/file`, { method: 'PUT', body: rep }).then((r) => r.json())
  assert.equal(r2.document.file.name, 'v2.pdf')
  assert.equal(files.size, 1, 'old file removed after replace')
  assert.equal((await del(`/documents/${up1.document.id}`)).success, true)
  assert.equal(files.size, 0)
  assert.equal((await get(`/projects/${pid}/documents`)).documents.length, 1)
})

test('deleting is blocked where money is recorded', async () => {
  assert.equal((await del(`/plots/${S.plot.id}`)).status, 409)
  assert.equal((await del(`/projects/${S.project.id}`)).status, 409)
})

test('Excel export: sheets, headers, typed cells, totals, scoping, permissions', async () => {
  const res = await fetch(`${base}/export?type=all`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /spreadsheetml/)
  assert.match(res.headers.get('content-disposition'), /Land-All-projects-All-records-\d{4}-\d{2}-\d{2}\.xlsx/)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()))
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['Projects', 'Plots', 'Customers', 'Price Log', 'Document Log', 'Landowners & Vendors', 'Brokers', 'Commission', 'Commission Payments', 'Customer Payments', 'Payment Balances', 'Plot History', 'Plot Notes'])

  const proj = wb.getWorksheet('Projects')
  assert.equal(proj.getCell('A1').value, 'Land projects')
  assert.equal(proj.getRow(4).getCell(1).value, 'Project')
  assert.equal(proj.getRow(5).getCell(1).value, 'Green Valley')
  assert.equal(proj.views[0].ySplit, 4)
  const hdr = proj.getRow(4).getCell(1)
  assert.equal(hdr.fill.fgColor.argb, 'FF0F3D2E')
  const priceCol = proj.getRow(4).values.indexOf('Land price (₹)')
  assert.equal(proj.getRow(5).getCell(priceCol).value, 5600000)
  assert.match(proj.getRow(5).getCell(priceCol).numFmt, /₹/)

  const plots = wb.getWorksheet('Plots')
  const hv = plots.getRow(4).values
  const rowA1 = plots.getRow(5).values
  assert.equal(rowA1[hv.indexOf('Plot no.')], 'A1')
  assert.equal(rowA1[hv.indexOf('Customer')], 'Asha')
  assert.equal(rowA1[hv.indexOf('Source')], 'Through broker')
  assert.equal(rowA1[hv.indexOf('Broker')], 'Suresh')
  assert.equal(rowA1[hv.indexOf('Paid (₹)')], 500000)
  const sd = rowA1[hv.indexOf('Sale date')]
  assert.ok(sd instanceof Date, 'dates are real dates')
  assert.equal(sd.toISOString().slice(0, 10), '2026-07-01')
  const totalRow = plots.getRow(5 + 4)
  assert.equal(totalRow.getCell(1).value, 'Total')
  const paidCell = totalRow.getCell(hv.indexOf('Paid (₹)'))
  assert.match(paidCell.value.formula, /^SUBTOTAL\(109,/)
  assert.equal(paidCell.value.result, 500000)
  assert.ok(plots.autoFilter)

  const price = wb.getWorksheet('Price Log')
  assert.equal(price.getRow(5).getCell(2).value.toISOString().slice(0, 10), '2026-03-01')
  assert.equal(wb.getWorksheet('Customer Payments').getRow(5).getCell(10).value, 500000)
  assert.equal(wb.getWorksheet('Commission').getRow(5).getCell(9).value, 60000)
  assert.equal(wb.getWorksheet('Commission Payments').getRow(5).getCell(5).value, 20000)
  assert.ok(wb.getWorksheet('Plot History').rowCount > 6)
  const cust = wb.getWorksheet('Customers')
  const ch = cust.getRow(4).values
  assert.equal(cust.getRow(5).values[ch.indexOf('Customer')], 'Asha')
  assert.equal(cust.getRow(5).values[ch.indexOf('Payment status')], 'Part paid')
  assert.equal(cust.getRow(5).values[ch.indexOf('Commission status')], 'Part paid')
  const nt = wb.getWorksheet('Plot Notes')
  assert.equal(nt.getRow(5).getCell(4).value, 'Customer: Asha')
  assert.equal(nt.getRow(5).getCell(5).value, 'Prefers calls after 6 pm')

  // single project, single sheet type
  const one = await fetch(`${base}/export?type=payments&projectId=${S.project.id}`)
  const wb2 = new ExcelJS.Workbook()
  await wb2.xlsx.load(Buffer.from(await one.arrayBuffer()))
  assert.deepEqual(wb2.worksheets.map((w) => w.name), ['Customer Payments', 'Payment Balances'])
  assert.match(one.headers.get('content-disposition'), /Green-Valley/)

  assert.equal((await fetch(`${base}/export?type=bogus`)).status, 400)
  assert.equal((await fetch(`${base}/export?type=project`)).status, 400)
  assert.equal((await fetch(`${base}/export?type=plots&projectId=nope`)).status, 404)

  // a role with only "Vendors & landowners" may export the directory, not land data
  role = { permissions: { vendors: 'view' } }
  assert.equal((await fetch(`${base}/export?type=brokers`)).status, 200)
  assert.equal((await fetch(`${base}/export?type=all`)).status, 403)
  assert.equal((await fetch(`${base}/export?type=plots`)).status, 403)
  role = { superAdmin: true, permissions: {} }
})

test('layout plan upload and removal', async () => {
  const form = new FormData()
  form.append('file', new Blob([Buffer.from('%PDF-1.4 layout')], { type: 'application/pdf' }), 'layout.pdf')
  const r = await fetch(`${base}/projects/${S.project.id}/layout`, { method: 'POST', body: form }).then((x) => x.json())
  assert.equal(r.success, true)
  assert.equal((await get(`/projects/${S.project.id}`)).project.layout.name, 'layout.pdf')
  assert.equal((await fetch(`${base}/projects/${S.project.id}/layout`)).status, 200)
  assert.equal((await del(`/projects/${S.project.id}/layout`)).success, true)
  assert.equal((await fetch(`${base}/projects/${S.project.id}/layout`)).status, 404)
})

test('after removing the payments, the plot and project can be deleted', async () => {
  const pays = (await get(`/projects/${S.project.id}/payments`)).payments
  for (const p of pays) await del(`/payments/${p.id}`)
  await del(`/commission-payments/${S.commPay.id}`)
  assert.equal((await del(`/plots/${S.plot.id}`)).success, true)
  assert.equal((await del(`/projects/${S.project.id}`)).success, true)
  assert.equal((await get('/projects')).projects.length, 0)
  assert.equal(db.cols.land_plots.rows.length, 0)
  assert.equal(db.cols.land_price_logs.rows.length, 0)
})
