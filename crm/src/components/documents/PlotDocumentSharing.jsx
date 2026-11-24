import React, { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Image as ImageIcon,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Mail,
  FolderOpen,
  RotateCcw,
  History,
  Info,
} from 'lucide-react'
import { PreviewModal, usePlotDocuments } from '../properties/PlotDocuments'
import { fetchShareConfig, fetchShareHistory, sendPlotDocuments, formatBytes } from '../../lib/plotDocumentsApi'

/*
 * Building blocks for sending plot documents to a customer. Used by the
 * Record payment forms, the plot's Payments tab and the Send Document page.
 * All data is live: documents come from plot_documents, delivery from the
 * server (WhatsApp Business API / SMTP), history from document_shares.
 */

const fmtDate = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
const fmtDateTime = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
const typeTag = (doc) => (doc.ext === 'pdf' ? 'PDF' : doc.ext === 'png' ? 'PNG' : 'JPG')
const iconBtn = 'p-1.5 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-slate-100 transition'

/** Channel availability from the server (cached for the session). */
let configCache = null
export function useShareConfig() {
  const [config, setConfig] = useState(configCache)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (configCache) return undefined
    let active = true
    fetchShareConfig()
      .then((c) => {
        configCache = c
        if (active) setConfig(c)
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [])
  return { config, error }
}

/* ── Document checklist ──────────────────────────────────── */
export function PlotDocumentChecklist({ documents, loading, error, onRetry, selected, onChange, emptyHint, multiple = true }) {
  const [preview, setPreview] = useState(null)
  const toggle = (id) => {
    if (!multiple) return onChange(selected[0] === id ? [] : [id])
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  if (loading && !documents.length) {
    return (
      <p className="text-xs text-slate-500 flex items-center gap-2 py-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading this plot's documents…
      </p>
    )
  }
  if (error) {
    return (
      <p className="text-xs text-rose-600 flex flex-wrap items-center gap-2 py-2">
        <AlertCircle className="w-3.5 h-3.5" /> {error}
        {onRetry && (
          <button type="button" onClick={onRetry} className="font-bold text-[#0F3D2E] hover:underline">
            Retry
          </button>
        )}
      </p>
    )
  }
  if (!documents.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
        <FolderOpen className="w-5 h-5 text-slate-400 mx-auto" />
        <p className="text-xs font-semibold text-slate-600 mt-1.5">No documents for this plot yet</p>
        {emptyHint && <p className="text-[11px] text-slate-500 mt-0.5">{emptyHint}</p>}
      </div>
    )
  }

  return (
    <>
      <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto" role="group" aria-label="Plot documents">
        {documents.map((d) => {
          const on = selected.includes(d.id)
          return (
            <li key={d.id} className={`flex items-center gap-2 px-3 py-2 ${on ? 'bg-[#E2EDE8]/60' : ''}`}>
              <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                <input type={multiple ? 'checkbox' : 'radio'} name="plot-docs" className="w-4 h-4 accent-[#0F3D2E] shrink-0" checked={on} onChange={() => toggle(d.id)} />
                {d.ext === 'pdf' ? <FileText className="w-4 h-4 text-[#0F3D2E] shrink-0" /> : <ImageIcon className="w-4 h-4 text-[#0F3D2E] shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-800 truncate">{d.label}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {d.name} · {typeTag(d)} · {formatBytes(d.size)} · {fmtDate(d.replacedAt || d.createdAt)}
                  </span>
                </span>
              </label>
              <button type="button" className={iconBtn} onClick={() => setPreview(d)} aria-label={`Preview ${d.label}`} title="Preview">
                <Eye className="w-4 h-4" />
              </button>
            </li>
          )
        })}
      </ul>
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </>
  )
}

/* ── WhatsApp / email choice ─────────────────────────────── */
/**
 * recipient: { name, phone, email } as registered (display only; the server
 * looks the details up again when sending).
 */
export function ShareChannelPicker({ config, recipient, channels, onChange, disabled }) {
  const set = (c, on) => onChange(on ? [...new Set([...channels, c])] : channels.filter((x) => x !== c))
  const rows = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: MessageCircle,
      contact: recipient?.phone,
      missing: 'No WhatsApp number on record',
      ready: config?.whatsapp?.configured && config?.whatsapp?.publicLinks,
      note: config ? config.whatsapp?.message : null,
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      contact: recipient?.email,
      missing: 'No email address on record',
      ready: config?.email?.configured,
      note: config ? config.email?.message : null,
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {rows.map((r) => {
        const Icon = r.icon
        const can = Boolean(r.contact) && r.ready && !disabled
        const on = channels.includes(r.id)
        return (
          <label
            key={r.id}
            className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${on ? 'border-[#0F3D2E] bg-[#E2EDE8]/50' : 'border-slate-200 bg-white'} ${can ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}
          >
            <input type="checkbox" className="w-4 h-4 mt-0.5 accent-[#0F3D2E]" checked={on && can} disabled={!can} onChange={(e) => set(r.id, e.target.checked)} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Icon className="w-3.5 h-3.5" /> {r.label}
              </span>
              <span className="block text-[11px] text-slate-500 truncate">{r.contact || r.missing}</span>
              {!config ? (
                <span className="block text-[11px] text-slate-400">Checking setup…</span>
              ) : !r.ready && r.note ? (
                <span className="block text-[11px] text-amber-700 mt-0.5">{r.note}</span>
              ) : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/* ── Per-channel results ─────────────────────────────────── */
export function ShareResults({ results, onRetry, retrying }) {
  if (!results?.length) return null
  const failed = results.some((r) => r.status !== 'sent')
  return (
    <div className="space-y-1.5" aria-live="polite">
      {results.map((r) => {
        const ok = r.status === 'sent'
        const label = r.channel === 'email' ? 'Email' : 'WhatsApp'
        return (
          <div key={r.channel} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            {ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" /> : <XCircle className="w-4 h-4 shrink-0 mt-px" />}
            <span className="min-w-0">
              <b>{label}:</b>{' '}
              {ok
                ? `${r.channel === 'email' ? 'accepted by the mail server' : 'accepted by WhatsApp'}${r.to ? ` for ${r.channel === 'whatsapp' ? `+${r.to}` : r.to}` : ''}${r.duplicate ? ' (already sent earlier, not sent again)' : ''}${r.delivery === 'link' ? ' · sent as secure links (files too large to attach)' : ''}`
                : r.error || 'Not sent'}
            </span>
          </div>
        )
      })}
      {failed && onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F3D2E] hover:underline disabled:opacity-50">
          {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Retry failed
        </button>
      )}
    </div>
  )
}

/**
 * Send with a stable key; "Retry failed" re-sends only the channels that
 * failed (the server skips channels already sent for that key).
 */
export function useDocumentSender() {
  const [state, setState] = useState({ sending: false, results: null, error: null, request: null })
  const send = useCallback(async (request) => {
    setState((s) => ({ ...s, sending: true, error: null, request }))
    try {
      const res = await sendPlotDocuments(request)
      setState({ sending: false, results: res.results, error: null, request })
      return res.results
    } catch (err) {
      setState({ sending: false, results: null, error: err.message, request })
      return null
    }
  }, [])
  const retry = useCallback(() => {
    if (!state.request || !state.results) return null
    const channels = state.results.filter((r) => r.status !== 'sent').map((r) => r.channel)
    return channels.length ? send({ ...state.request, channels }).then((r) => {
      // keep successful channels from the first try in the list
      if (r) setState((s) => ({ ...s, results: [...state.results.filter((x) => x.status === 'sent'), ...r] }))
      return r
    }) : null
  }, [state, send])
  const reset = useCallback(() => setState({ sending: false, results: null, error: null, request: null }), [])
  return { ...state, send, retry, reset }
}

/* ── Sharing history ─────────────────────────────────────── */
export function ShareHistory({ filter, refreshKey, title = 'Sharing history', compact = false }) {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const key = JSON.stringify(filter || {})

  useEffect(() => {
    let active = true
    const t = setTimeout(() => {
      setLoading(true)
      fetchShareHistory({ ...(filter || {}), limit: compact ? 20 : 100 })
        .then((d) => active && (setShares(d.shares || []), setError(null)))
        .catch((err) => active && setError(err.message))
        .finally(() => active && setLoading(false))
    }, 0)
    return () => {
      active = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey, compact])

  return (
    <section>
      <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" /> {title}
      </p>
      {loading && !shares.length ? (
        <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>
      ) : error ? (
        <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
      ) : !shares.length ? (
        <p className="text-xs text-slate-400">Nothing has been sent yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {shares.map((s) => {
            const ok = s.status === 'sent'
            const Icon = s.channel === 'email' ? Mail : MessageCircle
            return (
              <li key={s.id} className="px-3 py-2.5 flex items-start gap-2.5">
                <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{(s.documents || []).map((d) => d.label).join(', ') || 'Documents'}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {s.recipient?.name || 'Customer'}
                    {s.to ? ` · ${s.channel === 'whatsapp' ? `+${s.to}` : s.to}` : ''}
                    {!compact && s.plotNo ? ` · Plot ${s.plotNo}${s.propertyName ? `, ${s.propertyName}` : ''}` : ''}
                    {s.payment ? ` · with ${s.payment.paymentFor || 'payment'}` : ''}
                  </p>
                  {!ok && s.error && <p className="text-[11px] text-rose-600 mt-0.5">{s.error}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] font-bold ${ok ? 'text-emerald-700' : 'text-rose-600'}`}>{ok ? 'Sent' : 'Failed'}</p>
                  <p className="text-[10.5px] text-slate-400">{fmtDateTime(s.sentAt || s.createdAt)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Small reminder that nothing is sent without the user's choice. */
export function ConsentNote() {
  return (
    <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
      <Info className="w-3.5 h-3.5 shrink-0 mt-px" /> Nothing is sent unless you tick WhatsApp or Email. Messages go to the customer's registered number and email.
    </p>
  )
}


/* ── Inside a Record payment form ────────────────────────── */
/**
 * Shows the selected plot's documents (refreshes when the plot changes) and,
 * once one is picked, the WhatsApp / email choice for sending it with the
 * payment confirmation after the payment is saved.
 */
export function PaymentDocumentSection({ plotRef, recipient, docIds, onDocIds, channels, onChannels }) {
  const ready = Boolean(plotRef.propertyId && plotRef.plotNo)
  const docsState = usePlotDocuments({ ...plotRef, enabled: ready })
  const { config } = useShareConfig()

  if (!ready) {
    return <p className="text-[11px] text-slate-500">Select a plot to see its documents and send them with the payment confirmation.</p>
  }
  return (
    <div className="space-y-3">
      <PlotDocumentChecklist
        documents={docsState.documents}
        loading={docsState.loading}
        error={docsState.error}
        onRetry={docsState.reload}
        selected={docIds}
        onChange={onDocIds}
        emptyHint="Upload documents from the plot's Edit details or the Send Document page."
      />
      {docIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">Send {docIds.length === 1 ? 'it' : `these ${docIds.length}`} with the payment confirmation</p>
          <ShareChannelPicker config={config} recipient={recipient} channels={channels} onChange={onChannels} />
          <ConsentNote />
        </div>
      )}
    </div>
  )
}
