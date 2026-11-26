import { Router } from 'express'
import { getDb } from '../config/db.js'
import { actorFromRequest } from '../lib/auth.js'
import {
  CONTACTED_STAGES,
  STAGE_LABELS,
  findCustomerForLead,
  followUpActivityType,
  logCustomerActivity,
  logForLead,
  phoneKey,
  emailKey,
  safely,
  upsertCustomerFromLead,
} from '../lib/customers.js'
import { BROKER_PAYMENTS, logBroker } from '../lib/brokers.js'
import { loadCentralPayments } from '../lib/centralPayments.js'

const router = Router()

/** Payment states: only "Received" money counts towards the balance. */
export const PAYMENT_STATUSES = ['Received', 'Pending clearance', 'Failed']
const countsAsReceived = (p) => (p.status || 'Received') === 'Received'

/**
 * Helper to format Indian currency
 */
function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return '₹0'
  const num = Number(amount)
  if (num >= 10000000) {
    const cr = num / 10000000
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`
  }
  if (num >= 100000) {
    const lk = num / 100000
    return `₹${lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(1)} L`
  }
  return `₹${num.toLocaleString('en-IN')}`
}

router.get('/meta', async (req, res) => {
  try {
    const db = await getDb()

    // 1. Dynamic Projects from featured_plots collection
    let plots = await db
      .collection('featured_plots')
      .find({}, { projection: { name: 1, id: 1, projectId: 1, price: 1, priceFormatted: 1, type: 1 } })
      .toArray()

    const properties =
      plots && plots.length > 0
        ? plots.map((p) => ({
            id: p.id || p.projectId,
            name: p.name,
            priceFormatted: p.priceFormatted,
          }))
        : []

    // 2. Dynamic Agents from users collection + active leads
    let users = await db
      .collection('users')
      .find({}, { projection: { name: 1, role: 1, color: 1, initials: 1 } })
      .toArray()

    const agentMap = new Map()

    if (users && users.length > 0) {
      users.forEach((u) => {
        if (u.name) {
          agentMap.set(u.name, {
            name: u.name,
            initials: u.initials || u.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
            color: u.color || '#0B57D0',
          })
        }
      })
    }

    const leadsWithAgents = await db
      .collection('leads')
      .find({ 'assignedAgent.name': { $exists: true, $ne: null } }, { projection: { assignedAgent: 1 } })
      .toArray()

    leadsWithAgents.forEach((l) => {
      if (l.assignedAgent?.name && !agentMap.has(l.assignedAgent.name)) {
        agentMap.set(l.assignedAgent.name, {
          name: l.assignedAgent.name,
          initials: l.assignedAgent.initials || l.assignedAgent.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          color: l.assignedAgent.color || '#0B57D0',
        })
      }
    })

    const agents = agentMap.size > 0
      ? Array.from(agentMap.values())
      : [{ name: 'Unassigned', initials: 'UN', color: '#64748B' }]

    return res.json({
      success: true,
      properties,
      agents,
      sources: [
        'Walk-in',
        'Website',
        'Phone Call',
        'Referral',
        'WhatsApp',
        'Facebook',
        'Instagram',
        '99acres',
        'MagicBricks',
        'Broker',
      ],
      stages: [
        { id: 'new', label: 'New leads' },
        { id: 'contacted', label: 'Contacted' },
        { id: 'followup', label: 'Follow-up' },
        { id: 'sitevisit', label: 'Site visit' },
        { id: 'sitevisitdone', label: 'Site visit done' },
        { id: 'negotiation', label: 'Negotiation' },
        { id: 'won', label: 'Won - Booked' },
        { id: 'lost', label: 'Lost' },
      ],
      paymentForOptions: [
        'Token advance',
        'Booking advance',
        'Part payment',
        'Full payment',
        'Registration advance',
      ],
      paymentModes: [
        'UPI',
        'Bank Transfer / RTGS / NEFT',
        'Cheque',
        'Cash',
        'Credit / Debit Card',
      ],
    })
  } catch (err) {
    console.error('Error fetching leads metadata:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/leads
 * Fetch all leads from MongoDB collection `leads`
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDb()
    let leads = await db
      .collection('leads')
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray()

    if (!leads) {
      leads = []
    }

    // Ensure all leads have required fields for the detail drawer
    leads = leads.map((l) => {
      const isWon = l.stage === 'won' || String(l.followUpDate || '').toLowerCase().includes('completed')
      
      // Clean fallback for upcomingFollowUps if missing or empty
      let followUps = Array.isArray(l.upcomingFollowUps) && l.upcomingFollowUps.length > 0
        ? l.upcomingFollowUps.map((fu) => {
            // Clean up any corrupted "Today · Today" strings in existing data
            let cleanWhen = fu.when || 'Today, 5:00 pm'
            if (cleanWhen.includes('Today · Today')) cleanWhen = 'Today, 5:00 pm'
            else if (cleanWhen.includes('Today · Yesterday')) cleanWhen = 'Yesterday, 4:00 pm'
            else if (cleanWhen.includes('Today · Tomorrow')) cleanWhen = 'Tomorrow, 11:00 am'
            else if (cleanWhen.includes('Today · Completed')) cleanWhen = 'Yesterday, 10:00 am'
            else if (cleanWhen.includes('Today · 18 Oct')) cleanWhen = '18 Oct, 11:00 am'
            else if (cleanWhen.includes('Today · 17 Oct')) cleanWhen = '17 Oct, 11:00 am'
            return {
              ...fu,
              when: cleanWhen,
              completed: isWon ? true : Boolean(fu.completed),
            }
          })
        : [
            {
              id: `fu-${l.id || Date.now()}`,
              type: 'Call',
              title: l.notes || `Follow-up call with ${l.name}`,
              when: isWon
                ? 'Yesterday, 10:00 am'
                : String(l.followUpDate || '').toLowerCase().includes('yesterday')
                ? 'Yesterday, 4:00 pm'
                : String(l.followUpDate || '').toLowerCase().includes('tomorrow')
                ? 'Tomorrow, 11:00 am'
                : l.followUpDate && !['today', 'completed'].includes(l.followUpDate.toLowerCase())
                ? `${l.followUpDate}, 11:00 am`
                : 'Today, 5:00 pm',
              completed: isWon,
            },
          ]

      // Format clean activity timestamps based on lead.createdAt
      const createdDate = l.createdAt ? new Date(l.createdAt) : new Date()
      const createdDayStr = createdDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const createdTimeStr = createdDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
      const activityTime = `${createdDayStr} · ${createdTimeStr}`

      const activities = Array.isArray(l.activity) && l.activity.length > 0
        ? l.activity.map((act) => ({
            ...act,
            // Replace any hardcoded 15 Oct 2026 with real relative timestamp
            time: act.time && act.time.includes('15 Oct 2026') ? activityTime : (act.time || activityTime),
          }))
        : [
            {
              id: `act-1-${l.id || Date.now()}`,
              text: 'WhatsApp welcome message sent automatically',
              time: activityTime,
            },
            {
              id: `act-2-${l.id || Date.now()}`,
              text: `Enquiry captured from ${l.source || 'Website'} for ${l.property || 'Crystal Estates'}`,
              time: activityTime,
            },
          ]

      return {
        ...l,
        requirement: l.requirement || (l.property ? `${l.property} - Plot/Unit` : 'Plot/Unit'),
        unit: l.unit || 'Not allotted',
        upcomingFollowUps: followUps,
        activity: activities,
        payments: l.payments || [],
      }
    })

    // Each lead shows the name of its broker
    const brokerIds = [...new Set(leads.map((l) => l.referral?.brokerId).filter(Boolean))]
    if (brokerIds.length) {
      const found = await db.collection('land_parties').find({ id: { $in: brokerIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
      const names = new Map(found.map((b) => [b.id, b.name]))
      leads = leads.map((l) => (l.referral?.brokerId ? { ...l, referral: { ...l.referral, brokerName: names.get(l.referral.brokerId) || '' } } : l))
    }

    return res.json({
      success: true,
      source: 'database',
      total: leads.length,
      leads,
    })
  } catch (err) {
    console.error('Error fetching leads:', err.message)
    return res.status(500).json({ success: false, error: err.message, leads: [] })
  }
})

/**
 * GET /api/leads/payments/all
 * Fetch centralized payments across Leads, Customers, Plots, Brokers, and Land Management
 */
router.get('/payments/all', async (req, res) => {
  try {
    const db = await getDb()
    const payments = await loadCentralPayments(db)
    return res.json({
      success: true,
      total: payments.length,
      payments,
    })
  } catch (err) {
    console.error('Error fetching payments:', err.message)
    return res.status(500).json({ success: false, error: err.message, payments: [] })
  }
})

/**
 * DELETE /api/leads/payments/:paymentId
 * Remove a payment (and its plot-history copy) recorded by mistake.
 */
router.delete('/payments/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params
    const db = await getDb()
    const payment = await db.collection('payments').findOne({ id: paymentId })
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' })

    await db.collection('payments').deleteOne({ id: paymentId })
    await db.collection('plot_activity').deleteMany({ paymentId })
    if (payment.leadId) {
      await db.collection('leads').updateOne(
        { id: payment.leadId },
        {
          $pull: { payments: { id: paymentId } },
          $push: {
            activity: {
              $each: [{ id: `act-${Date.now()}`, text: `Payment ${payment.amountFormatted || payment.amount} (${payment.paymentFor}) removed`, time: 'Just now', createdAt: new Date() }],
              $position: 0,
            },
          },
          $set: { updatedAt: new Date() },
        }
      )
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting payment:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/leads/payments/:paymentId
 * Correct a payment: amount, date, mode, reference, status, notes or what it is for.
 * The lead's own list, the plot history copy and the customer timeline stay in step.
 */
router.patch('/payments/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params
    const b = req.body || {}
    const db = await getDb()
    const payment = await db.collection('payments').findOne({ id: paymentId }, { projection: { _id: 0 } })
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' })

    const set = {}
    if (b.amount !== undefined) {
      const n = Number(String(b.amount).replace(/,/g, ''))
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, error: 'A valid payment amount is required' })
      set.amount = n
      set.amountFormatted = formatCurrency(n)
    }
    if (b.paidOn !== undefined) {
      const d = String(b.paidOn || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d).getTime())) return res.status(400).json({ success: false, error: 'Choose a valid payment date' })
      set.paidOn = d
      set.date = new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    for (const [k, max] of [['mode', 60], ['referenceNo', 60], ['paymentFor', 80], ['note', 500]]) if (b[k] !== undefined) set[k] = String(b[k] ?? '').trim().slice(0, max)
    if (b.status !== undefined) {
      if (!PAYMENT_STATUSES.includes(b.status)) return res.status(400).json({ success: false, error: 'Choose Received, Pending clearance or Failed' })
      set.status = b.status
    }
    if (!Object.keys(set).length) return res.status(400).json({ success: false, error: 'Nothing to change' })

    // The sale can't be overpaid: received money is limited to the agreed price
    const next = { ...payment, ...set }
    if (payment.leadId && countsAsReceived(next)) {
      const lead = await db.collection('leads').findOne({ id: payment.leadId }, { projection: { _id: 0, dealValue: 1 } })
      if (lead?.dealValue != null) {
        const others = await db.collection('payments').find({ leadId: payment.leadId, id: { $ne: paymentId } }, { projection: { amount: 1, status: 1 } }).toArray()
        const receivedElsewhere = others.filter(countsAsReceived).reduce((s, p) => s + (Number(p.amount) || 0), 0)
        if (receivedElsewhere + next.amount > Number(lead.dealValue)) {
          return res.status(400).json({ success: false, error: `This is more than the pending balance of ₹${Math.max(Number(lead.dealValue) - receivedElsewhere, 0).toLocaleString('en-IN')}.` })
        }
      }
    }

    const changed = Object.keys(set).filter((k) => String(payment[k] ?? '') !== String(set[k] ?? ''))
    await db.collection('payments').updateOne({ id: paymentId }, { $set: { ...set, editedAt: new Date() } })
    await db.collection('plot_activity').updateMany(
      { paymentId },
      { $set: { ...(set.amount !== undefined ? { amount: set.amount, title: `${next.paymentFor} of ${next.amountFormatted} from ${next.leadName}` } : {}), ...(set.mode !== undefined ? { mode: set.mode } : {}), ...(set.referenceNo !== undefined ? { referenceNo: set.referenceNo } : {}), ...(set.paidOn !== undefined ? { paidOn: set.paidOn } : {}) } },
    )
    if (payment.leadId) {
      const lead = await db.collection('leads').findOne({ id: payment.leadId }, { projection: { _id: 0 } })
      if (lead) {
        const payments = (lead.payments || []).map((p) => (p.id === paymentId ? { ...p, ...set } : p))
        const text = `Payment ${next.amountFormatted || next.amount} (${next.paymentFor}) updated${next.status && next.status !== 'Received' ? ` – ${next.status}` : ''}`
        await db.collection('leads').updateOne(
          { id: payment.leadId },
          { $set: { payments, updatedAt: new Date() }, $push: { activity: { $each: [{ id: `act-${Date.now()}-pay`, text, time: 'Just now', createdAt: new Date() }], $position: 0 } } },
        )
        await safely(async () => logForLead(db, lead, { type: 'payment', title: text, details: changed.map((k) => `${k}: ${payment[k] ?? '—'} → ${set[k]}`).join(' · ') }, await actorFromRequest(req)))
      }
    }
    return res.json({ success: true, payment: await db.collection('payments').findOne({ id: paymentId }, { projection: { _id: 0 } }) })
  } catch (err) {
    console.error('Error updating payment:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/leads
 * Dynamic lead creation
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      property,
      propertyId,
      stage = 'new',
      source = 'Website',
      budget = 0,
      budgetFormatted,
      assignedAgent,
      requirement,
      unit,
      followUpDate = 'Today',
      advanceReceived = null,
      notes = '',
      sendWhatsApp = false,
      upcomingFollowUps,
      activity,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Lead full name is required' })
    }

    const db = await getDb()
    const id = `lead-${Date.now()}`
    const numBudget = Number(budget) || 0

    // Build initial activity logs
    const initialActivities = Array.isArray(activity) && activity.length > 0
      ? activity
      : []

    if (initialActivities.length === 0) {
      if (sendWhatsApp) {
        initialActivities.push({
          id: `act-${Date.now()}-1`,
          text: 'WhatsApp welcome message sent automatically',
          time: 'Just now',
          createdAt: new Date(),
        })
      }
      initialActivities.push({
        id: `act-${Date.now()}-2`,
        text: `Enquiry captured from ${source || 'Walk-in'} for ${property || 'Crystal Estates'}`,
        time: 'Just now',
        createdAt: new Date(),
      })
    }

    // Build initial follow-up
    const initialFollowUps = Array.isArray(upcomingFollowUps) && upcomingFollowUps.length > 0
      ? upcomingFollowUps
      : [
          {
            id: `fu-${Date.now()}`,
            type: 'Call',
            title: `First follow-up call with ${name.trim()}`,
            when: followUpDate || 'Tomorrow, 11:00 am',
            completed: false,
            createdAt: new Date(),
          },
        ]

    // Dynamic default agent
    let leadAgent = assignedAgent
    if (!leadAgent || !leadAgent.name) {
      const defaultUser = await db.collection('users').findOne({}, { projection: { name: 1, color: 1, initials: 1 } })
      if (defaultUser) {
        leadAgent = {
          name: defaultUser.name,
          initials: defaultUser.initials || defaultUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          color: defaultUser.color || '#0B57D0',
        }
      } else {
        leadAgent = {
          name: 'Unassigned',
          initials: 'UN',
          color: '#64748B',
        }
      }
    }

    const leadProperty = (property || '').trim() || 'General Enquiry'

    const newLead = {
      id,
      name: name.trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      property: leadProperty,
      propertyId: propertyId || null,
      stage: stage.toLowerCase().replace(/\s+/g, ''),
      source: source || 'Walk-in',
      budget: numBudget,
      budgetFormatted: budgetFormatted || formatCurrency(numBudget),
      assignedAgent: leadAgent,
      requirement: requirement || (leadProperty !== 'General Enquiry' ? `${leadProperty} - Plot/Unit` : 'Plot/Unit'),
      unit: unit || 'Not allotted',
      followUpDate: followUpDate || 'Today',
      advanceReceived: advanceReceived || null,
      notes: notes || '',
      upcomingFollowUps: initialFollowUps,
      activity: initialActivities,
      payments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.collection('leads').insertOne(newLead)
    delete newLead._id

    // Leads created straight into a contacted stage get their customer profile now
    let createdLead = newLead
    if (CONTACTED_STAGES.has(newLead.stage)) {
      const actor = await actorFromRequest(req)
      await safely(() => upsertCustomerFromLead(db, newLead, { actor, reason: `Added as ${STAGE_LABELS[newLead.stage] || newLead.stage}` }))
      createdLead = (await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })) || newLead
    }

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      lead: createdLead,
    })
  } catch (err) {
    console.error('Error creating lead:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/leads/:id/payments
 * Dynamic Record Advance Payment
 */
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params
    const {
      paymentFor = 'Token advance',
      amount,
      amountFormatted,
      mode = 'UPI',
      referenceNo = '',
      unitAllotted = '',
      sendWhatsApp = true,
      sendEmail = true,
      moveLeadToWon = true,
      // Optional plot link (Payments page): ties the payment to one plot's history
      propertyId = '',
      plotUid = '',
      plotNo = '',
      phase = '',
      paidOn = '',
      status: payStatus = 'Received',
      note = '',
      actor = null,
      clientRequestId = '',
      documentIds = [],
    } = req.body

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'A valid payment amount is required' })
    }

    const db = await getDb()
    const lead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' })
    }

    // A repeated submission (double click, retry after a timeout) returns the first payment
    const requestId = String(clientRequestId || '').trim().slice(0, 80)
    if (requestId) {
      const existing = await db.collection('payments').findOne({ clientRequestId: requestId, leadId: id }, { projection: { _id: 0 } })
      if (existing) return res.json({ success: true, lead, payment: existing, duplicate: true })
    }

    // With an agreed price, received payments can't add up to more than it
    if (lead.dealValue != null && (payStatus || 'Received') === 'Received') {
      const earlier = await db.collection('payments').find({ leadId: id }, { projection: { amount: 1, status: 1 } }).toArray()
      const received = earlier.filter(countsAsReceived).reduce((s, p) => s + (Number(p.amount) || 0), 0)
      if (received + numAmount > Number(lead.dealValue)) {
        return res.status(400).json({ success: false, error: `This is more than the pending balance of ₹${Math.max(Number(lead.dealValue) - received, 0).toLocaleString('en-IN')}.` })
      }
    }

    const formatted = amountFormatted || formatCurrency(numAmount)
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const paymentRecord = {
      id: paymentId,
      leadId: id,
      leadName: lead.name,
      property: lead.property,
      paymentFor,
      amount: numAmount,
      amountFormatted: formatted,
      mode,
      referenceNo: (referenceNo || '').trim(),
      unitAllotted: (unitAllotted || lead.unit || 'Not allotted').trim(),
      receiptSentWhatsApp: Boolean(sendWhatsApp),
      receiptSentEmail: Boolean(sendEmail),
      date: new Date(paidOn || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      paidOn: String(paidOn || '').trim() || new Date().toISOString().slice(0, 10),
      note: String(note || '').trim().slice(0, 500),
      createdAt: new Date(),
    }
    if (requestId) paymentRecord.clientRequestId = requestId
    paymentRecord.status = PAYMENT_STATUSES.includes(payStatus) ? payStatus : 'Received'
    // Plot documents chosen to go with this payment
    const docIds = Array.isArray(documentIds) ? documentIds.map((d) => String(d || '').trim().slice(0, 60)).filter(Boolean).slice(0, 10) : []
    if (docIds.length) paymentRecord.documentIds = docIds

    // Plot link: stored on the payment and mirrored into that plot's activity log
    // Project only (no plot) is stored too, so the payment maps to the right listing
    const linkedPlot = String(plotNo || '').trim()
    if (propertyId) {
      const prop = await db.collection('featured_plots').findOne(
        { $or: [{ id: String(propertyId) }, { projectId: String(propertyId) }] },
        { projection: { _id: 0, id: 1, name: 1 } }
      )
      if (prop) {
        paymentRecord.propertyId = prop.id
        paymentRecord.property = prop.name || paymentRecord.property
        if (linkedPlot) {
          Object.assign(paymentRecord, {
            plotUid: String(plotUid || '').trim() || null,
            plotNo: linkedPlot,
            phase: String(phase || '').trim() || null,
            plotLinked: true,
          })
          if (!unitAllotted) paymentRecord.unitAllotted = `Plot ${linkedPlot}`
        }
      }
    }

    // 1. Save to dedicated payments collection for CRM accounts
    await db.collection('payments').insertOne(paymentRecord)

    if (paymentRecord.plotLinked) {
      await db.collection('plot_activity').insertOne({
        id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        propertyId: paymentRecord.propertyId,
        propertyName: paymentRecord.property,
        phase: paymentRecord.phase,
        plotUid: paymentRecord.plotUid,
        plotNo: paymentRecord.plotNo,
        type: 'payment',
        title: `${paymentFor} of ${formatted} from ${lead.name}`,
        amount: numAmount,
        mode,
        referenceNo: paymentRecord.referenceNo,
        paidOn: paymentRecord.paidOn,
        note: paymentFor,
        paymentId,
        leadId: id,
        ...(docIds.length ? { documentIds: docIds } : {}),
        changes: [],
        actor: actor && actor.name ? { name: String(actor.name).slice(0, 120), email: String(actor.email || '').slice(0, 160) } : { name: 'CRM user', email: '' },
        createdAt: new Date(),
      })
    }

    // 2. Build activity log
    const actEntry = {
      id: `act-${Date.now()}`,
      text: `${paymentFor} of ${formatted} recorded via ${mode}${
        referenceNo ? ` (Ref: ${referenceNo})` : ''
      }`,
      time: 'Just now',
      createdAt: new Date(),
    }

    // 3. Update lead document
    const setUpdates = {
      advanceReceived: formatted,
      unit: String(unitAllotted || '').trim() || (paymentRecord.plotLinked ? paymentRecord.unitAllotted : lead.unit || 'Not allotted'),
      updatedAt: new Date(),
    }

    // A payment against a listed project ties the lead to that project when it had none
    if (paymentRecord.propertyId) {
      const generic = !lead.property || /^general enquiry$/i.test(String(lead.property).trim())
      if (!lead.propertyId || generic) {
        setUpdates.propertyId = paymentRecord.propertyId
        setUpdates.property = paymentRecord.property
      }
    }

    if (moveLeadToWon) {
      setUpdates.stage = 'won'
    }

    await db.collection('leads').updateOne(
      { id },
      {
        $set: setUpdates,
        $push: {
          payments: paymentRecord,
          activity: { $each: [actEntry], $position: 0 },
        },
      }
    )

    // A paying lead is a customer: create/link the profile and log the payment on its timeline.
    // (A newly linked profile imports the lead's payments, this one included.)
    await safely(async () => {
      const afterPayment = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
      const actor = await actorFromRequest(req)
      const r = await upsertCustomerFromLead(db, afterPayment, { actor, reason: 'Payment received' })
      if (r.customer && !r.linked) {
        await logCustomerActivity(
          db,
          r.customer.id,
          {
            type: 'payment',
            title: `${paymentFor} of ${formatted} received`,
            details: [
              `Mode: ${mode}`,
              paymentRecord.referenceNo && `Ref: ${paymentRecord.referenceNo}`,
              paymentRecord.unitAllotted && paymentRecord.unitAllotted !== 'Not allotted' && `Unit: ${paymentRecord.unitAllotted}`,
            ]
              .filter(Boolean)
              .join(' · '),
            occurredAt: paymentRecord.paidOn,
            leadId: id,
            paymentId,
            propertyId: paymentRecord.propertyId || null,
            property: paymentRecord.property,
            amount: numAmount,
          },
          actor,
        )
      }
      if (moveLeadToWon && lead.stage !== 'won' && r.customer && !r.linked) {
        await logCustomerActivity(db, r.customer.id, { type: 'status', title: `Stage moved from ${STAGE_LABELS[lead.stage] || lead.stage} to ${STAGE_LABELS.won}`, leadId: id }, actor)
      }
    })

    const updatedLead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })

    return res.json({
      success: true,
      message: 'Advance payment recorded successfully',
      payment: paymentRecord,
      lead: updatedLead,
    })
  } catch (err) {
    console.error('Error recording advance payment:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/leads/:id/followups
 * Dynamic Schedule Follow-up
 */
router.post('/:id/followups', async (req, res) => {
  try {
    const { id } = req.params
    const { type = 'Call', when = 'Tomorrow, 11:00 am', note = '' } = req.body

    const db = await getDb()
    const lead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' })
    }

    const followUp = {
      id: `fu-${Date.now()}`,
      type,
      title: note.trim() || `Follow-up ${type} with ${lead.name}`,
      when,
      completed: false,
      createdAt: new Date(),
    }

    const actEntry = {
      id: `act-${Date.now()}`,
      text: `Follow-up scheduled: ${type} for ${when}`,
      time: 'Just now',
      createdAt: new Date(),
    }

    await db.collection('leads').updateOne(
      { id },
      {
        $set: { followUpDate: when, updatedAt: new Date() },
        $push: {
          upcomingFollowUps: { $each: [followUp], $position: 0 },
          activity: { $each: [actEntry], $position: 0 },
        },
      }
    )

    await safely(async () =>
      logForLead(
        db,
        lead,
        {
          type: followUpActivityType(type),
          title: `${type} follow-up scheduled for ${when}`,
          details: followUp.title,
          meta: { followUpId: followUp.id, when },
        },
        await actorFromRequest(req),
      ),
    )

    const updatedLead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })

    return res.json({
      success: true,
      message: 'Follow-up scheduled successfully',
      followUp,
      lead: updatedLead,
    })
  } catch (err) {
    console.error('Error scheduling follow-up:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/leads/:id/followups/:fuId/toggle
 * Toggle follow-up completion status
 */
router.patch('/:id/followups/:fuId/toggle', async (req, res) => {
  try {
    const { id, fuId } = req.params
    const db = await getDb()
    const lead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' })
    }

    const followUps = (lead.upcomingFollowUps || []).map((fu) =>
      fu.id === fuId ? { ...fu, completed: !fu.completed } : fu
    )

    await db.collection('leads').updateOne(
      { id },
      { $set: { upcomingFollowUps: followUps, updatedAt: new Date() } }
    )

    const toggled = followUps.find((fu) => fu.id === fuId)
    if (toggled) {
      await safely(async () =>
        logForLead(
          db,
          lead,
          {
            type: followUpActivityType(toggled.type),
            title: toggled.completed ? `${toggled.type || 'Follow-up'} completed` : `${toggled.type || 'Follow-up'} reopened`,
            details: [toggled.title, toggled.when && `Planned for ${toggled.when}`].filter(Boolean).join(' · '),
            meta: { followUpId: toggled.id },
          },
          await actorFromRequest(req),
        ),
      )
    }

    const updatedLead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })

    return res.json({
      success: true,
      lead: updatedLead,
    })
  } catch (err) {
    console.error('Error toggling follow-up:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/leads/:id/notes
 * Add note to lead and record in activity
 */
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params
    const { note } = req.body

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: 'Note text is required' })
    }

    const db = await getDb()
    const lead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' })
    }

    const noteText = note.trim()
    const updatedNotes = lead.notes ? `${lead.notes}\n• ${noteText}` : noteText

    const actEntry = {
      id: `act-${Date.now()}`,
      text: `Note added: "${noteText}"`,
      time: 'Just now',
      createdAt: new Date(),
    }

    await db.collection('leads').updateOne(
      { id },
      {
        $set: { notes: updatedNotes, updatedAt: new Date() },
        $push: {
          activity: { $each: [actEntry], $position: 0 },
        },
      }
    )

    await safely(async () => logForLead(db, lead, { type: 'note', title: 'Note added', details: noteText }, await actorFromRequest(req)))

    const updatedLead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })

    return res.json({
      success: true,
      message: 'Note added successfully',
      lead: updatedLead,
    })
  } catch (err) {
    console.error('Error adding note:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * Keep the customer profile in step with a lead edit:
 *  - moving into a contacted stage creates (or links) the profile
 *  - later stage moves, agent, project and contact changes go on its timeline
 *  - name/phone/email edits on the customer's primary lead update the profile
 *    (unless that would clash with another customer)
 */
async function syncCustomerAfterLeadUpdate(db, req, before, id) {
  const after = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
  if (!after) return
  const actor = await actorFromRequest(req)
  const stageChanged = after.stage !== before.stage
  let customer = await findCustomerForLead(db, after)
  let justLinked = false

  if (stageChanged && CONTACTED_STAGES.has(after.stage) && !(customer && (customer.leadIds || []).includes(id))) {
    const r = await upsertCustomerFromLead(db, after, { actor, reason: `Stage moved to ${STAGE_LABELS[after.stage] || after.stage}` })
    customer = r.customer
    justLinked = r.linked
  }
  if (!customer || !(customer.leadIds || []).includes(id)) return

  const log = (entry) => logCustomerActivity(db, customer.id, { leadId: id, ...entry }, actor)

  if (stageChanged && !justLinked) {
    await log({
      type: 'status',
      title: `Stage moved from ${STAGE_LABELS[before.stage] || before.stage || '—'} to ${STAGE_LABELS[after.stage] || after.stage}`,
    })
  }
  if (after.assignedAgent?.name && after.assignedAgent.name !== before.assignedAgent?.name) {
    await log({ type: 'profile', title: `Assigned to ${after.assignedAgent.name}` })
    if (!customer.assignedAgent || customer.primaryLeadId === id) {
      await db.collection('customers').updateOne({ id: customer.id }, { $set: { assignedAgent: { name: after.assignedAgent.name }, updatedAt: new Date() } })
    }
  }
  const projectChanged = (after.propertyId || after.property) !== (before.propertyId || before.property)
  const generic = !after.property || /^general enquiry$/i.test(String(after.property).trim())
  if (projectChanged && !generic) {
    await log({ type: 'property', title: `Interested in ${after.property}`, propertyId: after.propertyId || null, property: after.property })
    const known = (customer.interests || []).some((i) => (after.propertyId && i.propertyId === after.propertyId) || i.property === after.property)
    if (!known) {
      await db.collection('customers').updateOne(
        { id: customer.id },
        { $push: { interests: { propertyId: after.propertyId || null, property: after.property, unit: null, addedAt: new Date() } } },
      )
    }
  }
  if (after.unit && after.unit !== before.unit && after.unit !== 'Not allotted') {
    await log({ type: 'property', title: `Unit allotted: ${after.unit}`, propertyId: after.propertyId || null, property: generic ? null : after.property })
  }

  // Contact details follow the primary lead, never overwriting another customer's phone/email
  if (customer.primaryLeadId === id) {
    const set = {}
    const changed = []
    if (after.name && after.name !== before.name && after.name !== customer.name) {
      set.name = String(after.name).trim().slice(0, 120)
      changed.push('Name')
    }
    const pk = phoneKey(after.phone)
    if (after.phone !== before.phone && pk && pk !== customer.phoneKey) {
      const clash = await db.collection('customers').findOne({ phoneKey: pk, id: { $ne: customer.id } }, { projection: { id: 1 } })
      if (!clash) {
        Object.assign(set, { phone: String(after.phone).trim(), phoneKey: pk })
        changed.push('Phone')
      }
    }
    const ek = emailKey(after.email)
    if (after.email !== before.email && ek && ek !== customer.emailKey) {
      Object.assign(set, { email: String(after.email).trim(), emailKey: ek })
      changed.push('Email')
    }
    if (changed.length) {
      await db.collection('customers').updateOne({ id: customer.id }, { $set: { ...set, updatedAt: new Date() } })
      await log({ type: 'profile', title: `Contact details updated from lead: ${changed.join(', ')}` })
    }
  }
}

/**
 * PATCH /api/leads/:id
 * Dynamic update for lead details (stage, agent, budget, etc.)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const db = await getDb()

    const existing = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lead not found' })
    }

    const updates = { ...req.body, updatedAt: new Date() }
    delete updates._id
    delete updates.id
    // Customer links and payments are managed by their own endpoints
    delete updates.customerId
    delete updates.payments
    delete updates.actor
    // The broker on a lead is managed through /api/brokers (with its commission and log)
    delete updates.referral

    const activitiesToPush = []

    // Agreed price: what the customer will pay, used for the pending balance and the commission
    if (updates.dealValue !== undefined) {
      const n = updates.dealValue === null || updates.dealValue === '' ? null : Number(String(updates.dealValue).replace(/,/g, ''))
      if (n !== null && (!Number.isFinite(n) || n < 0)) return res.status(400).json({ success: false, error: 'The agreed price must be a positive number.' })
      updates.dealValue = n
      if (n !== (existing.dealValue ?? null)) {
        activitiesToPush.push({ id: `act-${Date.now()}-deal`, text: n === null ? 'Agreed price cleared' : `Agreed price set to ${formatCurrency(n)}`, time: 'Just now', createdAt: new Date() })
      }
    }

    // Stage change tracking
    if (updates.stage && updates.stage !== existing.stage) {
      updates.stage = updates.stage.toLowerCase().replace(/\s+/g, '')
      const stageLabels = {
        new: 'New leads',
        contacted: 'Contacted',
        followup: 'Follow-up',
        sitevisit: 'Site visit',
        sitevisitdone: 'Site visit done',
        negotiation: 'Negotiation',
        won: 'Won - Booked',
        lost: 'Lost',
      }
      activitiesToPush.push({
        id: `act-${Date.now()}-stage`,
        text: `Pipeline stage moved to "${stageLabels[updates.stage] || updates.stage}"`,
        time: 'Just now',
        createdAt: new Date(),
      })

      // If moved to "Site visit done", mark any active site_visits for this lead as Completed
      if (updates.stage === 'sitevisitdone') {
        await db.collection('site_visits').updateMany(
          { leadId: id, status: { $ne: 'Completed' } },
          { $set: { status: 'Completed', updatedAt: new Date() } }
        )
      }
    }

    // Assigned Agent tracking
    if (
      updates.assignedAgent &&
      updates.assignedAgent.name &&
      updates.assignedAgent.name !== existing.assignedAgent?.name
    ) {
      activitiesToPush.push({
        id: `act-${Date.now()}-agent`,
        text: `Lead assigned to ${updates.assignedAgent.name}`,
        time: 'Just now',
        createdAt: new Date(),
      })
    }

    if (updates.budget !== undefined) {
      updates.budget = Number(updates.budget) || 0
      updates.budgetFormatted = formatCurrency(updates.budget)
    }

    const updateOps = { $set: updates }
    if (activitiesToPush.length > 0) {
      updateOps.$push = {
        activity: { $each: activitiesToPush, $position: 0 },
      }
    }

    await db.collection('leads').updateOne({ id }, updateOps)

    await safely(() => syncCustomerAfterLeadUpdate(db, req, existing, id))

    const updatedLead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })

    return res.json({
      success: true,
      message: 'Lead updated successfully',
      lead: updatedLead,
    })
  } catch (err) {
    console.error('Error updating lead:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/leads/:id
 * Remove a lead
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const db = await getDb()
    const lead = await db.collection('leads').findOne({ id }, { projection: { _id: 0 } })
    if (lead?.referral?.brokerId && (await db.collection(BROKER_PAYMENTS).countDocuments({ ownerKey: `lead:${id}` }))) {
      return res.status(409).json({ success: false, error: 'This lead has broker commission payments recorded. Delete those first.' })
    }
    const result = await db.collection('leads').deleteOne({ id })

    // The customer profile and its history are kept; the timeline notes the removal
    if (lead?.referral?.brokerId && result.deletedCount) {
      await safely(async () => logBroker(db, { brokerId: lead.referral.brokerId, module: 'lead', type: 'removed', title: `Lead ${lead.name} was deleted`, refs: { leadId: id, ownerKey: `lead:${id}`, ownerType: 'lead', label: lead.name }, actor: await actorFromRequest(req) }))
    }
    if (lead && result.deletedCount) {
      await safely(async () =>
        logForLead(db, lead, { type: 'status', title: 'Original lead removed from the pipeline', details: 'Customer profile and history kept' }, await actorFromRequest(req)),
      )
    }

    return res.json({
      success: true,
      message: 'Lead deleted successfully',
      deletedCount: result.deletedCount,
    })
  } catch (err) {
    console.error('Error deleting lead:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router


