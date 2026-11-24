'use client'

import dynamic from 'next/dynamic'

// Seamless dark frame matching Crystal Estate theme (zero duplicate loader, zero white flash)
const Hero3DExperience = dynamic(() => import('./hero3d/Hero3DExperience'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#081510',
      }}
      aria-hidden="true"
    />
  ),
})

export default function HomeHero({ initialProject }) {
  return <Hero3DExperience initialProject={initialProject} />
}
