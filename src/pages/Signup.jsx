import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { seedDefaultServices } from '../lib/db.js'

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
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

      const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .insert({ name: form.businessName.trim() || form.name.trim() + "'s Business" })
        .select()
        .single()
      if (bizErr) throw new Error(bizErr.message)

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        business_id: business.id,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: 'owner',
      })
      if (profileErr) throw new Error(profileErr.message)

      await seedDefaultServices(business.id)
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

      navigate('/employee')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
            Poly<span className="text-indigo-400">HQ</span>
          </h1>
          <p className="text-slate-400 text-sm">Create your account</p>
        </div>

        {prefillEmail && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-amber-300 text-sm">
            Your login was found but setup wasn't completed. Finish creating your account below.
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode('owner'); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'owner' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Start a business
          </button>
          <button
            type="button"
            onClick={() => { setMode('employee'); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'employee' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Join a team
          </button>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-7">
          {mode === 'owner' ? (
            <form onSubmit={handleOwnerSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Business Name</label>
                <input type="text" value={form.businessName} onChange={e => set('businessName', e.target.value)}
                  placeholder="Conor's Window Cleaning" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  required placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  required placeholder="you@company.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  required placeholder="Min. 6 characters" className={inputCls} />
              </div>
              {error && (
                <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-3.5 py-2.5">{error}</div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-1">
                {loading ? 'Creating…' : 'Create Business Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmployeeSignup} className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3.5 py-2.5 text-emerald-400 text-sm">
                Ask your manager for the business invite code, then create your account below.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Invite Code</label>
                <input type="text" value={form.inviteCode} onChange={e => set('inviteCode', e.target.value.toUpperCase())}
                  required maxLength={6} placeholder="ABC123"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition tracking-widest uppercase font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  required placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  required placeholder="you@company.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  required placeholder="Min. 6 characters" className={inputCls} />
              </div>
              {error && (
                <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-3.5 py-2.5">{error}</div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-1">
                {loading ? 'Joining…' : 'Join Team'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
