/**
 * Pure helpers that turn live CRM data (leads, site visits, payments,
 * properties) into the figures shown on Dashboard, Management and Reports.
 * Nothing here is stored or invented: every number is derived from records.
 */
import { ensurePlotUids, statusGroup } from './plotUtils'

export const STAGES = [
  { id: 'new', label: 'New leads', color: '#64748b' },
  { id: 'contacted', label: 'Contacted', color: '#0ea5e9' },
  { id: 'followup', label: 'Follow-up', color: '#6366f1' },
  { id: 'sitevisit', label: 'Site visit', color: '#a855f7' },
  { id: 'sitevisitdone', label: 'Site visit done', color: '#d946ef' },
  { id: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
  { id: 'won', label: 'Won - Booked', color: '#0F3D2E' },
  { id: 'lost', label: 'Lost', color: '#e11d48' },
]

const DAY = 24 * 60 * 60 * 1000

export const toDate = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function inRange(value, days) {
  if (!days) return true
  const d = toDate(value)
  return Boolean(d && Date.now() - d.getTime() <= days * DAY)
}

export const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

/** ₹ 12.5 L / ₹ 1.2 Cr / ₹ 45,000 */
export function shortRupees(n) {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 1 : 2)} L`
  return rupees(v)
}

export function stageCounts(leads) {
  const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0]))
  for (const l of leads) {
    const id = String(l.stage || 'new').toLowerCase()
    counts[id] = (counts[id] || 0) + 1
  }
  return STAGES.map((s) => ({ ...s, count: counts[s.id] || 0 }))
}

export function countBy(items, keyFn, { top = 0, fallback = 'Unknown' } = {}) {
  const map = new Map()
  for (const it of items) {
    const k = String(keyFn(it) || fallback).trim() || fallback
    map.set(k, (map.get(k) || 0) + 1)
  }
  const rows = [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  return top ? rows.slice(0, top) : rows
}

export function openFollowUps(leads) {
  const out = []
  for (const l of leads) {
    if (l.stage === 'won' || l.stage === 'lost') continue
    for (const fu of l.upcomingFollowUps || []) {
      if (fu.completed) continue
      out.push({ ...fu, leadId: l.id, leadName: l.name, phone: l.phone, agent: l.assignedAgent?.name || '' })
    }
  }
  return out
}

export function upcomingVisits(visits, days = 14) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = start.getTime() + days * DAY
  return visits
    .filter((v) => !/cancel|complete/i.test(v.status || ''))
    .filter((v) => {
      const d = toDate(v.visitDate)
      return d && d.getTime() >= start.getTime() && d.getTime() <= end
    })
    .sort((a, b) => toDate(a.visitDate) - toDate(b.visitDate))
}

export const paymentDate = (p) => toDate(p.paidOn) || toDate(p.createdAt)

export function sumPayments(payments, days = 0) {
  return payments.filter((p) => !days || inRange(paymentDate(p), days)).reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

/** Totals per calendar month, oldest first, for the last `months` months. */
export function paymentsByMonth(payments, months = 6) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), year: d.getFullYear(), total: 0, count: 0 })
  }
  const index = new Map(buckets.map((b) => [b.key, b]))
  for (const p of payments) {
    const d = paymentDate(p)
    if (!d) continue
    const b = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (b) {
      b.total += Number(p.amount) || 0
      b.count += 1
    }
  }
  return buckets
}

/** Per agent: leads, won, conversion, open follow-ups, visits. */
export function agentStats(leads, visits) {
  const map = new Map()
  const row = (name) => {
    if (!map.has(name)) map.set(name, { name, leads: 0, won: 0, lost: 0, active: 0, followUps: 0, visits: 0, visitsDone: 0 })
    return map.get(name)
  }
  for (const l of leads) {
    const r = row(l.assignedAgent?.name || 'Unassigned')
    r.leads += 1
    if (l.stage === 'won') r.won += 1
    else if (l.stage === 'lost') r.lost += 1
    else r.active += 1
    r.followUps += (l.upcomingFollowUps || []).filter((f) => !f.completed).length
  }
  for (const v of visits) {
    const r = row(v.assignedAgent?.name || 'Unassigned')
    r.visits += 1
    if (/complete/i.test(v.status || '')) r.visitsDone += 1
  }
  return [...map.values()]
    .map((r) => ({ ...r, conversion: r.leads ? Math.round((r.won / r.leads) * 100) : 0 }))
    .sort((a, b) => b.won - a.won || b.leads - a.leads)
}

/** Plot inventory per project, from the plots stored on each property. */
export function inventoryByProject(properties) {
  return properties
    .map((p) => {
      const plots = ensurePlotUids(Array.isArray(p.plots) ? p.plots : [])
      const counts = { Available: 0, Booked: 0, Sold: 0, Blocked: 0 }
      let availableValue = 0
      for (const pl of plots) {
        const g = statusGroup(pl.status)
        counts[g] = (counts[g] || 0) + 1
        if (g === 'Available') availableValue += Number(pl.price) || 0
      }
      const total = plots.length
      return {
        id: p.id || p.projectId,
        name: p.name || p.projectName || 'Untitled project',
        location: p.location || [p.village, p.district].filter(Boolean).join(', '),
        total,
        ...counts,
        availableValue,
        sellThrough: total ? Math.round(((counts.Sold + counts.Booked) / total) * 100) : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export function visitOutcomes(visits) {
  const groups = { Upcoming: 0, Completed: 0, Cancelled: 0, Pending: 0 }
  for (const v of visits) {
    const s = String(v.status || '')
    if (/complete/i.test(s)) groups.Completed += 1
    else if (/cancel/i.test(s)) groups.Cancelled += 1
    else if (/pending/i.test(s)) groups.Pending += 1
    else groups.Upcoming += 1
  }
  return Object.entries(groups).map(([label, count]) => ({ label, count }))
}

/** CSV download built in the browser from rows already on screen. */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))]
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fmtDate = (v) => {
  const d = toDate(v)
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
