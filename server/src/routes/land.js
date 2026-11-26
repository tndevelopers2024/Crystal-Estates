import { Router } from 'express'
import { getDb } from '../config/db.js'
import { allows } from '../lib/roles.js'
import {
  C,
  PROJECT_STATUSES,
  PLOT_STATUSES,
  AREA_UNITS,
  DOC_STATUSES,
  FACINGS,
  COMMISSION_TYPES,
  norm,
  text,
  num,
  isDate,
  today,
  newId,
  round2,
  actorOf,
  commissionAmount,
  withChanges,
  loadLandData,
  indexLand,
  summarizePlots,
  acquisitionCost,
  projectParties,
} from '../lib/land.js'
import { buildWorkbook } from '../lib/landExport.js'
import { listParties, createParty, updateParty, deleteParty, logBroker } from '../lib/brokers.js'
import { storeFile, dropFile, sniff, cleanName, single, readPlotDocumentFile } from './plotDocuments.js'

/**
 * Land purchase & management API (mounted at /api/land).
 *
 * Access (lib/auth.js): "Land records" for projects, plots, logs and exports;
 * "Vendors & landowners" or "Land records" for the parties directory.
 * Every change to a plot is also written to its history (land_plot_logs).
 */
const router = Router()

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error('Land API:', err.message)
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
}
const fail = (res, error, status = 400) => res.status(status).json({ success: false, error })
const ok = (res, body = {}, status = 200) => res.status(status).json({ success: true, ...body })

/* ───────────── Validation helpers ───────────── */

/** number ≥ 0 or null; returns { value } | { error } */
function money(v, label, max = 1e11) {
  const n = num(v)
  if (Number.isNaN(n)) return { error: `${label} must be a number.` }
  if (n !== null && (n < 0 || n > max)) return { error: `${label} must be between 0 and ${max.toLocaleString('en-IN')}.` }
  return { value: n === null ? null : round2(n) }
}
function dateOrEmpty(v, label) {
  const s = norm(v)
  if (!s) return { value: '' }
  return isDate(s) ? { value: s } : { error: `${label} must be a valid date.` }
}
const phoneProblem = (p) => (p && !/^\+?[0-9][0-9\s-]{6,17}$/.test(p) ? 'Enter a valid phone number.' : null)
const emailProblem = (e) => (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? 'Enter a valid email address.' : null)
const sameText = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase()
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exactName = (s) => new RegExp('^' + escapeRe(s) + '$', 'i')

/** Run validators in order; the first error wins. */
function collect(...results) {
  for (const r of results) if (r?.error) return r
  return null
}

/* ═════════════════════ Parties (landowners / vendors and brokers) ═════════════════════ */

// Landowners, vendors and brokers live in one directory shared with leads, customers and properties
const send = (res, r, okStatus = 200) => (r.error ? fail(res, r.error, r.status || 400) : ok(res, r, okStatus))

router.get('/parties', wrap(async (req, res) => ok(res, { parties: await listParties(await getDb(), norm(req.query.type)) })))
router.post('/parties', wrap(async (req, res) => send(res, await createParty(await getDb(), norm(req.body?.type), req.body, actorOf(req)), 201)))
router.patch('/parties/:id', wrap(async (req, res) => send(res, await updateParty(await getDb(), req.params.id, req.body, actorOf(req)))))
router.delete('/parties/:id', wrap(async (req, res) => send(res, await deleteParty(await getDb(), req.params.id, actorOf(req)))))

const landRefs = (plot) => ({ projectId: plot.projectId, plotId: plot.id, plotNo: plot.plotNo, label: plot.customer?.name || `Plot ${plot.plotNo}`, ownerKey: `land:${plot.id}`, ownerType: 'land' })

/** Broker activity for a land plot: assigned, removed or commission changed. */
async function logLandBroker(db, before, plot, req) {
  const had = before.brokerId || null
  const now = plot.brokerId || null
  const cm = (c) => (c ? (c.type === 'percent' ? `${c.value}%` : `₹${Number(c.value).toLocaleString('en-IN')} fixed`) : 'no commission')
  if (had === now && (!now || cm(before.commission) === cm(plot.commission))) return
  const project = await db.collection(C.projects).findOne({ id: plot.projectId }, { projection: { name: 1 } })
  const label = plot.customer?.name || `Plot ${plot.plotNo}`
  const refs = { projectId: plot.projectId, plotId: plot.id, plotNo: plot.plotNo, label, ownerKey: `land:${plot.id}`, ownerType: 'land' }
  const subject = `plot ${plot.plotNo}, ${project?.name || 'land project'}${plot.customer?.name ? ` (${plot.customer.name})` : ''}`
  const actor = actorOf(req)
  if (had && had !== now) await logBroker(db, { brokerId: had, module: 'land', type: 'removed', title: `Removed from ${subject}`, refs, actor })
  if (now && had !== now) await logBroker(db, { brokerId: now, module: 'land', type: 'assigned', title: `${had ? 'Now handling' : 'Assigned to'} ${subject}`, details: `Commission: ${cm(plot.commission)}`, refs, actor })
  else if (now) await logBroker(db, { brokerId: now, module: 'land', type: 'commission_set', title: `Commission changed on ${subject}`, changes: [{ field: 'commission', label: 'Commission', from: cm(before.commission), to: cm(plot.commission) }], refs, actor })
}

/** Brokers added to or removed from a land project. */
async function logProjectBrokers(db, before, project, req) {
  const prev = new Set(before || [])
  const next = new Set(project.brokerIds || [])
  const actor = actorOf(req)
  const refs = { projectId: project.id, label: project.name, ownerKey: `landproject:${project.id}`, ownerType: 'land' }
  for (const id of next) if (!prev.has(id)) await logBroker(db, { brokerId: id, module: 'land', type: 'assigned', title: `Added to land project ${project.name}`, refs, actor })
  for (const id of prev) if (!next.has(id)) await logBroker(db, { brokerId: id, module: 'land', type: 'removed', title: `Removed from land project ${project.name}`, refs, actor })
}

/* ═════════════════════ Projects ═════════════════════ */

