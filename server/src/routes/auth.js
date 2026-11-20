import { Router } from 'express'
import crypto from 'crypto'
import { getDb } from '../config/db.js'
import { hashPassword, verifyPassword, needsRehash, passwordProblem } from '../lib/password.js'
import { emailQuery, requestPasswordReset, resetPassword } from '../lib/passwordReset.js'
import { sendResetCode } from '../lib/sendResetCode.js'
import { sendMail, newRegistrationEmail, mailConfigured } from '../lib/mailer.js'
import { listRoles, roleFor, permissionsOf, homeFor, SECTIONS } from '../lib/roles.js'
import {
  createSession,
  endSession,
  publicUser,
  rateLimit,
  sha256,
  statusOf,
  STATUS_MESSAGES,
  tokenFrom,
} from '../lib/auth.js'

const router = Router()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sessionPayload(user, role) {
  return {
    user: publicUser(user, role),
    permissions: permissionsOf(role),
    superAdmin: Boolean(role?.superAdmin),
    home: homeFor(role),
    sections: SECTIONS,
  }
}

/**
 * GET /api/auth/roles — roles a new user may choose when registering.
 * Super Admin is never offered; it is only granted by another Super Admin.
 */
router.get('/roles', async (req, res) => {
  try {
    const roles = await listRoles()
    return res.json({
      success: true,
      roles: roles.filter((r) => r.selfRegister && !r.superAdmin).map((r) => ({ id: r.id, name: r.name, description: r.description || '' })),
    })
  } catch (err) {
    return res.status(503).json({ success: false, error: 'Could not load roles. Please try again.' })
  }
})

/**
 * POST /api/auth/register — creates a Pending Approval account.
 * The user can't sign in until a Super Admin approves it.
 */
router.post('/register', rateLimit({ key: 'register', max: 10 }), async (req, res) => {
  try {
    const name = String(req.body?.name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const roleId = String(req.body?.roleId || '').trim()

    if (name.length < 2) return res.status(400).json({ success: false, error: 'Enter your full name' })
    if (!EMAIL_RE.test(email) || email.length > 160) return res.status(400).json({ success: false, error: 'Enter a valid email address' })
    const weak = passwordProblem(password)
    if (weak) return res.status(400).json({ success: false, error: weak })

    const roles = await listRoles({ fresh: true })
    const role = roles.find((r) => r.id === roleId)
    if (!role || !role.selfRegister || role.superAdmin) {
      return res.status(400).json({ success: false, error: 'Choose one of the available roles' })
    }

    const db = await getDb()
    const users = db.collection('users')
    if (await users.findOne(emailQuery(email), { projection: { _id: 1 } })) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists. Sign in or reset your password.' })
    }

    const now = new Date()
    const doc = {
      id: `user-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`,
      name,
      email,
      passwordHash: hashPassword(password),
      role: role.name,
      roleId: role.id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ status: 'pending', at: now, by: 'self-registration' }],
    }
    await users.insertOne(doc)

    // Let Super Admins know (best effort; approval works without it)
    if (mailConfigured()) {
      const superRoles = roles.filter((r) => r.superAdmin).map((r) => r.name)
      users
        .find({ role: { $in: superRoles }, $or: [{ status: 'active' }, { status: { $exists: false } }] }, { projection: { email: 1 } })
        .toArray()
        .then((admins) =>
          Promise.all(
            admins
              .filter((a) => a.email)
              .map((a) => sendMail({ to: a.email, ...newRegistrationEmail({ name, email, role: role.name }), tag: 'new-registration' })),
          ),
        )
        .catch((err) => console.error('New-registration notice failed:', err.message))
    }

    return res.status(201).json({
      success: true,
      message: 'Account created. A Super Admin will review it — you will get an email once it is approved.',
    })
  } catch (err) {
    console.error('Registration error:', err.message)
    return res.status(503).json({ success: false, error: 'Registration is temporarily unavailable. Please try again.' })
  }
})

/**
 * POST /api/auth/login — only active accounts with a matching password.
 * Pending / rejected / deactivated accounts get a clear message, but only
 * after the password is verified (so statuses can't be probed).
 */
router.post('/login', rateLimit({ key: 'login', max: 20 }), async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    const db = await getDb()
    const users = db.collection('users')
    const user = await users.findOne(emailQuery(String(email).trim().toLowerCase()))

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    const status = statusOf(user)
    if (status !== 'active') {
      return res.status(403).json({ success: false, code: `ACCOUNT_${status.toUpperCase()}`, status, error: STATUS_MESSAGES[status] || 'This account cannot sign in.' })
    }

    const role = await roleFor(user)
    if (!role) {
      return res.status(403).json({ success: false, code: 'NO_ROLE', error: 'Your account has no valid role. Contact your administrator.' })
    }

    if (needsRehash(user.passwordHash)) {
      await users.updateOne({ _id: user._id }, { $set: { passwordHash: hashPassword(String(password)) }, $unset: { password: '' } })
    }
    const token = await createSession(users, user)

    return res.json({ success: true, message: 'Login successful', token, ...sessionPayload(user, role) })
  } catch (err) {
    console.error('Login error:', err.message)
    return res.status(503).json({ success: false, error: 'Login is temporarily unavailable. Please try again.' })
  }
})

