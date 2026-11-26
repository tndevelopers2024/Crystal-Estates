import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Handshake, Pencil, Phone, Mail, MapPin, Loader2, Plus, FileSpreadsheet, ExternalLink, StickyNote, UserCheck, Building2, Landmark } from 'lucide-react'
import SidePanel from '../common/SidePanel'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, StatCard, btnGhost, btnPrimary } from '../common/PageKit'
import { PartyFormModal } from '../land/Parties'
import { CommissionStatus, DataTable, DetailGrid, SectionTitle, useAsync, inr, inrShort, fmtDate, fmtDateTime } from '../land/LandKit'
import { getBroker, addBrokerNote, exportBrokersExcel } from '../../lib/brokersApi'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'commission', label: 'Commission' },
  { id: 'activity', label: 'Activity log' },
]
const MODULE = {
  lead: { label: 'Lead', tone: 'blue', icon: UserCheck },
  customer: { label: 'Customer', tone: 'amber', icon: UserCheck },
  property: { label: 'Property', tone: 'violet', icon: Building2 },
  land: { label: 'Land', tone: 'green', icon: Landmark },
}
const TYPE_LABEL = { created: 'Added', updated: 'Details changed', deleted: 'Deleted', assigned: 'Assigned', removed: 'Removed', commission_set: 'Commission changed', commission_payment: 'Commission payment', note: 'Note' }

const cm = (c) => (c ? (c.type === 'percent' ? `${c.value}%` : `${inr(c.value)} fixed`) : '—')

/**
 * One broker across the CRM: contact details, every referral (leads, property
 * bookings, land plots), commission payable / paid / pending, commission
 * payments and the activity log. Opens from the Brokers list.
 */
