import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getApiUrl } from '../../lib/api'
import { AuthShell, AuthAlert, PasswordField, PASSWORD_HINT, passwordProblem, authInputCls, authLabelCls, authButtonCls } from './AuthShell'

export default function RegisterPage() {
  const { register } = useAuth()
  const [roles, setRoles] = useState([])
  const [rolesError, setRolesError] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', roleId: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  // Roles come from the server (Super Admin is never offered here)
  useEffect(() => {
    let active = true
    fetch(getApiUrl('/api/auth/roles'))
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        if (d.success) setRoles(d.roles || [])
        else setRolesError(d.error || 'Could not load roles')
      })
      .catch(() => active && setRolesError('Could not load roles. Check your connection and refresh.'))
    return () => {
      active = false
    }
  }, [])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))
  const selectedRole = roles.find((r) => r.id === form.roleId)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.name.trim().length < 2) return setError('Enter your full name.')
    if (!form.roleId) return setError('Choose your role.')
    const weak = passwordProblem(form.password)
    if (weak) return setError(weak)
    if (form.password !== form.confirm) return setError('The passwords do not match.')
    setSaving(true)
    try {
      const data = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, roleId: form.roleId })
      setDone(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <AuthShell
        badge="Request Submitted"
        title="Waiting for Approval"
        subtitle="Your request has been forwarded to the Super Admin"
      >
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-3.5 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Application Under Review</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">{done}</p>
          <div className="mt-6 pt-5 border-t border-slate-100">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F3D2E] hover:text-[#B8964E] hover:underline">
              Back to sign in <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      badge="Staff Onboarding"
      title="Create Staff Account"
      subtitle="Request access to the Crystal Estates CRM workspace"
      footer={
        <p className="mt-3 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-[#0F3D2E] hover:text-[#B8964E] hover:underline transition">
            Sign in
          </Link>
        </p>
      }
    >
      {error && <AuthAlert>{error}</AuthAlert>}
      {rolesError && <AuthAlert>{rolesError}</AuthAlert>}
      <form onSubmit={submit} className="space-y-2.5" noValidate>
        <div>
          <label htmlFor="reg-name" className={authLabelCls}>
            Full name
          </label>
          <input id="reg-name" className={authInputCls} value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
        </div>
        <div>
          <label htmlFor="reg-email" className={authLabelCls}>
            Work email
          </label>
          <input id="reg-email" type="email" className={authInputCls} value={form.email} onChange={set('email')} autoComplete="email" required />
        </div>
        <div>
          <label htmlFor="reg-role" className={authLabelCls}>
            Assigned Role
          </label>
          <select id="reg-role" className={authInputCls} value={form.roleId} onChange={set('roleId')} required disabled={!roles.length}>
            <option value="">{roles.length ? 'Choose your role' : 'Loading roles…'}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {selectedRole?.description && <p className="mt-1 text-[11px] text-slate-500 leading-tight">{selectedRole.description}</p>}
        </div>
        <PasswordField id="reg-password" label="Password" value={form.password} onChange={set('password')} hint={PASSWORD_HINT} />
        <PasswordField id="reg-confirm" label="Confirm password" value={form.confirm} onChange={set('confirm')} />
        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          A Super Admin reviews every new account. You can sign in once it is approved — we'll email you.
        </p>
        <button type="submit" disabled={saving} className={authButtonCls}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          <span>{saving ? 'Creating account…' : 'Submit Registration'}</span>
        </button>
      </form>
    </AuthShell>
  )
}
