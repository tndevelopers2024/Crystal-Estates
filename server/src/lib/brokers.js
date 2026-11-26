import { C, COMMISSION_TYPES, norm, text, num, round2, newId, commissionAmount } from './land.js'
import { logCustomerActivity, logForLead } from './customers.js'

/**
 * Brokers across the whole CRM.
 *
 * One directory (`land_parties`, type "broker") is used by every module:
 *   Leads            lead.referral          { brokerId, commission, assignedAt }
 *   Plot bookings    plot_bookings.referral same shape; a booking linked to a lead uses the lead's
 *   Land plots       land_plots.brokerId / commission (see routes/land.js)
 *   Land projects    land_projects.brokerIds
 * Commission paid for leads and bookings is recorded in `broker_commission_payments`
 * (land plots keep theirs in `land_commission_payments`).
 * Everything that happens to a broker is written to `broker_activity`.
 */
export const PARTIES = C.parties
export const BROKER_ACTIVITY = 'broker_activity'
export const BROKER_PAYMENTS = 'broker_commission_payments'
export const BOOKINGS = 'plot_bookings'

const PARTY_TYPES = ['vendor', 'broker']
const VENDOR_KINDS = ['Landowner', 'Vendor']

/* ───────────── Validation ───────────── */

const phoneProblem = (p) => (p && !/^\+?[0-9][0-9\s-]{6,17}$/.test(p) ? 'Enter a valid phone number.' : null)
const emailProblem = (e) => (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? 'Enter a valid email address.' : null)

function money(v, label, max = 1e11) {
  const n = num(v)
  if (Number.isNaN(n)) return { error: `${label} must be a number.` }
  if (n !== null && (n < 0 || n > max)) return { error: `${label} must be between 0 and ${max.toLocaleString('en-IN')}.` }
  return { value: n === null ? null : round2(n) }
}

/** { type, kind?, defaultCommission? } or { error } for a landowner, vendor or broker. */
export function readParty(b, type, existing = null) {
  const v = { type }
  const name = text(existing && b.name === undefined ? existing.name : b.name, 120)
  if (!name) return { error: type === 'broker' ? 'Broker name is required.' : 'Name is required.' }
  v.name = name
  for (const [k, max] of [['phone', 20], ['altPhone', 20], ['email', 160], ['address', 300], ['notes', 1000]]) v[k] = text(b[k] !== undefined ? b[k] : existing?.[k], max)
  const bad = phoneProblem(v.phone) || phoneProblem(v.altPhone) || emailProblem(v.email)
  if (bad) return { error: bad }
  v.active = b.active !== undefined ? Boolean(b.active) : existing ? existing.active !== false : true
  if (type === 'vendor') {
    const kind = text(b.kind !== undefined ? b.kind : existing?.kind, 20) || 'Landowner'
    if (!VENDOR_KINDS.includes(kind)) return { error: 'Choose Landowner or Vendor.' }
    v.kind = kind
  } else {
    // Usual commission for this broker; each deal can override it
    const dc = b.defaultCommission !== undefined ? b.defaultCommission : existing?.defaultCommission
    if (dc && dc.value !== undefined && dc.value !== '' && dc.value !== null) {
      const val = money(dc.value, 'Commission')
      if (val.error) return val
      const t = COMMISSION_TYPES.includes(dc.type) ? dc.type : 'percent'
      if (t === 'percent' && val.value > 100) return { error: 'A percentage commission cannot be more than 100.' }
      v.defaultCommission = val.value ? { type: t, value: val.value } : null
    } else v.defaultCommission = null
  }
  return { value: v }
}

/** A commission { type, value, note } or null; { error } when invalid. */
export function readCommission(c) {
  if (!c || c.value === undefined || c.value === '' || c.value === null) return { value: null }
  const val = money(c.value, 'Commission')
  if (val.error) return val
  const t = COMMISSION_TYPES.includes(c.type) ? c.type : 'percent'
  if (t === 'percent' && val.value > 100) return { error: 'A percentage commission cannot be more than 100.' }
  return { value: val.value ? { type: t, value: val.value, note: text(c.note, 200) } : null }
}

export const commissionStatus = (payable, paid) => (!(payable > 0) ? 'Not set' : paid <= 0 ? 'Pending' : paid >= payable ? 'Paid' : 'Part paid')

