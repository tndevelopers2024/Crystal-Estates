import crypto from 'crypto'
import { getDb } from '../config/db.js'
import { roleFor, allows } from './roles.js'

/**
 * CRM sessions, account status and API permissions.
 *
 * Sessions: a random token is returned once at login; only its SHA-256 is
 * stored on the user (`sessions[]`, newest first, with an expiry). Signing out,
 * changing or resetting the password, or deactivating the account ends them.
 *
 * Every /api request goes through `apiPolicy`: public website endpoints pass;
 * everything else needs an active user whose role allows the section. The CRM
 * hides what a role can't use, but this is what actually enforces it.
 */

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SESSIONS = 5

export const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')

/** Read the CRM session token sent as `Authorization: Bearer <token>`. */
export function tokenFrom(req) {
  return String(req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim()
}

/** Accounts created before approvals existed have no status: they're active. */
export const statusOf = (user) => user?.status || 'active'

export const STATUS_MESSAGES = {
  pending: 'Your account is waiting for Super Admin approval. You will get an email once it is approved.',
  rejected: 'Your registration was not approved. Contact your administrator if you think this is a mistake.',
  deactivated: 'Your account has been deactivated. Contact your administrator to restore access.',
}

export async function createSession(users, user) {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  const live = (user.sessions || []).filter((s) => new Date(s.expiresAt).getTime() > now)
  const sessions = [{ hash: sha256(token), createdAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) }, ...live].slice(0, MAX_SESSIONS)
  await users.updateOne({ _id: user._id }, { $set: { sessions, lastLogin: new Date(now) }, $unset: { sessionToken: '' } })
  return token
}

export async function endSession(users, token) {
  if (!token) return
  await users.updateOne({ 'sessions.hash': sha256(token) }, { $pull: { sessions: { hash: sha256(token) } } })
}

async function userForToken(token) {
  if (!token || token.length < 32) return null
  const db = await getDb()
  const hash = sha256(token)
  const user = await db.collection('users').findOne(
    { 'sessions.hash': hash },
    { projection: { _id: 1, id: 1, name: 1, email: 1, role: 1, roleId: 1, status: 1, sessions: 1, initials: 1, color: 1 } },
  )
  if (!user) return null
  const s = user.sessions.find((x) => x.hash === hash)
  if (!s || new Date(s.expiresAt).getTime() <= Date.now()) return null
  if (statusOf(user) !== 'active') return null
  delete user.sessions
  return user
}

/** Public shape of a user for the CRM. */
export function publicUser(user, role) {
  return {
    id: user.id || String(user._id),
    name: user.name || user.email,
    email: user.email,
    role: role?.name || user.role || '',
    roleId: role?.id || user.roleId || null,
    status: statusOf(user),
    initials:
      user.initials ||
      String(user.name || user.email || '?')
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    color: user.color || '#0B57D0',
  }
}

/** Express middleware: only signed-in, active CRM users get through. */
export async function requireUser(req, res, next) {
  try {
    if (req.user) return next()
    const user = await userForToken(tokenFrom(req))
    if (!user) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', error: 'Please sign in to the CRM again.' })
    req.user = user
    req.role = await roleFor(user)
    return next()
  } catch {
    return res.status(503).json({ success: false, error: 'Could not verify your session. Please try again.' })
  }
}

export function requireSuperAdmin(req, res, next) {
  if (!req.role?.superAdmin) return res.status(403).json({ success: false, code: 'FORBIDDEN', error: 'Only a Super Admin can do this.' })
  return next()
}

/**
 * Who performed an action, for activity logs. Uses the signed-in user when a
 * token is sent, otherwise the `actor` the CRM put in the body, else "CRM user".
 */
export async function actorFromRequest(req) {
  try {
    const user = req.user || (await userForToken(tokenFrom(req)))
    if (user) return { name: user.name || user.email || 'CRM user', email: user.email || '' }
  } catch {
    /* fall through to the body actor */
  }
  const a = req.body?.actor
  return a && a.name ? { name: String(a.name).slice(0, 120), email: String(a.email || '').slice(0, 160) } : { name: 'CRM user', email: '' }
}

/* ───────── Access policy for every /api request ───────── */

