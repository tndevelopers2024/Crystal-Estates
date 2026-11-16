'use client'

import React from 'react'
import { Car, ShieldCheck, FileCheck, Landmark, Phone, Clock, Mail, MessageSquare } from 'lucide-react'
import EnquiryForm from '../forms/EnquiryForm'
import { business } from '../../data/site'

export default function EnquirySection({
  title = 'Ready to Find Your Ideal Land in Chennai?',
  subtitle = 'Connect with our land advisors for clear-title documentation, site visits, and transparent pricing.',
  eyebrow = 'Direct Land Advisory',
  defaultInterest = 'General Inquiry',
  className = '',
}) {
  return (
    <section className={`exec-enquiry-sec ${className}`.trim()} aria-label="Enquiry & Consultation">
      <div className="exec-enquiry-container">
        {/* Left Column: Advisory Perks & Direct Contact */}
        <div className="exec-enquiry-info">
          <div className="exec-enquiry-badge">
            <MessageSquare size={14} className="exec-enquiry-badge__icon" />
            <span>{eyebrow}</span>
          </div>

          <h2 className="exec-enquiry-title">{title}</h2>
          <p className="exec-enquiry-subtitle">{subtitle}</p>

          <div className="exec-enquiry-perks">
            <div className="exec-enquiry-perk">
              <div className="exec-enquiry-perk__icon">
                <Car size={18} />
              </div>
              <div>
                <h4 className="exec-enquiry-perk__title">Complimentary Site Visit Cab</h4>
                <p className="exec-enquiry-perk__desc">Doorstep pick-up and drop for weekend land inspections across Chennai.</p>
              </div>
            </div>

            <div className="exec-enquiry-perk">
              <div className="exec-enquiry-perk__icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 className="exec-enquiry-perk__title">30-Year Legal Title Audit</h4>
                <p className="exec-enquiry-perk__desc">Certified encumbrance certificate (EC) audit and parent deed scrutiny.</p>
              </div>
            </div>

            <div className="exec-enquiry-perk">
              <div className="exec-enquiry-perk__icon">
                <FileCheck size={18} />
              </div>
              <div>
                <h4 className="exec-enquiry-perk__title">Individual Patta Guarantee</h4>
                <p className="exec-enquiry-perk__desc">Complete sub-registrar documentation, spot registration, and patta transfer.</p>
              </div>
            </div>

            <div className="exec-enquiry-perk">
              <div className="exec-enquiry-perk__icon">
                <Landmark size={18} />
              </div>
              <div>
                <h4 className="exec-enquiry-perk__title">Bank Loan Guidance</h4>
                <p className="exec-enquiry-perk__desc">Pre-approved financing assistance with nationalized & private banks.</p>
              </div>
            </div>
          </div>

          {/* Hotline Quick Bar */}
          <div className="exec-enquiry-hotline">
            <div className="exec-enquiry-hotline__call">
              <Phone size={18} className="exec-enquiry-hotline__icon" />
              <div>
                <span className="exec-enquiry-hotline__label">Call Our Senior Land Advisor</span>
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="exec-enquiry-hotline__phone">
                  {business.phone}
                </a>
              </div>
            </div>
            <div className="exec-enquiry-hotline__hours">
              <Clock size={14} />
              <span>{business.hours}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Grounded Modern Form Card */}
        <div className="exec-enquiry-form-card">
          <div className="exec-enquiry-form-card__header">
            <h3 className="exec-enquiry-form-card__title">Request Property Consultation</h3>
            <span className="exec-enquiry-form-card__tag">Guaranteed response within 2 hours</span>
          </div>
          <EnquiryForm defaultInterest={defaultInterest} />
        </div>
      </div>
    </section>
  )
}
