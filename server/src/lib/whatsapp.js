/**
 * WhatsApp Business (Meta WhatsApp Cloud API) for sending documents.
 *
 * Configure on the server:
 *   WHATSAPP_TOKEN            permanent access token of the system user
 *   WHATSAPP_PHONE_NUMBER_ID  the sender's phone number id (not the number itself)
 *   WHATSAPP_API_VERSION      optional, default v21.0
 *
 * Business-initiated messages (like a payment confirmation) need an approved
 * template unless the customer messaged you in the last 24 hours. Set:
 *   WHATSAPP_TEMPLATE_NAME    template with a DOCUMENT header and a body with
 *                             two variables: {{1}} customer name, {{2}} details
 *                             (e.g. "Plot 24, Somamangalam · Token advance ₹50,000")
 *   WHATSAPP_TEMPLATE_LANG    optional, default en
 *
 * Without a template, documents go as regular document messages, which
 * WhatsApp only accepts inside the 24-hour window; outside it the API answers
 * with error 131047 and the share is recorded as failed with that reason.
 *
 * Nothing here pretends to send: when the variables are missing the channel
 * reports "not configured", and a share counts as sent only when the API
 * returns a message id ("accepted by WhatsApp").
 */

const MAX_DOC_BYTES = 100 * 1024 * 1024 // WhatsApp document limit

export function whatsappConfig() {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  return {
    configured: Boolean(token && phoneId),
    template: process.env.WHATSAPP_TEMPLATE_NAME || null,
    lang: process.env.WHATSAPP_TEMPLATE_LANG || 'en',
    version: process.env.WHATSAPP_API_VERSION || 'v21.0',
    token,
    phoneId,
  }
}

/**
 * International format without "+": 10-digit Indian numbers get 91, a leading
 * 0 or 00 is dropped. Returns null when the result can't be a valid number.
 */
export function formatWhatsAppNumber(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) d = `91${d}`
  return d.length >= 11 && d.length <= 15 ? d : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** One API call with safe retries (network errors, 429 and 5xx only). */
async function post(cfg, body) {
  const url = `https://graph.facebook.com/${cfg.version}/${cfg.phoneId}/messages`
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.messages?.[0]?.id) return { id: data.messages[0].id, attempts: attempt }
      const e = data?.error || {}
      const err = new Error(explain(e, res.status))
      err.code = e.code
      err.retryable = res.status === 429 || res.status >= 500
      lastErr = err
      if (!err.retryable) break
    } catch (err) {
      // Connection failures are safe to retry. A timeout is not: WhatsApp may
      // already have accepted the message, and a retry could send it twice.
      const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError'
      lastErr = new Error(timedOut ? 'WhatsApp did not answer in time. Check WhatsApp before sending again.' : `Could not reach WhatsApp: ${err.message}`)
      lastErr.retryable = !timedOut
      if (timedOut) break
    }
    if (attempt < 3) await sleep(attempt * 1500)
  }
  lastErr.attempts = 3
  throw lastErr
}

function explain(e, status) {
  const code = e.code
  if (code === 131047) return 'Outside the 24-hour window: WhatsApp needs an approved template (set WHATSAPP_TEMPLATE_NAME).'
  if (code === 131026) return 'The number is not on WhatsApp or cannot receive messages.'
  if (code === 132001) return 'The WhatsApp template name or language is not approved.'
  if (code === 190 || status === 401) return 'The WhatsApp access token is invalid or expired.'
  if (code === 131053) return 'WhatsApp could not download the document from its link.'
  return e.error_user_msg || e.message || `WhatsApp API error (HTTP ${status})`
}

/**
 * Send documents to one number.
 * docs: [{ link (public https URL), filename, caption, size }]
 * templateParams: [customerName, details] for the template body
 * Returns { messageIds, attempts } or throws with a readable reason.
 */
export async function sendWhatsAppDocuments({ to, docs, intro, templateParams }) {
  const cfg = whatsappConfig()
  if (!cfg.configured) throw new Error('WhatsApp Business is not configured on the server (set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID).')
  const number = formatWhatsAppNumber(to)
  if (!number) throw new Error('The customer has no valid WhatsApp number on record.')
  for (const d of docs) {
    if (!/^https:\/\//i.test(d.link)) throw new Error('Documents need a public HTTPS address for WhatsApp (set PUBLIC_API_URL on the server).')
    if (d.size > MAX_DOC_BYTES) throw new Error(`“${d.filename}” is larger than WhatsApp's 100 MB limit.`)
  }

  const messageIds = []
  let attempts = 0
  for (const [i, d] of docs.entries()) {
    const body = cfg.template
      ? {
          messaging_product: 'whatsapp',
          to: number,
          type: 'template',
          template: {
            name: cfg.template,
            language: { code: cfg.lang },
            components: [
              { type: 'header', parameters: [{ type: 'document', document: { link: d.link, filename: d.filename } }] },
              { type: 'body', parameters: templateParams.map((t) => ({ type: 'text', text: String(t || '-').slice(0, 1000) })) },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: number,
          type: 'document',
          document: { link: d.link, filename: d.filename, caption: (i === 0 && intro ? `${intro}\n\n` : '') + (d.caption || '') },
        }
    const r = await post(cfg, body)
    messageIds.push(r.id)
    attempts = Math.max(attempts, r.attempts)
  }
  return { messageIds, attempts, number }
}
