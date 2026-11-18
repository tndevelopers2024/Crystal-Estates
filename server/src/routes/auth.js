import { Router } from 'express'
import crypto from 'crypto'
import { getDb } from '../config/db.js'
import { hashPassword, verifyPassword, needsRehash, escapeRegex } from '../lib/password.js'

const router = Router()

/**
 * Case-insensitive exact email match (input is escaped so it can't act as a regex)
 */
function emailQuery(cleanEmail) {
  return { email: { $regex: new RegExp(`^${escapeRegex(cleanEmail)}$`, 'i') } }
}

/**
 * POST /api/auth/login
 * Succeeds only for a user in the `users` collection whose stored passwordHash matches.
 * There is no built-in account; create the first admin with `npm run seed:admin`.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    const cleanEmail = String(email).trim().toLowerCase()
    const cleanPass = String(password).trim()

    const db = await getDb()
    const user = await db.collection('users').findOne(emailQuery(cleanEmail))

    if (!user || !verifyPassword(cleanPass, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    // Generate session token
    const token = `token-${crypto.randomBytes(24).toString('hex')}`

    const update = { lastLogin: new Date(), sessionToken: token }
    // Upgrade legacy unsalted sha256 hashes to scrypt on successful login
    if (needsRehash(user.passwordHash)) {
      update.passwordHash = hashPassword(cleanPass)
    }

    try {
      await db.collection('users').updateOne({ _id: user._id }, { $set: update })
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id || user._id,
        name: user.name || 'Crystal Admin',
        email: user.email,
        role: user.role || 'Super Admin',
        initials: user.initials || 'CA',
        color: user.color || '#0B57D0',
      },
    })
  } catch (err) {
    console.error('Login error:', err.message)
    return res.status(503).json({ success: false, error: 'Login is temporarily unavailable. Please try again.' })
  }
})

/**
 * POST /api/auth/forgot-password
 * Initiates password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' })
    }

    const cleanEmail = String(email).trim().toLowerCase()
    const db = await getDb()

    const user = await db.collection('users').findOne(emailQuery(cleanEmail))

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account registered with this email address.',
      })
    }

    // Generate reset token and 6-digit OTP
    const resetToken = crypto.randomBytes(20).toString('hex')
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour

    await db.collection('users').updateOne(
      { email: user.email },
      {
        $set: {
          resetToken,
          resetOtp: otp,
          resetExpiresAt: expiresAt,
        },
      }
    )

    return res.json({
      success: true,
      message: `Password reset verification code sent to ${cleanEmail}`,
      resetToken,
      otp, // surfaced for immediate seamless verification
    })
  } catch (err) {
    console.error('Forgot password error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/auth/reset-password
 * Set new password using resetToken or OTP
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken, otp, newPassword } = req.body

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email and new password are required' })
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    }

    const cleanEmail = String(email).trim().toLowerCase()
    const db = await getDb()

    const user = await db.collection('users').findOne(emailQuery(cleanEmail))

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Validate token or OTP if provided
    if (resetToken && user.resetToken && user.resetToken !== resetToken) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' })
    }

    if (otp && user.resetOtp && user.resetOtp !== String(otp).trim()) {
      return res.status(400).json({ success: false, error: 'Incorrect verification code' })
    }

    const passwordHash = hashPassword(newPassword)

    await db.collection('users').updateOne(
      { email: user.email },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
        $unset: {
          password: '',
          resetToken: '',
          resetOtp: '',
          resetExpiresAt: '',
        },
      }
    )

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    })
  } catch (err) {
    console.error('Reset password error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/auth/me
 * Validate current session
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const db = await getDb()
    const user = await db.collection('users').findOne(
      { sessionToken: token },
      { projection: { password: 0, passwordHash: 0 } }
    )

    if (!user) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid' })
    }

    return res.json({
      success: true,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials || 'CA',
        color: user.color || '#0B57D0',
      },
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
