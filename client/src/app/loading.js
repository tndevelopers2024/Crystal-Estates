'use client'

import Preloader from '../components/ui/Preloader'

export default function Loading() {
  return <Preloader forceShow={true} isSuspense={true} />
}