async function readProject(db, b, existing = null) {
  const v = {}
  const pick = (k) => (b[k] !== undefined ? b[k] : existing?.[k])
  const name = text(pick('name'), 120)
  if (!name) return { error: 'Project name is required.' }
  v.name = name
  for (const [k, max] of [['village', 80], ['taluk', 80], ['district', 80], ['state', 80], ['surveyNumbers', 300], ['notes', 1500]]) v[k] = text(pick(k), max)

  const area = money(pick('totalArea'), 'Total area')
  if (area.error) return area
  v.totalArea = area.value
  const unit = text(pick('areaUnit'), 12) || 'Acres'
  if (!AREA_UNITS.includes(unit)) return { error: 'Choose a valid area unit.' }
  v.areaUnit = unit

  const status = text(pick('status'), 30) || PROJECT_STATUSES[0]
  if (!PROJECT_STATUSES.includes(status)) return { error: 'Choose a valid project status.' }
  v.status = status

  // Landowner and vendor: one each, picked from the directory. Brokers: any number.
  const partyById = new Map((await db.collection(C.parties).find({}, { projection: { _id: 0 } }).toArray()).map((p) => [p.id, p]))
  const legacy = existing ? projectParties(existing, partyById) : {}
  for (const [key, kind, label] of [['landownerId', 'Landowner', 'landowner'], ['vendorId', 'Vendor', 'vendor']]) {
    const id = norm(b[key] !== undefined ? b[key] : legacy[key])
    if (id) {
      const party = partyById.get(id)
      if (!party || party.type !== 'vendor') return { error: `The selected ${label} no longer exists.` }
      if ((party.kind || 'Landowner') !== kind) return { error: `${party.name} is recorded as a ${(party.kind || 'Landowner').toLowerCase()}, not a ${label}.` }
    }
    v[key] = id || null
  }
  const brokerIds = [...new Set((Array.isArray(b.brokerIds) ? b.brokerIds : existing?.brokerIds || []).map(norm).filter(Boolean))]
  if (brokerIds.length > 20) return { error: 'A project can have up to 20 brokers.' }
  for (const id of brokerIds) if (partyById.get(id)?.type !== 'broker') return { error: 'One of the selected brokers no longer exists.' }
  v.brokerIds = brokerIds

  const pIn = { ...(existing?.purchase || {}), ...(b.purchase || {}) }
  const purchase = {}
  for (const [k, label] of [['agreementDate', 'Agreement date'], ['registrationDate', 'Registration date']]) {
    const d = dateOrEmpty(pIn[k], label)
    if (d.error) return d
    purchase[k] = d.value
  }
  purchase.registrationNo = text(pIn.registrationNo, 60)
  purchase.notes = text(pIn.notes, 1000)
  for (const [k, label] of [['paidToOwner', 'Paid to owner'], ['stampDuty', 'Stamp duty'], ['registrationCharges', 'Registration charges'], ['otherCosts', 'Other costs']]) {
    const m = money(pIn[k], label)
    if (m.error) return m
    purchase[k] = m.value
  }
  v.purchase = purchase
  return { value: v }
}

/** Project with its plot totals, vendor and money summary (list and detail views). */
async function projectSummaries(db, projectId = null) {
  const data = await loadLandData(db, projectId, { logs: false })
  const idx = indexLand(data)
  const docCount = new Map()
  for (const d of data.docs) docCount.set(d.projectId, (docCount.get(d.projectId) || 0) + 1)
  const logCount = new Map()
  for (const d of data.priceLogs) logCount.set(d.projectId, (logCount.get(d.projectId) || 0) + 1)
  const out = data.projects.map((pr) => {
    const plots = idx.plots.filter((p) => p.projectId === pr.id)
    const cost = acquisitionCost(pr)
    const people = projectParties(pr, idx.partyById)
    const nameOf = (id) => idx.partyById.get(id)?.name || ''
    return {
      ...pr,
      ...people,
      vendorName: nameOf(people.vendorId),
      landownerName: nameOf(people.landownerId),
      brokerNames: people.brokerIds.map(nameOf).filter(Boolean),
      acquisitionCost: cost,
      balanceToOwner: pr.landPrice != null ? round2(pr.landPrice - (pr.purchase?.paidToOwner || 0)) : null,
      plotSummary: summarizePlots(plots),
      docCount: docCount.get(pr.id) || 0,
      priceLogCount: logCount.get(pr.id) || 0,
    }
  })
  out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return out
}

/** The latest price-log entry sets the project's current price and rate. */
async function refreshProjectPrice(db, projectId) {
  const rows = await db.collection(C.price).find({ projectId }, { projection: { _id: 0 } }).toArray()
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : new Date(b.createdAt) - new Date(a.createdAt)))
  const last = rows[0]
  await db.collection(C.projects).updateOne(
    { id: projectId },
    { $set: { landPrice: last?.totalPrice ?? null, rate: last?.rate ?? null, priceDate: last?.date || null, updatedAt: new Date() } },
  )
}

router.get('/projects', wrap(async (req, res) => {
  const db = await getDb()
  ok(res, { projects: await projectSummaries(db) })
}))

router.post('/projects', wrap(async (req, res) => {
  const db = await getDb()
  const r = await readProject(db, req.body || {})
  if (r.error) return fail(res, r.error)
  if (await db.collection(C.projects).findOne({ name: exactName(r.value.name) })) {
    return fail(res, `A project named “${r.value.name}” already exists.`, 409)
  }
  // Opening price becomes the first line of the Price Log
  const rate = money(req.body?.rate, 'Rate')
  const price = money(req.body?.landPrice, 'Land price')
  const bad = collect(rate, price)
  if (bad) return fail(res, bad.error)

  const now = new Date()
  const project = { id: newId('lp'), ...r.value, landPrice: null, rate: null, priceDate: null, layout: null, createdAt: now, updatedAt: now, createdBy: actorOf(req) }
  await db.collection(C.projects).insertOne({ ...project })
  await logProjectBrokers(db, [], project, req)
  if (rate.value != null || price.value != null) {
    let total = price.value
    let rt = rate.value
    if (total == null && rt != null && project.totalArea) total = round2(rt * project.totalArea)
    if (rt == null && total != null && project.totalArea) rt = round2(total / project.totalArea)
    await db.collection(C.price).insertOne({
      id: newId('lpr'),
      projectId: project.id,
      date: dateOrEmpty(req.body?.priceDate, '').value || today(),
      rate: rt,
      rateUnit: project.areaUnit,
      totalPrice: total,
      reason: 'Opening price',
      createdAt: now,
      by: actorOf(req),
    })
    await refreshProjectPrice(db, project.id)
  }
  const [summary] = await projectSummaries(db, project.id)
  ok(res, { project: summary }, 201)
}))

router.get('/projects/:id', wrap(async (req, res) => {
  const db = await getDb()
  const [project] = await projectSummaries(db, req.params.id)
  if (!project) return fail(res, 'Project not found.', 404)
  const ids = [project.landownerId, project.vendorId, ...project.brokerIds].filter(Boolean)
  const found = ids.length ? await db.collection(C.parties).find({ id: { $in: ids } }, { projection: { _id: 0 } }).toArray() : []
  const byId = new Map(found.map((p) => [p.id, p]))
  ok(res, {
    project,
    landowner: byId.get(project.landownerId) || null,
    vendor: byId.get(project.vendorId) || null,
    brokers: project.brokerIds.map((id) => byId.get(id)).filter(Boolean),
  })
}))

