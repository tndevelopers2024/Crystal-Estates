import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Paperclip,
} from 'lucide-react'
import { useDialog } from '../../context/DialogContext'
import {
  PLOT_DOC_ACCEPT,
  PLOT_DOC_MAX_MB,
  listPlotDocuments,
  uploadPlotDocument,
  replacePlotDocument,
  renamePlotDocument,
  deletePlotDocument,
  plotDocumentBlobUrl,
  downloadPlotDocument,
  plotDocumentProblem,
  formatBytes,
} from '../../lib/plotDocumentsApi'

const inputCls =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
const iconBtn = 'p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-slate-100 transition disabled:opacity-40'

const fmtDate = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
const labelFromName = (name) => name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 120)
const TypeIcon = ({ doc, className = 'w-5 h-5' }) => (doc.ext === 'pdf' ? <FileText className={className} /> : <ImageIcon className={className} />)
const typeTag = (doc) => (doc.ext === 'pdf' ? 'PDF' : doc.ext === 'png' ? 'PNG' : 'JPG')

/** Documents of one plot, loaded from the server. */
export function usePlotDocuments({ propertyId, plotUid, plotNo, phase, enabled = true }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!enabled || !propertyId || (!plotUid && !plotNo)) return
    setLoading(true)
    setError(null)
    try {
      const data = await listPlotDocuments({ propertyId, plotUid, plotNo, phase })
      setDocuments(data.documents || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [enabled, propertyId, plotUid, plotNo, phase])

  useEffect(() => {
    setDocuments([])
    const t = setTimeout(reload, 0)
    return () => clearTimeout(t)
  }, [reload])

  return { documents, setDocuments, loading, error, reload }
}

