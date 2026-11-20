import { Router } from 'express'
import crypto from 'crypto'
import { ObjectId } from 'mongodb'
import { getDb } from '../config/db.js'
import { sha256, statusOf, publicUser } from '../lib/auth.js'
import { listRoles, clearRoleCache, cleanPermissions, SECTIONS, homeFor } from '../lib/roles.js'
import { sendMail, approvalEmail, crmUrl } from '../lib/mailer.js'

/**
 * Super Admin only (enforced by apiPolicy in server.js): user approval and
 * account management, plus role permissions. Mounted at /api.
 */
const router = Router()
export const SETUP_LINK_HOURS = 48

const userQuery = (id) => {
  const or = [{ id }]
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) or.push({ _id: new ObjectId(id) })
  return { $or: or }
}
const idOf = (u) => u.id || String(u._id)
const by = (req) => ({ id: idOf(req.user), name: req.user.name || req.user.email })

function listShape(u, roles) {
  const role = roles.find((r) => r.id === u.roleId) || roles.find((r) => r.name.toLowerCase() === String(u.role || '').toLowerCase())
  return {
    ...publicUser(u, role),
    roleValid: Boolean(role),
    superAdmin: Boolean(role?.superAdmin),
    createdAt: u.createdAt || null,
    lastLogin: u.lastLogin || null,
    approvedAt: u.approvedAt || null,
    approvedBy: u.approvedBy?.name || null,
    statusNote: u.statusNote || '',
    setupPending: Boolean(u.setupTokenHash && u.setupExpiresAt && new Date(u.setupExpiresAt) > new Date()),
  }
}

async function activeSuperAdminCount(users, roles) {
  const names = roles.filter((r) => r.superAdmin).map((r) => r.name)
  const ids = roles.filter((r) => r.superAdmin).map((r) => r.id)
  return users.countDocuments({
    $and: [{ $or: [{ role: { $in: names } }, { roleId: { $in: ids } }] }, { $or: [{ status: 'active' }, { status: { $exists: false } }] }],
  })
}

/** Issues a fresh single-use setup link and emails it. Never throws for mail problems. */
async function issueSetupLink(users, user, role) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SETUP_LINK_HOURS * 3600 * 1000)
  await users.updateOne({ _id: user._id }, { $set: { setupTokenHash: sha256(token), setupExpiresAt: expires } })
  const link = crmUrl(`/set-password?token=${token}`)
  try {
    const mail = approvalEmail({ name: user.name || user.email, email: user.email, role: role?.name || user.role, link, hours: SETUP_LINK_HOURS })
    await sendMail({ to: user.email, ...mail, tag: 'account-approved' })
    return { emailSent: true }
  } catch (err) {
    console.error('Approval email failed:', err.message)
    return { emailSent: false, emailError: 'The account is approved, but the email could not be sent. Check the server email settings, then use “Resend setup link”.' }
  }
}

async function loadTarget(req, res) {
  const db = await getDb()
  const users = db.collection('users')
  const user = await users.findOne(userQuery(String(req.params.id)))
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' })
    return null
  }
  if (idOf(user) === idOf(req.user)) {
    res.status(400).json({ success: false, error: "You can't change your own role or account status." })
    return null
  }
  return { users, user, roles: await listRoles({ fresh: true }) }
}

async function respond(res, users, user, roles, extra = {}) {
  const fresh = await users.findOne({ _id: user._id })
  return res.json({ success: true, user: listShape(fresh, roles), ...extra })
}

/* ── Users ── */

