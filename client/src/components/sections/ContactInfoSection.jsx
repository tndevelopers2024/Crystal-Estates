'use client'

import React from 'react'
import { MapPin, Phone, Mail, Clock, ArrowUpRight, Building } from 'lucide-react'
import { WhatsAppIcon } from '../ui'
import { business } from '../../data/site'

export default function ContactInfoSection({
  title = 'Contact Information',
  subtitle = 'Visit our registered office in Valasaravakkam, Chennai or schedule a private site inspection tour with our land advisors.',
  eyebrow = 'Headquarters & Desk',
  className = '',
}) {
  return (
    <section id="contact-info" className={`exec-contact-sec ${className}`.trim()} aria-label="Contact Information">
      <div className="exec-contact-container">
        {/* Header */}
        <div className="exec-contact-header">
          <div className="exec-contact-badge">
            <Building size={14} className="exec-contact-badge__icon" />
            <span>{eyebrow}</span>
          </div>
          <h2 className="exec-contact-title">{title}</h2>
          <p className="exec-contact-subtitle">{subtitle}</p>
        </div>

        {/* 3-Column Grounded Contact Cards */}
        <div className="exec-contact-grid">
          {/* Card 1: Office Address */}
          <div className="exec-contact-card">
            <div className="exec-contact-card__icon-wrap">
              <MapPin size={22} />
            </div>
            <div className="exec-contact-card__content">
              <span className="exec-contact-card__label">Registered Headquarters</span>
              <h3 className="exec-contact-card__title">Crystal Tower, Chennai</h3>
              <p className="exec-contact-card__text">{business.address.full}</p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(business.mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="exec-contact-card__action-link"
              >
                <span>Get Driving Directions</span>
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>

          {/* Card 2: Phone & WhatsApp */}
          <div className="exec-contact-card">
            <div className="exec-contact-card__icon-wrap">
              <Phone size={22} />
            </div>
            <div className="exec-contact-card__content">
              <span className="exec-contact-card__label">Phone & Direct Chat</span>
              <h3 className="exec-contact-card__title">Land Consultation Desk</h3>
              <p className="exec-contact-card__text">
                Direct access to our senior land acquisitions and documentation advisory team.
              </p>
              <div className="exec-contact-card__btn-group">
                <a
                  href={`tel:${business.phone.replace(/\s/g, '')}`}
                  className="exec-contact-btn exec-contact-btn--call"
                >
                  <Phone size={14} />
                  <span>{business.phone}</span>
                </a>
                <a
                  href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
                    'Hello Crystal Estates, I would like to enquire about your land and plot projects.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="exec-contact-btn exec-contact-btn--wa"
                >
                  <WhatsAppIcon size={14} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Card 3: Email & Hours */}
          <div className="exec-contact-card">
            <div className="exec-contact-card__icon-wrap">
              <Mail size={22} />
            </div>
            <div className="exec-contact-card__content">
              <span className="exec-contact-card__label">Official Correspondence</span>
              <h3 className="exec-contact-card__title">Email & Working Hours</h3>
              <p className="exec-contact-card__text">
                <a href={`mailto:${business.email}`} className="exec-contact-mail-link">
                  {business.email}
                </a>
              </p>
              <div className="exec-contact-card__hours">
                <Clock size={15} className="exec-contact-card__clock-icon" />
                <span>{business.hours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Embedded Office Map with Sleek Floating Badge */}
        <div className="exec-contact-map-wrapper">
          <iframe
            title="Crystal Estates Chennai Location Map"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3886.8277252277415!2d80.1706689!3d13.0466472!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a526127bc4f26b9%3A0xb366b26d36e2f418!2sCrystal%20Estates!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
            width="100%"
            height="380"
            style={{ border: 0, display: 'block' }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="exec-contact-map-badge">
            <div className="exec-contact-map-badge__dot" />
            <div>
              <strong>Crystal Tower Head Office</strong>
              <span>Valasaravakkam, Chennai</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
