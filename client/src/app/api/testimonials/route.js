import { NextResponse } from 'next/server'
import { testimonials } from '../../../data/testimonials'

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      testimonials,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    }
  )
}
