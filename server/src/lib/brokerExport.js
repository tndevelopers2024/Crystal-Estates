import ExcelJS from 'exceljs'
import { today } from './land.js'
import { PARTIES, brokerDetail } from './brokers.js'
import { addSheet } from './landExport.js'

const MODULE = { lead: 'Lead', property: 'Property', land: 'Land' }
const ACTIVITY_TYPE = {
  created: 'Broker added',
  updated: 'Details changed',
  deleted: 'Deleted',
  assigned: 'Assigned',
  removed: 'Removed',
  commission_set: 'Commission changed',
  commission_payment: 'Commission payment',
  note: 'Note',
  referral: 'Referral',
}

const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 50)

/** Excel report of one broker, or of every broker: summary, referrals, commission payments and activity log. */
export async function buildBrokerWorkbook(db, { brokerId = null, by = 'CRM user' }) {
  const list = brokerId
    ? [{ id: brokerId }]
    : await db.collection(PARTIES).find({ type: 'broker' }, { projection: { _id: 0, id: 1 } }).toArray()
  const details = (await Promise.all(list.map((b) => brokerDetail(db, b.id)))).filter(Boolean)
  if (brokerId && !details.length) return null
  details.sort((a, b) => a.broker.name.localeCompare(b.broker.name))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Crystal Estates CRM'
  wb.created = new Date()
  const scope = brokerId ? `Broker: ${details[0].broker.name}` : 'All brokers'
  const subtitle = (extra) => `Crystal Estates · ${scope} · Exported ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} by ${by}${extra ? ` · ${extra}` : ''}`

  addSheet(wb, {
    name: 'Brokers',
    title: 'Brokers',
    subtitle: subtitle(`${details.length} broker${details.length === 1 ? '' : 's'}`),
    columns: [
      { header: 'Broker', key: 'name', width: 26 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Status', key: 'active', width: 11 },
      { header: 'Usual commission', key: 'usual', width: 18 },
      { header: 'Leads', key: 'leads', type: 'int', total: true },
      { header: 'Property plots', key: 'props', type: 'int', total: true },
      { header: 'Land plots', key: 'land', type: 'int', total: true },
      { header: 'Land projects', key: 'projects', type: 'int', total: true },
      { header: 'Commission payable (₹)', key: 'payable', type: 'money', total: true },
      { header: 'Commission paid (₹)', key: 'paid', type: 'money', total: true },
      { header: 'Commission pending (₹)', key: 'pending', type: 'money', total: true },
    ],
    rows: details.map((d) => {
      const dc = d.broker.defaultCommission
      return {
        name: d.broker.name,
        phone: d.broker.phone,
        email: d.broker.email,
        active: d.broker.active === false ? 'Inactive' : 'Active',
        usual: dc ? (dc.type === 'percent' ? `${dc.value}%` : `₹${dc.value.toLocaleString('en-IN')} fixed`) : '',
        leads: d.stats.lead.count,
        props: d.stats.property.count,
        land: d.stats.land.count,
        projects: d.stats.landProjects,
        payable: d.stats.payable,
        paid: d.stats.paid,
        pending: d.stats.pending,
      }
    }),
  })

  const referrals = details.flatMap((d) => d.referrals.map((r) => ({ broker: d.broker.name, ...r })))
  addSheet(wb, {
    name: 'Referrals',
    title: 'Referrals and commission',
    subtitle: subtitle(`${referrals.length} referral${referrals.length === 1 ? '' : 's'}`),
    columns: [
      { header: 'Broker', key: 'broker', width: 24 },
      { header: 'Module', key: 'module', width: 11 },
      { header: 'Customer / buyer', key: 'name', width: 26 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Property / plot', key: 'detail', width: 34 },
      { header: 'Stage / status', key: 'stage', width: 16 },
      { header: 'Deal value (₹)', key: 'dealValue', type: 'money', total: true },
      { header: 'Commission basis', key: 'basis', width: 16 },
      { header: 'Payable (₹)', key: 'payable', type: 'money', total: true },
      { header: 'Paid (₹)', key: 'paid', type: 'money', total: true },
      { header: 'Pending (₹)', key: 'pending', type: 'money', total: true },
      { header: 'Commission status', key: 'status', width: 17 },
    ],
    rows: referrals.map((r) => ({ ...r, module: MODULE[r.module], basis: r.commission ? (r.commission.type === 'percent' ? `${r.commission.value}%` : 'Fixed amount') : 'Not set' })),
  })

  const payments = details.flatMap((d) => d.payments.map((p) => ({ broker: d.broker.name, ...p })))
  payments.sort((a, b) => (a.date < b.date ? 1 : -1))
  addSheet(wb, {
    name: 'Commission Payments',
    title: 'Commission paid to brokers',
    subtitle: subtitle(`${payments.length} payment${payments.length === 1 ? '' : 's'}`),
    columns: [
      { header: 'Date', key: 'date', type: 'date' },
      { header: 'Broker', key: 'broker', width: 24 },
      { header: 'Module', key: 'module', width: 11 },
      { header: 'For', key: 'ref', width: 30 },
      { header: 'Amount (₹)', key: 'amount', type: 'money', total: true },
      { header: 'Mode', key: 'mode', width: 20 },
      { header: 'Reference no.', key: 'referenceNo', width: 18 },
      { header: 'Note', key: 'note', width: 30, wrap: true },
      { header: 'Recorded by', key: 'by', width: 18 },
    ],
    rows: payments.map((p) => ({ ...p, module: MODULE[p.module], by: p.by?.name })),
  })

  const activity = details.flatMap((d) => d.activity.map((a) => ({ broker: d.broker.name, ...a })))
  activity.sort((a, b) => new Date(b.at) - new Date(a.at))
  addSheet(wb, {
    name: 'Broker Activity',
    title: 'Broker activity log',
    subtitle: subtitle(`${activity.length} event${activity.length === 1 ? '' : 's'}, newest first`),
    columns: [
      { header: 'When', key: 'at', type: 'datetime' },
      { header: 'Broker', key: 'broker', width: 24 },
      { header: 'Module', key: 'module', width: 11 },
      { header: 'Type', key: 'type', width: 19 },
      { header: 'Event', key: 'title', width: 44, wrap: true },
      { header: 'Details', key: 'details', width: 30, wrap: true },
      { header: 'Changes', key: 'changes', width: 40, wrap: true },
      { header: 'By', key: 'by', width: 18 },
    ],
    rows: activity.map((a) => ({
      ...a,
      module: a.module === 'directory' ? 'Directory' : MODULE[a.module] || a.module,
      type: ACTIVITY_TYPE[a.type] || a.type,
      changes: (a.changes || []).map((c) => `${c.label}: ${c.from} → ${c.to}`).join('\n'),
      by: a.by?.name,
    })),
  })

  return { workbook: wb, filename: `Brokers-${safe(brokerId ? details[0].broker.name : 'All')}-${today()}.xlsx` }
}
