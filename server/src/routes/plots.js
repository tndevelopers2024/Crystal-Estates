import { Router } from 'express'
import { getDb } from '../config/db.js'
import { logPlotChanges } from './plotActivity.js'

const router = Router()

/**
 * Format currency number to Indian format (e.g. ₹ 42.00 Lakhs)
 */
function formatPrice(amount) {
  if (!amount || isNaN(amount)) return 'Price on Request'
  const num = Number(amount)
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2)} Cr`
  }
  if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(2)} Lakhs`
  }
  return `₹ ${num.toLocaleString('en-IN')}`
}

/** available / booked / sold counts derived from a plot list. */
function summarizeStatuses(plots = []) {
  const st = (p) => String(p?.status || 'Available').toLowerCase()
  const available = plots.filter((p) => st(p) === 'available').length
  return {
    available,
    availablePlots: available,
    booked: plots.filter((p) => ['booked', 'reserved'].includes(st(p))).length,
    sold: plots.filter((p) => ['sold', 'registered'].includes(st(p))).length,
  }
}

/** "/plots/layout-foo_bar-1794467980605.svg" -> "foo_bar" */
function slugFromLayoutUrl(url) {
  if (!url) return null
  const file = String(url).split('?')[0].split('/').pop()
  return (
    file
      .replace(/\.svg$/i, '')
      .replace(/^layout-/i, '')
      .replace(/-layout$/i, '')
      .replace(/-\d{10,}$/, '') || null
  )
}

/**
 * GET /api/plots
 * Retrieve all featured plots dynamically from MongoDB
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDb()
    const plots = await db.collection('featured_plots').find({}, { projection: { _id: 0 } }).toArray()

    return res.json({
      success: true,
      source: 'database',
      plots: plots || [],
    })
  } catch (err) {
    console.error('MongoDB fetch error for /api/plots:', err.message)
    return res.status(500).json({
      success: false,
      source: 'database',
      error: err.message,
      plots: [],
    })
  }
})

/**
 * GET /api/plots/:id
 * Retrieve a single plot by id, projectId, or slug strictly from MongoDB
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const db = await getDb()
    const nameRegex = new RegExp(`^${id.replace(/[-_]/g, '[-_ ]?')}$`, 'i')
    const plot = await db.collection('featured_plots').findOne(
      {
        $or: [
          { id },
          { projectId: id },
          { slug: id },
          { layoutSlug: id },
          { name: nameRegex },
        ],
      },
      { projection: { _id: 0 } }
    )

    if (plot) {
      return res.json({
        success: true,
        plot,
      })
    }

    return res.status(404).json({ success: false, error: 'Property not found' })
  } catch (err) {
    console.error('MongoDB fetch error for /api/plots/:id:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/plots
 * Create a new property/plot entry in MongoDB with the 16 full specifications:
 * 1. Project ID (Automatic unique number)
 * 2. Project name
 * 3. Property type (Residential / Agricultural / Bulk land)
 * 4. Location (District, Taluk, Village)
 * 5. Survey number
 * 6. Total land area (Acres / Cents / Sq.ft.)
 * 7. Available area
 * 8. Plot number (Individual plot identification)
 * 9. Plot dimensions (Length and width)
 * 10. Price (Total price / per sq.ft. / per cent)
 * 11. Road access (Road width and access details)
 * 12. Approval status (Applicable approval details)
 * 13. Documents (Uploaded property documents)
 * 14. Images (Site photographs)
 * 15. Videos (Drone and site videos)
 * 16. Status (Available / Reserved / Booked / Sold)
 */
