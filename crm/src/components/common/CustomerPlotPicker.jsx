import React, { useMemo } from 'react'
import SearchSelect from './SearchSelect'
import { ensurePlotUids, statusGroup } from '../../lib/plotUtils'

/** Pick the customer's project and plot from their lead record, when it names them. */
export function guessFromLead(lead, properties) {
  if (!lead) return {}
  const prop =
    properties.find((p) => lead.propertyId && (p.id === lead.propertyId || p.projectId === lead.propertyId)) ||
    properties.find((p) => p.name && lead.property && p.name.toLowerCase() === String(lead.property).toLowerCase())
  if (!prop) return {}
  const m = String(lead.unit || '').match(/plot\s*#?\s*([0-9A-Za-z()/-]+)/i)
  const plots = ensurePlotUids(prop.plots || [])
  const plot = m ? plots.find((p) => String(p.plotNo).toLowerCase() === m[1].toLowerCase()) : null
  return { propertyId: prop.id, plotUid: plot?.uid || '', plotNo: plot?.plotNo || '', phase: plot?.phase || '' }
}

/**
 * Customer → project → plot selector.
 * value: { leadId, propertyId, plotUid, plotNo, phase }
 */
export default function CustomerPlotPicker({ leads = [], properties = [], value, onChange, requirePlot = false, plotLabel = 'Plot' }) {
  const customerOptions = useMemo(
    () =>
      leads
        .filter((l) => l && l.id && l.name)
        .map((l) => ({
          value: l.id,
          label: l.name,
          sub: [l.phone, l.property && l.property !== 'General Enquiry' ? l.property : null, l.unit && l.unit !== 'Not allotted' ? l.unit : null]
            .filter(Boolean)
            .join(' · '),
        })),
    [leads],
  )

  const projectOptions = useMemo(
    () => properties.map((p) => ({ value: p.id, label: p.name, sub: p.location })),
    [properties],
  )

  const project = properties.find((p) => p.id === value.propertyId)
  const plots = useMemo(() => ensurePlotUids(project?.plots || []), [project])
  const multiPhase = new Set(plots.map((p) => p.phase).filter(Boolean)).size > 1

  const plotOptions = useMemo(
    () =>
      plots.map((p) => ({
        value: p.uid,
        label: `Plot ${p.plotNo}${multiPhase && p.phase ? ` · ${p.phase}` : ''}`,
        sub: [statusGroup(p.status), p.area, p.facing && `${p.facing} facing`].filter(Boolean).join(' · '),
      })),
    [plots, multiPhase],
  )

  const setCustomer = (leadId) => {
    const lead = leads.find((l) => l.id === leadId)
    // Pre-fill project/plot from the lead, but never wipe a choice already made
    const guess = guessFromLead(lead, properties)
    onChange({
      leadId,
      propertyId: value.propertyId || guess.propertyId || '',
      plotUid: value.plotUid || guess.plotUid || '',
      plotNo: value.plotNo || guess.plotNo || '',
      phase: value.phase || guess.phase || '',
    })
  }

  const setProject = (propertyId) => onChange({ ...value, propertyId, plotUid: '', plotNo: '', phase: '' })

  const setPlot = (uid) => {
    const p = plots.find((x) => x.uid === uid)
    onChange({ ...value, plotUid: uid || '', plotNo: p?.plotNo || '', phase: p?.phase || '' })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <SearchSelect
          label="Customer"
          required
          value={value.leadId}
          onChange={setCustomer}
          options={customerOptions}
          placeholder="Search customers by name or phone"
          emptyText="No customers found. Add them as a lead first."
        />
      </div>
      <SearchSelect
        label="Project"
        required={requirePlot}
        value={value.propertyId}
        onChange={setProject}
        options={projectOptions}
        placeholder="Select project"
        clearable={!requirePlot}
      />
      <SearchSelect
        label={plotLabel}
        required={requirePlot}
        value={value.plotUid}
        onChange={setPlot}
        options={plotOptions}
        placeholder={project ? 'Select plot' : 'Pick a project first'}
        disabled={!project}
        clearable={!requirePlot}
        emptyText="This project has no plots yet"
      />
    </div>
  )
}
