/**
 * Unit tests for customer creation, dedupe and activity logging.
 * Runs against a small in-memory stand-in for the Mongo driver — never the real database.
 *   node --test server/test-unit
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emailKey,
  followUpActivityType,
  guessActivityType,
  logCustomerActivity,
  logForLead,
  phoneKey,
  upsertCustomerFromLead,
} from '../src/lib/customers.js'

/* ── Minimal in-memory Mongo collection ── */
const get = (doc, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), doc)
function matches(doc, q) {
  return Object.entries(q).every(([k, cond]) => {
    if (k === '$or') return cond.some((c) => matches(doc, c))
    const v = get(doc, k)
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      if ('$ne' in cond) return v !== cond.$ne
      if ('$in' in cond) return Array.isArray(v) ? v.some((x) => cond.$in.includes(x)) : cond.$in.includes(v)
      if ('$type' in cond) return typeof v === cond.$type
    }
    return Array.isArray(v) ? v.includes(cond) : v === cond
  })
}
function makeCollection(name, uniques = []) {
  const docs = []
  return {
    docs,
    async createIndex() {},
    async findOne(q) {
      const d = docs.find((x) => matches(x, q))
      return d ? structuredClone(d) : null
    },
    find(q) {
      const res = docs.filter((x) => matches(x, q)).map((x) => structuredClone(x))
      return { sort: () => ({ toArray: async () => res }), toArray: async () => res }
    },
    async insertOne(doc) {
      for (const key of uniques) {
        if (doc[key] != null && docs.some((x) => x[key] === doc[key])) {
          const err = new Error(`E11000 duplicate key ${name}.${key}`)
          err.code = 11000
          throw err
        }
      }
      docs.push(structuredClone(doc))
      return { insertedId: doc.id }
    },
    async insertMany(list) {
      for (const d of list) await this.insertOne(d)
    },
    async updateOne(q, u) {
      const d = docs.find((x) => matches(x, q))
      if (!d) return { matchedCount: 0 }
      Object.assign(d, structuredClone(u.$set || {}))
      for (const k of Object.keys(u.$unset || {})) delete d[k]
      for (const [k, v] of Object.entries(u.$inc || {})) d[k] = (d[k] || 0) + v
      for (const [k, v] of Object.entries(u.$max || {})) if (!d[k] || v > d[k]) d[k] = v
      for (const [k, v] of Object.entries(u.$addToSet || {})) {
        d[k] = d[k] || []
        if (!d[k].includes(v)) d[k].push(v)
      }
      for (const [k, v] of Object.entries(u.$push || {})) {
        d[k] = d[k] || []
        d[k].push(v)
      }
      return { matchedCount: 1 }
    },
  }
}
function makeDb() {
  const cols = {
    customers: makeCollection('customers', ['id', 'phoneKey']),
    customer_activity: makeCollection('customer_activity', ['id']),
    leads: makeCollection('leads', ['id']),
  }
  return { cols, collection: (n) => cols[n] || (cols[n] = makeCollection(n)) }
}

const lead = (over = {}) => ({
  id: 'lead-1',
  name: 'Priya Sundar',
  phone: '+91 98844 55555',
  email: 'priya@example.test',
  stage: 'contacted',
  source: 'Website',
  property: 'Somamangalam',
  propertyId: 'proj-1',
  unit: 'Not allotted',
  activity: [{ id: 'a1', text: 'Enquiry captured from Website for Somamangalam', createdAt: new Date('2026-11-01') }],
  payments: [],
  ...over,
})

test('phone and email keys normalise formats', () => {
  assert.equal(phoneKey('+91 98844-55555'), '9884455555')
  assert.equal(phoneKey('09884455555'), '9884455555')
  assert.equal(phoneKey('123'), null)
  assert.equal(emailKey('  Priya@Example.TEST '), 'priya@example.test')
  assert.equal(emailKey('not-an-email'), null)
})

test('follow-up and history lines map to activity types', () => {
  assert.equal(followUpActivityType('Call'), 'call')
  assert.equal(followUpActivityType('Site visit'), 'visit')
  assert.equal(followUpActivityType('Meeting'), 'meeting')
  assert.equal(guessActivityType('Pipeline stage moved to "Contacted"'), 'status')
  assert.equal(guessActivityType('Note added: "x"'), 'note')
})

