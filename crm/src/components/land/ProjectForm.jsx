import React, { useEffect, useState } from 'react'
import { Check, Loader2, Trash2, Map as MapIcon } from 'lucide-react'
import SidePanel from '../common/SidePanel'
import { btnGhost, btnPrimary } from '../common/PageKit'
import { useDialog } from '../../context/DialogContext'
import { createProject, updateProject, deleteProject } from '../../lib/landApi'
import { Field, TextInput, NumberInput, SelectInput, FormError, SectionTitle, PROJECT_STATUSES, AREA_UNITS, inr, todayIso } from './LandKit'
import { PartySelect } from './Parties'

const blank = () => ({
  name: '',
  status: PROJECT_STATUSES[0],
  village: '',
  taluk: '',
  district: '',
  state: 'Tamil Nadu',
  surveyNumbers: '',
  totalArea: '',
  areaUnit: 'Acres',
  landownerId: '',
  vendorId: '',
  brokerIds: [],
  rate: '',
  landPrice: '',
  priceDate: todayIso(),
  agreementDate: '',
  registrationDate: '',
  registrationNo: '',
  paidToOwner: '',
  stampDuty: '',
  registrationCharges: '',
  otherCosts: '',
  purchaseNotes: '',
  notes: '',
})

const parse = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return v === '' || v == null || !Number.isFinite(n) ? null : n
}

