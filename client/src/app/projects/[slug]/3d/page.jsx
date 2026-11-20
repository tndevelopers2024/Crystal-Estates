import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { fetchPlotBySlugOrId } from '../../../../lib/api'
import Layout3DClient from './Layout3DClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { slug } = (await params) || {}
  const project = await fetchPlotBySlugOrId(slug)
  if (!project) return { title: 'Layout Not Found | Crystal Estates' }
  return {
    title: `${project.name} — 3D Plot Layout`,
    description: `Explore every plot at ${project.name} in 3D: live availability, sizes, facing and prices.`,
  }
}

export const viewport = { themeColor: '#0d1421' }

export default async function Project3DPage({ params }) {
  const { slug } = (await params) || {}
  const project = await fetchPlotBySlugOrId(slug)
  if (!project) notFound()
  return (
    <Suspense fallback={null}>
      <Layout3DClient project={project} />
    </Suspense>
  )
}