const PUBLIC = 'public'
const ANY_USER = 'any-user'
const SUPER = 'super-admin'
const VIEW_ANY = (...sections) => ({ any: sections.map((s) => [s, 'view']) })
const EDIT_ANY = (...sections) => ({ any: sections.map((s) => [s, 'edit']) })

const LEAD_READERS = ['leads', 'followups', 'visits', 'customers', 'payments', 'documents', 'dashboard', 'reports', 'management']

/** Decide what a request needs. `p` is the path below /api. */
export function ruleFor(method, p) {
  const m = method.toUpperCase()
  const get = m === 'GET' || m === 'HEAD'

  // Website (public) endpoints
  if (get && (p === '/health' || p === '/testimonials')) return PUBLIC
  if (m === 'POST' && p === '/enquiry') return PUBLIC
  if (/^\/auth\/(login|register|forgot-password|reset-password|setup-password)$/.test(p)) return PUBLIC
  if (get && p === '/auth/roles') return PUBLIC
  if (get && /^\/plots(\/layouts|\/layout\/[^/]+|\/kolapakkam|\/[^/]+|\/[^/]+\/places)?\/?$/.test(p)) return PUBLIC
  if (m === 'POST' && p === '/visits') return PUBLIC // site-visit popup on the website
  if (get && /^\/documents\/[^/]+\/view$/.test(p)) return PUBLIC // token-protected share link

  // Signed-in user, any role
  if (/^\/auth\/(me|logout|change-password)$/.test(p)) return ANY_USER
  if (get && p === '/leads/meta') return ANY_USER
  if (p.startsWith('/crm-options')) return get ? ANY_USER : { anyEdit: true }

  // Super Admin only
  if (p.startsWith('/users') || p.startsWith('/roles')) return SUPER

  // Payments
  if (p.startsWith('/leads/payments')) return get ? VIEW_ANY('payments') : EDIT_ANY('payments')
  if (m === 'POST' && /^\/leads\/[^/]+\/payments$/.test(p)) return EDIT_ANY('payments', 'leads')

  // Leads, follow-ups and visits
  if (p.startsWith('/leads')) return get ? VIEW_ANY(...LEAD_READERS) : EDIT_ANY('leads', 'followups', 'visits')
  if (p.startsWith('/visits')) return get ? VIEW_ANY('visits', 'leads', 'followups', 'dashboard') : EDIT_ANY('visits', 'leads', 'followups')

  if (p.startsWith('/customers')) return get ? VIEW_ANY('customers', 'payments', 'documents') : EDIT_ANY('customers')

  // Properties, plots, layouts, nearby places
  if (p.startsWith('/plot-activity')) return get ? VIEW_ANY('properties', 'payments') : EDIT_ANY('properties', 'payments')
  if (p.startsWith('/plots')) return get ? VIEW_ANY('properties') : EDIT_ANY('properties')
  if (p.startsWith('/upload')) return get ? VIEW_ANY('properties') : EDIT_ANY('properties', 'documents')

  if (p.startsWith('/documents')) return get ? VIEW_ANY('documents') : EDIT_ANY('documents')

  return SUPER // anything not listed is closed by default
}

export async function apiPolicy(req, res, next) {
  const rule = ruleFor(req.method, req.path)
  if (rule === PUBLIC || req.method === 'OPTIONS') return next()
  return requireUser(req, res, () => {
    const role = req.role
    let ok = false
    if (rule === ANY_USER) ok = true
    else if (rule === SUPER) ok = Boolean(role?.superAdmin)
    else if (rule.anyEdit) ok = Boolean(role?.superAdmin) || Object.values(role?.permissions || {}).includes('edit')
    else if (rule.any) ok = rule.any.some(([section, level]) => allows(role, section, level))
    if (!ok) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', error: "Your role doesn't allow this action." })
    }
    return next()
  })
}

/* ───────── Simple in-memory rate limit for sign-in style endpoints ───────── */
const hits = new Map()
export function rateLimit({ windowMs = 10 * 60 * 1000, max = 20, key = 'default' } = {}) {
  return (req, res, next) => {
    const id = `${key}:${req.ip}`
    const now = Date.now()
    const entry = hits.get(id)
    if (!entry || now - entry.start > windowMs) {
      hits.set(id, { start: now, count: 1 })
      return next()
    }
    entry.count += 1
    if (entry.count > max) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please wait a few minutes and try again.' })
    }
    return next()
  }
}
