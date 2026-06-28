import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const DEMO_ACCOUNTS = [
  { label: 'Owner', name: 'Sarah Chen', email: 'owner@demo.com', password: 'demo123' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    await attempt(email, password)
  }

  async function attempt(em, pw) {
    setError('')
    setLoading(true)
    try {
      const user = await login(em, pw)
      navigate(['owner', 'co_owner'].includes(user.role) ? '/owner' : '/employee')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tight text-white mb-3">
            Poly<span className="text-indigo-400">HQ</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">Run your business, not your paperwork</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            New to PolyHQ?{' '}
            <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              Create an account
            </Link>
          </p>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center mb-3 uppercase tracking-widest font-medium">Quick demo</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.email}
                  onClick={() => attempt(a.email, a.password)}
                  disabled={loading}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-colors disabled:opacity-50 text-left group"
                >
                  <div>
                    <p className="text-sm text-slate-200 font-medium">{a.name}</p>
                    <p className="text-xs text-slate-500">{a.email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    a.label === 'Owner'
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">
          By signing in you agree to our{' '}
          <Link to="/terms" className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
