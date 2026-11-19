import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { getDb } from '../config/db.js'
import { normalizeAndValidateSvg } from '../lib/svgProcessor.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')

const router = Router()

// Destination folders
const clientPlotsDir = path.join(rootDir, 'client/public/plots')
const clientImagesDir = path.join(rootDir, 'client/public/images/plots')
const clientDocumentsDir = path.join(rootDir, 'client/public/documents')
const clientVideosDir = path.join(rootDir, 'client/public/videos')

const crmPlotsDir = path.join(rootDir, 'crm/public/plots')
const crmImagesDir = path.join(rootDir, 'crm/public/images/plots')
const crmDocumentsDir = path.join(rootDir, 'crm/public/documents')
const crmVideosDir = path.join(rootDir, 'crm/public/videos')

const serverUploadsPlotsDir = path.join(rootDir, 'server/uploads/plots')
const serverUploadsImagesDir = path.join(rootDir, 'server/uploads/images')
const serverUploadsDocumentsDir = path.join(rootDir, 'server/uploads/documents')
const serverUploadsVideosDir = path.join(rootDir, 'server/uploads/videos')

// Ensure all upload directories exist
const allDirs = [
  clientPlotsDir,
  clientImagesDir,
  clientDocumentsDir,
  clientVideosDir,
  crmPlotsDir,
  crmImagesDir,
  crmDocumentsDir,
  crmVideosDir,
  serverUploadsPlotsDir,
  serverUploadsImagesDir,
  serverUploadsDocumentsDir,
  serverUploadsVideosDir,
]

for (const dir of allDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Multer storage for raw multipart uploads (allows up to 100MB for drone videos/large docs)
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
})

function sanitizeSlug(str) {
  if (!str) return `item-${Date.now()}`
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractSvgDimensions(svgContent) {
  const norm = normalizeAndValidateSvg(svgContent)
  if (norm.valid) {
    return {
      viewBox: norm.viewBox,
      width: norm.width,
      height: norm.height,
    }
  }
  return { viewBox: '0 0 1056 816', width: 1056, height: 816 }
}

/**
 * Helper to write buffer safely to multiple destination folders
 */
function saveToDirs(dirs, filename, buffer) {
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, filename), buffer)
    } catch (e) {
      console.warn(`Could not write to ${dir}:`, e.message)
    }
  }
}

