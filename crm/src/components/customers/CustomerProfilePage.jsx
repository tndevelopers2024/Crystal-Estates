import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Building2,
  GitBranch,
  IndianRupee,
  MapPin,
  UserCircle2,
  ExternalLink,
  MoreHorizontal,
  History,
} from 'lucide-react'
import {
  fetchCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerActivity,
  updateCustomerActivity,
  deleteCustomerActivity,
} from '../../lib/api'
import { formatRupees } from '../../lib/plotUtils'
import { useDialog } from '../../context/DialogContext'
import SidePanel from '../common/SidePanel'
import { CustomerDetailsForm, ActivityForm } from './CustomerForms'
import { ACTIVITY_TYPES, STAGE_LABELS, activityType, dayLabel, fmtDate, fmtTime, initials } from './activityTypes'

const REFRESH_MS = 30000

function Card({ title, icon: Icon, action, children }) {
  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#0F3D2E]" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{children || '—'}</dd>
    </div>
  )
}

function TimelineItem({ item, onEdit, onDelete }) {
  const t = activityType(item.type)
  const Icon = t.icon
  const [menu, setMenu] = useState(false)
  return (
    <li className="relative pl-12 pb-5 last:pb-0">
      <span className={`absolute left-0 top-0 w-9 h-9 rounded-full ring-1 flex items-center justify-center ${t.tone}`} aria-hidden="true">
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 break-words">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-slate-600">{t.label}</span>
            <span>{fmtTime(item.occurredAt)}</span>
            {item.actor?.name && <span>by {item.actor.name}</span>}
            {item.property && <span className="text-emerald-700">· {item.property}</span>}
            <span className={`px-1.5 py-px rounded text-[10px] font-bold ${item.source === 'manual' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
              {item.source === 'manual' ? 'Logged' : 'Auto'}
            </span>
          </p>
          {item.details && <p className="mt-1.5 text-sm text-slate-600 whitespace-pre-line break-words">{item.details}</p>}
          {item.amount != null && item.type === 'payment' && <p className="mt-1 text-sm font-bold text-emerald-700">{formatRupees(item.amount)}</p>}
        </div>
        {item.source === 'manual' && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label={`Actions for "${item.title}"`}
              aria-expanded={menu}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 z-10 mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-lg py-1" onMouseLeave={() => setMenu(false)}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false)
                    onEdit(item)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false)
                    onDelete(item)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export default function CustomerProfilePage({ properties = [], onShowToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm } = useDialog()
  const [data, setData] = useState(null)
  const [loadedId, setLoadedId] = useState(null)
  const loading = loadedId !== id
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [activityForm, setActivityForm] = useState(null) // null | {} (new) | activity (edit)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const d = await fetchCustomer(id)
      setData(d)
      setError('')
    } catch (err) {
      setError(err.message)
      if (err.status === 404) setData(null)
    } finally {
      setLoadedId(id)
    }
  }, [id])

  // Load when the profile opens (state is only set once the request returns)
  useEffect(() => {
    let active = true
    fetchCustomer(id)
      .then((d) => {
        if (!active) return
        setData(d)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        if (err.status === 404) setData(null)
      })
      .finally(() => active && setLoadedId(id))
    return () => {
      active = false
    }
  }, [id])

  // Pick up changes made from the pipeline, payments or another device
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && load()
    const t = setInterval(tick, REFRESH_MS)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', tick)
    }
  }, [load])

  const customer = data?.customer
  const activity = useMemo(() => data?.activity || [], [data])
  const typeCounts = useMemo(() => {
    const counts = {}
    for (const a of activity) counts[a.type] = (counts[a.type] || 0) + 1
    return counts
  }, [activity])
  const filtered = filter === 'all' ? activity : activity.filter((a) => a.type === filter)
  const groups = useMemo(() => {
    const out = []
    for (const a of filtered) {
      const label = dayLabel(a.occurredAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(a)
      else out.push({ label, items: [a] })
    }
    return out
  }, [filtered])

  const propertyName = (pid, fallback) => data?.properties?.find((p) => p.id === pid)?.name || fallback

  const saveDetails = async (values) => {
    const r = await updateCustomer(customer.id, values)
    setEditOpen(false)
    onShowToast?.(r.changed?.length ? 'Customer details saved' : 'No changes to save', 'success')
    await load()
  }

  const toggleArchive = async () => {
    const archiving = customer.status !== 'archived'
    if (archiving) {
      const ok = await confirm({
        title: 'Archive customer',
        message: `${customer.name} will move to Archived. Their history is kept and you can restore them any time.`,
        confirmText: 'Archive',
        type: 'warning',
      })
      if (!ok) return
    }
    try {
      await updateCustomer(customer.id, { status: archiving ? 'archived' : 'active' })
      onShowToast?.(archiving ? 'Customer archived' : 'Customer restored', 'success')
      await load()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete customer profile',
      message: `This permanently deletes ${customer.name}'s profile and timeline. Their leads and payment records stay in the CRM. This can't be undone.`,
      tag: [customer.phone, customer.email].filter(Boolean).join(' · '),
      confirmText: 'Delete profile',
      type: 'danger',
    })
    if (!ok) return
    try {
      await deleteCustomer(customer.id)
      onShowToast?.('Customer profile deleted', 'success')
      navigate('/customers')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  const saveActivity = async (entry) => {
    if (activityForm?.id) await updateCustomerActivity(customer.id, activityForm.id, entry)
    else await addCustomerActivity(customer.id, entry)
    setActivityForm(null)
    onShowToast?.(activityForm?.id ? 'Activity updated' : 'Activity logged', 'success')
    await load()
  }

  const removeActivity = async (item) => {
    const ok = await confirm({ title: 'Delete activity', message: `Remove "${item.title}" from the timeline?`, confirmText: 'Delete', type: 'danger' })
    if (!ok) return
    try {
      await deleteCustomerActivity(customer.id, item.id)
      await load()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  if (loading && (!data || data.customer?.id !== id)) {
    return (
      <div className="p-10 flex justify-center text-slate-400" aria-label="Loading customer">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white border border-slate-200 rounded-2xl text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
        <p className="mt-3 text-sm font-semibold text-slate-800">{error || 'Customer not found'}</p>
        <Link to="/customers" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F3D2E]">
          <ArrowLeft className="w-4 h-4" /> Back to customers
        </Link>
      </div>
    )
  }

  const phoneDigits = String(customer.phone || '').replace(/\D/g, '')
  const archived = customer.status === 'archived'
  const leads = data.leads || []
  const payments = data.payments || []
  const interests = customer.interests || []

  return (
    <div className="max-w-[1500px] mx-auto pb-10 space-y-5">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Customers
      </Link>

      {error && (
        <div role="alert" className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> Couldn’t refresh: {error}
        </div>
      )}

      {/* Header */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-14 h-14 rounded-2xl bg-[#0F3D2E] text-white text-lg font-bold flex items-center justify-center shrink-0">{initials(customer.name)}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">{customer.name}</h1>
              {archived && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">Archived</span>}
              {(customer.tags || []).map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800">
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-0.5 text-sm text-slate-500 break-words">
              {[customer.phone, customer.email, customer.city].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">Customer since {fmtDate(customer.convertedAt || customer.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {phoneDigits && (
            <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 no-underline">
              <Phone className="w-4 h-4" /> Call
            </a>
          )}
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-[#16A34A] hover:bg-emerald-50 no-underline"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 no-underline">
              <Mail className="w-4 h-4" /> Email
            </a>
          )}
          <button type="button" onClick={() => setActivityForm({})} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white rounded-xl text-sm font-bold">
            <Plus className="w-4 h-4" /> Log activity
          </button>
          <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button type="button" onClick={toggleArchive} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            {archived ? 'Restore' : 'Archive'}
          </button>
          <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-200 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50" aria-label="Delete customer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-1">
          <Card title="Details" icon={UserCircle2}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Phone">{customer.phone}</Field>
              <Field label="Email">{customer.email}</Field>
              <Field label="City">{customer.city}</Field>
              <Field label="Source">{customer.source}</Field>
              <Field label="Assigned to">{customer.assignedAgent?.name}</Field>
              <Field label="Total paid">{data.totals?.paid ? formatRupees(data.totals.paid) : null}</Field>
              <div className="col-span-2">
                <Field label="Address">{customer.address}</Field>
              </div>
              {customer.notes && (
                <div className="col-span-2">
                  <dt className="text-[11px] font-medium text-slate-400">Notes</dt>
                  <dd className="mt-0.5 text-sm text-slate-700 whitespace-pre-line break-words">{customer.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Properties" icon={Building2}>
            {interests.length === 0 ? (
              <p className="text-sm text-slate-400">No property interest recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {interests.map((i) => (
                  <li key={`${i.propertyId}-${i.property}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800 truncate">{propertyName(i.propertyId, i.property)}</span>
                      {i.unit && <span className="block text-xs text-slate-500">{i.unit}</span>}
                    </span>
                    {i.propertyId && (
                      <Link to={`/properties/${i.propertyId}/plots`} className="text-xs font-semibold text-[#0F3D2E] inline-flex items-center gap-1 shrink-0">
                        Plots <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Leads (${leads.length})`} icon={GitBranch}>
            {leads.length === 0 ? (
              <p className="text-sm text-slate-400">No linked leads — this profile was added by hand.</p>
            ) : (
              <ul className="space-y-2.5">
                {leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800 truncate">{l.property && l.property !== 'General Enquiry' ? l.property : 'General enquiry'}</span>
                      <span className="block text-xs text-slate-500">
                        {STAGE_LABELS[l.stage] || l.stage}
                        {l.unit && l.unit !== 'Not allotted' ? ` · ${l.unit}` : ''} · {fmtDate(l.createdAt)}
                      </span>
                    </span>
                    <Link to={`/leads?lead=${encodeURIComponent(l.id)}`} className="text-xs font-semibold text-[#0F3D2E] shrink-0">
                      Open lead
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={`Payments (${payments.length})`}
            icon={IndianRupee}
            action={payments.length ? <span className="text-sm font-bold text-emerald-700">{formatRupees(data.totals?.paid || 0)}</span> : null}
          >
            {payments.length === 0 ? (
              <p className="text-sm text-slate-400">No payments recorded.</p>
            ) : (
              <ul className="space-y-2.5">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800">{p.paymentFor}</span>
                      <span className="block text-xs text-slate-500">
                        {[fmtDate(p.paidOn || p.createdAt), p.mode, p.plotNo ? `Plot ${p.plotNo}` : p.unitAllotted !== 'Not allotted' ? p.unitAllotted : null, p.property]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums shrink-0">{formatRupees(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card
            title={`Timeline (${activity.length})`}
            icon={History}
            action={
              <button type="button" onClick={() => setActivityForm({})} className="text-xs font-bold text-[#0F3D2E] inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Log
              </button>
            }
          >
            <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 [scrollbar-width:none]" role="tablist" aria-label="Filter timeline">
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'all'}
                onClick={() => setFilter('all')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${filter === 'all' ? 'bg-[#0F3D2E] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                All {activity.length}
              </button>
              {ACTIVITY_TYPES.filter((t) => typeCounts[t.id]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.id}
                  onClick={() => setFilter(t.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${filter === t.id ? 'bg-[#0F3D2E] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {t.label} {typeCounts[t.id]}
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <div className="py-8 text-center">
                <MapPin className="w-7 h-7 mx-auto text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">Nothing logged yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map((g) => (
                  <div key={g.label}>
                    <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.label}</h3>
                    <ol className="relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                      {g.items.map((a) => (
                        <TimelineItem key={a.id} item={a} onEdit={(x) => setActivityForm(x)} onDelete={removeActivity} />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <SidePanel open={editOpen} onClose={() => setEditOpen(false)} title="Edit customer" subtitle={customer.name} icon={Pencil}>
        <CustomerDetailsForm
          initial={customer}
          submitLabel="Save changes"
          onSubmit={saveDetails}
          onCancel={() => setEditOpen(false)}
          onOpenExisting={(otherId) => {
            setEditOpen(false)
            navigate(`/customers/${otherId}`)
          }}
        />
      </SidePanel>

      <SidePanel
        open={Boolean(activityForm)}
        onClose={() => setActivityForm(null)}
        title={activityForm?.id ? 'Edit activity' : 'Log activity'}
        subtitle={customer.name}
        icon={History}
      >
        {activityForm && (
          <ActivityForm
            key={activityForm.id || 'new'}
            initial={activityForm.id ? activityForm : null}
            properties={properties}
            onSubmit={saveActivity}
            onCancel={() => setActivityForm(null)}
          />
        )}
      </SidePanel>
    </div>
  )
}