/** "₹ 42 Lakhs" / "4200000" / "1.2 Cr" → rupees */
export function parseRupees(value) {
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

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const cText = (c) => (c ? (c.type === 'percent' ? `${c.value}%` : `${rupees(c.value)} fixed`) : 'no commission')

/* ───────────── Activity log ───────────── */

/**
 * One entry in the broker's activity log.
 * type: created | updated | deleted | assigned | removed | commission_set | commission_payment | referral | note | status
 * module: directory | lead | property | land
 */
export async function logBroker(db, { brokerId, module = 'directory', type, title, details = '', refs = {}, changes = [], actor }) {
  if (!brokerId) return
  await db.collection(BROKER_ACTIVITY).insertOne({
    id: newId('ba'),
    brokerId,
    module,
    type,
    title,
    details,
    refs,
    changes,
    by: actor || { name: 'CRM user', email: '' },
    at: new Date(),
  })
}

/* ───────────── Directory (shared with the land routes) ───────────── */

/** How many records use each broker / landowner / vendor. */
export async function partyUsageAll(db) {
  const [projects, plots, leads, bookings, customers] = await Promise.all([
    db.collection(C.projects).find({}, { projection: { _id: 0, vendorId: 1, landownerId: 1, brokerIds: 1 } }).toArray(),
    db.collection(C.plots).find({ brokerId: { $ne: null } }, { projection: { _id: 0, brokerId: 1 } }).toArray(),
    db.collection('leads').find({ 'referral.brokerId': { $ne: null } }, { projection: { _id: 0, 'referral.brokerId': 1 } }).toArray(),
    db.collection(BOOKINGS).find({ 'referral.brokerId': { $ne: null } }, { projection: { _id: 0, 'referral.brokerId': 1 } }).toArray(),
    db.collection('customers').find({ 'referral.brokerId': { $ne: null } }, { projection: { _id: 0, 'referral.brokerId': 1 } }).toArray(),
  ])
  const bump = (m, k) => k && m.set(k, (m.get(k) || 0) + 1)
  const onProjects = new Map() // landowner / vendor / broker on a land project
  const landPlots = new Map()
  const leadRefs = new Map()
  const bookingRefs = new Map()
  const customerRefs = new Map()
  for (const p of projects) {
    bump(onProjects, p.landownerId)
    if (p.vendorId !== p.landownerId) bump(onProjects, p.vendorId)
    for (const id of new Set(p.brokerIds || [])) bump(onProjects, id)
  }
  for (const p of plots) bump(landPlots, p.brokerId)
  for (const l of leads) bump(leadRefs, l.referral?.brokerId)
  for (const b of bookings) bump(bookingRefs, b.referral?.brokerId)
  for (const c of customers) bump(customerRefs, c.referral?.brokerId)
  return { onProjects, landPlots, leadRefs, bookingRefs, customerRefs }
}

export async function listParties(db, type) {
  const filter = PARTY_TYPES.includes(type) ? { type } : {}
  const [parties, u] = await Promise.all([db.collection(PARTIES).find(filter, { projection: { _id: 0 } }).toArray(), partyUsageAll(db)])
  parties.sort((a, b) => a.name.localeCompare(b.name))
  return parties.map((p) => {
    if (p.type !== 'broker') return { ...p, usage: u.onProjects.get(p.id) || 0, projects: u.onProjects.get(p.id) || 0 }
    const leads = u.leadRefs.get(p.id) || 0
    const bookings = u.bookingRefs.get(p.id) || 0
    const plots = u.landPlots.get(p.id) || 0
    const customers = u.customerRefs.get(p.id) || 0
    // usage: everything this broker referred; projects: land projects they are on
    return { ...p, usage: leads + bookings + plots + customers, projects: u.onProjects.get(p.id) || 0, leads, bookings, landPlots: plots, customers }
  })
}

const exactName = (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')

export async function createParty(db, type, body, actor) {
  if (!PARTY_TYPES.includes(type)) return { status: 400, error: 'Choose vendor or broker.' }
  const r = readParty(body || {}, type)
  if (r.error) return { status: 400, error: r.error }
  if (await db.collection(PARTIES).findOne({ type, name: exactName(r.value.name) })) return { status: 409, error: `${r.value.name} already exists.` }
  const party = { id: newId(type === 'broker' ? 'lb' : 'lv'), ...r.value, createdAt: new Date(), updatedAt: new Date(), createdBy: actor }
  await db.collection(PARTIES).insertOne({ ...party })
  if (type === 'broker') await logBroker(db, { brokerId: party.id, type: 'created', title: 'Broker added', details: [party.phone, party.email].filter(Boolean).join(' · '), actor })
  return { party }
}

const FIELD_LABELS = { name: 'Name', phone: 'Phone', altPhone: 'Alternate phone', email: 'Email', address: 'Address', notes: 'Notes' }

export async function updateParty(db, id, body, actor) {
  const existing = await db.collection(PARTIES).findOne({ id }, { projection: { _id: 0 } })
  if (!existing) return { status: 404, error: 'Not found.' }
  const r = readParty(body || {}, existing.type, existing)
  if (r.error) return { status: 400, error: r.error }
  const clash = await db.collection(PARTIES).findOne({ type: existing.type, id: { $ne: id }, name: exactName(r.value.name) })
  if (clash) return { status: 409, error: `${r.value.name} already exists.` }
  const party = { ...existing, ...r.value, updatedAt: new Date() }
  await db.collection(PARTIES).replaceOne({ id }, party)
  if (existing.type === 'broker') {
    const show = (v) => (v === undefined || v === null || v === '' ? '—' : String(v))
    const changes = Object.entries(FIELD_LABELS)
      .filter(([k]) => show(existing[k]) !== show(party[k]))
      .map(([k, label]) => ({ field: k, label, from: show(existing[k]), to: show(party[k]) }))
    if (cText(existing.defaultCommission) !== cText(party.defaultCommission)) changes.push({ field: 'defaultCommission', label: 'Usual commission', from: cText(existing.defaultCommission), to: cText(party.defaultCommission) })
    if ((existing.active !== false) !== (party.active !== false)) changes.push({ field: 'active', label: 'Status', from: existing.active !== false ? 'Active' : 'Inactive', to: party.active !== false ? 'Active' : 'Inactive' })
    if (changes.length) await logBroker(db, { brokerId: id, type: 'updated', title: 'Broker details updated', changes, actor })
  }
  return { party }
}

/** Number of records that use a broker, per module. */
export async function brokerUsage(db, id) {
  const [leads, bookings, plots, projects, customers] = await Promise.all([
    db.collection('leads').countDocuments({ 'referral.brokerId': id }),
    db.collection(BOOKINGS).countDocuments({ 'referral.brokerId': id }),
    db.collection(C.plots).countDocuments({ brokerId: id }),
    db.collection(C.projects).countDocuments({ brokerIds: id }),
    db.collection('customers').countDocuments({ 'referral.brokerId': id }),
  ])
  return { leads, bookings, plots, projects, customers, total: leads + bookings + plots + projects + customers }
}

export async function deleteParty(db, id, actor) {
  const party = await db.collection(PARTIES).findOne({ id })
  if (!party) return { status: 404, error: 'Not found.' }
  const n = (c, w) => `${c} ${w}${c === 1 ? '' : 's'}`
  if (party.type === 'broker') {
    const u = await brokerUsage(db, id)
    if (u.total) {
      const where = [u.leads && n(u.leads, 'lead'), u.customers && n(u.customers, 'customer'), u.bookings && n(u.bookings, 'property booking'), u.plots && n(u.plots, 'land plot'), u.projects && n(u.projects, 'land project')].filter(Boolean).join(', ')
      return { status: 409, error: `${party.name} is linked to ${where}. Remove them from those first, or mark the broker inactive instead.` }
    }
  } else {
    const count = await db.collection(C.projects).countDocuments({ $or: [{ vendorId: id }, { landownerId: id }] })
    if (count) return { status: 409, error: `${party.name} is on ${n(count, 'project')}. Change those projects first, or mark the record inactive instead.` }
  }
  await db.collection(PARTIES).deleteOne({ id })
  // The log stays, so the broker's history is still there to read
  if (party.type === 'broker') await logBroker(db, { brokerId: id, type: 'deleted', title: `Broker deleted (${party.name})`, actor })
  return { ok: true }
}

/* ───────────── Referrals: a broker on a lead or on a plot booking ───────────── */

export const ownerKey = (o) =>
  o.type === 'lead'
    ? `lead:${o.leadId}`
    : o.type === 'customer'
      ? `customer:${o.customerId}`
      : `booking:${o.propertyId}:${o.plotUid || `${o.phase || ''}#${o.plotNo}`}`

const bookingFilter = (ids, o) => ({ propertyId: { $in: ids }, ...(o.plotUid ? { plotUid: o.plotUid } : { plotNo: norm(o.plotNo), phase: o.phase || null }) })

/**
 * Find what a referral belongs to.
 * input: { type: 'lead', leadId } | { type: 'customer', customerId } | { type: 'booking', propertyId, plotUid, plotNo, phase }
 * A booking whose buyer is linked to a lead resolves to that lead, so the
 * broker is recorded once, on the customer's lead.
 */
export async function resolveOwner(db, input) {
  if (input?.type === 'lead') {
    const lead = await db.collection('leads').findOne({ id: norm(input.leadId) }, { projection: { _id: 0 } })
    if (!lead) return { error: 'Lead not found.', status: 404 }
    return leadOwner(lead)
  }
  if (input?.type === 'customer') {
    const customer = await db.collection('customers').findOne({ id: norm(input.customerId) }, { projection: { _id: 0 } })
    if (!customer) return { error: 'Customer not found.', status: 404 }
    return customerOwner(customer)
  }
  if (input?.type === 'booking') {
    const propertyId = norm(input.propertyId)
    const prop = await db.collection('featured_plots').findOne({ $or: [{ id: propertyId }, { projectId: propertyId }] }, { projection: { _id: 0, id: 1, projectId: 1, name: 1 } })
    if (!prop) return { error: 'Property not found.', status: 404 }
    const ids = [...new Set([propertyId, prop.id, prop.projectId].filter(Boolean))]
    const o = { type: 'booking', propertyId: prop.id || propertyId, plotUid: norm(input.plotUid), plotNo: norm(input.plotNo), phase: norm(input.phase) || null }
    if (!o.plotNo) return { error: 'Choose a plot.', status: 400 }
    const doc = await db.collection(BOOKINGS).findOne(bookingFilter(ids, o), { projection: { _id: 0 } })
    if (!doc?.booking?.buyerName) return { error: 'Save the booking (the buyer) first, then add the broker.', status: 400 }
    if (doc.booking.leadId) {
      const lead = await db.collection('leads').findOne({ id: doc.booking.leadId }, { projection: { _id: 0 } })
      if (lead) return { ...leadOwner(lead), via: 'booking', plot: { propertyName: prop.name, plotNo: o.plotNo } }
    }
    return {
      kind: 'booking',
      key: ownerKey(o),
      label: doc.booking.buyerName,
      dealValue: parseRupees(doc.booking.totalPrice),
      referral: doc.referral || null,
      refs: { propertyId: o.propertyId, propertyName: prop.name, plotUid: o.plotUid, plotNo: o.plotNo, phase: o.phase, buyerName: doc.booking.buyerName },
      owner: o,
      doc,
      filter: bookingFilter(ids, o),
      place: `Plot ${o.plotNo}, ${prop.name}`,
    }
  }
  return { error: 'Choose a lead or a plot booking.', status: 400 }
}

function customerOwner(customer) {
  return {
    kind: 'customer',
    key: `customer:${customer.id}`,
    label: customer.name,
    dealValue: num(customer.dealValue) || null,
    referral: customer.referral || null,
    refs: { customerId: customer.id, customerName: customer.name },
    owner: { type: 'customer', customerId: customer.id },
    customer,
    place: [customer.city, customer.phone].filter(Boolean).join(' · '),
  }
}

function leadOwner(lead) {
  return {
    kind: 'lead',
    key: `lead:${lead.id}`,
    label: lead.name,
    dealValue: num(lead.dealValue) || null,
    referral: lead.referral || null,
    refs: { leadId: lead.id, customerId: lead.customerId || null, property: lead.property || '', propertyId: lead.propertyId || null, unit: lead.unit || '' },
    owner: { type: 'lead', leadId: lead.id },
    lead,
    place: [lead.property && lead.property !== 'General Enquiry' ? lead.property : null, lead.unit && lead.unit !== 'Not allotted' ? lead.unit : null].filter(Boolean).join(' · '),
  }
}

/** The referral with its money: payable, paid, pending and status. */
export async function referralView(db, o) {
  const r = o.referral
  const payments = await db.collection(BROKER_PAYMENTS).find({ ownerKey: o.key }, { projection: { _id: 0 } }).toArray()
  payments.sort((a, b) => (a.date < b.date ? 1 : -1))
  if (!r?.brokerId) return { owner: pub(o), referral: null, payments, logs: [] }
  const [broker, logs] = await Promise.all([
    db.collection(PARTIES).findOne({ id: r.brokerId }, { projection: { _id: 0 } }),
    db.collection(BROKER_ACTIVITY).find({ brokerId: r.brokerId }, { projection: { _id: 0 } }).sort({ at: -1 }).limit(500).toArray(),
  ])
  const payable = commissionAmount(r.commission, o.dealValue)
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0))
  return {
    owner: pub(o),
    referral: { ...r, brokerName: broker?.name || '', broker, dealValue: o.dealValue, payable, paid, pending: round2(payable - paid), status: commissionStatus(payable, paid) },
    payments,
    // only this deal's entries, not the broker's whole log
    logs: logs.filter((l) => l.refs?.ownerKey === o.key),
  }
}
const pub = (o) => ({ type: o.kind, key: o.key, label: o.label, dealValue: o.dealValue, via: o.via || null, place: o.place, ...o.owner })

