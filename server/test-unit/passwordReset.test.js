/**
 * Unit tests for CRM password reset (forgot-password / reset-password logic).
 * Runs against a small in-memory stand-in for the users collection — never the real database.
 *   node --test test-unit
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GENERIC_FORGOT_MESSAGE,
  MAX_RESET_ATTEMPTS,
  RESET_TTL_MS,
  requestPasswordReset,
  resetPassword,
} from '../src/lib/passwordReset.js'
import { hashPassword, verifyPassword } from '../src/lib/password.js'

function makeUsers(seed) {
  const docs = seed.map((d) => structuredClone(d))
  const matches = (doc, q) =>
    Object.entries(q).every(([k, cond]) => {
      if (cond && cond.$regex) return typeof doc[k] === 'string' && cond.$regex.test(doc[k])
      return doc[k] === cond
    })
  return {
    docs,
    async findOne(q) {
      const d = docs.find((x) => matches(x, q))
      return d ? structuredClone(d) : null
    },
    async updateOne(q, u) {
      const d = docs.find((x) => matches(x, q))
      if (!d) return { matchedCount: 0 }
      Object.assign(d, u.$set || {})
      for (const k of Object.keys(u.$unset || {})) delete d[k]
      return { matchedCount: 1 }
    },
  }
}

const seedUser = () => ({
  _id: 'u1',
  email: 'Admin@Crystal.test',
  name: 'Admin',
  passwordHash: hashPassword('old-password'),
  sessionToken: 'token-old',
})

function captureSender() {
  const sent = []
  return { sent, send: async (payload) => { sent.push(payload) } }
}

test('forgot-password never returns the code and is identical for unknown emails', async () => {
  const users = makeUsers([seedUser()])
  const { sent, send } = captureSender()

  const known = await requestPasswordReset(users, 'admin@crystal.test', send)
  const unknown = await requestPasswordReset(users, 'nobody@crystal.test', send)

  assert.deepEqual(known, { ok: true, message: GENERIC_FORGOT_MESSAGE })
  assert.deepEqual(unknown, known)
  assert.equal(sent.length, 1, 'code delivered only for the real account')
  assert.match(sent[0].otp, /^\d{6}$/)
  assert.ok(!JSON.stringify(known).includes(sent[0].otp))

  // Only hashes are stored, never the plaintext code
  const stored = users.docs[0]
  assert.equal(stored.resetOtp, undefined)
  assert.equal(stored.resetToken, undefined)
  assert.ok(!JSON.stringify(stored).includes(sent[0].otp))
})

test('delivery failure still returns the generic message', async () => {
  const users = makeUsers([seedUser()])
  const res = await requestPasswordReset(users, 'admin@crystal.test', async () => {
    throw new Error('no provider')
  })
  assert.deepEqual(res, { ok: true, message: GENERIC_FORGOT_MESSAGE })
})

test('reset-password requires a code', async () => {
  const users = makeUsers([seedUser()])
  await requestPasswordReset(users, 'admin@crystal.test', async () => {})
  const res = await resetPassword(users, { email: 'admin@crystal.test', newPassword: 'new-passw0rd' })
  assert.equal(res.ok, false)
  assert.ok(verifyPassword('old-password', users.docs[0].passwordHash))
})

test('reset-password fails when no reset was requested', async () => {
  const users = makeUsers([seedUser()])
  const res = await resetPassword(users, { email: 'admin@crystal.test', otp: '123456', newPassword: 'new-passw0rd' })
  assert.equal(res.ok, false)
  assert.ok(verifyPassword('old-password', users.docs[0].passwordHash))
})

test('reset-password rejects a wrong code and an expired code', async () => {
  const users = makeUsers([seedUser()])
  const { sent, send } = captureSender()
  const t0 = Date.now()
  await requestPasswordReset(users, 'admin@crystal.test', send, { now: t0 })
  const otp = sent[0].otp
  const wrong = otp === '000000' ? '000001' : '000000'

  const bad = await resetPassword(users, { email: 'admin@crystal.test', otp: wrong, newPassword: 'new-passw0rd' }, { now: t0 })
  assert.equal(bad.ok, false)

  const expired = await resetPassword(
    users,
    { email: 'admin@crystal.test', otp, newPassword: 'new-passw0rd' },
    { now: t0 + RESET_TTL_MS + 1 }
  )
  assert.equal(expired.ok, false)
  assert.ok(verifyPassword('old-password', users.docs[0].passwordHash))
})

test('valid code resets the password once, then is burned', async () => {
  const users = makeUsers([seedUser()])
  const { sent, send } = captureSender()
  await requestPasswordReset(users, 'ADMIN@crystal.test', send)
  const { otp } = sent[0]

  const ok = await resetPassword(users, { email: 'admin@crystal.test', otp, newPassword: 'new-passw0rd' })
  assert.equal(ok.ok, true)
  const stored = users.docs[0]
  assert.ok(verifyPassword('new-passw0rd', stored.passwordHash))
  assert.equal(stored.resetOtpHash, undefined)
  assert.equal(stored.resetExpiresAt, undefined)
  assert.equal(stored.sessionToken, undefined, 'existing sessions are signed out')

  const replay = await resetPassword(users, { email: 'admin@crystal.test', otp, newPassword: 'another-pass' })
  assert.equal(replay.ok, false)
  assert.ok(verifyPassword('new-passw0rd', users.docs[0].passwordHash))
})

test('the reset token also works in place of the OTP', async () => {
  const users = makeUsers([seedUser()])
  const { sent, send } = captureSender()
  await requestPasswordReset(users, 'admin@crystal.test', send)
  const res = await resetPassword(users, {
    email: 'admin@crystal.test',
    resetToken: sent[0].resetToken,
    newPassword: 'new-passw0rd',
  })
  assert.equal(res.ok, true)
})

test('too many wrong guesses burn the code', async () => {
  const users = makeUsers([seedUser()])
  const { sent, send } = captureSender()
  await requestPasswordReset(users, 'admin@crystal.test', send)
  const { otp } = sent[0]
  const wrong = otp === '000000' ? '000001' : '000000'

  for (let i = 0; i < MAX_RESET_ATTEMPTS; i++) {
    await resetPassword(users, { email: 'admin@crystal.test', otp: wrong, newPassword: 'new-passw0rd' })
  }
  const res = await resetPassword(users, { email: 'admin@crystal.test', otp, newPassword: 'new-passw0rd' })
  assert.equal(res.ok, false)
  assert.ok(verifyPassword('old-password', users.docs[0].passwordHash))
})
