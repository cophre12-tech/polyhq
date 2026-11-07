import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, authLinkError } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'
import AuthShell, { FormError } from '../components/AuthShell.jsx'

const MIN_LENGTH = 6 // matches signup and the Supabase project default

export default function ResetPassword() {
  const { completeRecovery, logout } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState(authLinkError ? 'invalid' : 'checking') // checking | ready | invalid
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // The recovery link signs the user in; without a session there's nothing to update.
  useEffect(() => {
    if (authLinkError) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'ready' : 'invalid')
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) return setError(`Password must be at least ${MIN_LENGTH} characters`)
    if (password !== confirm) return setError("Passwords don't match")
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(error.message)
    completeRecovery()
    navigate('/', { replace: true })
  }

  async function cancel() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line-strong border-t-fg rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthShell
        title="Link expired"
        footer={
          <Link to="/login" className="text-fg underline-offset-4 hover:underline font-medium">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-fg-muted">
          {authLinkError ? authLinkError.replace(/\.?$/, '.') : 'This password reset link is invalid or has already been used.'}{' '}
          Request a new one to continue.
        </p>
        <Link to="/forgot-password" className="btn-primary w-full py-2.5 mt-6">
          Request a new link
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="You'll be signed in once it's saved."
      footer={
        <button type="button" onClick={cancel} className="text-fg-subtle hover:text-fg-muted transition-colors">
          Cancel and sign out
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-fg-muted mb-1.5">New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoFocus
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            placeholder="••••••••"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-fg-muted mb-1.5">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="input"
          />
        </div>

        {error && <FormError>{error}</FormError>}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}
