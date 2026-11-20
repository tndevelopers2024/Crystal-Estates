import crypto from 'crypto'

/**
 * Customer profiles + their activity timeline.
 *
 * Collections
 *   customers          one document per real person (deduplicated by phone, then email)
 *   customer_activity  every interaction: calls, follow-ups, meetings, visits, status
 *                      changes, payments, property interest, notes, profile edits …
 *
 * A customer is created when a lead is first contacted (or pays), linked back to
 * that lead (lead.customerId), and reused for any later lead with the same phone
 * or email, so converting or editing a lead never creates a duplicate.
 */

export const ACTIVITY_TYPES = [
  'call',
  'followup',
  'meeting',
  'visit',
  'status',
  'payment',
  'property',
  'note',
  'whatsapp',
  'email',
  'document',
  'profile',
  'other',
]

/** Lead stages that mean the person has been contacted (everything except new / lost). */
export const CONTACTED_STAGES = new Set(['contacted', 'followup', 'sitevisit', 'sitevisitdone', 'negotiation', 'won'])

export const STAGE_LABELS = {
  new: 'New leads',
  contacted: 'Contacted',
  followup: 'Follow-up',
  sitevisit: 'Site visit',
  sitevisitdone: 'Site visit done',
  negotiation: 'Negotiation',
  won: 'Won - Booked',
  lost: 'Lost',
}

/** Last 10 digits of a phone number (Indian mobiles with or without +91), or null. */
export function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 6) return null
  return digits.length > 10 ? digits.slice(-10) : digits
}

