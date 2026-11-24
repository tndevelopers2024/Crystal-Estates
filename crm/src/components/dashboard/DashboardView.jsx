import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  Clock,
  Compass,
  IndianRupee,
  Trophy,
  ArrowRight,
  Plus,
  CalendarPlus,
  Phone,
  MessageCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePayments } from '../../hooks/usePayments'
import { Card, StatCard, EmptyState, LoadingBlock, ErrorBlock, BarList, Badge, btnGhost, btnPrimary } from '../common/PageKit'
import {
  stageCounts,
  openFollowUps,
  upcomingVisits,
  inventoryByProject,
  sumPayments,
  inRange,
  shortRupees,
  fmtDate,
  paymentDate,
  STAGES,
} from '../../lib/analytics'

const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id

/** Workspace overview built entirely from live leads, visits, payments and properties. */
export default function DashboardView({ properties = [], leads = [], visits = [], loading = false, onAddLead, onScheduleVisit }) {
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const showMoney = can('payments', 'view')
  const pay = usePayments()
  const payments = showMoney ? pay.payments : []

  const stats = useMemo(() => {
    const inventory = inventoryByProject(properties)
    const plots = inventory.reduce(
      (acc, p) => ({ total: acc.total + p.total, available: acc.available + p.Available }),
      { total: 0, available: 0 },
    )
    const active = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost')
    return {
      plots,
      activeLeads: active.length,
      newThisWeek: leads.filter((l) => inRange(l.createdAt, 7)).length,
      won: leads.filter((l) => l.stage === 'won').length,
      followUps: openFollowUps(leads),
      visitsSoon: upcomingVisits(visits, 14),
      pipeline: stageCounts(leads).filter((s) => s.id !== 'lost'),
      recentLeads: [...leads].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6),
    }
  }, [properties, leads, visits])

  const month = sumPayments(payments, 30)
  const recentPayments = useMemo(() => [...payments].sort((a, b) => (paymentDate(b) || 0) - (paymentDate(a) || 0)).slice(0, 5), [payments])
  const firstName = String(user?.name || '').split(' ')[0]

  return (
    <div className="space-y-5 pb-10">
      {/* Greeting + quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{firstName ? `Welcome back, ${firstName}` : 'Workspace overview'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live figures from your leads, site visits, payments and plot inventory.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('leads', 'edit') && onAddLead && (
            <button type="button" className={btnPrimary} onClick={onAddLead}>
              <Plus className="w-4 h-4" /> Add lead
            </button>
          )}
          {can('visits', 'edit') && onScheduleVisit && (
            <button type="button" className={btnGhost} onClick={onScheduleVisit}>
              <CalendarPlus className="w-4 h-4" /> Schedule visit
            </button>
          )}
          {can('payments', 'edit') && (
            <button type="button" className={btnGhost} onClick={() => navigate('/payments')}>
              <IndianRupee className="w-4 h-4" /> Record payment
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard label="Active leads" value={loading ? '…' : stats.activeLeads} hint={`${stats.newThisWeek} new this week`} icon={Users} onClick={can('leads') ? () => navigate('/leads') : undefined} />
        <StatCard label="Open follow-ups" value={loading ? '…' : stats.followUps.length} hint="Not yet completed" icon={Clock} tone="gold" onClick={can('followups') ? () => navigate('/followups') : undefined} />
        <StatCard label="Visits · 14 days" value={loading ? '…' : stats.visitsSoon.length} hint="Scheduled or confirmed" icon={Compass} tone="blue" onClick={can('visits') ? () => navigate('/visits') : undefined} />
        <StatCard label="Bookings won" value={loading ? '…' : stats.won} hint="Leads in Won - Booked" icon={Trophy} tone="purple" />
        <StatCard label="Available plots" value={stats.plots.available} hint={`of ${stats.plots.total} across ${properties.length} projects`} icon={Building2} onClick={can('properties') ? () => navigate('/properties') : undefined} />
        {showMoney ? (
          <StatCard label="Collected · 30 days" value={pay.loading ? '…' : shortRupees(month)} hint={`${shortRupees(sumPayments(payments))} all time`} icon={IndianRupee} tone="gold" onClick={() => navigate('/payments')} />
        ) : (
          <StatCard label="Projects" value={properties.length} hint="Live on the website" icon={Building2} tone="slate" />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Pipeline */}
        <Card
          title="Sales pipeline"
          subtitle="Leads in each stage"
          className="xl:col-span-1"
          actions={can('leads') && <button type="button" className="text-xs font-bold text-[#0F3D2E] hover:underline" onClick={() => navigate('/leads')}>Open pipeline</button>}
        >
          {loading ? <LoadingBlock rows={4} /> : <BarList rows={stats.pipeline} emptyText="No leads yet" onSelect={can('leads') ? () => navigate('/leads') : undefined} />}
        </Card>

        {/* Follow-ups */}
        <Card
          title="Follow-ups to do"
          subtitle="Oldest promises first"
          bodyClassName="p-0"
          actions={can('followups') && <button type="button" className="text-xs font-bold text-[#0F3D2E] hover:underline" onClick={() => navigate('/followups')}>View all</button>}
        >
          {loading ? (
            <LoadingBlock rows={3} />
          ) : stats.followUps.length === 0 ? (
            <EmptyState icon={Clock} title="You're all caught up" text="No open follow-ups across active leads." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.followUps.slice(0, 6).map((f) => (
                <li key={`${f.leadId}-${f.id}`} className="px-5 py-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 grid place-items-center shrink-0">
                    {/whatsapp/i.test(f.type) ? <MessageCircle className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{f.leadName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{f.title || f.type}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">{f.when || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming visits */}
        <Card
          title="Upcoming site visits"
          subtitle="Next 14 days"
          bodyClassName="p-0"
          actions={can('visits') && <button type="button" className="text-xs font-bold text-[#0F3D2E] hover:underline" onClick={() => navigate('/visits')}>View all</button>}
        >
          {loading ? (
            <LoadingBlock rows={3} />
          ) : stats.visitsSoon.length === 0 ? (
            <EmptyState icon={Compass} title="No visits scheduled" text="Visits booked from the website or the CRM appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.visitsSoon.slice(0, 6).map((v) => (
                <li key={v.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-11 shrink-0 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400">{new Date(v.visitDate).toLocaleDateString('en-IN', { month: 'short' })}</p>
                    <p className="text-base font-extrabold text-slate-900 leading-none">{new Date(v.visitDate).getDate()}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{v.leadName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {v.property} · {v.visitTime || 'Time TBC'}
                    </p>
                  </div>
                  <Badge tone={/confirm/i.test(v.status) ? 'green' : /pending/i.test(v.status) ? 'amber' : 'blue'}>{v.status || 'Scheduled'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Recent leads */}
        <Card
          title="Newest leads"
          bodyClassName="p-0"
          actions={can('leads') && <button type="button" className="text-xs font-bold text-[#0F3D2E] hover:underline" onClick={() => navigate('/leads')}>All leads</button>}
        >
          {loading ? (
            <LoadingBlock rows={4} />
          ) : stats.recentLeads.length === 0 ? (
            <EmptyState icon={Users} title="No leads yet" text="Website enquiries and leads you add show up here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentLeads.map((l) => (
                <li key={l.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full text-white text-[11px] font-bold grid place-items-center shrink-0" style={{ background: l.assignedAgent?.color || '#0F3D2E' }}>
                    {String(l.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{l.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {[l.property, l.source].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone={l.stage === 'won' ? 'green' : l.stage === 'lost' ? 'rose' : 'slate'}>{stageLabel(l.stage || 'new')}</Badge>
                    <p className="text-[10px] text-slate-400 mt-1">{fmtDate(l.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent payments or inventory */}
        {showMoney ? (
          <Card
            title="Latest payments"
            bodyClassName="p-0"
            actions={<button type="button" className="text-xs font-bold text-[#0F3D2E] hover:underline" onClick={() => navigate('/payments')}>All payments</button>}
          >
            {pay.loading ? (
              <LoadingBlock rows={4} />
            ) : pay.error ? (
              <ErrorBlock message={pay.error} onRetry={pay.reload} />
            ) : recentPayments.length === 0 ? (
              <EmptyState icon={IndianRupee} title="No payments recorded yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentPayments.map((p) => (
                  <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center shrink-0">
                      <IndianRupee className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.leadName}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[p.paymentFor, p.property, p.plotNo && `Plot ${p.plotNo}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-slate-900">{shortRupees(p.amount)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(paymentDate(p))}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card title="Plot inventory">
            <BarList rows={inventoryByProject(properties).map((p) => ({ id: p.id, label: p.name, count: p.Available }))} emptyText="No projects yet" />
          </Card>
        )}
      </div>

      {can('properties') && (
        <div className="bg-gradient-to-r from-[#0F3D2E] to-[#1B5E46] text-white p-5 sm:p-6 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Plot inventory</h3>
            <p className="text-xs text-emerald-100 mt-1 max-w-lg">
              {stats.plots.available} of {stats.plots.total} plots are available across {properties.length} projects.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/properties')} className="px-4 py-2 bg-white text-[#0F3D2E] font-bold text-xs rounded-xl shadow-sm hover:bg-[#E2EDE8] transition flex items-center gap-2 self-start sm:self-auto">
            Manage properties <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
