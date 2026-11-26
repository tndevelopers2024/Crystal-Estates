import { Router } from 'express'
import { getDb } from '../config/db.js'
import { norm, actorOf } from '../lib/land.js'
import {
  listParties,
  createParty,
  updateParty,
  deleteParty,
  resolveOwner,
  referralView,
  saveReferral,
  addCommissionPayment,
  updateCommissionPayment,
  deleteCommissionPayment,
  brokerDetail,
  addBrokerNote,
  BROKER_ACTIVITY,
} from '../lib/brokers.js'
import { buildBrokerWorkbook } from '../lib/brokerExport.js'

/**
 * Brokers for every module (/api/brokers).
 *
 *   GET/POST/PATCH/DELETE  the shared brokers directory
 *   GET/PUT  /referral     the broker on one lead or plot booking
 *   POST/PATCH/DELETE /commission-payments
 *   GET /:id               one broker with all referrals, commission and activity
 *   GET /export            Excel workbook
 *
 * Access (lib/auth.js): anyone who works with leads, customers, properties, payments,
 * vendors or land can read and add brokers; deleting a broker needs "Vendors" or "Land records".
 */
const router = Router()

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error('Brokers API:', err.message)
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
}
const fail = (res, error, status = 400) => res.status(status).json({ success: false, error })
const ok = (res, body = {}, status = 200) => res.status(status).json({ success: true, ...body })
const send = (res, r, okStatus = 200) => (r.error ? fail(res, r.error, r.status || 400) : ok(res, r, okStatus))

/* Directory */
router.get('/', wrap(async (req, res) => ok(res, { brokers: await listParties(await getDb(), 'broker') })))
router.post('/', wrap(async (req, res) => send(res, await createParty(await getDb(), 'broker', req.body, actorOf(req)), 201)))

/* Excel */
router.get('/export', wrap(async (req, res) => {
  const db = await getDb()
  const brokerId = norm(req.query.brokerId) || null
  const built = await buildBrokerWorkbook(db, { brokerId, by: actorOf(req).name })
  if (!built) return fail(res, 'Broker not found.', 404)
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.set('Content-Disposition', `attachment; filename="${built.filename}"; filename*=UTF-8''${encodeURIComponent(built.filename)}`)
  res.set('Access-Control-Expose-Headers', 'Content-Disposition')
  res.set('Cache-Control', 'private, no-store')
  await built.workbook.xlsx.write(res)
  res.end()
}))

/* Referral: the broker on a lead, customer or plot booking */
const ownerFromQuery = (q) => ({ type: norm(q.type), leadId: norm(q.leadId), customerId: norm(q.customerId), propertyId: norm(q.propertyId), plotUid: norm(q.plotUid), plotNo: norm(q.plotNo), phase: norm(q.phase) })

router.get('/referral', wrap(async (req, res) => {
  const db = await getDb()
  const o = await resolveOwner(db, ownerFromQuery(req.query))
  if (o.error) return fail(res, o.error, o.status)
  ok(res, await referralView(db, o))
}))

router.put('/referral', wrap(async (req, res) => {
  const db = await getDb()
  const o = await resolveOwner(db, req.body?.owner)
  if (o.error) return fail(res, o.error, o.status)
  send(res, await saveReferral(db, o, req.body, actorOf(req)))
}))

router.post('/commission-payments', wrap(async (req, res) => {
  const db = await getDb()
  const o = await resolveOwner(db, req.body?.owner)
  if (o.error) return fail(res, o.error, o.status)
  send(res, await addCommissionPayment(db, o, req.body, actorOf(req)), 201)
}))
router.patch('/commission-payments/:id', wrap(async (req, res) => send(res, await updateCommissionPayment(await getDb(), req.params.id, req.body, actorOf(req)))))
router.delete('/commission-payments/:id', wrap(async (req, res) => send(res, await deleteCommissionPayment(await getDb(), req.params.id, actorOf(req)))))

/* One broker */
router.get('/:id', wrap(async (req, res) => {
  const detail = await brokerDetail(await getDb(), req.params.id)
  if (!detail) return fail(res, 'Broker not found.', 404)
  ok(res, detail)
}))
router.patch('/:id', wrap(async (req, res) => send(res, await updateParty(await getDb(), req.params.id, req.body, actorOf(req)))))
router.delete('/:id', wrap(async (req, res) => send(res, await deleteParty(await getDb(), req.params.id, actorOf(req)))))

router.get('/:id/activity', wrap(async (req, res) => {
  const db = await getDb()
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000)
  ok(res, { activity: await db.collection(BROKER_ACTIVITY).find({ brokerId: req.params.id }, { projection: { _id: 0 } }).sort({ at: -1 }).limit(limit).toArray() })
}))
router.post('/:id/notes', wrap(async (req, res) => send(res, await addBrokerNote(await getDb(), req.params.id, req.body?.note, actorOf(req)), 201)))

export default router