async function writeReferral(db, o, referral) {
  if (o.kind === 'lead') await db.collection('leads').updateOne({ id: o.lead.id }, { $set: { referral, updatedAt: new Date() } })
  else if (o.kind === 'customer') await db.collection('customers').updateOne({ id: o.customer.id }, { $set: { referral, isDirectCustomer: !referral?.brokerId, updatedAt: new Date() } })
  else await db.collection(BOOKINGS).updateOne(o.filter, { $set: { referral, updatedAt: new Date() } })
}

const refsOf = (o) => ({ ...o.refs, ownerKey: o.key, ownerType: o.kind, label: o.label })

/** Entry in the deal's own history (the lead's activity list / the plot's history) and the customer's timeline. */
async function logDeal(db, o, title, details, actor) {
  if (o.kind === 'lead') {
    await db.collection('leads').updateOne(
      { id: o.lead.id },
      { $push: { activity: { $each: [{ id: newId('act'), text: details ? `${title}: ${details}` : title, time: 'Just now', createdAt: new Date() }], $position: 0 } } },
    )
    try {
      await logForLead(db, o.lead, { type: 'other', title, details }, actor)
    } catch {
      /* the lead's own list above is enough if the customer timeline is unavailable */
    }
  } else if (o.kind === 'customer') {
    try {
      await logCustomerActivity(db, o.customer.id, { type: 'profile', title, details, source: 'auto' }, actor)
    } catch {
      /* customer timeline is best-effort */
    }
  } else {
    await db.collection('plot_activity').insertOne({
      id: newId('pa'),
      propertyId: o.refs.propertyId,
      propertyName: o.refs.propertyName,
      phase: o.refs.phase || null,
      plotUid: o.refs.plotUid || null,
      plotNo: o.refs.plotNo,
      type: 'booking',
      title,
      note: details || '',
      changes: [],
      actor,
      createdAt: new Date(),
    })
  }
}

