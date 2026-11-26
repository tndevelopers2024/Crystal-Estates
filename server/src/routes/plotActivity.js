import { Router } from 'express'
import { getDb } from '../config/db.js'

/**
 * Plot-wise activity log.
 *
 * Every plot change (status, price, booking, boundary, add/remove) and every
 * payment is stored as its own document in `plot_activity`, so a plot's full
 * history can be rebuilt at any time. Existing collections are only read.
 *
 * Document shape:
 * {
 *   id, propertyId, propertyName, phase, plotUid, plotNo,
 *   type: 'created' | 'deleted' | 'status' | 'booking' | 'payment' | 'update' | 'note',
 *   title, changes: [{ field, from, to }],
 *   amount, mode, referenceNo, paidOn,      // payments only
 *   actor: { name, email },
 *   createdAt
 * }
 */

const router = Router()
const COLLECTION = 'plot_activity'
// Buyer details live here, never on the public plot documents
const BOOKINGS = 'plot_bookings'
const PAYMENT_STATUS = ['Received', 'Pending clearance', 'Failed']
const ACTIVITY_TYPES = new Set(['created', 'deleted', 'status', 'booking', 'payment', 'update', 'note'])

const TRACKED_FIELDS = [
  ['status', 'Status'],
  ['price', 'Price'],
  ['facing', 'Facing'],
  ['area', 'Area'],
  ['dimensions', 'Dimensions'],
  ['roadWidth', 'Road width'],
  ['type', 'Plot type'],
  ['surveyNo', 'Survey no.'],
  ['plotNo', 'Plot number'],
]

const BOOKING_FIELDS = [
  ['buyerName', 'Buyer'],
  ['phone', 'Buyer phone'],
  ['email', 'Buyer email'],
  ['bookedOn', 'Booking date'],
  ['totalPrice', 'Agreed price'],
  ['notes', 'Booking notes'],
]

const norm = (v) => (v === undefined || v === null ? '' : String(v).trim())

/** Stable identity for a plot across saves: uid first, then phase + number. */
export function plotKey(p) {
  if (p?.uid) return `uid:${p.uid}`
  return `no:${norm(p?.phase).toLowerCase()}#${norm(p?.plotNo).toLowerCase()}`
}