/* ── Preview ─────────────────────────────────────────────── */
export function PreviewModal({ doc, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    let made = null
    plotDocumentBlobUrl(doc.id)
      .then((u) => {
        made = u
        if (active) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch((err) => active && setError(err.message))
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      active = false
      document.removeEventListener('keydown', onKey)
      if (made) URL.revokeObjectURL(made)
    }
  }, [doc.id, onClose])

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Preview ${doc.label}`} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{doc.label}</p>
            <p className="text-[11px] text-slate-500 truncate">{doc.name}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className={iconBtn} onClick={() => downloadPlotDocument(doc).catch(() => {})} aria-label="Download">
              <Download className="w-4 h-4" />
            </button>
            <button type="button" className={iconBtn} onClick={onClose} aria-label="Close preview">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
          {error ? (
            <p className="text-sm text-rose-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>
          ) : !url ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : doc.ext === 'pdf' ? (
            <iframe title={doc.label} src={url} className="w-full h-full bg-white" />
          ) : (
            <img src={url} alt={doc.label} className="max-w-full max-h-full object-contain" />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── One stored document ─────────────────────────────────── */
function DocumentRow({ doc, canEdit, onChanged, onRemoved, onPreview, onShowToast, selectable, checked, onCheck }) {
  const { confirm } = useDialog()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(doc.label)
  const [busy, setBusy] = useState(null) // 'label' | 'replace' | 'delete' | 'download'
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [error, setError] = useState(null)
  const replaceRef = useRef(null)

  const saveLabel = async (e) => {
    e?.preventDefault()
    const v = label.trim()
    if (!v) return setError('Label cannot be empty.')
    if (v === doc.label) return setEditing(false)
    setBusy('label')
    setError(null)
    try {
      const res = await renamePlotDocument(doc.id, v)
      onChanged(res.document)
      setEditing(false)
      onShowToast?.('Label updated', 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const replace = async (file) => {
    const problem = plotDocumentProblem(file)
    if (problem) return setError(problem)
    const ok = await confirm({ title: 'Replace file', message: `Replace “${doc.name}” with “${file.name}”? The label stays “${doc.label}”, and the old file is removed.`, confirmText: 'Replace', cancelText: 'Cancel' })
    if (!ok) return
    setBusy('replace')
    setError(null)
    setProgress(0)
    try {
      const res = await replacePlotDocument(doc.id, file, { onProgress: setProgress, onStage: setStage })
      onChanged(res.document)
      onShowToast?.(`“${doc.label}” replaced`, 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    const ok = await confirm({ title: 'Delete document', message: `Delete “${doc.label}” (${doc.name}) from this plot? This cannot be undone, and links already shared for it stop working.`, confirmText: 'Delete', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    setBusy('delete')
    setError(null)
    try {
      await deletePlotDocument(doc.id)
      onRemoved(doc.id)
      onShowToast?.(`“${doc.label}” deleted`, 'info')
    } catch (err) {
      setError(err.message)
      setBusy(null)
    }
  }

  const download = async () => {
    setBusy('download')
    setError(null)
    try {
      await downloadPlotDocument(doc)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const saved = doc.originalSize > doc.size ? Math.round((1 - doc.size / doc.originalSize) * 100) : 0

  return (
    <li className={`p-3 ${checked ? 'bg-[#E2EDE8]/50' : ''}`}>
      <div className="flex items-start gap-3">
        {selectable && (
          <input type="checkbox" className="w-4 h-4 mt-3 accent-[#0F3D2E] shrink-0" checked={Boolean(checked)} onChange={(e) => onCheck(e.target.checked)} aria-label={`Select ${doc.label}`} />
        )}
        <button type="button" onClick={() => onPreview(doc)} className="w-10 h-10 rounded-xl bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center shrink-0 hover:bg-[#d1e4dc]" aria-label={`Preview ${doc.label}`}>
          <TypeIcon doc={doc} />
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveLabel} className="flex items-center gap-1.5">
              <input className={`${inputCls} !py-1.5`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} autoFocus aria-label="Document label" onKeyDown={(e) => e.key === 'Escape' && (setEditing(false), setLabel(doc.label))} />
              <button type="submit" className={iconBtn} disabled={busy === 'label'} aria-label="Save label">
                {busy === 'label' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button type="button" className={iconBtn} onClick={() => (setEditing(false), setLabel(doc.label), setError(null))} aria-label="Cancel">
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{doc.label}</p>
              {canEdit && (
                <button type="button" onClick={() => setEditing(true)} className="p-1 rounded-md text-slate-400 hover:text-[#0F3D2E] hover:bg-slate-100 shrink-0" aria-label={`Edit label of ${doc.label}`} title="Edit label">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-slate-500 truncate mt-0.5" title={doc.name}>{doc.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 font-bold text-slate-600">{typeTag(doc)}</span>
            <span>{formatBytes(doc.size)}</span>
            {saved >= 5 && <span className="text-emerald-700">compressed {saved}%</span>}
            <span>· {fmtDate(doc.replacedAt || doc.createdAt)}</span>
            {doc.uploadedBy?.name && <span className="truncate">· {doc.uploadedBy.name}</span>}
          </div>
        </div>
        <div className="flex items-center shrink-0 -mr-1">
          <button type="button" className={iconBtn} onClick={() => onPreview(doc)} aria-label={`Preview ${doc.label}`} title="Preview">
            <Eye className="w-4 h-4" />
          </button>
          <button type="button" className={iconBtn} onClick={download} disabled={busy === 'download'} aria-label={`Download ${doc.label}`} title="Download">
            {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          {canEdit && (
            <>
              <button type="button" className={iconBtn} onClick={() => replaceRef.current?.click()} disabled={Boolean(busy)} aria-label={`Replace ${doc.label}`} title="Replace file">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button type="button" className={`${iconBtn} hover:!text-rose-600 hover:!bg-rose-50`} onClick={remove} disabled={Boolean(busy)} aria-label={`Delete ${doc.label}`} title="Delete">
                {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
              <input
                ref={replaceRef}
                type="file"
                accept={PLOT_DOC_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) replace(f)
                }}
              />
            </>
          )}
        </div>
      </div>
      {busy === 'replace' && <ProgressLine stage={stage} progress={progress} />}
      {error && <p className="mt-2 text-[11px] text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}
    </li>
  )
}

function ProgressLine({ stage, progress }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
        <span>{stage || 'Uploading…'}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span className="block h-full bg-[#0F3D2E] transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

/* ── Manager shown inside Edit details ──────────────────── */
/**
 * canEdit: rename / replace / delete. canUpload defaults to canEdit.
 * selectable + selected + onSelectedChange: tick documents (Send Document page);
 * new uploads are ticked automatically there.
 */
export function PlotDocumentsManager({
  plotRef,
  docsState,
  canEdit,
  canUpload = canEdit,
  onShowToast,
  onChanged,
  selectable = false,
  selected = [],
  onSelectedChange,
  bare = false,
  deferred = false,
  stagedItems = null,
  onStagedItemsChange = null,
}) {
  const { documents, setDocuments, loading, error, reload } = docsState
  const [internalQueue, setInternalQueue] = useState([]) // { key, file, label, status, progress, stage, error }
  const queue = deferred && Array.isArray(stagedItems) ? stagedItems : internalQueue
  const setQueue = deferred && onStagedItemsChange ? onStagedItemsChange : setInternalQueue
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)
  const uploading = queue.some((q) => q.status === 'uploading')

  const addFiles = (files) => {
    const items = Array.from(files || []).map((file, i) => {
      const problem = plotDocumentProblem(file)
      return { key: `${Date.now()}-${i}-${file.name}`, file, label: labelFromName(file.name), status: problem ? 'invalid' : 'ready', progress: 0, stage: '', error: problem }
    })
    if (items.length) setQueue((q) => [...q, ...items])
  }
  const patch = (key, p) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)))

  const uploadAll = async () => {
    const ready = queue.filter((q) => q.status === 'ready' || q.status === 'failed')
    const missing = ready.find((q) => !q.label.trim())
    if (missing) return patch(missing.key, { error: 'Add a label for this document.' })
    let done = 0
    for (const item of ready) {
      patch(item.key, { status: 'uploading', progress: 0, error: null })
      try {
        const res = await uploadPlotDocument({
          ...plotRef,
          label: item.label.trim(),
          file: item.file,
          onProgress: (progress) => patch(item.key, { progress }),
          onStage: (stage) => patch(item.key, { stage }),
        })
        setDocuments((d) => [res.document, ...d])
        if (selectable) onSelectedChange?.((ids) => [...ids, res.document.id])
        patch(item.key, { status: 'done', progress: 100 })
        done += 1
      } catch (err) {
        patch(item.key, { status: 'failed', error: err.message })
      }
    }
    if (done) {
      onShowToast?.(`${done} document${done === 1 ? '' : 's'} uploaded`, 'success')
      onChanged?.()
      setTimeout(() => setQueue((q) => q.filter((x) => x.status !== 'done')), 1200)
    }
  }

  const pending = queue.filter((q) => q.status !== 'done')
  const readyCount = queue.filter((q) => q.status === 'ready' || q.status === 'failed').length

  return (
    <section className={bare ? '' : 'pt-4 border-t border-slate-100'} aria-labelledby="plot-docs-title">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p id="plot-docs-title" className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Documents {documents.length > 0 && <span className="text-slate-400">({documents.length})</span>}
        </p>
        {error && (
          <button type="button" onClick={reload} className="text-xs font-bold text-[#0F3D2E] hover:underline">
            Retry
          </button>
        )}
      </div>

      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            addFiles(e.dataTransfer.files)
          }}
          className={`rounded-xl border-2 border-dashed p-4 text-center transition ${dragging ? 'border-[#0F3D2E] bg-[#E2EDE8]/60' : 'border-slate-200 bg-slate-50/60'}`}
        >
          <UploadCloud className="w-6 h-6 text-[#0F3D2E] mx-auto" />
          <p className="text-xs font-semibold text-slate-700 mt-1.5">
            Drop files here or{' '}
            <button type="button" onClick={() => inputRef.current?.click()} className="text-[#0F3D2E] font-bold hover:underline">
              browse
            </button>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">PDF, JPG or PNG · up to {PLOT_DOC_MAX_MB} MB each · images are compressed automatically</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={PLOT_DOC_ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 divide-y divide-slate-100">
          {pending.map((q) => (
            <div key={q.key} className="p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor={`lbl-${q.key}`}>Label for {q.file.name}</label>
                  <input
                    id={`lbl-${q.key}`}
                    className={`${inputCls} !py-1.5`}
                    value={q.label}
                    onChange={(e) => patch(q.key, { label: e.target.value, error: q.status === 'invalid' ? q.error : null })}
                    placeholder="Label, e.g. Sale deed"
                    maxLength={120}
                    disabled={q.status === 'uploading' || q.status === 'invalid'}
                  />
                  <p className="text-[11px] text-slate-500 truncate mt-1">{q.file.name} · {formatBytes(q.file.size)}</p>
                </div>
                {q.status !== 'uploading' && (
                  <button type="button" className={iconBtn} onClick={() => setQueue((x) => x.filter((i) => i.key !== q.key))} aria-label={`Remove ${q.file.name} from the list`}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {q.status === 'uploading' && <ProgressLine stage={q.stage} progress={q.progress} />}
              {q.error && <p className="mt-1.5 text-[11px] text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {q.error}</p>}
            </div>
          ))}
          {readyCount > 0 && !deferred && (
            <div className="p-3 flex justify-end">
              <button type="button" onClick={uploadAll} disabled={uploading} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                Upload {readyCount} {readyCount === 1 ? 'file' : 'files'}
              </button>
            </div>
          )}
          {readyCount > 0 && deferred && (
            <div className="px-3 py-2 bg-slate-50/70 text-[11px] text-slate-600">
              {readyCount} {readyCount === 1 ? 'document' : 'documents'} ready — will upload automatically when you add the plot.
            </div>
          )}
        </div>
      )}
      {queue.some((q) => q.status === 'done') && (
        <p className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</p>
      )}

      {!deferred && (
      <div className="mt-3">
        {loading && documents.length === 0 ? (
          <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading documents…</p>
        ) : error ? (
          <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-slate-400">No documents for this plot yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {documents.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                canEdit={canEdit}
                selectable={selectable}
                checked={selected.includes(d.id)}
                onCheck={(on) => onSelectedChange?.((ids) => (on ? [...new Set([...ids, d.id])] : ids.filter((x) => x !== d.id)))}
                onPreview={setPreview}
                onShowToast={onShowToast}
                onChanged={(next) => {
                  setDocuments((list) => list.map((x) => (x.id === next.id ? next : x)))
                  onChanged?.()
                }}
                onRemoved={(id) => {
                  setDocuments((list) => list.filter((x) => x.id !== id))
                  if (selectable) onSelectedChange?.((ids) => ids.filter((x) => x !== id))
                  onChanged?.()
                }}
              />
            ))}
          </ul>
        )}
      </div>
      )}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </section>
  )
}
