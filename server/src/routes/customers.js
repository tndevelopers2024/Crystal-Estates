import { Router } from 'express'
import { getDb } from '../config/db.js'
import { requireUser } from '../lib/auth.js'
import {
  ACTIVITY_TYPES,
  CONTACTED_STAGES,
  emailKey,
  ensureCustomerIndexes,
  logCustomerActivity,
  phoneKey,
  upsertCustomerFromLead,
} from '../lib/customers.js'

const router = Router()
router.use(requireUser)

const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max)
const actorOf = (req) => ({ name: req.user?.name || req.user?.email || 'CRM user', email: req.user?.email || '' })
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const EDITABLE = ['name', 'phone', 'email', 'address', 'city', 'notes', 'status', 'tags']
const FIELD_LABELS = { name: 'Name', phone: 'Phone', email: 'Email', address: 'Address', city: 'City', notes: 'Notes', status: 'Status', tags: 'Tags' }

/** Validate and normalise editable profile fields from a request body. */
function readProfile(body, { partial = false } = {}) {
  const out = {}
  const errors = []
  if (!partial || body.name !== undefined) {
    out.name = clean(body.name, 120)
    if (!out.name) errors.push('Name is required.')
  }
  if (!partial || body.phone !== undefined) {
    out.phone = clean(body.phone, 40)
    if (out.phone && !phoneKey(out.phone)) errors.push('Enter a valid phone number.')
  }
  if (!partial || body.email !== undefined) {
    out.email = clean(body.email, 160)
    if (out.email && !emailKey(out.email)) errors.push('Enter a valid email address.')
  }
  if (!partial || body.address !== undefined) out.address = clean(body.address, 400)
  if (!partial || body.city !== undefined) out.city = clean(body.city, 80)
  if (!partial || body.notes !== undefined) out.notes = clean(body.notes, 4000)
  if (body.status !== undefined) out.status = body.status === 'archived' ? 'archived' : 'active'
  if (body.tags !== undefined) {
    const list = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',')
    out.tags = [...new Set(list.map((t) => clean(t, 40)).filter(Boolean))].slice(0, 20)
  }
  if (!partial && !out.phone && !out.email) errors.push('Add a phone number or email so the customer can be identified.')
  return { profile: out, errors }
}

/** Another customer already using this phone/email? */
async function findDuplicate(db, { phone, email }, excludeId) {
  const or = []
  const pk = phoneKey(phone)
  const ek = emailKey(email)
  if (pk) or.push({ phoneKey: pk })
  if (ek) or.push({ emailKey: ek })
  if (!or.length) return null
  const q = { $or: or }
  if (excludeId) q.id = { $ne: excludeId }
  return db.collection('customers').findOne(q, { projection: { _id: 0, id: 1, name: 1 } })
}

/**
 * GET /api/customers?q=&status=active|archived|all&limit=&skip=
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDb()
    await ensureCustomerIndexes(db)
    const q = clean(req.query.q, 100)
    const status = ['archived', 'all'].includes(req.query.status) ? req.query.status : 'active'
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200)
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0)

    const filter = {}
    if (status === 'active') filter.status = { $ne: 'archived' }
    else if (status === 'archived') filter.status = 'archived'
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i')
      const digits = q.replace(/\D/g, '')
      filter.$or = [{ name: rx }, { email: rx }, { 'interests.property': rx }, { city: rx }]
      if (digits.length >= 3) filter.$or.push({ phoneKey: new RegExp(escapeRegex(digits)) })
    }

    const col = db.collection('customers')
    const [customers, total, counts] = await Promise.all([
      col.find(filter, { projection: { _id: 0 } }).sort({ lastActivityAt: -1, updatedAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
      col
        .aggregate([
          { $group: { _id: null, total: { $sum: 1 }, archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } }, totalPaid: { $sum: { $ifNull: ['$totalPaid', 0] } } } },
        ])
        .toArray(),
    ])
    const c = counts[0] || { total: 0, archived: 0, totalPaid: 0 }
    return res.json({
      success: true,
      customers,
      total,
      stats: { total: c.total, active: c.total - c.archived, archived: c.archived, totalPaid: c.totalPaid },
    })
  } catch (err) {
    console.error('Error listing customers:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/customers/import-from-leads
 * One-off backfill: creates/links customers for every existing contacted lead.
 * Safe to run more than once — already-linked leads are skipped.
 */
