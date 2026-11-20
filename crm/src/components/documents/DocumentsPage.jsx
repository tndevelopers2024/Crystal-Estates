import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Share2,
  Search,
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Copy,
  Mail,
  MessageCircle,
  CheckCircle2,
  Eye,
  X,
  FileUp,
} from 'lucide-react'
import {
  fetchDocuments,
  fetchAllPayments,
  renderDocumentPreview,
  createDocument,
  deleteDocument,
  uploadDocument,
  getDocumentShareUrl,
  getApiUrl,
} from '../../lib/api'
import { useOptions } from '../../hooks/useOptions'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../context/DialogContext'
import EditableSelect from '../common/EditableSelect'
import SearchSelect from '../common/SearchSelect'
import CustomerPlotPicker from '../common/CustomerPlotPicker'
import SidePanel from '../common/SidePanel'
import { formatRupees } from '../../lib/plotUtils'

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

const DEFAULT_TYPES = ['Payment receipt', 'Booking confirmation', 'Payment statement', 'Allotment letter', 'Cost sheet', 'Other document']
const GENERATED = /receipt|booking|statement/i
const DEFAULT_MESSAGE = 'Hi, please find your document from Crystal Estates. You can view or download it using the link below.'

const fmtDate = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? String(d || '—') : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** wa.me needs international digits only; assume India for 10-digit numbers */
function whatsappNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length === 10) return `91${d}`
  return d
}

function shareText(doc, message) {
  return `${message || DEFAULT_MESSAGE}\n\n${doc.title} (${doc.number}): ${getDocumentShareUrl(doc)}`
}

/* ── File drop zone ─────────────────────────────────────────────── */
function FileDrop({ file, onFile, uploading }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const pick = (f) => f && onFile(f)

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
            <p className="text-[11px] text-slate-500">{file.sizeFormatted || file.size}</p>
          </div>
        </div>
        <button type="button" onClick={() => onFile(null)} className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg" aria-label="Remove file">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        pick(e.dataTransfer.files?.[0])
      }}
      className={`rounded-xl border-2 border-dashed p-6 text-center transition ${over ? 'border-[#0F3D2E] bg-[#E2EDE8]/50' : 'border-slate-300 bg-slate-50/60'}`}
    >
      {uploading ? (
        <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
        </p>
      ) : (
        <>
          <FileUp className="w-6 h-6 text-slate-500 mx-auto" />
          <p className="text-sm font-bold text-slate-800 mt-2">Drop a PDF or image here</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 text-xs font-bold text-[#0F3D2E] hover:underline">
            or click to upload
          </button>
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </>
      )}
    </div>
  )
}

