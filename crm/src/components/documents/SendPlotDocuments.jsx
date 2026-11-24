import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertCircle, Send, User, Users, FileText, CheckCircle2 } from 'lucide-react'
import SearchSelect from '../common/SearchSelect'
import { PlotDocumentsManager, usePlotDocuments } from '../properties/PlotDocuments'
import { ShareChannelPicker, ShareResults, ShareHistory, ConsentNote, useDocumentSender, useShareConfig } from './PlotDocumentSharing'
import { fetchPlotRecipients, newRequestKey, formatBytes } from '../../lib/plotDocumentsApi'
import { plotsOfProperty, statusGroup } from '../../lib/plotUtils'
import { useAuth } from '../../context/AuthContext'

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
const stepTitle = 'text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2'
const stepNo = 'w-5 h-5 rounded-full bg-[#0F3D2E] text-white text-[10px] font-bold grid place-items-center'

/**
 * Send Document → Plot documents.
 * Pick a property and plot, tick existing documents or upload new ones (stored
 * against that plot), choose the plot's registered customer and send by
 * WhatsApp and/or email. Every send is logged and listed below.
 */
export default function SendPlotDocuments({ properties = [], onShowToast }) {
  const { can } = useAuth()
  const { config } = useShareConfig()
  const [propertyId, setPropertyId] = useState('')
  const [plotUid, setPlotUid] = useState('')
  const [selected, setSelected] = useState([])
  const [recipients, setRecipients] = useState({ list: [], loading: false, error: null })
  const [recipientKey, setRecipientKey] = useState('')
  const [channels, setChannels] = useState([])
  const [note, setNote] = useState('')
  const [sendKey, setSendKey] = useState(() => newRequestKey('send'))
  const [historyTick, setHistoryTick] = useState(0)
  const sender = useDocumentSender()

  const property = properties.find((p) => p.id === propertyId)
  const plots = useMemo(() => (property ? plotsOfProperty(property) : []), [property])
  const multiPhase = new Set(plots.map((p) => p.phase).filter(Boolean)).size > 1
  const plot = plots.find((p) => p.uid === plotUid) || null
  const plotRef = useMemo(
    () => ({ propertyId: property?.id || '', propertyName: property?.name || '', plotUid: plot?.uid || '', plotNo: plot ? String(plot.plotNo) : '', phase: plot?.phase || '' }),
    [property, plot],
  )
  const docsState = usePlotDocuments({ ...plotRef, enabled: Boolean(plot) })

  const projectOptions = useMemo(() => properties.filter((p) => p?.id && p?.name).map((p) => ({ value: p.id, label: p.name, sub: p.location })), [properties])
  const plotOptions = useMemo(
    () =>
      plots.map((p) => ({
        value: p.uid,
        label: `Plot ${p.plotNo}${multiPhase && p.phase ? ` · ${p.phase}` : ''}`,
        sub: [statusGroup(p.status), p.area].filter(Boolean).join(' · '),
      })),
    [plots, multiPhase],
  )

  // Customers registered for the plot (booking, paying leads, leads for it)
  useEffect(() => {
    if (!plot) return undefined
    let active = true
    const t = setTimeout(() => {
      setRecipients({ list: [], loading: true, error: null })
      fetchPlotRecipients(plotRef)
        .then((d) => {
          if (!active) return
          setRecipients({ list: d.recipients || [], loading: false, error: null })
          setRecipientKey(d.recipients?.[0]?.key || '')
        })
        .catch((err) => active && setRecipients({ list: [], loading: false, error: err.message }))
    }, 0)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [plot, plotRef])

  const resetForPlot = () => {
    setSelected([])
    setRecipients({ list: [], loading: false, error: null })
    setRecipientKey('')
    setChannels([])
    sender.reset()
    setSendKey(newRequestKey('send'))
  }

  const recipient = recipients.list.find((r) => r.key === recipientKey) || null
  const chosenDocs = docsState.documents.filter((d) => selected.includes(d.id))
  const canSend = can('documents', 'edit') || can('payments', 'edit')
  const ready = plot && chosenDocs.length > 0 && recipient && channels.length > 0 && canSend

  const send = async () => {
    if (!ready) return
    const results = await sender.send({
      documentIds: chosenDocs.map((d) => d.id),
      channels,
      recipient: recipient.type === 'lead' ? { type: 'lead', leadId: recipient.leadId } : { type: 'booking' },
      ...plotRef,
      note: note.trim(),
      idempotencyKey: sendKey,
    })
    setHistoryTick((n) => n + 1)
    if (results?.every((r) => r.status === 'sent')) onShowToast?.('Documents sent', 'success')
  }

  // A finished send gets a fresh key, so the next send is a new message
  const startOver = () => {
    sender.reset()
    setSendKey(newRequestKey('send'))
    setSelected([])
    setNote('')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Left: plot and documents */}
        <div className={`${card} p-5 space-y-5 xl:col-span-3`}>
          <div className="space-y-3">
            <p className={stepTitle}><span className={stepNo}>1</span> Property and plot</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SearchSelect
                label="Property"
                required
                value={propertyId}
                onChange={(v) => {
                  setPropertyId(v || '')
                  setPlotUid('')
                  resetForPlot()
                }}
                options={projectOptions}
                placeholder={projectOptions.length ? 'Select property' : 'No properties yet'}
                emptyText="No matching properties"
              />
              <SearchSelect
                label="Plot"
                required
                value={plotUid}
                onChange={(v) => {
                  setPlotUid(v || '')
                  resetForPlot()
                }}
                options={plotOptions}
                placeholder={property ? 'Select plot' : 'Pick a property first'}
                disabled={!property}
                emptyText="This property has no plots yet"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className={stepTitle}><span className={stepNo}>2</span> Documents</p>
            {!plot ? (
              <p className="text-xs text-slate-500">Select a plot to see its documents or upload new ones.</p>
            ) : (
              <PlotDocumentsManager
                key={plot.uid}
                plotRef={plotRef}
                docsState={docsState}
                canEdit={can('properties', 'edit')}
                canUpload={can('properties', 'edit') || can('documents', 'edit')}
                onShowToast={onShowToast}
                selectable
                selected={selected}
                onSelectedChange={setSelected}
                bare
              />
            )}
          </div>
        </div>

        {/* Right: recipient, channels, review */}
        <div className={`${card} p-5 space-y-5 xl:col-span-2 self-start`}>
          <div className="space-y-3">
            <p className={stepTitle}><span className={stepNo}>3</span> Customer</p>
            {!plot ? (
              <p className="text-xs text-slate-500">The plot's registered customer appears here.</p>
            ) : recipients.loading ? (
              <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up the customer…</p>
            ) : recipients.error ? (
              <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {recipients.error}</p>
            ) : recipients.list.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-center">
                <Users className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600 mt-1">No customer is registered for this plot</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Save a booking for the plot, or record a payment against it, first.</p>
              </div>
            ) : (
              <ul className="space-y-2" role="radiogroup" aria-label="Customer">
                {recipients.list.map((r) => (
                  <li key={r.key}>
                    <label className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer ${recipientKey === r.key ? 'border-[#0F3D2E] bg-[#E2EDE8]/50' : 'border-slate-200'}`}>
                      <input type="radio" name="recipient" className="mt-0.5 accent-[#0F3D2E]" checked={recipientKey === r.key} onChange={() => setRecipientKey(r.key)} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><User className="w-3.5 h-3.5" /> {r.name || 'Unnamed customer'}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{[r.phone || 'No phone', r.email || 'No email'].join(' · ')}</span>
                        <span className="block text-[10.5px] text-slate-400">{r.source}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <p className={stepTitle}><span className={stepNo}>4</span> Send by</p>
            <ShareChannelPicker config={config} recipient={recipient} channels={channels} onChange={setChannels} disabled={!recipient || !canSend} />
            <div>
              <label htmlFor="spd-note" className="block text-xs font-semibold text-slate-600 mb-1.5">Message (optional)</label>
              <textarea id="spd-note" rows={2} maxLength={500} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Added to the email and WhatsApp message" />
            </div>
            <ConsentNote />
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <p className={stepTitle}><span className={stepNo}>5</span> Review and send</p>
            {chosenDocs.length === 0 ? (
              <p className="text-xs text-slate-500">Tick the documents to send.</p>
            ) : (
              <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                {chosenDocs.map((d) => (
                  <li key={d.id} className="px-3 py-2 flex items-center gap-2 text-xs">
                    <FileText className="w-3.5 h-3.5 text-[#0F3D2E] shrink-0" />
                    <span className="font-semibold text-slate-800 truncate flex-1">{d.label}</span>
                    <span className="text-slate-400 shrink-0">{formatBytes(d.size)}</span>
                  </li>
                ))}
              </ul>
            )}
            {recipient && chosenDocs.length > 0 && (
              <p className="text-[11px] text-slate-600">
                To <b>{recipient.name}</b>
                {channels.includes('whatsapp') && recipient.phone ? ` · WhatsApp ${recipient.phone}` : ''}
                {channels.includes('email') && recipient.email ? ` · ${recipient.email}` : ''}
                {plot ? ` · Plot ${plot.plotNo}, ${property?.name}` : ''}
              </p>
            )}
            {!canSend && <p className="text-[11px] text-amber-700">Your role can't send documents. Ask for edit access to Documents or Payments.</p>}

            {sender.results ? (
              <div className="space-y-3">
                <ShareResults results={sender.results} onRetry={sender.retry} retrying={sender.sending} />
                <button type="button" onClick={startOver} className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Send something else
                </button>
              </div>
            ) : (
              <>
                {sender.error && <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {sender.error}</p>}
                <button
                  type="button"
                  onClick={send}
                  disabled={!ready || sender.sending}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-sm font-bold rounded-xl disabled:opacity-40"
                >
                  {sender.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sender.sending ? 'Sending…' : `Send ${chosenDocs.length || ''} document${chosenDocs.length === 1 ? '' : 's'}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <ShareHistory
          key={plot ? plotRef.plotUid : 'all'}
          title={plot ? `Sharing history · Plot ${plot.plotNo}` : 'Recent sharing history'}
          filter={plot ? { propertyId: plotRef.propertyId, plotUid: plotRef.plotUid, plotNo: plotRef.plotNo, phase: plotRef.phase } : {}}
          refreshKey={historyTick}
        />
      </div>
    </div>
  )
}