function sanitizeActor(actor) {
  if (!actor || typeof actor !== 'object') return { name: 'CRM user', email: '' }
  return {
    name: norm(actor.name).slice(0, 120) || 'CRM user',
    email: norm(actor.email).slice(0, 160),
  }
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Compare two plot lists and write one activity record per change.
 * Called from PATCH /api/plots/:id. Never throws (logging must not block saves).
 */
export async function logPlotChanges(db, propertyDoc, oldPlots = [], newPlots = [], actor) {
  try {
    if (!propertyDoc) return 0
    const who = sanitizeActor(actor)
    const base = {
      propertyId: propertyDoc.id || propertyDoc.projectId,
      propertyName: propertyDoc.name || propertyDoc.projectName || '',
    }
    const now = Date.now()
    const records = []
    const push = (plot, type, title, changes = []) =>
      records.push({
        id: `pa-${now}-${records.length}-${Math.random().toString(36).slice(2, 7)}`,
        ...base,
        phase: plot.phase || null,
        plotUid: plot.uid || null,
        plotNo: norm(plot.plotNo),
        type,
        title,
        changes,
        actor: who,
        createdAt: new Date(),
      })

    const oldMap = new Map(oldPlots.map((p) => [plotKey(p), p]))
    const newMap = new Map(newPlots.map((p) => [plotKey(p), p]))

    // Re-imported layouts can give the same plots new uids. Fall back to
    // phase + plot number so they log as updates, not delete + add.
    const numKey = (p) => `${norm(p?.phase).toLowerCase()}#${norm(p?.plotNo).toLowerCase()}`
    const unmatchedOldByNum = new Map()
    for (const [key, p] of oldMap) {
      if (!newMap.has(key)) {
        const nk = numKey(p)
        if (!unmatchedOldByNum.has(nk)) unmatchedOldByNum.set(nk, [])
        unmatchedOldByNum.get(nk).push(key)
      }
    }
    const matchedOldKeys = new Set()

    for (const [key, next] of newMap) {
      let prev = oldMap.get(key)
      if (prev) {
        matchedOldKeys.add(key)
      } else {
        const candidates = unmatchedOldByNum.get(numKey(next))
        const oldKey = candidates && candidates.shift()
        if (oldKey) {
          prev = oldMap.get(oldKey)
          matchedOldKeys.add(oldKey)
        }
      }
      if (!prev) {
        push(next, 'created', `Plot ${norm(next.plotNo)} added`, [])
        continue
      }

      const changes = []
      for (const [field, label] of TRACKED_FIELDS) {
        if (norm(prev[field]) !== norm(next[field])) {
          changes.push({ field, label, from: norm(prev[field]), to: norm(next[field]) })
        }
      }
      if (norm(prev.svgPath) !== norm(next.svgPath)) {
        changes.push({ field: 'svgPath', label: 'Boundary', from: prev.svgPath ? 'set' : 'none', to: next.svgPath ? 'updated' : 'removed' })
      }

      if (changes.length > 0) {
        const statusChange = changes.find((c) => c.field === 'status')
        const title = statusChange
          ? `Status changed: ${statusChange.from || '—'} → ${statusChange.to || '—'}`
          : `Plot details updated (${changes.map((c) => c.label).join(', ')})`
        push(next, statusChange ? 'status' : 'update', title, changes)
      }
    }

    for (const [key, prev] of oldMap) {
      if (!matchedOldKeys.has(key)) push(prev, 'deleted', `Plot ${norm(prev.plotNo)} removed`, [])
    }

    if (records.length > 0) await db.collection(COLLECTION).insertMany(records)
    return records.length
  } catch (err) {
    console.warn('Plot activity logging failed:', err.message)
    return 0
  }
}

/**
 * GET /api/plot-activity?propertyId=…&plotUid=…&plotNo=…&phase=…&limit=…
 * Returns activity newest-first. With a plot filter it also returns legacy
 * payments and leads that reference the plot by number (read-only).
 */
router.get('/', async (req, res) => {
  try {
    const { propertyId, plotUid, plotNo, phase } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000)
    if (!propertyId) return res.status(400).json({ success: false, error: 'propertyId is required' })

    const db = await getDb()
    const property = await db
      .collection('featured_plots')
      .findOne({ $or: [{ id: propertyId }, { projectId: propertyId }] }, { projection: { _id: 0, id: 1, projectId: 1, name: 1, projectName: 1 } })

    const ids = [propertyId, property?.id, property?.projectId].filter(Boolean)
    const filter = { propertyId: { $in: ids } }

    if (plotUid || plotNo) {
      const or = []
      if (plotUid) or.push({ plotUid })
      if (plotNo) {
        // Also match by phase + number so history survives uid changes
        // (e.g. a re-imported layout). Duplicate plot numbers in one phase share it.
        const byNo = { plotNo: norm(plotNo) }
        if (phase) byNo.phase = phase
        or.push(byNo)
      }
      filter.$or = or
    }

    const activities = await db
      .collection(COLLECTION)
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    let legacyPayments = []
    let relatedLeads = []
    const propName = property?.name || property?.projectName
    if (plotNo && propName) {
      const plotRe = new RegExp(`(^|[^0-9A-Za-z])${escapeRegex(norm(plotNo))}([^0-9A-Za-z]|$)`, 'i')
      const propRe = new RegExp(escapeRegex(propName), 'i')
      legacyPayments = await db
        .collection('payments')
        .find({ property: propRe, unitAllotted: plotRe, plotLinked: { $ne: true } }, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()
      relatedLeads = await db
        .collection('leads')
        .find(
          { property: propRe, unit: plotRe },
          { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, stage: 1, unit: 1, advanceReceived: 1, budgetFormatted: 1, createdAt: 1 } },
        )
        .limit(20)
        .toArray()
    }

    let booking = null
    if (plotUid || plotNo) {
      const bdoc = await db.collection(BOOKINGS).findOne(
        { propertyId: { $in: ids }, ...(plotUid ? { plotUid } : { plotNo: norm(plotNo), phase: phase || null }) },
        { projection: { _id: 0 } },
      )
      booking = bdoc?.booking || null
    }

    return res.json({ success: true, activities, legacyPayments, relatedLeads, booking })
  } catch (err) {
    console.error('Error fetching plot activity:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

const bookingKey = (b) => b.plotUid || `${b.phase || ''}#${b.plotNo}`

/**
 * GET /api/plot-activity/bookings?propertyId=…
 * All bookings for a property, keyed by plot uid (or phase#plotNo). CRM only.
 */
router.get('/bookings', async (req, res) => {
  try {
    const { propertyId } = req.query
    if (!propertyId) return res.status(400).json({ success: false, error: 'propertyId is required' })
    const db = await getDb()
    const docs = await db.collection(BOOKINGS).find({ propertyId }, { projection: { _id: 0 } }).toArray()
    const bookings = Object.fromEntries(docs.map((d) => [bookingKey(d), d.booking]))
    return res.json({ success: true, bookings })
  } catch (err) {
    console.error('Error fetching plot bookings:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PUT /api/plot-activity/booking
 * Create or update the booking (buyer, agreed price, date, notes) for one plot
 * and log every changed field as a 'booking' activity record.
 */
router.put('/booking', async (req, res) => {
  try {
    const { propertyId, propertyName, phase, plotUid, plotNo, booking, actor } = req.body || {}
    if (!propertyId || !norm(plotNo)) {
      return res.status(400).json({ success: false, error: 'propertyId and plotNo are required' })
    }
    if (!booking || !norm(booking.buyerName)) {
      return res.status(400).json({ success: false, error: "Buyer's name is required" })
    }

    const clean = {}
    for (const [field] of BOOKING_FIELDS) clean[field] = norm(booking[field]).slice(0, field === 'notes' ? 2000 : 200)
    if (booking.leadId) clean.leadId = norm(booking.leadId).slice(0, 80)

    const db = await getDb()
    const filter = { propertyId, ...(plotUid ? { plotUid } : { plotNo: norm(plotNo), phase: phase || null }) }
    const prevDoc = await db.collection(BOOKINGS).findOne(filter)
    const prev = prevDoc?.booking || {}

    const changes = []
    for (const [field, label] of BOOKING_FIELDS) {
      if (norm(prev[field]) !== norm(clean[field])) changes.push({ field: `booking.${field}`, label, from: norm(prev[field]), to: clean[field] })
    }

    await db.collection(BOOKINGS).updateOne(
      filter,
      {
        $set: { ...filter, plotNo: norm(plotNo), phase: phase || null, propertyName: norm(propertyName), booking: clean, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    )

    if (changes.length > 0) {
      await db.collection(COLLECTION).insertOne({
        id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        propertyId,
        propertyName: norm(propertyName),
        phase: phase || null,
        plotUid: plotUid || null,
        plotNo: norm(plotNo),
        type: 'booking',
        title: !norm(prev.buyerName) ? `Booked by ${clean.buyerName}` : 'Booking details updated',
        changes,
        actor: sanitizeActor(actor),
        createdAt: new Date(),
      })
    }

    return res.json({ success: true, booking: clean, changed: changes.length })
  } catch (err) {
    console.error('Error saving plot booking:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/plot-activity
 * Record a payment or note against one plot.
 */
router.post('/', async (req, res) => {
  try {
    const { propertyId, propertyName, phase, plotUid, plotNo, type = 'note', title, amount, mode, referenceNo, paidOn, note, actor, documentIds, clientRequestId, status, leadId } = req.body || {}

    if (!propertyId || !norm(plotNo)) {
      return res.status(400).json({ success: false, error: 'propertyId and plotNo are required' })
    }
    if (!ACTIVITY_TYPES.has(type) || !['payment', 'note'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Only payment and note entries can be added manually' })
    }

    const requestId = norm(clientRequestId).slice(0, 80)
    if (requestId) {
      const db0 = await getDb()
      const existing = await db0.collection(COLLECTION).findOne({ clientRequestId: requestId }, { projection: { _id: 0 } })
      if (existing) return res.json({ success: true, activity: existing, duplicate: true })
    }

    const record = {
      id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...(requestId ? { clientRequestId: requestId } : {}),
      propertyId,
      propertyName: norm(propertyName),
      phase: phase || null,
      plotUid: plotUid || null,
      plotNo: norm(plotNo),
      type,
      changes: [],
      actor: sanitizeActor(actor),
      createdAt: new Date(),
    }

    if (type === 'payment') {
      const num = Number(amount)
      if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({ success: false, error: 'A valid payment amount is required' })
      }
      record.amount = num
      record.mode = norm(mode) || 'Bank transfer'
      record.referenceNo = norm(referenceNo)
      record.paidOn = norm(paidOn) || new Date().toISOString().slice(0, 10)
      record.note = norm(note).slice(0, 500)
      record.title = norm(title) || `Payment of ₹${num.toLocaleString('en-IN')} received`
      // Only "Received" money counts towards the balance
      record.status = PAYMENT_STATUS.includes(status) ? status : 'Received'
      // The customer (lead) this payment belongs to, when the buyer is linked
      if (norm(leadId)) {
        const db1 = await getDb()
        const lead = await db1.collection('leads').findOne({ id: norm(leadId) }, { projection: { _id: 0, id: 1, name: 1 } })
        if (!lead) return res.status(400).json({ success: false, error: 'The linked customer no longer exists' })
        record.leadId = lead.id
        record.customerName = lead.name
      }
      // Plot documents chosen to go with this payment (ids from plot_documents)
      if (Array.isArray(documentIds)) {
        const ids = documentIds.map((d) => norm(d).slice(0, 60)).filter(Boolean).slice(0, 20)
        if (ids.length) record.documentIds = ids
      }
    } else {
      const text = norm(note || title).slice(0, 1000)
      if (!text) return res.status(400).json({ success: false, error: 'Note text is required' })
      record.note = text
      record.title = 'Note added'
    }

    const db = await getDb()
    await db.collection(COLLECTION).insertOne(record)
    const { _id, ...clean } = record
    return res.status(201).json({ success: true, activity: clean })
  } catch (err) {
    console.error('Error recording plot activity:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/plot-activity/:id
 * Correct a payment or note entered on a plot (history entries made by the system can't be edited).
 */
router.patch('/:id', async (req, res) => {
  try {
    const db = await getDb()
    const entry = await db.collection(COLLECTION).findOne({ id: req.params.id })
    if (!entry || !['payment', 'note'].includes(entry.type) || entry.paymentId) {
      return res.status(404).json({ success: false, error: 'Only payments and notes added on the plot can be edited here' })
    }
    const b = req.body || {}
    const set = {}
    if (entry.type === 'payment') {
      if (b.amount !== undefined) {
        const n = Number(b.amount)
        if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, error: 'A valid payment amount is required' })
        set.amount = n
        set.title = `Payment of ₹${n.toLocaleString('en-IN')} received`
      }
      if (b.mode !== undefined) set.mode = norm(b.mode)
      if (b.referenceNo !== undefined) set.referenceNo = norm(b.referenceNo)
      if (b.paidOn !== undefined) set.paidOn = norm(b.paidOn)
      if (b.note !== undefined) set.note = norm(b.note).slice(0, 500)
      if (b.status !== undefined) {
        if (!PAYMENT_STATUS.includes(b.status)) return res.status(400).json({ success: false, error: 'Choose Received, Pending clearance or Failed' })
        set.status = b.status
      }
    } else {
      const t = norm(b.note).slice(0, 1000)
      if (!t) return res.status(400).json({ success: false, error: 'The note cannot be empty' })
      set.note = t
    }
    await db.collection(COLLECTION).updateOne({ id: entry.id }, { $set: { ...set, editedAt: new Date(), editedBy: sanitizeActor(b.actor) } })
    const fresh = await db.collection(COLLECTION).findOne({ id: entry.id }, { projection: { _id: 0 } })
    return res.json({ success: true, activity: fresh })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

/** DELETE /api/plot-activity/:id - remove a payment or note entered on a plot (recorded in the history). */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb()
    const entry = await db.collection(COLLECTION).findOne({ id: req.params.id })
    if (!entry || !['payment', 'note'].includes(entry.type) || entry.paymentId) {
      return res.status(404).json({ success: false, error: 'Only payments and notes added on the plot can be deleted here' })
    }
    await db.collection(COLLECTION).deleteOne({ id: entry.id })
    await db.collection(COLLECTION).insertOne({
      id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      propertyId: entry.propertyId,
      propertyName: entry.propertyName,
      phase: entry.phase || null,
      plotUid: entry.plotUid || null,
      plotNo: entry.plotNo,
      type: 'update',
      title: entry.type === 'payment' ? `Payment of ₹${Number(entry.amount).toLocaleString('en-IN')} deleted` : 'Note deleted',
      changes: [],
      actor: sanitizeActor(req.body?.actor),
      createdAt: new Date(),
    })
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