router.patch('/projects/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.projects).findOne({ id: req.params.id }, { projection: { _id: 0 } })
  if (!existing) return fail(res, 'Project not found.', 404)
  const r = await readProject(db, req.body || {}, existing)
  if (r.error) return fail(res, r.error)
  const clash = await db.collection(C.projects).findOne({ id: { $ne: existing.id }, name: exactName(r.value.name) })
  if (clash) return fail(res, `A project named “${r.value.name}” already exists.`, 409)
  await db.collection(C.projects).updateOne({ id: existing.id }, { $set: { ...r.value, updatedAt: new Date() } })
  await logProjectBrokers(db, existing.brokerIds, { ...existing, ...r.value }, req)
  const [summary] = await projectSummaries(db, existing.id)
  ok(res, { project: summary })
}))

router.delete('/projects/:id', wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project) return fail(res, 'Project not found.', 404)
  // Money records are never deleted along with a project
  const [pay, comm] = await Promise.all([db.collection(C.payments).countDocuments({ projectId: project.id }), db.collection(C.comm).countDocuments({ projectId: project.id })])
  if (pay || comm) return fail(res, `This project has ${pay} customer payment${pay === 1 ? '' : 's'} and ${comm} commission payment${comm === 1 ? '' : 's'} recorded. Delete those first (or keep the project).`, 409)
  const docs = await db.collection(C.docs).find({ projectId: project.id }, { projection: { fileId: 1 } }).toArray()
  for (const d of docs) if (d.fileId) await dropFile(db, d.fileId)
  if (project.layout?.fileId) await dropFile(db, project.layout.fileId)
  await Promise.all([C.plots, C.price, C.docs, C.logs].map((c) => db.collection(c).deleteMany({ projectId: project.id })))
  await db.collection(C.projects).deleteOne({ id: project.id })
  ok(res)
}))

/* Layout plan image of a project (optional reference drawing) */
router.post('/projects/:id/layout', single, wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project) return fail(res, 'Project not found.', 404)
  const buf = req.file?.buffer
  const type = buf && sniff(buf)
  if (!type) return fail(res, 'Upload a PDF, JPG or PNG file.')
  const name = cleanName(req.file.originalname, type.ext)
  const stored = await storeFile(db, buf, name, type.mime)
  if (project.layout?.fileId) await dropFile(db, project.layout.fileId)
  const layout = { fileId: stored.fileId, encoding: stored.encoding, name, mime: type.mime, ext: type.ext, size: buf.length, uploadedAt: new Date() }
  await db.collection(C.projects).updateOne({ id: project.id }, { $set: { layout, updatedAt: new Date() } })
  const { fileId, ...publicLayout } = layout
  ok(res, { layout: publicLayout })
}))

router.get('/projects/:id/layout', wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project?.layout?.fileId) return fail(res, 'No layout plan uploaded.', 404)
  sendStored(res, await readPlotDocumentFile(db, project.layout), project.layout, req.query.download === '1')
}))

router.delete('/projects/:id/layout', wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project) return fail(res, 'Project not found.', 404)
  if (project.layout?.fileId) await dropFile(db, project.layout.fileId)
  await db.collection(C.projects).updateOne({ id: project.id }, { $set: { layout: null, updatedAt: new Date() } })
  ok(res)
}))

