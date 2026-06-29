import { useState, useEffect, useCallback } from 'react'
import { getEmployees, getEntriesInRange, getActiveEntry, entryDuration, getWeekStart, getTodayStart, updateEmployeeRate } from '../lib/db.js'
import { formatHours, formatCurrency } from '../lib/payroll.js'

export default function OwnerDashboard() {
  const [crew, setCrew] = useState([])
  const [editingRate, setEditingRate] = useState(null)

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
        <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1 text-sm">Live crew status and weekly overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Crew"      value={crew.length} />
        <StatCard label="Clocked In"      value={clockedIn}                   accent="emerald" />
        <StatCard label="Hours This Week" value={formatHours(totalWeekHours)} />
        <StatCard label="Week Pay Est."   value={formatCurrency(totalWeekPay)} accent="indigo" />
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-white">Crew Status</h2>
          <span className="text-xs text-slate-500 hidden sm:block">Click a rate to edit · Refreshes every 30s</span>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['Employee','Status','Today','This Week','Rate','Week Pay'].map(h => (
                  <th key={h} className={`px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider ${h==='Employee'?'text-left':'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {crew.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">{emp.name[0]}</div>
                      <span className="font-medium text-white">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-slate-700/50 text-slate-400 border border-slate-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {emp.active ? 'Clocked In' : 'Out'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300 tabular-nums">{formatHours(emp.todayHours)}</td>
                  <td className="px-6 py-4 text-right text-slate-300 tabular-nums">{formatHours(emp.weekHours)}</td>
                  <td className="px-6 py-4 text-right">
                    {editingRate?.id === emp.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-slate-400 text-xs">$</span>
                        <input type="number" min="0" step="0.50" value={editingRate.value}
                          onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
                          onBlur={() => commitRate(emp.id)}
                          onKeyDown={e => { if(e.key==='Enter') commitRate(emp.id); if(e.key==='Escape') setEditingRate(null) }}
                          autoFocus className="w-16 bg-slate-700 border border-indigo-500 rounded px-2 py-1 text-white text-sm text-right focus:outline-none tabular-nums" />
                        <span className="text-slate-400 text-xs">/hr</span>
                      </div>
                    ) : (
                      <button onClick={() => setEditingRate({ id: emp.id, value: emp.hourly_rate ?? '' })}
                        className={`group inline-flex items-center gap-1.5 tabular-nums transition-colors ${emp.hourly_rate ? 'text-slate-300 hover:text-white' : 'text-amber-400 hover:text-amber-300'}`}
                        title="Click to set rate">
                        {emp.hourly_rate ? `$${emp.hourly_rate}/hr` : 'Set rate'}
                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" /></svg>
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-white tabular-nums">{formatCurrency(emp.weekPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-slate-800/60">
          {crew.length === 0 && (
            <p className="px-4 py-10 text-center text-slate-500 text-sm">No crew members yet.</p>
          )}
          {crew.map(emp => (
            <div key={emp.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold">{emp.name[0]}</div>
                  <span className="font-semibold text-white">{emp.name}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-slate-700/50 text-slate-400 border border-slate-700'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  {emp.active ? 'In' : 'Out'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Today</p>
                  <p className="text-white tabular-nums font-medium">{formatHours(emp.todayHours)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">This Week</p>
                  <p className="text-white tabular-nums font-medium">{formatHours(emp.weekHours)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Week Pay</p>
                  <p className="text-emerald-400 tabular-nums font-semibold">{formatCurrency(emp.weekPay)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">Hourly rate</span>
                {editingRate?.id === emp.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs">$</span>
                    <input type="number" min="0" step="0.50" value={editingRate.value}
                      onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
                      onBlur={() => commitRate(emp.id)}
                      onKeyDown={e => { if(e.key==='Enter') commitRate(emp.id); if(e.key==='Escape') setEditingRate(null) }}
                      autoFocus className="w-20 bg-slate-700 border border-indigo-500 rounded px-2 py-1.5 text-white text-sm text-right focus:outline-none tabular-nums" />
                    <span className="text-slate-400 text-xs">/hr</span>
                  </div>
                ) : (
                  <button onClick={() => setEditingRate({ id: emp.id, value: emp.hourly_rate ?? '' })}
                    className={`text-sm font-medium tabular-nums ${emp.hourly_rate ? 'text-slate-300' : 'text-amber-400'}`}>
                    {emp.hourly_rate ? `$${emp.hourly_rate}/hr` : 'Set rate →'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 px-4 sm:px-6 py-4 sm:py-5">
      <p className="text-xs font-medium text-slate-400 mb-1 sm:mb-1.5 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${accent==='emerald'?'text-emerald-400':accent==='indigo'?'text-indigo-400':'text-white'}`}>{value}</p>
    </div>
  )
}
