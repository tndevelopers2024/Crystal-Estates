import { Router } from 'express'
import crypto from 'crypto'
import { getDb } from '../config/db.js'
import { sendMail, mailMode } from '../lib/mailer.js'
import { whatsappConfig, sendWhatsAppDocuments, formatWhatsAppNumber } from '../lib/whatsapp.js'
import { findPlotDocuments, readPlotDocumentFile, sharedPathOf, propertyIdsOf } from './plotDocuments.js'

/**
 * Sending plot documents to a customer by WhatsApp and/or email.
 *
 * - Recipients are always the customer's registered contact details, looked up
 *   here from the lead or the plot booking. The browser never supplies a number
 *   or address.
 * - Every attempt is logged in `document_shares` (one record per channel):
 *   document ids, payment id, recipient, channel, status, error, time.
 * - `idempotencyKey` (e.g. "payment:<id>") makes repeats safe: a channel that
 *   already succeeded for that key is not sent again.
 * - Statuses are only what the provider confirmed: "sent" means the SMTP
 *   server or the WhatsApp API accepted the message.
 */
const router = Router()
const SHARES = 'document_shares'
const LOCKS = 'document_share_locks'
const MAX_ATTACH_BYTES = 15 * 1024 * 1024 // above this, email carries secure links instead
const BUSINESS = 'Crystal Estates'

const norm = (v) => (v === undefined || v === null ? '' : String(v).trim())
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const rupees = (n) => (Number.isFinite(Number(n)) ? `₹${Math.round(Number(n)).toLocaleString('en-IN')}` : '')
const actorOf = (req) => ({ name: norm(req.user?.name).slice(0, 120) || 'CRM user', email: norm(req.user?.email).slice(0, 160) })
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(e))

/** Absolute base for links customers open (WhatsApp needs public HTTPS). */
function publicBase(req) {
  const env = norm(process.env.PUBLIC_API_URL).replace(/\/$/, '')
  return env || `${req.protocol}://${req.get('host')}`
}

/* ── Recipients ─────────────────────────────────────────── */

const plotRegex = (plotNo) => new RegExp(`(^|[^0-9A-Za-z])${norm(plotNo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^0-9A-Za-z]|$)`, 'i')

/** Customers registered against one plot: its booking, and leads that paid for or reserved it. */
async function plotRecipients(db, { propertyId, plotUid, plotNo, phase }) {
  const { ids, name } = await propertyIdsOf(db, propertyId)
  const out = []
  const seenLeads = new Set()
  const addLead = (l, source) => {
    if (!l || seenLeads.has(l.id)) return
    seenLeads.add(l.id)
    out.push({ key: `lead:${l.id}`, type: 'lead', leadId: l.id, name: l.name || '', phone: l.phone || '', email: l.email || '', source })
  }

  const bookingFilter = { propertyId: { $in: ids }, $or: [plotUid && { plotUid }, plotNo && { plotNo: norm(plotNo), ...(phase ? { phase: { $in: [phase, null] } } : {}) }].filter(Boolean) }
  const booking = await db.collection('plot_bookings').findOne(bookingFilter, { projection: { _id: 0 } })
  if (booking?.booking?.buyerName) {
    const b = booking.booking
    const lead = b.leadId ? await db.collection('leads').findOne({ id: b.leadId }, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1 } }) : null
    if (lead) seenLeads.add(lead.id)
    out.push({
      key: 'booking',
      type: 'booking',
      leadId: lead?.id || null,
      name: b.buyerName,
      phone: b.phone || lead?.phone || '',
      email: b.email || lead?.email || '',
      source: 'Plot booking',
    })
  }

  if (plotNo) {
    const paid = await db
      .collection('payments')
      .find({ propertyId: { $in: ids }, plotNo: norm(plotNo), ...(phase ? { phase: { $in: [phase, null] } } : {}) }, { projection: { _id: 0, leadId: 1 } })
      .limit(20)
      .toArray()
    const leadIds = [...new Set(paid.map((p) => p.leadId).filter(Boolean))]
    if (leadIds.length) {
      const leads = await db.collection('leads').find({ id: { $in: leadIds } }, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1 } }).toArray()
      leads.forEach((l) => addLead(l, 'Paid for this plot'))
    }
    if (name) {
      const propRe = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      const leads = await db
        .collection('leads')
        .find({ property: propRe, unit: plotRegex(plotNo) }, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1 } })
        .limit(10)
        .toArray()
      leads.forEach((l) => addLead(l, 'Lead for this plot'))
    }
  }
  return out
}

