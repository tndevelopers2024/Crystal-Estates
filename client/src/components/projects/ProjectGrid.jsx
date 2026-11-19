'use client'

import React, { useState } from 'react'
import { FolderSearch, RotateCcw, ArrowDown } from 'lucide-react'
import ProjectCard from './ProjectCard'

/**
 * Reusable ProjectGrid Component with Skeletons, Empty State, and Pagination/Load More
 */
export function ProjectGrid({
  projects = [],
  loading = false,
  emptyMessage = 'No land projects match your search criteria.',
  onReset,
  initialCount = 9,
  pageSize = 6,
  className = '',
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount)

  if (loading) {
    return (
      <div className={`ce-projects-grid ${className}`.trim()} aria-busy="true">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="ce-pcard ce-pcard--skeleton">
            <div className="ce-pcard__media ce-pcard__media--skeleton" />
          </div>
        ))}
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="modern-projects-empty" role="status">
        <div className="modern-projects-empty__icon">
          <FolderSearch size={42} />
        </div>
        <h3 className="modern-projects-empty__title">No Projects Found</h3>
        <p className="modern-projects-empty__desc">{emptyMessage}</p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="modern-projects-empty__btn"
          >
            <RotateCcw size={15} />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>
    )
  }

  const visibleProjects = projects.slice(0, visibleCount)
  const hasMore = visibleCount < projects.length

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + pageSize)
  }

  return (
    <div className="modern-projects-grid-wrapper">
      <div className={`ce-projects-grid ${className}`.trim()}>
        {visibleProjects.map((proj) => (
          <ProjectCard key={proj.id || proj._id} project={proj} />
        ))}
      </div>

      {hasMore && (
        <div className="modern-projects-load-more">
          <button
            type="button"
            onClick={handleLoadMore}
            className="modern-projects-load-more-btn"
          >
            <span>Load More Projects ({projects.length - visibleCount} remaining)</span>
            <ArrowDown size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default ProjectGrid
