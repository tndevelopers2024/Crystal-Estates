import crypto from 'crypto'

/**
 * Password hashing helpers.
 *
 * New hashes use scrypt with a random salt, stored as `scrypt$<saltHex>$<hashHex>`.
 * Older records hold an unsalted sha256 hex digest; those still verify, and
 * `needsRehash` tells the caller to upgrade them after a successful login.
 */

const KEY_LENGTH = 64
const PREFIX = 'scrypt'

function normalize(password) {
  return String(password).trim()
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(normalize(password), salt, KEY_LENGTH)
  return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`
}

function legacySha256(password) {
  return crypto.createHash('sha256').update(normalize(password)).digest('hex')
}

function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'hex')
  const bufB = Buffer.from(String(b), 'hex')
  return bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false

  if (storedHash.startsWith(`${PREFIX}$`)) {
    const [, saltHex, hashHex] = storedHash.split('$')
    if (!saltHex || !hashHex) return false
    const hash = crypto.scryptSync(normalize(password), Buffer.from(saltHex, 'hex'), KEY_LENGTH)
    return safeEqualHex(hash.toString('hex'), hashHex)
  }

  // Legacy unsalted sha256 hex digest
  return safeEqualHex(legacySha256(password), storedHash)
}

export function needsRehash(storedHash) {
  return typeof storedHash !== 'string' || !storedHash.startsWith(`${PREFIX}$`)
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