router.post('/', async (req, res) => {
  try {
    const {
      projectId,
      name,
      projectName,
      propertyType,
      type = 'Residential',
      location = '',
      district = '',
      taluk = '',
      village = '',
      surveyNumber = '',
      totalLandArea = '',
      totalLandAreaUnit = 'Sq.ft.',
      availableArea = '',
      availableAreaUnit = 'Sq.ft.',
      plotNumber = '',
      plotNo = '',
      plotDimensions = '',
      length = '',
      width = '',
      price = 0,
      pricePerSqft = '',
      pricePerCent = '',
      roadAccess = '',
      approvalStatus = '',
      approval = '',
      documents = [],
      images = [],
      gallery = [],
      image = '',
      videos = [],
      status = 'Available',
      description = '',
      hasLayoutMap = false,
      layoutSlug,
      layoutBackgroundUrl,
      facing = 'East',
      mapLocation = '',
      mapUrl = '',
      googleMapsUrl = '',
    } = req.body

    const finalName = (name || projectName || '').trim()
    if (!finalName) {
      return res.status(400).json({ success: false, error: 'Project name is required' })
    }

    const db = await getDb()
    const autoNumber = Math.floor(100000 + Math.random() * 900000)
    const finalProjectId = (projectId || `CE-${autoNumber}`).trim()
    const id = `ce-${Date.now()}`

    // Compose location string if not already formatted
    let finalLocation = location.trim()
    if (!finalLocation && (village || taluk || district)) {
      finalLocation = [village, taluk, district].filter(Boolean).join(', ')
    }

    // Compose plot dimensions string
    let finalDimensions = plotDimensions.trim()
    if (!finalDimensions && (length || width)) {
      finalDimensions = `${length || '-'} x ${width || '-'}`
    }

    // Images and cover
    const allImages = Array.isArray(images) && images.length > 0 ? images : Array.isArray(gallery) ? gallery : []
    const primaryImage = image || (allImages.length > 0 ? allImages[0] : '/images/hero-estate.jpg')

    const layoutPlots = Array.isArray(req.body.plots) ? req.body.plots : []
    const computedSlug =
      layoutSlug ||
      slugFromLayoutUrl(layoutBackgroundUrl) ||
      finalName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')

    const newPlot = {
      id,
      projectId: finalProjectId,
      name: finalName,
      projectName: finalName,
      propertyType: propertyType || type || 'Residential',
      type: propertyType || type || 'Residential',
      location: finalLocation || 'Chennai, Tamil Nadu',
      district: district.trim(),
      taluk: taluk.trim(),
      village: village.trim(),
      surveyNumber: surveyNumber.trim(),
      totalLandArea: totalLandArea || '1200',
      totalLandAreaUnit: totalLandAreaUnit || 'Sq.ft.',
      availableArea: availableArea || totalLandArea || '1200',
      availableAreaUnit: availableAreaUnit || totalLandAreaUnit || 'Sq.ft.',
      plotNumber: (plotNumber || plotNo || '').trim(),
      plotNo: (plotNumber || plotNo || '').trim(),
      plotDimensions: finalDimensions,
      price: price ? Number(price) : 0,
      priceFormatted: formatPrice(price),
      pricePerSqft: pricePerSqft ? Number(pricePerSqft) : null,
      pricePerCent: pricePerCent ? Number(pricePerCent) : null,
      roadAccess: roadAccess.trim(),
      approvalStatus: approvalStatus || approval || 'Clear Title & Patta',
      approval: approvalStatus || approval || 'Clear Title & Patta',
      rera: approvalStatus || approval || 'Clear Title & Patta',
      documents: Array.isArray(documents) ? documents : [],
      images: allImages,
      gallery: allImages,
      image: primaryImage,
      videos: Array.isArray(videos) ? videos : [],
      status: status || 'Available',
      badge: status || 'Available',
      facing,
      description: description || '',
      mapLocation: (mapLocation || mapUrl || googleMapsUrl || '').trim(),
      mapUrl: (mapUrl || mapLocation || googleMapsUrl || '').trim(),
      googleMapsUrl: (googleMapsUrl || mapLocation || mapUrl || '').trim(),
      hasLayoutMap: Boolean(hasLayoutMap || layoutBackgroundUrl || layoutPlots.length > 0 || (Array.isArray(req.body.layouts) && req.body.layouts.length > 0)),
      layoutSlug: computedSlug,
      layoutBackgroundUrl: layoutBackgroundUrl || null,
      layouts: Array.isArray(req.body.layouts) ? req.body.layouts : (Array.isArray(req.body.phases) ? req.body.phases : []),
      phases: Array.isArray(req.body.layouts) ? req.body.layouts : (Array.isArray(req.body.phases) ? req.body.phases : []),
      plots: layoutPlots,
      totalPlots: layoutPlots.length,
      ...summarizeStatuses(layoutPlots),
      viewBox: req.body.viewBox || null,
      width: req.body.width || null,
      height: req.body.height || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.collection('featured_plots').insertOne(newPlot)

    // Synchronize layout collection in MongoDB if plots or layout are provided
    if (computedSlug) {
      const collectionName = `${computedSlug}_layout`
      if (layoutPlots.length > 0) {
        await db.collection(collectionName).deleteMany({})
        await db.collection(collectionName).insertMany(layoutPlots)
      }
      await db.collection('layout_metadata').updateOne(
        { slug: computedSlug },
        {
          $set: {
            slug: computedSlug,
            name: finalName,
            title: finalName,
            location: finalLocation,
            layoutBackgroundUrl: layoutBackgroundUrl || null,
            viewBox: req.body.viewBox || '0 0 1056 816',
            width: req.body.width || 1056,
            height: req.body.height || 816,
            layouts: Array.isArray(req.body.layouts) ? req.body.layouts : (Array.isArray(req.body.phases) ? req.body.phases : null),
            phases: Array.isArray(req.body.layouts) ? req.body.layouts : (Array.isArray(req.body.phases) ? req.body.phases : null),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      )
    }

    return res.status(201).json({
      success: true,
      message: 'Property created successfully with all 16 specifications',
      plot: newPlot,
    })
  } catch (err) {
    console.error('Error creating plot:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/plots/:id
 * Update a featured plot in MongoDB
 */
const handlePatchPlot = async (req, res) => {
  try {
    const id = req.params.id || req.body.id
    if (!id) {
      return res.status(400).json({ success: false, error: 'Property ID is required' })
    }

    const updates = { ...req.body, updatedAt: new Date() }
    delete updates._id
    // Who made the change (for the plot activity log); never stored on the property
    const actor = updates._actor
    delete updates._actor
    // Nearby places have their own endpoints; a property save must never overwrite them with a stale copy
    delete updates.nearbyPlaces

    if (updates.price) {
      updates.priceFormatted = formatPrice(updates.price)
    }

    if (Array.isArray(updates.plots)) {
      // Buyer details belong in plot_bookings (CRM only) — never on public plot data
      updates.plots = updates.plots.map(({ booking, ...p }) => p)
      if (Array.isArray(updates.layouts)) {
        updates.layouts = updates.layouts.map((l) => ({
          ...l,
          plots: Array.isArray(l.plots) ? l.plots.map(({ booking, ...p }) => p) : l.plots,
        }))
        updates.phases = updates.layouts
      }
      // Inventory counters are always derived from the plots themselves so
      // cards never show stale numbers (e.g. "18 available" vs 52 real).
      Object.assign(updates, summarizeStatuses(updates.plots))
      updates.totalPlots = updates.plots.length
      updates.hasLayoutMap = Boolean(updates.hasLayoutMap || updates.layoutBackgroundUrl || updates.plots.length > 0)
    }

    const db = await getDb()

    // Snapshot plots before the update so each change can be logged per plot
    const beforeDoc = Array.isArray(updates.plots)
      ? await db.collection('featured_plots').findOne({ $or: [{ id }, { projectId: id }] }, { projection: { _id: 0 } })
      : null

    // Update only: an unknown id must not create an empty property
    // ($or filters aren't copied into upserted documents)
    const result = await db.collection('featured_plots').updateOne(
      { $or: [{ id }, { projectId: id }] },
      { $set: updates }
    )

    if (result.matchedCount === 0 && result.upsertedCount === 0) {
      return res.status(404).json({ success: false, error: 'Property not found' })
    }

    if (beforeDoc && Array.isArray(updates.plots)) {
      await logPlotChanges(db, beforeDoc, Array.isArray(beforeDoc.plots) ? beforeDoc.plots : [], updates.plots, actor)
    }

    // If plots are updated, sync to layout collection and layout_metadata
    if (Array.isArray(updates.plots)) {
      const existingDoc = await db.collection('featured_plots').findOne({ $or: [{ id }, { projectId: id }] })
      const slug =
        updates.layoutSlug ||
        existingDoc?.layoutSlug ||
        existingDoc?.slug ||
        (existingDoc?.name ? existingDoc.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : id)

      if (slug) {
        const collectionName = `${slug}_layout`
        await db.collection(collectionName).deleteMany({})
        if (updates.plots.length > 0) {
          await db.collection(collectionName).insertMany(updates.plots)
        }
        const existingMeta = await db.collection('layout_metadata').findOne({ slug })
        const resolvedViewBox =
          updates.viewBox ||
          (existingDoc?.viewBox && existingDoc.viewBox !== '0 0 1056 816' ? existingDoc.viewBox : null) ||
          (existingMeta?.viewBox && existingMeta.viewBox !== '0 0 1056 816' ? existingMeta.viewBox : null) ||
          existingMeta?.viewBox ||
          existingDoc?.viewBox ||
          '0 0 1056 816'

        await db.collection('layout_metadata').updateOne(
          { slug },
          {
            $set: {
              slug,
              name: existingDoc?.name || slug,
              title: existingDoc?.name || slug,
              location: existingDoc?.location || '',
              layoutBackgroundUrl: updates.layoutBackgroundUrl || existingDoc?.layoutBackgroundUrl || null,
              viewBox: resolvedViewBox,
              layouts: updates.layouts || existingDoc?.layouts || null,
              phases: updates.layouts || existingDoc?.layouts || null,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        )
      }
    }

    return res.json({
      success: true,
      message: 'Property updated successfully',
    })
  } catch (err) {
    console.error('Error updating plot:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}

router.patch('/:id', handlePatchPlot)
router.patch('/', handlePatchPlot)

/* ───────── Nearby places (temples, schools, hospitals, landmarks…) ─────────
   Stored on the project as `nearbyPlaces`. x / y are positions in the phase
   layout's SVG coordinate space (they may sit outside the drawing), picked on
   the 3D view from the CRM. */

const PLACE_FIELDS = { name: 120, category: 60, description: 600, distance: 40, phase: 80 }

function cleanPlace(body = {}, existing = {}) {
  const out = { ...existing }
  for (const [k, max] of Object.entries(PLACE_FIELDS)) {
    if (body[k] !== undefined) out[k] = String(body[k] ?? '').trim().slice(0, max)
  }
  for (const k of ['x', 'y']) {
    if (body[k] !== undefined) {
      const n = Number(body[k])
      out[k] = Number.isFinite(n) ? Math.round(n * 100) / 100 : null
    }
  }
  return out
}

function placeError(p) {
  if (!p.name) return 'Place name is required'
  if (!p.category) return 'Choose a category'
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return 'Pick the place position on the 3D layout'
  if (Math.abs(p.x) > 1e6 || Math.abs(p.y) > 1e6) return 'Position is out of range'
  return null
}

const projectQuery = (id) => ({ $or: [{ id }, { projectId: id }] })

router.get('/:id/places', async (req, res) => {
  try {
    const db = await getDb()
    const prop = await db.collection('featured_plots').findOne(projectQuery(req.params.id), { projection: { _id: 0, nearbyPlaces: 1 } })
    if (!prop) return res.status(404).json({ success: false, error: 'Property not found' })
    return res.json({ success: true, places: Array.isArray(prop.nearbyPlaces) ? prop.nearbyPlaces : [] })
  } catch (err) {
    console.error('Error loading nearby places:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/:id/places', async (req, res) => {
  try {
    const place = cleanPlace(req.body)
    const error = placeError(place)
    if (error) return res.status(400).json({ success: false, error })
    const db = await getDb()
    const now = new Date()
    const doc = { id: `place-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...place, createdAt: now, updatedAt: now }
    const result = await db.collection('featured_plots').findOneAndUpdate(
      projectQuery(req.params.id),
      { $push: { nearbyPlaces: doc }, $set: { updatedAt: now } },
      { returnDocument: 'after', projection: { _id: 0, nearbyPlaces: 1 } }
    )
    const prop = result?.value !== undefined ? result.value : result
    if (!prop) return res.status(404).json({ success: false, error: 'Property not found' })
    return res.status(201).json({ success: true, place: doc, places: prop.nearbyPlaces || [] })
  } catch (err) {
    console.error('Error adding nearby place:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

router.patch('/:id/places/:placeId', async (req, res) => {
  try {
    const db = await getDb()
    const prop = await db.collection('featured_plots').findOne(projectQuery(req.params.id), { projection: { _id: 0, nearbyPlaces: 1 } })
    if (!prop) return res.status(404).json({ success: false, error: 'Property not found' })
    const current = (prop.nearbyPlaces || []).find((p) => p.id === req.params.placeId)
    if (!current) return res.status(404).json({ success: false, error: 'Place not found' })
    const place = { ...cleanPlace(req.body, current), id: current.id, createdAt: current.createdAt, updatedAt: new Date() }
    const error = placeError(place)
    if (error) return res.status(400).json({ success: false, error })
    await db.collection('featured_plots').updateOne(
      { ...projectQuery(req.params.id), 'nearbyPlaces.id': current.id },
      { $set: { 'nearbyPlaces.$': place, updatedAt: new Date() } }
    )
    const after = await db.collection('featured_plots').findOne(projectQuery(req.params.id), { projection: { _id: 0, nearbyPlaces: 1 } })
    return res.json({ success: true, place, places: after?.nearbyPlaces || [] })
  } catch (err) {
    console.error('Error updating nearby place:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

router.delete('/:id/places/:placeId', async (req, res) => {
  try {
    const db = await getDb()
    const result = await db.collection('featured_plots').updateOne(projectQuery(req.params.id), {
      $pull: { nearbyPlaces: { id: req.params.placeId } },
      $set: { updatedAt: new Date() },
    })
    if (!result.matchedCount) return res.status(404).json({ success: false, error: 'Property not found' })
    const after = await db.collection('featured_plots').findOne(projectQuery(req.params.id), { projection: { _id: 0, nearbyPlaces: 1 } })
    return res.json({ success: true, removed: result.modifiedCount > 0, places: after?.nearbyPlaces || [] })
  } catch (err) {
    console.error('Error deleting nearby place:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/plots/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const db = await getDb()
    const result = await db.collection('featured_plots').deleteOne({ $or: [{ id }, { projectId: id }] })

    return res.json({
      success: true,
      message: `Property ${id} deleted`,
      deletedCount: result.deletedCount,
    })
  } catch (err) {
    console.error('Error deleting plot:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
