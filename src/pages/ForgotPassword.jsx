import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import AuthShell, { FormError } from '../components/AuthShell.jsx'

export default function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) return setError(error.message)
    setSent(true)
  }

  const backToLogin = (
    <Link to="/login" className="text-fg underline-offset-4 hover:underline font-medium">
      Back to sign in
    </Link>
  )

  if (sent) {
    return (
      <AuthShell title="Check your email" footer={backToLogin}>
        <p className="text-sm text-fg-muted">
          If an account exists for <span className="text-fg">{email.trim()}</span>, we've sent a link to
          reset your password. It expires in one hour.
        </p>
        <p className="text-sm text-fg-subtle mt-4">
          Didn't get it? Check your spam folder or{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-fg underline-offset-4 hover:underline font-medium"
          >
            try again
          </button>
          .
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a reset link."
      footer={backToLogin}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-fg-muted mb-1.5">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            placeholder="you@company.com"
            className="input"
          />
        </div>

        {error && <FormError>{error}</FormError>}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  )
}
