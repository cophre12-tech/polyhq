import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getBusinessSettings, saveBusinessSettings,
  getServices, addService, updateService, deleteService,
  getPayrollSettings, savePayrollSettings,
  getAllTeamMembers, inviteTeamMember, updateTeamMemberRole,
  updateTeamMemberRate, removeTeamMember,
} from '../lib/db.js'
import { compressImage } from '../lib/compress.js'

const TABS = [
  { id: 'business',  label: 'Business' },
  { id: 'services',  label: 'Services' },
  { id: 'team',      label: 'Team' },
  { id: 'payroll',   label: 'Payroll Settings' },
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ROLE_META = {
  owner:    { label: 'Owner',    cls: 'bg-indigo-500/20 text-indigo-400' },
  co_owner: { label: 'Co-Owner', cls: 'bg-violet-500/20 text-violet-400' },
  employee: { label: 'Employee', cls: 'bg-slate-600/40 text-slate-300' },
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('business')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1 text-sm">Configure your business, team, and payroll preferences</p>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'business' && <BusinessTab />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'team'     && <TeamTab user={user} />}
      {tab === 'payroll'  && <PayrollTab />}
    </div>
  )
}

/* ── Business Settings ────────────────────────────────────────────────────── */
const DEFAULT_BIZ = { name: '', phone: '', address: '', service_radius: '', logo: '', invite_code: '' }

