/**
 * CRM password reset: issue a one-time code and verify it.
 *
 * The code is never returned to the HTTP caller. Only a SHA-256 hash of it is
 * stored, it expires after RESET_TTL_MS, and it is burned after
 * MAX_RESET_ATTEMPTS wrong guesses or one successful reset.
 *
 * Both functions take the `users` collection and (for issuing) the delivery
 * function as arguments so they can be unit-tested without a database.
 */
import crypto from 'crypto'
import { hashPassword, escapeRegex, passwordProblem, MIN_PASSWORD_LENGTH } from './password.js'

export { MIN_PASSWORD_LENGTH }

export const RESET_TTL_MS = 15 * 60 * 1000 // 15 minutes
export const MAX_RESET_ATTEMPTS = 5

export const GENERIC_FORGOT_MESSAGE =
  'If an account exists for that email, a verification code has been sent to it.'
export const INVALID_CODE_MESSAGE = 'Invalid or expired verification code.'

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

export function emailQuery(cleanEmail) {
  return { email: { $regex: new RegExp(`^${escapeRegex(cleanEmail)}$`, 'i') } }
}

const RESET_FIELDS_UNSET = {
  resetToken: '',
  resetOtp: '',
  resetTokenHash: '',
  resetOtpHash: '',
  resetExpiresAt: '',
  resetAttempts: '',
}

/**
 * Issues a reset code for `email` if such a user exists, and hands it to `send`.
 * Always resolves to the same generic result so callers cannot tell whether the
 * email is registered.
 */
export async function requestPasswordReset(users, email, send, { now = Date.now() } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) return { ok: false, error: 'Email address is required' }

  const user = await users.findOne(emailQuery(cleanEmail))
  if (user) {
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(now + RESET_TTL_MS)

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          resetOtpHash: sha256(otp),
          resetTokenHash: sha256(resetToken),
          resetExpiresAt: expiresAt,
          resetAttempts: 0,
        },
        // Drop any plaintext codes left by the old implementation
        $unset: { resetToken: '', resetOtp: '' },
      }
    )

    try {
      await send({ to: user.email, name: user.name, otp, resetToken, expiresAt })
    } catch (err) {
      // Delivery failures are logged server-side only; the caller sees the generic message.
      console.error('Password reset delivery failed:', err.message)
    }
  }

  return { ok: true, message: GENERIC_FORGOT_MESSAGE }
}

/**
 * Sets a new password only when `otp` or `resetToken` matches the stored,
 * unexpired code. Clears the code (and existing sessions) on success.
 */
export async function resetPassword(users, { email, otp, resetToken, newPassword }, { now = Date.now() } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const code = otp != null && String(otp).trim() !== '' ? String(otp).trim() : null
  const token = resetToken != null && String(resetToken).trim() !== '' ? String(resetToken).trim() : null

  if (!cleanEmail || !newPassword) {
    return { ok: false, status: 400, error: 'Email and new password are required' }
  }
  if (!code && !token) {
    return { ok: false, status: 400, error: 'Verification code is required' }
  }
  const weak = passwordProblem(newPassword)
  if (weak) {
    return { ok: false, status: 400, error: weak }
  }

  const user = await users.findOne(emailQuery(cleanEmail))
  const expiresAt = user?.resetExpiresAt ? new Date(user.resetExpiresAt).getTime() : 0
  const hasActiveCode = Boolean(user && (user.resetOtpHash || user.resetTokenHash) && expiresAt > now)

  if (!hasActiveCode) {
    return { ok: false, status: 400, error: INVALID_CODE_MESSAGE }
  }

  if ((user.resetAttempts || 0) >= MAX_RESET_ATTEMPTS) {
    await users.updateOne({ _id: user._id }, { $unset: RESET_FIELDS_UNSET })
    return { ok: false, status: 400, error: INVALID_CODE_MESSAGE }
  }

  const matches =
    (code && safeEqualHex(sha256(code), user.resetOtpHash)) ||
    (token && safeEqualHex(sha256(token), user.resetTokenHash))

  if (!matches) {
    const attempts = (user.resetAttempts || 0) + 1
    if (attempts >= MAX_RESET_ATTEMPTS) {
      await users.updateOne({ _id: user._id }, { $unset: RESET_FIELDS_UNSET })
    } else {
      await users.updateOne({ _id: user._id }, { $set: { resetAttempts: attempts } })
    }
    return { ok: false, status: 400, error: INVALID_CODE_MESSAGE }
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: hashPassword(String(newPassword)), updatedAt: new Date(now) },
      // Burn the code and sign out existing sessions
      $unset: { ...RESET_FIELDS_UNSET, password: '', sessionToken: '' },
    }
  )

  return {
    ok: true,
    message: 'Password has been reset successfully. You can now log in with your new password.',
  }
}
