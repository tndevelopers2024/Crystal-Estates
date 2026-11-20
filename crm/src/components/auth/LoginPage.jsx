import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { AuthShell, authInputCls, authLabelCls, authButtonCls } from './AuthShell'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, home } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Pending / rejected / deactivated accounts get an explanation, not an error
  const [notice, setNotice] = useState(location.state?.notice || null)

  // Redirect if already authenticated
  const from = location.state?.from?.pathname && location.state.from.pathname !== '/' ? location.state.from.pathname : null

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from || home, { replace: true })
    }
  }, [isAuthenticated, navigate, from, home])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setNotice(null)
      const data = await login(email.trim(), password)
      navigate(from || data.home || '/account', { replace: true })
    } catch (err) {
      if (err.code && err.code.startsWith('ACCOUNT_')) {
        setNotice({
          tone: err.code === 'ACCOUNT_PENDING' ? 'amber' : 'rose',
          text: err.message,
        })
      } else {
        setError(err.message || 'Invalid email or password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      badge="Staff Access Portal"
      title="Sign In to Workspace"
      subtitle="Enter your credentials to access properties, leads pipeline &amp; sales workspace"
      notice={notice}
      error={error}
      footer={
        <p className="mt-3.5 text-center text-xs text-slate-500">
          New to the team?{' '}
          <Link
            to="/register"
            className="font-bold text-[#0F3D2E] hover:text-[#B8964E] hover:underline transition"
          >
            Create staff account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Email Field */}
        <div>
          <label htmlFor="login-email" className={authLabelCls}>
            Work Email Address
          </label>
          <div className="relative">
            <input
              id="login-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="admin@crystalestates.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${authInputCls} pl-10`}
            />
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="login-password" className={authLabelCls}>
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-[#0F3D2E] hover:text-[#B8964E] hover:underline transition"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInputCls} pl-10 pr-10`}
            />
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 transition"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
            />
            <span>Remember me on this browser</span>
          </label>
        </div>

        {/* Submit Button */}
        <button type="submit" disabled={loading} className={`${authButtonCls} mt-2`}>
          <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
    </AuthShell>
  )
}
