import React from 'react'
import {
  ArrowLeft,
  CalendarCheck,
  ChevronDown,
  Compass,
  MapPin,
  Maximize2,
  MessageCircle,
  Minimize2,
  Minus,
  Phone,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react'
import { SIZES, STATUS, STATUS_ORDER, cls } from './status'

/* ───────── Primitives ───────── */

export function IconButton({ label, onClick, active, className, children, ...rest }) {
  return (
    <button
      type="button"
      className={cls('l3d-ib', active && 'on', className)}
      onClick={onClick}
      aria-label={label}
      title={label}
      {...(active !== undefined ? { 'aria-pressed': Boolean(active) } : {})}
      {...rest}
    >
      {children}
    </button>
  )
}

export function StatusBadge({ group, text }) {
  const s = STATUS[group] || STATUS.untagged
  return (
    <span className="l3d-badge" style={{ '--c': s.color }}>
      {text || s.label}
    </span>
  )
}

export function Segmented({ items, value, onChange, label }) {
  return (
    <div className="l3d-seg" role="tablist" aria-label={label}>
      {items.map((it, i) => (
        <button key={it.id} type="button" role="tab" aria-selected={i === value} className={i === value ? 'on' : ''} onClick={() => onChange(i)}>
          {it.name}
        </button>
      ))}
    </div>
  )
}

/* ───────── Header ───────── */

export function ProjectHeader({ name, location, href, phases, phaseIdx, onPhase, onBack }) {
  return (
    <header className="l3d-glass l3d-head">
      {onBack ? (
        <button type="button" onClick={onBack} className="l3d-ib l3d-back" aria-label={`Back to ${name}`} title="Back">
          <ArrowLeft size={16} />
        </button>
      ) : (
        <a href={href || '#'} className="l3d-ib l3d-back" aria-label={`Back to ${name}`} title="Back to project">
          <ArrowLeft size={16} />
        </a>
      )}
      <div className="l3d-head__text">
        <h1>{name}</h1>
        {location && <p>{location}</p>}
      </div>
      {phases.length > 1 && <Segmented items={phases} value={phaseIdx} onChange={onPhase} label="Phase" />}
    </header>
  )
}

/* ───────── Search + filters ───────── */

export function SearchBar({ inputRef, query, setQuery, onSubmit, filterCount, filtersOpen, toggleFilters }) {
  return (
    <div className="l3d-find__row">
      <form className="l3d-glass l3d-search" onSubmit={onSubmit} role="search">
        <Search size={15} aria-hidden="true" className="l3d-search__icon" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plot no."
          aria-label="Search by plot number"
          enterKeyHint="search"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="l3d-search__clear" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
        <button type="submit" className="l3d-go">
          Go
        </button>
      </form>
      <button
        type="button"
        className={cls('l3d-glass l3d-filter-btn', filtersOpen && 'on')}
        onClick={toggleFilters}
        aria-expanded={filtersOpen}
        aria-controls="l3d-filters"
        aria-label={`Filters${filterCount ? `, ${filterCount} active` : ''}`}
      >
        <SlidersHorizontal size={15} />
        <span className="l3d-filter-btn__label">Filters</span>
        {filterCount > 0 && <em>{filterCount}</em>}
      </button>
    </div>
  )
}

export function FilterPanel({ counts, total, status, setStatus, size, setSize, facing, setFacing, facings, matchCount, onClear, onClose }) {
  const active = status !== 'all' || size !== 'all' || facing !== 'all'
  return (
    <div id="l3d-filters" className="l3d-glass l3d-filters" role="dialog" aria-label="Filters">
      <p className="l3d-label">Status</p>
      <div className="l3d-chips" role="group" aria-label="Status">
        <button type="button" className={status === 'all' ? 'on' : ''} onClick={() => setStatus('all')}>
          All <em>{total}</em>
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} type="button" className={status === s ? 'on' : ''} onClick={() => setStatus(status === s ? 'all' : s)} disabled={!counts[s]}>
            <i style={{ background: STATUS[s].color }} />
            {STATUS[s].label} <em>{counts[s]}</em>
          </button>
        ))}
      </div>
      <div className="l3d-filters__selects">
        <label>
          <span className="l3d-label">Size</span>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {facings.length > 0 && (
          <label>
            <span className="l3d-label">Facing</span>
            <select value={facing} onChange={(e) => setFacing(e.target.value)}>
              <option value="all">Any facing</option>
              {facings.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="l3d-filters__foot">
        <button type="button" className="l3d-link" onClick={onClear} disabled={!active}>
          Clear all
        </button>
        <button type="button" className="l3d-btn l3d-btn--gold l3d-btn--sm" onClick={onClose}>
          Show {matchCount} plots
        </button>
      </div>
    </div>
  )
}

/* ───────── Availability ───────── */

export function AvailabilityCard({ counts, total, other, open, onToggle, availableList, selected, onPick, updatedAt }) {
  return (
    <aside className={cls('l3d-glass l3d-avail', open && 'open')} aria-label="Availability">
      <button type="button" className="l3d-avail__head" onClick={onToggle} aria-expanded={open}>
        <span className="l3d-avail__num">{counts.available}</span>
        <span className="l3d-avail__of">of {total} available</span>
        <span className="l3d-live" title={`Live · updated ${updatedAt.toLocaleTimeString()}`} aria-label="Live status" />
        <ChevronDown size={16} className="l3d-chev" aria-hidden="true" />
      </button>
      <div className="l3d-bar" aria-hidden="true">
        {STATUS_ORDER.map((s) => (
          <span key={s} style={{ width: `${(counts[s] / Math.max(total, 1)) * 100}%`, background: STATUS[s].color }} />
        ))}
      </div>
      {open && (
        <div className="l3d-avail__body l3d-scroll">
          <ul className="l3d-legend">
            {STATUS_ORDER.map((s) => (
              <li key={s}>
                <i style={{ background: STATUS[s].color }} />
                {STATUS[s].label}
                <b>{counts[s]}</b>
              </li>
            ))}
            {other > 0 && (
              <li title="Plots without a CRM record or plot number in the layout file">
                <i style={{ background: STATUS.untagged.color }} />
                Not linked
                <b>{other}</b>
              </li>
            )}
          </ul>
          <p className="l3d-note">Surroundings are illustrative</p>
        </div>
      )}
    </aside>
  )
}

/* ───────── Camera tools ───────── */

export function ViewTools({ onZoomIn, onZoomOut, onTop, onReset, autoRotate, onRotate, fullscreen, onFullscreen, needleRef, placesCount = 0, placesOn, onPlaces }) {
  return (
    <div className="l3d-glass l3d-tools" role="toolbar" aria-label="View controls">
      <IconButton label="Zoom in" onClick={onZoomIn}>
        <Plus size={16} />
      </IconButton>
      <IconButton label="Zoom out" onClick={onZoomOut}>
        <Minus size={16} />
      </IconButton>
      <span className="l3d-tools__sep" aria-hidden="true" />
      <IconButton label="Top view" onClick={onTop}>
        <Square size={14} />
      </IconButton>
      <IconButton label="Reset view" onClick={onReset}>
        <RotateCcw size={15} />
      </IconButton>
      <IconButton label="Auto rotate" onClick={onRotate} active={autoRotate}>
        <RotateCw size={15} />
      </IconButton>
      <IconButton label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={onFullscreen}>
        {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </IconButton>
      {placesCount > 0 && (
        <IconButton label={placesOn ? 'Hide nearby places' : 'Show nearby places'} onClick={onPlaces} active={placesOn}>
          <MapPin size={15} />
        </IconButton>
      )}
      <span className="l3d-tools__sep" aria-hidden="true" />
      <IconButton label="North up" onClick={onReset} className="l3d-compass">
        <span ref={needleRef}>
          <Compass size={17} />
        </span>
      </IconButton>
    </div>
  )
}

/* ───────── Plot details ───────── */

export function PlotDetails({ no, group, statusText, price, specs, hasRecord, flash, onClose, onBook, waUrl, crmUrl }) {
  return (
    <section className="l3d-glass l3d-card l3d-scroll" aria-label={`Plot ${no} details`} aria-live="polite">
      <span className="l3d-grab" aria-hidden="true" />
      <div className="l3d-card__head">
        <h2>Plot {no}</h2>
        <StatusBadge group={group} text={statusText} />
        <IconButton label="Close plot details" onClick={onClose} className="l3d-card__close">
          <X size={16} />
        </IconButton>
      </div>
      {flash && <p className="l3d-flash">{flash}</p>}
      {hasRecord ? (
        <>
          <p className="l3d-price">{price}</p>
          <dl className="l3d-specs">
            {specs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="l3d-muted">No details recorded for this plot yet.</p>
      )}
      <div className="l3d-cta">
        <button type="button" className="l3d-btn l3d-btn--gold" onClick={onBook}>
          <CalendarCheck size={15} /> Book site visit
        </button>
        <a className="l3d-btn l3d-btn--wa" href={waUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={15} /> WhatsApp
        </a>
      </div>
    </section>
  )
}

/* ───────── Bottom actions ───────── */

export function ActionBar({ onEnquire, waUrl, telUrl, mapUrl }) {
  return (
    <nav className="l3d-glass l3d-actions" aria-label="Contact">
      <button type="button" onClick={onEnquire} className="l3d-actions__primary">
        <CalendarCheck size={16} />
        <span>Enquire</span>
      </button>
      <a href={waUrl} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={16} />
        <span>WhatsApp</span>
      </a>
      <a href={telUrl}>
        <Phone size={16} />
        <span>Call</span>
      </a>
      <a href={mapUrl} target="_blank" rel="noopener noreferrer">
        <MapPin size={16} />
        <span>Location</span>
      </a>
    </nav>
  )
}
