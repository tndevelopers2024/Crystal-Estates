import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, FileText, Paperclip, Eye, Download, RefreshCw, Search, UploadCloud, X } from 'lucide-react'
import { Card, EmptyState, LoadingBlock, ErrorBlock, btnGhost, btnPrimary, inputCls } from '../common/PageKit'
import EditableSelect from '../common/EditableSelect'
import SearchSelect from '../common/SearchSelect'
import { useOptions } from '../../hooks/useOptions'
import { useDialog } from '../../context/DialogContext'
import { PLOT_DOC_ACCEPT, PLOT_DOC_MAX_MB, plotDocumentProblem } from '../../lib/plotDocumentsApi'
import { listLandDocuments, createLandDocument, updateLandDocument, deleteLandDocument, replaceLandDocumentFile, landDocumentBlobUrl, downloadBlobUrl } from '../../lib/landApi'
import { useAsync, DataTable, ExportButton, LandModal, Field, TextInput, SelectInput, FormError, DocStatus, FilePreview, DOC_STATUSES, DEFAULT_DOC_TYPES, fmtDate, formatBytes, todayIso } from './LandKit'

const blank = () => ({ docType: '', title: '', refNo: '', docDate: '', status: 'Received', heldBy: '', notes: '', plotId: '' })

function ProgressBar({ stage, progress }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
        <span>{stage || 'Uploading…'}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full bg-[#0F3D2E] transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

/** Add or edit a document log entry; a file (PDF / image) can be attached when adding. */
function DocumentModal({ project, plots, doc, onClose, onSaved }) {
  const types = useOptions('landDocumentType', DEFAULT_DOC_TYPES)
  const [f, setF] = useState(blank)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const fileRef = useRef(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    setError(null)
    setFile(null)
    setF(doc ? { docType: doc.docType, title: doc.title, refNo: doc.refNo || '', docDate: doc.docDate || '', status: doc.status, heldBy: doc.heldBy || '', notes: doc.notes || '', plotId: doc.plotId || '' } : blank())
  }, [doc])

  const pick = (selected) => {
    const problem = plotDocumentProblem(selected)
    if (problem) return setError(problem)
    setError(null)
    setFile(selected)
    // The title defaults to the file name when empty
    if (!f.title.trim()) set('title')(selected.name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' '))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!f.docType.trim()) return setError('Choose the document type.')
    setSaving(true)
    try {
      const res = doc ? await updateLandDocument(doc.id, f) : await createLandDocument(project.id, f, file, { onProgress: setProgress, onStage: setStage })
      onSaved(res.document, Boolean(doc))
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const plotOptions = plots.map((p) => ({ value: p.id, label: `Plot ${p.plotNo}${p.block ? ` · Block ${p.block}` : ''}`, sub: p.customer?.name }))
  return (
    <LandModal
      open
      onClose={onClose}
      title={doc ? 'Edit document' : 'Add to document log'}
      subtitle={project.name}
      width="max-w-xl"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="doc-form" className={btnPrimary} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {doc ? 'Save changes' : 'Save document'}
          </button>
        </>
      }
    >
      <form id="doc-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableSelect label="Document type" required value={f.docType} onChange={set('docType')} options={types.options} onCreate={types.add} onDelete={types.remove} placeholder="e.g. Sale deed" />
          <Field label="Status" htmlFor="dl-status">
            <SelectInput id="dl-status" value={f.status} onChange={set('status')} options={DOC_STATUSES} />
          </Field>
          <Field label="Title / description" htmlFor="dl-title" className="sm:col-span-2">
            <TextInput id="dl-title" value={f.title} onChange={set('title')} maxLength={160} placeholder="Defaults to the document type" />
          </Field>
          <Field label="Reference no." htmlFor="dl-ref">
            <TextInput id="dl-ref" value={f.refNo} onChange={set('refNo')} maxLength={60} placeholder="Deed / patta / survey no." />
          </Field>
          <Field label="Document date" htmlFor="dl-date">
            <TextInput id="dl-date" type="date" value={f.docDate} onChange={set('docDate')} max={todayIso()} />
          </Field>
          <Field label="Held by / location" htmlFor="dl-held">
            <TextInput id="dl-held" value={f.heldBy} onChange={set('heldBy')} maxLength={120} placeholder="e.g. Office safe, advocate" />
          </Field>
          <SearchSelect label="Applies to" value={f.plotId} onChange={(v) => set('plotId')(v || '')} options={plotOptions} placeholder="Whole project" clearable emptyText="No plots in this project" />
          <Field label="Notes" htmlFor="dl-notes" className="sm:col-span-2">
            <textarea id="dl-notes" rows={2} maxLength={1000} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
          </Field>
        </div>

        {!doc && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Attach a file (optional)</p>
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <Paperclip className="w-4 h-4 text-[#0F3D2E]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                  <p className="text-[11px] text-slate-500">{formatBytes(file.size)} · images are compressed when saved</p>
                </div>
                {!saving && (
                  <button type="button" onClick={() => setFile(null)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="Remove file">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 hover:border-[#0F3D2E] py-5 text-center transition">
                <UploadCloud className="w-5 h-5 mx-auto text-[#0F3D2E]" />
                <p className="text-sm font-semibold text-slate-700 mt-1">Choose a PDF, JPG or PNG</p>
                <p className="text-[11px] text-slate-500">Up to {PLOT_DOC_MAX_MB} MB</p>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={PLOT_DOC_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0]
                e.target.value = ''
                if (picked) pick(picked)
              }}
            />
            {saving && file && <ProgressBar stage={stage} progress={progress} />}
          </div>
        )}
      </form>
    </LandModal>
  )
}

/** Every document of the land: deeds, patta, approvals… with an optional scanned copy. */
export default function DocumentLogTab({ project, plots, canEdit, onChanged, onShowToast }) {
  const { confirm } = useDialog()
  const { data, loading, error, reload, setData } = useAsync(() => listLandDocuments(project.id), [project.id])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [modal, setModal] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const replaceRef = useRef(null)
  const replaceFor = useRef(null)

  const docs = useMemo(() => data?.documents || [], [data])
  const types = useMemo(() => [...new Set(docs.map((d) => d.docType))].sort(), [docs])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs.filter((d) => (!type || d.docType === type) && (!status || d.status === status) && (!q || `${d.title} ${d.docType} ${d.refNo} ${d.heldBy} ${d.plotNo || ''}`.toLowerCase().includes(q)))
  }, [docs, query, type, status])

  const afterChange = () => {
    reload()
    onChanged?.()
  }

  const remove = async (d) => {
    const ok = await confirm({ title: 'Delete document', message: `Delete “${d.title}” from the log${d.file ? ', including its attached file' : ''}? This can't be undone.`, confirmText: 'Delete document', cancelText: 'Cancel', type: 'danger' })
    if (!ok) return
    try {
      await deleteLandDocument(d.id)
      setData((x) => ({ ...x, documents: x.documents.filter((y) => y.id !== d.id) }))
      onShowToast?.('Document deleted', 'info')
      onChanged?.()
    } catch (err) {
      onShowToast?.(err.message, 'error')
    }
  }

  const attach = async (d, file) => {
    setBusyId(d.id)
    setProgress(0)
    try {
      const res = await replaceLandDocumentFile(d.id, file, { onProgress: setProgress, onStage: setStage })
      setData((x) => ({ ...x, documents: x.documents.map((y) => (y.id === d.id ? res.document : y)) }))
      onShowToast?.(d.file ? 'File replaced' : 'File attached', 'success')
    } catch (err) {
      onShowToast?.(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Document',
      render: (d) => (
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate max-w-[260px]">{d.title}</p>
          <p className="text-[11px] text-slate-500">{d.docType}{d.refNo ? ` · ${d.refNo}` : ''}</p>
        </div>
      ),
    },
    { key: 'plot', header: 'Applies to', render: (d) => (d.plotNo ? `Plot ${d.plotNo}` : <span className="text-slate-400">Whole project</span>) },
    { key: 'date', header: 'Date', render: (d) => <span className="whitespace-nowrap">{fmtDate(d.docDate)}</span> },
    { key: 'status', header: 'Status', render: (d) => <DocStatus status={d.status} /> },
    { key: 'held', header: 'Held by', render: (d) => d.heldBy || <span className="text-slate-400">—</span> },
    {
      key: 'file',
      header: 'File',
      render: (d) =>
        busyId === d.id ? (
          <span className="text-xs text-slate-500 min-w-[110px] inline-block"><ProgressBar stage={stage} progress={progress} /></span>
        ) : d.file ? (
          <span className="inline-flex items-center gap-1">
            <button type="button" onClick={() => setPreview(d)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Preview ${d.title}`}>
              <Eye className="w-3.5 h-3.5" /> View
            </button>
            <button
              type="button"
              onClick={async () => downloadBlobUrl(await landDocumentBlobUrl(d.id), d.file.name).catch((err) => onShowToast?.(err.message, 'error'))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F3D2E] hover:bg-slate-100"
              aria-label={`Download ${d.title}`}
              title={`${d.file.name} · ${formatBytes(d.file.size)}`}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : (
          <span className="text-xs text-slate-400">No file</span>
        ),
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (d) =>
        canEdit && (
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              disabled={busyId === d.id}
              onClick={() => {
                replaceFor.current = d
                replaceRef.current?.click()
              }}
              className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8] disabled:opacity-40"
              aria-label={d.file ? `Replace file of ${d.title}` : `Attach a file to ${d.title}`}
              title={d.file ? 'Replace file' : 'Attach a file'}
            >
              {d.file ? <RefreshCw className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => setModal({ doc: d })} className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-[#E2EDE8]" aria-label={`Edit ${d.title}`}>
              <Pencil className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => remove(d)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Delete ${d.title}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          </span>
        ),
    },
  ]

  return (
    <Card
      title="Document log"
      subtitle="Deeds, patta, approvals and other papers of this land"
      actions={
        <>
          <ExportButton type="documents" projectId={project.id} label="Export" onShowToast={onShowToast} />
          {canEdit && (
            <button type="button" className={btnPrimary} onClick={() => setModal({})}>
              <Plus className="w-3.5 h-3.5" /> Add document
            </button>
          )}
        </>
      }
      bodyClassName="p-3 space-y-3"
    >
      {loading && !data ? (
        <LoadingBlock label="Loading documents…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title="No documents logged yet" text="Record each paper of this land (parent deed, patta, EC…) and attach a scanned copy if you have one." action={canEdit && <button type="button" className={btnPrimary} onClick={() => setModal({})}><Plus className="w-4 h-4" /> Add document</button>} />
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-2.5">
            <div className="relative md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, reference, holder…" className={`${inputCls} pl-9 !py-2`} aria-label="Search documents" />
            </div>
            <div className="md:w-52">
              <SelectInput value={type} onChange={setType} options={types} placeholder="All types" aria-label="Filter by type" />
            </div>
            <div className="md:w-44">
              <SelectInput value={status} onChange={setStatus} options={DOC_STATUSES} placeholder="All statuses" aria-label="Filter by status" />
            </div>
          </div>
          <DataTable columns={columns} rows={filtered} rowKey={(d) => d.id} empty="No document matches your filters." />
        </>
      )}

      <input
        ref={replaceRef}
        type="file"
        accept={PLOT_DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          e.target.value = ''
          const d = replaceFor.current
          if (picked && d) attach(d, picked)
        }}
      />
      {modal && (
        <DocumentModal
          project={project}
          plots={plots}
          doc={modal.doc}
          onClose={() => setModal(null)}
          onSaved={(d, edited) => {
            onShowToast?.(edited ? 'Document updated' : 'Document added', 'success')
            afterChange()
          }}
        />
      )}
      {preview && <FilePreview title={preview.title} name={preview.file.name} ext={preview.file.ext} load={() => landDocumentBlobUrl(preview.id)} onClose={() => setPreview(null)} />}
    </Card>
  )
}
