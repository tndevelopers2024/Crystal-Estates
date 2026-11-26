import { Router } from 'express'
import crypto from 'crypto'
import zlib from 'zlib'
import { promisify } from 'util'
import multer from 'multer'
import { GridFSBucket } from 'mongodb'
import { getDb } from '../config/db.js'

/**
 * Documents attached to one plot (sale deed, patta, EC, receipts, photos…).
 *
 * Metadata lives in `plot_documents`; the bytes live in MongoDB GridFS
 * (bucket `plot_document_files`) so they survive server restarts and
 * redeploys (the host's disk is wiped on every deploy).
 *
 * Files are never served from a public folder:
 *  - CRM users fetch them through GET /api/plot-documents/:id/file (signed in;
 *    the access rule lives in lib/auth.js).
 *  - Customers get them only through a share link that carries the document's
 *    random share token: GET /api/plot-documents/:id/shared?t=<token>.
 *
 * Compression: images are compressed in the browser before upload; on the
 * server every file is additionally gzip'd when that saves at least 5%
 * (lossless, so PDFs keep full quality).
 */
const router = Router()
const COLLECTION = 'plot_documents'
const BUCKET = 'plot_document_files'
export const MAX_BYTES = 15 * 1024 * 1024
const MAX_PER_PLOT = 50

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

const TYPES = {
  pdf: { mime: 'application/pdf', ext: 'pdf', test: (b) => b.slice(0, 5).toString('latin1') === '%PDF-' },
  jpg: { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  png: { mime: 'image/png', ext: 'png', test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
}
/** Decide the type from the file's own bytes, not its name. */
export const sniff = (buf) => Object.values(TYPES).find((t) => buf.length > 8 && t.test(buf)) || null

const norm = (v) => (v === undefined || v === null ? '' : String(v).trim())
const cleanLabel = (v) => norm(v).replace(/\s+/g, ' ').slice(0, 120)
export const cleanName = (v, ext) => {
  const base = norm(v).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, 120) || 'document'
  return `${base}.${ext}`
}
const actorOf = (req) => ({ name: norm(req.user?.name).slice(0, 120) || 'CRM user', email: norm(req.user?.email).slice(0, 160) })

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
})
export const single = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is too large. The limit is ${MAX_BYTES / 1024 / 1024} MB.` : err.message
    return res.status(400).json({ success: false, error: msg })
  })

const bucketOf = (db) => new GridFSBucket(db, { bucketName: BUCKET })

export async function storeFile(db, buf, filename, mime) {
  let data = buf
  let encoding = null
  const packed = await gzip(buf, { level: 9 })
  if (packed.length < buf.length * 0.95) {
    data = packed
    encoding = 'gzip'
  }
  const id = await new Promise((resolve, reject) => {
    const stream = bucketOf(db).openUploadStream(filename, { metadata: { contentType: mime, encoding } })
    stream.once('error', reject)
    stream.once('finish', () => resolve(stream.id))
    stream.end(data)
  })
  return { fileId: id, storedSize: data.length, encoding }
}

export async function readPlotDocumentFile(db, doc) {
  const chunks = []
  await new Promise((resolve, reject) => {
    bucketOf(db)
      .openDownloadStream(doc.fileId)
      .on('data', (c) => chunks.push(c))
      .once('error', reject)
      .once('end', resolve)
  })
  const raw = Buffer.concat(chunks)
  return doc.encoding === 'gzip' ? gunzip(raw) : raw
}

export const dropFile = (db, fileId) => bucketOf(db).delete(fileId).catch((e) => console.warn('GridFS delete:', e.message))

/** Public shape (never the GridFS id or the share token). */
const publicDoc = ({ _id, fileId, shareToken, ...d }) => d

/** Check the plot exists and return its identity. */
async function resolvePlot(db, { propertyId, plotUid, plotNo, phase }) {
  const prop = await db.collection('featured_plots').findOne(
    { $or: [{ id: propertyId }, { projectId: propertyId }] },
    { projection: { _id: 0, id: 1, projectId: 1, name: 1 } },
  )
  if (!prop) return null
  return { propertyId: prop.id || prop.projectId, propertyName: prop.name || '', plotUid: norm(plotUid) || null, plotNo: norm(plotNo), phase: norm(phase) || null }
}

/**
 * Documents of exactly one plot. Plot uids can differ between CRM screens (the
 * Plots page derives them per phase, forms from the whole property), so the
 * plot number is matched too, but only within a compatible phase: a document
 * of Plot 12 in Phase 2 never shows up for Plot 12 in Phase 1.
 */
export const plotFilter = ({ propertyId, propertyIds, plotUid, plotNo, phase }) => {
  const or = []
  if (plotUid) or.push({ plotUid })
  if (plotNo) {
    const ph = norm(phase)
    or.push({ plotNo: norm(plotNo), ...(ph ? { phase: { $in: [ph, null, ''] } } : {}) })
  }
  const ids = (propertyIds || [propertyId]).filter(Boolean)
  return { propertyId: ids.length > 1 ? { $in: ids } : ids[0], $or: or }
}

/** Both ids a property may be referenced by (id and projectId). */
export async function propertyIdsOf(db, propertyId) {
  const prop = await db.collection('featured_plots').findOne(
    { $or: [{ id: propertyId }, { projectId: propertyId }] },
    { projection: { _id: 0, id: 1, projectId: 1, name: 1 } },
  )
  return { ids: [...new Set([propertyId, prop?.id, prop?.projectId].filter(Boolean))], name: prop?.name || '' }
}

/** Stored documents by id (internal shape, includes fileId and shareToken). */
export const findPlotDocuments = (db, ids) => db.collection(COLLECTION).find({ id: { $in: ids } }).toArray()

/** Customer link path for a document (token-protected, see GET /:id/shared). */
export const sharedPathOf = (doc) => `/api/plot-documents/${encodeURIComponent(doc.id)}/shared?t=${doc.shareToken}`

async function logActivity(db, doc, title, note, req) {
  await db.collection('plot_activity').insertOne({
    id: `pa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    propertyId: doc.propertyId,
    propertyName: doc.propertyName,
    phase: doc.phase || null,
    plotUid: doc.plotUid || null,
    plotNo: doc.plotNo,
    type: 'document',
    title,
    note: note || '',
    plotDocumentId: doc.id,
    changes: [],
    actor: actorOf(req),
    createdAt: new Date(),
  })
}

