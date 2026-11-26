import React, { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Handshake, Landmark, Phone, Mail, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Card, EmptyState, LoadingBlock, ErrorBlock, Badge, btnPrimary, btnGhost, inputCls } from '../common/PageKit'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../context/DialogContext'
import { listParties, deleteParty } from '../../lib/landApi'
import { useAsync, DataTable, ExportButton } from './LandKit'
import { PartyFormModal } from './Parties'
import BrokerPanel from '../brokers/BrokerPanel'
import { exportBrokersExcel } from '../../lib/brokersApi'

const TABS = [
  { id: 'vendor', label: 'Landowners & vendors', icon: Landmark },
  { id: 'broker', label: 'Brokers', icon: Handshake },
]

/** Directory of the people we buy land from and the brokers who bring customers. */
export default function PartiesPage({ onShowToast }) {
  const { can } = useAuth()
  const { confirm, alert } = useDialog()
  const canEdit = can('vendors', 'edit') || can('landrecords', 'edit')
  const [tab, setTab] = useState('vendor')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(null) // { party? }
  const [openBroker, setOpenBroker] = useState(null)
  const [exporting, setExporting] = useState(false)
  const { data, loading, error, reload } = useAsync(() => listParties(), [])

  const all = useMemo(() => data?.parties || [], [data])
  const counts = { vendor: all.filter((p) => p.type === 'vendor').length, broker: all.filter((p) => p.type === 'broker').length }
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((p) => p.type === tab && (!q || `${p.name} ${p.phone || ''} ${p.email || ''} ${p.address || ''}`.toLowerCase().includes(q)))
  }, [all, tab, query])

  const remove = async (p) => {
    const ok = await confirm({
      title: p.type === 'broker' ? 'Delete broker' : 'Delete record',
      message: `Delete ${p.name}? This can't be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    try {
      await deleteParty(p.id, p.type)
      onShowToast?.(`${p.name} deleted`, 'info')
      reload()
    } catch (err) {
      await alert({ title: "Can't delete", message: err.message, confirmText: 'OK', type: 'info' })
    }
  }

  const actions = (p) =>
    canEdit && (
      <span className="inline-flex items-center gap-1 justify-end">
        <button type="button" onClick={(e) => { e.stopPropagation(); setForm({ party: p }) }} className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Edit ${p.name}`} title="Edit">
          <Pencil className="w-4 h-4" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); remove(p) }} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete ${p.name}`} title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </span>
    )

  const contact = (p) => (
    <div className="min-w-0">
      {p.phone && (
        <p className="flex items-center gap-1.5 text-xs text-slate-700">
          <Phone className="w-3 h-3 text-slate-400" /> {p.phone}
        </p>
      )}
      {p.email && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
          <Mail className="w-3 h-3 text-slate-400" /> {p.email}
        </p>
      )}
      {!p.phone && !p.email && <span className="text-slate-400">—</span>}
    </div>
  )
  const nameCell = (p) => (
    <div className="min-w-0">
      <p className="font-bold text-slate-900 truncate">{p.name}</p>
      {p.address && <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{p.address}</p>}
    </div>
  )
  const status = (p) => (p.active === false ? <Badge tone="slate">Inactive</Badge> : <Badge tone="green">Active</Badge>)

  const columns =
    tab === 'vendor'
      ? [
          { key: 'name', header: 'Name', render: nameCell },
          { key: 'kind', header: 'Type', render: (p) => <Badge tone="blue">{p.kind || 'Landowner'}</Badge> },
          { key: 'contact', header: 'Contact', render: contact },
          { key: 'usage', header: 'Projects', align: 'right', render: (p) => p.usage || 0 },
          { key: 'status', header: 'Status', render: status },
          { key: 'act', header: '', align: 'right', render: actions },
        ]
      : [
          { key: 'name', header: 'Broker', render: nameCell },
          { key: 'contact', header: 'Contact', render: contact },
          { key: 'dc', header: 'Usual commission', render: (p) => (p.defaultCommission ? (p.defaultCommission.type === 'percent' ? `${p.defaultCommission.value}%` : `₹${Number(p.defaultCommission.value).toLocaleString('en-IN')} fixed`) : <span className="text-slate-400">—</span>) },
          { key: 'leads', header: 'Leads', align: 'right', render: (p) => p.leads || 0 },
          { key: 'props', header: 'Properties', align: 'right', render: (p) => p.bookings || 0 },
          { key: 'land', header: 'Land plots', align: 'right', render: (p) => p.landPlots || 0 },
          { key: 'projects', header: 'Land projects', align: 'right', render: (p) => p.projects || 0 },
          { key: 'status', header: 'Status', render: status },
          { key: 'act', header: '', align: 'right', render: actions },
        ]

  return (
    <div className="space-y-5 pb-10 max-w-[1500px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Vendors &amp; landowners</h1>
          <p className="text-sm text-slate-500">Who we buy land from, and the brokers who bring customers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === 'vendor' ? (
            <ExportButton type="vendors" label="Export landowners" onShowToast={onShowToast} />
          ) : (
            <button type="button" className={btnGhost} disabled={exporting} onClick={async () => { setExporting(true); try { onShowToast?.(`Downloaded ${await exportBrokersExcel()}`, 'success') } catch (err) { onShowToast?.(err.message, 'error') } finally { setExporting(false) } }} title="Brokers, referrals, commission and activity across leads, properties and land">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Export brokers
            </button>
          )}
          {canEdit && (
            <button type="button" className={btnPrimary} onClick={() => setForm({})}>
              <Plus className="w-4 h-4" /> {tab === 'vendor' ? 'Add landowner / vendor' : 'Add broker'}
            </button>
          )}
        </div>
      </div>

      <Card bodyClassName="p-0">
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start" role="tablist" aria-label="Directory">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === t.id ? 'bg-white text-[#0F3D2E] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label} <span className="text-slate-400">{counts[t.id]}</span>
                </button>
              )
            })}
          </div>
          <div className="relative md:ml-auto md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email…" className={`${inputCls} pl-9`} aria-label="Search" />
          </div>
        </div>
        <div className="p-3">
          {loading && !data ? (
            <LoadingBlock label="Loading…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={reload} />
          ) : all.filter((p) => p.type === tab).length === 0 ? (
            <EmptyState
              icon={tab === 'vendor' ? Landmark : Handshake}
              title={tab === 'vendor' ? 'No landowners or vendors yet' : 'No brokers yet'}
              text={tab === 'vendor' ? 'Add the people you buy land from, then pick them when you create a project.' : 'Add brokers here, or straight from a plot when you assign one.'}
              action={canEdit && <button type="button" className={btnPrimary} onClick={() => setForm({})}><Plus className="w-4 h-4" /> {tab === 'vendor' ? 'Add landowner / vendor' : 'Add broker'}</button>}
            />
          ) : (
            <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} onRowClick={tab === 'broker' ? (p) => setOpenBroker(p.id) : undefined} empty="No one matches your search." />
          )}
        </div>
      </Card>

      {openBroker && <BrokerPanel brokerId={openBroker} canEdit={canEdit} onClose={() => setOpenBroker(null)} onChanged={reload} onShowToast={onShowToast} />}

      <PartyFormModal
        open={Boolean(form)}
        type={tab}
        party={form?.party}
        onClose={() => setForm(null)}
        onSaved={(p) => {
          onShowToast?.(`${p.name} saved`, 'success')
          reload()
        }}
      />
    </div>
  )
}
