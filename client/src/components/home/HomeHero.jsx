'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'

// Branded loading fallback matching Crystal Estate luxury theme (No technical text)
function HeroBrandedFallback() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: '#081510',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '22px',
        color: '#ffffff',
      }}
      role="status"
      aria-label="Crystal Estates"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Image
          src="/logo-white.png"
          alt="Crystal Estates"
          width={154}
          height={52}
          priority
          style={{ width: 'auto', height: '52px', objectFit: 'contain' }}
        />
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            fontWeight: '600',
            letterSpacing: '0.22em',
            color: '#d4af37',
            textTransform: 'uppercase',
          }}
        >
          ASSETS CREATOR
        </span>
      </div>
      <div
        style={{
          width: '200px',
          height: '2px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '45%',
            background: 'linear-gradient(90deg, #b8964e 0%, #ffd54f 100%)',
            borderRadius: '999px',
            boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)',
            animation: 'h3dShimmer 1.5s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes h3dShimmer {
          0% { left: -45%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}

// Dynamically import the 3D scroll experience on client side with branded fallback
const Hero3DExperience = dynamic(() => import('./hero3d/Hero3DExperience'), {
  ssr: false,
  loading: () => <HeroBrandedFallback />,
})

export default function HomeHero({ initialProject }) {
  return <Hero3DExperience initialProject={initialProject} />
}
