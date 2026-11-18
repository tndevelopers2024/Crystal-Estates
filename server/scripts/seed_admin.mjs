/**
 * Create the first CRM admin (or reset an existing admin's password).
 *
 * Reads credentials from the environment only — nothing is hard-coded:
 *   ADMIN_EMAIL      (required) login email
 *   ADMIN_PASSWORD   (required) at least 12 characters
 *   ADMIN_NAME       (optional) display name, default "Crystal Admin"
 *
 * Usage (from server/):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run seed:admin
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run seed:admin -- --reset-password
 *
 * Without --reset-password an existing user with that email is left untouched.
 * With it, that user's password is replaced and their session token is cleared.
 */
import crypto from 'crypto'
import { getDb, closeDb } from '../src/config/db.js'
import { hashPassword, escapeRegex } from '../src/lib/password.js'

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = String(process.env.ADMIN_PASSWORD || '').trim()
const name = String(process.env.ADMIN_NAME || 'Crystal Admin').trim()
const resetPassword = process.argv.includes('--reset-password')

if (!email || !email.includes('@')) {
  console.error('ADMIN_EMAIL must be set to a valid email address.')
  process.exit(1)
}
if (password.length < 12) {
  console.error('ADMIN_PASSWORD must be set and at least 12 characters long.')
  process.exit(1)
}

function initialsOf(fullName) {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'CA'
  )
}

try {
  const db = await getDb()
  const users = db.collection('users')
  const existing = await users.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') },
  })

  if (existing) {
    if (!resetPassword) {
      console.log(`User ${existing.email} already exists; nothing changed. Pass --reset-password to replace its password.`)
    } else {
      await users.updateOne(
        { _id: existing._id },
        {
          $set: { passwordHash: hashPassword(password), updatedAt: new Date() },
          $unset: { password: '', sessionToken: '', resetToken: '', resetOtp: '', resetExpiresAt: '' },
        }
      )
      console.log(`Password reset for ${existing.email}.`)
    }
  } else {
    const now = new Date()
    await users.insertOne({
      id: `usr-${crypto.randomBytes(6).toString('hex')}`,
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'Super Admin',
      initials: initialsOf(name),
      color: '#0B57D0',
      createdAt: now,
      updatedAt: now,
    })
    console.log(`Created Super Admin ${email}.`)
  }
} catch (err) {
  console.error('seed_admin failed:', err.message)
  process.exitCode = 1
} finally {
  await closeDb()
}
