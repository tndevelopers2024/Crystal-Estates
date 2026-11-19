import React, { useEffect, useState } from 'react'
import { User, Phone, Mail, FileText, Receipt, ExternalLink, Loader2, Share2 } from 'lucide-react'
import SidePanel from './SidePanel'
import { fetchDocuments, getDocumentShareUrl } from '../../lib/api'
import { formatRupees } from '../../lib/plotUtils'

const fmtDate = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? String(d || '—') : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * One customer's payment and document history, grouped by plot.
 */
export default function CustomerHistoryDrawer({ lead, open, onClose, payments = [], onShareDocument }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !lead?.id) return
    let active = true
    setLoading(true)
    fetchDocuments({ leadId: lead.id })
      .then((d) => active && setDocs(d.documents || []))
      .catch(() => active && setDocs([]))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, lead?.id])

  const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const byPlot = payments.reduce((acc, p) => {
    const key = p.plotNo ? `${p.property} · Plot ${p.plotNo}` : p.property || 'Unassigned'
    ;(acc[key] = acc[key] || []).push(p)
    return acc
  }, {})

  return (
    <SidePanel open={open} onClose={onClose} title={lead?.name || 'Customer'} subtitle="Payments & documents history" icon={User}>
      <div className="h-full overflow-y-auto p-5 space-y-6">
        {lead && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {lead.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {lead.phone}
              </span>
            )}
            {lead.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {lead.email}
              </span>
            )}
            {lead.property && <span>{lead.property}</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total paid</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatRupees(total)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Documents</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{loading ? '…' : docs.length}</p>
          </div>
        </div>

        {onShareDocument && (
          <div className="flex flex-wrap gap-2">
            {['Payment statement', 'Booking confirmation', 'Payment receipt'].map((t) => (
              <button key={t} type="button" onClick={() => onShareDocument(t)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-[#0F3D2E] hover:text-[#0F3D2E]">
                <Share2 className="w-3.5 h-3.5" /> {t}
              </button>
            ))}
          </div>
        )}

        <section>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Payments</h3>
          {payments.length === 0 ? (
            <p className="text-xs text-slate-400">No payments recorded for this customer.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(byPlot).map(([plot, list]) => (
                <div key={plot} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <p className="px-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-700 flex justify-between gap-2">
                    <span className="truncate">{plot}</span>
                    <span>{formatRupees(list.reduce((s, p) => s + (Number(p.amount) || 0), 0))}</span>
                  </p>
                  <ul className="divide-y divide-slate-100">
                    {list.map((p) => (
                      <li key={p.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-slate-400" /> {p.paymentFor}
                          </p>
                          <p className="text-xs text-slate-500">{[p.mode, p.referenceNo].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900">{formatRupees(p.amount)}</p>
                          <p className="text-[11px] text-slate-400">{fmtDate(p.paidOn || p.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Documents shared</h3>
          {loading ? (
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </p>
          ) : docs.length === 0 ? (
            <p className="text-xs text-slate-400">No documents shared with this customer yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {docs.map((d) => (
                <li key={d.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {d.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {d.number}
                      {d.plotNo ? ` · Plot ${d.plotNo}` : ''} · {fmtDate(d.createdAt)}
                    </p>
                  </div>
                  <a href={getDocumentShareUrl(d)} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Open ${d.title}`}>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SidePanel>
  )
}