/** Resolve the chosen recipient on the server (never trust browser-supplied contact details). */
async function resolveRecipient(db, ref, plot) {
  if (ref?.type === 'lead' && ref.leadId) {
    const l = await db.collection('leads').findOne({ id: norm(ref.leadId) }, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1 } })
    return l ? { type: 'lead', leadId: l.id, name: l.name || '', phone: l.phone || '', email: l.email || '' } : null
  }
  if (ref?.type === 'booking') {
    const list = await plotRecipients(db, plot)
    return list.find((r) => r.type === 'booking') || null
  }
  return null
}

/* ── Payment details for the message ────────────────────── */

async function paymentSummary(db, paymentId) {
  if (!paymentId) return null
  const p = await db.collection('payments').findOne({ id: paymentId }, { projection: { _id: 0 } })
  if (p) return { id: p.id, paymentFor: p.paymentFor, amount: p.amount, mode: p.mode, referenceNo: p.referenceNo, paidOn: p.paidOn || p.date, leadId: p.leadId }
  const a = await db.collection('plot_activity').findOne({ id: paymentId, type: 'payment' }, { projection: { _id: 0 } })
  if (a) return { id: a.id, paymentFor: a.note || 'Payment', amount: a.amount, mode: a.mode, referenceNo: a.referenceNo, paidOn: a.paidOn, leadId: a.leadId || null }
  return null
}

function detailsLine(plot, payment) {
  const where = `Plot ${plot.plotNo}${plot.phase ? ` (${plot.phase})` : ''}, ${plot.propertyName}`
  if (!payment) return where
  return `${where} · ${payment.paymentFor} ${rupees(payment.amount)}`
}

