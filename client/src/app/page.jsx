import HomeHero from '../components/home/HomeHero'
import Manifesto, { LocationsMarquee } from '../components/home/Manifesto'
import ProjectsIndex from '../components/home/ProjectsIndex'
import PlotToHome from '../components/home/PlotToHome'
import Offerings from '../components/home/Offerings'
import Pillars from '../components/home/Pillars'
import Journey from '../components/home/Journey'
import Voices from '../components/home/Voices'
import Journal from '../components/home/Journal'
import Closing from '../components/home/Closing'
import { instrumentSerif } from '../components/home/fonts'
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
    <div className={`ch-home ${instrumentSerif.variable}`}>
      <HomeHero />
      <Manifesto />
      <LocationsMarquee />
      <ProjectsIndex projects={featured} />
      <PlotToHome />
      <Offerings />
      <Pillars />
      <Journey />
      <Voices />
      <Journal />
      <Closing />
    </div>
  )
}
