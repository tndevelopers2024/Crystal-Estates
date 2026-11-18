import React from 'react'
import { notFound } from 'next/navigation'
import NewsDetailClient from './NewsDetailClient'
import { newsArticles } from '../../../data/news'

export function generateStaticParams() {
  return newsArticles.map((a) => ({
    slug: a.slug,
  }))
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const { slug } = resolvedParams || {}
  const article = newsArticles.find((a) => a.slug === slug)

  if (!article) {
    return {
      title: 'Article Not Found | Crystal Estates',
      description: 'The requested article could not be found.',
    }
  }

  return {
    title: `${article.title} | Crystal Estates`,
    description: article.excerpt || article.title,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: `https://crystalestates.in/news/${article.slug}`,
      siteName: 'Crystal Estates',
      images: [
        {
          url: article.image || '/images/hero-estate.jpg',
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
  }
}

export default async function NewsArticleDetailPage({ params }) {
  const resolvedParams = await params
  const { slug } = resolvedParams || {}
  const article = newsArticles.find((a) => a.slug === slug)

  if (!article) {
    notFound()
  }

  // Related articles (up to 3 other articles)
  const otherArticles = newsArticles.filter((a) => a.slug !== article.slug).slice(0, 3)

  return <NewsDetailClient article={article} otherArticles={otherArticles} />
}
