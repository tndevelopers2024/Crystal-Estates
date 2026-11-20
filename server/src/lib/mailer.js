import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'

/**
 * Outgoing CRM email (account approval, password setup, password reset).
 *
 * Production: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM
 * (any SMTP provider: Gmail app password, Zoho, SES, SendGrid, Brevo…).
 *
 * Local development / automated tests only: set MAIL_OUTBOX_DIR to write each
 * message as a JSON file instead of sending it. Ignored when NODE_ENV=production.
 *
 * Messages never contain passwords — only one-time links and codes.
 */

let transport = null

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM)
}

function outboxDir() {
  if (process.env.NODE_ENV === 'production') return null
  return process.env.MAIL_OUTBOX_DIR ? path.resolve(process.env.MAIL_OUTBOX_DIR) : null
}

export function mailConfigured() {
  return smtpConfigured() || Boolean(outboxDir())
}

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  }
  return transport
}

/** Throws when no delivery channel is configured or the provider rejects the message. */
export async function sendMail({ to, subject, text, html, tag }) {
  const dir = outboxDir()
  if (dir && !smtpConfigured()) {
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`)
    fs.writeFileSync(file, JSON.stringify({ to, subject, text, html, tag, at: new Date().toISOString() }, null, 2))
    return { delivered: true, channel: 'outbox' }
  }
  if (!smtpConfigured()) {
    throw new Error('Email is not configured on the server (set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM).')
  }
  await getTransport().sendMail({ from: process.env.MAIL_FROM, to, subject, text, html })
  return { delivered: true, channel: 'smtp' }
}

/** Base URL of the CRM, used in links inside emails. */
export function crmUrl(pathname = '') {
  const base = String(process.env.CRM_URL || 'http://localhost:5173').replace(/\/$/, '')
  return `${base}${pathname}`
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:14px;border:1px solid #e5e7eb" cellpadding="0" cellspacing="0">
<tr><td style="padding:22px 28px;background:#0F3D2E;border-radius:14px 14px 0 0;color:#fff;font-weight:bold;font-size:16px">Crystal Estates CRM</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:20px;color:#111827">${esc(title)}</h1>
${bodyHtml}
<p style="margin:28px 0 0;font-size:12px;color:#6b7280">If you didn't expect this email, you can ignore it.</p>
</td></tr></table></td></tr></table></body></html>`
}

const button = (href, label) =>
  `<p style="margin:22px 0"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;background:#0F3D2E;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">${esc(label)}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all">Or open this link: ${esc(href)}</p>`

export function approvalEmail({ name, email, role, link, hours }) {
  const subject = 'Your Crystal Estates CRM account is approved'
  const text = `Hi ${name},

Your Crystal Estates CRM account has been approved.

Login email: ${email}
Role: ${role}

Set your password with this secure link (valid for ${hours} hours, single use):
${link}

After that, sign in at ${crmUrl('/login')}.`
  const html = layout(
    'Your account is approved',
    `<p>Hi ${esc(name)},</p>
<p>Your Crystal Estates CRM account has been approved.</p>
<table role="presentation" style="font-size:14px;margin:10px 0"><tr><td style="color:#6b7280;padding-right:12px">Login email</td><td><b>${esc(email)}</b></td></tr>
<tr><td style="color:#6b7280;padding-right:12px">Role</td><td><b>${esc(role)}</b></td></tr></table>
<p>Create your password with this secure link. It works once and expires in ${hours} hours.</p>
${button(link, 'Set your password')}`,
  )
  return { subject, text, html }
}

export function resetEmail({ name, otp, minutes }) {
  const subject = 'Your Crystal Estates CRM password reset code'
  const text = `Hi ${name || ''},

Your password reset code is: ${otp}
It expires in ${minutes} minutes. Enter it on the CRM "Forgot password" page.`
  const html = layout(
    'Password reset code',
    `<p>Hi ${esc(name || '')},</p>
<p>Use this code on the CRM <b>Forgot password</b> page. It expires in ${minutes} minutes.</p>
<p style="font-size:30px;letter-spacing:6px;font-weight:bold;color:#0F3D2E;margin:18px 0">${esc(otp)}</p>`,
  )
  return { subject, text, html }
}

export function newRegistrationEmail({ name, email, role }) {
  const subject = 'New CRM account waiting for approval'
  const text = `${name} (${email}) registered as ${role} and is waiting for approval.\nReview it in Team & roles: ${crmUrl('/team')}`
  const html = layout(
    'New account waiting for approval',
    `<p><b>${esc(name)}</b> (${esc(email)}) registered as <b>${esc(role)}</b>.</p>${button(crmUrl('/team'), 'Review in Team & roles')}`,
  )
  return { subject, text, html }
}
