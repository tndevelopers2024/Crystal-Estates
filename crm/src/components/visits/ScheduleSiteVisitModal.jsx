import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Calendar, Clock, ChevronDown, MapPin, Building2, Car, User, Phone, Mail } from 'lucide-react'

const VISIT_TIME_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '01:00 PM',
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
  '05:30 PM',
  '06:00 PM',
  '06:30 PM',
  '07:00 PM',
]

const getTodayDateString = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

const getTomorrowDateString = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function normalizeTimeSlot(raw) {
  const s = String(raw || '').trim().toUpperCase()
  if (!s) return '11:00 AM'
  const padded = s.replace(/^(\d):/, '0$1:')
  if (VISIT_TIME_SLOTS.includes(padded)) return padded
  return '11:00 AM'
}

export default function ScheduleSiteVisitModal({
  isOpen,
  visit = null,
  lead = null,
  leads = [],
  properties = [],
  meta,
  defaultStatus = null,
  onClose,
  onSchedule,
}) {
  const isEditing = Boolean(visit?.id)
  const [selectedLeadId, setSelectedLeadId] = useState(visit?.leadId || lead?.id || leads[0]?.id || '')
  const activeLead = lead || leads.find((l) => l.id === selectedLeadId) || visit?.lead || null

  const propertyList = useMemo(
    () => (properties || []).filter((p) => p && p.name),
    [properties]
  )

  const matchProperty = (propId, propName) => {
    if (propId) {
      const byId = propertyList.find((p) => p.id === propId || p.projectId === propId)
      if (byId) return byId
    }
    if (propName) {
      const lower = String(propName).toLowerCase().trim()
      const byName = propertyList.find((p) => p.name.toLowerCase().trim() === lower)
      if (byName) return byName
    }
    return null
  }

  const [propertyId, setPropertyId] = useState('')
  const [propertyName, setPropertyName] = useState('')
  const [location, setLocation] = useState('')
  const [visitDate, setVisitDate] = useState(getTomorrowDateString())
  const [visitTime, setVisitTime] = useState('11:00 AM')
  const [status, setStatus] = useState('Scheduled')
  const [cabPickup, setCabPickup] = useState(true)
  const [agentName, setAgentName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const dateInputRef = useRef(null)

  const agentOptions = useMemo(() => {
    if (meta?.agents && meta.agents.length > 0) return meta.agents
    return [
      { name: 'Arun Kumar', initials: 'AK', color: '#DC2626' },
      { name: 'Meera R', initials: 'MR', color: '#7C3AED' },
      { name: 'Divya S', initials: 'DS', color: '#0F3D2E' },
      { name: 'Deepak Sharma', initials: 'DS', color: '#0D9488' },
      { name: 'Crystal Admin', initials: 'CA', color: '#0F3D2E' },
    ]
  }, [meta])

  useEffect(() => {
    if (!isOpen) return
    const targetLead = lead || (visit?.leadId ? leads.find((l) => l.id === visit.leadId) || visit.lead : leads[0]) || null
    if (visit?.leadId) setSelectedLeadId(visit.leadId)
    else if (lead?.id) setSelectedLeadId(lead.id)
    else if (leads[0]?.id) setSelectedLeadId(leads[0].id)

    const matched = matchProperty(
      visit?.propertyId || targetLead?.propertyId,
      visit?.property || targetLead?.property
    )
    const fallbackProp = matched || propertyList[0] || null
    setPropertyId(fallbackProp?.id || '')
    setPropertyName(fallbackProp?.name || visit?.property || '')
    setLocation(visit?.location || fallbackProp?.location || 'Chennai')

    setVisitDate(visit?.visitDate || getTomorrowDateString())
    setVisitTime(normalizeTimeSlot(visit?.visitTime))
    setStatus(defaultStatus || visit?.status || 'Scheduled')
    setCabPickup(visit ? Boolean(visit.cabPickup) : true)
    setAgentName(
      visit?.assignedAgent?.name ||
        targetLead?.assignedAgent?.name ||
        agentOptions[0]?.name ||
        'Crystal Admin'
    )
    setNotes(visit?.notes || '')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, visit?.id, lead?.id])

  const handleLeadChange = (newId) => {
    setSelectedLeadId(newId)
    const found = leads.find((l) => l.id === newId)
    if (found) {
      const matched = matchProperty(found.propertyId, found.property) || propertyList[0] || null
      if (matched) {
        setPropertyId(matched.id)
        setPropertyName(matched.name)
        setLocation(matched.location || 'Chennai')
      }
      if (found.assignedAgent?.name) {
        setAgentName(found.assignedAgent.name)
      }
    }
  }

  const handlePropertySelect = (selectedId) => {
    const matched = propertyList.find((p) => p.id === selectedId)
    if (matched) {
      setPropertyId(matched.id)
      setPropertyName(matched.name)
      setLocation(matched.location || 'Chennai')
    } else {
      setPropertyId('')
      setPropertyName(selectedId)
    }
  }

  if (!isOpen) return null
  if (!isEditing && !activeLead && leads.length === 0) return null

  const displayName = activeLead?.name || visit?.leadName || 'Customer'
  const displayPhone = activeLead?.phone || visit?.leadPhone || ''
  const displayEmail = activeLead?.email || visit?.leadEmail || ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const finalLeadId = activeLead?.id || visit?.leadId
    if (!finalLeadId) return setError('Please select a lead.')
    if (!propertyName && !propertyId) return setError('Please select a property or project.')
    if (!visitDate) return setError('Please choose a visit date.')
    if (!visitTime) return setError('Please choose a visit time.')

    try {
      setSubmitting(true)
      const matchedAgent = agentOptions.find((a) => a.name === agentName) || {
        name: agentName || 'Crystal Admin',
        initials: (agentName || 'CA').slice(0, 2).toUpperCase(),
        color: '#0F3D2E',
      }

      await onSchedule({
        ...(isEditing ? { id: visit.id } : {}),
        leadId: finalLeadId,
        propertyId: propertyId || undefined,
        property: propertyName,
        location: location.trim() || 'Chennai',
        date: visitDate,
        time: visitTime,
        status,
        cabPickup,
        assignedAgent: matchedAgent,
        notes: notes.trim(),
        moveToSiteVisit: !isEditing,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save site visit')
    } finally {
      setSubmitting(false)
    }
  }

  const statusOptions = isEditing
    ? ['Pending', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled']
    : ['Scheduled', 'Confirmed', 'Pending', 'Tentative']

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {isEditing ? 'Edit / Reschedule site visit' : 'Schedule site visit'}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {isEditing
                ? 'Update property, date, time, assigned agent, or visit status'
                : 'Select property, date, time, assigned agent & cab pickup'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Lead / Customer Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Lead / Customer
            </label>
            {leads && leads.length > 0 && !lead && !isEditing ? (
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedLeadId}
                    onChange={(e) => handleLeadChange(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer pr-8"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                        {l.phone ? ` · ${l.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                {activeLead && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-xl bg-slate-50/70 border border-slate-200/60 text-[11px] text-slate-500">
                    {activeLead.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {activeLead.phone}
                      </span>
                    )}
                    {activeLead.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {activeLead.email}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <User className="w-3.5 h-3.5 text-[#0F3D2E]" />
                  <span>{displayName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500 pl-5">
                  {displayPhone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {displayPhone}
                    </span>
                  )}
                  {displayEmail && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {displayEmail}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Property / Project Dropdown & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sv-property" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Property / Project <span className="text-rose-500">*</span></span>
              </label>
              <div className="relative">
                <select
                  id="sv-property"
                  value={propertyId || ''}
                  onChange={(e) => handlePropertySelect(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer pr-8"
                  required
                >
                  {propertyList.length === 0 ? (
                    <option value="">No properties available</option>
                  ) : (
                    <>
                      <option value="" disabled>Select property…</option>
                      {propertyList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.location ? ` (${p.location})` : ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="sv-location" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Location</span>
              </label>
              <input
                id="sv-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Porur, ECR"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white"
              />
            </div>
          </div>

          {/* Visit Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sv-date" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Visit date <span className="text-rose-500">*</span></span>
              </label>
              <div
                className="relative cursor-pointer"
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker?.()
                  } catch {}
                }}
              >
                <input
                  id="sv-date"
                  ref={dateInputRef}
                  type="date"
                  value={visitDate}
                  min={isEditing ? undefined : getTodayDateString()}
                  onChange={(e) => setVisitDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.()
                    } catch {}
                  }}
                  className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="sv-time" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Visit time <span className="text-rose-500">*</span></span>
              </label>
              <div className="relative">
                <select
                  id="sv-time"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer pr-8"
                >
                  {VISIT_TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Status & Assigned Agent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sv-status" className="block text-xs font-bold text-slate-700 mb-1.5">
                Visit status
              </label>
              <div className="relative">
                <select
                  id="sv-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer pr-8"
                >
                  {statusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="sv-agent" className="block text-xs font-bold text-slate-700 mb-1.5">
                Assigned person
              </label>
              <div className="relative">
                <select
                  id="sv-agent"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:bg-white cursor-pointer pr-8"
                >
                  {agentOptions.map((ag) => (
                    <option key={ag.name} value={ag.name}>
                      {ag.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Cab pickup toggle */}
          <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-[#E2EDE8]/40 transition">
            <input
              type="checkbox"
              checked={cabPickup}
              onChange={(e) => setCabPickup(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
            />
            <Car className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">
              Arrange cab pickup for customer
            </span>
          </label>

          {/* Notes */}
          <div>
            <label htmlFor="sv-notes" className="block text-xs font-bold text-slate-700 mb-1.5">
              Visit notes (optional)
            </label>
            <textarea
              id="sv-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Pickup from Porur junction, show east-facing plots..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F3D2E] focus:bg-white transition resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting
                ? isEditing ? 'Saving...' : 'Scheduling...'
                : isEditing ? 'Save changes' : 'Schedule visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