/** GET /api/auth/me — validates the session and returns current role permissions. */
router.get('/me', async (req, res) => {
  const role = req.role || (await roleFor(req.user))
  return res.json({ success: true, ...sessionPayload(req.user, role) })
})

/** POST /api/auth/logout — ends this session only. */
router.post('/logout', async (req, res) => {
  try {
    const db = await getDb()
    await endSession(db.collection('users'), tokenFrom(req))
    return res.json({ success: true })
  } catch {
    return res.json({ success: true })
  }
})

/** POST /api/auth/change-password — signed-in users change their own password. */
router.post('/change-password', rateLimit({ key: 'change-password', max: 10 }), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    const db = await getDb()
    const users = db.collection('users')
    const user = await users.findOne({ _id: req.user._id })
    if (!user || !verifyPassword(String(currentPassword || ''), user.passwordHash)) {
      return res.status(400).json({ success: false, error: 'Your current password is incorrect' })
    }
    const weak = passwordProblem(newPassword)
    if (weak) return res.status(400).json({ success: false, error: weak })
    if (verifyPassword(String(newPassword), user.passwordHash)) {
      return res.status(400).json({ success: false, error: 'Choose a password different from your current one' })
    }
    // Keep this session; sign out every other device
    const keep = sha256(tokenFrom(req))
    await users.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: hashPassword(String(newPassword)), passwordChangedAt: new Date(), updatedAt: new Date(), sessions: (user.sessions || []).filter((s) => s.hash === keep) },
        $unset: { password: '' },
      },
    )
    return res.json({ success: true, message: 'Password changed. Other devices have been signed out.' })
  } catch (err) {
    console.error('Change password error:', err.message)
    return res.status(503).json({ success: false, error: 'Could not change the password. Please try again.' })
  }
})

/**
 * GET  /api/auth/setup-password?token=… — checks a setup link (from the approval email)
 * POST /api/auth/setup-password { token, newPassword } — sets the password, burns the link
 */
async function findBySetupToken(users, token) {
  const t = String(token || '').trim()
  if (t.length < 32) return null
  const user = await users.findOne({ setupTokenHash: sha256(t) })
  if (!user || !user.setupExpiresAt || new Date(user.setupExpiresAt).getTime() <= Date.now()) return null
  if (statusOf(user) !== 'active') return null
  return user
}

router.get('/setup-password', rateLimit({ key: 'setup', max: 30 }), async (req, res) => {
  try {
    const db = await getDb()
    const user = await findBySetupToken(db.collection('users'), req.query.token)
    if (!user) return res.status(400).json({ success: false, error: 'This link is invalid or has expired. Ask your Super Admin to send a new one.' })
    return res.json({ success: true, email: user.email, name: user.name })
  } catch {
    return res.status(503).json({ success: false, error: 'Please try again.' })
  }
})

router.post('/setup-password', rateLimit({ key: 'setup', max: 30 }), async (req, res) => {
  try {
    const { token, newPassword } = req.body || {}
    const db = await getDb()
    const users = db.collection('users')
    const user = await findBySetupToken(users, token)
    if (!user) return res.status(400).json({ success: false, error: 'This link is invalid or has expired. Ask your Super Admin to send a new one.' })
    const weak = passwordProblem(newPassword)
    if (weak) return res.status(400).json({ success: false, error: weak })
    await users.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: hashPassword(String(newPassword)), passwordChangedAt: new Date(), updatedAt: new Date(), sessions: [] },
        $unset: { setupTokenHash: '', setupExpiresAt: '', password: '' },
      },
    )
    return res.json({ success: true, message: 'Password set. You can now sign in.', email: user.email })
  } catch (err) {
    console.error('Setup password error:', err.message)
    return res.status(503).json({ success: false, error: 'Could not set the password. Please try again.' })
  }
})

/**
 * POST /api/auth/forgot-password — emails a one-time verification code.
 * Same response whether or not the email is registered; never contains the code.
 */
router.post('/forgot-password', rateLimit({ key: 'forgot', max: 10 }), async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' })
    }
    const db = await getDb()
    const result = await requestPasswordReset(db.collection('users'), email, sendResetCode)
    return res.json({ success: true, message: result.message })
  } catch (err) {
    console.error('Forgot password error:', err.message)
    return res.status(503).json({ success: false, error: 'Password reset is temporarily unavailable. Please try again.' })
  }
})

/** POST /api/auth/reset-password — needs the emailed code; signs out all sessions. */
router.post('/reset-password', rateLimit({ key: 'reset', max: 20 }), async (req, res) => {
  try {
    const { email, resetToken, otp, newPassword } = req.body || {}
    const db = await getDb()
    const result = await resetPassword(db.collection('users'), { email, resetToken, otp, newPassword })
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error })
    }
    await db.collection('users').updateOne(emailQuery(String(email).trim().toLowerCase()), { $set: { sessions: [] } })
    return res.json({ success: true, message: result.message })
  } catch (err) {
    console.error('Reset password error:', err.message)
    return res.status(503).json({ success: false, error: 'Password reset is temporarily unavailable. Please try again.' })
  }
})

export default router
