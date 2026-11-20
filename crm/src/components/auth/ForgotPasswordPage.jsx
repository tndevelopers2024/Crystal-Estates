import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { AuthShell, authInputCls, authLabelCls, authButtonCls } from './AuthShell'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { forgotPassword, resetPassword } = useAuth()

  // Step 1: 'request' | Step 2: 'reset' | Step 3: 'success'
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [infoMessage, setInfoMessage] = useState(null)

  // Step 1: Request Password Reset
  const handleRequestReset = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please provide your registered email address.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await forgotPassword(email.trim())
      if (res.success) {
        setOtp('')
        setInfoMessage(
          res.message ||
            'If an account exists for that email, a verification code has been sent to it.'
        )
        setStep('reset')
      }
    } catch (err) {
      setError(err.message || 'Could not request a reset code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Submit New Password
  const handleResetSubmit = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Use at least 8 characters, with a letter and a number.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      })
      if (res.success) {
        setStep('success')
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      badge="Account Recovery"
      title={
        step === 'request'
          ? 'Reset Password'
          : step === 'reset'
            ? 'Set New Password'
            : 'Password Reset Complete'
      }
      subtitle="Crystal Estates secure account recovery portal"
      notice={infoMessage && step === 'reset' ? { tone: 'green', text: infoMessage } : null}
      error={error}
      footer={
        <div className="mt-3 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0F3D2E] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      }
    >
      {/* STEP 1: REQUEST RESET LINK */}
      {step === 'request' && (
        <form onSubmit={handleRequestReset} className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            Enter your registered email address below. We'll send you a verification code to recover your account.
          </p>

          <div>
            <label className={authLabelCls}>
              Registered Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                autoFocus
                placeholder="you@crystalestates.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${authInputCls} pl-10`}
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${authButtonCls} mt-4`}
          >
            <span>{loading ? 'Sending Code...' : 'Send Recovery Code'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      )}

      {/* STEP 2: ENTER NEW PASSWORD & OTP */}
      {step === 'reset' && (
        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div>
            <label className={authLabelCls}>
              Verification Code (OTP)
            </label>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="6-digit verification code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className={`${authInputCls} font-mono font-bold tracking-widest text-slate-800 text-center text-sm`}
            />
          </div>

          <div>
            <label className={authLabelCls}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="At least 8 chars, letter & number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${authInputCls} pl-10 pr-10`}
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={authLabelCls}>
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${authInputCls} pl-10`}
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${authButtonCls} mt-4`}
          >
            <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      )}

      {/* STEP 3: SUCCESS STATE */}
      {step === 'success' && (
        <div className="text-center py-4 space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Password Reset Successfully!
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Your password has been securely updated. You can now sign in to your Crystal Estates CRM account.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className={authButtonCls}
          >
            Sign In Now
          </button>
        </div>
      )}
    </AuthShell>
  )
}
