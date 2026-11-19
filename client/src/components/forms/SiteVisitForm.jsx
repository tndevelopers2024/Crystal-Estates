'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { business } from '../../data/site'

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  project: '',
  visitDate: '',
}

export default function SiteVisitForm({ prefillProject = '', onSuccess, className = '' }) {
  const [form, setForm] = useState({
    ...initialForm,
    project: prefillProject || '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [availableProjects, setAvailableProjects] = useState([
    { name: 'Somamangalam', location: 'Chennai, Tamil Nadu' },
    { name: 'Kolapakkam', location: 'Chennai, Tamil Nadu' },
    { name: 'Jambodai', location: 'Chennai, Tamil Nadu' },
    { name: 'Brammadesam', location: 'Chennai, Tamil Nadu' },
    { name: 'Vedanthangal (Managed Sandalwood Farmland)', location: 'Kanchipuram' },
  ])

  // Get today's date formatted as YYYY-MM-DD for date input min attribute
  const todayFormatted = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch('/api/plots')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plots) && data.plots.length > 0) {
          const list = data.plots.map((p) => ({
            name: p.name || p.projectName,
            location: p.location || 'Chennai',
            status: p.status,
          }))
          setAvailableProjects(list)
        }
      })
      .catch(() => {})
  }, [])

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim() || form.firstName.trim().length < 2) {
      errs.firstName = 'Please enter your first name.'
    }
    const cleanPhone = form.phone.replace(/[\s+-]/g, '')
    if (!cleanPhone || cleanPhone.length < 10) {
      errs.phone = 'Please enter a valid 10-digit phone number.'
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Please enter a valid email address.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
    const payload = {
      name: fullName,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      property: form.project.trim() || 'General Plotted Layout Enquiry',
      interest: form.project.trim() || 'General Plotted Layout Enquiry',
      visitDate: form.visitDate || 'Flexible Weekend',
      message: `Scheduled Site Visit request for ${form.project || 'General Enquiry'}. Preferred Date: ${
        form.visitDate || 'To be coordinated with advisor'
      }`,
      source: 'Website - Schedule a Site Visit',
      stage: 'new',
      timestamp: new Date().toISOString(),
    }

    try {
      await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.warn('Enquiry POST failed:', err)
      })
    } catch (err) {
      console.warn('Enquiry error:', err)
    }

    // Connect via WhatsApp to ensure immediate advisor notification
    const waText =
      `Hi Crystal Estates, I would like to schedule a site visit.\n` +
      `• Name: ${fullName}\n` +
      `• Phone: ${payload.phone}\n` +
      `${payload.email ? `• Email: ${payload.email}\n` : ''}` +
      `${form.project ? `• Layout/Project: ${form.project}\n` : ''}` +
      `${form.visitDate ? `• Preferred Date: ${form.visitDate}\n` : ''}` +
      `Please confirm the site visit and cab pickup details.`

    if (typeof window !== 'undefined') {
      window.open(
        `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(waText)}`,
        '_blank',
        'noopener,noreferrer'
      )
    }

    setSubmitting(false)
    setSubmitted(true)
    if (onSuccess) onSuccess(payload)
  }

  return (
    <div className={`ch-site-visit-form-container ${className}`.trim()}>
      <form className="ch-site-visit-form" onSubmit={handleSubmit} noValidate>
        {/* Row 1: First Name & Last Name */}
        <div className="ch-site-visit-form__row">
          <div className="ch-site-visit-form__field">
            <label htmlFor="site-visit-first-name" className="ch-site-visit-form__label">
              Hi, my first name is...
            </label>
            <input
              id="site-visit-first-name"
              type="text"
              required
              value={form.firstName}
              onChange={handleChange('firstName')}
              placeholder="John"
              className={`ch-site-visit-form__input ${
                errors.firstName ? 'ch-site-visit-form__input--error' : ''
              }`}
              aria-invalid={!!errors.firstName}
            />
            {errors.firstName && (
              <span className="ch-site-visit-form__error">
                <AlertCircle size={13} />
                {errors.firstName}
              </span>
            )}
          </div>

          <div className="ch-site-visit-form__field">
            <label htmlFor="site-visit-last-name" className="ch-site-visit-form__label">
              And my last name is...
            </label>
            <input
              id="site-visit-last-name"
              type="text"
              value={form.lastName}
              onChange={handleChange('lastName')}
              placeholder="Doe"
              className="ch-site-visit-form__input"
            />
          </div>
        </div>

        {/* Row 2: Email & Phone Number */}
        <div className="ch-site-visit-form__row">
          <div className="ch-site-visit-form__field">
            <label htmlFor="site-visit-email" className="ch-site-visit-form__label">
              My email is...
            </label>
            <input
              id="site-visit-email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="heyjohn@business.com"
              className={`ch-site-visit-form__input ${
                errors.email ? 'ch-site-visit-form__input--error' : ''
              }`}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <span className="ch-site-visit-form__error">
                <AlertCircle size={13} />
                {errors.email}
              </span>
            )}
          </div>

          <div className="ch-site-visit-form__field">
            <label htmlFor="site-visit-phone" className="ch-site-visit-form__label">
              My phone number is...
            </label>
            <input
              id="site-visit-phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="+91 98400 12345"
              className={`ch-site-visit-form__input ${
                errors.phone ? 'ch-site-visit-form__input--error' : ''
              }`}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && (
              <span className="ch-site-visit-form__error">
                <AlertCircle size={13} />
                {errors.phone}
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Project Selection & Preferred Visit Date */}
        <div className="ch-site-visit-form__row">
          <div className="ch-site-visit-form__field">
            <label htmlFor="site-visit-project" className="ch-site-visit-form__label">
              I'm interested in...
            </label>
            <select
              id="site-visit-project"
              value={form.project}
              onChange={handleChange('project')}
              className="ch-site-visit-form__select"
            >
              <option value="">Please select a project</option>
              {availableProjects.map((p, pIdx) => (
                <option key={`proj-${p.id || p.name || pIdx}-${pIdx}`} value={p.name}>
                  {p.name} ({p.location})
                </option>
              ))}
              <option value="Agricultural / Farm Land">Agricultural / Farm Land</option>
              <option value="Commercial Land">Commercial Land</option>
              <option value="General Consultation">General Land Consultation</option>
            </select>
          </div>

          <div className="ch-site-visit-form__field">
            <label htmlFor="site-visit-date" className="ch-site-visit-form__label">
              Preferred visit date...
            </label>
            <input
              id="site-visit-date"
              type="date"
              min={todayFormatted}
              value={form.visitDate}
              onChange={handleChange('visitDate')}
              className="ch-site-visit-form__input ch-site-visit-form__input--date"
            />
          </div>
        </div>

        {/* Row 4: Full-Width Dark Submit Button */}
        <div className="ch-site-visit-form__submit-wrap">
          <button
            type="submit"
            disabled={submitting}
            className="ch-site-visit-form__submit-btn"
          >
            <span>{submitting ? 'Scheduling Site Visit…' : 'Schedule Site Visit'}</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Submission Feedback Banner */}
        {submitted && (
          <div className="ch-site-visit-form__feedback" role="alert">
            <CheckCircle2 size={18} className="ch-site-visit-form__feedback-icon" />
            <div>
              <strong>Site visit request submitted!</strong>
              <p>Our senior property advisor will reach out shortly to coordinate your private cab pickup and timing.</p>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
