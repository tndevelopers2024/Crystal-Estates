'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Filter, Search, RotateCcw, MapPin, IndianRupee, Tag, CheckCircle2 } from 'lucide-react'
import { ProjectGrid } from './ProjectGrid'
import { normalizePlot } from '../../lib/api'

const categoryTabs = [
  { label: 'All Land Assets', value: 'All' },
  { label: 'Residential Plots', value: 'Residential' },
  { label: 'Agricultural & Farm Land', value: 'Agricultural' },
  { label: 'Bulk Land & Investment', value: 'Bulk land' },
]

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

  // Fetch actual data from backend API
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
        console.warn('Could not fetch plots from MongoDB API, checking fallback:', err.message)
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

  const handleCategorySelect = (value) => {
    setFilters((prev) => ({ ...prev, type: value }))
  }

  const handleResetFilters = () => {
    setFilters(initialFilterState)
  }

  // Derive dynamic locations purely from actual database projects
  const locationOptions = useMemo(() => {
    const locSet = new Set()
    dbProjects.forEach((p) => {
      if (p.location) locSet.add(p.location.trim())
      if (p.district) locSet.add(p.district.trim())
      if (p.village) locSet.add(p.village.trim())
      if (p.taluk) locSet.add(p.taluk.trim())
    })
    return Array.from(locSet).filter(Boolean).sort()
  }, [dbProjects])

  // Filter computation
  const filteredProjects = useMemo(() => {
    return dbProjects.filter((proj) => {
      // 0. Search Query
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

      // 1. Type
      if (filters.type !== 'All') {
        const pType = (proj.propertyType || proj.type || '').toLowerCase()
        const fType = filters.type.toLowerCase()
        if (fType.includes('residential') && !pType.includes('residential')) return false
        if (fType.includes('farm') || fType.includes('agri')) {
          if (!pType.includes('farm') && !pType.includes('agri')) return false
        }
        if (fType.includes('bulk') && !pType.includes('bulk')) return false
      }

      // 2. Location
      if (filters.location) {
        const filterLoc = filters.location.toLowerCase()
        const fullLoc = [
          proj.location,
          proj.district,
          proj.taluk,
          proj.village,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!fullLoc.includes(filterLoc)) {
          return false
        }
      }

      // 3. Availability
      if (filters.availability !== 'all') {
        const normStatus = (proj.status || '').toLowerCase().replace(/\s+/g, '')
        const normFilter = filters.availability.toLowerCase().replace(/\s+/g, '')
        if (normStatus !== normFilter) return false
      }

      // 4. Price range
      if (filters.priceRange !== 'all') {
        const price = Number(proj.price) || 0
        if (filters.priceRange === 'under-50l' && price >= 5000000) return false
        if (filters.priceRange === '50l-80l' && (price < 5000000 || price > 8000000)) return false
        if (filters.priceRange === '80l-plus' && price <= 8000000) return false
      }

      return true
    })
  }, [dbProjects, filters])

  const hasActiveFilters =
    filters.type !== 'All' ||
    Boolean(filters.location) ||
    filters.priceRange !== 'all' ||
    filters.availability !== 'all' ||
    Boolean(filters.searchQuery.trim())

  return (
    <section className="modern-projects-section" aria-label="Projects Catalog">
      <div className="modern-projects-container">
        {/* Category Tabs (News-Style Filter Pills) */}
        {/* <div className="modern-projects-tabs" role="tablist" aria-label="Land Categories">
          {categoryTabs.map((tab) => {
            const isActive = filters.type === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleCategorySelect(tab.value)}
                className={`modern-projects-tab ${isActive ? 'is-active' : ''}`}
              >
                <span className="modern-projects-tab__dot" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div> */}

        {/* Filter Control Console */}
        <div className="modern-projects-filter-box">
          <div className="modern-projects-filter-grid">
            {/* Search Input */}
            <div className="modern-filter-field modern-filter-field--search">
              <label htmlFor="filter-search">Search Projects</label>
              <div className="modern-filter-input-wrap">
                <Search size={16} className="modern-filter-icon" />
                <input
                  id="filter-search"
                  type="text"
                  placeholder="Search by project name or area..."
                  value={filters.searchQuery}
                  onChange={handleFilterChange('searchQuery')}
                  className="modern-filter-input"
                />
              </div>
            </div>

            {/* Location Corridor */}
            <div className="modern-filter-field">
              <label htmlFor="filter-location">Location Corridor</label>
              <div className="modern-filter-select-wrap">
                <MapPin size={15} className="modern-filter-icon" />
                <select
                  id="filter-location"
                  value={filters.location}
                  onChange={handleFilterChange('location')}
                  className="modern-filter-select"
                >
                  <option value="">All Chennai Corridors</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Budget Range */}
            <div className="modern-filter-field">
              <label htmlFor="filter-price">Budget Range</label>
              <div className="modern-filter-select-wrap">
                <IndianRupee size={15} className="modern-filter-icon" />
                <select
                  id="filter-price"
                  value={filters.priceRange}
                  onChange={handleFilterChange('priceRange')}
                  className="modern-filter-select"
                >
                  <option value="all">Any Price</option>
                  <option value="under-50l">Under ₹ 50 Lakhs</option>
                  <option value="50l-80l">₹ 50 Lakhs – ₹ 80 Lakhs</option>
                  <option value="80l-plus">₹ 80 Lakhs &amp; Above</option>
                </select>
              </div>
            </div>

            {/* Availability Status */}
            <div className="modern-filter-field">
              <label htmlFor="filter-availability">Availability</label>
              <div className="modern-filter-select-wrap">
                <Tag size={15} className="modern-filter-icon" />
                <select
                  id="filter-availability"
                  value={filters.availability}
                  onChange={handleFilterChange('availability')}
                  className="modern-filter-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Booked">Booked</option>
                  <option value="Few Left">Few Left</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Status Bar */}
          <div className="modern-projects-filter-bar-footer">
            <div className="modern-projects-count">
              <CheckCircle2 size={16} className="modern-projects-count-icon" />
              <span>
                Showing <strong>{filteredProjects.length}</strong> verified land projects
              </span>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="modern-projects-reset-btn"
                aria-label="Reset all filters"
              >
                <RotateCcw size={13} />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* ProjectGrid with pagination, empty state, and loading skeletons */}
        <ProjectGrid
          projects={filteredProjects}
          loading={loading}
          emptyMessage="No land projects match your selected filters. Try broadening your location or budget."
          onReset={handleResetFilters}
          initialCount={9}
          pageSize={6}
        />
      </div>
    </section>
  )
}
