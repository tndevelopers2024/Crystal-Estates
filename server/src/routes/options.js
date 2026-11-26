import { Router } from 'express'
import { getDb } from '../config/db.js'

/**
 * Editable dropdown option lists for the CRM (payment types, modes, document types).
 * One document per list in `crm_options`: { list, values: [string], updatedAt }.
 * Until a list is edited the built-in defaults below are returned.
 */
const router = Router()
const COLLECTION = 'crm_options'

export const DEFAULT_OPTIONS = {
  paymentFor: ['Token advance', 'Booking advance', 'Part payment', 'Full payment', 'Registration advance'],
  paymentMode: ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card', 'Home loan disbursal'],
  documentType: [
    'Payment receipt',
    'Booking confirmation',
    'Payment statement',
    'Allotment letter',
    'Cost sheet',
    'Draft sale agreement',
    'Floor / plot plan',
    'Other document',
  ],
  landDocumentType: [
    'Parent deed',
    'Sale deed',
    'Agreement of sale',
    'Patta / Chitta',
    'Encumbrance certificate',
    'FMB sketch',
    'Layout approval',
    'Tax receipt',
    'Power of attorney',
    'Legal opinion',
    'Layout plan',
    'Other',
  ],
  placeCategory: ['Temple', 'School', 'College', 'Hospital', 'Railway station', 'Bus stop', 'Market', 'Bank / ATM', 'Park', 'Landmark'],
}

const LIST_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{1,40}$/
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)

async function readList(db, list) {
  const doc = await db.collection(COLLECTION).findOne({ list })
  if (doc && Array.isArray(doc.values)) return doc.values
  return DEFAULT_OPTIONS[list] ? [...DEFAULT_OPTIONS[list]] : []
}

async function writeList(db, list, values) {
  await db.collection(COLLECTION).updateOne(
    { list },
    { $set: { list, values, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
}

/** GET /api/crm-options/:list */
router.get('/:list', async (req, res) => {
  try {
    const { list } = req.params
    if (!LIST_NAME.test(list)) return res.status(400).json({ success: false, error: 'Invalid list name' })
    const db = await getDb()
    return res.json({ success: true, list, values: await readList(db, list), defaults: DEFAULT_OPTIONS[list] || [] })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

/** POST /api/crm-options/:list  { value } — add an option (case-insensitive unique) */
router.post('/:list', async (req, res) => {
  try {
    const { list } = req.params
    const value = clean(req.body?.value)
    if (!LIST_NAME.test(list)) return res.status(400).json({ success: false, error: 'Invalid list name' })
    if (!value) return res.status(400).json({ success: false, error: 'Option text is required' })
    const db = await getDb()
    const values = await readList(db, list)
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      return res.status(409).json({ success: false, error: `"${value}" already exists`, values })
    }
    if (values.length >= 100) return res.status(400).json({ success: false, error: 'Too many options in this list' })
    const next = [...values, value]
    await writeList(db, list, next)
    return res.status(201).json({ success: true, values: next, value })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

/** DELETE /api/crm-options/:list  { value } — remove an option (existing records keep their text) */
router.delete('/:list', async (req, res) => {
  try {
    const { list } = req.params
    const value = clean(req.body?.value ?? req.query?.value)
    if (!LIST_NAME.test(list)) return res.status(400).json({ success: false, error: 'Invalid list name' })
    const db = await getDb()
    const values = await readList(db, list)
    const next = values.filter((v) => v.toLowerCase() !== value.toLowerCase())
    if (next.length === values.length) return res.status(404).json({ success: false, error: 'Option not found', values })
    if (next.length === 0) return res.status(400).json({ success: false, error: 'Keep at least one option', values })
    await writeList(db, list, next)
    return res.json({ success: true, values: next })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
