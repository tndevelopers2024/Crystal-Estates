/**
 * One-off migration: remove plain-text `password` fields from the `users` collection.
 *
 * Login no longer reads `user.password`; it only checks `passwordHash`. This script:
 *   - hashes `password` into `passwordHash` for users that have no passwordHash yet,
 *   - drops `password` where it agrees with the existing passwordHash,
 *   - reports (and skips) users whose `password` and `passwordHash` disagree,
 *   - warns about any user whose hash still matches a well-known default password
 *     (e.g. the old built-in admin123), so you can rotate it with seed:admin --reset-password.
 *
 * It is a dry run unless you pass --apply.
 *
 * Usage (from server/):
 *   npm run migrate:passwords            # dry run, prints what would change
 *   npm run migrate:passwords -- --apply # writes the changes
 */
import { getDb, closeDb } from '../src/config/db.js'
import { hashPassword, verifyPassword } from '../src/lib/password.js'

const apply = process.argv.includes('--apply')
const KNOWN_DEFAULTS = ['admin123', 'admin', 'password', '123456']

try {
  const db = await getDb()
  const users = db.collection('users')
  const all = await users.find({}, { projection: { email: 1, password: 1, passwordHash: 1 } }).toArray()

  let hashed = 0
  let cleared = 0
  let conflicts = 0
  let weak = 0

  for (const user of all) {
    const label = user.email || String(user._id)
    const hasPlain = typeof user.password === 'string' && user.password.length > 0
    let hash = user.passwordHash

    if (hasPlain && !hash) {
      hash = hashPassword(user.password)
      hashed++
      console.log(`[hash]     ${label}: plain-text password -> passwordHash`)
      if (apply) {
        await users.updateOne({ _id: user._id }, { $set: { passwordHash: hash }, $unset: { password: '' } })
      }
    } else if (hasPlain && verifyPassword(user.password, hash)) {
      cleared++
      console.log(`[clear]    ${label}: plain-text copy matches passwordHash, removing it`)
      if (apply) {
        await users.updateOne({ _id: user._id }, { $unset: { password: '' } })
      }
    } else if (hasPlain) {
      conflicts++
      console.log(`[conflict] ${label}: password and passwordHash disagree; skipped. Reset with seed:admin --reset-password.`)
    } else if (user.password !== undefined) {
      cleared++
      console.log(`[clear]    ${label}: empty password field, removing it`)
      if (apply) {
        await users.updateOne({ _id: user._id }, { $unset: { password: '' } })
      }
    }

    if (hash && KNOWN_DEFAULTS.some((candidate) => verifyPassword(candidate, hash))) {
      weak++
      console.log(`[WEAK]     ${label}: password is a well-known default. Rotate it now.`)
    }
  }

  console.log(
    `\n${apply ? 'Applied' : 'Dry run'}: ${all.length} users scanned, ${hashed} hashed, ${cleared} plain-text fields removed, ` +
      `${conflicts} conflicts skipped, ${weak} using a default password.`
  )
  if (!apply) console.log('Re-run with --apply to write these changes.')
} catch (err) {
  console.error('migrate_plaintext_passwords failed:', err.message)
  process.exitCode = 1
} finally {
  await closeDb()
}