/**
 * Assign, change or remove the broker of a deal, and set the commission.
 * body: { brokerId: string | '' , commission: { type, value, note } | null }
 */
export async function saveReferral(db, o, body, actor) {
  const brokerId = norm(body?.brokerId)
  const prev = o.referral?.brokerId ? o.referral : null
  const c = readCommission(body?.commission)
  if (c.error) return { status: 400, error: c.error }
  let broker = null
  if (brokerId) {
    broker = await db.collection(PARTIES).findOne({ id: brokerId, type: 'broker' }, { projection: { _id: 0 } })
    if (!broker) return { status: 400, error: 'The selected broker no longer exists.' }
  }
  const paidCount = await db.collection(BROKER_PAYMENTS).countDocuments({ ownerKey: o.key })
  if (paidCount && prev && prev.brokerId !== brokerId) return { status: 409, error: 'Commission payments are recorded for the current broker. Delete them before changing or removing the broker.' }

  const next = broker ? { brokerId, commission: c.value, assignedAt: prev?.brokerId === brokerId ? prev.assignedAt || new Date() : new Date(), updatedAt: new Date() } : null
  await writeReferral(db, o, next)
  const where = o.kind === 'lead' ? 'lead' : o.kind === 'customer' ? 'customer' : 'property'
  const refs = refsOf(o)
  const module = o.kind === 'lead' ? 'lead' : o.kind === 'customer' ? 'customer' : 'property'
  const subject = `${o.label}${o.place ? ` (${o.place})` : ''}`

  if (prev && (!broker || prev.brokerId !== brokerId)) {
    await logBroker(db, { brokerId: prev.brokerId, module, type: 'removed', title: `Removed from ${where}: ${subject}`, refs, actor })
    const old = await db.collection(PARTIES).findOne({ id: prev.brokerId }, { projection: { name: 1 } })
    await logDeal(db, o, `Broker ${old?.name || ''} removed`.trim(), '', actor)
  }
  if (broker && (!prev || prev.brokerId !== brokerId)) {
    await logBroker(db, { brokerId, module, type: 'assigned', title: `${prev ? 'Now handling' : 'Assigned to'} ${where}: ${subject}`, details: `Commission: ${cText(c.value)}`, refs, actor })
    await logDeal(db, o, `Broker ${broker.name} ${prev ? 'assigned (replacing the previous broker)' : 'assigned'}`, `Commission: ${cText(c.value)}`, actor)
    // A broker referral is the lead's source
    if (o.kind === 'lead' && o.lead.source !== 'Broker') await db.collection('leads').updateOne({ id: o.lead.id }, { $set: { source: 'Broker' } })
  } else if (broker && cText(prev?.commission) !== cText(c.value)) {
    await logBroker(db, {
      brokerId,
      module,
      type: 'commission_set',
      title: `Commission changed on ${where}: ${subject}`,
      changes: [{ field: 'commission', label: 'Commission', from: cText(prev?.commission), to: cText(c.value) }],
      refs,
      actor,
    })
    await logDeal(db, o, `Broker commission changed to ${cText(c.value)}`, `Broker: ${broker.name}`, actor)
  }
  const fresh = await resolveOwner(db, o.owner)
  return { view: await referralView(db, fresh) }
}

