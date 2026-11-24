import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { UserCheck, ShieldCheck, Search, Check, X, Mail, Power, RotateCcw, Loader2, Save, Lock, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../context/DialogContext'
import { Card, StatCard, EmptyState, LoadingBlock, ErrorBlock, Badge, btnGhost, btnPrimary, inputCls } from '../common/PageKit'
import { fetchTeam, approveUser, rejectUser, deactivateUser, activateUser, changeUserRole, resendSetupLink, fetchRoles, updateRole } from '../../lib/teamApi'
import { fmtDate } from '../../lib/analytics'

const STATUS = {
  pending: { label: 'Pending approval', tone: 'amber' },
  active: { label: 'Active', tone: 'green' },
  deactivated: { label: 'Deactivated', tone: 'slate' },
  rejected: { label: 'Rejected', tone: 'rose' },
}
const FILTERS = ['all', 'pending', 'active', 'deactivated', 'rejected']
const LEVELS = [
  { id: 'none', label: 'No access' },
  { id: 'view', label: 'View' },
  { id: 'edit', label: 'Edit' },
]

/* ───────── Users ───────── */
function UsersTab({ onShowToast }) {
  const { user: me } = useAuth()
  const { confirm } = useDialog()
  const [data, setData] = useState({ users: [], roles: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)
  const [approveRole, setApproveRole] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchTeam())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const replace = (u) => setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? u : x)) }))
  const run = async (u, fn, success) => {
    setBusy(u.id)
    try {
      const res = await fn()
      if (res.user) replace(res.user)
      if (res.emailSent === false) onShowToast?.(res.emailError || 'Saved, but the email could not be sent.', 'error')
      else onShowToast?.(success, 'success')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const counts = useMemo(() => {
    const c = { all: data.users.length }
    for (const u of data.users) c[u.status] = (c[u.status] || 0) + 1
    return c
  }, [data.users])

  const shown = data.users.filter(
    (u) => (filter === 'all' || u.status === filter) && (!q.trim() || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q.trim().toLowerCase())),
  )
  const roleOptions = data.roles

  const approve = async (u) => {
    const roleId = approveRole[u.id] || u.roleId || roleOptions.find((r) => !r.superAdmin)?.id
    const role = roleOptions.find((r) => r.id === roleId)
    const ok = await confirm({
      title: 'Approve account',
      message: `Approve ${u.name} as ${role?.name || 'the selected role'}? They'll get an email with a secure link to set their password.`,
      tag: u.email,
      confirmText: 'Approve',
      cancelText: 'Cancel',
    })
    if (ok) run(u, () => approveUser(u.id, roleId), `${u.name} approved — setup email sent`)
  }
  const reject = async (u) => {
    const ok = await confirm({ title: 'Reject registration', message: `Reject ${u.name}'s request? They won't be able to sign in.`, tag: u.email, confirmText: 'Reject', cancelText: 'Cancel', type: 'danger' })
    if (ok) run(u, () => rejectUser(u.id, ''), `${u.name}'s registration rejected`)
  }
  const deactivate = async (u) => {
    const ok = await confirm({ title: 'Deactivate account', message: `${u.name} will be signed out everywhere and can't sign in until re-activated.`, tag: u.email, confirmText: 'Deactivate', cancelText: 'Cancel', type: 'danger' })
    if (ok) run(u, () => deactivateUser(u.id), `${u.name} deactivated`)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Team members" value={counts.all || 0} icon={Users} onClick={() => setFilter('all')} />
        <StatCard label="Waiting for approval" value={counts.pending || 0} icon={UserCheck} tone="gold" onClick={() => setFilter('pending')} />
        <StatCard label="Active" value={counts.active || 0} icon={ShieldCheck} tone="green" onClick={() => setFilter('active')} />
        <StatCard label="Deactivated / rejected" value={(counts.deactivated || 0) + (counts.rejected || 0)} icon={Power} tone="slate" onClick={() => setFilter('deactivated')} />
      </div>

      <Card
        title="Users"
        subtitle="Approve new registrations and manage access"
        bodyClassName="p-0"
        actions={
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className={`${inputCls} !py-2 !text-xs pl-8 w-40 sm:w-56`} placeholder="Search name, email, role" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
          </div>
        }
      >
        <div className="px-5 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-100" role="tablist" aria-label="Status">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap transition ${
                filter === f ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0F3D2E]'
              }`}
            >
              {f === 'all' ? 'All' : STATUS[f].label} <span className="opacity-70">{counts[f] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingBlock rows={4} />
        ) : error ? (
          <ErrorBlock message={error} onRetry={load} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Users} title={filter === 'pending' ? 'No registrations waiting' : 'No users match'} text={filter === 'pending' ? 'New sign-ups from the register page appear here for approval.' : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((u) => {
              const self = u.id === me?.id || u.email === me?.email
              const st = STATUS[u.status] || STATUS.active
              const working = busy === u.id
              return (
                <li key={u.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-9 h-9 rounded-full text-white text-xs font-bold grid place-items-center shrink-0" style={{ background: u.color || '#0F3D2E' }}>
                      {u.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {u.name} {self && <span className="text-[10px] font-semibold text-slate-400">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5">
                        Joined {fmtDate(u.createdAt)}
                        {u.lastLogin ? ` · last sign-in ${fmtDate(u.lastLogin)}` : ''}
                        {u.setupPending ? ' · password setup link sent' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <select
                      className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0F3D2E] disabled:bg-slate-50 disabled:text-slate-400"
                      aria-label={`Role for ${u.name}`}
                      value={u.status === 'pending' ? approveRole[u.id] || u.roleId || '' : u.roleId || ''}
                      disabled={self || working}
                      onChange={(e) => {
                        const roleId = e.target.value
                        if (u.status === 'pending') setApproveRole((m) => ({ ...m, [u.id]: roleId }))
                        else run(u, () => changeUserRole(u.id, roleId), `${u.name}'s role updated`)
                      }}
                    >
                      {!u.roleValid && <option value="">{u.role || 'No role'}</option>}
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>

                    {working && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    {!self && u.status === 'pending' && (
                      <>
                        <button type="button" className={btnPrimary} onClick={() => approve(u)} disabled={working}>
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button type="button" className={btnGhost} onClick={() => reject(u)} disabled={working}>
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                    {!self && u.status === 'rejected' && (
                      <button type="button" className={btnGhost} onClick={() => approve(u)} disabled={working}>
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {!self && u.status === 'active' && (
                      <>
                        <button type="button" className={btnGhost} onClick={() => run(u, () => resendSetupLink(u.id), `Setup link sent to ${u.email}`)} disabled={working} title="Email a new password setup link">
                          <Mail className="w-3.5 h-3.5" /> Setup link
                        </button>
                        <button type="button" className={btnGhost} onClick={() => deactivate(u)} disabled={working}>
                          <Power className="w-3.5 h-3.5" /> Deactivate
                        </button>
                      </>
                    )}
                    {!self && u.status === 'deactivated' && (
                      <button type="button" className={btnGhost} onClick={() => run(u, () => activateUser(u.id), `${u.name} re-activated`)} disabled={working}>
                        <RotateCcw className="w-3.5 h-3.5" /> Re-activate
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* ───────── Roles ───────── */
function RolesTab({ onShowToast }) {
  const [state, setState] = useState({ roles: [], sections: [] })
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchRoles()
      setState({ roles: d.roles || [], sections: d.sections || [] })
      setDrafts({})
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const draftOf = (r) => drafts[r.id] || { permissions: { ...(r.permissions || {}) }, selfRegister: Boolean(r.selfRegister), home: r.home || '' }
  const setDraft = (r, patch) => setDrafts((d) => ({ ...d, [r.id]: { ...draftOf(r), ...patch } }))

  const save = async (r) => {
    setSaving(r.id)
    try {
      const res = await updateRole(r.id, draftOf(r))
      setState((s) => ({ ...s, roles: s.roles.map((x) => (x.id === r.id ? res.role : x)) }))
      setDrafts((d) => {
        const next = { ...d }
        delete next[r.id]
        return next
      })
      onShowToast?.(`${r.name} permissions saved`, 'success')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <Card><LoadingBlock rows={5} /></Card>
  if (error) return <Card><ErrorBlock message={error} onRetry={load} /></Card>

  return (
    <div className="space-y-5">
      {state.roles.map((r) => {
        const d = draftOf(r)
        const dirty = Boolean(drafts[r.id])
        return (
          <Card
            key={r.id}
            title={
              <span className="flex items-center gap-2">
                {r.name} {r.superAdmin && <Badge tone="violet">Full access</Badge>}
              </span>
            }
            subtitle={r.description}
            actions={
              !r.superAdmin && (
                <button type="button" className={btnPrimary} disabled={!dirty || saving === r.id} onClick={() => save(r)}>
                  {saving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
              )
            }
          >
            {r.superAdmin ? (
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Super Admins can open every page, approve accounts and change roles. This can't be reduced.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {state.sections.map((s) => (
                    <label key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/60">
                      <span className="text-xs font-semibold text-slate-700 truncate">{s.label}</span>
                      <select
                        className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 focus:outline-none focus:border-[#0F3D2E]"
                        value={d.permissions[s.id] || 'none'}
                        onChange={(e) => setDraft(r, { permissions: { ...d.permissions, [s.id]: e.target.value } })}
                        aria-label={`${r.name}: ${s.label}`}
                      >
                        {LEVELS.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input type="checkbox" className="w-4 h-4 accent-[#0F3D2E]" checked={d.selfRegister} onChange={(e) => setDraft(r, { selfRegister: e.target.checked })} />
                    Offer this role on the registration page
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    Opens on
                    <select
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700"
                      value={d.home}
                      onChange={(e) => setDraft(r, { home: e.target.value })}
                    >
                      {state.sections
                        .filter((s) => (d.permissions[s.id] || 'none') !== 'none')
                        .map((s) => (
                          <option key={s.id} value={s.path}>
                            {s.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}

export default function TeamView({ onShowToast }) {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('users')

  if (!isSuperAdmin) {
    return (
      <Card>
        <EmptyState icon={Lock} title="Super Admin only" text="Ask a Super Admin to approve accounts or change roles." />
      </Card>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex gap-2" role="tablist" aria-label="Team & roles">
        {[
          ['users', 'Users', Users],
          ['roles', 'Roles & permissions', ShieldCheck],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${
              tab === id ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0F3D2E]'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'users' ? <UsersTab onShowToast={onShowToast} /> : <RolesTab onShowToast={onShowToast} />}
    </div>
  )
}
