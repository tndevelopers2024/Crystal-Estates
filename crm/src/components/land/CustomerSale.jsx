import React from 'react'
import { Field, TextInput, NumberInput, SelectInput, SectionTitle, inr } from './LandKit'
import { BrokerSelect } from './Parties'

const parse = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return v === '' || v == null || !Number.isFinite(n) ? null : n
}

/** Form state for the customer, sale, broker and commission of a plot. */
export const blankSale = {
  cName: '',
  cPhone: '',
  cEmail: '',
  cAddress: '',
  source: 'direct',
  brokerId: '',
  cmType: 'percent',
  cmValue: '',
  cmNote: '',
  salePrice: '',
  saleDate: '',
}

export const saleFormFromPlot = (p) => ({
  cName: p.customer?.name || '',
  cPhone: p.customer?.phone || '',
  cEmail: p.customer?.email || '',
  cAddress: p.customer?.address || '',
  source: p.source || 'direct',
  brokerId: p.brokerId || '',
  cmType: p.commission?.type || 'percent',
  cmValue: p.commission?.value ?? '',
  cmNote: p.commission?.note || '',
  salePrice: p.salePrice ?? '',
  saleDate: p.saleDate || '',
})

/** The part of a plot update that carries the customer, sale, broker and commission. */
export function saleBody(f, existingCustomer) {
  const hasCustomer = [f.cName, f.cPhone, f.cEmail, f.cAddress].some((v) => String(v).trim())
  return {
    customer: hasCustomer ? { name: f.cName, phone: f.cPhone, email: f.cEmail, address: f.cAddress, notes: existingCustomer?.notes || '' } : null,
    source: f.source,
    brokerId: f.source === 'broker' ? f.brokerId : '',
    commission: f.source === 'broker' ? { type: f.cmType, value: f.cmValue, note: f.cmNote } : null,
    salePrice: f.salePrice,
    saleDate: f.saleDate,
  }
}

/** Customer details, sale price and the optional broker with commission. */
export function CustomerSaleFields({ f, set, setF }) {
  const sale = parse(f.salePrice)
  const cm = parse(f.cmValue)
  const payable = cm == null ? null : f.cmType === 'percent' ? (sale == null ? null : Math.round(((sale * cm) / 100) * 100) / 100) : cm
  return (
    <>
      <section className="space-y-3">
        <SectionTitle>Customer</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" htmlFor="pd-cname" className="col-span-2">
            <TextInput id="pd-cname" value={f.cName} onChange={set('cName')} maxLength={120} />
          </Field>
          <Field label="Phone" htmlFor="pd-cphone">
            <TextInput id="pd-cphone" value={f.cPhone} onChange={set('cPhone')} inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="pd-cmail">
            <TextInput id="pd-cmail" type="email" value={f.cEmail} onChange={set('cEmail')} />
          </Field>
          <Field label="Address" htmlFor="pd-caddr" className="col-span-2">
            <TextInput id="pd-caddr" value={f.cAddress} onChange={set('cAddress')} maxLength={300} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Sale</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sale price (₹)" htmlFor="pd-sale">
            <NumberInput id="pd-sale" value={f.salePrice} onChange={set('salePrice')} />
          </Field>
          <Field label="Sale date" htmlFor="pd-sdate">
            <TextInput id="pd-sdate" type="date" value={f.saleDate} onChange={set('saleDate')} />
          </Field>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">How was this plot sold?</p>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200" role="radiogroup" aria-label="Sale source">
            {[
              ['direct', 'Directly to the customer'],
              ['broker', 'Through a broker'],
            ].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={f.source === id} onClick={() => set('source')(id)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${f.source === id ? 'bg-white text-[#0F3D2E] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {f.source === 'broker' && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <Field label="Broker" htmlFor="broker-select" required>
              <BrokerSelect
                value={f.brokerId}
                canEdit
                onChange={(id, broker) => {
                  setF((x) => ({
                    ...x,
                    brokerId: id,
                    // Use the broker's usual commission when none is entered yet
                    ...(broker?.defaultCommission && x.cmValue === '' ? { cmType: broker.defaultCommission.type, cmValue: broker.defaultCommission.value } : {}),
                  }))
                }}
              />
            </Field>
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <Field label="Commission" htmlFor="pd-cmtype">
                <SelectInput id="pd-cmtype" value={f.cmType} onChange={set('cmType')} options={[{ value: 'percent', label: 'Percent (%)' }, { value: 'fixed', label: 'Fixed (₹)' }]} />
              </Field>
              <Field label={f.cmType === 'percent' ? 'Percentage' : 'Amount (₹)'} htmlFor="pd-cmval" hint={payable != null ? `Payable: ${inr(payable)}` : f.cmType === 'percent' ? 'Set the sale price to see the amount' : undefined}>
                <NumberInput id="pd-cmval" value={f.cmValue} onChange={set('cmValue')} />
              </Field>
            </div>
            <Field label="Commission note" htmlFor="pd-cmnote">
              <TextInput id="pd-cmnote" value={f.cmNote} onChange={set('cmNote')} maxLength={200} placeholder="e.g. Payable after registration" />
            </Field>
          </div>
        )}
      </section>

    </>
  )
}