/* ───────────── Commission payments (leads and bookings) ───────────── */

function readPayment(b, room) {
  const amount = money(b.amount, 'Amount')
  if (amount.error) return amount
  if (!amount.value || amount.value <= 0) return { error: 'Enter the amount paid.' }
  const date = norm(b.date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) return { error: 'Choose the payment date.' }
  if (amount.value > room) return { error: `This is more than the commission still pending (${rupees(room)}).` }
  return { value: { amount: amount.value, date, mode: text(b.mode, 60), referenceNo: text(b.referenceNo, 60), note: text(b.note, 300) } }
}

async function paidFor(db, key, exceptId = '') {
  const rows = await db.collection(BROKER_PAYMENTS).find({ ownerKey: key, id: { $ne: exceptId } }, { projection: { amount: 1 } }).toArray()
  return round2(rows.reduce((s, p) => s + p.amount, 0))
}

export async function addCommissionPayment(db, o, body, actor) {
  const brokerId = o.referral?.brokerId
  if (!brokerId) return { status: 400, error: 'This deal has no broker, so there is no commission to pay.' }
  const payable = commissionAmount(o.referral.commission, o.dealValue)
  if (!(payable > 0)) return { status: 400, error: 'Set the commission and the deal value first, so the amount payable is known.' }
  const r = readPayment(body || {}, round2(payable - (await paidFor(db, o.key))))
  if (r.error) return { status: 400, error: r.error }
  const payment = { id: newId('bcp'), brokerId, ownerKey: o.key, ownerType: o.kind, refs: o.refs, ...r.value, createdAt: new Date(), by: actor }
  await db.collection(BROKER_PAYMENTS).insertOne({ ...payment })
  const title = `Commission payment of ${rupees(payment.amount)} for ${o.label}`
  await logBroker(db, { brokerId, module: o.kind === 'lead' ? 'lead' : 'property', type: 'commission_payment', title, details: [payment.mode, payment.referenceNo && `Ref ${payment.referenceNo}`, payment.date].filter(Boolean).join(' · '), refs: refsOf(o), actor })
  await logDeal(db, o, `Broker commission paid: ${rupees(payment.amount)}`, [payment.mode, payment.referenceNo && `Ref ${payment.referenceNo}`].filter(Boolean).join(' · '), actor)
  return { payment, view: await referralView(db, o) }
}