function sendStored(res, buf, meta, download) {
  res.set('Content-Type', meta.mime)
  res.set('Content-Length', String(buf.length))
  res.set('Cache-Control', 'private, no-store')
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${meta.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(meta.name)}`)
  res.send(buf)
}

/* ═════════════════════ Price log ═════════════════════ */

function readPrice(b, project) {
  const date = dateOrEmpty(b.date, 'Date')
  if (date.error) return date
  if (!date.value) return { error: 'Choose the date of this price.' }
  const rate = money(b.rate, 'Rate')
  const total = money(b.totalPrice, 'Total price')
  const bad = collect(rate, total)
  if (bad) return bad
  let { value: rt } = rate
  let { value: tp } = total
  if (rt == null && tp == null) return { error: 'Enter the rate, the total price, or both.' }
  // Fill the missing one from the project's area when it is known
  if (tp == null && rt != null && project.totalArea) tp = round2(rt * project.totalArea)
  if (rt == null && tp != null && project.totalArea) rt = round2(tp / project.totalArea)
  return { value: { date: date.value, rate: rt, rateUnit: project.areaUnit, totalPrice: tp, reason: text(b.reason, 300) } }
}

router.get('/projects/:id/price-log', wrap(async (req, res) => {
  const db = await getDb()
  const rows = await db.collection(C.price).find({ projectId: req.params.id }, { projection: { _id: 0 } }).toArray()
  ok(res, { entries: withChanges(rows) })
}))

router.post('/projects/:id/price-log', wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project) return fail(res, 'Project not found.', 404)
  const r = readPrice(req.body || {}, project)
  if (r.error) return fail(res, r.error)
  const entry = { id: newId('lpr'), projectId: project.id, ...r.value, createdAt: new Date(), by: actorOf(req) }
  await db.collection(C.price).insertOne({ ...entry })
  await refreshProjectPrice(db, project.id)
  ok(res, { entry }, 201)
}))

router.patch('/price-log/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.price).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Entry not found.', 404)
  const project = await db.collection(C.projects).findOne({ id: existing.projectId })
  const r = readPrice({ ...existing, ...req.body }, project)
  if (r.error) return fail(res, r.error)
  await db.collection(C.price).updateOne({ id: existing.id }, { $set: { ...r.value, editedAt: new Date(), editedBy: actorOf(req) } })
  await refreshProjectPrice(db, existing.projectId)
  ok(res, { entry: await db.collection(C.price).findOne({ id: existing.id }, { projection: { _id: 0 } }) })
}))

router.delete('/price-log/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.price).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Entry not found.', 404)
  await db.collection(C.price).deleteOne({ id: existing.id })
  await refreshProjectPrice(db, existing.projectId)
  ok(res)
}))

/* ═════════════════════ Document log ═════════════════════ */

async function readDoc(db, b, projectId, existing = null) {
  const pick = (k) => (b[k] !== undefined ? b[k] : existing?.[k])
  const docType = text(pick('docType'), 60)
  if (!docType) return { error: 'Choose the document type.' }
  const v = { docType, title: text(pick('title'), 160) || docType, refNo: text(pick('refNo'), 60), heldBy: text(pick('heldBy'), 120), notes: text(pick('notes'), 1000) }
  const date = dateOrEmpty(pick('docDate'), 'Document date')
  if (date.error) return date
  v.docDate = date.value
  const status = text(pick('status'), 20) || 'Received'
  if (!DOC_STATUSES.includes(status)) return { error: 'Choose a valid document status.' }
  v.status = status
  const plotId = norm(pick('plotId'))
  if (plotId) {
    const plot = await db.collection(C.plots).findOne({ id: plotId, projectId })
    if (!plot) return { error: 'That plot is not in this project.' }
    v.plotId = plot.id
    v.plotNo = plot.plotNo
  } else {
    v.plotId = null
    v.plotNo = null
  }
  return { value: v }
}

const publicDoc = ({ fileId, ...d }) => d

router.get('/projects/:id/documents', wrap(async (req, res) => {
  const db = await getDb()
  const docs = await db.collection(C.docs).find({ projectId: req.params.id }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
  ok(res, { documents: docs.map(publicDoc) })
}))

router.post('/projects/:id/documents', single, wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project) return fail(res, 'Project not found.', 404)
  const r = await readDoc(db, req.body || {}, project.id)
  if (r.error) return fail(res, r.error)
  const doc = { id: newId('ld'), projectId: project.id, ...r.value, file: null, createdAt: new Date(), updatedAt: new Date(), by: actorOf(req) }
  if (req.file) {
    const type = sniff(req.file.buffer)
    if (!type) return fail(res, 'Only PDF, JPG, JPEG and PNG files can be attached.')
    const name = cleanName(req.body.originalName || req.file.originalname, type.ext)
    const stored = await storeFile(db, req.file.buffer, name, type.mime)
    doc.fileId = stored.fileId
    doc.encoding = stored.encoding
    doc.file = { name, mime: type.mime, ext: type.ext, size: req.file.buffer.length, originalSize: Math.max(Number(req.body.originalSize) || 0, req.file.buffer.length) }
  }
  await db.collection(C.docs).insertOne({ ...doc })
  ok(res, { document: publicDoc(doc) }, 201)
}))

router.patch('/documents/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.docs).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Document not found.', 404)
  const r = await readDoc(db, req.body || {}, existing.projectId, existing)
  if (r.error) return fail(res, r.error)
  const next = { ...existing, ...r.value, updatedAt: new Date() }
  await db.collection(C.docs).replaceOne({ id: existing.id }, next)
  ok(res, { document: publicDoc(next) })
}))

router.put('/documents/:id/file', single, wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.docs).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Document not found.', 404)
  const type = req.file?.buffer && sniff(req.file.buffer)
  if (!type) return fail(res, 'Only PDF, JPG, JPEG and PNG files can be attached.')
  const name = cleanName(req.body.originalName || req.file.originalname, type.ext)
  const stored = await storeFile(db, req.file.buffer, name, type.mime)
  const file = { name, mime: type.mime, ext: type.ext, size: req.file.buffer.length, originalSize: Math.max(Number(req.body.originalSize) || 0, req.file.buffer.length) }
  await db.collection(C.docs).updateOne({ id: existing.id }, { $set: { file, fileId: stored.fileId, encoding: stored.encoding, updatedAt: new Date() } })
  if (existing.fileId) await dropFile(db, existing.fileId)
  const next = await db.collection(C.docs).findOne({ id: existing.id })
  ok(res, { document: publicDoc(next) })
}))

router.get('/documents/:id/file', wrap(async (req, res) => {
  const db = await getDb()
  const doc = await db.collection(C.docs).findOne({ id: req.params.id })
  if (!doc?.fileId) return fail(res, 'No file is attached to this document.', 404)
  sendStored(res, await readPlotDocumentFile(db, doc), doc.file, req.query.download === '1')
}))

router.delete('/documents/:id', wrap(async (req, res) => {
  const db = await getDb()
  const doc = await db.collection(C.docs).findOneAndDelete({ id: req.params.id })
  if (!doc) return fail(res, 'Document not found.', 404)
  if (doc.fileId) await dropFile(db, doc.fileId)
  ok(res)
}))

/* ═════════════════════ Plots ═════════════════════ */

const TRACKED = [
  ['plotNo', 'Plot number'],
  ['block', 'Block'],
  ['area', 'Area (sq.ft)'],
  ['dimensions', 'Dimensions'],
  ['facing', 'Facing'],
  ['roadWidth', 'Road width'],
  ['surveyNo', 'Survey no.'],
  ['rate', 'Rate per sq.ft'],
  ['listPrice', 'List price'],
  ['status', 'Status'],
  ['salePrice', 'Sale price'],
  ['saleDate', 'Sale date'],
]
const CUSTOMER_FIELDS = [['name', 'Customer name'], ['phone', 'Customer phone'], ['email', 'Customer email'], ['address', 'Customer address']]

const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))

/**
 * Merge a request into a plot, validate it and list what changed.
 * `existing` is {} for a new plot.
 */
async function buildPlot(db, existing, b) {
  const had = (k) => b[k] !== undefined
  const p = { ...existing }
  const isNew = !existing.id

  if (isNew || had('plotNo')) {
    const no = text(b.plotNo, 30)
    if (!no) return { error: 'Plot number is required.' }
    p.plotNo = no
  }
  for (const [k, max] of [['block', 30], ['dimensions', 40], ['roadWidth', 20], ['surveyNo', 40], ['notes', 1000]]) if (isNew || had(k)) p[k] = text(b[k], max)
  if (isNew || had('facing')) {
    const f = text(b.facing, 20)
    if (f && !FACINGS.includes(f)) return { error: 'Choose a valid facing.' }
    p.facing = f
  }
  for (const [k, label] of [['area', 'Area'], ['rate', 'Rate per sq.ft'], ['listPrice', 'List price'], ['salePrice', 'Sale price']]) {
    if (isNew || had(k)) {
      const m = money(b[k], label)
      if (m.error) return m
      p[k] = m.value
    }
  }
  if (p.listPrice == null && p.rate != null && p.area != null) p.listPrice = round2(p.rate * p.area)
  if (isNew || had('saleDate')) {
    const d = dateOrEmpty(b.saleDate, 'Sale date')
    if (d.error) return d
    p.saleDate = d.value
  }
  if (isNew || had('status')) {
    const s = text(b.status, 12) || 'Available'
    if (!PLOT_STATUSES.includes(s)) return { error: 'Choose a valid plot status.' }
    p.status = s
  }

  // Customer
  if (isNew || had('customer')) {
    const c = b.customer || {}
    const cust = { name: text(c.name, 120), phone: text(c.phone, 20), email: text(c.email, 160), address: text(c.address, 300), notes: text(c.notes, 500) }
    const bad = phoneProblem(cust.phone) || emailProblem(cust.email)
    if (bad) return { error: bad }
    p.customer = Object.values(cust).some(Boolean) ? cust : null
    if (p.customer && !p.customer.name) return { error: "Enter the customer's name." }
    // One id per customer on a plot: payments and notes are tied to it, so a replaced customer can never inherit them
    if (p.customer) p.customer.id = existing.customer?.id || newId('lc')
  }

  // Broker (optional): direct sale, or through a broker with a commission
  if (isNew || had('source') || had('brokerId')) {
    const brokerId = norm(had('brokerId') ? b.brokerId : existing.brokerId)
    const source = had('source') ? text(b.source, 10) : brokerId ? 'broker' : existing.source || 'direct'
    if (!['direct', 'broker'].includes(source)) return { error: 'Choose direct or broker.' }
    if (source === 'direct') {
      p.source = 'direct'
      p.brokerId = null
      p.commission = null
    } else {
      if (!brokerId) return { error: 'Choose the broker for this sale, or switch to direct.' }
      const broker = await db.collection(C.parties).findOne({ id: brokerId, type: 'broker' })
      if (!broker) return { error: 'The selected broker no longer exists.' }
      p.source = 'broker'
      p.brokerId = broker.id
    }
  }
  if (p.source === 'broker' && (isNew || had('commission') || had('brokerId') || had('source'))) {
    const c = had('commission') ? b.commission || {} : existing.commission || {}
    if (c.value === undefined || c.value === '' || c.value === null) p.commission = existing.commission && !had('commission') ? existing.commission : null
    else {
      const val = money(c.value, 'Commission')
      if (val.error) return val
      const t = COMMISSION_TYPES.includes(c.type) ? c.type : 'percent'
      if (t === 'percent' && val.value > 100) return { error: 'A percentage commission cannot be more than 100.' }
      p.commission = val.value ? { type: t, value: val.value, note: text(c.note, 200) } : null
    }
  }

  if ((p.status === 'Booked' || p.status === 'Sold') && !p.customer?.name) {
    return { error: `Add the customer's details to mark this plot ${p.status}.` }
  }
  if (p.commission && p.commission.type === 'percent' && p.salePrice == null) {
    // allowed: the amount becomes payable once the sale price is set
  }

  // What changed (for the plot's history)
  const changes = []
  for (const [k, label] of TRACKED) if (show(existing[k]) !== show(p[k])) changes.push({ field: k, label, from: show(existing[k]), to: show(p[k]) })
  for (const [k, label] of CUSTOMER_FIELDS) {
    const a = existing.customer?.[k] || ''
    const z = p.customer?.[k] || ''
    if (a !== z) changes.push({ field: `customer.${k}`, label, from: show(a), to: show(z) })
  }
  if ((existing.source || 'direct') !== p.source || (existing.brokerId || null) !== (p.brokerId || null)) {
    const nameOf = async (id) => (id ? (await db.collection(C.parties).findOne({ id }))?.name || 'Unknown broker' : 'Direct')
    changes.push({ field: 'broker', label: 'Source / broker', from: await nameOf(existing.brokerId), to: await nameOf(p.brokerId) })
  }
  const cm = (c) => (c ? `${c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}` : 'None')
  if (cm(existing.commission) !== cm(p.commission)) changes.push({ field: 'commission', label: 'Commission', from: cm(existing.commission), to: cm(p.commission) })
  return { plot: p, changes }
}

