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
import { PARTIES, logBroker, readCommission } from '../lib/brokers.js'

const router = Router()
router.use(requireUser)

const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max)
const actorOf = (req) => ({ name: req.user?.name || req.user?.email || 'CRM user', email: req.user?.email || '' })
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const commText = (c) => (c ? (c.type === 'percent' ? `${c.value}%` : `${rupees(c.value)} fixed`) : 'No commission set')
const isReceivedPayment = (p) => !['Bounced', 'Refunded', 'Cancelled'].includes(p?.status)

function parseDealValue(v) {
  if (v === '' || v === undefined || v === null) return { value: null }
  const n = Number(String(v).replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return { error: 'Total amount must be a valid positive number.' }
  return { value: Math.round(n * 100) / 100 }
}

function readCustomerPayment(body) {
  const amount = Number(String(body?.amount ?? '').replace(/,/g, '').trim())
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Payment amount must be greater than 0.' }
  const paidOnRaw = clean(body?.paidOn || body?.date, 20)
  const paidOn = paidOnRaw && /^\d{4}-\d{2}-\d{2}$/.test(paidOnRaw) ? paidOnRaw : new Date().toISOString().slice(0, 10)
  const mode = clean(body?.mode || 'UPI', 80) || 'UPI'
  const referenceNo = clean(body?.referenceNo, 80)
  const note = clean(body?.note, 500)
  const paymentFor = clean(body?.paymentFor || 'Payment', 120) || 'Payment'
  const status = ['Received', 'Pending', 'Cleared', 'Bounced', 'Refunded', 'Cancelled'].includes(body?.status) ? body.status : 'Received'
  return {
    payment: {
      amount: Math.round(amount * 100) / 100,
      amountFormatted: rupees(amount),
      paidOn,
      date: new Date(`${paidOn}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      mode,
      referenceNo,
      note,
      paymentFor,
      status,
    },
  }
}

async function customerPaymentsFilter(customer) {
  const leadIds = customer.leadIds || []
  return leadIds.length ? { $or: [{ customerId: customer.id }, { leadId: { $in: leadIds } }] } : { customerId: customer.id }
}

async function syncCustomerPaymentTotals(db, customer) {
  const filter = await customerPaymentsFilter(customer)
  const all = await db.collection('payments').find(filter, { projection: { _id: 0, amount: 1, status: 1 } }).toArray()
  const totalPaid = Math.round(all.filter(isReceivedPayment).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100
  await db.collection('customers').updateOne({ id: customer.id }, { $set: { totalPaid, paymentsCount: all.length, updatedAt: new Date() } })
  return { totalPaid, paymentsCount: all.length }
}

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
    const payFilter = await customerPaymentsFilter(customer)
    const [leads, payments, activity, broker] = await Promise.all([
      db
        .collection('leads')
        .find({ id: { $in: leadIds } }, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, stage: 1, source: 1, property: 1, propertyId: 1, unit: 1, advanceReceived: 1, assignedAgent: 1, dealValue: 1, referral: 1, createdAt: 1, updatedAt: 1 } })
        .toArray(),
      db.collection('payments').find(payFilter, { projection: { _id: 0 } }).sort({ paidOn: -1, createdAt: -1 }).toArray(),
      db.collection('customer_activity').find({ customerId: customer.id }, { projection: { _id: 0 } }).sort({ occurredAt: -1, createdAt: -1 }).limit(1000).toArray(),
      customer.referral?.brokerId
        ? db.collection(PARTIES).findOne({ id: customer.referral.brokerId }, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, defaultCommission: 1 } })
        : Promise.resolve(null),
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

    const paid = Math.round(payments.filter(isReceivedPayment).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100
    const leadDealTotal = leads.some((l) => l.dealValue != null) ? leads.reduce((s, l) => s + (Number(l.dealValue) || 0), 0) : null
    const dealValue = customer.dealValue != null ? Number(customer.dealValue) : leadDealTotal
    const pending = dealValue != null ? Math.max(Math.round((dealValue - paid) * 100) / 100, 0) : null

    return res.json({
      success: true,
      customer: { ...customer, broker: broker || null },
      leads,
      payments,
      properties,
      activity,
      totals: {
        paid,
        dealValue,
        pending,
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
    const body = req.body || {}
    const { profile, errors } = readProfile(body)
    const dv = parseDealValue(body.dealValue)
    if (dv.error) errors.push(dv.error)

    const isDirectCustomer = body.isDirectCustomer !== undefined ? Boolean(body.isDirectCustomer) : !clean(body.brokerId, 80)
    const brokerId = isDirectCustomer ? '' : clean(body.brokerId, 80)
    const commRes = brokerId ? readCommission(body.commission) : { value: null }
    if (commRes.error) errors.push(commRes.error)

    const rawPayments = Array.isArray(body.payments) ? body.payments : []
    const parsedPayments = []
    for (const rp of rawPayments) {
      const pr = readCustomerPayment(rp)
      if (pr.error) errors.push(pr.error)
      else parsedPayments.push(pr.payment)
    }

    if (errors.length) return res.status(400).json({ success: false, error: errors.join(' ') })

    const db = await getDb()
    await ensureCustomerIndexes(db)
    const dup = await findDuplicate(db, profile)
    if (dup) {
      return res.status(409).json({ success: false, error: `${dup.name} already has a profile with this phone or email.`, existingId: dup.id })
    }

    let broker = null
    if (brokerId) {
      broker = await db.collection(PARTIES).findOne({ id: brokerId, type: 'broker' }, { projection: { _id: 0 } })
      if (!broker) return res.status(400).json({ success: false, error: 'The selected broker no longer exists.' })
    }

    const now = new Date()
    const actor = actorOf(req)
    const doc = {
      id: `cust-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
      ...profile,
      tags: profile.tags || [],
      status: profile.status || 'active',
      phoneKey: phoneKey(profile.phone),
      emailKey: emailKey(profile.email),
      source: broker ? 'Broker' : 'Added in CRM',
      isDirectCustomer: !broker,
      referral: broker ? { brokerId: broker.id, commission: commRes.value, assignedAt: now, updatedAt: now } : null,
      dealValue: dv.value,
      assignedAgent: null,
      leadIds: [],
      primaryLeadId: null,
      interests: [],
      activityCount: 0,
      totalPaid: 0,
      paymentsCount: 0,
      lastActivityAt: now,
      convertedAt: now,
      createdBy: actor,
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
    await logCustomerActivity(db, doc.id, { type: 'profile', title: 'Customer profile created in CRM', source: 'manual' }, actor)

    if (dv.value != null) {
      await logCustomerActivity(db, doc.id, { type: 'profile', title: `Total amount set to ${rupees(dv.value)}`, source: 'auto' }, actor)
    }

    if (broker) {
      const cSummary = `Commission: ${commText(commRes.value)}`
      await logCustomerActivity(db, doc.id, { type: 'profile', title: `Broker assigned: ${broker.name}`, details: cSummary, source: 'auto' }, actor)
      await logBroker(db, {
        brokerId: broker.id,
        module: 'customer',
        type: 'assigned',
        title: `Assigned to customer: ${doc.name}`,
        details: cSummary,
        refs: { customerId: doc.id, customerName: doc.name, ownerKey: `customer:${doc.id}`, ownerType: 'customer', label: doc.name },
        actor,
      })
    }

    for (const p of parsedPayments) {
      const paymentId = `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const paymentRecord = {
        id: paymentId,
        customerId: doc.id,
        leadId: null,
        leadName: doc.name,
        customerName: doc.name,
        ...p,
        createdAt: now,
        createdBy: actor,
      }
      await db.collection('payments').insertOne(paymentRecord)
      await logCustomerActivity(
        db,
        doc.id,
        {
          type: 'payment',
          title: `${p.paymentFor} of ${p.amountFormatted} recorded via ${p.mode}`,
          details: [p.referenceNo && `Ref: ${p.referenceNo}`, p.note].filter(Boolean).join(' · '),
          occurredAt: new Date(`${p.paidOn}T12:00:00Z`),
          paymentId,
          amount: p.amount,
          source: 'auto',
        },
        actor,
      )
    }

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

    const body = req.body || {}
    const { profile, errors } = readProfile(body, { partial: true })
    const hasDealValue = body.dealValue !== undefined
    const dv = hasDealValue ? parseDealValue(body.dealValue) : { value: undefined }
    if (dv.error) errors.push(dv.error)

    const hasBrokerUpdate = body.brokerId !== undefined || body.isDirectCustomer !== undefined || body.commission !== undefined
    const nextDirect = body.isDirectCustomer !== undefined ? Boolean(body.isDirectCustomer) : body.brokerId !== undefined ? !clean(body.brokerId, 80) : existing.isDirectCustomer
    const nextBrokerId = nextDirect ? '' : body.brokerId !== undefined ? clean(body.brokerId, 80) : (existing.referral?.brokerId || '')
    const commRes = hasBrokerUpdate && nextBrokerId ? readCommission(body.commission !== undefined ? body.commission : existing.referral?.commission) : { value: null }
    if (commRes.error) errors.push(commRes.error)

    if (errors.length) return res.status(400).json({ success: false, error: errors.join(' ') })
    const nextPhone = profile.phone !== undefined ? profile.phone : existing.phone
    const nextEmail = profile.email !== undefined ? profile.email : existing.email
    if (!nextPhone && !nextEmail) return res.status(400).json({ success: false, error: 'Keep a phone number or email on the profile.' })
    const dup = await findDuplicate(db, { phone: profile.phone, email: profile.email }, existing.id)
    if (dup) return res.status(409).json({ success: false, error: `${dup.name} already uses this phone or email.`, existingId: dup.id })

    let nextBroker = null
    if (hasBrokerUpdate && nextBrokerId) {
      nextBroker = await db.collection(PARTIES).findOne({ id: nextBrokerId, type: 'broker' }, { projection: { _id: 0 } })
      if (!nextBroker) return res.status(400).json({ success: false, error: 'The selected broker no longer exists.' })
    }

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

    const extraLogs = []
    const actor = actorOf(req)

    if (hasDealValue && dv.value !== (existing.dealValue ?? null)) {
      set.dealValue = dv.value
      changed.push('Total amount')
      extraLogs.push({
        type: 'profile',
        title: dv.value != null ? `Total amount updated to ${rupees(dv.value)}` : 'Total amount cleared',
        source: 'auto',
      })
    }

    if (hasBrokerUpdate) {
      const prevBrokerId = existing.referral?.brokerId || ''
      const prevComm = existing.referral?.commission || null
      const nextReferral = nextBroker
        ? {
            brokerId: nextBroker.id,
            commission: commRes.value,
            assignedAt: prevBrokerId === nextBroker.id ? existing.referral?.assignedAt || new Date() : new Date(),
            updatedAt: new Date(),
          }
        : null
      if (prevBrokerId !== nextBrokerId || commText(prevComm) !== commText(commRes.value)) {
        set.referral = nextReferral
        set.isDirectCustomer = !nextBroker
        const refs = { customerId: existing.id, customerName: existing.name, ownerKey: `customer:${existing.id}`, ownerType: 'customer', label: existing.name }
        if (prevBrokerId && (!nextBroker || prevBrokerId !== nextBroker.id)) {
          const oldBroker = await db.collection(PARTIES).findOne({ id: prevBrokerId }, { projection: { name: 1 } })
          await logBroker(db, { brokerId: prevBrokerId, module: 'customer', type: 'removed', title: `Removed from customer: ${existing.name}`, refs, actor })
          if (!nextBroker) {
            extraLogs.push({ type: 'profile', title: `Broker ${oldBroker?.name || ''} removed (marked as Direct Customer)`.trim(), source: 'auto' })
          }
        }
        if (nextBroker && prevBrokerId !== nextBroker.id) {
          const cSummary = `Commission: ${commText(commRes.value)}`
          await logBroker(db, { brokerId: nextBroker.id, module: 'customer', type: 'assigned', title: `${prevBrokerId ? 'Now handling' : 'Assigned to'} customer: ${existing.name}`, details: cSummary, refs, actor })
          extraLogs.push({ type: 'profile', title: `Broker assigned: ${nextBroker.name}`, details: cSummary, source: 'auto' })
        } else if (nextBroker && commText(prevComm) !== commText(commRes.value)) {
          await logBroker(db, { brokerId: nextBroker.id, module: 'customer', type: 'commission_set', title: `Commission changed on customer: ${existing.name}`, changes: [{ field: 'commission', label: 'Commission', from: commText(prevComm), to: commText(commRes.value) }], refs, actor })
          extraLogs.push({ type: 'profile', title: `Broker commission updated to ${commText(commRes.value)}`, details: `Broker: ${nextBroker.name}`, source: 'auto' })
        }
      }
    }

    if (changed.length || extraLogs.length) {
      const update = { $set: set }
      if (Object.keys(unset).length) update.$unset = unset
      try {
        await col.updateOne({ id: existing.id }, update)
      } catch (err) {
        if (err?.code === 11000) return res.status(409).json({ success: false, error: 'Another customer already uses this phone number.' })
        throw err
      }
      const profileChanged = changed.filter((c) => c !== 'Total amount')
      if (profileChanged.length) {
        const title =
          set.status && profileChanged.length === 1
            ? set.status === 'archived'
              ? 'Customer archived'
              : 'Customer restored'
            : `Profile updated: ${profileChanged.join(', ')}`
        await logCustomerActivity(db, existing.id, { type: set.status ? 'status' : 'profile', title, source: 'manual' }, actor)
      }
      for (const l of extraLogs) {
        await logCustomerActivity(db, existing.id, l, actor)
      }
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

/**
 * POST /api/customers/:id/payments  → record a payment directly on a customer
 */
router.post('/:id/payments', async (req, res) => {
  try {
    const db = await getDb()
    const customer = await db.collection('customers').findOne({ id: req.params.id }, { projection: { _id: 0 } })
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' })
    const pr = readCustomerPayment(req.body || {})
    if (pr.error) return res.status(400).json({ success: false, error: pr.error })

    const now = new Date()
    const actor = actorOf(req)
    const paymentId = `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const payment = {
      id: paymentId,
      customerId: customer.id,
      leadId: null,
      leadName: customer.name,
      customerName: customer.name,
      ...pr.payment,
      createdAt: now,
      createdBy: actor,
    }
    await db.collection('payments').insertOne({ ...payment })
    await logCustomerActivity(
      db,
      customer.id,
      {
        type: 'payment',
        title: `${payment.paymentFor} of ${payment.amountFormatted} recorded via ${payment.mode}`,
        details: [payment.referenceNo && `Ref: ${payment.referenceNo}`, payment.note].filter(Boolean).join(' · '),
        occurredAt: new Date(`${payment.paidOn}T12:00:00Z`),
        paymentId,
        amount: payment.amount,
        source: 'auto',
      },
      actor,
    )
    await syncCustomerPaymentTotals(db, customer)
    return res.status(201).json({ success: true, payment })
  } catch (err) {
    console.error('Error recording customer payment:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/customers/:id/payments/:paymentId  → edit a customer payment record
 */
router.patch('/:id/payments/:paymentId', async (req, res) => {
  try {
    const db = await getDb()
    const customer = await db.collection('customers').findOne({ id: req.params.id }, { projection: { _id: 0 } })
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' })
    const filter = await customerPaymentsFilter(customer)
    const existing = await db.collection('payments').findOne({ ...filter, id: req.params.paymentId }, { projection: { _id: 0 } })
    if (!existing) return res.status(404).json({ success: false, error: 'Payment not found' })

    const pr = readCustomerPayment({ ...existing, ...(req.body || {}) })
    if (pr.error) return res.status(400).json({ success: false, error: pr.error })

    const actor = actorOf(req)
    await db.collection('payments').updateOne(
      { id: existing.id },
      { $set: { ...pr.payment, editedAt: new Date(), editedBy: actor } },
    )
    await syncCustomerPaymentTotals(db, customer)
    await logCustomerActivity(
      db,
      customer.id,
      {
        type: 'payment',
        title: `Payment updated: ${pr.payment.paymentFor} (${pr.payment.amountFormatted})`,
        details: [pr.payment.mode, pr.payment.referenceNo && `Ref: ${pr.payment.referenceNo}`, pr.payment.note].filter(Boolean).join(' · '),
        occurredAt: new Date(),
        amount: pr.payment.amount,
        source: 'auto',
      },
      actor,
    )
    const payment = await db.collection('payments').findOne({ id: existing.id }, { projection: { _id: 0 } })
    return res.json({ success: true, payment })
  } catch (err) {
    console.error('Error updating customer payment:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/customers/:id/payments/:paymentId  → remove a customer payment record
 */
router.delete('/:id/payments/:paymentId', async (req, res) => {
  try {
    const db = await getDb()
    const customer = await db.collection('customers').findOne({ id: req.params.id }, { projection: { _id: 0 } })
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' })
    const filter = await customerPaymentsFilter(customer)
    const existing = await db.collection('payments').findOne({ ...filter, id: req.params.paymentId }, { projection: { _id: 0 } })
    if (!existing) return res.status(404).json({ success: false, error: 'Payment not found' })

    await db.collection('payments').deleteOne({ id: existing.id })
    await syncCustomerPaymentTotals(db, customer)
    await logCustomerActivity(
      db,
      customer.id,
      {
        type: 'payment',
        title: `Payment removed: ${existing.paymentFor || 'Payment'} (${existing.amountFormatted || rupees(existing.amount)})`,
        source: 'auto',
      },
      actorOf(req),
    )
    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting customer payment:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