export function emailKey(email) {
  const e = String(email || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max)
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`
const isGeneric = (property) => !property || /^general enquiry$/i.test(String(property).trim())

export function normalizeActor(actor) {
  if (!actor || !actor.name) return { name: 'CRM user', email: '' }
  return { name: clean(actor.name, 120), email: clean(actor.email, 160) }
}

/** Map a lead follow-up type ("Call", "Site visit", …) to an activity type. */
export function followUpActivityType(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('call')) return 'call'
  if (t.includes('meet')) return 'meeting'
  if (t.includes('visit')) return 'visit'
  if (t.includes('whatsapp')) return 'whatsapp'
  if (t.includes('mail')) return 'email'
  return 'followup'
}

/** Best-guess type for an existing free-text lead activity line (used when importing history). */
export function guessActivityType(text) {
  const t = String(text || '').toLowerCase()
  if (/payment|advance|recorded via|₹/.test(t)) return 'payment'
  if (/stage|moved to|won|lost/.test(t)) return 'status'
  if (/site visit|visited/.test(t)) return 'visit'
  if (/follow-up|follow up|scheduled/.test(t)) return 'followup'
  if (/note/.test(t)) return 'note'
  if (/whatsapp/.test(t)) return 'whatsapp'
  if (/call/.test(t)) return 'call'
  if (/email|mail/.test(t)) return 'email'
  if (/assigned/.test(t)) return 'profile'
  return 'other'
}

let indexesReady = null
/** Create the indexes once per process. The phone index is what makes duplicates impossible. */
export function ensureCustomerIndexes(db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection('customers').createIndex({ id: 1 }, { unique: true }),
      db
        .collection('customers')
        .createIndex({ phoneKey: 1 }, { unique: true, partialFilterExpression: { phoneKey: { $type: 'string' } } }),
      db.collection('customers').createIndex({ emailKey: 1 }),
      db.collection('customers').createIndex({ leadIds: 1 }),
      db.collection('customers').createIndex({ updatedAt: -1 }),
      db.collection('customer_activity').createIndex({ customerId: 1, occurredAt: -1 }),
      db.collection('customer_activity').createIndex({ id: 1 }, { unique: true }),
    ]).catch((err) => {
      indexesReady = null
      throw err
    })
  }
  return indexesReady
}

/** Find the customer a lead belongs to: already linked, then same phone, then same email. */
export async function findCustomerForLead(db, lead) {
  if (!lead) return null
  const col = db.collection('customers')
  if (lead.customerId) {
    const linked = await col.findOne({ id: lead.customerId }, { projection: { _id: 0 } })
    if (linked) return linked
  }
  const byLead = await col.findOne({ leadIds: lead.id }, { projection: { _id: 0 } })
  if (byLead) return byLead
  const pk = phoneKey(lead.phone)
  if (pk) {
    const byPhone = await col.findOne({ phoneKey: pk }, { projection: { _id: 0 } })
    if (byPhone) return byPhone
  }
  const ek = emailKey(lead.email)
  if (ek) {
    const byEmail = await col.findOne({ emailKey: ek }, { projection: { _id: 0 } })
    if (byEmail) return byEmail
  }
  return null
}

/**
 * Append one entry to a customer's timeline and keep the list counters current.
 * `entry`: { type, title, details?, occurredAt?, leadId?, paymentId?, propertyId?, property?, amount?, meta?, source? }
 */
export async function logCustomerActivity(db, customerId, entry, actor) {
  if (!customerId || !entry?.title) return null
  const type = ACTIVITY_TYPES.includes(entry.type) ? entry.type : 'other'
  const occurredAt = entry.occurredAt ? new Date(entry.occurredAt) : new Date()
  const doc = {
    id: newId('cact'),
    customerId,
    type,
    title: clean(entry.title, 240),
    details: clean(entry.details, 2000),
    occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
    leadId: entry.leadId || null,
    paymentId: entry.paymentId || null,
    propertyId: entry.propertyId || null,
    property: entry.property ? clean(entry.property, 160) : null,
    amount: Number.isFinite(Number(entry.amount)) && entry.amount !== null && entry.amount !== '' ? Number(entry.amount) : null,
    meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {},
    source: entry.source === 'manual' ? 'manual' : 'auto',
    actor: normalizeActor(actor),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.collection('customer_activity').insertOne(doc)
  const inc = { activityCount: 1 }
  // Totals only count real payment records, not hand-written payment notes
  if (type === 'payment' && doc.amount && doc.paymentId) {
    inc.totalPaid = doc.amount
    inc.paymentsCount = 1
  }
  await db.collection('customers').updateOne(
    { id: customerId },
    { $inc: inc, $max: { lastActivityAt: doc.occurredAt }, $set: { updatedAt: new Date() } },
  )
  delete doc._id
  return doc
}

/** Seed a new customer's timeline from the lead's earlier history (runs once per lead link). */
async function importLeadHistory(db, customerId, lead) {
  const entries = []
  const payments = Array.isArray(lead.payments) ? lead.payments : []
  for (const p of payments) {
    entries.push({
      type: 'payment',
      title: `${p.paymentFor || 'Payment'} of ${p.amountFormatted || p.amount} received`,
      details: [p.mode && `Mode: ${p.mode}`, p.referenceNo && `Ref: ${p.referenceNo}`, p.unitAllotted && p.unitAllotted !== 'Not allotted' && `Unit: ${p.unitAllotted}`]
        .filter(Boolean)
        .join(' · '),
      occurredAt: p.paidOn || p.createdAt,
      leadId: lead.id,
      paymentId: p.id,
      propertyId: p.propertyId || lead.propertyId || null,
      property: p.property || lead.property,
      amount: p.amount,
    })
  }
  const acts = Array.isArray(lead.activity) ? lead.activity : []
  for (const a of acts) {
    const type = guessActivityType(a.text)
    // Payment lines are already covered by the payment records above
    if (type === 'payment' && payments.length) continue
    if (!a.text) continue
    entries.push({
      type,
      title: a.text,
      occurredAt: a.createdAt || lead.createdAt,
      leadId: lead.id,
      meta: { importedFromLead: true },
    })
  }
  if (!entries.length) return 0
  const now = new Date()
  const docs = entries.map((e) => {
    const at = new Date(e.occurredAt || lead.createdAt || now)
    return {
      id: newId('cact'),
      customerId,
      type: e.type,
      title: clean(e.title, 240),
      details: clean(e.details, 2000),
      occurredAt: Number.isNaN(at.getTime()) ? now : at,
      leadId: e.leadId,
      paymentId: e.paymentId || null,
      propertyId: e.propertyId || null,
      property: e.property || null,
      amount: Number.isFinite(Number(e.amount)) ? Number(e.amount) : null,
      meta: { ...(e.meta || {}), importedFromLead: true },
      source: 'auto',
      actor: { name: 'Lead history', email: '' },
      createdAt: now,
      updatedAt: now,
    }
  })
  await db.collection('customer_activity').insertMany(docs)
  const paid = docs.filter((d) => d.type === 'payment' && d.amount && d.paymentId)
  const last = docs.reduce((m, d) => (d.occurredAt > m ? d.occurredAt : m), new Date(0))
  await db.collection('customers').updateOne(
    { id: customerId },
    {
      $inc: { activityCount: docs.length, totalPaid: paid.reduce((s, d) => s + d.amount, 0), paymentsCount: paid.length },
      $max: { lastActivityAt: last },
    },
  )
  return docs.length
}

/**
 * Create the customer for a lead, or merge the lead into the existing customer.
 * Never creates a second customer for the same phone/email (unique index + retry).
 * Returns { customer, created, linked } where `linked` is true when this lead was newly attached.
 */
export async function upsertCustomerFromLead(db, lead, { actor, reason = 'Lead contacted' } = {}) {
  if (!lead || !lead.id) return { customer: null, created: false, linked: false }
  await ensureCustomerIndexes(db)
  const col = db.collection('customers')
  const now = new Date()
  const interest = !isGeneric(lead.property)
    ? { propertyId: lead.propertyId || null, property: clean(lead.property, 160), unit: lead.unit && lead.unit !== 'Not allotted' ? clean(lead.unit, 60) : null }
    : null

  let existing = await findCustomerForLead(db, lead)
  let created = false

  if (!existing) {
    const doc = {
      id: newId('cust'),
      name: clean(lead.name, 120) || 'Unnamed customer',
      phone: clean(lead.phone, 40),
      phoneKey: phoneKey(lead.phone),
      email: clean(lead.email, 160),
      emailKey: emailKey(lead.email),
      address: '',
      city: '',
      notes: '',
      tags: [],
      status: 'active',
      source: clean(lead.source, 60) || null,
      assignedAgent: lead.assignedAgent?.name ? { name: clean(lead.assignedAgent.name, 120) } : null,
      leadIds: [lead.id],
      primaryLeadId: lead.id,
      interests: interest ? [{ ...interest, addedAt: now }] : [],
      activityCount: 0,
      totalPaid: 0,
      paymentsCount: 0,
      lastActivityAt: now,
      convertedAt: now,
      createdBy: normalizeActor(actor),
      createdAt: now,
      updatedAt: now,
    }
    if (!doc.phoneKey) delete doc.phoneKey // keeps the partial unique index happy
    try {
      await col.insertOne(doc)
      delete doc._id
      existing = doc
      created = true
    } catch (err) {
      // Another request created this customer at the same moment — use theirs
      if (err?.code !== 11000) throw err
      existing = await findCustomerForLead(db, lead)
      if (!existing) throw err
    }
  }

  const alreadyLinked = (existing.leadIds || []).includes(lead.id)
  const set = { updatedAt: now }
  // Fill gaps from the lead without overwriting details staff have edited
  if (!existing.phone && lead.phone && phoneKey(lead.phone)) {
    const pk = phoneKey(lead.phone)
    const clash = await col.findOne({ phoneKey: pk, id: { $ne: existing.id } }, { projection: { id: 1 } })
    if (!clash) Object.assign(set, { phone: clean(lead.phone, 40), phoneKey: pk })
  }
  if (!existing.email && emailKey(lead.email)) Object.assign(set, { email: clean(lead.email, 160), emailKey: emailKey(lead.email) })
  if (!existing.assignedAgent && lead.assignedAgent?.name) set.assignedAgent = { name: clean(lead.assignedAgent.name, 120) }

  const update = { $set: set, $addToSet: { leadIds: lead.id } }
  const hasInterest = interest && (existing.interests || []).some((i) => (i.propertyId && i.propertyId === interest.propertyId) || i.property === interest.property)
  if (interest && !hasInterest) update.$push = { interests: { ...interest, addedAt: now } }
  await col.updateOne({ id: existing.id }, update)

  if (lead.customerId !== existing.id) {
    await db.collection('leads').updateOne({ id: lead.id }, { $set: { customerId: existing.id } })
  }

  if (created || !alreadyLinked) {
    await importLeadHistory(db, existing.id, lead)
    await logCustomerActivity(
      db,
      existing.id,
      {
        type: 'status',
        title: created ? `Customer profile created — ${reason}` : `Lead linked to this customer — ${reason}`,
        details: [lead.source && `Source: ${lead.source}`, !isGeneric(lead.property) && `Interested in ${lead.property}`].filter(Boolean).join(' · '),
        leadId: lead.id,
        propertyId: lead.propertyId || null,
        property: isGeneric(lead.property) ? null : lead.property,
      },
      actor,
    )
  }

  const customer = await col.findOne({ id: existing.id }, { projection: { _id: 0 } })
  return { customer, created, linked: created || !alreadyLinked }
}

/** Log an entry for the customer linked to a lead, if that lead has been converted. */
export async function logForLead(db, lead, entry, actor) {
  if (!lead) return null
  const customer = await findCustomerForLead(db, lead)
  if (!customer || !(customer.leadIds || []).includes(lead.id)) return null
  return logCustomerActivity(db, customer.id, { leadId: lead.id, ...entry }, actor)
}

/**
 * Wrap customer bookkeeping so a failure there never breaks the lead action
 * that triggered it (the lead update has already been saved).
 */
export async function safely(fn) {
  try {
    return await fn()
  } catch (err) {
    console.error('Customer sync failed:', err.message)
    return null
  }
}
