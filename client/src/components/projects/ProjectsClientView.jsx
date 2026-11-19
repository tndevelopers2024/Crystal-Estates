'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  X,
  CheckCircle2,
} from 'lucide-react'
import { ProjectGrid } from './ProjectGrid'
import { normalizePlot } from '../../lib/api'

const initialFilterState = {
  type: 'All',
  location: '',
  priceRange: 'all',
  availability: 'all',
  searchQuery: '',
}

export default function ProjectsClientView({ initialProjects = null }) {
  const [dbProjects, setDbProjects] = useState(
    Array.isArray(initialProjects) && initialProjects.length > 0 ? initialProjects : []
  )
  const [loading, setLoading] = useState(!initialProjects || initialProjects.length === 0)
  const [filters, setFilters] = useState(initialFilterState)

  // Fetch updated data from backend API
  useEffect(() => {
    let isMounted = true

    fetch('/api/plots')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.plots) && data.plots.length > 0) {
          const normalized = data.plots.map(normalizePlot)
          setDbProjects(normalized)
        }
      })
      .catch((err) => {
        console.warn('Could not fetch plots from MongoDB API:', err.message)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleFilterChange = (field) => (e) => {
    setFilters((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleResetFilters = () => {
    setFilters(initialFilterState)
  }

  const handleClearSingleFilter = (field) => () => {
    setFilters((prev) => ({
      ...prev,
      [field]: field === 'type' ? 'All' : field === 'location' ? '' : 'all',
    }))
  }

  // Derive dynamic locations from actual projects in database
  const locationOptions = useMemo(() => {
    const locSet = new Set()
    dbProjects.forEach((p) => {
      if (p.location && p.location.trim().length > 0) locSet.add(p.location.trim())
      if (p.district && p.district.trim().length > 0) locSet.add(p.district.trim())
      if (p.village && p.village.trim().length > 0) locSet.add(p.village.trim())
    })
    return Array.from(locSet).filter(Boolean).sort()
  }, [dbProjects])

  // Filter computation
  const filteredProjects = useMemo(() => {
    return dbProjects.filter((proj) => {
      // 1. Search Query
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim()
        const searchable = [
          proj.name,
          proj.projectName,
          proj.location,
          proj.district,
          proj.taluk,
          proj.village,
          proj.propertyType,
          proj.type,
          proj.approval,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!searchable.includes(query)) return false
      }

      // 2. Property Type
      if (filters.type !== 'All') {
        const pType = (proj.propertyType || proj.type || '').toLowerCase()
        const fType = filters.type.toLowerCase()
        if (fType.includes('residential') && !pType.includes('residential')) return false
        if (fType.includes('farm') || fType.includes('agri')) {
          if (!pType.includes('farm') && !pType.includes('agri')) return false
        }
        if (fType.includes('bulk') && !pType.includes('bulk')) return false
      }

      // 3. Location
      if (filters.location) {
        const filterLoc = filters.location.toLowerCase()
        const fullLoc = [proj.location, proj.district, proj.taluk, proj.village]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!fullLoc.includes(filterLoc)) {
          return false
        }
      }

      // 4. Availability
      if (filters.availability !== 'all') {
        const normStatus = (proj.status || '').toLowerCase().replace(/\s+/g, '')
        const normFilter = filters.availability.toLowerCase().replace(/\s+/g, '')
        if (normStatus !== normFilter) return false
      }

      // 5. Price range
      if (filters.priceRange !== 'all') {
        const price = Number(proj.price) || 0
        if (filters.priceRange === 'under-50l' && price >= 5000000) return false
        if (filters.priceRange === '50l-80l' && (price < 5000000 || price > 8000000)) return false
        if (filters.priceRange === '80l-plus' && price <= 8000000) return false
      }

      return true
    })
  }, [dbProjects, filters])

  // Check if any filters are active (different from default)
  const isFiltered =
    Boolean(filters.searchQuery.trim()) ||
    filters.type !== 'All' ||
    Boolean(filters.location) ||
    filters.priceRange !== 'all' ||
    filters.availability !== 'all'

  return (
    <section className="ce-projects-section" id="projects-catalog">
      <div className="ch-wrap">
        {/* ── Minimal Redesigned Filter Console ── */}
        <div className="ce-filter-console">
          <div className="ce-filter-card">
            <div className="ce-filter-controls-grid">
              {/* 1. Search by name or location */}
              <div className="ce-filter-input-wrap">
                <Search size={16} className="ce-filter-input-icon" />
                <input
                  type="text"
                  placeholder="Search project name, location..."
                  value={filters.searchQuery}
                  onChange={handleFilterChange('searchQuery')}
                  className="ce-filter-input"
                  aria-label="Search projects"
                />
                {filters.searchQuery && (
                  <button
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, searchQuery: '' }))}
                    className="ce-filter-input-clear"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* 2. Property Type Dropdown */}
              <div className="ce-filter-select-wrap">
                <select
                  value={filters.type}
                  onChange={handleFilterChange('type')}
                  className="ce-filter-select"
                  aria-label="Filter by property type"
                >
                  <option value="All">All Property Types</option>
                  <option value="Residential">Residential Plots</option>
                  <option value="Agricultural">Agricultural &amp; Farmland</option>
                  <option value="Bulk land">Bulk Land &amp; Investment</option>
                </select>
              </div>

              {/* 3. Location Dropdown */}
              <div className="ce-filter-select-wrap">
                <select
                  value={filters.location}
                  onChange={handleFilterChange('location')}
                  className="ce-filter-select"
                  aria-label="Filter by location"
                >
                  <option value="">All Locations</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Price Range Dropdown */}
              <div className="ce-filter-select-wrap">
                <select
                  value={filters.priceRange}
                  onChange={handleFilterChange('priceRange')}
                  className="ce-filter-select"
                  aria-label="Filter by price range"
                >
                  <option value="all">All Price Ranges</option>
                  <option value="under-50l">Under ₹50 Lakhs</option>
                  <option value="50l-80l">₹50L – ₹80 Lakhs</option>
                  <option value="80l-plus">Above ₹80 Lakhs</option>
                </select>
              </div>

              {/* 5. Availability Dropdown */}
              <div className="ce-filter-select-wrap">
                <select
                  value={filters.availability}
                  onChange={handleFilterChange('availability')}
                  className="ce-filter-select"
                  aria-label="Filter by availability status"
                >
                  <option value="all">All Availability</option>
                  <option value="Available">Available</option>
                  <option value="Sold">Sold Out</option>
                </select>
              </div>

              {/* 6. Clear / Reset Filters Option */}
              <button
                type="button"
                onClick={handleResetFilters}
                className={`ce-filter-reset-btn ${isFiltered ? 'is-active' : ''}`}
                title="Reset all filters"
                disabled={!isFiltered}
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>

            {/* Meta Strip: Project Count & Active Filter Chips */}
            <div className="ce-filter-meta-bar">
              <div className="ce-filter-count-badge">
                <span className="ce-filter-live-dot" />
                <span>
                  Showing <strong>{filteredProjects.length}</strong> of {dbProjects.length} verified projects
                </span>
              </div>

              {isFiltered && (
                <div className="ce-filter-chips">
                  {filters.searchQuery && (
                    <span className="ce-filter-chip">
                      <span>&ldquo;{filters.searchQuery}&rdquo;</span>
                      <button type="button" onClick={() => setFilters((p) => ({ ...p, searchQuery: '' }))}>
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {filters.type !== 'All' && (
                    <span className="ce-filter-chip">
                      <span>{filters.type}</span>
                      <button type="button" onClick={handleClearSingleFilter('type')}>
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {filters.location && (
                    <span className="ce-filter-chip">
                      <span>{filters.location}</span>
                      <button type="button" onClick={handleClearSingleFilter('location')}>
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {filters.priceRange !== 'all' && (
                    <span className="ce-filter-chip">
                      <span>
                        {filters.priceRange === 'under-50l'
                          ? '< ₹50L'
                          : filters.priceRange === '50l-80l'
                          ? '₹50L - ₹80L'
                          : '> ₹80L'}
                      </span>
                      <button type="button" onClick={handleClearSingleFilter('priceRange')}>
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {filters.availability !== 'all' && (
                    <span className="ce-filter-chip">
                      <span>{filters.availability}</span>
                      <button type="button" onClick={handleClearSingleFilter('availability')}>
                        <X size={12} />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="ce-filter-clear-all-link"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Redesigned Modern Projects Grid ── */}
        <ProjectGrid
          projects={filteredProjects}
          loading={loading}
          onReset={handleResetFilters}
        />
      </div>
    </section>
  )
}
