import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Where a guard sent us from (e.g. /admin). Only accept in-app paths.
  const from = location.state?.from
  const returnTo = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      if (!user) {
        navigate('/signup', { state: { email } })
        return
      }
      navigate(returnTo || (['owner', 'co_owner'].includes(user.role) ? '/owner' : '/employee'), { replace: !!returnTo })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-6xl sm:text-7xl font-semibold text-fg mb-4">
            Poly<span className="text-accent-fg">HQ</span>
          </h1>
          <p className="text-fg-muted text-base sm:text-lg">Run your business, not your paperwork.</p>
          <p className="mt-3 font-mono text-2xs uppercase tracking-wider text-fg-subtle">Payroll · Scheduling · Invoicing · Crew</p>
        </div>

        <div className="card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@company.com"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-fg-subtle mt-5">
            New to PolyHQ?{' '}
            <Link to="/signup" className="text-fg underline-offset-4 hover:underline transition-colors font-medium">
              Create an account
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-fg-subtle mt-6">
          By signing in you agree to our{' '}
          <Link to="/terms" className="text-fg-subtle hover:text-fg-muted underline underline-offset-2 transition-colors">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-fg-subtle hover:text-fg-muted underline underline-offset-2 transition-colors">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