/**
 * POST /api/upload/image
 * Accepts image file (multipart or base64) and saves to client, crm, and server
 */
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    let buffer
    let originalName = 'plot-image'
    let ext = '.jpg'

    if (req.file) {
      buffer = req.file.buffer
      originalName = req.file.originalname
      ext = path.extname(originalName).toLowerCase() || '.jpg'
    } else if (req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '')
      buffer = Buffer.from(base64Data, 'base64')
      if (req.body.filename) {
        originalName = req.body.filename
        ext = path.extname(originalName).toLowerCase() || '.jpg'
      }
    } else {
      return res.status(400).json({ success: false, error: 'No image file or base64 provided' })
    }

    const timestamp = Date.now()
    const safeBase = sanitizeSlug(path.basename(originalName, ext))
    const filename = `plot-${safeBase}-${timestamp}${ext}`

    saveToDirs([clientImagesDir, crmImagesDir, serverUploadsImagesDir], filename, buffer)

    // Also persist image in MongoDB Atlas for permanent cloud serving across Render & Vercel
    try {
      const db = await getDb()
      const contentType =
        ext === '.png'
          ? 'image/png'
          : ext === '.svg'
          ? 'image/svg+xml'
          : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg'
      const isUnderLimit = buffer.length < 15 * 1024 * 1024
      const updateFields = {
        filename,
        contentType,
        size: buffer.length,
        storedOnDisk: true,
        updatedAt: new Date(),
      }
      if (isUnderLimit) {
        updateFields.binaryData = buffer
      }
      await db.collection('uploaded_files').updateOne(
        { filename },
        {
          $set: updateFields,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )
    } catch (dbErr) {
      console.warn('MongoDB uploaded_files caching warning:', dbErr.message)
    }

    const publicUrl = `/images/plots/${filename}`

    return res.json({
      success: true,
      url: publicUrl,
      filename,
      size: buffer.length,
    })
  } catch (err) {
    console.error('Image upload error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/upload/document
 * Accepts property documents (PDF, DOC, DOCX, Patta, Legal Deeds)
 */
router.post('/document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No document file provided' })
    }

    const buffer = req.file.buffer
    const originalName = req.file.originalname
    const ext = path.extname(originalName).toLowerCase() || '.pdf'
    const timestamp = Date.now()
    const safeBase = sanitizeSlug(path.basename(originalName, ext))
    const filename = `doc-${safeBase}-${timestamp}${ext}`

    saveToDirs([clientDocumentsDir, crmDocumentsDir, serverUploadsDocumentsDir], filename, buffer)

    // Also keep the file in MongoDB so it survives redeploys of servers with
    // temporary disks (served by the /documents/:filename database fallback)
    try {
      const db = await getDb()
      const updateFields = {
        filename,
        contentType: req.file.mimetype || 'application/octet-stream',
        size: buffer.length,
        storedOnDisk: true,
        updatedAt: new Date(),
      }
      if (buffer.length < 15 * 1024 * 1024) updateFields.binaryData = buffer
      await db.collection('uploaded_files').updateOne(
        { filename },
        { $set: updateFields, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      )
    } catch (dbErr) {
      console.warn('MongoDB document persistence warning:', dbErr.message)
    }

    const publicUrl = `/documents/${filename}`

    return res.json({
      success: true,
      url: publicUrl,
      filename,
      name: originalName,
      size: buffer.length,
      sizeFormatted: `${(buffer.length / 1024).toFixed(1)} KB`,
    })
  } catch (err) {
    console.error('Document upload error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/upload/video
 * Accepts site drone videos or promotional video files (MP4, WEBM, MOV)
 */
router.post('/video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' })
    }

    const buffer = req.file.buffer
    const originalName = req.file.originalname
    const ext = path.extname(originalName).toLowerCase() || '.mp4'
    const timestamp = Date.now()
    const safeBase = sanitizeSlug(path.basename(originalName, ext))
    const filename = `video-${safeBase}-${timestamp}${ext}`

    saveToDirs([clientVideosDir, crmVideosDir, serverUploadsVideosDir], filename, buffer)

    const publicUrl = `/videos/${filename}`

    return res.json({
      success: true,
      url: publicUrl,
      filename,
      name: originalName,
      size: buffer.length,
      sizeFormatted: `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`,
    })
  } catch (err) {
    console.error('Video upload error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/upload/layout-file
 * Accepts any layout blueprint file format (PDF, CAD DWG/DXF, SVG, PNG, JPG, DOC, etc.)
 * Validates and normalizes SVGs, persists to local disk and MongoDB Atlas uploaded_files.
 */
router.post('/layout-file', upload.single('layoutFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No layout file provided' })
    }

    let buffer = req.file.buffer
    const originalName = req.file.originalname
    const ext = path.extname(originalName).toLowerCase() || '.pdf'
    const isSvg = ext === '.svg' || req.file.mimetype === 'image/svg+xml'

    let viewBox = '0 0 1056 816'
    let width = 1056
    let height = 816

    if (isSvg) {
      const normResult = normalizeAndValidateSvg(buffer)
      if (!normResult.valid) {
        return res.status(400).json({
          success: false,
          error: normResult.error || 'The uploaded file is not a valid SVG vector layout.',
        })
      }
      buffer = normResult.normalizedBuffer
      viewBox = normResult.viewBox
      width = normResult.width
      height = normResult.height
    }

    const timestamp = Date.now()
    const safeBase = sanitizeSlug(path.basename(originalName, ext))
    const projectName = req.body.projectName || safeBase
    const filename = `layout-${safeBase}-${timestamp}${ext}`

    saveToDirs(
      [clientPlotsDir, crmPlotsDir, serverUploadsPlotsDir, clientDocumentsDir, crmDocumentsDir],
      filename,
      buffer
    )

    // Persist file into MongoDB Atlas uploaded_files collection for permanent cloud streaming across instances
    try {
      const db = await getDb()
      const contentType = isSvg ? 'image/svg+xml; charset=utf-8' : (req.file.mimetype || 'application/octet-stream')
      const isUnderLimit = buffer.length < 15 * 1024 * 1024
      const updateFields = {
        filename,
        contentType,
        size: buffer.length,
        storedOnDisk: true,
        updatedAt: new Date(),
      }
      if (isUnderLimit) {
        updateFields.binaryData = buffer
      }
      await db.collection('uploaded_files').updateOne(
        { filename },
        {
          $set: updateFields,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )

      if (isSvg) {
        await db.collection('layout_metadata').updateOne(
          { slug: safeBase },
          {
            $set: {
              slug: safeBase,
              name: projectName,
              layoutBackgroundUrl: `/plots/${filename}`,
              layoutUrl: `/plots/${filename}`,
              viewBox,
              width,
              height,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        )
      }
    } catch (dbErr) {
      console.warn('MongoDB file persistence warning:', dbErr.message)
    }

    const publicUrl = `/plots/${filename}`

    return res.json({
      success: true,
      url: publicUrl,
      filename,
      name: originalName,
      slug: safeBase,
      size: buffer.length,
      sizeFormatted: `${(buffer.length / 1024).toFixed(1)} KB`,
      isSvg,
      viewBox,
      width,
      height,
    })
  } catch (err) {
    console.error('Layout file upload error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/upload/layout-svg
 * Accepts converted SVG content string or SVG file and saves with validation & normalization
 */
router.post('/layout-svg', upload.single('svgFile'), async (req, res) => {
  try {
    let rawContent = ''
    let slug = ''
    let projectName = ''

    if (req.file) {
      rawContent = req.file.buffer
      slug = req.body.layoutSlug || path.basename(req.file.originalname, '.svg')
      projectName = req.body.projectName || slug
    } else if (req.body.svgContent) {
      rawContent = req.body.svgContent
      slug = req.body.layoutSlug || 'layout'
      projectName = req.body.projectName || slug
    } else {
      return res.status(400).json({
        success: false,
        error: 'No svgContent or svgFile provided in request',
      })
    }

    const normResult = normalizeAndValidateSvg(rawContent)
    if (!normResult.valid) {
      return res.status(400).json({
        success: false,
        error: normResult.error || 'The uploaded file is not a valid SVG vector layout.',
      })
    }

    const cleanSlug = sanitizeSlug(slug)
    const filename = `${cleanSlug}-layout.svg`
    const finalBuffer = normResult.normalizedBuffer
    const { viewBox, width, height } = normResult

    saveToDirs([clientPlotsDir, crmPlotsDir, serverUploadsPlotsDir], filename, finalBuffer)

    const layoutBackgroundUrl = `/plots/${filename}`

    // Persist to MongoDB Atlas uploaded_files and layout_metadata
    try {
      const db = await getDb()
      const isUnderLimit = finalBuffer.length < 15 * 1024 * 1024
      const updateFields = {
        filename,
        contentType: 'image/svg+xml; charset=utf-8',
        size: finalBuffer.length,
        storedOnDisk: true,
        updatedAt: new Date(),
      }
      if (isUnderLimit) {
        updateFields.binaryData = finalBuffer
      }
      await Promise.all([
        db.collection('uploaded_files').updateOne(
          { filename },
          {
            $set: updateFields,
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        ),
        db.collection('layout_metadata').updateOne(
          { slug: cleanSlug },
          {
            $set: {
              slug: cleanSlug,
              name: projectName,
              layoutBackgroundUrl,
              layoutUrl: layoutBackgroundUrl,
              viewBox,
              width,
              height,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        ),
      ])
    } catch (dbErr) {
      console.warn('MongoDB layout metadata upsert warning:', dbErr.message)
    }

    return res.json({
      success: true,
      slug: cleanSlug,
      filename,
      layoutBackgroundUrl,
      layoutUrl: layoutBackgroundUrl,
      viewBox,
      width,
      height,
      sizeBytes: finalBuffer.length,
    })
  } catch (err) {
    console.error('Layout SVG upload error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/upload/layouts
 * Returns all registered layout maps
 */
router.get('/layouts', async (req, res) => {
  try {
    const db = await getDb()
    const layouts = await db.collection('layout_metadata').find({}, { projection: { _id: 0 } }).toArray()

    const files = fs.readdirSync(clientPlotsDir).filter((f) => f.endsWith('.svg'))
    const availableFiles = files.map((file) => ({
      filename: file,
      url: `/plots/${file}`,
      slug: file.replace(/-layout\.svg$|\.svg$/, ''),
    }))

    return res.json({
      success: true,
      databaseLayouts: layouts || [],
      files: availableFiles,
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