/* ── Share flow (form + live preview → share step) ─────────────── */
function ShareDocumentFlow({ leads, properties, payments, initial, actor, onCreated, onClose }) {
  const types = useOptions('documentType', DEFAULT_TYPES)
  const [target, setTarget] = useState({
    leadId: initial.leadId || '',
    propertyId: initial.propertyId || '',
    plotUid: initial.plotUid || '',
    plotNo: initial.plotNo || '',
    phase: '',
  })
  const [type, setType] = useState(initial.type || 'Payment receipt')
  const [paymentId, setPaymentId] = useState(initial.paymentId || '')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState({ html: '', loading: false, error: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showPreviewMobile, setShowPreviewMobile] = useState(false)

  const isGenerated = GENERATED.test(type)
  const isReceipt = /receipt/i.test(type)
  const lead = leads.find((l) => l.id === target.leadId)
  const leadPayments = useMemo(() => payments.filter((p) => p.leadId === target.leadId), [payments, target.leadId])

  // Default the receipt to the customer's latest payment
  useEffect(() => {
    if (isReceipt && !leadPayments.some((p) => p.id === paymentId)) setPaymentId(leadPayments[0]?.id || '')
  }, [isReceipt, leadPayments, paymentId])

  const draft = useMemo(
    () => ({
      leadId: target.leadId,
      propertyId: target.propertyId,
      plotUid: target.plotUid,
      plotNo: target.plotNo,
      phase: target.phase,
      type,
      title: title.trim() || type,
      message,
      paymentId: isReceipt ? paymentId : '',
      file: file ? { url: file.url, name: file.name, size: file.sizeFormatted } : null,
    }),
    [target, type, title, message, isReceipt, paymentId, file],
  )

  // Live preview, debounced
  useEffect(() => {
    if (!target.leadId) {
      setPreview({ html: '', loading: false, error: null })
      return
    }
    let active = true
    setPreview((p) => ({ ...p, loading: true }))
    const t = setTimeout(() => {
      renderDocumentPreview(draft)
        .then((d) => active && setPreview({ html: d.html, loading: false, error: null }))
        .catch((err) => active && setPreview({ html: '', loading: false, error: err.message }))
    }, 350)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [draft, target.leadId])

  const handleFile = async (f) => {
    if (!f) return setFile(null)
    if (f.size > 20 * 1024 * 1024) return setError('Files must be under 20 MB.')
    setError(null)
    setUploading(true)
    try {
      const res = await uploadDocument(f)
      setFile({ url: res.url, name: res.name || f.name, sizeFormatted: res.sizeFormatted, mime: f.type })
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!target.leadId) return setError('Select a customer.')
    if (isReceipt && !paymentId) return setError('This customer has no payment to issue a receipt for. Record a payment first.')
    if (!isGenerated && !file) return setError('Upload the document file to share.')
    setSaving(true)
    try {
      const res = await createDocument({ ...draft, actor })
      setCreated(res.document)
      onCreated(res.document)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const fileUrl = file ? getApiUrl(file.url) : null

  /* Share step */
  if (created) {
    const text = shareText(created, message)
    const phone = whatsappNumber(lead?.phone)
    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    return (
      <div className="h-full overflow-y-auto p-6 sm:p-8">
        <div className="max-w-md mx-auto text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 mt-3">Document ready to share</h3>
          <p className="text-sm text-slate-500 mt-1">
            {created.title} · {created.number} for {lead?.name || 'the customer'}
          </p>

          <div className="mt-6 grid gap-2.5 text-left">
            <a
              href={phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:brightness-95"
            >
              <MessageCircle className="w-5 h-5" /> Send on WhatsApp {lead?.phone ? `to ${lead.phone}` : ''}
            </a>
            <a
              href={`mailto:${encodeURIComponent(lead?.email || '')}?subject=${encodeURIComponent(`${created.title} — Crystal Estates`)}&body=${encodeURIComponent(text)}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-800 hover:border-slate-400"
            >
              <Mail className="w-5 h-5" /> Email {lead?.email ? `to ${lead.email}` : ''}
            </a>
            <button
              type="button"
              onClick={async () => {
                const url = getDocumentShareUrl(created)
                try {
                  await navigator.clipboard.writeText(url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  setCopied(false)
                }
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-800 hover:border-slate-400"
            >
              <Copy className="w-5 h-5" /> {copied ? 'Link copied' : 'Copy link'}
            </button>
            {canNativeShare && (
              <button
                type="button"
                onClick={() => navigator.share({ title: created.title, text: message, url: getDocumentShareUrl(created) }).catch(() => {})}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-800 hover:border-slate-400"
              >
                <Share2 className="w-5 h-5" /> More sharing options
              </button>
            )}
            <a href={getDocumentShareUrl(created)} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-[#0F3D2E] hover:bg-[#E2EDE8]">
              <ExternalLink className="w-5 h-5" /> Open document
            </a>
          </div>
          {!lead?.phone && <p className="text-xs text-amber-700 mt-3">This customer has no phone number saved, so WhatsApp will ask who to send it to.</p>}
          <button type="button" onClick={onClose} className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-800">
            Done
          </button>
        </div>
      </div>
    )
  }

  const previewPane = (
    <div className="h-full flex flex-col bg-slate-100">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Preview
        </p>
        {preview.loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>
      <div className="flex-1 min-h-[420px] overflow-auto p-3 space-y-3">
        {!target.leadId ? (
          <div className="h-full grid place-items-center text-center p-8">
            <div>
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500 mt-2">Select a customer to preview the document.</p>
            </div>
          </div>
        ) : preview.error ? (
          <p className="text-sm text-rose-600 p-4">{preview.error}</p>
        ) : (
          <iframe title="Document preview" srcDoc={preview.html} sandbox="" className="w-full h-[560px] bg-white rounded-xl border border-slate-200" />
        )}
        {fileUrl && (
          /\.pdf$/i.test(file.name) || file.mime === 'application/pdf' ? (
            <iframe title="Attached file" src={fileUrl} className="w-full h-[560px] bg-white rounded-xl border border-slate-200" />
          ) : /^image\//.test(file.mime || '') ? (
            <img src={fileUrl} alt="Attached file" className="w-full rounded-xl border border-slate-200 bg-white" />
          ) : (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="block p-4 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-[#0F3D2E]">
              Open attached file ({file.name})
            </a>
          )
        )}
      </div>
    </div>
  )

  return (
    <form onSubmit={submit} className="h-full flex flex-col">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="overflow-y-auto p-5 space-y-5 border-r border-slate-100">
          {error && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Customer &amp; plot</h3>
            <CustomerPlotPicker leads={leads} properties={properties} value={target} onChange={setTarget} plotLabel="Plot" />
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Document</h3>
            <EditableSelect
              label="Document type"
              required
              value={type}
              onChange={setType}
              options={types.options}
              onCreate={types.add}
              onDelete={types.remove}
              hint="Receipts, booking confirmations and statements are generated from the customer's data."
            />

            {isReceipt && (
              <SearchSelect
                label="Payment"
                required
                value={paymentId}
                onChange={setPaymentId}
                options={leadPayments.map((p) => ({
                  value: p.id,
                  label: `${formatRupees(p.amount)} · ${p.paymentFor}`,
                  sub: [p.mode, p.referenceNo, fmtDate(p.paidOn || p.createdAt)].filter(Boolean).join(' · '),
                }))}
                placeholder={target.leadId ? 'Select payment' : 'Select a customer first'}
                disabled={!target.leadId}
                emptyText="No payments for this customer yet"
              />
            )}

            <div>
              <p className={labelCls}>
                File {isGenerated ? <span className="text-slate-400 font-normal">(optional attachment)</span> : <span className="text-rose-500">*</span>}
              </p>
              <FileDrop file={file} onFile={handleFile} uploading={uploading} />
            </div>

            <div>
              <label htmlFor="sd-title" className={labelCls}>Title</label>
              <input id="sd-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type} />
            </div>
            <div>
              <label htmlFor="sd-msg" className={labelCls}>Message to customer</label>
              <textarea id="sd-msg" rows={3} className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </section>

          <button type="button" onClick={() => setShowPreviewMobile((v) => !v)} className="lg:hidden w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700">
            <Eye className="w-4 h-4" /> {showPreviewMobile ? 'Hide preview' : 'Show preview'}
          </button>
          {showPreviewMobile && <div className="lg:hidden rounded-xl overflow-hidden border border-slate-200">{previewPane}</div>}
        </div>

        <div className="hidden lg:block min-h-0">{previewPane}</div>
      </div>

      <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
        <button type="button" onClick={onClose} className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm">
          Cancel
        </button>
        <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Create &amp; get share link
        </button>
      </div>
    </form>
  )
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function DocumentsPage({ leads = [], properties = [], onShowToast }) {
  const { user } = useAuth()
  const { confirm, alert } = useDialog()
  const actor = useMemo(() => ({ name: user?.name || user?.email || 'CRM user', email: user?.email || '' }), [user])
  const [params, setParams] = useSearchParams()
  const types = useOptions('documentType', DEFAULT_TYPES)

  const [documents, setDocuments] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serverNeedsUpdate, setServerNeedsUpdate] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [shareInit, setShareInit] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setServerNeedsUpdate(false)
    try {
      const [d, p] = await Promise.all([fetchDocuments(), fetchAllPayments()])
      if (d?.serverNeedsUpdate) {
        setServerNeedsUpdate(true)
      }
      setDocuments(d?.documents || [])
      setPayments(p?.payments || [])
    } catch (err) {
      setError(err.message || 'Failed to load documents')
      onShowToast?.(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [onShowToast])

  useEffect(() => {
    load()
  }, [load])

  // Open the share flow from a link like /documents?share=Payment%20receipt&leadId=…
  useEffect(() => {
    const share = params.get('share')
    if (!share) return
    setShareInit({
      type: share,
      leadId: params.get('leadId') || '',
      paymentId: params.get('paymentId') || '',
      propertyId: params.get('propertyId') || '',
      plotUid: params.get('plotUid') || '',
      plotNo: params.get('plotNo') || '',
    })
    setParams({}, { replace: true })
  }, [params, setParams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false
      if (projectFilter && d.propertyId !== projectFilter) return false
      if (!q) return true
      return [d.title, d.number, d.snapshot?.customer?.name, d.snapshot?.customer?.phone, d.plotNo, d.snapshot?.project?.name].some((v) =>
        String(v || '').toLowerCase().includes(q),
      )
    })
  }, [documents, search, typeFilter, projectFilter])

  const handleDelete = async (d) => {
    const ok = await confirm({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${d.title}" (${d.number})? The customer's share link will stop working.`,
      tag: `${d.title} · ${d.number}`,
      confirmText: 'Delete Document',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    try {
      await deleteDocument(d.id)
      setDocuments((list) => list.filter((x) => x.id !== d.id))
      onShowToast?.('Document deleted', 'info')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  const copyLink = async (d) => {
    const url = getDocumentShareUrl(d)
    try {
      await navigator.clipboard.writeText(url)
      onShowToast?.('Link copied to clipboard', 'success')
    } catch {
      await alert({
        title: 'Document Link',
        message: `Share Link: ${url}`,
        confirmText: 'Done',
        type: 'info',
      })
    }
  }

  return (
    <div className="max-w-[1500px] mx-auto pb-10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Documents</h1>
          <p className="text-sm text-slate-500">Receipts, booking confirmations, statements and files shared with customers.</p>
        </div>
        <button type="button" onClick={() => setShareInit({})} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-sm font-bold rounded-xl">
          <Share2 className="w-4 h-4" /> Share document
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {['Payment receipt', 'Booking confirmation', 'Payment statement'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setShareInit({ type: t })}
            className="group text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#0F3D2E] transition"
          >
            <span className="w-9 h-9 rounded-xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center mb-3">
              {t.includes('receipt') ? <FileText className="w-4.5 h-4.5" /> : t.includes('Booking') ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Upload className="w-4.5 h-4.5 rotate-180" />}
            </span>
            <p className="text-sm font-bold text-slate-900">{t}</p>
            <p className="text-xs text-slate-500 mt-0.5">Generated from the customer's plot and payment data</p>
          </button>
        ))}
      </div>

      {serverNeedsUpdate && (
        <div role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900">API Server Redeploy Required</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              The live backend on Render (<code>https://crystal-estates.onrender.com</code>) is running a previous deployment without the <code>/api/documents</code> route. Please redeploy the latest commit on Render to enable live document saving and sharing.
            </p>
          </div>
        </div>
      )}

      {error && !serverNeedsUpdate && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 grid grid-cols-1 md:grid-cols-[1fr_220px_220px] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, number, plot…" className={`${inputCls} pl-9`} aria-label="Search documents" />
          </div>
          <SearchSelect value={typeFilter} onChange={setTypeFilter} options={types.options.map((t) => ({ value: t, label: t }))} placeholder="All types" clearable />
          <SearchSelect value={projectFilter} onChange={setProjectFilter} options={properties.map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects" clearable />
        </div>

        {loading ? (
          <p className="p-8 text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">{documents.length ? 'No documents match your filters' : 'No documents shared yet'}</p>
            <p className="text-xs text-slate-500 mt-1">Use “Share document” to send a receipt, statement or file to a customer.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((d) => (
              <li key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 grid place-items-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {d.title} <span className="font-medium text-slate-400">· {d.number}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {d.snapshot?.customer?.name || 'Customer'}
                      {d.snapshot?.project?.name ? ` · ${d.snapshot.project.name}` : ''}
                      {d.plotNo ? ` · Plot ${d.plotNo}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {fmtDate(d.createdAt)}
                      {d.createdBy?.name ? ` · by ${d.createdBy.name}` : ''}
                      {d.file ? ' · file attached' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:shrink-0">
                  <a
                    href={`https://wa.me/${whatsappNumber(d.snapshot?.customer?.phone)}?text=${encodeURIComponent(shareText(d, d.message))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#128C7E] hover:bg-emerald-50"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                  <button type="button" onClick={() => copyLink(d)} className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100" aria-label={`Copy link for ${d.title}`} title="Copy link">
                    <Copy className="w-4 h-4" />
                  </button>
                  <a href={getDocumentShareUrl(d)} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Open ${d.title}`} title="Open">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button type="button" onClick={() => handleDelete(d)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete ${d.title}`} title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SidePanel open={Boolean(shareInit)} onClose={() => setShareInit(null)} title="Share document" subtitle="Customer gets a secure link on WhatsApp, email or any app" icon={Share2} width="max-w-6xl">
        {shareInit && (
          <ShareDocumentFlow
            key={JSON.stringify(shareInit)}
            leads={leads}
            properties={properties}
            payments={payments}
            initial={shareInit}
            actor={actor}
            onCreated={(doc) => setDocuments((list) => [doc, ...list])}
            onClose={() => setShareInit(null)}
          />
        )}
      </SidePanel>
    </div>
  )
}