/** Validate an uploaded file and compress it for storage. */
function checkUpload(req) {
  if (!req.file?.buffer?.length) return { error: 'Choose a file to upload.' }
  const type = sniff(req.file.buffer)
  if (!type) return { error: 'Only PDF, JPG, JPEG and PNG files are supported.' }
  return { type, buf: req.file.buffer }
}

/* GET /api/plot-documents?propertyId=&plotUid=&plotNo=&phase= */
router.get('/', async (req, res) => {
  try {
    const propertyId = norm(req.query.propertyId)
    const plotUid = norm(req.query.plotUid)
    const plotNo = norm(req.query.plotNo)
    if (!propertyId || (!plotUid && !plotNo)) return res.status(400).json({ success: false, error: 'propertyId and plotUid or plotNo are required' })
    const db = await getDb()
    const { ids } = await propertyIdsOf(db, propertyId)
    const docs = await db
      .collection(COLLECTION)
      .find(plotFilter({ propertyIds: ids, plotUid, plotNo, phase: norm(req.query.phase) }))
      .sort({ createdAt: -1 })
      .limit(MAX_PER_PLOT)
      .toArray()
    return res.json({ success: true, documents: docs.map(publicDoc) })
  } catch (err) {
    console.error('Plot documents list error:', err.message)
    return res.status(500).json({ success: false, error: 'Could not load documents' })
  }
})