function emailContent({ recipient, plot, payment, docs, links, attached, note }) {
  const name = recipient.name || 'Customer'
  const subject = payment
    ? `Payment received – Plot ${plot.plotNo}, ${plot.propertyName}`
    : `Your documents – Plot ${plot.plotNo}, ${plot.propertyName}`
  const payLines = payment
    ? [
        ['Payment', payment.paymentFor],
        ['Amount', rupees(payment.amount)],
        ['Mode', payment.mode],
        ['Reference', payment.referenceNo],
        ['Paid on', payment.paidOn],
      ].filter(([, v]) => norm(v))
    : []
  const docLines = docs.map((d, i) => `${d.label} (${d.name})${attached ? '' : `: ${links[i]}`}`)
  const text = [
    `Dear ${name},`,
    '',
    payment ? `Thank you for your payment towards Plot ${plot.plotNo}, ${plot.propertyName}.` : `Please find your documents for Plot ${plot.plotNo}, ${plot.propertyName}.`,
    ...(payLines.length ? ['', ...payLines.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(note ? ['', note] : []),
    '',
    attached ? 'Attached documents:' : 'Your documents (secure links):',
    ...docLines.map((l) => `- ${l}`),
    '',
    `Regards,`,
    BUSINESS,
  ].join('\n')
  const row = (k, v) => `<tr><td style="color:#6b7280;padding:4px 14px 4px 0">${esc(k)}</td><td style="font-weight:bold">${esc(v)}</td></tr>`
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;border:1px solid #e5e7eb" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 26px;background:#0F3D2E;border-radius:14px 14px 0 0;color:#fff;font-weight:bold;font-size:16px">${BUSINESS}</td></tr>
<tr><td style="padding:26px">
<p>Dear ${esc(name)},</p>
<p>${payment ? `Thank you for your payment towards <b>Plot ${esc(plot.plotNo)}</b>, ${esc(plot.propertyName)}.` : `Please find your documents for <b>Plot ${esc(plot.plotNo)}</b>, ${esc(plot.propertyName)}.`}</p>
${payLines.length ? `<table role="presentation" style="font-size:14px;margin:12px 0">${payLines.map(([k, v]) => row(k, v)).join('')}</table>` : ''}
${note ? `<p style="background:#faf8f2;border:1px solid #e7e2d6;border-radius:10px;padding:10px 12px">${esc(note)}</p>` : ''}
<p style="margin-top:18px;font-weight:bold">${attached ? 'Attached documents' : 'Your documents'}</p>
<ul style="padding-left:18px">${docs.map((d, i) => `<li style="margin:4px 0">${attached ? esc(d.label) : `<a href="${esc(links[i])}" style="color:#0F3D2E;font-weight:bold">${esc(d.label)}</a>`} <span style="color:#6b7280">(${esc(d.name)})</span></li>`).join('')}</ul>
${attached ? '' : '<p style="font-size:12px;color:#6b7280">These links are private to you. Please do not forward them.</p>'}
<p style="margin-top:22px">Regards,<br>${BUSINESS}</p>
</td></tr></table></td></tr></table></body></html>`
  return { subject, text, html }
}

/* ── Channels ───────────────────────────────────────────── */

async function sendEmailChannel(db, { recipient, plot, payment, docs, links, note }) {
  if (!emailOk(recipient.email)) throw new Error('The customer has no valid email address on record.')
  if (!mailMode()) throw new Error('Email is not configured on the server (set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM).')
  const total = docs.reduce((s, d) => s + (d.size || 0), 0)
  const attach = total <= MAX_ATTACH_BYTES
  const attachments = attach
    ? await Promise.all(docs.map(async (d) => ({ filename: d.name, content: await readPlotDocumentFile(db, d), contentType: d.mime })))
    : undefined
  const mail = emailContent({ recipient, plot, payment, docs, links, attached: attach, note })
  const r = await sendMail({ to: recipient.email, ...mail, attachments, tag: 'document-share' })
  if (!r.delivered) {
    // Development outbox: written to disk, not delivered to anyone
    const err = new Error('Email is only saved to the development outbox (SMTP is not configured), so nothing was delivered.')
    err.outbox = true
    throw err
  }
  return { delivery: attach ? 'attachment' : 'link', providerMessageId: r.messageId, to: recipient.email }
}

async function sendWhatsAppChannel({ recipient, plot, payment, docs, links, note }) {
  const intro = [`Hi ${recipient.name || ''}, ${payment ? `thank you for your payment towards` : 'here are your documents for'} Plot ${plot.plotNo}, ${plot.propertyName}.`, note].filter(Boolean).join('\n')
  const r = await sendWhatsAppDocuments({
    to: recipient.phone,
    intro,
    docs: docs.map((d, i) => ({ link: links[i], filename: d.name, caption: d.label, size: d.size })),
    templateParams: [recipient.name || 'Customer', detailsLine(plot, payment)],
  })
  return { delivery: 'document', providerMessageId: r.messageIds.join(','), to: r.number, attempts: r.attempts }
}

/* ── Routes ─────────────────────────────────────────────── */

/** GET /api/document-shares/config — which channels can really send */
router.get('/config', (req, res) => {
  const wa = whatsappConfig()
  const mode = mailMode()
  const base = publicBase(req)
  res.json({
    success: true,
    whatsapp: {
      configured: wa.configured,
      template: Boolean(wa.template),
      publicLinks: /^https:\/\//i.test(base),
      message: !wa.configured
        ? 'WhatsApp Business is not configured. Ask an admin to set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID on the server.'
        : !/^https:\/\//i.test(base)
          ? 'WhatsApp needs documents on a public HTTPS address. Set PUBLIC_API_URL on the server.'
          : null,
    },
    email: {
      configured: mode === 'smtp',
      mode,
      message: mode === 'smtp' ? null : mode === 'outbox' ? 'Email runs in development outbox mode: messages are saved on the server, not delivered.' : 'Email is not configured. Ask an admin to set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM on the server.',
    },
  })
})

/** GET /api/document-shares/recipients?propertyId&plotUid&plotNo&phase */
router.get('/recipients', async (req, res) => {
  try {
    const plot = { propertyId: norm(req.query.propertyId), plotUid: norm(req.query.plotUid), plotNo: norm(req.query.plotNo), phase: norm(req.query.phase) }
    if (!plot.propertyId || !plot.plotNo) return res.status(400).json({ success: false, error: 'propertyId and plotNo are required' })
    const db = await getDb()
    const recipients = await plotRecipients(db, plot)
    return res.json({ success: true, recipients })
  } catch (err) {
    console.error('Recipients error:', err.message)
    return res.status(500).json({ success: false, error: 'Could not load the customer details' })
  }
})

/** GET /api/document-shares?propertyId&plotUid&plotNo&phase&leadId&paymentId&limit — history, newest first */
router.get('/', async (req, res) => {
  try {
    const db = await getDb()
    const filter = {}
    if (req.query.propertyId) {
      const { ids } = await propertyIdsOf(db, norm(req.query.propertyId))
      filter.propertyId = { $in: ids }
      const plotNo = norm(req.query.plotNo)
      if (plotNo || req.query.plotUid) {
        const ph = norm(req.query.phase)
        filter.$or = [req.query.plotUid && { plotUid: norm(req.query.plotUid) }, plotNo && { plotNo, ...(ph ? { phase: { $in: [ph, null, ''] } } : {}) }].filter(Boolean)
      }
    }
    if (req.query.leadId) filter['recipient.leadId'] = norm(req.query.leadId)
    if (req.query.paymentId) filter.paymentId = norm(req.query.paymentId)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300)
    const shares = await db.collection(SHARES).find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray()
    return res.json({ success: true, shares })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not load the sharing history' })
  }
})

/**
 * POST /api/document-shares
 * { documentIds[], channels: ['whatsapp','email'], recipient: { type: 'lead'|'booking', leadId? },
 *   propertyId, plotUid, plotNo, phase, paymentId?, note?, idempotencyKey }
 * Returns one result per channel: { channel, status: 'sent'|'failed', error?, duplicate? }
 */
router.post('/', async (req, res) => {
  try {
    const b = req.body || {}
    const documentIds = Array.isArray(b.documentIds) ? [...new Set(b.documentIds.map(norm).filter(Boolean))].slice(0, 10) : []
    const channels = [...new Set((Array.isArray(b.channels) ? b.channels : []).filter((c) => c === 'whatsapp' || c === 'email'))]
    const key = norm(b.idempotencyKey).slice(0, 120) || `share:${crypto.randomUUID()}`
    if (!documentIds.length) return res.status(400).json({ success: false, error: 'Select at least one document.' })
    if (!channels.length) return res.status(400).json({ success: false, error: 'Choose WhatsApp, email or both.' })

    const db = await getDb()
    const { ids: propertyIds, name: propertyName } = await propertyIdsOf(db, norm(b.propertyId))
    if (!propertyName) return res.status(404).json({ success: false, error: 'Property not found' })
    const plot = { propertyId: propertyIds[0], propertyName, plotUid: norm(b.plotUid) || null, plotNo: norm(b.plotNo), phase: norm(b.phase) || null }
    if (!plot.plotNo) return res.status(400).json({ success: false, error: 'Select a plot.' })

    // Documents must belong to this plot
    const docs = await findPlotDocuments(db, documentIds)
    const samePhase = (d) => !plot.phase || !d.phase || d.phase === plot.phase
    const valid = docs.filter((d) => propertyIds.includes(d.propertyId) && ((plot.plotUid && d.plotUid === plot.plotUid) || (d.plotNo === plot.plotNo && samePhase(d))))
    if (valid.length !== documentIds.length) return res.status(400).json({ success: false, error: 'Some selected documents do not belong to this plot or were deleted.' })
    const ordered = documentIds.map((id) => valid.find((d) => d.id === id))

    const recipient = await resolveRecipient(db, b.recipient, plot)
    if (!recipient) return res.status(400).json({ success: false, error: 'Choose a customer registered for this plot.' })
    const payment = await paymentSummary(db, norm(b.paymentId))
    if (b.paymentId && !payment) return res.status(404).json({ success: false, error: 'Payment not found' })

    const base = publicBase(req)
    const links = ordered.map((d) => `${base}${sharedPathOf(d)}`)
    const note = norm(b.note).slice(0, 500)
    const actor = actorOf(req)

    const results = []
    for (const channel of channels) {
      // Repeat-safe: a channel that already went out for this key is not sent again
      const done = await db.collection(SHARES).findOne({ idempotencyKey: key, channel, status: 'sent' }, { projection: { _id: 0 } })
      if (done) {
        results.push({ channel, status: 'sent', duplicate: true, shareId: done.id, to: done.to, sentAt: done.sentAt })
        continue
      }
      const record = {
        idempotencyKey: key,
        channel,
        documentIds,
        documents: ordered.map((d) => ({ id: d.id, label: d.label, name: d.name, mime: d.mime, size: d.size })),
        paymentId: payment?.id || null,
        payment: payment ? { paymentFor: payment.paymentFor, amount: payment.amount, mode: payment.mode, paidOn: payment.paidOn } : null,
        propertyId: plot.propertyId,
        propertyName: plot.propertyName,
        plotUid: plot.plotUid,
        plotNo: plot.plotNo,
        phase: plot.phase,
        recipient: { type: recipient.type, leadId: recipient.leadId || null, name: recipient.name },
        note,
        by: actor,
      }
      const id = `ds-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
      // One send per key and channel at a time (a double click can't send twice)
      const lockId = `${key}|${channel}`
      try {
        await db.collection(LOCKS).insertOne({ lockId, createdAt: new Date() })
      } catch (err) {
        if (err.code === 11000) {
          results.push({ channel, status: 'failed', error: 'This is already being sent. Check the history in a moment.' })
          continue
        }
        throw err
      }
      try {
        const r =
          channel === 'email'
            ? await sendEmailChannel(db, { recipient, plot, payment, docs: ordered, links, note })
            : await sendWhatsAppChannel({ recipient, plot, payment, docs: ordered, links, note })
        const rec = { id, ...record, status: 'sent', to: r.to, delivery: r.delivery, providerMessageId: r.providerMessageId || null, attempts: r.attempts || 1, createdAt: new Date(), sentAt: new Date() }
        await db.collection(SHARES).insertOne(rec)
        await db.collection('plot_activity').insertOne({
          id: `pa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          propertyId: plot.propertyId,
          propertyName: plot.propertyName,
          phase: plot.phase,
          plotUid: plot.plotUid,
          plotNo: plot.plotNo,
          type: 'document',
          title: `${ordered.map((d) => d.label).join(', ')} sent to ${recipient.name || 'customer'} by ${channel === 'email' ? 'email' : 'WhatsApp'}`,
          note: r.to,
          documentShareId: id,
          paymentId: payment?.id || null,
          changes: [],
          actor,
          createdAt: new Date(),
        })
        results.push({ channel, status: 'sent', shareId: id, to: r.to, delivery: r.delivery, sentAt: rec.sentAt })
      } catch (err) {
        const to = channel === 'email' ? recipient.email || null : formatWhatsAppNumber(recipient.phone)
        await db.collection(SHARES).insertOne({ id, ...record, status: 'failed', to, error: err.message, attempts: err.attempts || 1, createdAt: new Date() })
        results.push({ channel, status: 'failed', shareId: id, to, error: err.message })
      } finally {
        await db.collection(LOCKS).deleteOne({ lockId }).catch(() => {})
      }
    }
    return res.json({ success: true, idempotencyKey: key, results })
  } catch (err) {
    console.error('Document share error:', err.message)
    return res.status(500).json({ success: false, error: 'Could not send the documents. Please try again.' })
  }
})

export async function ensureDocumentShareIndexes(db) {
  await db.collection(SHARES).createIndex({ id: 1 }, { unique: true })
  await db.collection(SHARES).createIndex({ idempotencyKey: 1, channel: 1, status: 1 })
  await db.collection(SHARES).createIndex({ propertyId: 1, plotNo: 1, createdAt: -1 })
  await db.collection(SHARES).createIndex({ paymentId: 1 })
  await db.collection(LOCKS).createIndex({ lockId: 1 }, { unique: true })
  // A lock left by a crashed request expires on its own
  await db.collection(LOCKS).createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 })
}

export default router