async function ownerOfPayment(db, p) {
  const o =
    p.ownerType === 'lead'
      ? { type: 'lead', leadId: p.refs.leadId }
      : p.ownerType === 'customer'
        ? { type: 'customer', customerId: p.refs.customerId }
        : { type: 'booking', ...p.refs }
  return resolveOwner(db, o)
}

export async function updateCommissionPayment(db, id, body, actor) {
  const existing = await db.collection(BROKER_PAYMENTS).findOne({ id })
  if (!existing) return { status: 404, error: 'Payment not found.' }
  const o = await ownerOfPayment(db, existing)
  if (o.error) return { status: o.status, error: o.error }
  const payable = commissionAmount(o.referral?.commission, o.dealValue)
  const r = readPayment({ ...existing, ...body }, round2(payable - (await paidFor(db, o.key, id))))
  if (r.error) return { status: 400, error: r.error }
  await db.collection(BROKER_PAYMENTS).updateOne({ id }, { $set: { ...r.value, editedAt: new Date(), editedBy: actor } })
  await logBroker(db, { brokerId: existing.brokerId, module: o.kind === 'lead' ? 'lead' : 'property', type: 'commission_payment', title: `Commission payment edited: ${rupees(existing.amount)} → ${rupees(r.value.amount)} for ${o.label}`, refs: refsOf(o), actor })
  return { view: await referralView(db, o) }
}

