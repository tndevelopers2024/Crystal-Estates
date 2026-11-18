'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { WordsPullUpMultiStyle, Eyebrow, Reveal } from './motion'
import { newsArticles } from '../../data/news'

export default function Journal() {
  const [lead, ...rest] = newsArticles
  const side = rest.slice(0, 3)
  if (!lead) return null

  return (
    <section className="ch-journal" aria-labelledby="ch-journal-title">
      <div className="ch-wrap">
        <div className="ch-journal__head">
          <div>
            <Eyebrow>Latest property updates</Eyebrow>
            <h2 id="ch-journal-title" className="ch-h2">
              <WordsPullUpMultiStyle segments={[{ text: 'Notes from the' }, { text: 'ground.', className: 'ch-accent' }]} />
            </h2>
          </div>
          <Link href="/news" className="ch-textlink">
            All updates <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className="ch-journal__grid">
          <Reveal className="ch-journal__lead">
            <Link href={`/news/${lead.slug}`}>
              <span className="ch-journal__img">
                <Image src={lead.image} alt="" fill sizes="(max-width: 900px) 100vw, 58vw" />
              </span>
              <span className="ch-journal__meta">
                {lead.category} · {lead.date}
              </span>
              <h3>{lead.title}</h3>
              <p>{lead.excerpt}</p>
            </Link>
          </Reveal>

          <ul className="ch-journal__list">
            {side.map((a, i) => (
              <Reveal as="li" key={a.id} delay={0.1 + i * 0.1}>
                <Link href={`/news/${a.slug}`}>
                  <span className="ch-journal__meta">
                    {a.category} · {a.readTime}
                  </span>
                  <h3>{a.title}</h3>
                  <span className="ch-journal__go" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
