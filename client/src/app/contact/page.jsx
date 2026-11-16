import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react'
import { WhatsAppIcon } from '../../components/ui'
import EnquiryForm from '../../components/forms/EnquiryForm'
import TestimonialsSection from '../../components/TestimonialsSection'
import { business } from '../../data/site'

export const metadata = {
  title: 'Contact Crystal Estates | Land Advisors in Valasaravakkam, Chennai',
  description:
    'Contact Crystal Estates at No. 9, A.K.R. Nagar Main Road, Crystal Tower, Valasaravakkam, Chennai. Call +91 94440 00000 or WhatsApp for verified plots and farm land.',
  openGraph: {
    title: 'Contact Crystal Estates | Chennai Land Specialists',
    description:
      'Visit our office at Valasaravakkam, Chennai or book a free weekend site visit for plots and farmland.',
    url: 'https://crystalestates.in/contact',
    siteName: 'Crystal Estates',
    images: [
      {
        url: '/images/hero-estate.jpg',
        width: 1200,
        height: 630,
        alt: 'Contact Crystal Estates',
      },
    ],
  },
}

export default function ContactPage() {
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(business.mapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`

  return (
    <main className="contact-page-wrapper">
      {/* 1. Hero Section matching About Us Minimalist Structure */}
      <section className="contact-hero-section">
        <div className="contact-hero-container">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="contact-hero__breadcrumb">
            <Link href="/">Home</Link>
            <span className="contact-hero__breadcrumb-sep">/</span>
            <span className="contact-hero__breadcrumb-current">Contact Us</span>
          </nav>

          {/* Heading & Subtitle */}
          <div className="contact-hero__header">
            <span className="contact-hero__badge">
              HEADQUARTERS
            </span>
            <h1 className="contact-hero__title">
              Contact Crystal Estates
            </h1>
            <p className="contact-hero__subtitle">
              Speak directly with our land advisors or schedule a guided weekend site visit with family pickup support.
            </p>

            {/* Quick Action Buttons */}
            <div className="contact-hero__cta-group">
              <a
                href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
                  "Hi Crystal Estates, I would like to enquire about plots and farm land in Chennai."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-hero__cta"
              >
                <WhatsAppIcon size={16} />
                <span>Chat on WhatsApp</span>
                <span className="contact-hero__cta-arrow" aria-hidden="true">
                  <ArrowUpRight size={15} />
                </span>
              </a>
              <a
                href={`tel:${business.phone.replace(/\s/g, '')}`}
                className="contact-hero__cta contact-hero__cta--outline"
              >
                <Phone size={15} />
                <span>Call {business.phone}</span>
              </a>
            </div>
          </div>

          {/* Wide Hero Image Banner matching About Us architectural banner */}
          <div className="contact-hero__image-wrap">
            <Image
              src="/images/hero-estate.jpg"
              alt="Crystal Estates Valasaravakkam Chennai"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1360px"
              className="contact-hero__image"
            />
          </div>
        </div>
      </section>

      {/* 2. Structured Office & Direct Advisory Section (White Background for Clean Contrast) */}
      <section className="contact-office-section">
        <div className="contact-office-container">
          <div className="contact-office-grid">
            {/* Left Column: Office Details & Contact Cards */}
            <div className="contact-office-left">
              <span className="contact-office__badge">
                OFFICE &amp; LOCATION
              </span>
              <h2 className="contact-office__title">
                Visit Our Valasaravakkam Office
              </h2>
              <p className="contact-office__lead">
                We welcome prospective buyers and landowners to review original revenue records, parent title documents, and survey maps in person.
              </p>

              {/* Stack of Grounded Contact Info Cards */}
              <div className="contact-office-cards">
                {/* 1. Address Card */}
                <div className="contact-info-card">
                  <div className="contact-info-card__icon" aria-hidden="true">
                    <MapPin size={20} />
                  </div>
                  <div className="contact-info-card__body">
                    <span className="contact-info-card__badge">
                      Registered Address
                    </span>
                    <address className="contact-info-card__content" style={{ fontStyle: 'normal' }}>
                      {business.address.line1},<br />
                      {business.address.line2},<br />
                      {business.address.city}
                    </address>
                  </div>
                </div>

                {/* 2. Phone Support Card */}
                <div className="contact-info-card">
                  <div className="contact-info-card__icon" aria-hidden="true">
                    <Phone size={19} />
                  </div>
                  <div className="contact-info-card__body">
                    <span className="contact-info-card__badge">
                      Direct Phone Support
                    </span>
                    <div className="contact-info-card__content">
                      <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="contact-info-card__link">
                        {business.phone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* 3. Email Support Card */}
                <div className="contact-info-card">
                  <div className="contact-info-card__icon" aria-hidden="true">
                    <Mail size={19} />
                  </div>
                  <div className="contact-info-card__body">
                    <span className="contact-info-card__badge">
                      Email Correspondence
                    </span>
                    <div className="contact-info-card__content">
                      <a href={`mailto:${business.email}`} className="contact-info-card__link">
                        {business.email}
                      </a>
                    </div>
                  </div>
                </div>

                {/* 4. Working Hours Card */}
                <div className="contact-info-card">
                  <div className="contact-info-card__icon" aria-hidden="true">
                    <Clock size={19} />
                  </div>
                  <div className="contact-info-card__body">
                    <span className="contact-info-card__badge">
                      Office Working Hours
                    </span>
                    <div className="contact-info-card__content">
                      {business.hours}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Grounded Clean Online Enquiry Form Container */}
            <div className="contact-office-right">
              <div className="contact-form-grounded-box">
                <EnquiryForm
                  title="Send an Online Enquiry"
                  subtitle="Share your preferred plot budget, location, and requirement. Our senior land manager will get back to you within 2 hours."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Dedicated Full-Width Map Section (Matching User Directive) */}
      <section className="contact-map-fullwidth-section">
        <div className="contact-map-fullwidth-container">
          <div className="contact-map-header">
            <span className="contact-map-badge">
              LOCATION &amp; DIRECTIONS
            </span>
            <h2 className="contact-map-title">
              Find Our Headquarters on the Map
            </h2>
            <p className="contact-map-subtitle">
              Situated in Crystal Tower on A.K.R. Nagar Main Road in Valasaravakkam, Chennai. Convenient highway access with reserved visitor parking.
            </p>
          </div>

          <div className="contact-map-fullwidth-frame">
            <iframe
              title="Crystal Estates Chennai Headquarters"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={mapEmbedUrl}
            />
          </div>
        </div>
      </section>

      {/* 4. Testimonials Section */}
      <TestimonialsSection
        title="Landowner Confidence"
        subtitle="Trusted by over 500+ landowners across Chennai, Kanchipuram, and surrounding growth corridors."
      />
    </main>
  )
}
