import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEmployees, getEntriesInRange, getActiveEntry, entryDuration, getWeekStart, getTodayStart, updateEmployeeRate } from '../lib/db.js'
import { formatHours, formatCurrency } from '../lib/payroll.js'
import { useSubscription } from '../hooks/useSubscription.js'

export default function OwnerDashboard() {
  const { plan, isAdmin } = useSubscription()
  const navigate = useNavigate()
  const [crew, setCrew]           = useState([])
  const [editingRate, setEditingRate] = useState(null)
  const [loading, setLoading]     = useState(true)

  const refresh = useCallback(async () => {
    const now = new Date()
    const [employees, weekEntries, todayEntries] = await Promise.all([
      getEmployees(),
      getEntriesInRange(getWeekStart(), now),
      getEntriesInRange(getTodayStart(), now),
    ])
    const activeEntries = await Promise.all(employees.map(emp => getActiveEntry(emp.id)))
    setCrew(employees.map((emp, i) => {
      const active     = activeEntries[i]
      const weekHours  = weekEntries.filter(e => e.user_id === emp.id).reduce((s, e) => s + entryDuration(e), 0)
      const todayHours = todayEntries.filter(e => e.user_id === emp.id).reduce((s, e) => s + entryDuration(e), 0)
      return { ...emp, active, weekHours, todayHours, weekPay: weekHours * (emp.hourly_rate || 0) }
    }))
    setLoading(false)
  }, [])

  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id) }, [refresh])

  async function commitRate(empId) {
    const rate = parseFloat(editingRate.value)
    if (!isNaN(rate) && rate >= 0) { await updateEmployeeRate(empId, rate); refresh() }
    setEditingRate(null)
  }

  const clockedIn      = crew.filter(e => e.active).length
  const totalWeekHours = crew.reduce((s, e) => s + e.weekHours, 0)
  const totalWeekPay   = crew.reduce((s, e) => s + e.weekPay, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-fg">Dashboard</h1>
        <p className="text-fg-muted mt-1 text-sm">Live crew status and weekly overview</p>
      </div>

      {/* Free plan upgrade nudge */}
      {!isAdmin && plan === 'free' && (
        <div className="mb-6 bg-surface border border-line rounded-xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-fg">You&apos;re on the Free plan</p>
            <p className="text-xs text-fg-muted mt-0.5">
              Upgrade to <span className="text-fg font-medium">Pro ($15/mo)</span> to unlock scheduling, invoicing, full accounting, team chat, and up to 10 employees.
            </p>
          </div>
          <button
            onClick={() => navigate('/owner/settings', { state: { tab: 'subscription' } })}
            className="btn-primary shrink-0 text-xs px-4 py-2"
          >
            View Plans
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Crew"      value={loading ? '—' : crew.length} />
        <StatCard label="Clocked In"      value={loading ? '—' : clockedIn}                   accent="emerald" />
        <StatCard label="Hours This Week" value={loading ? '—' : formatHours(totalWeekHours)} />
        <StatCard label="Week Pay Est."   value={loading ? '—' : formatCurrency(totalWeekPay)} accent="indigo" />
      </div>

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-fg">Crew Status</h2>
          <span className="text-xs text-fg-subtle hidden sm:block">Click a rate to edit · Refreshes every 30s</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-line-strong border-t-fg rounded-full animate-spin" />
          </div>
        ) : crew.length === 0 ? (
          <p className="px-6 py-12 text-center text-fg-subtle text-sm">
            No crew members yet. Add employees in <button onClick={() => navigate('/owner/crew')} className="text-fg underline-offset-4 hover:underline underline underline-offset-2">Crew</button>.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {['Employee','Status','Today','This Week','Rate','Week Pay'].map(h => (
                      <th key={h} className={`px-6 py-3 font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider ${h==='Employee'?'text-left':'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {crew.map(emp => (
                    <tr key={emp.id} className="hover:bg-raised/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-raised border border-line flex items-center justify-center text-fg-muted text-xs font-semibold shrink-0">{emp.name[0]}</div>
                          <span className="font-medium text-fg">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-success/15 text-success border border-success/25' : 'bg-overlay/50 text-fg-muted border border-line'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-success' : 'bg-overlay'}`} />
                          {emp.active ? 'Clocked In' : 'Out'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-fg-muted tabular-nums">{formatHours(emp.todayHours)}</td>
                      <td className="px-6 py-4 text-right text-fg-muted tabular-nums">{formatHours(emp.weekHours)}</td>
                      <td className="px-6 py-4 text-right">
                        {editingRate?.id === emp.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-fg-muted text-xs">$</span>
                            <input type="number" min="0" step="0.50" value={editingRate.value}
                              onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
                              onBlur={() => commitRate(emp.id)}
                              onKeyDown={e => { if(e.key==='Enter') commitRate(emp.id); if(e.key==='Escape') setEditingRate(null) }}
                              autoFocus className="w-16 bg-overlay border border-accent rounded px-2 py-1 text-fg text-sm text-right focus:outline-none tabular-nums" />
                            <span className="text-fg-muted text-xs">/hr</span>
                          </div>
                        ) : (
                          <button onClick={() => setEditingRate({ id: emp.id, value: emp.hourly_rate ?? '' })}
                            className={`group inline-flex items-center gap-1.5 tabular-nums transition-colors ${emp.hourly_rate ? 'text-fg-muted hover:text-fg' : 'text-warning hover:text-warning/80'}`}
                            title="Click to set rate">
                            {emp.hourly_rate ? `$${emp.hourly_rate}/hr` : 'Set rate'}
                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" /></svg>
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-fg tabular-nums">{formatCurrency(emp.weekPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-line">
              {crew.map(emp => (
                <div key={emp.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-raised border border-line flex items-center justify-center text-fg-muted text-sm font-semibold">{emp.name[0]}</div>
                      <span className="font-semibold text-fg">{emp.name}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-success/15 text-success border border-success/25' : 'bg-overlay/50 text-fg-muted border border-line'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-success' : 'bg-overlay'}`} />
                      {emp.active ? 'In' : 'Out'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-fg-subtle mb-0.5">Today</p>
                      <p className="text-fg tabular-nums font-medium">{formatHours(emp.todayHours)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-fg-subtle mb-0.5">This Week</p>
                      <p className="text-fg tabular-nums font-medium">{formatHours(emp.weekHours)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-fg-subtle mb-0.5">Week Pay</p>
                      <p className="text-success tabular-nums font-semibold">{formatCurrency(emp.weekPay)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                    <span className="text-xs text-fg-subtle">Hourly rate</span>
                    {editingRate?.id === emp.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-fg-muted text-xs">$</span>
                        <input type="number" min="0" step="0.50" value={editingRate.value}
                          onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
                          onBlur={() => commitRate(emp.id)}
                          onKeyDown={e => { if(e.key==='Enter') commitRate(emp.id); if(e.key==='Escape') setEditingRate(null) }}
                          autoFocus className="w-20 bg-overlay border border-accent rounded px-2 py-1.5 text-fg text-sm text-right focus:outline-none tabular-nums" />
                        <span className="text-fg-muted text-xs">/hr</span>
                      </div>
                    ) : (
                      <button onClick={() => setEditingRate({ id: emp.id, value: emp.hourly_rate ?? '' })}
                        className={`text-sm font-medium tabular-nums ${emp.hourly_rate ? 'text-fg-muted' : 'text-warning'}`}>
                        {emp.hourly_rate ? `$${emp.hourly_rate}/hr` : 'Set rate →'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-surface rounded-xl border border-line px-4 sm:px-6 py-4 sm:py-5">
      <p className="font-mono text-2xs font-medium text-fg-muted mb-1 sm:mb-1.5 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-xl sm:text-2xl font-semibold tabular-nums ${accent==='emerald'?'text-success':accent==='indigo'?'text-fg':'text-fg'}`}>{value}</p>
    </div>
  )
}
