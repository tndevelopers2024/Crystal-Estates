import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCircle2, KeyRound, LogOut, ListChecks, Plus, X, Loader2, Eye, EyeOff, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../context/DialogContext'
import { useOptions } from '../../hooks/useOptions'
import { Card, Badge, btnGhost, btnPrimary, inputCls, labelCls } from '../common/PageKit'
import { passwordProblem, PASSWORD_HINT } from '../auth/AuthShell'

/* Lists used by CRM forms (stored on the server, editable here and inline in the forms) */
const LISTS = [
  { id: 'paymentFor', label: 'Payment types', hint: 'Payments page and Record payment', fallback: ['Token advance', 'Booking advance', 'Part payment', 'Full payment', 'Registration advance'] },
  { id: 'paymentMode', label: 'Payment modes', hint: 'How customers paid', fallback: ['UPI', 'Bank Transfer / RTGS / NEFT', 'Cheque', 'Cash', 'Credit / Debit Card'] },
  { id: 'documentType', label: 'Document types', hint: 'Documents you share with customers', fallback: [] },
  { id: 'placeCategory', label: 'Nearby place categories', hint: "Markers on the website's 3D layout", fallback: [] },
]

function Secret({ id, label, value, onChange, autoComplete, hint }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} className={`${inputCls} pr-10`} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function ChangePassword({ onShowToast }) {
  const { changePassword } = useAuth()
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!f.current) return setError('Enter your current password.')
    const weak = passwordProblem(f.next)
    if (weak) return setError(weak)
    if (f.next !== f.confirm) return setError('The new passwords do not match.')
    setSaving(true)
    try {
      const res = await changePassword(f.current, f.next)
      setF({ current: '', next: '', confirm: '' })
      onShowToast?.(res.message || 'Password changed', 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Change password" subtitle="Other devices are signed out after a change">
      <form onSubmit={submit} className="space-y-4 max-w-md" noValidate>
        {error && (
          <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {error}
          </p>
        )}
        <Secret id="cp-current" label="Current password" value={f.current} onChange={set('current')} autoComplete="current-password" />
        <Secret id="cp-new" label="New password" value={f.next} onChange={set('next')} autoComplete="new-password" hint={PASSWORD_HINT} />
        <Secret id="cp-confirm" label="Confirm new password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Update password
        </button>
      </form>
    </Card>
  )
}

function OptionList({ list, canEdit }) {
  const { options, add, remove, loading, error } = useOptions(list.id, list.fallback)
  const { confirm } = useDialog()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    setBusy(true)
    setMsg(null)
    try {
      await add(v)
      setValue('')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  const drop = async (opt) => {
    const ok = await confirm({ title: 'Remove option', message: `Remove “${opt}” from ${list.label.toLowerCase()}? Existing records keep their value.`, confirmText: 'Remove', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      await remove(opt)
    } catch (err) {
      setMsg(err.message)
    }
  }

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-slate-800">{list.label}</p>
        <span className="text-[10.5px] text-slate-400">{loading ? 'Loading…' : `${options.length} options`}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5">{list.hint}</p>
      {(error || msg) && <p className="mt-2 text-[11px] text-rose-600">{msg || error}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <span key={o} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
            {o}
            {canEdit && (
              <button type="button" onClick={() => drop(o)} className="p-0.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Remove ${o}`}>
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!loading && options.length === 0 && <span className="text-[11px] text-slate-400">No options yet</span>}
      </div>
      {canEdit && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input className={`${inputCls} !py-2 !text-xs`} placeholder="Add an option" value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} aria-label={`Add to ${list.label}`} />
          <button type="submit" className={btnGhost} disabled={busy || !value.trim()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
          </button>
        </form>
      )}
    </div>
  )
}

export default function SettingsView({ onShowToast }) {
  const { user, logout, can, isSuperAdmin, permissions } = useAuth()
  const navigate = useNavigate()
  const canEditLists = isSuperAdmin || Object.values(permissions || {}).includes('edit')
  const access = Object.entries(permissions || {}).filter(([, v]) => v !== 'none')

  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card title="Your profile" subtitle="Account details used across the CRM" className="xl:col-span-1">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full text-white text-sm font-bold grid place-items-center shrink-0" style={{ background: user?.color || '#0F3D2E' }}>
              {user?.initials || <UserCircle2 className="w-6 h-6" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-400 font-medium">Role</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{user?.role || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Status</dt>
              <dd className="mt-0.5">
                <Badge tone="green">Active</Badge>
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <p className="text-[11px] text-slate-400 font-medium mb-1.5">Your access</p>
            <div className="flex flex-wrap gap-1.5">
              {isSuperAdmin ? (
                <Badge tone="violet">Everything</Badge>
              ) : access.length ? (
                access.map(([k, v]) => (
                  <Badge key={k} tone={v === 'edit' ? 'green' : 'slate'}>
                    {k} · {v}
                  </Badge>
                ))
              ) : (
                <span className="text-[11px] text-slate-400">No sections</span>
              )}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Only a Super Admin can change roles and access.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {isSuperAdmin && (
              <button type="button" className={btnGhost} onClick={() => navigate('/team')}>
                <Check className="w-3.5 h-3.5" /> Team & roles
              </button>
            )}
            <button
              type="button"
              className={btnGhost}
              onClick={async () => {
                await logout()
                navigate('/login', { replace: true })
              }}
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </Card>
        <div className="xl:col-span-2">
          <ChangePassword onShowToast={onShowToast} />
        </div>
      </div>

      <Card
        title={
          <span className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#0F3D2E]" /> Dropdown lists
          </span>
        }
        subtitle={canEditLists ? 'Options offered in CRM forms. Changes apply everywhere immediately.' : 'Options offered in CRM forms (view only for your role).'}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {LISTS.filter((l) => l.id !== 'placeCategory' || can('properties')).map((l) => (
            <OptionList key={l.id} list={l} canEdit={canEditLists} />
          ))}
        </div>
      </Card>
    </div>
  )
}