export async function deleteCommissionPayment(db, id, actor) {
  const existing = await db.collection(BROKER_PAYMENTS).findOne({ id })
  if (!existing) return { status: 404, error: 'Payment not found.' }
  await db.collection(BROKER_PAYMENTS).deleteOne({ id })
  const o = await ownerOfPayment(db, existing)
  await logBroker(db, { brokerId: existing.brokerId, module: existing.ownerType === 'lead' ? 'lead' : 'property', type: 'commission_payment', title: `Commission payment of ${rupees(existing.amount)} deleted`, details: existing.date, refs: { ...existing.refs, ownerKey: existing.ownerKey }, actor })
  return { view: o.error ? null : await referralView(db, o) }
}

/* ───────────── Broker overview across modules ───────────── */

/** Everything a broker is connected to, with the money, in one view. */
export async function brokerDetail(db, id) {
  const broker = await db.collection(PARTIES).findOne({ id, type: 'broker' }, { projection: { _id: 0 } })
  if (!broker) return null
  const [leads, customers, bookings, landPlots, landProjects, pays, landPays, activity, allProjects] = await Promise.all([
    db.collection('leads').find({ 'referral.brokerId': id }, { projection: { _id: 0, id: 1, name: 1, phone: 1, stage: 1, property: 1, unit: 1, dealValue: 1, referral: 1, customerId: 1, createdAt: 1 } }).toArray(),
    db.collection('customers').find({ 'referral.brokerId': id }, { projection: { _id: 0, id: 1, name: 1, phone: 1, city: 1, dealValue: 1, referral: 1, createdAt: 1 } }).toArray(),
    db.collection(BOOKINGS).find({ 'referral.brokerId': id }, { projection: { _id: 0 } }).toArray(),
    db.collection(C.plots).find({ brokerId: id }, { projection: { _id: 0 } }).toArray(),
    db.collection(C.projects).find({ brokerIds: id }, { projection: { _id: 0, id: 1, name: 1, status: 1, village: 1 } }).toArray(),
    db.collection(BROKER_PAYMENTS).find({ brokerId: id }, { projection: { _id: 0 } }).toArray(),
    db.collection(C.comm).find({ brokerId: id }, { projection: { _id: 0 } }).toArray(),
    db.collection(BROKER_ACTIVITY).find({ brokerId: id }, { projection: { _id: 0 } }).sort({ at: -1 }).limit(1000).toArray(),
    db.collection(C.projects).find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
  ])
  const projectName = new Map(allProjects.map((p) => [p.id, p.name]))
  const propNames = new Map()
  const bookingProps = [...new Set(bookings.map((b) => b.propertyId))]
  if (bookingProps.length) for (const p of await db.collection('featured_plots').find({ id: { $in: bookingProps } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()) propNames.set(p.id, p.name)
  const paidBy = (rows, key) => rows.reduce((m, p) => m.set(p[key], round2((m.get(p[key]) || 0) + p.amount)), new Map())
  const paidOwner = paidBy(pays, 'ownerKey')
  const paidLand = paidBy(landPays, 'plotId')

  const row = (x) => ({ ...x, pending: round2(x.payable - x.paid), status: commissionStatus(x.payable, x.paid) })
  const referrals = [
    ...leads.map((l) => {
      const payable = commissionAmount(l.referral.commission, num(l.dealValue) || 0)
      return row({ module: 'lead', key: `lead:${l.id}`, leadId: l.id, customerId: l.customerId || null, name: l.name, phone: l.phone, detail: [l.property !== 'General Enquiry' ? l.property : null, l.unit !== 'Not allotted' ? l.unit : null].filter(Boolean).join(' · '), stage: l.stage, dealValue: num(l.dealValue) || null, commission: l.referral.commission, payable, paid: paidOwner.get(`lead:${l.id}`) || 0, since: l.referral.assignedAt })
    }),
    ...customers.map((c) => {
      const payable = commissionAmount(c.referral.commission, num(c.dealValue) || 0)
      return row({ module: 'customer', key: `customer:${c.id}`, customerId: c.id, name: c.name, phone: c.phone, detail: c.city || 'Direct CRM customer', dealValue: num(c.dealValue) || null, commission: c.referral.commission, payable, paid: paidOwner.get(`customer:${c.id}`) || 0, since: c.referral.assignedAt })
    }),
    ...bookings.map((b) => {
      const o = { type: 'booking', propertyId: b.propertyId, plotUid: b.plotUid, plotNo: b.plotNo, phase: b.phase }
      const key = ownerKey(o)
      const dealValue = parseRupees(b.booking?.totalPrice)
      const payable = commissionAmount(b.referral.commission, dealValue || 0)
      return row({ module: 'property', key, propertyId: b.propertyId, plotUid: b.plotUid, plotNo: b.plotNo, phase: b.phase, name: b.booking?.buyerName || 'Buyer', phone: b.booking?.phone, detail: `Plot ${b.plotNo}, ${propNames.get(b.propertyId) || b.propertyName || ''}`, dealValue, commission: b.referral.commission, payable, paid: paidOwner.get(key) || 0, since: b.referral.assignedAt })
    }),
    ...landPlots.map((p) => {
      const payable = p.brokerId ? commissionAmount(p.commission, p.salePrice) : 0
      return row({ module: 'land', key: `land:${p.id}`, projectId: p.projectId, plotId: p.id, name: p.customer?.name || 'No customer yet', phone: p.customer?.phone, detail: `Plot ${p.plotNo}, ${projectName.get(p.projectId) || 'Land project'}`, stage: p.status, dealValue: p.salePrice ?? null, commission: p.commission, payable, paid: paidLand.get(p.id) || 0 })
    }),
  ]
  const sum = (rows, k) => round2(rows.reduce((s, r) => s + (r[k] || 0), 0))
  const byModule = (m) => {
    const rs = referrals.filter((r) => r.module === m)
    return { count: rs.length, payable: sum(rs, 'payable'), paid: sum(rs, 'paid'), pending: sum(rs, 'pending') }
  }
  const payments = [
    ...pays.map((p) => ({ id: p.id, module: p.ownerType === 'lead' ? 'lead' : 'property', date: p.date, amount: p.amount, mode: p.mode, referenceNo: p.referenceNo, note: p.note, ref: p.refs?.label || '', by: p.by })),
    ...landPays.map((p) => ({ id: p.id, module: 'land', date: p.date, amount: p.amount, mode: p.mode, referenceNo: p.referenceNo, note: p.note, ref: landPlots.find((x) => x.id === p.plotId)?.plotNo ? `Plot ${landPlots.find((x) => x.id === p.plotId).plotNo}` : '', by: p.by })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))
  return {
    broker,
    stats: {
      referrals: referrals.length,
      lead: byModule('lead'),
      customer: byModule('customer'),
      property: byModule('property'),
      land: byModule('land'),
      landProjects: landProjects.length,
      payable: sum(referrals, 'payable'),
      paid: sum(referrals, 'paid'),
      pending: sum(referrals, 'pending'),
    },
    referrals,
    landProjects,
    payments,
    activity,
  }
}

export async function addBrokerNote(db, id, note, actor) {
  const broker = await db.collection(PARTIES).findOne({ id, type: 'broker' })
  if (!broker) return { status: 404, error: 'Broker not found.' }
  const t = text(note, 1000)
  if (!t) return { status: 400, error: 'Write a note first.' }
  await logBroker(db, { brokerId: id, type: 'note', title: 'Note', details: t, actor })
  return { ok: true }
}