async function logPlot(db, plot, type, title, { details = '', changes = [], req, extra = {} }) {
  await db.collection(C.logs).insertOne({
    id: newId('lg'),
    projectId: plot.projectId,
    plotId: plot.id,
    plotNo: plot.plotNo,
    type,
    title,
    details,
    changes,
    ...extra,
    by: actorOf(req),
    at: new Date(),
  })
}

/** One history entry per kind of change, so the timeline reads clearly. */
async function logChanges(db, plot, changes, req) {
  const by = (f) => changes.filter((c) => f(c.field))
  const status = by((f) => f === 'status')
  const customer = by((f) => f.startsWith('customer.'))
  const broker = by((f) => f === 'broker')
  const comm = by((f) => f === 'commission')
  const rest = by((f) => f !== 'status' && !f.startsWith('customer.') && f !== 'broker' && f !== 'commission')
  if (status.length) await logPlot(db, plot, 'status', `Status changed from ${status[0].from} to ${status[0].to}`, { changes: status, req })
  if (customer.length) await logPlot(db, plot, 'customer', plot.customer?.name ? `Customer details updated (${plot.customer.name})` : 'Customer removed', { changes: customer, req })
  if (broker.length) await logPlot(db, plot, 'broker', broker[0].to === 'Direct' ? 'Now a direct sale (broker removed)' : `Broker: ${broker[0].to}`, { changes: broker, req })
  if (comm.length) await logPlot(db, plot, 'commission', `Commission set to ${comm[0].to}`, { changes: comm, req })
  if (rest.length) await logPlot(db, plot, 'update', 'Plot details updated', { changes: rest, req })
}

/** A plot with its money figures and broker name, for responses. */
async function plotView(db, plotId) {
  const plot = await db.collection(C.plots).findOne({ id: plotId }, { projection: { _id: 0 } })
  if (!plot) return null
  const [payments, commPayments, broker] = await Promise.all([
    db.collection(C.payments).find({ plotId }, { projection: { _id: 0 } }).toArray(),
    db.collection(C.comm).find({ plotId }, { projection: { _id: 0 } }).toArray(),
    plot.brokerId ? db.collection(C.parties).findOne({ id: plot.brokerId }, { projection: { _id: 0 } }) : null,
  ])
  const idx = indexLand({ projects: [], plots: [plot], parties: broker ? [broker] : [], priceLogs: [], docs: [], payments, commPayments, logs: [] })
  payments.sort((a, b) => (a.date < b.date ? 1 : -1))
  commPayments.sort((a, b) => (a.date < b.date ? 1 : -1))
  return { plot: { ...idx.plots[0], brokerName: broker?.name || '' }, payments, commPayments, broker }
}

router.get('/projects/:id/plots', wrap(async (req, res) => {
  const db = await getDb()
  const data = await loadLandData(db, req.params.id, { logs: false })
  const idx = indexLand(data)
  ok(res, { plots: idx.plots.map((p) => ({ ...p, brokerName: idx.partyById.get(p.brokerId)?.name || '' })) })
}))

router.post('/projects/:id/plots', wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project) return fail(res, 'Project not found.', 404)
  const r = await buildPlot(db, {}, req.body || {})
  if (r.error) return fail(res, r.error)
  const dupe = (await db.collection(C.plots).find({ projectId: project.id }, { projection: { plotNo: 1 } }).toArray()).find((x) => sameText(x.plotNo, r.plot.plotNo))
  if (dupe) return fail(res, `Plot ${r.plot.plotNo} already exists in this project.`, 409)
  const plot = { id: newId('lpl'), projectId: project.id, ...r.plot, createdAt: new Date(), updatedAt: new Date(), createdBy: actorOf(req) }
  await db.collection(C.plots).insertOne({ ...plot })
  await logPlot(db, plot, 'created', `Plot ${plot.plotNo} added`, { details: plot.area ? `${plot.area} sq.ft` : '', req })
  await logLandBroker(db, {}, plot, req)
  ok(res, { plot: (await plotView(db, plot.id)).plot }, 201)
}))

