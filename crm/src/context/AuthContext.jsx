import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getApiUrl, forgotPasswordUser, resetPasswordUser } from '../lib/api'
import { readToken, SESSION_ENDED_EVENT } from '../lib/authFetch'

const AuthContext = createContext(null)
const USER_KEY = 'ce_crm_user'
const TOKEN_KEY = 'ce_crm_token'
const ACCESS_KEY = 'ce_crm_access'
const RANK = { none: 0, view: 1, edit: 2 }

function load(key) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

async function post(path, body) {
  const res = await fetch(getApiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `Request failed (HTTP ${res.status})`)
    err.code = data.code
    err.status = res.status
    throw err
  }
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => load(USER_KEY))
  const [token, setToken] = useState(() => readToken() || null)
  // { permissions, superAdmin, home, sections }
  const [access, setAccess] = useState(() => load(ACCESS_KEY))
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(() => Boolean(readToken()))

  const clear = useCallback(() => {
    setUser(null)
    setToken(null)
    setAccess(null)
    save(USER_KEY, null)
    save(TOKEN_KEY, null)
    save(ACCESS_KEY, null)
  }, [])

  const apply = useCallback((data, newToken) => {
    const nextAccess = { permissions: data.permissions || {}, superAdmin: Boolean(data.superAdmin), home: data.home || '/account', sections: data.sections || [] }
    setUser(data.user)
    setAccess(nextAccess)
    save(USER_KEY, data.user)
    save(ACCESS_KEY, nextAccess)
    if (newToken) {
      setToken(newToken)
      save(TOKEN_KEY, newToken)
    }
  }, [])

  // lib/authFetch (installed in main.jsx) announces when the server ends the session
  useEffect(() => {
    window.addEventListener(SESSION_ENDED_EVENT, clear)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, clear)
  }, [clear])

  // Re-validate the saved session (and pick up role/permission changes) on load
  useEffect(() => {
    const t = readToken()
    if (!t) {
      setChecking(false)
      return
    }
    let active = true
    fetch(getApiUrl('/api/auth/me'), { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (res.ok && data.success) apply(data)
        else if (res.status === 401) clear()
      })
      .catch(() => {
        /* offline: keep the cached session until the server answers */
      })
      .finally(() => active && setChecking(false))
    return () => {
      active = false
    }
  }, [apply, clear])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const data = await post('/api/auth/login', { email, password })
      apply(data, data.token)
      return data
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      if (token) await post('/api/auth/logout')
    } catch {
      /* already signed out on the server */
    }
    clear()
  }

  const register = (payload) => post('/api/auth/register', payload)
  const changePassword = (currentPassword, newPassword) => post('/api/auth/change-password', { currentPassword, newPassword })
  const forgotPassword = (email) => forgotPasswordUser(email)
  const resetPassword = (payload) => resetPasswordUser(payload)

  const can = useCallback(
    (section, level = 'view') => {
      if (!access) return false
      if (access.superAdmin) return true
      return (RANK[access.permissions?.[section]] || 0) >= RANK[level]
    },
    [access],
  )

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token && access),
      checking,
      loading,
      isSuperAdmin: Boolean(access?.superAdmin),
      home: access?.home || '/account',
      permissions: access?.permissions || {},
      can,
      login,
      logout,
      register,
      changePassword,
      forgotPassword,
      resetPassword,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, access, checking, loading, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
