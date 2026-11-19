'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { WordsPullUpMultiStyle, Eyebrow, Reveal, PillLink } from '../home/motion'
import './page-hero-header.css'

/**
 * Compact page header for inner pages (no hero banner): breadcrumb, eyebrow,
 * title, a short lead and optional actions, followed directly by content.
 *
 * Accepts the earlier hero props (mainImage, subImage, stats, chip, sealText)
 * for compatibility but intentionally does not render them.
 */
export default function PageHeroHeader({
  breadcrumbs = [],
  eyebrow = '',
  titleSegments = [],
  lead = '',
  primaryCta = null,
  secondaryCta = null,
  id = 'page-header-title',
  align = 'left',
  children,
}) {
  const hasActions = Boolean(primaryCta || secondaryCta)

  return (
    <header className={`ph ph--${align}`} aria-labelledby={id}>
      <div className="ch-wrap ph__inner">
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="ph__crumbs">
            {breadcrumbs.map((b, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <React.Fragment key={`${b.label}-${idx}`}>
                  {b.href && !isLast ? (
                    <Link href={b.href}>{b.label}</Link>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined}>{b.label}</span>
                  )}
                  {!isLast && <ChevronRight size={13} aria-hidden="true" />}
                </React.Fragment>
              )
            })}
          </nav>
        )}

        <div className="ph__row">
          <div className="ph__text">
            {eyebrow && <Eyebrow>{String(eyebrow).replace(/&amp;/g, '&')}</Eyebrow>}
            <h1 id={id} className="ph__title">
              {titleSegments.length > 0 && <WordsPullUpMultiStyle segments={titleSegments} />}
            </h1>
            {lead && (
              <Reveal as="p" className="ph__lead" delay={0.2}>
                {String(lead).replace(/&amp;/g, '&')}
              </Reveal>
            )}
          </div>

          {hasActions && (
            <Reveal className="ph__actions" delay={0.3}>
              {primaryCta && (
                <PillLink
                  href={primaryCta.href || '#'}
                  variant={primaryCta.variant || 'dark'}
                  onClick={primaryCta.onClick}
                  {...(primaryCta.props || {})}
                >
                  {primaryCta.label}
                </PillLink>
              )}
              {secondaryCta &&
                (secondaryCta.onClick ? (
                  <button type="button" className="ch-textlink" onClick={secondaryCta.onClick}>
                    {secondaryCta.label}
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <Link href={secondaryCta.href || '#'} className="ch-textlink">
                    {secondaryCta.label}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                ))}
            </Reveal>
          )}
        </div>

        {children}
      </div>
    </header>
  )
}