/** Add or edit a land project. Creating one can also record its opening price (the first Price Log entry). */
export default function ProjectForm({ open, project, canDelete, onClose, onSaved, onDeleted }) {
  const { confirm, alert } = useDialog()
  const editing = Boolean(project)
  const [f, setF] = useState(blank)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!project) return setF(blank())
    const pu = project.purchase || {}
    setF({
      ...blank(),
      name: project.name,
      status: project.status,
      village: project.village,
      taluk: project.taluk,
      district: project.district,
      state: project.state,
      surveyNumbers: project.surveyNumbers,
      totalArea: project.totalArea ?? '',
      areaUnit: project.areaUnit,
      landownerId: project.landownerId || '',
      vendorId: project.vendorId || '',
      brokerIds: project.brokerIds || [],
      agreementDate: pu.agreementDate || '',
      registrationDate: pu.registrationDate || '',
      registrationNo: pu.registrationNo || '',
      paidToOwner: pu.paidToOwner ?? '',
      stampDuty: pu.stampDuty ?? '',
      registrationCharges: pu.registrationCharges ?? '',
      otherCosts: pu.otherCosts ?? '',
      purchaseNotes: pu.notes || '',
      notes: project.notes || '',
    })
  }, [open, project])

  const area = parse(f.totalArea)
  const rate = parse(f.rate)
  const total = parse(f.landPrice)
  const derivedTotal = total == null && rate != null && area ? rate * area : null

  const submit = async (e) => {
    e?.preventDefault()
    setError(null)
    if (!f.name.trim()) return setError('Enter the project name.')
    setSaving(true)
    try {
      const body = {
        name: f.name,
        status: f.status,
        village: f.village,
        taluk: f.taluk,
        district: f.district,
        state: f.state,
        surveyNumbers: f.surveyNumbers,
        totalArea: f.totalArea,
        areaUnit: f.areaUnit,
        landownerId: f.landownerId,
        vendorId: f.vendorId,
        brokerIds: f.brokerIds,
        notes: f.notes,
        purchase: {
          agreementDate: f.agreementDate,
          registrationDate: f.registrationDate,
          registrationNo: f.registrationNo,
          paidToOwner: f.paidToOwner,
          stampDuty: f.stampDuty,
          registrationCharges: f.registrationCharges,
          otherCosts: f.otherCosts,
          notes: f.purchaseNotes,
        },
        ...(editing ? {} : { rate: f.rate, landPrice: f.landPrice, priceDate: f.priceDate }),
      }
      const res = editing ? await updateProject(project.id, body) : await createProject(body)
      onSaved(res.project, !editing)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete project',
      message: `Delete “${project.name}” with all its plots, price log and document log? This can't be undone. Projects that have payments recorded can't be deleted.`,
      confirmText: 'Delete project',
      cancelText: 'Cancel',
      type: 'danger',
    })
    if (!ok) return
    try {
      await deleteProject(project.id)
      onDeleted?.(project)
      onClose()
    } catch (err) {
      await alert({ title: "Can't delete this project", message: err.message, confirmText: 'OK', type: 'info' })
    }
  }

  return (
    <SidePanel open={open} onClose={onClose} title={editing ? 'Edit project' : 'Add land project'} subtitle={editing ? project.name : 'Land we are buying'} icon={MapIcon} width="max-w-2xl">
      <form onSubmit={submit} className="flex flex-col h-full" noValidate>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <FormError message={error} />

          <section className="space-y-3">
            <SectionTitle>Project</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project name" htmlFor="lp-name" required className="sm:col-span-2">
                <TextInput id="lp-name" value={f.name} onChange={set('name')} maxLength={120} autoFocus={!editing} />
              </Field>
              <Field label="Status" htmlFor="lp-status">
                <SelectInput id="lp-status" value={f.status} onChange={set('status')} options={PROJECT_STATUSES} />
              </Field>
              <Field label="Survey numbers" htmlFor="lp-survey">
                <TextInput id="lp-survey" value={f.surveyNumbers} onChange={set('surveyNumbers')} placeholder="e.g. 112/1A, 112/2" />
              </Field>
              <Field label="Village" htmlFor="lp-village">
                <TextInput id="lp-village" value={f.village} onChange={set('village')} />
              </Field>
              <Field label="Taluk" htmlFor="lp-taluk">
                <TextInput id="lp-taluk" value={f.taluk} onChange={set('taluk')} />
              </Field>
              <Field label="District" htmlFor="lp-district">
                <TextInput id="lp-district" value={f.district} onChange={set('district')} />
              </Field>
              <Field label="State" htmlFor="lp-state">
                <TextInput id="lp-state" value={f.state} onChange={set('state')} />
              </Field>
              <Field label="Total area" htmlFor="lp-area">
                <NumberInput id="lp-area" value={f.totalArea} onChange={set('totalArea')} placeholder="e.g. 10" />
              </Field>
              <Field label="Area unit" htmlFor="lp-unit">
                <SelectInput id="lp-unit" value={f.areaUnit} onChange={set('areaUnit')} options={AREA_UNITS} />
              </Field>
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="sec-landowner">
            <SectionTitle id="sec-landowner">Landowner</SectionTitle>
            <p className="text-[11px] text-slate-500 -mt-1">The person who actually owns the land.</p>
            <PartySelect id="lp-landowner" type="vendor" kind="Landowner" value={f.landownerId} onChange={(id) => set('landownerId')(id)} />
          </section>

          <section className="space-y-3" aria-labelledby="sec-vendor">
            <SectionTitle id="sec-vendor">Vendor</SectionTitle>
            <p className="text-[11px] text-slate-500 -mt-1">The vendor or agency the land is bought through, if any.</p>
            <PartySelect id="lp-vendor" type="vendor" kind="Vendor" value={f.vendorId} onChange={(id) => set('vendorId')(id)} />
          </section>

          <section className="space-y-3" aria-labelledby="sec-brokers">
            <SectionTitle id="sec-brokers">Brokers</SectionTitle>
            <p className="text-[11px] text-slate-500 -mt-1">Optional. Add every broker involved in this purchase.</p>
            <PartySelect id="lp-brokers" type="broker" multiple value={f.brokerIds} onChange={(ids) => set('brokerIds')(ids)} />
          </section>

          {!editing && (
            <section className="space-y-3">
              <SectionTitle>Opening price</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label={`Rate per ${f.areaUnit.toLowerCase().replace(/s$/, '')} (₹)`} htmlFor="lp-rate">
                  <NumberInput id="lp-rate" value={f.rate} onChange={set('rate')} />
                </Field>
                <Field label="Total land price (₹)" htmlFor="lp-price" hint={derivedTotal != null ? `Will be ${inr(derivedTotal)} (rate × area)` : 'Leave blank to work it out from the rate'}>
                  <NumberInput id="lp-price" value={f.landPrice} onChange={set('landPrice')} />
                </Field>
                <Field label="Price as on" htmlFor="lp-pdate">
                  <TextInput id="lp-pdate" type="date" value={f.priceDate} onChange={set('priceDate')} />
                </Field>
              </div>
              <p className="text-[11px] text-slate-500">This becomes the first line of the Price Log. Later price changes are added there.</p>
            </section>
          )}

          <section className="space-y-3">
            <SectionTitle>Purchase details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Agreement date" htmlFor="lp-agr">
                <TextInput id="lp-agr" type="date" value={f.agreementDate} onChange={set('agreementDate')} />
              </Field>
              <Field label="Registration date" htmlFor="lp-reg">
                <TextInput id="lp-reg" type="date" value={f.registrationDate} onChange={set('registrationDate')} />
              </Field>
              <Field label="Registration no." htmlFor="lp-regno" className="sm:col-span-2">
                <TextInput id="lp-regno" value={f.registrationNo} onChange={set('registrationNo')} maxLength={60} />
              </Field>
              <Field label="Paid to owner so far (₹)" htmlFor="lp-paid">
                <NumberInput id="lp-paid" value={f.paidToOwner} onChange={set('paidToOwner')} />
              </Field>
              <Field label="Stamp duty (₹)" htmlFor="lp-stamp">
                <NumberInput id="lp-stamp" value={f.stampDuty} onChange={set('stampDuty')} />
              </Field>
              <Field label="Registration charges (₹)" htmlFor="lp-rc">
                <NumberInput id="lp-rc" value={f.registrationCharges} onChange={set('registrationCharges')} />
              </Field>
              <Field label="Other costs (₹)" htmlFor="lp-other">
                <NumberInput id="lp-other" value={f.otherCosts} onChange={set('otherCosts')} />
              </Field>
              <Field label="Purchase notes" htmlFor="lp-pn" className="sm:col-span-2">
                <textarea id="lp-pn" rows={2} maxLength={1000} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" value={f.purchaseNotes} onChange={(e) => set('purchaseNotes')(e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Notes</SectionTitle>
            <textarea aria-label="Project notes" rows={3} maxLength={1500} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F3D2E]" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
          </section>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-2">
          {editing && canDelete ? (
            <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl">
              <Trash2 className="w-4 h-4" /> Delete project
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnGhost}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </div>
      </form>

    </SidePanel>
  )
}
