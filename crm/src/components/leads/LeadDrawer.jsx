import React, { useState, useEffect } from 'react'
import {
  X,
  Phone,
  Mail,
  ChevronDown,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  Upload,
  Send,
  MessageCircle,
  Clock,
  Sparkles,
  Trash2,
  UserCircle2,
  MapPin,
  Pencil,
  XCircle,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import ScheduleFollowUpModal from './ScheduleFollowUpModal'
import RecordPaymentModal from './RecordPaymentModal'
import ScheduleSiteVisitModal from '../visits/ScheduleSiteVisitModal'
import { useDialog } from '../../context/DialogContext'
import { useAuth } from '../../context/AuthContext'
import LeadPayments from './LeadMoney'
import ReferralPanel from '../brokers/ReferralPanel'
import { leadOwner } from '../../lib/brokersApi'

const STAGE_OPTIONS = [
  { id: 'new', label: 'New leads' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'sitevisit', label: 'Site visit' },
  { id: 'sitevisitdone', label: 'Site visit done' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won - Booked' },
  { id: 'lost', label: 'Lost' },
]



function getSourceBadge(source = 'Website') {
  switch (source.toLowerCase()) {
    case 'instagram':
      return { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' }
    case 'facebook':
      return { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' }
    case 'whatsapp':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
    case '99acres':
      return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' }
    case 'magicbricks':
      return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' }
    case 'referral':
      return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' }
    case 'walk-in':
      return { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' }
    default:
      return { bg: 'bg-[#E2EDE8]', text: 'text-[#0F3D2E]', border: 'border-[#C8DED5]' }
  }
}

// Hooks must not run after an early return, so the null check lives in this wrapper.
export default function LeadDrawer(props) {
  if (!props.lead) return null
  return <LeadDrawerContent {...props} />
}

function LeadDrawerContent({
  lead,
  meta,
  properties = [],
  visitsState,
  onShowToast,
  onClose,
  onUpdate,
  onDelete,
  onRecordPayment,
  onScheduleFollowUp,
  onToggleFollowUp,
  onAddNote,
}) {
  const { confirm, alert } = useDialog()
  const { can } = useAuth()
  const canEditMoney = can('leads', 'edit') || can('payments', 'edit')
  // Reload the lead after money or broker changes made through their own endpoints
  const refreshLead = async () => applyServerLead(await onUpdate?.(lead.id, {}, { silent: true }))

  const dynamicAgents = meta?.agents && meta.agents.length > 0 ? meta.agents : []
  const dynamicStages = meta?.stages && meta.stages.length > 0 ? meta.stages : STAGE_OPTIONS

  // Local state initialized with lead data
  const [stage, setStage] = useState(lead.stage || 'new')
  const [assignedAgent, setAssignedAgent] = useState(
    lead.assignedAgent?.name || dynamicAgents[0]?.name || ''
  )
  const [noteInput, setNoteInput] = useState('')
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false)
  const [visitModal, setVisitModal] = useState(null) // null | 'new' | visit
  const leadVisits = (visitsState?.visits || []).filter((v) => v.leadId === lead.id)
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)

  // Derive initial follow-ups & activity timeline with graceful dynamic defaults
  const createdDateStr = lead.createdAt
    ? new Date(lead.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  const [followUps, setFollowUps] = useState(() => {
    if (lead.upcomingFollowUps && lead.upcomingFollowUps.length > 0) {
      return lead.upcomingFollowUps.map((fu) => ({
        ...fu,
        when: (fu.when || 'Today, 5:00 pm').replace('Today · Today', 'Today, 5:00 pm'),
      }))
    }
    const defWhen = lead.followUpDate
      ? lead.followUpDate.toLowerCase().includes('tomorrow')
        ? 'Tomorrow, 11:00 am'
        : lead.followUpDate.toLowerCase().includes('yesterday')
        ? 'Yesterday, 4:00 pm'
        : `${lead.followUpDate}, 11:00 am`
      : 'Today, 5:00 pm'

    return [
      {
        id: `fu-${lead.id || Date.now()}`,
        type: 'Call',
        title: lead.notes || `Follow-up call with ${lead.name}`,
        when: defWhen,
        completed: lead.stage === 'won',
      },
    ]
  })

  const [activities, setActivities] = useState(() => {
    if (lead.activity && lead.activity.length > 0) {
      return lead.activity.map((act) => ({
        ...act,
        time: act.time && act.time.includes('15 Oct 2026') ? act.time.replace('15 Oct 2026', createdDateStr) : (act.time || 'Just now'),
      }))
    }

    return [
      {
        id: 'act-1',
        text: 'WhatsApp welcome message sent automatically',
        time: `${createdDateStr} · 9:25 am`,
      },
      {
        id: 'act-2',
        text: `Enquiry captured from ${lead.source || 'Website'}${lead.property ? ` for ${lead.property}` : ''}`,
        time: `${createdDateStr} · 9:15 am`,
      },
    ]
  })

  // Keep state updated if lead prop changes
  useEffect(() => {
    setStage(lead.stage || 'new')
    setAssignedAgent(lead.assignedAgent?.name || '')
    if (lead.upcomingFollowUps) {
      setFollowUps(
        lead.upcomingFollowUps.map((fu) => ({
          ...fu,
          when: (fu.when || 'Today, 5:00 pm').replace('Today · Today', 'Today, 5:00 pm'),
        }))
      )
    }
    if (lead.activity) {
      setActivities(
        lead.activity.map((act) => ({
          ...act,
          time: act.time && act.time.includes('15 Oct 2026') ? act.time.replace('15 Oct 2026', createdDateStr) : (act.time || 'Just now'),
        }))
      )
    }
  }, [lead])

  // Get initials for lead avatar
  const getInitials = (name) => {
    if (!name) return 'CE'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Handle Stage change
  // The server logs the stage change in the lead's activity, so only the stage is sent
  const handleStageChange = async (newStage) => {
    const previous = stage
    setStage(newStage)
    try {
      await onUpdate(lead.id, { stage: newStage })
    } catch (err) {
      setStage(previous)
      alert?.({ title: 'Could not update stage', message: err.message || 'Please try again.' })
    }
  }

  // Handle Assigned Agent change
  const handleAgentChange = async (agentName) => {
    setAssignedAgent(agentName)
    const agentObj = dynamicAgents.find((a) => a.name === agentName) || (agentName ? {
      name: agentName,
      initials: agentName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      color: '#0F3D2E',
    } : {
      name: 'Unassigned',
      initials: 'UN',
      color: '#64748B',
    })
    try {
      // Server records "Lead assigned to …" in the activity log itself
      await onUpdate(lead.id, { assignedAgent: agentObj })
    } catch (err) {
      setAssignedAgent(lead.assignedAgent?.name || '')
      alert?.({ title: 'Could not reassign lead', message: err.message || 'Please try again.' })
    }
  }

  // Server actions return the updated lead; the parent refreshes the drawer from it,
  // so nothing is PATCHed back here (that used to overwrite activity and dates).
  const applyServerLead = (updated) => {
    if (!updated) return
    if (updated.activity) setActivities(updated.activity)
    if (updated.upcomingFollowUps) setFollowUps(updated.upcomingFollowUps)
    if (updated.stage) setStage(updated.stage)
  }

  // Handle Add Note
  const handleAddNote = async (e) => {
    e.preventDefault()
    const noteText = noteInput.trim()
    if (!noteText || !onAddNote) return
    setNoteInput('')
    try {
      applyServerLead(await onAddNote(lead.id, noteText))
    } catch (err) {
      setNoteInput(noteText)
      alert?.({ title: 'Could not add note', message: err.message || 'Please try again.' })
    }
  }

  // Handle Schedule Follow-up submit (errors surface in the follow-up modal)
  const handleScheduleFollowUp = async ({ type, when, note }) => {
    if (!onScheduleFollowUp) return
    applyServerLead(await onScheduleFollowUp(lead.id, { type, when, note }))
  }

  // Toggle complete on follow-up
  const handleToggleFollowUp = async (fuId) => {
    if (!onToggleFollowUp) return
    try {
      applyServerLead(await onToggleFollowUp(lead.id, fuId))
    } catch (err) {
      alert?.({ title: 'Could not update follow-up', message: err.message || 'Please try again.' })
    }
  }

  // Record Payment — errors propagate so the payment modal stays open and shows them
  const handleSavePayment = async (paymentData) => {
    if (!onRecordPayment) throw new Error('Payments cannot be recorded here.')
    const updated = await onRecordPayment(lead.id, paymentData)
    applyServerLead(updated)
    const payments = Array.isArray(updated?.payments) ? updated.payments : []
    return { lead: updated, payment: payments[payments.length - 1] }
  }

  // Send WhatsApp Direct
  const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '')
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello ${lead.name}, regarding your enquiry${lead.property ? ` for ${lead.property}` : ''} with Crystal Estates...`
  )}`

  // Custom Dialog Actions (Replacing browser alerts/confirms)
  const handleSendDocument = async () => {
    const contact = lead.email || lead.phone || lead.name
    await alert({
      title: 'Document Sharing',
      message: `Document packet (sanctioned layout sketch, brochure & legal summary) initiated for ${contact}. A direct link has been generated.`,
      confirmText: 'Done',
      type: 'info',
    })
  }

  const handleSendBrochure = async () => {
    const contact = lead.name || lead.email || 'customer'
    await alert({
      title: 'Send Brochure',
      message: `Digital property brochure link ready to share with ${contact}.`,
      confirmText: 'Done',
      type: 'info',
    })
  }

  const handleDeleteLead = async () => {
    if (!onDelete) return
    const ok = await confirm({
      title: 'Delete Lead',
      message: `Are you sure you want to permanently remove "${lead.name}" from the pipeline? All activity logs, scheduled follow-ups, and recorded payments will be deleted.`,
      tag: `${lead.name} · ${lead.property || 'General Enquiry'}`,
      confirmText: 'Delete Lead',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (ok) {
      await onDelete(lead.id)
    }
  }

  const sourceBadge = getSourceBadge(lead.source)
  const leadInitials = getInitials(lead.name)

  return (
    <div className="fixed inset-0 z-60 overflow-hidden">
      {/* ── Semi-transparent backdrop ── */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* ── Slide-over drawer container ── */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-[460px] bg-white shadow-2xl flex flex-col h-full transform transition-all duration-300 ease-in-out border-l border-slate-200 animate-in slide-in-from-right duration-250 font-sans">
          {/* ── 1. DRAWER TOP HEADER ── */}
          <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar circle with initials */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-xs shrink-0"
                style={{
                  backgroundColor:
                    lead.assignedAgent?.color || '#0F3D2E',
                }}
              >
                {leadInitials}
              </div>

              {/* Name & Subtitle */}
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                  {lead.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceBadge.bg} ${sourceBadge.text}`}
                  >
                    {lead.source || 'Website'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium truncate">
                    Added {createdDateStr}{lead.property ? ` · ${lead.property}` : ''}
                  </span>
                </div>
                {lead.customerId && (
                  <Link
                    to={`/customers/${encodeURIComponent(lead.customerId)}`}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#0F3D2E] hover:underline"
                  >
                    <UserCircle2 className="w-3.5 h-3.5" /> Customer profile
                  </Link>
                )}
              </div>
            </div>

            {/* Actions: Delete (if provided) & Close */}
            <div className="flex items-center gap-1">
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteLead}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                  title="Delete Lead"
                  aria-label="Delete Lead"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── 2. STAGE & ASSIGNED DROPDOWNS ── */}
          <div className="grid grid-cols-2 gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            {/* Stage Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Stage
              </label>
              <div className="relative">
                <select
                  value={stage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="w-full appearance-none px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] shadow-2xs cursor-pointer pr-7"
                >
                  {dynamicStages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
              </div>
            </div>

            {/* Assigned to Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Assigned to
              </label>
              <div className="relative">
                <select
                  value={assignedAgent}
                  onChange={(e) => handleAgentChange(e.target.value)}
                  className="w-full appearance-none px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] shadow-2xs cursor-pointer pr-7"
                >
                  {dynamicAgents.map((ag) => (
                    <option key={ag.name} value={ag.name}>
                      {ag.name}
                    </option>
                  ))}
                  {dynamicAgents.length === 0 && (
                    <option value="">Unassigned</option>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* ── 3. ACTION BUTTONS GRID (2 rows x 3 columns) ── */}
          <div className="grid grid-cols-3 gap-2 px-5 py-3.5 border-b border-slate-100">
            {/* Call */}
            <a
              href={`tel:${lead.phone}`}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-700 transition shadow-2xs group no-underline"
            >
              <Phone className="w-4 h-4 text-slate-600 group-hover:text-[#0F3D2E] transition" />
              <span className="text-[11px] font-semibold text-slate-700">Call</span>
            </a>

            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-2 bg-white hover:bg-emerald-50/50 border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition shadow-2xs group no-underline"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366] transition group-hover:scale-110" />
              <span className="text-[11px] font-bold text-[#16A34A]">WhatsApp</span>
            </a>

            {/* Email */}
            <a
              href={`mailto:${lead.email}`}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-700 transition shadow-2xs group no-underline"
            >
              <Mail className="w-4 h-4 text-slate-600 group-hover:text-[#0F3D2E] transition" />
              <span className="text-[11px] font-semibold text-slate-700">Email</span>
            </a>

            {/* Record Payment */}
            <button
              type="button"
              onClick={() => setIsRecordPaymentModalOpen(true)}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-700 transition shadow-2xs group"
            >
              <span className="w-4 h-4 text-xs font-bold flex items-center justify-center text-slate-600 group-hover:text-[#0F3D2E]">
                ₹
              </span>
              <span className="text-[11px] font-semibold text-slate-700">Record payment</span>
            </button>

            {/* Send Document */}
            <button
              type="button"
              onClick={handleSendDocument}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-700 transition shadow-2xs group"
            >
              <Upload className="w-4 h-4 text-slate-600 group-hover:text-[#0F3D2E] transition" />
              <span className="text-[11px] font-semibold text-slate-700">Send document</span>
            </button>

            {/* Follow-up (opens follow-up modal) */}
            <button
              type="button"
              onClick={() => setIsFollowUpModalOpen(true)}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-700 transition shadow-2xs group"
            >
              <Calendar className="w-4 h-4 text-slate-600 group-hover:text-[#0F3D2E] transition" />
              <span className="text-[11px] font-semibold text-slate-700">Follow-up</span>
            </button>
          </div>

          {/* ── 4. SCROLLABLE DETAILS BODY ── */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
            {/* ── DETAILS SECTION ── */}
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
                Details
              </div>
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Phone</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {lead.phone || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Email</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                    {lead.email || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Budget</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {lead.budgetFormatted || (lead.budget ? (lead.budget >= 10000000 ? `₹${(lead.budget / 10000000).toFixed(2)} Cr` : `₹${(lead.budget / 100000).toFixed(0)} L`) : '—')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Requirement</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {lead.requirement || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Project</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {lead.property || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Unit</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {lead.unit || 'Not allotted'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SITE VISITS SECTION ── */}
            {visitsState && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0F3D2E]" />
                    <span>Site Visits ({leadVisits.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisitModal('new')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0F3D2E] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Schedule visit
                  </button>
                </div>
                {leadVisits.length === 0 ? (
                  <p className="text-xs text-slate-400">No site visits scheduled for this lead yet.</p>
                ) : (
                  <div className="space-y-2">
                    {leadVisits.map((v) => (
                      <div key={v.id} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {v.dateLabel} · {v.visitTime}
                            </p>
                            <p className="text-[11px] text-slate-600 truncate">
                              {v.property}{v.location ? ` (${v.location})` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            v.status === 'Cancelled'
                              ? 'bg-rose-50 text-rose-700'
                              : v.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-[#E2EDE8] text-[#0F3D2E]'
                          }`}>
                            {v.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-slate-500 truncate">
                            Agent: {v.assignedAgent?.name || 'Crystal Admin'}{v.cabPickup ? ' · Cab' : ''}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setVisitModal(v)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-[#0F3D2E] px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            {v.status !== 'Cancelled' && v.status !== 'Completed' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await visitsState.updateVisit(v.id, { status: 'Cancelled' })
                                    await refreshLead()
                                    onShowToast?.('Site visit cancelled', 'info')
                                  } catch (err) {
                                    onShowToast?.(err.message, 'error')
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg"
                              >
                                <XCircle className="w-3 h-3" /> Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PAYMENTS SECTION ── */}
            <LeadPayments
              lead={lead}
              canEdit={canEditMoney}
              onRecord={() => setIsRecordPaymentModalOpen(true)}
              onSaveAgreedPrice={async (v) => applyServerLead(await onUpdate?.(lead.id, { dealValue: v }, { silent: true }))}
              onRefresh={refreshLead}
            />

            {/* ── BROKER SECTION ── */}
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">Broker &amp; commission</div>
              <ReferralPanel owner={leadOwner(lead.id)} canEdit={canEditMoney} onChanged={refreshLead} dealHint="the agreed price" />
            </div>

            {/* ── DOCUMENTS SECTION ── */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Documents
                </span>
                <button
                  type="button"
                  onClick={handleSendBrochure}
                  className="text-xs font-bold text-[#0F3D2E] hover:text-[#16533D] transition"
                >
                  + Send
                </button>
              </div>
              <div className="p-3 bg-slate-50/60 border border-slate-100 rounded-2xl text-center">
                <p className="text-xs text-slate-400">
                  No documents shared yet.
                </p>
              </div>
            </div>

            {/* ── UPCOMING FOLLOW-UPS SECTION ── */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Upcoming Follow-ups
                </span>
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="text-xs font-bold text-[#0F3D2E] hover:text-[#16533D] transition"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-2">
                {followUps.length > 0 ? (
                  followUps.map((fu) => (
                    <div
                      key={fu.id}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        fu.completed
                          ? 'bg-slate-50/50 border-slate-100 opacity-60'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E2EDE8] text-[#0F3D2E] shrink-0 mt-0.5">
                          {fu.type || 'Call'}
                        </span>
                        <div>
                          <div
                            className={`text-xs font-bold leading-tight ${
                              fu.completed ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {fu.title || `Follow-up ${fu.type || 'Call'}`}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {fu.when || 'Today · 5:00 pm'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleFollowUp(fu.id)}
                        className={`p-1.5 rounded-lg border transition ${
                          fu.completed
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600'
                        }`}
                        title={fu.completed ? 'Completed' : 'Mark complete'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50/60 border border-slate-100 rounded-2xl text-center">
                    <p className="text-xs text-slate-400">
                      No upcoming follow-ups scheduled.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── ADD A NOTE SECTION ── */}
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                Add a Note
              </div>
              <form onSubmit={handleAddNote} className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="e.g. Prefers east-facing, needs 2 car parks"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-[0.98] shrink-0"
                >
                  Add
                </button>
              </form>
            </div>

            {/* ── ACTIVITY TIMELINE SECTION ── */}
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
                Activity
              </div>
              <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200">
                {activities.map((act) => (
                  <div key={act.id} className="relative">
                    {/* Timeline bullet */}
                    <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#0F3D2E] absolute -left-5 top-1 shadow-2xs" />
                    <div>
                      <div className="text-xs font-semibold text-slate-800 leading-tight">
                        {act.text}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {act.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone: Delete Lead */}
            {onDelete && (
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800">Delete this lead</h4>
                  <p className="text-[11px] text-slate-400">Permanently removes lead and its records</p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteLead}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SCHEDULE FOLLOW-UP MODAL POPUP ── */}
      <ScheduleFollowUpModal
        isOpen={isFollowUpModalOpen}
        lead={lead}
        onClose={() => setIsFollowUpModalOpen(false)}
        onSchedule={handleScheduleFollowUp}
      />

      {/* ── RECORD ADVANCE PAYMENT MODAL POPUP ── */}
      <RecordPaymentModal
        isOpen={isRecordPaymentModalOpen}
        lead={lead}
        onClose={() => setIsRecordPaymentModalOpen(false)}
        properties={properties}
        onSavePayment={handleSavePayment}
      />

      {/* ── SCHEDULE / EDIT SITE VISIT MODAL ── */}
      {visitModal && visitsState && (
        <ScheduleSiteVisitModal
          isOpen={Boolean(visitModal)}
          visit={visitModal === 'new' ? null : visitModal}
          lead={lead}
          properties={properties}
          meta={meta}
          onClose={() => setVisitModal(null)}
          onSchedule={async (visitData) => {
            if (visitModal !== 'new' && visitModal?.id) {
              await visitsState.updateVisit(visitModal.id, visitData)
              onShowToast?.('Site visit updated!', 'success')
            } else {
              await visitsState.scheduleVisit(visitData)
              onShowToast?.('Site visit scheduled!', 'success')
            }
            await refreshLead()
            setVisitModal(null)
          }}
        />
      )}
    </div>
  )
}

