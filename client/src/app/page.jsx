import HomeHero from '../components/home/HomeHero'
import ProjectShowcase from '../components/home/ProjectShowcase'
import FrameScrollSequence from '../components/home/FrameScrollSequence'
import PlotTransformation from '../components/home/PlotTransformation'
import SixPromises from '../components/home/SixPromises'
import Journey from '../components/home/Journey'
import Voices from '../components/home/Voices'
import Closing from '../components/home/Closing'
import { fetchPlots } from '../lib/api'
import '../components/home/home.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Crystal Estates | Creating Assets. Building Trust. Securing Your Future.',
  description:
    'Discover premium residential plots, agricultural lands and valuable land investment opportunities around Chennai with Crystal Estates — ASSETS CREATOR.',
  openGraph: {
    title: 'Crystal Estates | Creating Assets. Building Trust. Securing Your Future.',
    description:
      'Discover premium residential plots, agricultural lands and valuable land investment opportunities around Chennai with Crystal Estates.',
    url: 'https://crystalestates.in',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Crystal Estates Chennai',
      },
    ],
  },
}

export default async function HomePage() {
  const plots = await fetchPlots()
  const featured = Array.isArray(plots) ? plots.filter((p) => p && p.featured !== false) : []

  return (
    <div className="ch-home">
      {/* Kept deliberately short: hero, projects to explore, then trust & contact */}
      <HomeHero />
      <ProjectShowcase projects={featured} />
      <FrameScrollSequence />
      <PlotTransformation />
      <SixPromises />
      <Journey />
      <Voices />
      <Closing />
    </div>
  )
}
