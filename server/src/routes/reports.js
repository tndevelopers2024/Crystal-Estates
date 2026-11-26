import { Router } from 'express'
import { getDb } from '../config/db.js'
import { requireUser } from '../lib/auth.js'
import { actorOf } from '../lib/land.js'
import {
  buildBrokerPaymentsWorkbook,
  buildCentralPaymentsWorkbook,
  buildCustomerPaymentsWorkbook,
  buildPaymentReportsData,
  buildPlotPaymentsWorkbook,
} from '../lib/paymentReports.js'

const router = Router()
router.use(requireUser)

async function sendWorkbook(res, built) {
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.set('Content-Disposition', `attachment; filename="${built.filename}"; filename*=UTF-8''${encodeURIComponent(built.filename)}`)
  res.set('Access-Control-Expose-Headers', 'Content-Disposition')
  res.set('Cache-Control', 'private, no-store')
  await built.workbook.xlsx.write(res)
  res.end()
}

/** GET /api/reports/overview — unified plot, customer, and broker payment ledger */
router.get('/overview', async (req, res) => {
  try {
    const db = await getDb()
    const data = await buildPaymentReportsData(db)
    return res.json({ success: true, ...data })
  } catch (err) {
    console.error('Reports overview error:', err.message)
    return res.status(500).json({ success: false, error: 'Could not load payment reports.' })
  }
})

/** GET /api/reports/export/plot-payments */
router.get('/export/plot-payments', async (req, res) => {
  try {
    const db = await getDb()
    const scope = req.query.scope === 'filtered' ? 'filtered' : 'all'
    const built = await buildPlotPaymentsWorkbook(db, {
      scope,
      filters: { q: req.query.q, propertyId: req.query.propertyId, status: req.query.status },
      by: actorOf(req).name,
    })
    return await sendWorkbook(res, built)
  } catch (err) {
    console.error('Export plot payments error:', err.message)
    if (!res.headersSent) return res.status(500).json({ success: false, error: 'Could not export plot payments.' })
  }
})

/** GET /api/reports/export/customer-payments */
router.get('/export/customer-payments', async (req, res) => {
  try {
    const db = await getDb()
    const scope = req.query.scope === 'filtered' ? 'filtered' : 'all'
    const built = await buildCustomerPaymentsWorkbook(db, {
      scope,
      filters: { q: req.query.q, status: req.query.status },
      by: actorOf(req).name,
    })
    return await sendWorkbook(res, built)
  } catch (err) {
    console.error('Export customer payments error:', err.message)
    if (!res.headersSent) return res.status(500).json({ success: false, error: 'Could not export customer payments.' })
  }
})

/** GET /api/reports/export/broker-payments */
router.get('/export/broker-payments', async (req, res) => {
  try {
    const db = await getDb()
    const scope = req.query.scope === 'filtered' ? 'filtered' : 'all'
    const built = await buildBrokerPaymentsWorkbook(db, {
      scope,
      filters: { q: req.query.q, status: req.query.status },
      by: actorOf(req).name,
    })
    return await sendWorkbook(res, built)
  } catch (err) {
    console.error('Export broker payments error:', err.message)
    if (!res.headersSent) return res.status(500).json({ success: false, error: 'Could not export broker payments.' })
  }
})

/** GET /api/reports/export/all-payments */
router.get('/export/all-payments', async (req, res) => {
  try {
    const db = await getDb()
    const scope = req.query.scope === 'filtered' ? 'filtered' : 'all'
    const built = await buildCentralPaymentsWorkbook(db, {
      scope,
      filters: {
        q: req.query.q,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        customerId: req.query.customerId,
        broker: req.query.broker,
        propertyId: req.query.propertyId,
        plotNo: req.query.plotNo,
        mode: req.query.mode,
        status: req.query.status,
        paymentFor: req.query.paymentFor,
        sourceModule: req.query.sourceModule,
      },
      by: actorOf(req).name,
    })
    return await sendWorkbook(res, built)
  } catch (err) {
    console.error('Export all payments error:', err.message)
    if (!res.headersSent) return res.status(500).json({ success: false, error: 'Could not export payments.' })
  }
})

export default router
