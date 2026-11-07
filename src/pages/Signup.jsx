import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { seedDefaultServices } from '../lib/db.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshUser } = useAuth()
  const prefillEmail = location.state?.email || ''
  const [mode, setMode] = useState('owner') // 'owner' | 'employee'
  const [form, setForm] = useState({ businessName: '', name: '', email: prefillEmail, password: '', inviteCode: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleOwnerSignup(e) {
    e.preventDefault()
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setError('')
    setLoading(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      if (authErr) throw new Error(authErr.message)

      if (!authData.session) throw new Error('Signup succeeded but no session was returned. Please log in.')

      // Creates the business, owner profile and membership in one transaction.
      // (A client-side insert().select() fails RLS: the SELECT policy can't see
      // the new business until the profile/membership rows exist.)
      const { data: businessId, error: bizErr } = await supabase.rpc('create_owned_business', {
        p_name: form.businessName.trim() || form.name.trim() + "'s Business",
        p_owner_name: form.name.trim(),
      })
      if (bizErr) throw new Error(bizErr.message)

      await seedDefaultServices(businessId)
      await refreshUser()
      navigate('/owner')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleEmployeeSignup(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    if (!form.inviteCode.trim()) return setError('Invite code is required')
    setError('')
    setLoading(true)
    try {
      const { data: businessId, error: codeErr } = await supabase.rpc('business_id_from_invite', {
        code: form.inviteCode.trim().toUpperCase(),
      })
      if (codeErr || !businessId) throw new Error('Invalid invite code. Ask your manager for the correct code.')

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      if (authErr) throw new Error(authErr.message)

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        business_id: businessId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: 'employee',
        hourly_rate: 0,
      })
      if (profileErr) throw new Error(profileErr.message)

      await refreshUser()
      navigate('/employee')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'input'

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-fg mb-2">
            Poly<span className="text-accent-fg">HQ</span>
          </h1>
          <p className="font-mono text-xs uppercase tracking-wider text-fg-subtle">Create your account</p>
        </div>

        {prefillEmail && (
          <div className="mb-5 bg-warning/10 border border-warning/25 rounded-xl px-4 py-3 text-warning text-sm">
            Your login was found but setup wasn't completed. Finish creating your account below.
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-surface border border-line p-1 mb-4">
          <button
            type="button"
            onClick={() => { setMode('owner'); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'owner' ? 'bg-accent text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            Start a business
          </button>
          <button
            type="button"
            onClick={() => { setMode('employee'); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'employee' ? 'bg-accent text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            Join a team
          </button>
        </div>

        <div className="card p-6 sm:p-7">
          {mode === 'owner' ? (
            <form onSubmit={handleOwnerSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Business Name</label>
                <input type="text" value={form.businessName} onChange={e => set('businessName', e.target.value)}
                  placeholder="Conor's Window Cleaning" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Your Name</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  required placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  required placeholder="you@company.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  required placeholder="Min. 6 characters" className={inputCls} />
              </div>
              {error && (
                <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3.5 py-2.5">{error}</div>
              )}
              <button type="submit" disabled={loading}
                className="btn-primary w-full py-2.5 mt-1">
                {loading ? 'Creating…' : 'Create Business Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmployeeSignup} className="space-y-4">
              <div className="bg-raised border border-line rounded-lg px-3.5 py-2.5 text-fg-muted text-sm">
                Ask your manager for the business invite code, then create your account below.
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Invite Code</label>
                <input type="text" value={form.inviteCode} onChange={e => set('inviteCode', e.target.value.toUpperCase())}
                  required maxLength={6} placeholder="ABC123"
                  className="input tracking-wider uppercase font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Your Name</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  required placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  required placeholder="you@company.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  required placeholder="Min. 6 characters" className={inputCls} />
              </div>
              {error && (
                <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3.5 py-2.5">{error}</div>
              )}
              <button type="submit" disabled={loading}
                className="btn-primary w-full py-2.5 mt-1">
                {loading ? 'Joining…' : 'Join Team'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-fg-subtle mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-fg underline-offset-4 hover:underline transition-colors font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
