import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin, Plus, Pencil, Trash2, Crosshair, X, Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import SidePanel from '../common/SidePanel'
import EditableSelect from '../common/EditableSelect'
import { useOptions } from '../../hooks/useOptions'
import { useDialog } from '../../context/DialogContext'
import { getApiUrl, getClientUrl } from '../../lib/api'
import Layout3DView from '../layout3d/Layout3DView'

/* Starter categories; the list is editable in the form and stored server-side */
const DEFAULT_CATEGORIES = ['Temple', 'School', 'College', 'Hospital', 'Railway station', 'Bus stop', 'Market', 'Bank / ATM', 'Park', 'Landmark']

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

async function call(path, options) {
  const res = await fetch(getApiUrl(path), { headers: { 'Content-Type': 'application/json' }, ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (HTTP ${res.status})`)
  return data
}

const EMPTY = { name: '', category: '', distance: '', description: '', phase: '', x: null, y: null }

/** Full-screen picker: native 3D layout view in pick mode. */
function PositionPicker({ property, phase, draft, onPick, onClose, value }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const has = Number.isFinite(value?.x) && Number.isFinite(value?.y)
  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/80 backdrop-blur-sm flex flex-col p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Pick position on 3D layout">
      <div className="flex items-center justify-between gap-3 bg-white rounded-t-2xl px-4 py-3 shadow-xs border-b border-slate-100">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Pick the position on the 3D layout</p>
          <p className="text-xs text-slate-500 truncate">Drag to look around, then click where the place is. Click again to move it.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={!has}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl disabled:opacity-40 transition cursor-pointer"
          >
            <Check className="w-4 h-4" /> Use this position
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Close picker">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 w-full relative overflow-hidden rounded-b-2xl bg-[#0d1421]">
        <Layout3DView
          project={property}
          initialPhase={phase}
          pickMode={true}
          draft={draft}
          onPick={onPick}
          onClose={onClose}
        />
      </div>
    </div>
  )
}

export default function NearbyPlacesPanel({ open, onClose, property, phases = [], onChanged, onShowToast }) {
  const { confirm } = useDialog()
  const categories = useOptions('placeCategory', DEFAULT_CATEGORIES)
  const propId = property?.id || property?.projectId
  const [places, setPlaces] = useState(Array.isArray(property?.nearbyPlaces) ? property.nearbyPlaces : [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | place id
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)

  const phaseNames = useMemo(() => phases.map((p, i) => (p.name || `Phase ${i + 1}`).trim()), [phases])
  const clientBase = getClientUrl()
  const clientOrigin = useMemo(() => {
    try {
      return new URL(clientBase).origin
    } catch {
      return ''
    }
  }, [clientBase])

  const load = useCallback(async () => {
    if (!propId) return
    setLoading(true)
    try {
      const data = await call(`/api/plots/${encodeURIComponent(propId)}/places`)
      setPlaces(data.places || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [propId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const sync = (list) => {
    setPlaces(list)
    onChanged?.(list)
  }

  const startNew = () => {
    setForm({ ...EMPTY, category: categories.options[0] || '', phase: phaseNames[0] || '' })
    setEditing('new')
    setError(null)
  }
  const startEdit = (p) => {
    setForm({ ...EMPTY, ...p, x: Number(p.x), y: Number(p.y) })
    setEditing(p.id)
    setError(null)
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) return setError('Enter the place name.')
    if (!form.category) return setError('Choose a category.')
    if (!Number.isFinite(form.x) || !Number.isFinite(form.y)) return setError('Pick the position on the 3D layout.')
    setSaving(true)
    try {
      const body = JSON.stringify({
        name: form.name,
        category: form.category,
        distance: form.distance,
        description: form.description,
        phase: form.phase,
        x: form.x,
        y: form.y,
      })
      const data =
        editing === 'new'
          ? await call(`/api/plots/${encodeURIComponent(propId)}/places`, { method: 'POST', body })
          : await call(`/api/plots/${encodeURIComponent(propId)}/places/${encodeURIComponent(editing)}`, { method: 'PATCH', body })
      sync(data.places || [])
      onShowToast?.(editing === 'new' ? `“${form.name.trim()}” added to the 3D layout` : `“${form.name.trim()}” updated`, 'success')
      setEditing(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p) => {
    const ok = await confirm({
      title: 'Remove nearby place',
      message: `Remove “${p.name}” from the 3D layout? Visitors will no longer see this marker.`,
      tag: p.category,
      confirmText: 'Remove place',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    try {
      const data = await call(`/api/plots/${encodeURIComponent(propId)}/places/${encodeURIComponent(p.id)}`, { method: 'DELETE' })
      sync(data.places || [])
      onShowToast?.(`“${p.name}” removed`, 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const phaseIndex = Math.max(0, phaseNames.findIndex((n) => n.toLowerCase() === String(form.phase || '').toLowerCase()))
  const pickerSrc = useMemo(() => {
    const q = new URLSearchParams({ pick: '1', phase: String(phaseIndex + 1), name: form.name || '', origin: window.location.origin })
    if (Number.isFinite(form.x) && Number.isFinite(form.y)) {
      q.set('x', String(form.x))
      q.set('y', String(form.y))
    }
    return getClientUrl(`/projects/${property?.slug || propId}/3d?${q}`)
    // Built when the picker opens; later picks shouldn't reload the frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking])

  const onPick = useCallback(
    ({ x, y, phase }) => {
      setForm((f) => ({ ...f, x, y, phase: phase && phaseNames.some((n) => n.toLowerCase() === phase.toLowerCase()) ? phase : f.phase }))
    },
    [phaseNames],
  )

  const hasPos = Number.isFinite(form.x) && Number.isFinite(form.y)

  return (
    <>
      <SidePanel open={open} onClose={onClose} title="Nearby places" subtitle="Markers shown on the website's 3D layout" icon={MapPin}>
        {editing ? (
          <form onSubmit={submit} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F3D2E]">
                <ArrowLeft className="w-3.5 h-3.5" /> All places
              </button>
              {error && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <div>
                <label htmlFor="np-name" className={labelCls}>
                  Name <span className="text-rose-500">*</span>
                </label>
                <input id="np-name" className={inputCls} value={form.name} onChange={set('name')} placeholder="e.g. Sri Murugan Temple" maxLength={120} required />
              </div>
              <EditableSelect
                label="Category"
                required
                value={form.category}
                onChange={set('category')}
                options={categories.options}
                onCreate={categories.add}
                onDelete={categories.remove}
                hint="Type to add a new category"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="np-distance" className={labelCls}>Distance</label>
                  <input id="np-distance" className={inputCls} value={form.distance} onChange={set('distance')} placeholder="e.g. 1.2 km" maxLength={40} />
                </div>
                {phaseNames.length > 1 && (
                  <div>
                    <label htmlFor="np-phase" className={labelCls}>Show on</label>
                    <select id="np-phase" className={inputCls} value={form.phase} onChange={set('phase')}>
                      {phaseNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="np-desc" className={labelCls}>Details</label>
                <textarea id="np-desc" rows={3} className={inputCls} value={form.description} onChange={set('description')} placeholder="Short note visitors see when they tap the marker" maxLength={600} />
              </div>
              <div>
                <span className={labelCls}>
                  Position on 3D layout <span className="text-rose-500">*</span>
                </span>
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <span className={`text-xs font-semibold ${hasPos ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {hasPos ? `Set (${Math.round(form.x)}, ${Math.round(form.y)})` : 'Not set yet'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    disabled={!clientOrigin}
                    className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-[#0F3D2E] text-[#0F3D2E] text-xs font-bold rounded-xl"
                  >
                    <Crosshair className="w-3.5 h-3.5" /> {hasPos ? 'Move on 3D layout' : 'Pick on 3D layout'}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-sm disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editing === 'new' ? 'Add place' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {places.length ? `${places.length} place${places.length === 1 ? '' : 's'} on the 3D layout` : 'No nearby places yet'}
              </p>
              <button type="button" onClick={startNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl">
                <Plus className="w-4 h-4" /> Add place
              </button>
            </div>
            {error && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {loading && !places.length ? (
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading places…
              </p>
            ) : places.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                <MapPin className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="mt-2 text-sm font-semibold text-slate-700">Add temples, schools, hospitals and landmarks</p>
                <p className="mt-1 text-xs text-slate-500">Each one appears as a clickable marker on the website's 3D layout.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {places.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                    <span className="w-9 h-9 rounded-lg bg-[#0F3D2E]/8 text-[#0F3D2E] grid place-items-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 truncate">{[p.category, p.distance, phaseNames.length > 1 && p.phase].filter(Boolean).join(' · ')}</p>
                    </div>
                    <button type="button" onClick={() => startEdit(p)} className="p-2 rounded-lg text-slate-500 hover:text-[#0F3D2E] hover:bg-slate-100" aria-label={`Edit ${p.name}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => remove(p)} className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50" aria-label={`Remove ${p.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SidePanel>

      {picking && (
        <PositionPicker
          property={property}
          phase={form.phase || phaseNames[phaseIndex] || 'Phase 1'}
          draft={form}
          value={form}
          onPick={onPick}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
