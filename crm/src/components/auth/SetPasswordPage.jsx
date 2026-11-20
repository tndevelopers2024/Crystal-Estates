import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getApiUrl } from '../../lib/api'
import { AuthShell, AuthAlert, PasswordField, PASSWORD_HINT, passwordProblem, authButtonCls } from './AuthShell'

/** Opened from the approval email: /set-password?token=… */
export default function SetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [state, setState] = useState({ loading: true, email: '', name: '', error: null })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    if (!token) {
      setState({ loading: false, error: 'This link is missing its security token. Open the link from your email again.' })
      return undefined
    }
    fetch(getApiUrl(`/api/auth/setup-password?token=${encodeURIComponent(token)}`))
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (!active) return
        setState(ok && d.success ? { loading: false, email: d.email, name: d.name, error: null } : { loading: false, error: d.error || 'This link is invalid or has expired.' })
      })
      .catch(() => active && setState({ loading: false, error: 'Could not check the link. Please try again.' }))
    return () => {
      active = false
    }
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const weak = passwordProblem(password)
    if (weak) return setError(weak)
    if (password !== confirm) return setError('The passwords do not match.')
    setSaving(true)
    try {
      const res = await fetch(getApiUrl('/api/auth/setup-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.success) throw new Error(d.error || 'Could not set the password')
      navigate('/login', { replace: true, state: { notice: { tone: 'green', text: 'Your password is set. Sign in with your email and new password.' } } })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthShell
      badge="Account Activation"
      title="Create Your Password"
      subtitle="Finalize your credentials to access the CRM workspace"
    >
      {state.loading ? (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking your link…
        </p>
      ) : state.error ? (
        <>
          <AuthAlert>{state.error}</AuthAlert>
          <Link to="/login" className="text-xs font-bold text-[#0F3D2E] hover:underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <AuthAlert>{error}</AuthAlert>}
          <p className="text-xs text-slate-600">
            Hi {state.name || 'there'} — set a password for <b>{state.email}</b>.
          </p>
          <PasswordField id="setup-password" label="New password" value={password} onChange={setPassword} hint={PASSWORD_HINT} />
          <PasswordField id="setup-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} />
          <button type="submit" disabled={saving} className={authButtonCls}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{saving ? 'Saving…' : 'Set password'}</span>
          </button>
        </form>
      )}
    </AuthShell>
  )
}
