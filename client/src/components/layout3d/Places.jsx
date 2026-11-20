'use client'

import { createElement } from 'react'
import {
  Banknote,
  Building2,
  Bus,
  Church,
  Flag,
  Fuel,
  GraduationCap,
  Hospital,
  Landmark,
  MapPin,
  Plane,
  ShoppingCart,
  TrainFront,
  Trees,
  Utensils,
  X,
} from 'lucide-react'
import { cls } from './status'

// Category text comes from the CRM (an editable list), so match on keywords
const ICONS = [
  [/temple|kovil|mosque|masjid|gurudwara|shrine|worship/i, Landmark],
  [/church/i, Church],
  [/school|college|universit|institut|academy/i, GraduationCap],
  [/hospital|clinic|medical|health|pharma/i, Hospital],
  [/railway|train|metro|station/i, TrainFront],
  [/bus/i, Bus],
  [/airport/i, Plane],
  [/market|mall|shop|super|store/i, ShoppingCart],
  [/park|lake|garden|forest/i, Trees],
  [/petrol|fuel|gas/i, Fuel],
  [/bank|atm/i, Banknote],
  [/restaurant|hotel|food|cafe/i, Utensils],
  [/office|it park|tech|industr|company/i, Building2],
  [/landmark|junction|toll|bridge|signal/i, Flag],
]

function iconFor(category) {
  const hit = ICONS.find(([re]) => re.test(String(category || '')))
  return hit ? hit[1] : MapPin
}

function PlaceIcon({ category, size }) {
  return createElement(iconFor(category), { size, 'aria-hidden': true })
}

/**
 * Marker buttons. Their screen position is written by the render loop
 * (registerRef gives it each element), so React only renders on data changes.
 */
export function PlaceMarkers({ places, activeId, onSelect, registerRef, draft }) {
  return (
    <div className="l3d-places" aria-label="Nearby places">
      {places.map((p) => {
        return (
          <button
            key={p.id}
            ref={(el) => registerRef(p.id, el)}
            type="button"
            className={cls('l3d-place', activeId === p.id && 'on')}
            onClick={(e) => {
              e.stopPropagation()
              onSelect?.(p.id)
            }}
            aria-label={`${p.name}${p.category ? `, ${p.category}` : ''}`}
            style={{ opacity: 0 }}
          >
            <span className="l3d-place__pin">
              <PlaceIcon category={p.category} size={15} />
            </span>
            <span className="l3d-place__name">{p.name}</span>
          </button>
        )
      })}
      {draft && (
        <div ref={(el) => registerRef('__draft', el)} className="l3d-place l3d-place--draft" style={{ opacity: 0 }} aria-hidden="true">
          <span className="l3d-place__pin">
            <MapPin size={15} />
          </span>
          {draft.name && <span className="l3d-place__name">{draft.name}</span>}
        </div>
      )}
    </div>
  )
}

export function PlaceDetails({ place, onClose }) {
  return (
    <section className="l3d-glass l3d-card l3d-card--place l3d-scroll" aria-label={`${place.name} details`} aria-live="polite">
      <span className="l3d-grab" aria-hidden="true" />
      <div className="l3d-card__head">
        <span className="l3d-place-icon" aria-hidden="true">
          <PlaceIcon category={place.category} size={17} />
        </span>
        <h2>{place.name}</h2>
        <button type="button" className="l3d-ib l3d-card__close" onClick={onClose} aria-label="Close place details" title="Close">
          <X size={16} />
        </button>
      </div>
      <p className="l3d-place-meta">
        {[place.category, place.distance && `${place.distance} away`].filter(Boolean).join(' · ')}
      </p>
      {place.description && <p className="l3d-place-desc">{place.description}</p>}
    </section>
  )
}