function BusinessTab() {
  const [form, setForm]       = useState(DEFAULT_BIZ)
  const [saved, setSaved]     = useState(false)
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
    await saveBusinessSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white mb-5">Business Information</h2>

        {/* Logo */}
        <div className="flex items-start gap-5 mb-6 pb-6 border-b border-slate-800">
          <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
            {form.logo
              ? <img src={form.logo} alt="Logo" className="w-full h-full object-contain p-1" />
              : <span className="text-2xl font-bold text-slate-600">B</span>
            }
          </div>
          <div>
            <p className="text-sm font-medium text-white mb-1">Business Logo</p>
            <p className="text-xs text-slate-500 mb-3">PNG or JPG, shown on invoices and the app header</p>
            <div className="flex gap-2 flex-wrap">
              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                {uploading ? 'Processing…' : form.logo ? 'Change Logo' : 'Upload Logo'}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploading} />
              </label>
              {form.logo && (
                <button type="button" onClick={() => set('logo', '')}
                  className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-colors">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {form.invite_code && (
          <div className="mb-6 pb-6 border-b border-slate-800">
            <p className="text-xs font-medium text-slate-400 mb-1.5">Business Invite Code</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold text-white tracking-widest">{form.invite_code}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(form.invite_code)}
                className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-lg transition-colors">
                Copy
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Share this code with employees so they can register.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Business Name</label>
            <input type="text" value={form.name || ''} onChange={e => set('name', e.target.value)}
              placeholder="Acme Window Washing LLC" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number</label>
            <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)}
              placeholder="(555) 555-5555" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Business Address</label>
            <input type="text" value={form.address || ''} onChange={e => set('address', e.target.value)}
              placeholder="123 Main St, Springfield, IL 62701" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Service Area Radius (miles)</label>
            <input type="number" min="1" max="500" value={form.service_radius || ''} onChange={e => set('service_radius', e.target.value)}
              placeholder="25" className="input" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
          Save Business Settings
        </button>
        {saved && <span className="text-emerald-400 text-sm">Saved!</span>}
      </div>
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Your Services</h2>
          <span className="text-xs text-slate-500">{services.length} total</span>
        </div>

        {services.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-500 text-sm">No services yet — add one below</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {services.map(svc => (
              <div key={svc.id} className="px-5 py-4">
                {editing?.id === svc.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input value={editing.name} onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                      placeholder="Service name" className="input sm:col-span-1" />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input type="number" min="0" step="0.01" value={editing.default_price}
                        onChange={e => setEditing(ed => ({ ...ed, default_price: e.target.value }))}
                        placeholder="0.00" className="input pl-7" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <input type="number" min="1" value={editing.duration_minutes}
                        onChange={e => setEditing(ed => ({ ...ed, duration_minutes: e.target.value }))}
                        placeholder="60" className="input flex-1" />
                      <span className="text-xs text-slate-500 whitespace-nowrap">min</span>
                      <button onClick={() => commitEdit(svc.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                        Save
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="text-slate-400 hover:text-white text-xs px-2 py-2 transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{svc.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {svc.default_price > 0 ? `$${svc.default_price.toFixed(2)} default` : 'No default price'}
                        {' · '}{svc.duration_minutes} min est.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEditing({ id: svc.id, name: svc.name, default_price: svc.default_price, duration_minutes: svc.duration_minutes })}
                        className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors">
                        Edit
                      </button>
                      {confirmDel === svc.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDelete(svc.id)}
                            className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 rounded-lg transition-colors">
                            Delete
                          </button>
                          <button onClick={() => setConfirmDel(null)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(svc.id)}
                          className="text-xs text-slate-600 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 px-3 py-1.5 rounded-lg transition-colors">
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Add a Service</h2>
        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Service Name</label>
              <input type="text" value={form.name} onChange={e => setF('name', e.target.value)}
                placeholder="Gutter Cleaning" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Default Price ($)</label>
              <input type="number" min="0" step="0.01" value={form.default_price} onChange={e => setF('default_price', e.target.value)}
                placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Est. Duration (min)</label>
              <input type="number" min="1" value={form.duration_minutes} onChange={e => setF('duration_minutes', e.target.value)}
                placeholder="60" className="input" />
            </div>
          </div>
          {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}
          <button type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Team Members</h2>
          <span className="text-xs text-slate-500">{members.length} total</span>
        </div>

        {members.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-500 text-sm">No team members yet</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {members.map(m => {
              const meta = ROLE_META[m.role] || ROLE_META.employee
              const canEdit = m.role !== 'owner' && isPrimary
              return (
                <div key={m.id} className="px-5 py-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold shrink-0">
                    {m.name[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.name}</p>
                    <p className="text-xs text-slate-400 truncate">{m.email}</p>
                  </div>

                  {canEdit ? (
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0">
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
                          <span className="text-slate-400 text-xs">$</span>
                          <input
                            type="number" min="0" step="0.50" value={editingRate.value}
                            onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
                            onBlur={() => commitRate(m.id)}
                            onKeyDown={e => { if (e.key === 'Enter') commitRate(m.id); if (e.key === 'Escape') setEditingRate(null) }}
                            autoFocus
                            className="w-16 bg-slate-700 border border-indigo-500 rounded px-1.5 py-1 text-white text-xs text-right focus:outline-none tabular-nums"
                          />
                          <span className="text-slate-400 text-xs">/hr</span>
                        </div>
                      ) : (
                        <button onClick={() => setEditingRate({ id: m.id, value: m.hourly_rate ?? '' })}
                          className={`text-sm transition-colors ${m.hourly_rate ? 'text-slate-300 hover:text-white' : 'text-amber-400 hover:text-amber-300'}`}
                          title="Click to edit rate">
                          {m.hourly_rate ? `$${m.hourly_rate}/hr` : 'Set rate'}
                        </button>
                      )
                    ) : m.role === 'employee' ? (
                      <span className="text-sm text-slate-400">{m.hourly_rate ? `$${m.hourly_rate}/hr` : '—'}</span>
                    ) : null}
                  </div>

                  {canEdit && (
                    <div className="shrink-0">
                      {confirmDel === m.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleRemove(m.id)}
                            className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 rounded-lg transition-colors">Remove</button>
                          <button onClick={() => setConfirmDel(null)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(m.id)}
                          className="text-xs text-slate-600 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 px-3 py-1.5 rounded-lg transition-colors">
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Create Invite</h2>
          <p className="text-xs text-slate-400 mb-4">The employee registers using the business invite code from the Business tab.</p>
          <form onSubmit={handleInvite}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                <input type="text" value={form.name} onChange={e => setF('name', e.target.value)} required
                  placeholder="Jane Smith" className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} required
                  placeholder="jane@company.com" className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                <select value={form.role} onChange={e => setF('role', e.target.value)} className="input">
                  <option value="employee">Employee</option>
                  <option value="co_owner">Co-Owner</option>
                </select>
              </div>
              {form.role === 'employee' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Hourly Rate ($)</label>
                  <input type="number" min="0" step="0.50" value={form.hourly_rate} onChange={e => setF('hourly_rate', e.target.value)}
                    placeholder="18.00" className="input" />
                </div>
              )}
            </div>
            {error   && <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>}
            {success && <p className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">{success}</p>}
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
              {saving ? 'Creating…' : 'Create Invite'}
            </button>
          </form>
        </div>
      )}
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-6">
        <h2 className="text-sm font-semibold text-white">Payroll Configuration</h2>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-3">Pay Period</label>
          <div className="flex gap-3">
            {[['weekly', 'Weekly'], ['biweekly', 'Biweekly']].map(([val, label]) => (
              <button key={val} type="button"
                onClick={() => set('pay_period', val)}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl border text-sm font-semibold transition-colors ${form.pay_period === val
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {form.pay_period === 'weekly' ? 'Employees are paid once every week.' : 'Employees are paid every two weeks.'}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Pay Day</label>
          <select value={form.pay_day} onChange={e => set('pay_day', parseInt(e.target.value))}
            className="input max-w-xs">
            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-2">
            Paychecks are issued every {DAY_NAMES[form.pay_day]}{form.pay_period === 'biweekly' ? ' (every other week)' : ''}.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-3">Default Tax Withholding</label>
          <div className="flex gap-3 flex-wrap">
            {[
              ['single', 'Single', 'Standard withholding for single filers'],
              ['married', 'Married Filing Jointly', 'Reduced withholding for joint filers'],
            ].map(([val, label, desc]) => (
              <button key={val} type="button"
                onClick={() => set('tax_method', val)}
                className={`flex-1 sm:flex-none text-left px-4 py-3 rounded-xl border transition-colors ${form.tax_method === val
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${form.tax_method === val ? 'border-indigo-400' : 'border-slate-600'}`}>
                    {form.tax_method === val && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </div>
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="text-xs text-slate-400 pl-5">{desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            This is an estimate only. Employees should verify withholding with a tax professional.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
          Save Payroll Settings
        </button>
        {saved && <span className="text-emerald-400 text-sm">Saved!</span>}
      </div>
    </form>
  )
}
