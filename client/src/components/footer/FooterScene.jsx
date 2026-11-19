import Image from 'next/image'

/**
 * Footer backdrop: aerial photos of vacant plotted layouts that slowly
 * cross-fade with a gentle zoom (CSS only, see Footer.css). The top edge is
 * masked so the photos blend into the cream footer background.
 */
const SCENES = [
  {
    src: '/images/somamangalam.jpg',
    alt: '',
    position: '50% 62%',
  },
  {
    src: '/images/excellence-villa.jpg',
    alt: '',
    position: '50% 58%',
  },
]

export default function FooterScene({ className = '' }) {
  return (
    <div className={`sf-photo ${className}`.trim()} aria-hidden="true">
      {SCENES.map((s, i) => (
        <div key={s.src} className={`sf-photo__layer sf-photo__layer--${i + 1}`}>
          <Image
            src={s.src}
            alt={s.alt}
            fill
            sizes="100vw"
            quality={70}
            loading="lazy"
            className="sf-photo__img"
            style={{ objectPosition: s.position }}
          />
        </div>
      ))}
      <span className="sf-photo__tint" />
    </div>
  )
}
