import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Layers,
  TrendingUp,
  FileCheck2,
} from 'lucide-react'

/**
 * Premium Real-Estate Themed Auth Shell inspired by luxury architectural framing.
 * Fits 100% within the viewport on desktop without unnecessary scrolling.
 * Uses official Crystal Estates white logo and high-res project aerial background.
 */
export function AuthShell({ badge, title, subtitle, error, notice, children, footer }) {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#071E16] text-white flex flex-col justify-between p-2.5 sm:p-4 lg:p-5 select-none font-sans box-border">
      {/* Background: Aerial Land Layout Image from Existing Project Assets */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/images/hero-estate.jpg"
          alt="Crystal Estates Aerial Plotted Layout"
          className="w-full h-full object-cover object-center scale-105 filter brightness-95 contrast-105"
        />
        {/* Cinematic Emerald & Forest Overlay with Radial Vignette */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#071E16]/95 via-[#0B2B20]/80 to-[#0F3D2E]/65" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(7,30,22,0.85)_100%)]" />
      </div>

      {/* Signature Architectural Wireframe Frame (100% viewport fit on desktop) */}
      <div className="relative z-10 w-full max-w-[1600px] h-full mx-auto rounded-[24px] sm:rounded-[32px] lg:rounded-[36px] border-2 border-white/80 p-3.5 sm:p-5 lg:px-9 lg:py-5 flex flex-col justify-between shadow-[0_0_80px_rgba(0,0,0,0.5)] backdrop-blur-[1px] box-border overflow-hidden">
        {/* Top Header / Navigation Bar with Official Crystal Estates Logo */}
        <header className="shrink-0 flex items-center justify-between pb-3 sm:pb-3.5 border-b border-white/15">
          {/* Official Crystal Estates Logo */}
          <Link to="/login" className="flex items-center gap-2.5 group shrink-0">
            <img
              src="/logo-white.png"
              alt="Crystal Estates - ASSETS CREATOR"
              className="h-7 sm:h-8 lg:h-9 w-auto max-w-[180px] object-contain transition group-hover:opacity-90"
            />
            <span className="text-[9.5px] font-extrabold bg-[#B8964E] text-[#071E16] px-1.5 py-0.5 rounded tracking-widest uppercase shadow-xs">
              CRM
            </span>
          </Link>

          {/* Minimalist Trust & Status Indicators */}
          <div className="hidden md:flex items-center gap-4 lg:gap-5 text-[10.5px] lg:text-[11px] font-bold tracking-wider uppercase text-white/80 shrink-0">
            <span className="hover:text-white transition">CMDA &amp; DTCP Compliant</span>
            <span className="w-1 h-1 rounded-full bg-[#B8964E]" />
            <span className="hover:text-white transition">30-Year High Court Search</span>
            <span className="w-1 h-1 rounded-full bg-[#B8964E]" />
            <span className="inline-flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Authorized Access Only
            </span>
          </div>
        </header>

        {/* Center Content Section: Split Layout (Auth Form + Bold Architectural Hero) */}
        <main className="flex-1 min-h-0 py-2 sm:py-3 lg:py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10 items-center overflow-y-auto lg:overflow-hidden no-scrollbar">
          {/* Left Column: Floating Auth Glassmorphism Card */}
          <div className="lg:col-span-5 xl:col-span-5 w-full max-w-[430px] mx-auto lg:mx-0 my-auto">
            <div className="bg-white/95 backdrop-blur-xl rounded-[24px] sm:rounded-[26px] border border-white/70 p-5 sm:p-6 lg:p-7 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.55)] text-slate-900 box-border">
              {/* Card Header */}
              <div className="mb-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EEF7F2] border border-emerald-700/20 text-[#0F3D2E] text-[10px] font-extrabold uppercase tracking-wider mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {badge || 'Staff Access Portal'}
                </div>
                {title && (
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-[11.5px] text-slate-500 mt-1 font-medium leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Status / Notice Alert */}
              {notice && (
                <div
                  role="status"
                  className={`mb-3.5 p-3 border text-xs rounded-xl font-medium ${
                    notice.tone === 'amber'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : notice.tone === 'green'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {notice.text}
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="mb-3.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium"
                >
                  {error}
                </div>
              )}

              {/* Main Form Children */}
              <div className="w-full">
                {children}
              </div>

              {/* Card Footer Link */}
              {footer}
            </div>

            {/* Micro SSL Badge underneath card */}
            <div className="mt-2.5 text-center flex items-center justify-center gap-1.5 text-[10.5px] text-white/70 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-bit SSL Encrypted • Crystal Estates Secure Portal</span>
            </div>
          </div>

          {/* Right Column: Architectural Typography & Signature Micro Cards (Desktop only) */}
          <div className="lg:col-span-7 xl:col-span-7 hidden lg:flex flex-col justify-center pl-4 xl:pl-8 my-auto">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-emerald-200 text-[10.5px] font-bold uppercase tracking-wider mb-2.5">
                Enterprise Real Estate CRM
              </div>

              {/* Large Architectural Typography */}
              <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
                Creating Assets.
                <br />
                Building Trust.
                <br />
                <span className="text-[#C9A963]">Securing Your Future.</span>
              </h2>

              <p className="text-xs xl:text-sm text-emerald-100/80 max-w-lg mt-2.5 leading-relaxed font-medium">
                Unified operations platform for sanctioned CMDA &amp; DTCP plotted layouts. Manage buyer
                leads, coordinate site visits, verify 30-year high court legal reports, and streamline
                spot patta registration.
              </p>
            </div>

            {/* 3 Signature Real-Estate Cards (Fitting smoothly into layout) */}
            <div className="grid grid-cols-3 gap-3.5 mt-6 xl:mt-8 pt-5 border-t border-white/15">
              {/* Card 1 */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-3 xl:p-3.5 transition hover:bg-white/15">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mb-2">
                  <Layers className="w-3.5 h-3.5 text-[#C9A963]" />
                </div>
                <h3 className="text-xs xl:text-sm font-bold text-white mb-1.5">Plot Layouts</h3>
                <div className="space-y-0.5 text-[10.5px] text-emerald-100/70 font-medium">
                  <div>STATUS: <span className="text-white font-bold">100% Sanctioned</span></div>
                  <div>NORMS: <span className="text-white font-bold">CMDA &amp; DTCP</span></div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-3 xl:p-3.5 transition hover:bg-white/15">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#C9A963]" />
                </div>
                <h3 className="text-xs xl:text-sm font-bold text-white mb-1.5">Sales Pipeline</h3>
                <div className="space-y-0.5 text-[10.5px] text-emerald-100/70 font-medium">
                  <div>FLOW: <span className="text-white font-bold">Real-time Sync</span></div>
                  <div>TOURS: <span className="text-white font-bold">Assisted Visits</span></div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-3 xl:p-3.5 transition hover:bg-white/15">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mb-2">
                  <FileCheck2 className="w-3.5 h-3.5 text-[#C9A963]" />
                </div>
                <h3 className="text-xs xl:text-sm font-bold text-white mb-1.5">Title &amp; Patta</h3>
                <div className="space-y-0.5 text-[10.5px] text-emerald-100/70 font-medium">
                  <div>SEARCH: <span className="text-white font-bold">30-Yr Scrutiny</span></div>
                  <div>FILING: <span className="text-white font-bold">Direct SRO Liaison</span></div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Footer Bar */}
        <footer className="shrink-0 pt-2.5 sm:pt-3 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10.5px] text-white/70 font-medium">
          <div>
            &copy; {new Date().getFullYear()} Crystal Estates. All Rights Reserved. Enterprise Real Estate Management.
          </div>
          <div className="flex items-center gap-3">
            <span>ISO 9001:2015 Compliant</span>
            <span className="w-1 h-1 rounded-full bg-[#B8964E]" />
            <span>Encrypted Session Storage</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export const authInputCls =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#0F3D2E] focus:bg-white focus:ring-2 focus:ring-[#0F3D2E]/10 transition'
export const authLabelCls = 'block text-xs font-bold text-slate-700 mb-1'
export const authButtonCls =
  'w-full py-2.5 px-4 bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50'

export function AuthAlert({ tone = 'rose', children }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : tone === 'amber'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-rose-50 border-rose-200 text-rose-700'
  return (
    <div role={tone === 'rose' ? 'alert' : 'status'} className={`mb-3.5 p-3 border text-xs rounded-xl font-medium ${cls}`}>
      {children}
    </div>
  )
}

/** Password input with show/hide, plus the shared rule as a hint. */
export function PasswordField({ id, label, value, onChange, autoComplete = 'new-password', hint }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={authLabelCls}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${authInputCls} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 transition"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[10.5px] text-slate-500">{hint}</p>}
    </div>
  )
}

export const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.'

/** Mirrors the server rule so people see problems before submitting. */
export function passwordProblem(p) {
  if (String(p).trim().length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use at least one letter and one number'
  return null
}
