import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Users, Trophy, IndianRupee, Percent, Search, Download, LayoutGrid } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePayments } from '../../hooks/usePayments'
import { Card, StatCard, EmptyState, LoadingBlock, BarList, Badge, btnGhost, inputCls } from '../common/PageKit'
import { inventoryByProject, agentStats, countBy, shortRupees, sumPayments, downloadCsv } from '../../lib/analytics'

/** Executive view: portfolio inventory, team performance and lead sources. */
export default function ManagementView({ properties = [], leads = [], visits = [], loading = false }) {
  const navigate = useNavigate()
  const { can } = useAuth()
  const showMoney = can('payments', 'view')
  const pay = usePayments()
  const [q, setQ] = useState('')

  const inventory = useMemo(() => inventoryByProject(properties), [properties])
  const agents = useMemo(() => agentStats(leads, visits), [leads, visits])
  const sources = useMemo(() => countBy(leads, (l) => l.source, { top: 8 }), [leads])
  const interest = useMemo(() => countBy(leads.filter((l) => l.property && l.property !== 'General Enquiry'), (l) => l.property, { top: 8 }), [leads])

  const totals = useMemo(() => {
    const t = inventory.reduce(
      (a, p) => ({ total: a.total + p.total, available: a.available + p.Available, sold: a.sold + p.Sold, booked: a.booked + p.Booked, value: a.value + p.availableValue }),
      { total: 0, available: 0, sold: 0, booked: 0, value: 0 },
    )
    const won = leads.filter((l) => l.stage === 'won').length
    return { ...t, won, conversion: leads.length ? Math.round((won / leads.length) * 100) : 0 }
  }, [inventory, leads])

  const shown = inventory.filter((p) => !q.trim() || `${p.name} ${p.location}`.toLowerCase().includes(q.trim().toLowerCase()))

  const exportInventory = () =>
    downloadCsv('crystal-estates-inventory.csv', [
      { label: 'Project', value: 'name' },
      { label: 'Location', value: 'location' },
      { label: 'Total plots', value: 'total' },
      { label: 'Available', value: 'Available' },
      { label: 'Booked', value: 'Booked' },
      { label: 'Sold', value: 'Sold' },
      { label: 'Blocked', value: 'Blocked' },
      { label: 'Sell-through %', value: 'sellThrough' },
      { label: 'Available value (INR)', value: 'availableValue' },
    ], shown)

  const exportAgents = () =>
    downloadCsv('crystal-estates-team-performance.csv', [
      { label: 'Agent', value: 'name' },
      { label: 'Leads', value: 'leads' },
      { label: 'Active', value: 'active' },
      { label: 'Won', value: 'won' },
      { label: 'Lost', value: 'lost' },
      { label: 'Conversion %', value: 'conversion' },
      { label: 'Open follow-ups', value: 'followUps' },
      { label: 'Site visits', value: 'visits' },
      { label: 'Visits completed', value: 'visitsDone' },
    ], agents)

  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard label="Projects" value={properties.length} hint={`${totals.total} plots in total`} icon={Building2} />
        <StatCard label="Available plots" value={totals.available} hint={`${totals.booked} booked · ${totals.sold} sold`} icon={LayoutGrid} tone="blue" />
        <StatCard label="Unsold value" value={totals.value ? shortRupees(totals.value) : '—'} hint="Listed price of available plots" icon={IndianRupee} tone="gold" />
        <StatCard label="Lead conversion" value={`${totals.conversion}%`} hint={`${totals.won} of ${leads.length} leads won`} icon={Percent} tone="purple" />
        <StatCard
          label="Collected"
          value={showMoney ? (pay.loading ? '…' : shortRupees(sumPayments(pay.payments))) : '—'}
          hint={showMoney ? `${shortRupees(sumPayments(pay.payments, 30))} in the last 30 days` : 'Payments access needed'}
          icon={Trophy}
          tone="green"
        />
      </div>

      <Card
        title="Portfolio inventory"
        subtitle="Live plot status for every project"
        bodyClassName="p-0"
        actions={
          <>
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className={`${inputCls} !py-2 !text-xs pl-8 w-48`} placeholder="Filter projects" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter projects" />
            </div>
            <button type="button" className={btnGhost} onClick={exportInventory} disabled={!shown.length}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </>
        }
      >
        {loading && !properties.length ? (
          <LoadingBlock rows={4} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Building2} title={q ? 'No projects match that filter' : 'No projects yet'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left font-bold px-5 py-2.5">Project</th>
                  <th className="text-right font-bold px-3 py-2.5">Plots</th>
                  <th className="text-right font-bold px-3 py-2.5">Available</th>
                  <th className="text-right font-bold px-3 py-2.5">Booked</th>
                  <th className="text-right font-bold px-3 py-2.5">Sold</th>
                  <th className="text-left font-bold px-3 py-2.5 min-w-[160px]">Sell-through</th>
                  <th className="text-right font-bold px-5 py-2.5">Unsold value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((p) => (
                  <tr
                    key={p.id}
                    className={can('properties') ? 'hover:bg-slate-50 cursor-pointer' : ''}
                    onClick={can('properties') ? () => navigate(`/properties/${encodeURIComponent(p.id)}/plots`) : undefined}
                  >
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{p.location || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">{p.total}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700 font-bold">{p.Available}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700">{p.Booked}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-rose-700">{p.Sold}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-[#0F3D2E] rounded-full" style={{ width: `${p.sellThrough}%` }} />
                        </div>
                        <span className="tabular-nums font-bold text-slate-700 w-9 text-right">{p.sellThrough}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{p.availableValue ? shortRupees(p.availableValue) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Team performance"
        subtitle="Leads, conversions, follow-ups and site visits per agent"
        bodyClassName="p-0"
        actions={
          <button type="button" className={btnGhost} onClick={exportAgents} disabled={!agents.length}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        }
      >
        {loading && !leads.length ? (
          <LoadingBlock rows={3} />
        ) : agents.length === 0 ? (
          <EmptyState icon={Users} title="No assigned leads yet" text="Assign leads to agents in the pipeline to see performance here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left font-bold px-5 py-2.5">Agent</th>
                  <th className="text-right font-bold px-3 py-2.5">Leads</th>
                  <th className="text-right font-bold px-3 py-2.5">Active</th>
                  <th className="text-right font-bold px-3 py-2.5">Won</th>
                  <th className="text-right font-bold px-3 py-2.5">Conversion</th>
                  <th className="text-right font-bold px-3 py-2.5">Open follow-ups</th>
                  <th className="text-right font-bold px-5 py-2.5">Visits (done)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((a) => (
                  <tr key={a.name}>
                    <td className="px-5 py-3 font-bold text-slate-800">{a.name}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.leads}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.active}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-700">{a.won}</td>
                    <td className="px-3 py-3 text-right">
                      <Badge tone={a.conversion >= 20 ? 'green' : a.conversion >= 8 ? 'amber' : 'slate'}>{a.conversion}%</Badge>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.followUps}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {a.visits} <span className="text-slate-400">({a.visitsDone})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Where leads come from" subtitle="Top lead sources">
          <BarList rows={sources} emptyText="No leads yet" />
        </Card>
        <Card title="Most requested projects" subtitle="Leads by project of interest">
          <BarList rows={interest} emptyText="No project-specific enquiries yet" />
        </Card>
      </div>
    </div>
  )
}
