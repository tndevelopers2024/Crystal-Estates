import React from 'react'
import FeaturedProjectsCarousel from './FeaturedProjectsCarousel'
import { fetchPlots } from '../../lib/api'

export default async function FeaturedProjectsSection({
  title = 'Featured Land & Plot Projects',
  subtitle = 'CMDA & DTCP approved plots and managed sandalwood farm lands across prime Chennai corridors.',
  eyebrow = 'Featured Projects',
  className = '',
}) {
  const plots = await fetchPlots()
  const featured =
    Array.isArray(plots) && plots.length > 0
      ? plots.filter((p) => p.featured !== false)
      : []

  return (
    <FeaturedProjectsCarousel
      projects={featured}
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      className={className}
    />
  )
}