/** Add many plots at once: numbers from..to (optionally with a prefix), same size and rate. */
router.post('/projects/:id/plots/bulk', wrap(async (req, res) => {
  const db = await getDb()
  const project = await db.collection(C.projects).findOne({ id: req.params.id })
  if (!project) return fail(res, 'Project not found.', 404)
  const b = req.body || {}
  const from = parseInt(b.from, 10)
  const to = parseInt(b.to, 10)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) return fail(res, 'Enter a valid plot number range.')
  if (to - from >= 300) return fail(res, 'Add up to 300 plots at a time.')
  const prefix = text(b.prefix, 10)
  const template = await buildPlot(db, {}, { plotNo: 'x', block: b.block, area: b.area, dimensions: b.dimensions, facing: b.facing, roadWidth: b.roadWidth, rate: b.rate, status: 'Available' })
  if (template.error) return fail(res, template.error)
  const existing = new Set((await db.collection(C.plots).find({ projectId: project.id }, { projection: { plotNo: 1 } }).toArray()).map((p) => norm(p.plotNo).toLowerCase()))
  const created = []
  const skipped = []
  const now = new Date()
  for (let n = from; n <= to; n += 1) {
    const plotNo = `${prefix}${n}`
    if (existing.has(plotNo.toLowerCase())) {
      skipped.push(plotNo)
      continue
    }
    const { notes, ...base } = template.plot
    created.push({ id: newId('lpl'), projectId: project.id, ...base, plotNo, createdAt: now, updatedAt: now, createdBy: actorOf(req) })
  }
  if (created.length) {
    await db.collection(C.plots).insertMany(created.map((p) => ({ ...p })))
    await db.collection(C.logs).insertMany(
      created.map((p) => ({ id: newId('lg'), projectId: project.id, plotId: p.id, plotNo: p.plotNo, type: 'created', title: `Plot ${p.plotNo} added`, details: 'Added in bulk', changes: [], by: actorOf(req), at: now })),
    )
  }
  ok(res, { created: created.length, skipped }, 201)
}))

router.get('/plots/:id', wrap(async (req, res) => {
  const db = await getDb()
  const view = await plotView(db, req.params.id)
  if (!view) return fail(res, 'Plot not found.', 404)
  const [project, logs] = await Promise.all([
    db.collection(C.projects).findOne({ id: view.plot.projectId }, { projection: { _id: 0, id: 1, name: 1, areaUnit: 1 } }),
    db.collection(C.logs).find({ plotId: view.plot.id }, { projection: { _id: 0 } }).sort({ at: -1 }).limit(300).toArray(),
  ])
  ok(res, { ...view, project, logs })
}))

router.patch('/plots/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.plots).findOne({ id: req.params.id }, { projection: { _id: 0 } })
  if (!existing) return fail(res, 'Plot not found.', 404)
  const r = await buildPlot(db, existing, req.body || {})
  if (r.error) return fail(res, r.error)
  if (r.plot.plotNo !== existing.plotNo) {
    const others = await db.collection(C.plots).find({ projectId: existing.projectId, id: { $ne: existing.id } }, { projection: { plotNo: 1 } }).toArray()
    if (others.some((x) => sameText(x.plotNo, r.plot.plotNo))) return fail(res, `Plot ${r.plot.plotNo} already exists in this project.`, 409)
  }
  // Going back to a direct sale while commission has been paid would orphan those payments
  if (r.plot.source === 'direct' && existing.brokerId && (await db.collection(C.comm).countDocuments({ plotId: existing.id }))) {
    return fail(res, 'Commission payments are recorded for this plot. Delete them before making it a direct sale.', 409)
  }
  if (r.plot.brokerId && existing.brokerId && r.plot.brokerId !== existing.brokerId && (await db.collection(C.comm).countDocuments({ plotId: existing.id }))) {
    return fail(res, 'Commission payments are recorded for the current broker. Delete them before changing the broker.', 409)
  }
  // A customer with payments can't be removed or replaced: those payments belong to them
  if (existing.customer && !r.plot.customer && (await db.collection(C.payments).countDocuments({ plotId: existing.id }))) {
    return fail(res, 'This customer has payments recorded. Delete the payments first, then remove the customer.', 409)
  }
  // The sale price can't drop below what the customer has already paid
  if (r.plot.salePrice != null) {
    const paid = (await db.collection(C.payments).find({ plotId: existing.id }, { projection: { amount: 1 } }).toArray()).reduce((s, p) => s + p.amount, 0)
    if (r.plot.salePrice < paid) return fail(res, `The customer has already paid ₹${paid.toLocaleString('en-IN')}, which is more than this sale price.`)
  }
  const plot = { ...r.plot, updatedAt: new Date() }
  await db.collection(C.plots).replaceOne({ id: existing.id }, plot)
  if (r.changes.length) await logChanges(db, plot, r.changes, req)
  await logLandBroker(db, existing, plot, req)
  if (r.plot.plotNo !== existing.plotNo) {
    await Promise.all([C.logs, C.docs].map((c) => db.collection(c).updateMany({ plotId: existing.id }, { $set: { plotNo: r.plot.plotNo } })))
  }
  ok(res, { plot: (await plotView(db, existing.id)).plot })
}))

router.delete('/plots/:id', wrap(async (req, res) => {
  const db = await getDb()
  const plot = await db.collection(C.plots).findOne({ id: req.params.id })
  if (!plot) return fail(res, 'Plot not found.', 404)
  const [pay, comm] = await Promise.all([db.collection(C.payments).countDocuments({ plotId: plot.id }), db.collection(C.comm).countDocuments({ plotId: plot.id })])
  if (pay || comm) return fail(res, 'This plot has payment records. Delete the payments first.', 409)
  await db.collection(C.plots).deleteOne({ id: plot.id })
  await db.collection(C.logs).deleteMany({ plotId: plot.id })
  await db.collection(C.docs).updateMany({ plotId: plot.id }, { $set: { plotId: null, plotNo: null } })
  ok(res)
}))

router.post('/plots/:id/notes', wrap(async (req, res) => {
  const db = await getDb()
  const plot = await db.collection(C.plots).findOne({ id: req.params.id })
  if (!plot) return fail(res, 'Plot not found.', 404)
  const note = text(req.body?.note, 1000)
  if (!note) return fail(res, 'Write a note first.')
  // A note is about the plot itself or about its customer
  const target = norm(req.body?.target) === 'customer' ? 'customer' : 'plot'
  if (target === 'customer' && !plot.customer?.name) return fail(res, 'Add a customer to this plot before writing a customer note.')
  const about = target === 'customer' ? { target, customerId: plot.customer.id || null, customerName: plot.customer.name } : { target }
  await logPlot(db, plot, 'note', target === 'customer' ? `Customer note (${plot.customer.name})` : 'Plot note', { details: note, req, extra: about })
  ok(res, {}, 201)
}))

