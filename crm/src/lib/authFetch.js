import { getApiUrl } from './api'

/**
 * Sends the CRM session token with every request to our API, wherever in the
 * app `fetch` is called, and signs the user out when the server says the
 * session is gone (expired, signed out elsewhere, or account deactivated).
 *
 * Only requests to the CRM API origin are touched; anything else passes through.
 */
const TOKEN_KEY = 'ce_crm_token'
let installed = false

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export const SESSION_ENDED_EVENT = 'crm-session-ended'
const announceSessionEnded = () => window.dispatchEvent(new Event(SESSION_ENDED_EVENT))

/** Call once at startup, before the app renders. */
export function installAuthFetch(onSessionEnded = announceSessionEnded) {
  if (installed || typeof window === 'undefined') return
  installed = true
  const apiBase = getApiUrl('/api/')
  const original = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (!url.startsWith(apiBase)) return original(input, init)

    const token = readToken()
    let nextInit = init
    if (token) {
      const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {})
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
      nextInit = { ...init, headers }
    }

    const res = await original(input, nextInit)
    if (res.status === 401 && token && !/\/api\/auth\/(login|register|setup-password|forgot-password|reset-password)$/.test(url)) {
      const body = await res.clone().json().catch(() => ({}))
      if (body?.code === 'AUTH_REQUIRED') onSessionEnded?.()
    }
    return res
  }
}
