import { getDb } from '../config/db.js'

/**
 * CRM roles and permissions.
 *
 * SECTIONS mirrors the CRM's navigation (it is part of the app's structure).
 * Roles themselves live in the `crm_roles` collection, so the Super Admin can
 * change what each role may do. Each permission is 'none' | 'view' | 'edit'.
 *
 * The collection is seeded once with STARTER_ROLES when it is empty; after
 * that the database is the only source of truth.
 */

export const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'leads', label: 'Leads pipeline', path: '/leads' },
  { id: 'customers', label: 'Customers', path: '/customers' },
  { id: 'followups', label: 'Follow-ups', path: '/followups' },
  { id: 'visits', label: 'Site visits', path: '/visits' },
  { id: 'management', label: 'Management', path: '/management' },
  { id: 'reports', label: 'Reports', path: '/reports' },
  { id: 'properties', label: 'Properties', path: '/properties' },
  { id: 'payments', label: 'Payments', path: '/payments' },
  { id: 'documents', label: 'Documents', path: '/documents' },
  { id: 'whatsapp', label: 'WhatsApp', path: '/whatsapp' },
  { id: 'vendors', label: 'Vendors & landowners', path: '/vendors' },
  { id: 'landrecords', label: 'Land records', path: '/landrecords' },
  { id: 'settings', label: 'Settings', path: '/settings' },
]
export const SECTION_IDS = SECTIONS.map((s) => s.id)
export const LEVELS = ['none', 'view', 'edit']
const RANK = { none: 0, view: 1, edit: 2 }

const all = (level) => Object.fromEntries(SECTION_IDS.map((id) => [id, level]))
const only = (map) => ({ ...all('none'), ...map })

/** First-run roles (approved by the business owner); editable afterwards in Team & roles. */
const STARTER_ROLES = [
  {
    id: 'super-admin',
    name: 'Super Admin',
    superAdmin: true,
    selfRegister: false,
    home: '/dashboard',
    description: 'Full access, including user approval and role management.',
    permissions: all('edit'),
  },
  {
    id: 'admin',
    name: 'Admin',
    selfRegister: true,
    home: '/dashboard',
    description: 'Everything except user and role management.',
    permissions: all('edit'),
  },
  {
    id: 'sales-manager',
    name: 'Sales Manager',
    selfRegister: true,
    home: '/leads',
    description: 'Runs the sales team: leads, follow-ups, visits, properties, payments, documents and reports.',
    permissions: only({
      dashboard: 'view',
      leads: 'edit',
      customers: 'edit',
      followups: 'edit',
      visits: 'edit',
      reports: 'view',
      management: 'view',
      properties: 'edit',
      payments: 'edit',
      documents: 'edit',
      whatsapp: 'edit',
    }),
  },
  {
    id: 'sales-executive',
    name: 'Sales Executive',
    selfRegister: true,
    home: '/leads',
    description: 'Works leads, follow-ups and site visits; can view properties.',
    permissions: only({ leads: 'edit', followups: 'edit', visits: 'edit', properties: 'view', whatsapp: 'edit' }),
  },
  {
    id: 'accounts',
    name: 'Accounts',
    selfRegister: true,
    home: '/payments',
    description: 'Payments, documents and customer records.',
    permissions: only({ payments: 'edit', documents: 'edit', customers: 'edit', properties: 'view', reports: 'view' }),
  },
]

export async function ensureRoles() {
  const db = await getDb()
  const col = db.collection('crm_roles')
  if ((await col.estimatedDocumentCount()) > 0) return
  const now = new Date()
  await col.insertMany(STARTER_ROLES.map((r) => ({ ...r, system: true, createdAt: now, updatedAt: now })))
  console.log(`Seeded ${STARTER_ROLES.length} CRM roles`)
}

let cache = { at: 0, roles: null }
const CACHE_MS = 15000

export async function listRoles({ fresh = false } = {}) {
  if (!fresh && cache.roles && Date.now() - cache.at < CACHE_MS) return cache.roles
  const db = await getDb()
  const roles = await db.collection('crm_roles').find({}, { projection: { _id: 0 } }).sort({ superAdmin: -1, name: 1 }).toArray()
  cache = { at: Date.now(), roles }
  return roles
}

export function clearRoleCache() {
  cache = { at: 0, roles: null }
}

/** Users store the role name (as the CRM always has); match it case-insensitively. */
export async function roleFor(user) {
  if (!user) return null
  const roles = await listRoles()
  const name = String(user.role || '').trim().toLowerCase()
  return roles.find((r) => r.id === user.roleId) || roles.find((r) => r.name.toLowerCase() === name) || null
}

export function permissionsOf(role) {
  if (!role) return all('none')
  if (role.superAdmin) return all('edit')
  return { ...all('none'), ...(role.permissions || {}) }
}

export function allows(role, section, level = 'view') {
  if (!role) return false
  if (role.superAdmin) return true
  return RANK[permissionsOf(role)[section] || 'none'] >= RANK[level]
}

export function homeFor(role) {
  const perms = permissionsOf(role)
  if (role?.home && SECTIONS.some((s) => s.path === role.home && RANK[perms[s.id]] > 0)) return role.home
  const first = SECTIONS.find((s) => RANK[perms[s.id]] > 0)
  return first ? first.path : '/account'
}

export function cleanPermissions(input) {
  const out = all('none')
  for (const id of SECTION_IDS) {
    const v = input?.[id]
    if (LEVELS.includes(v)) out[id] = v
  }
  return out
}