router.get('/users', async (req, res) => {
  try {
    const db = await getDb()
    const roles = await listRoles({ fresh: true })
    const list = await db
      .collection('users')
      .find({}, { projection: { passwordHash: 0, password: 0, sessions: 0, sessionToken: 0, resetOtpHash: 0, resetTokenHash: 0, setupTokenHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray()
    return res.json({ success: true, users: list.map((u) => listShape(u, roles)), roles: roles.map((r) => ({ id: r.id, name: r.name, superAdmin: Boolean(r.superAdmin) })) })
  } catch (err) {
    console.error('List users error:', err.message)
    return res.status(503).json({ success: false, error: 'Could not load users' })
  }
})

router.post('/users/:id/approve', async (req, res) => {
  try {
    const t = await loadTarget(req, res)
    if (!t) return undefined
    const { users, user, roles } = t
    if (!['pending', 'rejected'].includes(statusOf(user))) {
      return res.status(400).json({ success: false, error: 'Only pending or rejected accounts can be approved' })
    }
    const role = req.body?.roleId ? roles.find((r) => r.id === req.body.roleId) : roles.find((r) => r.id === user.roleId) || roles.find((r) => r.name === user.role)
    if (!role) return res.status(400).json({ success: false, error: 'Choose a valid role before approving' })
    const now = new Date()
    await users.updateOne(
      { _id: user._id },
      {
        $set: { status: 'active', role: role.name, roleId: role.id, approvedAt: now, approvedBy: by(req), statusNote: '', updatedAt: now },
        $push: { statusHistory: { status: 'active', at: now, by: by(req).name, note: 'approved' } },
      },
    )
    const mail = await issueSetupLink(users, { ...user, role: role.name }, role)
    return respond(res, users, user, roles, mail)
  } catch (err) {
    console.error('Approve error:', err.message)
    return res.status(503).json({ success: false, error: 'Could not approve the account' })
  }
})

router.post('/users/:id/reject', async (req, res) => {
  try {
    const t = await loadTarget(req, res)
    if (!t) return undefined
    const { users, user, roles } = t
    if (statusOf(user) !== 'pending') return res.status(400).json({ success: false, error: 'Only pending accounts can be rejected' })
    const now = new Date()
    const note = String(req.body?.reason || '').trim().slice(0, 300)
    await users.updateOne(
      { _id: user._id },
      {
        $set: { status: 'rejected', statusNote: note, sessions: [], updatedAt: now },
        $unset: { setupTokenHash: '', setupExpiresAt: '' },
        $push: { statusHistory: { status: 'rejected', at: now, by: by(req).name, note } },
      },
    )
    return respond(res, users, user, roles)
  } catch (err) {
    return res.status(503).json({ success: false, error: 'Could not reject the account' })
  }
})

router.post('/users/:id/deactivate', async (req, res) => {
  try {
    const t = await loadTarget(req, res)
    if (!t) return undefined
    const { users, user, roles } = t
    if (statusOf(user) !== 'active') return res.status(400).json({ success: false, error: 'Only active accounts can be deactivated' })
    const isSuper = roles.some((r) => r.superAdmin && (r.id === user.roleId || r.name === user.role))
    if (isSuper && (await activeSuperAdminCount(users, roles)) <= 1) {
      return res.status(400).json({ success: false, error: 'At least one active Super Admin is required' })
    }
    const now = new Date()
    await users.updateOne(
      { _id: user._id },
      {
        $set: { status: 'deactivated', sessions: [], updatedAt: now, statusNote: String(req.body?.reason || '').trim().slice(0, 300) },
        $unset: { setupTokenHash: '', setupExpiresAt: '' },
        $push: { statusHistory: { status: 'deactivated', at: now, by: by(req).name } },
      },
    )
    return respond(res, users, user, roles)
  } catch (err) {
    return res.status(503).json({ success: false, error: 'Could not deactivate the account' })
  }
})

router.post('/users/:id/activate', async (req, res) => {
  try {
    const t = await loadTarget(req, res)
    if (!t) return undefined
    const { users, user, roles } = t
    if (statusOf(user) !== 'deactivated') return res.status(400).json({ success: false, error: 'Only deactivated accounts can be re-activated' })
    const now = new Date()
    await users.updateOne(
      { _id: user._id },
      { $set: { status: 'active', statusNote: '', updatedAt: now }, $push: { statusHistory: { status: 'active', at: now, by: by(req).name, note: 're-activated' } } },
    )
    return respond(res, users, user, roles)
  } catch (err) {
    return res.status(503).json({ success: false, error: 'Could not activate the account' })
  }
})

router.patch('/users/:id/role', async (req, res) => {
  try {
    const t = await loadTarget(req, res)
    if (!t) return undefined
    const { users, user, roles } = t
    const role = roles.find((r) => r.id === req.body?.roleId)
    if (!role) return res.status(400).json({ success: false, error: 'Choose a valid role' })
    const wasSuper = roles.some((r) => r.superAdmin && (r.id === user.roleId || r.name === user.role))
    if (wasSuper && !role.superAdmin && statusOf(user) === 'active' && (await activeSuperAdminCount(users, roles)) <= 1) {
      return res.status(400).json({ success: false, error: 'At least one active Super Admin is required' })
    }
    const now = new Date()
    await users.updateOne(
      { _id: user._id },
      { $set: { role: role.name, roleId: role.id, updatedAt: now }, $push: { statusHistory: { status: statusOf(user), at: now, by: by(req).name, note: `role set to ${role.name}` } } },
    )
    return respond(res, users, user, roles)
  } catch (err) {
    return res.status(503).json({ success: false, error: 'Could not change the role' })
  }
})

router.post('/users/:id/resend-setup', async (req, res) => {
  try {
    const t = await loadTarget(req, res)
    if (!t) return undefined
    const { users, user, roles } = t
    if (statusOf(user) !== 'active') return res.status(400).json({ success: false, error: 'Approve or activate the account first' })
    const role = roles.find((r) => r.id === user.roleId) || roles.find((r) => r.name === user.role)
    const mail = await issueSetupLink(users, user, role)
    return respond(res, users, user, roles, mail)
  } catch (err) {
    return res.status(503).json({ success: false, error: 'Could not send the setup link' })
  }
})

/* ── Roles ── */

router.get('/roles', async (req, res) => {
  try {
    const roles = await listRoles({ fresh: true })
    return res.json({ success: true, roles: roles.map((r) => ({ ...r, homeResolved: homeFor(r) })), sections: SECTIONS })
  } catch {
    return res.status(503).json({ success: false, error: 'Could not load roles' })
  }
})

router.patch('/roles/:id', async (req, res) => {
  try {
    const db = await getDb()
    const col = db.collection('crm_roles')
    const role = await col.findOne({ id: req.params.id })
    if (!role) return res.status(404).json({ success: false, error: 'Role not found' })
    if (role.superAdmin) return res.status(400).json({ success: false, error: 'Super Admin always has full access' })
    const set = { updatedAt: new Date() }
    if (req.body?.permissions) set.permissions = cleanPermissions(req.body.permissions)
    if (typeof req.body?.selfRegister === 'boolean') set.selfRegister = req.body.selfRegister
    if (typeof req.body?.description === 'string') set.description = req.body.description.trim().slice(0, 200)
    if (typeof req.body?.home === 'string' && SECTIONS.some((s) => s.path === req.body.home)) set.home = req.body.home
    await col.updateOne({ id: role.id }, { $set: set })
    clearRoleCache()
    const roles = await listRoles({ fresh: true })
    return res.json({ success: true, role: roles.find((r) => r.id === role.id) })
  } catch {
    return res.status(503).json({ success: false, error: 'Could not update the role' })
  }
})

export default router