export default function BrokerPanel({ brokerId, canEdit, onClose, onChanged, onShowToast }) {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(() => getBroker(brokerId), [brokerId])
  const [tab, setTab] = useState('overview')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const b = data?.broker
  const stats = data?.stats
  const referrals = useMemo(() => (data?.referrals || []).filter((r) => moduleFilter === 'all' || r.module === moduleFilter), [data, moduleFilter])

  const open = (r) => {
    if (r.module === 'lead') navigate(`/leads?lead=${encodeURIComponent(r.leadId)}`)
    else if (r.module === 'customer') navigate(`/customers/${encodeURIComponent(r.customerId)}`)
    else if (r.module === 'property') navigate(`/properties/${encodeURIComponent(r.propertyId)}/plots?${r.plotUid ? `plot=${encodeURIComponent(r.plotUid)}` : `plotNo=${encodeURIComponent(r.plotNo)}`}`)
    else navigate(`/landrecords/${encodeURIComponent(r.projectId)}?tab=plots&plot=${encodeURIComponent(r.plotId)}`)
  }

  const addNote = async (e) => {
    e.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    try {
      await addBrokerNote(brokerId, note)
      setNote('')
      reload()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const exportExcel = async () => {
    setExporting(true)
    try {
      onShowToast?.(`Downloaded ${await exportBrokersExcel(brokerId)}`, 'success')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const referralColumns = [
    { key: 'module', header: 'Module', render: (r) => <Badge tone={MODULE[r.module].tone}>{MODULE[r.module].label}</Badge> },
    {
      key: 'name',
      header: 'Customer',
      render: (r) => (
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate max-w-[200px]">{r.name}</p>
          <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{r.detail || '—'}</p>
        </div>
      ),
    },
    { key: 'deal', header: 'Deal value', align: 'right', render: (r) => inr(r.dealValue) },
    { key: 'commission', header: 'Commission', render: (r) => cm(r.commission) },
    { key: 'payable', header: 'Payable', align: 'right', render: (r) => inr(r.payable) },
    { key: 'paid', header: 'Paid', align: 'right', render: (r) => inr(r.paid) },
    { key: 'pending', header: 'Pending', align: 'right', render: (r) => (r.pending > 0 ? <span className="font-semibold text-rose-700">{inr(r.pending)}</span> : inr(r.pending)) },
    { key: 'status', header: 'Status', render: (r) => <CommissionStatus status={r.status} /> },
  ]

  return (
    <SidePanel open onClose={onClose} title={b?.name || 'Broker'} subtitle={b ? [b.phone, b.email].filter(Boolean).join(' · ') : ''} icon={Handshake} width="max-w-3xl">
      <div className="flex flex-col h-full">
        <div className="px-3 border-b border-slate-100 flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Broker sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 px-3.5 py-3 text-xs font-bold border-b-2 transition ${tab === t.id ? 'border-[#0F3D2E] text-[#0F3D2E]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && !data ? (
            <LoadingBlock label="Loading broker…" />
          ) : error && !data ? (
            <ErrorBlock message={error} onRetry={reload} />
          ) : b ? (
            <>
              {tab === 'overview' && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {b.active === false ? <Badge tone="slate">Inactive</Badge> : <Badge tone="green">Active</Badge>}
                      {b.defaultCommission && <Badge tone="violet">Usual commission {cm(b.defaultCommission)}</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={exportExcel} disabled={exporting} className={btnGhost}>
                        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Export
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => setEditing(true)} className={btnGhost}>
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Payable" value={inrShort(stats.payable)} hint={`${stats.referrals} referral${stats.referrals === 1 ? '' : 's'}`} icon={Handshake} tone="gold" />
                    <StatCard label="Paid" value={inrShort(stats.paid)} tone="green" />
                    <StatCard label="Pending" value={inrShort(stats.pending)} tone="rose" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {['lead', 'property', 'land'].map((m) => {
                      const Icon = MODULE[m].icon
                      return (
                        <button key={m} type="button" onClick={() => { setModuleFilter(m); setTab('referrals') }} className="text-left rounded-2xl border border-slate-200 p-3.5 hover:border-[#0F3D2E]/40 hover:shadow-sm transition">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><Icon className="w-3.5 h-3.5" /> {m === 'property' ? 'Properties' : m === 'land' ? 'Land plots' : 'Leads'}</p>
                          <p className="text-xl font-extrabold text-slate-900 mt-1">{stats[m].count}</p>
                          <p className="text-[11px] text-slate-500">{inrShort(stats[m].pending)} pending</p>
                        </button>
                      )
                    })}
                  </div>

                  <section className="space-y-3">
                    <SectionTitle>Contact</SectionTitle>
                    <div className="space-y-1.5 text-sm text-slate-700">
                      {b.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {b.phone}{b.altPhone ? ` · ${b.altPhone}` : ''}</p>}
                      {b.email && <p className="flex items-center gap-2 break-all"><Mail className="w-3.5 h-3.5 text-slate-400" /> {b.email}</p>}
                      {b.address && <p className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" /> {b.address}</p>}
                      {!b.phone && !b.email && !b.address && <p className="text-slate-400">No contact details yet.</p>}
                    </div>
                    {b.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{b.notes}</p>}
                  </section>

                  {data.landProjects.length > 0 && (
                    <section className="space-y-2">
                      <SectionTitle>Land projects</SectionTitle>
                      <ul className="flex flex-wrap gap-2">
                        {data.landProjects.map((p) => (
                          <li key={p.id}>
                            <button type="button" onClick={() => navigate(`/landrecords/${encodeURIComponent(p.id)}`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E2EDE8] text-[#0F3D2E] text-xs font-bold hover:bg-[#d1e4dc]">
                              {p.name} <ExternalLink className="w-3 h-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <DetailGrid items={[['Added', fmtDate(b.createdAt)], ['Last updated', fmtDate(b.updatedAt)]]} />
                </>
              )}

              {tab === 'referrals' && (
                <section className="space-y-3">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter referrals">
                    {[['all', 'All'], ['lead', 'Leads'], ['property', 'Properties'], ['land', 'Land plots']].map(([id, label]) => (
                      <button key={id} type="button" onClick={() => setModuleFilter(id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${moduleFilter === id ? 'bg-[#0F3D2E] border-[#0F3D2E] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                        {label} <span className="opacity-70">{id === 'all' ? data.referrals.length : data.referrals.filter((r) => r.module === id).length}</span>
                      </button>
                    ))}
                  </div>
                  {data.referrals.length === 0 ? (
                    <EmptyState icon={Handshake} title="No referrals yet" text="Add this broker to a lead, a plot booking or a land plot, and it appears here." />
                  ) : (
                    <DataTable columns={referralColumns} rows={referrals} rowKey={(r) => r.key} onRowClick={open} empty="Nothing in this module." />
                  )}
                  <p className="text-[11px] text-slate-400">Click a row to open the lead, plot or land plot.</p>
                </section>
              )}

              {tab === 'commission' && (
                <section className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Payable" value={inrShort(stats.payable)} tone="gold" />
                    <StatCard label="Paid" value={inrShort(stats.paid)} tone="green" />
                    <StatCard label="Pending" value={inrShort(stats.pending)} tone="rose" />
                  </div>
                  <SectionTitle>Commission payments ({data.payments.length})</SectionTitle>
                  {data.payments.length === 0 ? (
                    <p className="text-sm text-slate-400">No commission paid yet. Record it on the lead, booking or land plot it belongs to.</p>
                  ) : (
                    <DataTable
                      columns={[
                        { key: 'date', header: 'Date', render: (p) => <span className="whitespace-nowrap">{fmtDate(p.date)}</span> },
                        { key: 'module', header: 'Module', render: (p) => <Badge tone={MODULE[p.module].tone}>{MODULE[p.module].label}</Badge> },
                        { key: 'ref', header: 'For', render: (p) => p.ref || '—' },
                        { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-bold">{inr(p.amount)}</span> },
                        { key: 'mode', header: 'Mode', render: (p) => p.mode || '—' },
                        { key: 'ref2', header: 'Reference', render: (p) => p.referenceNo || '—' },
                      ]}
                      rows={data.payments}
                      rowKey={(p) => p.id}
                    />
                  )}
                </section>
              )}

              {tab === 'activity' && (
                <section className="space-y-4">
                  {canEdit && (
                    <form onSubmit={addNote} className="flex gap-2">
                      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Add a note about this broker…" aria-label="Note" className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" />
                      <button type="submit" disabled={busy || !note.trim()} className={btnPrimary}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                      </button>
                    </form>
                  )}
                  {data.activity.length === 0 ? (
                    <EmptyState icon={StickyNote} title="No activity yet" text="Assignments, commission changes and payments are recorded here." />
                  ) : (
                    <ol className="relative border-l border-slate-200 ml-3 space-y-5">
                      {data.activity.map((a) => (
                        <li key={a.id} className="pl-5 relative">
                          <span className="absolute -left-3.5 top-0 w-7 h-7 rounded-full bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center ring-4 ring-white">
                            <Handshake className="w-3.5 h-3.5" />
                          </span>
                          <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                          <p className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <Badge tone="slate">{TYPE_LABEL[a.type] || a.type}</Badge>
                            {MODULE[a.module] && <Badge tone={MODULE[a.module].tone}>{MODULE[a.module].label}</Badge>}
                          </p>
                          {a.details && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{a.details}</p>}
                          {(a.changes || []).map((c) => (
                            <p key={c.field} className="text-xs text-slate-600">
                              <span className="font-semibold">{c.label}:</span> <span className="line-through text-slate-400">{c.from}</span> → <b>{c.to}</b>
                            </p>
                          ))}
                          <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(a.at)} · {a.by?.name || 'CRM user'}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
            </>
          ) : null}
        </div>
      </div>

      <PartyFormModal
        open={editing}
        type="broker"
        party={b}
        onClose={() => setEditing(false)}
        onSaved={() => {
          reload()
          onChanged?.()
        }}
      />
    </SidePanel>
  )
}