router.patch('/notes/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.logs).findOne({ id: req.params.id, type: 'note' })
  if (!existing) return fail(res, 'Note not found.', 404)
  const note = text(req.body?.note, 1000)
  if (!note) return fail(res, 'The note cannot be empty.')
  await db.collection(C.logs).updateOne({ id: existing.id }, { $set: { details: note, editedAt: new Date(), editedBy: actorOf(req) } })
  ok(res, { note: await db.collection(C.logs).findOne({ id: existing.id }, { projection: { _id: 0 } }) })
}))

router.delete('/notes/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.logs).findOne({ id: req.params.id, type: 'note' })
  if (!existing) return fail(res, 'Note not found.', 404)
  await db.collection(C.logs).deleteOne({ id: existing.id })
  ok(res)
}))

/* ═════════════════════ Customer payments ═════════════════════ */

async function readPayment(db, b, plot, existing = null) {
  const pick = (k) => (b[k] !== undefined ? b[k] : existing?.[k])
  const amount = money(pick('amount'), 'Amount')
  if (amount.error) return amount
  if (!amount.value || amount.value <= 0) return { error: 'Enter the amount received.' }
  const date = dateOrEmpty(pick('date'), 'Payment date')
  if (date.error) return date
  if (!date.value) return { error: 'Choose the payment date.' }
  const v = { amount: amount.value, date: date.value, label: text(pick('label'), 60), mode: text(pick('mode'), 60), referenceNo: text(pick('referenceNo'), 60), note: text(pick('note'), 300) }
  // Not more than the balance (when a sale price is agreed)
  if (plot.salePrice != null) {
    const others = (await db.collection(C.payments).find({ plotId: plot.id, id: { $ne: existing?.id || '' } }, { projection: { amount: 1 } }).toArray()).reduce((s, p) => s + p.amount, 0)
    const room = round2(plot.salePrice - others)
    if (v.amount > room) return { error: `This is more than the balance of ₹${room.toLocaleString('en-IN')}.` }
  }
  return { value: v }
}

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

/** Every customer of a project (one per plot) with their sale, payments and broker. */
router.get('/projects/:id/customers', wrap(async (req, res) => {
  const db = await getDb()
  const data = await loadLandData(db, req.params.id, { logs: false })
  const idx = indexLand(data)
  const customers = idx.plots
    .filter((p) => p.customer?.name)
    .map((p) => ({
      customerId: p.customer.id || null,
      ...p.customer,
      plotId: p.id,
      plotNo: p.plotNo,
      block: p.block,
      plotStatus: p.status,
      source: p.source || 'direct',
      brokerId: p.brokerId || null,
      brokerName: idx.partyById.get(p.brokerId)?.name || '',
      saleDate: p.saleDate,
      salePrice: p.salePrice,
      paid: p.paid,
      balance: p.balance,
      paymentStatus: p.paymentStatus,
      lastPaymentDate: p.lastPaymentDate,
      commissionPayable: p.commissionPayable,
      commissionPaid: p.commissionPaid,
      commissionPending: p.commissionPending,
      commissionStatus: p.commissionStatus,
    }))
  ok(res, { customers })
}))

router.get('/projects/:id/payments', wrap(async (req, res) => {
  const db = await getDb()
  const data = await loadLandData(db, req.params.id, { logs: false })
  const idx = indexLand(data)
  const rows = data.payments
    .map((p) => {
      const plot = idx.plotById.get(p.plotId)
      return { ...p, plotNo: plot?.plotNo || '', customerName: plot?.customer?.name || '' }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  ok(res, { payments: rows })
}))

router.post('/plots/:id/payments', wrap(async (req, res) => {
  const db = await getDb()
  const plot = await db.collection(C.plots).findOne({ id: req.params.id })
  if (!plot) return fail(res, 'Plot not found.', 404)
  if (!plot.customer?.name) return fail(res, 'Add the customer to this plot before recording payments.')
  const r = await readPayment(db, req.body || {}, plot)
  if (r.error) return fail(res, r.error)
  const payment = { id: newId('lpy'), projectId: plot.projectId, plotId: plot.id, customerId: plot.customer?.id || null, customerName: plot.customer?.name || '', ...r.value, createdAt: new Date(), by: actorOf(req) }
  await db.collection(C.payments).insertOne({ ...payment })
  await logPlot(db, plot, 'payment', `${payment.label || 'Payment'} of ${rupees(payment.amount)} received`, { details: [payment.mode, payment.referenceNo && `Ref ${payment.referenceNo}`, payment.date].filter(Boolean).join(' · '), req })
  ok(res, { payment, ...(await plotView(db, plot.id)) }, 201)
}))

router.patch('/payments/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.payments).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Payment not found.', 404)
  const plot = await db.collection(C.plots).findOne({ id: existing.plotId })
  const r = await readPayment(db, req.body || {}, plot, existing)
  if (r.error) return fail(res, r.error)
  await db.collection(C.payments).updateOne({ id: existing.id }, { $set: { ...r.value, editedAt: new Date(), editedBy: actorOf(req) } })
  await logPlot(db, plot, 'payment', `Payment edited: ${rupees(existing.amount)} → ${rupees(r.value.amount)}`, { details: r.value.date, req })
  ok(res, await plotView(db, plot.id))
}))

router.delete('/payments/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.payments).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Payment not found.', 404)
  await db.collection(C.payments).deleteOne({ id: existing.id })
  const plot = await db.collection(C.plots).findOne({ id: existing.plotId })
  if (plot) await logPlot(db, plot, 'payment', `Payment of ${rupees(existing.amount)} deleted`, { details: existing.date, req })
  ok(res, plot ? await plotView(db, plot.id) : {})
}))

/* ═════════════════════ Broker commission ═════════════════════ */

async function readCommissionPayment(db, b, plot, existing = null) {
  const pick = (k) => (b[k] !== undefined ? b[k] : existing?.[k])
  const amount = money(pick('amount'), 'Amount')
  if (amount.error) return amount
  if (!amount.value || amount.value <= 0) return { error: 'Enter the amount paid.' }
  const date = dateOrEmpty(pick('date'), 'Payment date')
  if (date.error) return date
  if (!date.value) return { error: 'Choose the payment date.' }
  const payable = commissionAmount(plot.commission, plot.salePrice)
  if (!(payable > 0)) return { error: 'Set the commission and the sale price first, so the amount payable is known.' }
  const others = (await db.collection(C.comm).find({ plotId: plot.id, id: { $ne: existing?.id || '' } }, { projection: { amount: 1 } }).toArray()).reduce((s, p) => s + p.amount, 0)
  const room = round2(payable - others)
  if (amount.value > room) return { error: `This is more than the commission still pending (${rupees(room)}).` }
  return { value: { amount: amount.value, date: date.value, mode: text(pick('mode'), 60), referenceNo: text(pick('referenceNo'), 60), note: text(pick('note'), 300) } }
}