/* POST /api/plot-documents  (multipart: file, label, propertyId, plotUid, plotNo, phase) */
router.post('/', single, async (req, res) => {
  try {
    const { type, buf, error } = checkUpload(req)
    if (error) return res.status(400).json({ success: false, error })
    const label = cleanLabel(req.body.label)
    if (!label) return res.status(400).json({ success: false, error: 'Give the document a label.' })

    const db = await getDb()
    const plot = await resolvePlot(db, req.body || {})
    if (!plot || !plot.plotNo) return res.status(404).json({ success: false, error: 'Plot not found' })
    const count = await db.collection(COLLECTION).countDocuments(plotFilter(plot))
    if (count >= MAX_PER_PLOT) return res.status(400).json({ success: false, error: `A plot can hold up to ${MAX_PER_PLOT} documents. Delete one first.` })

    const name = cleanName(req.body.originalName || req.file.originalname, type.ext)
    const stored = await storeFile(db, buf, name, type.mime)
    const now = new Date()
    const doc = {
      id: `pd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      ...plot,
      label,
      name,
      mime: type.mime,
      ext: type.ext,
      size: buf.length,
      originalSize: Math.max(Number(req.body.originalSize) || 0, buf.length),
      storedSize: stored.storedSize,
      encoding: stored.encoding,
      fileId: stored.fileId,
      shareToken: crypto.randomBytes(18).toString('hex'),
      uploadedBy: actorOf(req),
      createdAt: now,
      updatedAt: now,
    }
    await db.collection(COLLECTION).insertOne(doc)
    await logActivity(db, doc, `Document uploaded: ${label}`, name, req)
    return res.status(201).json({ success: true, document: publicDoc(doc) })
  } catch (err) {
    console.error('Plot document upload error:', err.message)
    return res.status(500).json({ success: false, error: 'Upload failed. Please try again.' })
  }
})

/* PATCH /api/plot-documents/:id  { label } */
router.patch('/:id', async (req, res) => {
  try {
    const label = cleanLabel(req.body?.label)
    if (!label) return res.status(400).json({ success: false, error: 'Label cannot be empty.' })
    const db = await getDb()
    const doc = await db.collection(COLLECTION).findOneAndUpdate(
      { id: req.params.id },
      { $set: { label, updatedAt: new Date() } },
      { returnDocument: 'after' },
    )
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' })
    return res.json({ success: true, document: publicDoc(doc) })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not rename the document' })
  }
})

/* PUT /api/plot-documents/:id/file  (multipart: file) — replace the file, keep label and history */
router.put('/:id/file', single, async (req, res) => {
  try {
    const { type, buf, error } = checkUpload(req)
    if (error) return res.status(400).json({ success: false, error })
    const db = await getDb()
    const old = await db.collection(COLLECTION).findOne({ id: req.params.id })
    if (!old) return res.status(404).json({ success: false, error: 'Document not found' })

    const name = cleanName(req.body.originalName || req.file.originalname, type.ext)
    const stored = await storeFile(db, buf, name, type.mime)
    const $set = {
      name,
      mime: type.mime,
      ext: type.ext,
      size: buf.length,
      originalSize: Math.max(Number(req.body.originalSize) || 0, buf.length),
      storedSize: stored.storedSize,
      encoding: stored.encoding,
      fileId: stored.fileId,
      replacedAt: new Date(),
      updatedAt: new Date(),
    }
    const doc = await db.collection(COLLECTION).findOneAndUpdate({ id: old.id }, { $set }, { returnDocument: 'after' })
    await dropFile(db, old.fileId)
    await logActivity(db, doc, `Document replaced: ${doc.label}`, `${old.name} → ${name}`, req)
    return res.json({ success: true, document: publicDoc(doc) })
  } catch (err) {
    console.error('Plot document replace error:', err.message)
    return res.status(500).json({ success: false, error: 'Could not replace the file. Please try again.' })
  }
})

/* DELETE /api/plot-documents/:id */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb()
    const doc = await db.collection(COLLECTION).findOneAndDelete({ id: req.params.id })
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' })
    await dropFile(db, doc.fileId)
    await logActivity(db, doc, `Document deleted: ${doc.label}`, doc.name, req)
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not delete the document' })
  }
})

async function sendFile(res, db, doc, download) {
  const buf = await readPlotDocumentFile(db, doc)
  res.set('Content-Type', doc.mime)
  res.set('Content-Length', String(buf.length))
  res.set('Cache-Control', 'private, no-store')
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${doc.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`)
  return res.send(buf)
}

/* GET /api/plot-documents/:id/file[?download=1] — signed-in CRM users */
router.get('/:id/file', async (req, res) => {
  try {
    const db = await getDb()
    const doc = await db.collection(COLLECTION).findOne({ id: req.params.id })
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' })
    return sendFile(res, db, doc, req.query.download === '1')
  } catch (err) {
    console.error('Plot document read error:', err.message)
    return res.status(500).json({ success: false, error: 'Could not open the document' })
  }
})

/* GET /api/plot-documents/:id/shared?t=token — customer share link (token-protected) */
router.get('/:id/shared', async (req, res) => {
  try {
    const db = await getDb()
    const doc = await db.collection(COLLECTION).findOne({ id: req.params.id })
    const t = norm(req.query.t)
    if (!doc || !t || t.length !== doc.shareToken.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(doc.shareToken))) {
      return res.status(404).send('Document not found')
    }
    res.set('X-Robots-Tag', 'noindex')
    return sendFile(res, db, doc, req.query.download === '1')
  } catch (err) {
    return res.status(500).send('Could not open the document')
  }
})

export async function ensurePlotDocumentIndexes(db) {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true })
  await db.collection(COLLECTION).createIndex({ propertyId: 1, plotUid: 1 })
  await db.collection(COLLECTION).createIndex({ propertyId: 1, plotNo: 1, phase: 1 })
}

export default router
