import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

const PLANS = ['free', 'pro', 'business']
const PLAN_COLORS = {
  free:     'text-fg-muted bg-raised border-line',
  pro:      'text-fg bg-raised border-line-strong',
  business: 'text-fg bg-raised border-line-strong',
}

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-panel`

async function callAdminPanel(method, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { Authorization: `Bearer ${session?.access_token}` }
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(EDGE_URL, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [saving, setSaving]         = useState({})
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(new Set())
  const [confirm, setConfirm]       = useState(null) // { ids, label } | null
  const [deleting, setDeleting]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await callAdminPanel('GET')
      setBusinesses(data.businesses)
      setSelected(new Set())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return businesses
    return businesses.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.owner_email.toLowerCase().includes(q) ||
      b.owner_name.toLowerCase().includes(q)
    )
  }, [businesses, search])

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allFilteredSelected = filtered.length > 0 && filtered.every(b => selected.has(b.id))
  const someSelected = selected.size > 0

  function toggleOne(id) {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(s => { const next = new Set(s); filtered.forEach(b => next.delete(b.id)); return next })
    } else {
      setSelected(s => { const next = new Set(s); filtered.forEach(b => next.add(b.id)); return next })
    }
  }

  // ── Plan update ─────────────────────────────────────────────────────────────
  async function handlePlanChange(businessId, newPlan) {
    setSaving(s => ({ ...s, [businessId]: 'saving' }))
    try {
      await callAdminPanel('POST', { action: 'update_plan', business_id: businessId, plan: newPlan })
      setBusinesses(bs => bs.map(b => b.id === businessId ? { ...b, plan: newPlan } : b))
      setSaving(s => ({ ...s, [businessId]: 'saved' }))
      setTimeout(() => setSaving(s => ({ ...s, [businessId]: null })), 2000)
    } catch (err) {
      setSaving(s => ({ ...s, [businessId]: 'error' }))
      setTimeout(() => setSaving(s => ({ ...s, [businessId]: null })), 3000)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  function promptDelete(ids, label) { setConfirm({ ids, label }) }

  async function confirmDelete() {
    if (!confirm) return
    setDeleting(true)
    try {
      await callAdminPanel('POST', { action: 'delete_businesses', business_ids: confirm.ids })
      const removed = new Set(confirm.ids)
      setBusinesses(bs => bs.filter(b => !removed.has(b.id)))
      setSelected(s => { const next = new Set(s); confirm.ids.forEach(id => next.delete(id)); return next })
      setConfirm(null)
    } catch (err) {
      setError(err.message)
      setConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  const totalByPlan = businesses.reduce((acc, b) => { acc[b.plan] = (acc[b.plan] || 0) + 1; return acc }, {})

  return (
    <div className="min-h-screen bg-base text-fg">
      {/* Header */}
      <div className="border-b border-line px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg className="w-4 h-4 text-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-fg">PolyHQ Super Admin</h1>
            <p className="font-mono text-2xs text-fg-subtle">cophre12@gmail.com</p>
          </div>
        </div>
        <button onClick={() => navigate('/owner')} className="text-xs text-fg-subtle hover:text-fg-muted transition-colors">
          ← Back to app
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Stat label="Total Businesses" value={businesses.length} />
          <Stat label="Free"     value={totalByPlan.free     || 0} color="text-fg-muted" />
          <Stat label="Pro"      value={totalByPlan.pro      || 0} color="text-fg" />
          <Stat label="Business" value={totalByPlan.business || 0} color="text-fg" />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-danger">{error}</p>
            <button onClick={() => setError('')} className="text-danger hover:text-danger/80 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Table card */}
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 sm:px-5 py-4 border-b border-line flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* Bulk delete */}
            {someSelected && (
              <button
                onClick={() => {
                  const ids = [...selected]
                  const names = ids.map(id => businesses.find(b => b.id === id)?.name).filter(Boolean)
                  promptDelete(ids, `${ids.length} business${ids.length !== 1 ? 'es' : ''}`)
                }}
                className="btn-danger text-xs px-3 py-2 shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete {selected.size}
              </button>
            )}

            <button onClick={load} className="text-xs text-fg-subtle hover:text-fg-muted transition-colors shrink-0">Refresh</button>
          </div>

          {/* Search result count */}
          {search && !loading && (
            <div className="px-5 py-2 border-b border-line font-mono text-2xs text-fg-subtle">
              {filtered.length} of {businesses.length} businesses
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-line-strong border-t-fg rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-fg-subtle text-sm text-center py-16">
              {search ? 'No businesses match your search.' : 'No businesses found.'}
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="pl-5 pr-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAll}
                          className="rounded border-line-strong bg-raised accent-accent focus:ring-0 cursor-pointer"
                        />
                      </th>
                      {['Business', 'Owner', 'Co-Owners', 'Plan', 'Employees', 'Created', ''].map((h, i) => (
                        <th key={i} className={`px-3 py-3 font-mono text-2xs font-medium text-fg-subtle uppercase tracking-wider ${h === 'Business' || h === 'Owner' || h === 'Co-Owners' ? 'text-left' : 'text-center'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map(biz => {
                      const noOwner = biz.owner_name === '—' || !biz.owner_name
                      return (
                        <tr key={biz.id} className={`transition-colors ${selected.has(biz.id) ? 'bg-raised' : 'hover:bg-raised/50'}`}>
                          <td className="pl-5 pr-3 py-4 w-8">
                            <input
                              type="checkbox"
                              checked={selected.has(biz.id)}
                              onChange={() => toggleOne(biz.id)}
                              className="rounded border-line-strong bg-raised accent-accent focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-4">
                            <p className="font-medium text-fg">{biz.name}</p>
                            <p className="font-mono text-2xs text-fg-subtle mt-0.5">{biz.id.slice(0, 8)}…</p>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1.5">
                              {noOwner && (
                                <svg className="w-3.5 h-3.5 text-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} title="No owner found">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                </svg>
                              )}
                              <div>
                                <p className={noOwner ? 'text-warning text-xs font-medium' : 'text-fg'}>
                                  {noOwner ? 'No owner' : biz.owner_name}
                                </p>
                                <p className="font-mono text-2xs text-fg-subtle mt-0.5">{biz.owner_email === '—' ? '' : biz.owner_email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            {biz.co_owners?.length > 0 ? (
                              <div className="space-y-1.5">
                                {biz.co_owners.map((co, i) => (
                                  <div key={i}>
                                    <p className="text-fg text-sm">{co.name}</p>
                                    <p className="font-mono text-2xs text-fg-subtle">{co.email}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-fg-subtle">—</span>
                            )}
                          </td>
                          <td className="px-3 py-4 text-center">
                            <PlanDropdown
                              value={biz.plan}
                              status={saving[biz.id]}
                              onChange={plan => handlePlanChange(biz.id, plan)}
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="text-fg-muted tabular-nums">{biz.employee_count}</span>
                            {biz.member_count > biz.employee_count && (
                              <span className="text-fg-subtle text-xs ml-1">/ {biz.member_count}</span>
                            )}
                          </td>
                          <td className="px-3 py-4 text-center text-fg-muted font-mono text-xs tabular-nums">
                            {new Date(biz.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="pl-3 pr-5 py-4 text-center">
                            <button
                              onClick={() => promptDelete([biz.id], `"${biz.name}"`)}
                              className="p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                              title="Delete business"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-line">
                {filtered.map(biz => {
                  const noOwner = biz.owner_name === '—' || !biz.owner_name
                  return (
                    <div key={biz.id} className={`p-4 space-y-3 ${selected.has(biz.id) ? 'bg-raised' : ''}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(biz.id)}
                          onChange={() => toggleOne(biz.id)}
                          className="mt-0.5 rounded border-line-strong bg-raised accent-accent focus:ring-0 cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-fg">{biz.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {noOwner && <svg className="w-3 h-3 text-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
                            <p className={`text-xs ${noOwner ? 'text-warning' : 'text-fg-subtle'}`}>
                              {noOwner ? 'No owner' : `${biz.owner_name} · ${biz.owner_email}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => promptDelete([biz.id], `"${biz.name}"`)}
                          className="p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {biz.co_owners?.length > 0 && (
                        <div className="text-xs space-y-1">
                          <p className="font-mono text-fg-subtle uppercase tracking-wider font-medium text-2xs">Co-owners</p>
                          {biz.co_owners.map((co, i) => (
                            <p key={i} className="text-fg-muted">{co.name} · <span className="text-fg-subtle">{co.email}</span></p>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <PlanDropdown
                          value={biz.plan}
                          status={saving[biz.id]}
                          onChange={plan => handlePlanChange(biz.id, plan)}
                        />
                        <div className="flex items-center gap-3 text-xs text-fg-subtle">
                          <span>{biz.employee_count} emp.</span>
                          <span>{new Date(biz.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/70 backdrop-blur-sm">
          <div className="bg-surface border border-line rounded-2xl p-6 max-w-sm w-full">
            <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-fg mb-1">Delete {confirm.label}?</h3>
            <p className="text-sm text-fg-muted mb-6 leading-relaxed">
              This permanently deletes the {confirm.ids.length === 1 ? 'business' : `${confirm.ids.length} businesses`} and
              all associated data — employees, jobs, revenue, invoices, and clock records. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                disabled={deleting}
                className="flex-1 bg-raised hover:bg-overlay text-fg text-sm font-semibold rounded-xl py-2.5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-danger hover:bg-danger/85 text-fg text-sm font-semibold rounded-xl py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <div className="w-3.5 h-3.5 border-2 border-fg/40 border-t-fg rounded-full animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanDropdown({ value, status, onChange }) {
  return (
    <div className="inline-flex items-center gap-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={status === 'saving'}
        className={`text-xs font-semibold rounded-lg border px-2.5 py-1.5 bg-transparent cursor-pointer focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed capitalize ${PLAN_COLORS[value]}`}
      >
        {PLANS.map(p => (
          <option key={p} value={p} className="bg-surface text-fg capitalize">{p}</option>
        ))}
      </select>
      {status === 'saving' && <div className="w-3 h-3 border border-line-strong border-t-transparent rounded-full animate-spin shrink-0" />}
      {status === 'saved'  && <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      {status === 'error'  && <svg className="w-3.5 h-3.5 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
    </div>
  )
}

function Stat({ label, value, color = 'text-fg' }) {
  return (
    <div className="bg-surface rounded-xl border border-line px-4 py-4">
      <p className="font-mono text-2xs text-fg-subtle mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
