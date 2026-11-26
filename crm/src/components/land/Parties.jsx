import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Plus, Pencil, Trash2, Search, Loader2, UserRound, X, Phone } from 'lucide-react'
import { btnGhost, btnPrimary } from '../common/PageKit'
import { useDialog } from '../../context/DialogContext'
import { useAuth } from '../../context/AuthContext'
import { listParties, createParty, updateParty, deleteParty } from '../../lib/landApi'
import { LandModal, Field, TextInput, NumberInput, SelectInput, FormError, useAsync } from './LandKit'

/**
 * Add / edit a landowner, vendor or broker. Used by the Vendors page and by
 * the dropdowns in the project and plot forms, so a person looks the same
 * wherever they are managed.
 *   type: 'vendor' | 'broker'
 *   kind: for type 'vendor' only, locks the role to 'Landowner' or 'Vendor'
 */
export function PartyFormModal({ open, type, kind, party, onClose, onSaved }) {
  const isBroker = type === 'broker'
  const blank = { name: '', kind: kind || 'Landowner', phone: '', altPhone: '', email: '', address: '', notes: '', active: true, dcType: 'percent', dcValue: '' }
  const [f, setF] = useState(blank)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))

  // Fill the form each time the dialog opens
  useEffect(() => {
    if (!open) return
    setError(null)
    setF(
      party
        ? { ...blank, ...party, dcType: party.defaultCommission?.type || 'percent', dcValue: party.defaultCommission?.value ?? '' }
        : blank,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, party])

  const submit = async (e) => {
    e?.preventDefault()
    setError(null)
    const noun = isBroker ? 'broker' : (kind || f.kind).toLowerCase()
    if (!f.name.trim()) return setError(`Enter the ${noun}'s name.`)
    setSaving(true)
    try {
      const body = {
        type,
        name: f.name,
        phone: f.phone,
        altPhone: f.altPhone,
        email: f.email,
        address: f.address,
        notes: f.notes,
        active: f.active,
        ...(isBroker ? { defaultCommission: f.dcValue === '' ? null : { type: f.dcType, value: f.dcValue } } : { kind: kind || f.kind }),
      }
      const res = party ? await updateParty(party.id, body) : await createParty(body)
      onSaved?.(res.party)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const role = isBroker ? 'broker' : (kind || f.kind).toLowerCase()
  return (
    <LandModal
      open={open}
      onClose={onClose}
      title={party ? `Edit ${role}` : `Add a ${role}`}
      subtitle={isBroker ? 'Brokers can be added to projects and assigned to plots to track their commission' : kind === 'Vendor' ? 'The vendor or agency the land is bought through' : 'Who owns the land'}
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="party-form" className={btnPrimary} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {party ? 'Save changes' : `Add ${role}`}
          </button>
        </>
      }
    >
      <form id="party-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" htmlFor="pf-name" required className={isBroker || kind ? 'sm:col-span-2' : ''}>
            <TextInput id="pf-name" value={f.name} onChange={set('name')} maxLength={120} autoFocus />
          </Field>
          {!isBroker && !kind && (
            <Field label="Type" htmlFor="pf-kind">
              <SelectInput id="pf-kind" value={f.kind} onChange={set('kind')} options={['Landowner', 'Vendor']} />
            </Field>
          )}
          <Field label="Phone" htmlFor="pf-phone">
            <TextInput id="pf-phone" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="98765 43210" />
          </Field>
          <Field label="Alternate phone" htmlFor="pf-alt">
            <TextInput id="pf-alt" value={f.altPhone} onChange={set('altPhone')} inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="pf-email" className="sm:col-span-2">
            <TextInput id="pf-email" type="email" value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Address" htmlFor="pf-address" className="sm:col-span-2">
            <textarea id="pf-address" rows={2} maxLength={300} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" value={f.address} onChange={(e) => set('address')(e.target.value)} />
          </Field>
          {isBroker && (
            <Field label="Usual commission (optional)" htmlFor="pf-dc" hint="Filled in automatically when this broker is assigned to a plot. You can change it per plot." className="sm:col-span-2">
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <SelectInput id="pf-dc-type" value={f.dcType} onChange={set('dcType')} options={[{ value: 'percent', label: 'Percent (%)' }, { value: 'fixed', label: 'Fixed (₹)' }]} aria-label="Commission type" />
                <NumberInput id="pf-dc" value={f.dcValue} onChange={set('dcValue')} placeholder={f.dcType === 'percent' ? 'e.g. 2' : 'e.g. 50000'} />
              </div>
            </Field>
          )}
          <Field label="Notes" htmlFor="pf-notes" className="sm:col-span-2">
            <textarea id="pf-notes" rows={2} maxLength={1000} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
          </Field>
          {party && (
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-[#0F3D2E]" checked={f.active} onChange={(e) => set('active')(e.target.checked)} />
              Active (inactive records stay where they are used but are hidden from new selections)
            </label>
          )}
        </div>
      </form>
    </LandModal>
  )
}

/* ───────────── Editable dropdown ───────────── */

const NOUN = { Landowner: 'landowner', Vendor: 'vendor', broker: 'broker' }

/**
 * Pick people from the directory, or add / edit / delete them without leaving
 * the form.
 *   type 'broker'            → brokers
 *   type 'vendor' + kind     → landowners ('Landowner') or vendors ('Vendor')
 *   multiple                 → value is an array of ids (brokers on a project)
 * onChange(idOrIds, partyOrParties). Deleting someone who is in use is refused
 * by the server with an explanation.
 */
export function PartySelect({ type = 'broker', kind, multiple = false, value, onChange, canEdit = true, disabled = false, id = 'party-select', placeholder, showDetails = true }) {
  const { confirm, alert } = useDialog()
  const { can } = useAuth()
  // Anyone working with brokers can add and edit; deleting needs Vendors or Land records
  const mayDelete = can('vendors', 'edit') || can('landrecords', 'edit')
  const role = type === 'broker' ? 'broker' : kind
  const noun = NOUN[role] || 'person'
  const { data, loading, error, reload } = useAsync(() => listParties(type), [type])
  const all = useMemo(() => (data?.parties || []).filter((p) => type === 'broker' || (p.kind || 'Landowner') === kind), [data, type, kind])
  const ids = useMemo(() => (multiple ? value || [] : value ? [value] : []), [multiple, value])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(null) // { party? }
  const root = useRef(null)
  const search = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => root.current && !root.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    setTimeout(() => search.current?.focus(), 0)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selected = ids.map((i) => all.find((p) => p.id === i)).filter(Boolean)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((p) => (p.active !== false || ids.includes(p.id)) && (!q || `${p.name} ${p.phone || ''}`.toLowerCase().includes(q)))
  }, [all, query, ids])

  const emit = (nextIds) => {
    const parties = nextIds.map((i) => all.find((p) => p.id === i)).filter(Boolean)
    if (multiple) onChange(nextIds, parties)
    else onChange(nextIds[0] || '', parties[0] || null)
  }
  const choose = (p) => {
    if (multiple) emit(ids.includes(p.id) ? ids.filter((i) => i !== p.id) : [...ids, p.id])
    else {
      emit([p.id])
      setOpen(false)
      setQuery('')
    }
  }

  const remove = async (p) => {
    const ok = await confirm({
      title: `Delete ${noun}`,
      message: `Delete ${p.name}? This can't be undone. Anyone who is on a project or sold a plot can't be deleted; mark them inactive instead.`,
      confirmText: `Delete ${noun}`,
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    try {
      await deleteParty(p.id, type)
      if (ids.includes(p.id)) emit(ids.filter((i) => i !== p.id))
      reload()
    } catch (err) {
      await alert({ title: `Can't delete this ${noun}`, message: err.message, confirmText: 'OK', type: 'info' })
    }
  }

  const label = multiple
    ? selected.length
      ? `${selected.length} ${noun}${selected.length === 1 ? '' : 's'} selected`
      : null
    : selected[0]?.name
  const one = !multiple ? selected[0] : null

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-left hover:border-slate-300 focus:outline-none focus:border-[#0F3D2E] disabled:opacity-60"
      >
        <span className="min-w-0 truncate">
          {label ? (
            <>
              <span className="font-semibold text-slate-800">{label}</span>
              {one?.phone && <span className="text-slate-500"> · {one.phone}</span>}
            </>
          ) : loading ? (
            <span className="text-slate-400">Loading…</span>
          ) : (
            <span className="text-slate-400">{placeholder || `Select ${multiple ? `${noun}s` : `a ${noun}`}`}</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full min-w-[260px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4.5 top-1/2 -translate-y-1/2" />
            <input ref={search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${noun}s`} aria-label={`Search ${noun}s`} className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0F3D2E]/10" />
          </div>
          <ul role="listbox" aria-multiselectable={multiple} className="max-h-60 overflow-y-auto py-1">
            {error ? (
              <li className="px-3 py-3 text-xs text-rose-600">
                {error}{' '}
                <button type="button" onClick={reload} className="font-bold underline">
                  Retry
                </button>
              </li>
            ) : shown.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-slate-400">{all.length ? `No ${noun} matches` : `No ${noun}s yet. Add the first one below.`}</li>
            ) : (
              shown.map((p) => {
                const on = ids.includes(p.id)
                return (
                  <li key={p.id} role="option" aria-selected={on} className={`group flex items-center gap-1 pr-2 ${on ? 'bg-[#E2EDE8]/60' : 'hover:bg-slate-50'}`}>
                    <button type="button" onClick={() => choose(p)} className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-left">
                      {multiple ? (
                        <span className={`w-4 h-4 rounded border grid place-items-center shrink-0 ${on ? 'bg-[#0F3D2E] border-[#0F3D2E] text-white' : 'border-slate-300 bg-white'}`}>{on && <Check className="w-3 h-3" />}</span>
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-[#E2EDE8] text-[#0F3D2E] grid place-items-center shrink-0">
                          <UserRound className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">
                          {p.name} {p.active === false && <span className="text-[10px] font-bold text-slate-400">INACTIVE</span>}
                        </span>
                        <span className="block text-[11px] text-slate-500 truncate">{[p.phone, p.usage ? `${p.usage} ${type === 'broker' ? 'referral' : 'project'}${p.usage === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'No phone'}</span>
                      </span>
                      {!multiple && on && <Check className="w-4 h-4 text-[#0F3D2E] ml-auto shrink-0" />}
                    </button>
                    {canEdit && (
                      <span className="flex items-center shrink-0">
                        <button type="button" onClick={() => setForm({ party: p })} className="p-1.5 rounded-md text-slate-400 hover:text-[#0F3D2E] hover:bg-white" aria-label={`Edit ${p.name}`} title={`Edit ${noun}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {mayDelete && (
                          <button type="button" onClick={() => remove(p)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-white" aria-label={`Delete ${p.name}`} title={`Delete ${noun}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </li>
                )
              })
            )}
          </ul>
          {canEdit && (
            <button type="button" onClick={() => setForm({})} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-[#0F3D2E] bg-slate-50 hover:bg-[#E2EDE8]/60 border-t border-slate-100">
              <Plus className="w-4 h-4" /> Add new {noun}
            </button>
          )}
        </div>
      )}

      {/* What was picked: contact details for one person, chips for several */}
      {showDetails && !multiple && one && (one.phone || one.email || one.address) && (
        <p className="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {one.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" /> {one.phone}
            </span>
          )}
          {one.email && <span>{one.email}</span>}
          {one.address && <span className="truncate max-w-full">{one.address}</span>}
        </p>
      )}
      {multiple && selected.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-[#E2EDE8] text-[#0F3D2E] text-xs font-semibold">
              {p.name}
              {p.phone && <span className="font-normal text-[#0F3D2E]/70">{p.phone}</span>}
              {!disabled && (
                <button type="button" onClick={() => emit(ids.filter((i) => i !== p.id))} className="p-0.5 rounded-full hover:bg-white/70" aria-label={`Remove ${p.name}`}>
                  <X className="w-3 h-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <PartyFormModal
        open={Boolean(form)}
        type={type}
        kind={type === 'vendor' ? kind : undefined}
        party={form?.party}
        onClose={() => setForm(null)}
        onSaved={(p) => {
          reload()
          // A new person is selected straight away; an edited one keeps its place.
          // The saved record is passed on directly: the list above is still the old one.
          if (!form?.party) {
            if (multiple) onChange([...ids, p.id], [...selected, p])
            else onChange(p.id, p)
          } else if (ids.includes(p.id)) {
            if (multiple) onChange(ids, selected.map((x) => (x.id === p.id ? p : x)))
            else onChange(p.id, p)
          }
        }}
      />
    </div>
  )
}

/** Broker dropdown for one plot: onChange(id, broker). */
export function BrokerSelect(props) {
  return <PartySelect type="broker" id="broker-select" {...props} />
}