router.get('/projects/:id/commissions', wrap(async (req, res) => {
  const db = await getDb()
  const data = await loadLandData(db, req.params.id, { logs: false })
  const idx = indexLand(data)
  const rows = idx.plots
    .filter((p) => p.brokerId)
    .map((p) => ({
      plotId: p.id,
      plotNo: p.plotNo,
      block: p.block,
      brokerId: p.brokerId,
      brokerName: idx.partyById.get(p.brokerId)?.name || '',
      customerName: p.customer?.name || '',
      status: p.status,
      commissionStatus: p.commissionStatus,
      salePrice: p.salePrice,
      commission: p.commission,
      payable: p.commissionPayable,
      paid: p.commissionPaid,
      pending: p.commissionPending,
    }))
  const payments = data.commPayments
    .map((c) => ({ ...c, plotNo: idx.plotById.get(c.plotId)?.plotNo || '', brokerName: idx.partyById.get(c.brokerId)?.name || '' }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  ok(res, { commissions: rows, payments })
}))

router.post('/plots/:id/commission-payments', wrap(async (req, res) => {
  const db = await getDb()
  const plot = await db.collection(C.plots).findOne({ id: req.params.id })
  if (!plot) return fail(res, 'Plot not found.', 404)
  if (!plot.brokerId) return fail(res, 'This plot is a direct sale: there is no broker to pay.')
  const r = await readCommissionPayment(db, req.body || {}, plot)
  if (r.error) return fail(res, r.error)
  const payment = { id: newId('lcp'), projectId: plot.projectId, plotId: plot.id, brokerId: plot.brokerId, customerId: plot.customer?.id || null, customerName: plot.customer?.name || '', ...r.value, createdAt: new Date(), by: actorOf(req) }
  await db.collection(C.comm).insertOne({ ...payment })
  await logPlot(db, plot, 'commission', `Commission payment of ${rupees(payment.amount)} made`, { details: [payment.mode, payment.referenceNo && `Ref ${payment.referenceNo}`, payment.date].filter(Boolean).join(' · '), req })
  await logBroker(db, { brokerId: plot.brokerId, module: 'land', type: 'commission_payment', title: `Commission payment of ${rupees(payment.amount)} for plot ${plot.plotNo}`, details: [payment.mode, payment.referenceNo && `Ref ${payment.referenceNo}`, payment.date].filter(Boolean).join(' · '), refs: landRefs(plot), actor: actorOf(req) })
  ok(res, { payment, ...(await plotView(db, plot.id)) }, 201)
}))

router.patch('/commission-payments/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.comm).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Payment not found.', 404)
  const plot = await db.collection(C.plots).findOne({ id: existing.plotId })
  const r = await readCommissionPayment(db, req.body || {}, plot, existing)
  if (r.error) return fail(res, r.error)
  await db.collection(C.comm).updateOne({ id: existing.id }, { $set: { ...r.value, editedAt: new Date(), editedBy: actorOf(req) } })
  await logPlot(db, plot, 'commission', `Commission payment edited: ${rupees(existing.amount)} → ${rupees(r.value.amount)}`, { details: r.value.date, req })
  await logBroker(db, { brokerId: plot.brokerId, module: 'land', type: 'commission_payment', title: `Commission payment edited on plot ${plot.plotNo}: ${rupees(existing.amount)} → ${rupees(r.value.amount)}`, details: r.value.date, refs: landRefs(plot), actor: actorOf(req) })
  ok(res, await plotView(db, plot.id))
}))

router.delete('/commission-payments/:id', wrap(async (req, res) => {
  const db = await getDb()
  const existing = await db.collection(C.comm).findOne({ id: req.params.id })
  if (!existing) return fail(res, 'Payment not found.', 404)
  await db.collection(C.comm).deleteOne({ id: existing.id })
  const plot = await db.collection(C.plots).findOne({ id: existing.plotId })
  if (plot) await logPlot(db, plot, 'commission', `Commission payment of ${rupees(existing.amount)} deleted`, { details: existing.date, req })
  if (plot?.brokerId) await logBroker(db, { brokerId: plot.brokerId, module: 'land', type: 'commission_payment', title: `Commission payment of ${rupees(existing.amount)} deleted on plot ${plot.plotNo}`, details: existing.date, refs: landRefs(plot), actor: actorOf(req) })
  ok(res, plot ? await plotView(db, plot.id) : {})
}))

/* ═════════════════════ Excel export (ExcelJS) ═════════════════════ */

const EXPORT_TYPES = ['all', 'project', 'projects', 'plots', 'customers', 'price-log', 'documents', 'payments', 'commissions', 'brokers', 'vendors', 'history', 'notes']

router.get('/export', wrap(async (req, res) => {
  const type = norm(req.query.type) || 'all'
  const projectId = norm(req.query.projectId) || null
  if (!EXPORT_TYPES.includes(type)) return fail(res, 'Unknown export type.')
  // The parties directory can be exported with "Vendors & landowners" access alone
  const partiesOnly = type === 'brokers' || type === 'vendors'
  if (!partiesOnly && !allows(req.role, 'landrecords', 'view')) return fail(res, "Your role can't export land records.", 403)
  const db = await getDb()
  if (projectId && !(await db.collection(C.projects).findOne({ id: projectId }, { projection: { id: 1 } }))) return fail(res, 'Project not found.', 404)
  if (type === 'project' && !projectId) return fail(res, 'Choose a project to export.')
  const { workbook, filename } = await buildWorkbook(db, { type, projectId, by: actorOf(req).name })
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
  res.set('Cache-Control', 'private, no-store')
  // The CRM runs on another origin; without this the browser hides the file name from it
  res.set('Access-Control-Expose-Headers', 'Content-Disposition')
  await workbook.xlsx.write(res)
  res.end()
}))

/* ───────────── Indexes ───────────── */

export async function ensureLandIndexes(db) {
  await Promise.all([
    db.collection(C.projects).createIndex({ id: 1 }, { unique: true }),
    db.collection(C.plots).createIndex({ id: 1 }, { unique: true }),
    db.collection(C.plots).createIndex({ projectId: 1 }),
    db.collection(C.plots).createIndex({ brokerId: 1 }, { sparse: true }),
    db.collection(C.parties).createIndex({ id: 1 }, { unique: true }),
    db.collection(C.price).createIndex({ projectId: 1, date: -1 }),
    db.collection(C.docs).createIndex({ projectId: 1 }),
    db.collection(C.payments).createIndex({ plotId: 1, date: -1 }),
    db.collection(C.payments).createIndex({ projectId: 1 }),
    db.collection(C.comm).createIndex({ plotId: 1 }),
    db.collection(C.comm).createIndex({ projectId: 1 }),
    db.collection(C.logs).createIndex({ plotId: 1, at: -1 }),
  ])
}

export default router
