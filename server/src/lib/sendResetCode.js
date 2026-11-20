import { sendMail, resetEmail } from './mailer.js'

/**
 * Delivers a CRM password-reset code by email (see lib/mailer.js for setup).
 * Throws when email isn't configured; the forgot-password route logs that
 * server-side and still returns its generic message.
 *
 * @param {{ to: string, name?: string, otp: string, resetToken: string, expiresAt: Date }} payload
 */
export async function sendResetCode({ to, name, otp, expiresAt }) {
  const minutes = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000))
  const { subject, text, html } = resetEmail({ name, otp, minutes })
  await sendMail({ to, subject, text, html, tag: 'password-reset' })
}
