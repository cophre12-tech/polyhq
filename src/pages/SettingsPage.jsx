import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useSubscription, PLAN_META } from '../hooks/useSubscription.js'
import {
  getBusinessSettings, saveBusinessSettings,
  getServices, addService, updateService, deleteService,
  getPayrollSettings, savePayrollSettings,
  getAllTeamMembers, inviteTeamMember, updateTeamMemberRole,
  updateTeamMemberRate, removeTeamMember,
} from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import { compressImage } from '../lib/compress.js'
import PushDiagnosticPanel from '../components/PushDiagnosticPanel.jsx'

const STRIPE_CHECKOUT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`
const PRICE_IDS = {
  pro: 'price_1TwmG51LS16ktisRhdXzrZox',
  business: 'price_1TwmLw1LS16ktisRmbfkvZTn',
}

const TABS = [
  { id: 'business',      label: 'Business' },
  { id: 'services',      label: 'Services' },
  { id: 'team',          label: 'Team' },
  { id: 'payroll',       label: 'Payroll Settings' },
  { id: 'subscription',  label: 'Subscription' },
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ROLE_META = {
  owner:    { label: 'Owner',    cls: 'bg-raised text-fg-muted' },
  co_owner: { label: 'Co-Owner', cls: 'bg-raised text-fg-muted' },
  employee: { label: 'Employee', cls: 'bg-overlay/40 text-fg-muted' },
}

export default function SettingsPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [tab, setTab] = useState(location.state?.tab || 'business')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-fg">Settings</h1>
        <p className="text-fg-muted mt-1 text-sm">Configure your business, team, and payroll preferences</p>
      </div>

      <div className="flex gap-1 bg-surface border border-line rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-overlay text-fg' : 'text-fg-muted hover:text-fg'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'business'     && <BusinessTab />}
      {tab === 'services'     && <ServicesTab />}
      {tab === 'team'         && <TeamTab user={user} />}
      {tab === 'payroll'      && <PayrollTab />}
      {tab === 'subscription' && <SubscriptionTab />}
    </div>
  )
}

/* ── Business Settings ────────────────────────────────────────────────────── */
const DEFAULT_BIZ = { name: '', phone: '', address: '', service_radius: '', logo: '', invite_code: '', state: 'VT', venmo_username: '' }

const SUPPORTED_STATES = [
  { code: 'CA', name: 'California' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'FL', name: 'Florida' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NY', name: 'New York' },
  { code: 'TX', name: 'Texas' },
  { code: 'VT', name: 'Vermont' },
]

function BusinessTab() {
  const { user } = useAuth()
  const [form, setForm]       = useState(DEFAULT_BIZ)
  const [saved, setSaved]     = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const logoRef = useRef(null)

  useEffect(() => {
    getBusinessSettings().then(s => s && setForm({ ...DEFAULT_BIZ, ...s }))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const data_url = await compressImage(file, 400, 0.85)
      set('logo', data_url)
    } finally { setUploading(false) }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')
    try {
      await saveBusinessSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-surface border border-line rounded-xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-fg mb-5">Business Information</h2>

        {/* Logo */}
        <div className="flex items-start gap-5 mb-6 pb-6 border-b border-line">
          <div className="w-20 h-20 rounded-xl bg-raised border border-line overflow-hidden shrink-0 flex items-center justify-center">
            {form.logo
              ? <img src={form.logo} alt="Logo" className="w-full h-full object-contain p-1" />
              : <span className="text-2xl font-semibold text-fg-subtle">B</span>
            }
          </div>
          <div>
            <p className="text-sm font-medium text-fg mb-1">Business Logo</p>
            <p className="text-xs text-fg-subtle mb-3">PNG or JPG, shown on invoices and the app header</p>
            <div className="flex gap-2 flex-wrap">
              <label className="cursor-pointer bg-raised hover:bg-overlay border border-line text-fg-muted text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                {uploading ? 'Processing…' : form.logo ? 'Change Logo' : 'Upload Logo'}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploading} />
              </label>
              {form.logo && (
                <button type="button" onClick={() => set('logo', '')}
                  className="text-xs text-danger hover:text-danger/80 px-3 py-1.5 border border-danger/20 hover:border-danger/40 rounded-lg transition-colors">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {form.invite_code && (
          <div className="mb-6 pb-6 border-b border-line">
            <p className="text-xs font-medium text-fg-muted mb-1.5">Business Invite Code</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-semibold text-fg tracking-widest">{form.invite_code}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(form.invite_code)}
                className="text-xs text-fg border border-line hover:border-line-strong px-3 py-1 rounded-lg transition-colors">
                Copy
              </button>
            </div>
            <p className="text-xs text-fg-subtle mt-1">Share this code with employees so they can register.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Business Name</label>
            <input type="text" value={form.name || ''} onChange={e => set('name', e.target.value)}
              placeholder="Acme Window Washing LLC" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Phone Number</label>
            <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)}
              placeholder="(555) 555-5555" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Business Address</label>
            <input type="text" value={form.address || ''} onChange={e => set('address', e.target.value)}
              placeholder="123 Main St, Springfield, IL 62701" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Service Area Radius (miles)</label>
            <input type="number" min="1" max="500" value={form.service_radius || ''} onChange={e => set('service_radius', e.target.value)}
              placeholder="25" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Business State</label>
            <select value={form.state || 'VT'} onChange={e => set('state', e.target.value)} className="input">
              {SUPPORTED_STATES.map(s => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-fg-subtle mt-1">Used for state income tax withholding in payroll</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Venmo Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle text-sm select-none">@</span>
              <input
                type="text"
                value={form.venmo_username || ''}
                onChange={e => set('venmo_username', e.target.value.replace(/^@/, '').replace(/\s/g, ''))}
                placeholder="yourusername"
                className="input pl-7"
              />
            </div>
            <p className="text-xs text-fg-subtle mt-1">When set, invoices will include a Venmo payment link for clients</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit"
          className="btn-primary px-5 py-2.5 text-sm">
          Save Business Settings
        </button>
        {saved && <span className="text-success text-sm">Saved!</span>}
        {saveError && <span className="text-danger text-sm">{saveError}</span>}
      </div>

      <PushDiagnosticPanel />
    </form>
  )
}


/* ── Services ─────────────────────────────────────────────────────────────── */
const EMPTY_SVC = { name: '', default_price: '', duration_minutes: '' }

function ServicesTab() {
  const [services, setServices] = useState([])
  const [form, setForm]         = useState(EMPTY_SVC)
  const [editing, setEditing]   = useState(null)
  const [error, setError]       = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  async function load() { setServices(await getServices()) }
  useEffect(() => { load() }, [])

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Service name is required'); return }
    await addService(form)
    setForm(EMPTY_SVC)
    load()
  }

  async function commitEdit(id) {
    if (!editing.name.trim()) return
    await updateService(id, {
      name: editing.name,
      default_price: parseFloat(editing.default_price) || 0,
      duration_minutes: parseInt(editing.duration_minutes) || 60,
    })
    setEditing(null)
    load()
  }

  async function handleDelete(id) {
    await deleteService(id)
    setConfirmDel(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Your Services</h2>
          <span className="text-xs text-fg-subtle">{services.length} total</span>
        </div>

        {services.length === 0 ? (
          <p className="px-5 py-10 text-center text-fg-subtle text-sm">No services yet — add one below</p>
        ) : (
          <div className="divide-y divide-line">
            {services.map(svc => (
              <div key={svc.id} className="px-5 py-4">
                {editing?.id === svc.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input value={editing.name} onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                      placeholder="Service name" className="input sm:col-span-1" />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm">$</span>
                      <input type="number" min="0" step="0.01" value={editing.default_price}
                        onChange={e => setEditing(ed => ({ ...ed, default_price: e.target.value }))}
                        placeholder="0.00" className="input pl-7" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <input type="number" min="1" value={editing.duration_minutes}
                        onChange={e => setEditing(ed => ({ ...ed, duration_minutes: e.target.value }))}
                        placeholder="60" className="input flex-1" />
                      <span className="text-xs text-fg-subtle whitespace-nowrap">min</span>
                      <button onClick={() => commitEdit(svc.id)}
                        className="btn-primary text-xs px-3 py-2 whitespace-nowrap">
                        Save
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="text-fg-muted hover:text-fg text-xs px-2 py-2 transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg">{svc.name}</p>
                      <p className="text-xs text-fg-subtle mt-0.5">
                        {svc.default_price > 0 ? `$${svc.default_price.toFixed(2)} default` : 'No default price'}
                        {' · '}{svc.duration_minutes} min est.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEditing({ id: svc.id, name: svc.name, default_price: svc.default_price, duration_minutes: svc.duration_minutes })}
                        className="text-xs text-fg-muted hover:text-fg border border-line hover:border-line-strong px-3 py-1.5 rounded-lg transition-colors">
                        Edit
                      </button>
                      {confirmDel === svc.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDelete(svc.id)}
                            className="text-xs font-semibold text-fg bg-danger hover:bg-danger/85 px-2.5 py-1.5 rounded-lg transition-colors">
                            Delete
                          </button>
                          <button onClick={() => setConfirmDel(null)} className="text-xs text-fg-muted hover:text-fg transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(svc.id)}
                          className="text-xs text-fg-subtle hover:text-danger border border-line hover:border-danger/30 px-3 py-1.5 rounded-lg transition-colors">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-fg mb-4">Add a Service</h2>
        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Service Name</label>
              <input type="text" value={form.name} onChange={e => setF('name', e.target.value)}
                placeholder="Gutter Cleaning" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Default Price ($)</label>
              <input type="number" min="0" step="0.01" value={form.default_price} onChange={e => setF('default_price', e.target.value)}
                placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Est. Duration (min)</label>
              <input type="number" min="1" value={form.duration_minutes} onChange={e => setF('duration_minutes', e.target.value)}
                placeholder="60" className="input" />
            </div>
          </div>
          {error && <p className="text-danger text-xs mb-3">{error}</p>}
          <button type="submit"
            className="btn-primary px-5 py-2.5 text-sm">
            Add Service
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Team ─────────────────────────────────────────────────────────────────── */
const EMPTY_MEMBER = { name: '', email: '', role: 'employee', hourly_rate: '' }

function TeamTab({ user: currentUser }) {
  const [members, setMembers]     = useState([])
  const [form, setForm]           = useState(EMPTY_MEMBER)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [editingRate, setEditingRate] = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)
  const isPrimary = currentUser?.role === 'owner'

  async function load() { setMembers(await getAllTeamMembers()) }
  useEffect(() => { load() }, [])

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleInvite(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      await inviteTeamMember(form)
      setSuccess(`Invite created for ${form.name}. Share the business invite code so they can register.`)
      setForm(EMPTY_MEMBER)
      load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleRoleChange(memberId, newRole) {
    await updateTeamMemberRole(memberId, newRole)
    load()
  }

  async function commitRate(memberId) {
    const rate = parseFloat(editingRate.value)
    if (!isNaN(rate) && rate >= 0) { await updateTeamMemberRate(memberId, rate); load() }
    setEditingRate(null)
  }

  async function handleRemove(id) {
    await removeTeamMember(id)
    setConfirmDel(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Team Members</h2>
          <span className="text-xs text-fg-subtle">{members.length} total</span>
        </div>

        {members.length === 0 ? (
          <p className="px-5 py-10 text-center text-fg-subtle text-sm">No team members yet</p>
        ) : (
          <div className="divide-y divide-line">
            {members.map(m => {
              const meta = ROLE_META[m.role] || ROLE_META.employee
              const canEdit = m.role !== 'owner' && isPrimary
              return (
                <div key={m.id} className="px-5 py-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 rounded-full bg-raised border border-line flex items-center justify-center text-fg-muted text-sm font-semibold shrink-0">
                    {m.name[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{m.name}</p>
                    <p className="text-xs text-fg-muted truncate">{m.email}</p>
                  </div>

                  {canEdit ? (
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      className="bg-raised border border-line rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 shrink-0">
                      <option value="employee">Employee</option>
                      <option value="co_owner">Co-Owner</option>
                    </select>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${meta.cls}`}>{meta.label}</span>
                  )}

                  <div className="shrink-0 min-w-[80px]">
                    {m.role === 'employee' && canEdit ? (
                      editingRate?.id === m.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-fg-muted text-xs">$</span>
                          <input
                            type="number" min="0" step="0.50" value={editingRate.value}
                            onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
                            onBlur={() => commitRate(m.id)}
                            onKeyDown={e => { if (e.key === 'Enter') commitRate(m.id); if (e.key === 'Escape') setEditingRate(null) }}
                            autoFocus
                            className="w-16 bg-overlay border border-accent rounded px-1.5 py-1 text-fg text-xs text-right focus:outline-none tabular-nums"
                          />
                          <span className="text-fg-muted text-xs">/hr</span>
                        </div>
                      ) : (
                        <button onClick={() => setEditingRate({ id: m.id, value: m.hourly_rate ?? '' })}
                          className={`text-sm transition-colors ${m.hourly_rate ? 'text-fg-muted hover:text-fg' : 'text-warning hover:text-warning/80'}`}
                          title="Click to edit rate">
                          {m.hourly_rate ? `$${m.hourly_rate}/hr` : 'Set rate'}
                        </button>
                      )
                    ) : m.role === 'employee' ? (
                      <span className="text-sm text-fg-muted">{m.hourly_rate ? `$${m.hourly_rate}/hr` : '—'}</span>
                    ) : null}
                  </div>

                  {canEdit && (
                    <div className="shrink-0">
                      {confirmDel === m.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleRemove(m.id)}
                            className="text-xs font-semibold text-fg bg-danger hover:bg-danger/85 px-2.5 py-1.5 rounded-lg transition-colors">Remove</button>
                          <button onClick={() => setConfirmDel(null)} className="text-xs text-fg-muted hover:text-fg transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(m.id)}
                          className="text-xs text-fg-subtle hover:text-danger border border-line hover:border-danger/30 px-3 py-1.5 rounded-lg transition-colors">
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isPrimary && (
        <div className="bg-surface border border-line rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-fg mb-1">Create Invite</h2>
          <p className="text-xs text-fg-muted mb-4">The employee registers using the business invite code from the Business tab.</p>
          <form onSubmit={handleInvite}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Full Name</label>
                <input type="text" value={form.name} onChange={e => setF('name', e.target.value)} required
                  placeholder="Jane Smith" className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} required
                  placeholder="jane@company.com" className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Role</label>
                <select value={form.role} onChange={e => setF('role', e.target.value)} className="input">
                  <option value="employee">Employee</option>
                  <option value="co_owner">Co-Owner</option>
                </select>
              </div>
              {form.role === 'employee' && (
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5">Hourly Rate ($)</label>
                  <input type="number" min="0" step="0.50" value={form.hourly_rate} onChange={e => setF('hourly_rate', e.target.value)}
                    placeholder="18.00" className="input" />
                </div>
              )}
            </div>
            {error   && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 mb-4">{error}</p>}
            {success && <p className="text-success text-xs bg-success/10 border border-success/20 rounded-lg px-3 py-2 mb-4">{success}</p>}
            <button type="submit" disabled={saving}
              className="btn-primary px-5 py-2.5 text-sm">
              {saving ? 'Creating…' : 'Create Invite'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

/* ── Subscription ─────────────────────────────────────────────────────────── */


function SubscriptionTab() {
  const { user, refreshPlan } = useAuth()
  const { plan, isAdmin } = useSubscription()
  const location = useLocation()
  const [loadingAction, setLoadingAction] = useState(null) // planKey or 'portal'
  const [checkoutError, setCheckoutError] = useState(null)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(location.search).get('paid') === '1') {
      setPaid(true)
      // Give the webhook ~4 s to process before refreshing the plan in context
      const t = setTimeout(() => refreshPlan(), 4000)
      return () => clearTimeout(t)
    }
  }, [])

  async function callCheckout(body) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(STRIPE_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || !data.url) throw new Error(data.error || 'Something went wrong. Please try again.')
    return data.url
  }

  async function handleUpgrade(planKey) {
    setLoadingAction(planKey)
    setCheckoutError(null)
    try {
      const url = await callCheckout({ price_id: PRICE_IDS[planKey], business_id: user.business_id })
      window.location.href = url
    } catch (err) {
      setCheckoutError(err.message)
      setLoadingAction(null)
    }
  }

  async function handlePortal() {
    setLoadingAction('portal')
    setCheckoutError(null)
    try {
      const url = await callCheckout({ action: 'portal', business_id: user.business_id })
      window.location.href = url
    } catch (err) {
      setCheckoutError(err.message)
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      {paid && (
        <div className="bg-success/10 border border-success/25 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm text-success font-medium">Payment successful! Your plan will activate in a moment.</p>
        </div>
      )}

      {checkoutError && (
        <div className="bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <p className="text-sm text-danger">{checkoutError}</p>
        </div>
      )}

      {isAdmin && (
        <div className="bg-surface border border-line rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-fg-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <p className="text-sm text-fg-muted font-medium">Admin account — full Business access enabled regardless of plan.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['free', 'pro', 'business'].map(planKey => {
          const meta = PLAN_META[planKey]
          const isCurrent = plan === planKey
          const isUpgrade = ['free','pro','business'].indexOf(planKey) > ['free','pro','business'].indexOf(plan)
          const isLoading = loadingAction === planKey

          return (
            <div key={planKey}
              className={`bg-surface rounded-2xl border p-5 sm:p-6 flex flex-col relative overflow-hidden transition-all ${
                isCurrent
                  ? 'border-accent ring-1 ring-accent/30'
                  : 'border-line'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-3 right-3 bg-accent text-fg text-xs font-semibold px-2.5 py-1 rounded-full">
                  Current Plan
                </div>
              )}

              <div className="mb-4">
                <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider mb-1">{meta.name}</p>
                <p className="text-2xl font-semibold text-fg">{meta.priceLabel}</p>
                {planKey !== 'free' && <p className="text-xs text-fg-subtle mt-0.5">per month, 1 business</p>}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {meta.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-fg-muted">
                    <svg className="w-4 h-4 text-success shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </li>
                ))}
              </ul>

              {isUpgrade && !isAdmin ? (
                <button
                  onClick={() => handleUpgrade(planKey)}
                  disabled={!!loadingAction}
                  className="btn-primary w-full rounded-xl py-2.5 text-sm"
                >
                  {isLoading ? 'Redirecting to Stripe…' : `Upgrade to ${meta.name}`}
                </button>
              ) : (
                <div className={`w-full rounded-xl py-2.5 text-sm font-semibold text-center ${
                  isCurrent
                    ? 'bg-raised text-fg-muted border border-line'
                    : 'bg-raised text-fg-subtle cursor-default'
                }`}>
                  {isCurrent ? 'Active' : 'Included above'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {plan !== 'free' && !isAdmin && (
        <div className="bg-surface border border-line rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-fg">Manage Subscription</p>
            <p className="text-xs text-fg-muted mt-0.5">Cancel, change your plan, or update billing info via the Stripe portal.</p>
          </div>
          <button
            onClick={handlePortal}
            disabled={!!loadingAction}
            className="shrink-0 text-sm font-medium text-fg-muted hover:text-fg border border-line hover:border-line-strong disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
          >
            {loadingAction === 'portal' ? 'Opening…' : 'Manage Billing'}
          </button>
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl px-5 py-4 flex items-start gap-3">
        <svg className="w-4 h-4 text-fg-muted shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <div>
          <p className="text-sm text-fg-muted font-medium">Additional businesses</p>
          <p className="text-xs text-fg-subtle mt-0.5">Each extra business location is $5/month on any paid plan.</p>
        </div>
      </div>
    </div>
  )
}

/* ── Payroll Settings ─────────────────────────────────────────────────────── */
const DEFAULT_PAY = { pay_period: 'weekly', pay_day: 5, tax_method: 'single' }

function PayrollTab() {
  const [form, setForm] = useState(DEFAULT_PAY)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getPayrollSettings().then(s => s && setForm({ ...DEFAULT_PAY, ...s }))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    await savePayrollSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-6">
        <h2 className="text-sm font-semibold text-fg">Payroll Configuration</h2>

        <div>
          <label className="block text-xs font-medium text-fg-muted mb-3">Pay Period</label>
          <div className="flex gap-3">
            {[['weekly', 'Weekly'], ['biweekly', 'Biweekly']].map(([val, label]) => (
              <button key={val} type="button"
                onClick={() => set('pay_period', val)}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl border text-sm font-semibold transition-colors ${form.pay_period === val
                  ? 'bg-accent border-accent text-fg'
                  : 'bg-raised border-line text-fg-muted hover:border-line-strong'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-fg-subtle mt-2">
            {form.pay_period === 'weekly' ? 'Employees are paid once every week.' : 'Employees are paid every two weeks.'}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1.5">Pay Day</label>
          <select value={form.pay_day} onChange={e => set('pay_day', parseInt(e.target.value))}
            className="input max-w-xs">
            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <p className="text-xs text-fg-subtle mt-2">
            Paychecks are issued every {DAY_NAMES[form.pay_day]}{form.pay_period === 'biweekly' ? ' (every other week)' : ''}.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-fg-muted mb-3">Default Tax Withholding</label>
          <div className="flex gap-3 flex-wrap">
            {[
              ['single', 'Single', 'Standard withholding for single filers'],
              ['married', 'Married Filing Jointly', 'Reduced withholding for joint filers'],
            ].map(([val, label, desc]) => (
              <button key={val} type="button"
                onClick={() => set('tax_method', val)}
                className={`flex-1 sm:flex-none text-left px-4 py-3 rounded-xl border transition-colors ${form.tax_method === val
                  ? 'bg-accent-subtle border-accent text-fg'
                  : 'bg-raised border-line text-fg-muted hover:border-line-strong'}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${form.tax_method === val ? 'border-accent' : 'border-line-strong'}`}>
                    {form.tax_method === val && <div className="w-1.5 h-1.5 rounded-full bg-accent-hover" />}
                  </div>
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="text-xs text-fg-muted pl-5">{desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-fg-subtle mt-3">
            This is an estimate only. Employees should verify withholding with a tax professional.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit"
          className="btn-primary px-5 py-2.5 text-sm">
          Save Payroll Settings
        </button>
        {saved && <span className="text-success text-sm">Saved!</span>}
      </div>
    </form>
  )
}
