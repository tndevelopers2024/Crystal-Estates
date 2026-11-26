/**
 * Brokers across the CRM: the shared directory, the broker on a lead, on a plot
 * booking and on a land plot, commission and its payments, the activity log,
 * lead payments (status, agreed price, pending balance) and the Excel report.
 * Runs against an in-memory stand-in for Mongo, never the real database.
 *   npm run test:brokers
 */
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import ExcelJS from 'exceljs'
import { makeDb } from './helpers/memdb.js'

const src = (p) => new URL(`../src/${p}`, import.meta.url).href
const db = makeDb()

mock.module(src('config/db.js'), { namedExports: { getDb: async () => db, getClient: async () => null, closeDb: async () => {} } })
mock.module(src('routes/plotDocuments.js'), {
  namedExports: {
    sniff: () => null,
    cleanName: (v) => v,
    single: (_q, _s, next) => next(),
    storeFile: async () => ({}),
    readPlotDocumentFile: async () => Buffer.from(''),
    dropFile: async () => {},
  },
})

const brokers = (await import(src('routes/brokers.js'))).default
const land = (await import(src('routes/land.js'))).default
const leads = (await import(src('routes/leads.js'))).default

const app = express()
app.use(express.json())
app.use((r, _s, n) => ((r.user = { name: 'Tester', email: 't@example.com' }), (r.role = { superAdmin: true, permissions: {} }), n()))
app.use('/api/brokers', brokers)
app.use('/api/land', land)
app.use('/api/leads', leads)
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api`
const call = async (method, p, body) => {
  const res = await fetch(base + p, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, ...(await res.json().catch(() => ({}))) }
}
const get = (p) => call('GET', p)
const post = (p, b) => call('POST', p, b)
const put = (p, b) => call('PUT', p, b)
const patch = (p, b) => call('PATCH', p, b)
const del = (p) => call('DELETE', p)
test.after(() => server.close())

const S = {}
const leadOwner = () => ({ type: 'lead', leadId: S.lead.id })
const refQuery = () => `/brokers/referral?type=lead&leadId=${S.lead.id}`

await db.collection('featured_plots').insertOne({ id: 'ce-1', projectId: 'soma', name: 'Somamangalam' })

test('directory: add, validate, edit (logged)', async () => {
  const r = await post('/brokers', { name: 'Suresh', phone: '9000000001', defaultCommission: { type: 'percent', value: 2 } })
  assert.equal(r.status, 201)
  S.broker = r.party
  assert.equal((await post('/brokers', { name: 'suresh' })).status, 409)
  assert.equal((await post('/brokers', { name: 'X', phone: 'abc' })).status, 400)
  const second = await post('/brokers', { name: 'Mani', phone: '9000000002' })
  S.broker2 = second.party
  assert.deepEqual((await get('/brokers')).brokers.map((b) => b.name), ['Mani', 'Suresh'])
  assert.equal((await patch(`/brokers/${S.broker.id}`, { phone: '9000000009' })).party.phone, '9000000009')
  const log = (await get(`/brokers/${S.broker.id}/activity`)).activity
  assert.ok(log.some((a) => a.type === 'created'))
  const upd = log.find((a) => a.type === 'updated')
  assert.equal(upd.changes[0].label, 'Phone')
  assert.equal(upd.by.name, 'Tester')
})

test('lead: assign a broker, agreed price, commission and its payments', async () => {
  const created = await post('/leads', { name: 'Asha', phone: '9876543210', property: 'Somamangalam', propertyId: 'ce-1', unit: 'Plot 12', stage: 'new' })
  S.lead = created.lead
  assert.equal((await get(refQuery())).referral, null)

  assert.equal((await put('/brokers/referral', { owner: leadOwner(), brokerId: 'nope' })).status, 400)
  const assigned = await put('/brokers/referral', { owner: leadOwner(), brokerId: S.broker.id, commission: { type: 'percent', value: 2 } })
  assert.equal(assigned.status, 200, JSON.stringify(assigned))
  assert.equal(assigned.view.referral.brokerName, 'Suresh')
  assert.equal(assigned.view.referral.status, 'Not set', 'no agreed price yet, so nothing is payable')
  const stored = db.cols.leads.rows.find((l) => l.id === S.lead.id)
  assert.equal(stored.source, 'Broker', 'a broker referral is the lead source')
  assert.ok(stored.activity.some((a) => /Broker Suresh assigned/.test(a.text)), 'the lead keeps its own history')

  // the generic lead update can't overwrite the referral, but sets the agreed price
  const upd = await patch(`/leads/${S.lead.id}`, { dealValue: 1000000, referral: { brokerId: S.broker2.id } })
  assert.equal(upd.lead.dealValue, 1000000)
  assert.equal(upd.lead.referral.brokerId, S.broker.id)
  assert.equal((await patch(`/leads/${S.lead.id}`, { dealValue: -5 })).status, 400)

  let v = (await get(refQuery())).referral
  assert.equal(v.payable, 20000)
  assert.equal(v.status, 'Pending')

  const p1 = await post('/brokers/commission-payments', { owner: leadOwner(), amount: 5000, date: '2026-08-01', mode: 'Cash' })
  assert.equal(p1.status, 201)
  assert.equal(p1.view.referral.status, 'Part paid')
  assert.equal(p1.view.referral.pending, 15000)
  S.commPay = p1.payment
  assert.equal((await post('/brokers/commission-payments', { owner: leadOwner(), amount: 20000, date: '2026-08-02' })).status, 400, 'more than pending')
  assert.equal((await post('/brokers/commission-payments', { owner: leadOwner(), amount: 15000, date: '2026-08-03' })).view.referral.status, 'Paid')
  assert.equal((await patch(`/brokers/commission-payments/${S.commPay.id}`, { amount: 4000 })).view.referral.paid, 19000)

  // a paid-for deal can't change broker or be deleted until the payments are removed
  assert.equal((await put('/brokers/referral', { owner: leadOwner(), brokerId: S.broker2.id })).status, 409)
  assert.equal((await del(`/brokers/${S.broker.id}`)).status, 409, 'a broker with referrals cannot be deleted')
  assert.equal((await del(`/leads/${S.lead.id}`)).status, 409)

  const kinds = (await get(`/brokers/${S.broker.id}/activity`)).activity.map((a) => a.type)
  for (const t of ['assigned', 'commission_payment']) assert.ok(kinds.includes(t), `broker log has ${t}`)
})

test('lead payments: status, agreed price, pending balance, edit', async () => {
  const id = S.lead.id
  const a = await post(`/leads/${id}/payments`, { amount: 300000, paymentFor: 'Token advance', mode: 'Cheque', referenceNo: 'CH1', status: 'Pending clearance', note: 'Cheque to be cleared' })
  assert.equal(a.payment.status, 'Pending clearance')
  let all = (await get('/leads/payments/all')).payments.find((p) => p.id === a.payment.id)
  assert.equal(all.balance, 1000000, 'money that has not cleared does not count')
  assert.equal(all.dealValue, 1000000)
  assert.equal(all.brokerName, 'Suresh')

  assert.equal((await patch(`/leads/payments/${a.payment.id}`, { status: 'Bounced' })).status, 400)
  assert.equal((await patch(`/leads/payments/${a.payment.id}`, { status: 'Received', note: 'Cleared on 5 Aug' })).payment.status, 'Received')
  all = (await get('/leads/payments/all')).payments.find((p) => p.id === a.payment.id)
  assert.equal(all.balance, 700000)
  assert.equal(all.note, 'Cleared on 5 Aug')
  assert.ok(db.cols.leads.rows.find((l) => l.id === id).payments.find((p) => p.id === a.payment.id).status === 'Received', 'the lead copy stays in step')

  assert.equal((await post(`/leads/${id}/payments`, { amount: 800000, paymentFor: 'Part payment', mode: 'UPI' })).status, 400, 'more than the pending balance')
  assert.equal((await patch(`/leads/payments/${a.payment.id}`, { amount: 2000000 })).status, 400)
  assert.equal((await patch(`/leads/payments/${a.payment.id}`, { amount: 350000 })).payment.amount, 350000)
  assert.equal((await patch('/leads/payments/nope', { amount: 1 })).status, 404)
})

test('property booking: a broker on a plot booking, or the lead’s broker when the buyer is linked', async () => {
  const where = { type: 'booking', propertyId: 'ce-1', plotUid: 'u-12', plotNo: '12', phase: null }
  assert.equal((await put('/brokers/referral', { owner: where, brokerId: S.broker.id })).status, 400, 'no booking yet')

  await db.collection('plot_bookings').insertOne({ propertyId: 'ce-1', plotUid: 'u-12', plotNo: '12', phase: null, booking: { buyerName: 'Walk-in Buyer', totalPrice: '₹ 30 Lakhs', phone: '9111111111' } })
  const r = await put('/brokers/referral', { owner: where, brokerId: S.broker2.id, commission: { type: 'fixed', value: 40000 } })
  assert.equal(r.status, 200, JSON.stringify(r))
  assert.equal(r.view.owner.type, 'booking')
  assert.equal(r.view.referral.payable, 40000)
  assert.equal((await post('/brokers/commission-payments', { owner: where, amount: 10000, date: '2026-08-10', mode: 'UPI' })).view.referral.paid, 10000)
  const plotLog = db.cols.plot_activity.rows.filter((a) => a.plotNo === '12')
  assert.ok(plotLog.some((a) => /Broker Mani assigned/.test(a.title)), 'the plot history records it')

  // a booking whose buyer is a lead uses that lead's broker: recorded once
  await db.collection('plot_bookings').insertOne({ propertyId: 'ce-1', plotUid: 'u-13', plotNo: '13', phase: null, booking: { buyerName: 'Asha', leadId: S.lead.id, totalPrice: '₹ 10 Lakhs' } })
  const linked = await get(`/brokers/referral?type=booking&propertyId=ce-1&plotUid=u-13&plotNo=13`)
  assert.equal(linked.owner.via, 'booking')
  assert.equal(linked.owner.type, 'lead')
  assert.equal(linked.referral.brokerName, 'Suresh')
})

test('land: assignments and commission payments are in the broker log and overview', async () => {
  const pr = await post('/land/projects', { name: 'Green Valley', brokerIds: [S.broker.id] })
  assert.equal(pr.status, 201, JSON.stringify(pr))
  const projectId = pr.project.id
  const plot = (await post(`/land/projects/${projectId}/plots`, { plotNo: 'A1', area: 1200 })).plot
  const r = await patch(`/land/plots/${plot.id}`, { customer: { name: 'Ravi' }, source: 'broker', brokerId: S.broker.id, commission: { type: 'percent', value: 2 }, salePrice: 2000000, status: 'Booked' })
  assert.equal(r.status, 200, JSON.stringify(r))
  await post(`/land/plots/${plot.id}/commission-payments`, { amount: 10000, date: '2026-08-20', mode: 'Cash' })
  const log = (await get(`/brokers/${S.broker.id}/activity`)).activity.filter((a) => a.module === 'land')
  assert.ok(log.some((a) => a.type === 'assigned' && /Green Valley/.test(a.title)))
  assert.ok(log.some((a) => a.type === 'commission_payment'))

  const d = await get(`/brokers/${S.broker.id}`)
  assert.equal(d.stats.lead.count, 1)
  assert.equal(d.stats.land.count, 1)
  assert.equal(d.stats.landProjects, 1)
  const landRow = d.referrals.find((x) => x.module === 'land')
  assert.equal(landRow.payable, 40000)
  assert.equal(landRow.paid, 10000)
  assert.equal(landRow.status, 'Part paid')
  const leadRow = d.referrals.find((x) => x.module === 'lead')
  assert.equal(leadRow.status, 'Part paid', 'a payment was lowered to 4,000: 19,000 of 20,000')
  assert.equal(leadRow.paid, 19000)
  assert.equal(d.stats.payable, leadRow.payable + landRow.payable)
  assert.equal(d.stats.paid, leadRow.paid + landRow.paid)
  assert.deepEqual([...new Set(d.payments.map((p) => p.module))].sort(), ['land', 'lead'])

  // removing the broker from the plot is logged for the broker
  await patch(`/land/plots/${plot.id}`, { source: 'direct' }) // blocked by the payment above
  const stillThere = (await get(`/brokers/${S.broker.id}`)).stats.land.count
  assert.equal(stillThere, 1, 'commission paid: the broker stays on the plot')
  S.landPlot = plot
})

test('the broker view and list show every module; usage blocks deletion', async () => {
  const list = (await get('/brokers')).brokers.find((b) => b.id === S.broker2.id)
  assert.equal(list.bookings, 1)
  assert.equal(list.usage, 1)
  assert.equal((await del(`/brokers/${S.broker2.id}`)).status, 409)
  assert.equal((await get('/brokers/nope')).status, 404)
  const noRef = await post('/brokers', { name: 'Unused' })
  assert.equal((await del(`/brokers/${noRef.party.id}`)).success, true)
  // the history of a deleted broker is kept
  assert.ok(db.cols.broker_activity.rows.some((a) => a.brokerId === noRef.party.id && a.type === 'deleted'))
})

test('Excel report: summary, referrals, commission payments and activity', async () => {
  const res = await fetch(`${base}/brokers/export`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-disposition'), /Brokers-All-\d{4}-\d{2}-\d{2}\.xlsx/)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()))
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['Brokers', 'Referrals', 'Commission Payments', 'Broker Activity'])
  const sum = wb.getWorksheet('Brokers')
  const h = sum.getRow(4).values
  const suresh = [5, 6, 7].map((n) => sum.getRow(n).values).find((v) => v[1] === 'Suresh')
  assert.equal(suresh[h.indexOf('Leads')], 1)
  assert.equal(suresh[h.indexOf('Land plots')], 1)
  const refs = wb.getWorksheet('Referrals')
  const rh = refs.getRow(4).values
  assert.ok([5, 6, 7, 8].some((n) => refs.getRow(n).values[rh.indexOf('Module')] === 'Land'))
  assert.ok(wb.getWorksheet('Broker Activity').rowCount > 6)

  const one = await fetch(`${base}/brokers/export?brokerId=${S.broker.id}`)
  assert.match(one.headers.get('content-disposition'), /Brokers-Suresh-/)
  assert.equal((await fetch(`${base}/brokers/export?brokerId=nope`)).status, 404)
})
