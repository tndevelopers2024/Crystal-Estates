import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Users, UserCheck, Archive, Wallet, ChevronRight, Loader2, AlertCircle, DownloadCloud, Phone, Mail } from 'lucide-react'
import { fetchCustomers, createCustomer, importCustomersFromLeads } from '../../lib/api'
import { formatRupees } from '../../lib/plotUtils'
import { useDialog } from '../../context/DialogContext'
import SidePanel from '../common/SidePanel'
import { CustomerDetailsForm } from './CustomerForms'
import { initials, relativeTime } from './activityTypes'

const PAGE = 40
const STATUS_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
]

/** Customer directory: search, filter, add and open profiles. */
export default function CustomersPage({ onShowToast }) {
  const navigate = useNavigate()
  const { confirm, alert } = useDialog()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('active')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  // Loading = the list on screen isn't for the current search/filter yet
  const queryKey = `${status}|${debounced}`
  const [loadedKey, setLoadedKey] = useState(null)
  const loading = loadedKey !== queryKey
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    const req = ++requestRef.current
    const key = `${status}|${debounced}`
    try {
      const data = await fetchCustomers({ q: debounced, status, limit: PAGE })
      if (req !== requestRef.current) return
      setRows(data.customers || [])
      setTotal(data.total || 0)
      setStats(data.stats || null)
      setError('')
    } catch (err) {
      if (req === requestRef.current) setError(err.message)
    } finally {
      if (req === requestRef.current) setLoadedKey(key)
    }
  }, [debounced, status])

  // Initial load and every search/filter change (state is only set once the request returns)
  useEffect(() => {
    const req = ++requestRef.current
    const key = `${status}|${debounced}`
    fetchCustomers({ q: debounced, status, limit: PAGE })
      .then((data) => {
        if (req !== requestRef.current) return
        setRows(data.customers || [])
        setTotal(data.total || 0)
        setStats(data.stats || null)
        setError('')
      })
      .catch((err) => req === requestRef.current && setError(err.message))
      .finally(() => req === requestRef.current && setLoadedKey(key))
  }, [debounced, status])

  // Stay in sync with changes made elsewhere in the CRM
  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await fetchCustomers({ q: debounced, status, limit: PAGE, skip: rows.length })
      setRows((r) => [...r, ...(data.customers || [])])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleCreate = async (values) => {
    const data = await createCustomer(values)
    setAddOpen(false)
    onShowToast?.(`${data.customer.name} added to customers`, 'success')
    navigate(`/customers/${data.customer.id}`)
  }

  const handleImport = async () => {
    const ok = await confirm({
      title: 'Import customers from leads',
      message:
        'Creates a customer profile for every lead that has been contacted or has paid, and copies their lead history into the timeline. Leads already linked to a customer are skipped, so it is safe to run again.',
      confirmText: 'Import',
      type: 'info',
    })
    if (!ok) return
    setImporting(true)
    try {
      const r = await importCustomersFromLeads()
      await load()
      await alert({
        title: 'Import finished',
        message: `Checked ${r.scanned} leads · ${r.created} new customer${r.created === 1 ? '' : 's'} · ${r.linked} lead${r.linked === 1 ? '' : 's'} linked to existing customers.`,
        type: 'success',
      })
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const statCards = [
    { label: 'Customers', value: stats?.total ?? '—', icon: Users },
    { label: 'Active', value: stats?.active ?? '—', icon: UserCheck },
    { label: 'Archived', value: stats?.archived ?? '—', icon: Archive },
    { label: 'Total received', value: stats ? formatRupees(stats.totalPaid || 0) : '—', icon: Wallet },
  ]

  return (
    <div className="max-w-[1500px] mx-auto pb-10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Customers</h1>
          <p className="text-sm text-slate-500">Every contacted lead becomes a customer profile with its full history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl disabled:opacity-60"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Import from leads
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-sm font-bold rounded-xl"
          >
            <Plus className="w-4 h-4" /> Add customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="p-4 bg-white border border-slate-200/80 rounded-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Icon className="w-4 h-4 text-[#0F3D2E]" />
                {s.label}
              </div>
              <div className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900 tabular-nums truncate">{s.value}</div>
            </div>
          )
        })}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, email, project…"
              aria-label="Search customers"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E] focus:bg-white"
            />
          </div>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl self-start" role="tablist" aria-label="Customer status">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={status === t.id}
                onClick={() => setStatus(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${status === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="m-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">{error}</div>
              {/redeploy the server/i.test(error) && (
                <div className="text-xs text-rose-600 leading-relaxed">
                  The backend service on Render needs to be updated with the latest code. In Render dashboard: open <strong>crystal-estates-server</strong> &rarr; click <strong>Manual Deploy</strong> &rarr; <strong>Deploy latest commit</strong>.
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-10 flex justify-center text-slate-400" aria-label="Loading customers">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : rows.length === 0 && !error ? (
          <div className="p-10 text-center">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">{debounced ? 'No customers match your search' : 'No customers yet'}</p>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Move a lead to <strong>Contacted</strong> in the pipeline, add one here, or import your existing contacted leads.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Interested in</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3 w-8" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-[#0F3D2E]/10 text-[#0F3D2E] text-xs font-bold flex items-center justify-center shrink-0">{initials(c.name)}</span>
                        <div className="min-w-0">
                          <a
                            href={`/customers/${c.id}`}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              navigate(`/customers/${c.id}`)
                            }}
                            className="block font-semibold text-slate-900 truncate hover:underline"
                          >
                            {c.name}
                          </a>
                          <div className="text-xs text-slate-500 truncate">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                        {c.status === 'archived' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Archived</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.interests || []).slice(0, 3).map((i) => (
                          <span key={`${i.propertyId}-${i.property}`} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                            {i.property}
                          </span>
                        ))}
                        {!(c.interests || []).length && <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{c.totalPaid ? formatRupees(c.totalPaid) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{relativeTime(c.lastActivityAt || c.updatedAt)}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => navigate(`/customers/${c.id}`)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50">
                    <span className="w-10 h-10 rounded-full bg-[#0F3D2E]/10 text-[#0F3D2E] text-xs font-bold flex items-center justify-center shrink-0">{initials(c.name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                        {c.status === 'archived' && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Archived</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                        {c.phone && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </span>
                        )}
                        {!c.phone && c.email && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" /> {c.email}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        {[(c.interests || [])[0]?.property, c.totalPaid ? `${formatRupees(c.totalPaid)} paid` : null, relativeTime(c.lastActivityAt || c.updatedAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>

            {rows.length < total && (
              <div className="p-4 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#0F3D2E] hover:bg-slate-50 rounded-xl disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  Show more ({total - rows.length} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <SidePanel open={addOpen} onClose={() => setAddOpen(false)} title="Add customer" subtitle="Create a profile by hand" icon={Users}>
        <CustomerDetailsForm
          onSubmit={handleCreate}
          onCancel={() => setAddOpen(false)}
          onOpenExisting={(id) => {
            setAddOpen(false)
            navigate(`/customers/${id}`)
          }}
        />
      </SidePanel>
    </div>
  )
}
