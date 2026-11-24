import { getApiUrl } from './api'

/** Team & roles endpoints (Super Admin only on the server). Auth header is added by lib/authFetch. */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(getApiUrl(path), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (HTTP ${res.status})`)
  return data
}

export const fetchTeam = () => call('/api/users')
export const approveUser = (id, roleId) => call(`/api/users/${encodeURIComponent(id)}/approve`, { method: 'POST', body: { roleId } })
export const rejectUser = (id, reason) => call(`/api/users/${encodeURIComponent(id)}/reject`, { method: 'POST', body: { reason } })
export const deactivateUser = (id) => call(`/api/users/${encodeURIComponent(id)}/deactivate`, { method: 'POST', body: {} })
export const activateUser = (id) => call(`/api/users/${encodeURIComponent(id)}/activate`, { method: 'POST', body: {} })
export const changeUserRole = (id, roleId) => call(`/api/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: { roleId } })
export const resendSetupLink = (id) => call(`/api/users/${encodeURIComponent(id)}/resend-setup`, { method: 'POST', body: {} })
export const fetchRoles = () => call('/api/roles')
export const updateRole = (id, patch) => call(`/api/roles/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
