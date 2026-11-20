'use client'

import dynamic from 'next/dynamic'

// WebGL only runs in the browser
const Layout3DView = dynamic(() => import('../../../../components/layout3d/Layout3DView'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', background: '#0d1421', color: '#a9b1bf', fontFamily: 'system-ui, sans-serif' }}>
      Loading 3D layout…
    </div>
  ),
})

export default function Layout3DClient({ project }) {
  return <Layout3DView project={project} />
}
