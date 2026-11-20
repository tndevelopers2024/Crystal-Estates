import crypto from 'crypto'
import bcrypt from 'bcryptjs'

/**
 * Password hashing helpers.
 *
 * New hashes use bcrypt (cost BCRYPT_ROUNDS). Older records still verify:
 *   - `scrypt$<saltHex>$<hashHex>` (salted scrypt)
 *   - an unsalted sha256 hex digest (legacy)
 * `needsRehash` tells the caller to upgrade those to bcrypt after a successful login.
 */

export const BCRYPT_ROUNDS = 12
export const MIN_PASSWORD_LENGTH = 8
const SCRYPT_KEY_LENGTH = 64

function normalize(password) {
  return String(password).trim()
}

export function hashPassword(password) {
  return bcrypt.hashSync(normalize(password), BCRYPT_ROUNDS)
}

const isBcrypt = (h) => typeof h === 'string' && /^\$2[aby]\$\d{2}\$/.test(h)

function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'hex')
  const bufB = Buffer.from(String(b), 'hex')
  return bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false
  if (isBcrypt(storedHash)) return bcrypt.compareSync(normalize(password), storedHash)

  if (storedHash.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = storedHash.split('$')
    if (!saltHex || !hashHex) return false
    const hash = crypto.scryptSync(normalize(password), Buffer.from(saltHex, 'hex'), SCRYPT_KEY_LENGTH)
    return safeEqualHex(hash.toString('hex'), hashHex)
  }

  // Legacy unsalted sha256 hex digest
  return safeEqualHex(crypto.createHash('sha256').update(normalize(password)).digest('hex'), storedHash)
}

export function needsRehash(storedHash) {
  return !isBcrypt(storedHash)
}

/** Basic strength rule shared by register, setup, reset and change password. */
export function passwordProblem(password) {
  const p = String(password ?? '')
  if (p.trim().length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (p.length > 128) return 'Password is too long'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use at least one letter and one number'
  return null
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