router.post('/import-from-leads', async (req, res) => {
  try {
    const db = await getDb()
    const leads = await db
      .collection('leads')
      .find({ $or: [{ stage: { $in: [...CONTACTED_STAGES] } }, { 'payments.0': { $exists: true } }] }, { projection: { _id: 0 } })
      .toArray()
    let created = 0
    let linked = 0
    for (const lead of leads) {
      const r = await upsertCustomerFromLead(db, lead, { actor: actorOf(req), reason: 'Imported from existing lead' })
      if (r.created) created += 1
      else if (r.linked) linked += 1
    }
    return res.json({ success: true, scanned: leads.length, created, linked })
  } catch (err) {
    console.error('Error importing customers:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/customers/:id  → profile, linked leads, properties, payments and full timeline
 */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb()
    const customer = await db.collection('customers').findOne({ id: req.params.id }, { projection: { _id: 0 } })
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' })

    const leadIds = customer.leadIds || []
    const [leads, payments, activity] = await Promise.all([
      db
        .collection('leads')
        .find({ id: { $in: leadIds } }, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, stage: 1, source: 1, property: 1, propertyId: 1, unit: 1, advanceReceived: 1, assignedAgent: 1, createdAt: 1, updatedAt: 1 } })
        .toArray(),
      db.collection('payments').find({ leadId: { $in: leadIds } }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(),
      db.collection('customer_activity').find({ customerId: customer.id }, { projection: { _id: 0 } }).sort({ occurredAt: -1, createdAt: -1 }).limit(1000).toArray(),
    ])

    const propertyIds = [
      ...new Set(
        [...(customer.interests || []).map((i) => i.propertyId), ...leads.map((l) => l.propertyId), ...payments.map((p) => p.propertyId)].filter(Boolean),
      ),
    ]
    const properties = propertyIds.length
      ? await db
          .collection('featured_plots')
          .find({ $or: [{ id: { $in: propertyIds } }, { projectId: { $in: propertyIds } }] }, { projection: { _id: 0, id: 1, name: 1, location: 1, slug: 1 } })
          .toArray()
      : []

    return res.json({
      success: true,
      customer,
      leads,
      payments,
      properties,
      activity,
      totals: {
        paid: payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
        payments: payments.length,
      },
    })
  } catch (err) {
    console.error('Error loading customer:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/customers  → add a customer by hand (rejects duplicates with 409 + existingId)
 */
router.post('/', async (req, res) => {
  try {
    const { profile, errors } = readProfile(req.body || {})
    if (errors.length) return res.status(400).json({ success: false, error: errors.join(' ') })
    const db = await getDb()
    await ensureCustomerIndexes(db)
    const dup = await findDuplicate(db, profile)
    if (dup) {
      return res.status(409).json({ success: false, error: `${dup.name} already has a profile with this phone or email.`, existingId: dup.id })
    }
    const now = new Date()
    const doc = {
      id: `cust-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
      ...profile,
      tags: profile.tags || [],
      status: profile.status || 'active',
      phoneKey: phoneKey(profile.phone),
      emailKey: emailKey(profile.email),
      source: 'Added in CRM',
      assignedAgent: null,
      leadIds: [],
      primaryLeadId: null,
      interests: [],
      activityCount: 0,
      totalPaid: 0,
      paymentsCount: 0,
      lastActivityAt: now,
      convertedAt: now,
      createdBy: actorOf(req),
      createdAt: now,
      updatedAt: now,
    }
    if (!doc.phoneKey) delete doc.phoneKey
    try {
      await db.collection('customers').insertOne(doc)
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ success: false, error: 'A customer with this phone number already exists.' })
      throw err
    }
    delete doc._id
    await logCustomerActivity(db, doc.id, { type: 'profile', title: 'Customer profile created in CRM', source: 'manual' }, actorOf(req))
    const customer = await db.collection('customers').findOne({ id: doc.id }, { projection: { _id: 0 } })
    return res.status(201).json({ success: true, customer })
  } catch (err) {
    console.error('Error creating customer:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/customers/:id  → edit profile details / archive
 */
router.patch('/:id', async (req, res) => {
  try {
    const db = await getDb()
    const col = db.collection('customers')
    const existing = await col.findOne({ id: req.params.id }, { projection: { _id: 0 } })
    if (!existing) return res.status(404).json({ success: false, error: 'Customer not found' })

    const { profile, errors } = readProfile(req.body || {}, { partial: true })
    if (errors.length) return res.status(400).json({ success: false, error: errors.join(' ') })
    const nextPhone = profile.phone !== undefined ? profile.phone : existing.phone
    const nextEmail = profile.email !== undefined ? profile.email : existing.email
    if (!nextPhone && !nextEmail) return res.status(400).json({ success: false, error: 'Keep a phone number or email on the profile.' })
    const dup = await findDuplicate(db, { phone: profile.phone, email: profile.email }, existing.id)
    if (dup) return res.status(409).json({ success: false, error: `${dup.name} already uses this phone or email.`, existingId: dup.id })

    const set = { updatedAt: new Date() }
    const unset = {}
    const changed = []
    for (const k of EDITABLE) {
      if (profile[k] === undefined) continue
      const before = JSON.stringify(existing[k] ?? (k === 'tags' ? [] : ''))
      if (JSON.stringify(profile[k]) === before) continue
      set[k] = profile[k]
      changed.push(FIELD_LABELS[k])
    }
    if (set.phone !== undefined) {
      const pk = phoneKey(set.phone)
      if (pk) set.phoneKey = pk
      else unset.phoneKey = ''
    }
    if (set.email !== undefined) set.emailKey = emailKey(set.email)

    if (changed.length) {
      const update = { $set: set }
      if (Object.keys(unset).length) update.$unset = unset
      try {
        await col.updateOne({ id: existing.id }, update)
      } catch (err) {
        if (err?.code === 11000) return res.status(409).json({ success: false, error: 'Another customer already uses this phone number.' })
        throw err
      }
      const title =
        set.status && changed.length === 1
          ? set.status === 'archived'
            ? 'Customer archived'
            : 'Customer restored'
          : `Profile updated: ${changed.join(', ')}`
      await logCustomerActivity(db, existing.id, { type: set.status ? 'status' : 'profile', title, source: 'manual' }, actorOf(req))
    }
    const customer = await col.findOne({ id: existing.id }, { projection: { _id: 0 } })
    return res.json({ success: true, customer, changed })
  } catch (err) {
    console.error('Error updating customer:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/customers/:id  → remove the profile and its timeline (leads and payments stay)
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb()
    const customer = await db.collection('customers').findOne({ id: req.params.id }, { projection: { _id: 0, id: 1, leadIds: 1 } })
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' })
    await db.collection('customer_activity').deleteMany({ customerId: customer.id })
    await db.collection('customers').deleteOne({ id: customer.id })
    await db.collection('leads').updateMany({ customerId: customer.id }, { $unset: { customerId: '' } })
    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting customer:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/** Validate a manual timeline entry */
function readActivity(body) {
  const type = ACTIVITY_TYPES.includes(body.type) ? body.type : null
  const title = clean(body.title, 240)
  const errors = []
  if (!type) errors.push('Choose an activity type.')
  if (!title) errors.push('Add a short summary.')
  let occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date()
  if (Number.isNaN(occurredAt.getTime())) errors.push('Enter a valid date and time.')
  const amount = body.amount === '' || body.amount === undefined || body.amount === null ? null : Number(body.amount)
  if (amount !== null && !(amount >= 0)) errors.push('Amount must be a positive number.')
  return { entry: { type, title, details: clean(body.details, 2000), occurredAt, propertyId: clean(body.propertyId, 80) || null, property: clean(body.property, 160) || null, amount }, errors }
}

/**
 * POST /api/customers/:id/activity  → log a call, meeting, note … by hand
 */
router.post('/:id/activity', async (req, res) => {
  try {
    const db = await getDb()
    const customer = await db.collection('customers').findOne({ id: req.params.id }, { projection: { _id: 0, id: 1 } })
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' })
    const { entry, errors } = readActivity(req.body || {})
    if (errors.length) return res.status(400).json({ success: false, error: errors.join(' ') })
    const activity = await logCustomerActivity(db, customer.id, { ...entry, source: 'manual' }, actorOf(req))
    return res.status(201).json({ success: true, activity })
  } catch (err) {
    console.error('Error logging customer activity:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/customers/:id/activity/:activityId  → edit a manual entry
 * Automatic entries (payments, stage changes …) mirror other records and stay read-only.
 */
router.patch('/:id/activity/:activityId', async (req, res) => {
  try {
    const db = await getDb()
    const col = db.collection('customer_activity')
    const existing = await col.findOne({ id: req.params.activityId, customerId: req.params.id }, { projection: { _id: 0 } })
    if (!existing) return res.status(404).json({ success: false, error: 'Activity not found' })
    if (existing.source !== 'manual') return res.status(403).json({ success: false, error: 'Automatic entries can’t be edited.' })
    const { entry, errors } = readActivity({ ...existing, ...req.body })
    if (errors.length) return res.status(400).json({ success: false, error: errors.join(' ') })
    const update = {
      type: entry.type,
      title: entry.title,
      details: entry.details,
      occurredAt: entry.occurredAt,
      amount: entry.amount,
      updatedAt: new Date(),
      editedBy: actorOf(req),
    }
    await col.updateOne({ id: existing.id }, { $set: update })
    await db.collection('customers').updateOne({ id: existing.customerId }, { $max: { lastActivityAt: entry.occurredAt }, $set: { updatedAt: new Date() } })
    const activity = await col.findOne({ id: existing.id }, { projection: { _id: 0 } })
    return res.json({ success: true, activity })
  } catch (err) {
    console.error('Error editing customer activity:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/customers/:id/activity/:activityId  → remove a manual entry
 */
router.delete('/:id/activity/:activityId', async (req, res) => {
  try {
    const db = await getDb()
    const col = db.collection('customer_activity')
    const existing = await col.findOne({ id: req.params.activityId, customerId: req.params.id }, { projection: { _id: 0, id: 1, source: 1, customerId: 1 } })
    if (!existing) return res.status(404).json({ success: false, error: 'Activity not found' })
    if (existing.source !== 'manual') return res.status(403).json({ success: false, error: 'Automatic entries can’t be deleted.' })
    await col.deleteOne({ id: existing.id })
    await db.collection('customers').updateOne({ id: existing.customerId }, { $inc: { activityCount: -1 }, $set: { updatedAt: new Date() } })
    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting customer activity:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