test('converting a lead creates one customer, links the lead and imports its history', async () => {
  const db = makeDb()
  await db.cols.leads.insertOne(lead())
  const r = await upsertCustomerFromLead(db, lead(), { actor: { name: 'Admin' } })
  assert.equal(r.created, true)
  assert.equal(db.cols.customers.docs.length, 1)
  const c = db.cols.customers.docs[0]
  assert.equal(c.phoneKey, '9884455555')
  assert.deepEqual(c.leadIds, ['lead-1'])
  assert.equal(c.interests[0].property, 'Somamangalam')
  assert.equal((await db.cols.leads.findOne({ id: 'lead-1' })).customerId, c.id)
  const titles = db.cols.customer_activity.docs.map((a) => a.title)
  assert.ok(titles.some((t) => t.startsWith('Customer profile created')))
  assert.ok(titles.includes('Enquiry captured from Website for Somamangalam'))
})

test('converting the same lead again does not duplicate the customer or its history', async () => {
  const db = makeDb()
  await db.cols.leads.insertOne(lead())
  await upsertCustomerFromLead(db, lead())
  const before = db.cols.customer_activity.docs.length
  const again = await upsertCustomerFromLead(db, { ...lead(), customerId: db.cols.customers.docs[0].id })
  assert.equal(again.created, false)
  assert.equal(again.linked, false)
  assert.equal(db.cols.customers.docs.length, 1)
  assert.equal(db.cols.customer_activity.docs.length, before)
})

test('a second lead with the same phone joins the existing customer', async () => {
  const db = makeDb()
  await db.cols.leads.insertOne(lead())
  await db.cols.leads.insertOne(lead({ id: 'lead-2', phone: '9884455555', email: '', property: 'Kolapakkam', propertyId: 'proj-2' }))
  await upsertCustomerFromLead(db, lead())
  const r = await upsertCustomerFromLead(db, lead({ id: 'lead-2', phone: '9884455555', email: '', property: 'Kolapakkam', propertyId: 'proj-2' }))
  assert.equal(r.created, false)
  assert.equal(r.linked, true)
  assert.equal(db.cols.customers.docs.length, 1)
  assert.deepEqual(db.cols.customers.docs[0].leadIds, ['lead-1', 'lead-2'])
  assert.deepEqual(db.cols.customers.docs[0].interests.map((i) => i.property), ['Somamangalam', 'Kolapakkam'])
})

test('matches by email when there is no phone', async () => {
  const db = makeDb()
  const a = lead({ id: 'lead-a', phone: '' })
  const b = lead({ id: 'lead-b', phone: '', email: 'PRIYA@example.test' })
  await db.cols.leads.insertOne(a)
  await db.cols.leads.insertOne(b)
  await upsertCustomerFromLead(db, a)
  await upsertCustomerFromLead(db, b)
  assert.equal(db.cols.customers.docs.length, 1)
})

test('concurrent conversions resolve to a single customer (unique phone)', async () => {
  const db = makeDb()
  await db.cols.leads.insertOne(lead())
  await db.cols.leads.insertOne(lead({ id: 'lead-2' }))
  await Promise.all([upsertCustomerFromLead(db, lead()), upsertCustomerFromLead(db, lead({ id: 'lead-2' }))])
  assert.equal(db.cols.customers.docs.length, 1)
  assert.deepEqual(db.cols.customers.docs[0].leadIds.sort(), ['lead-1', 'lead-2'])
})

test('payment entries update totals only when tied to a payment record', async () => {
  const db = makeDb()
  await db.cols.leads.insertOne(lead())
  const { customer } = await upsertCustomerFromLead(db, lead())
  await logCustomerActivity(db, customer.id, { type: 'payment', title: 'Booking advance', amount: 25500, paymentId: 'pay-1' })
  await logCustomerActivity(db, customer.id, { type: 'payment', title: 'Promised to pay next week', amount: 99999, source: 'manual' })
  const c = await db.cols.customers.findOne({ id: customer.id })
  assert.equal(c.totalPaid, 25500)
  assert.equal(c.paymentsCount, 1)
})

test('logForLead only logs for leads that have been converted', async () => {
  const db = makeDb()
  await db.cols.leads.insertOne(lead({ stage: 'new' }))
  assert.equal(await logForLead(db, lead({ stage: 'new' }), { type: 'note', title: 'x' }), null)
  assert.equal(db.cols.customer_activity.docs.length, 0)
  await upsertCustomerFromLead(db, lead())
  const entry = await logForLead(db, lead(), { type: 'note', title: 'Wants corner plot' })
  assert.equal(entry.type, 'note')
  assert.equal(entry.leadId, 'lead-1')
})

test('unknown activity types fall back to "other" and actor defaults safely', async () => {
  const db = makeDb()
  await db.cols.leads.insertOne(lead())
  const { customer } = await upsertCustomerFromLead(db, lead())
  const e = await logCustomerActivity(db, customer.id, { type: 'hack', title: 'Something' })
  assert.equal(e.type, 'other')
  assert.deepEqual(e.actor, { name: 'CRM user', email: '' })
})
