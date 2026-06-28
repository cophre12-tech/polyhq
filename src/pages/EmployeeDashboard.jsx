import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  clockIn, clockOut, getActiveEntry, getEntriesForUser,
  getEntriesInRange, entryDuration, getWeekStart, getTodayStart,
} from '../lib/db.js'
import { calcPayroll, formatCurrency, formatHours, formatDuration } from '../lib/payroll.js'

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const seenKey = `polyhq_seen_${user.id}`
  const isFirstVisit = !localStorage.getItem(seenKey)
  if (isFirstVisit) localStorage.setItem(seenKey, '1')

  const [active, setActive]               = useState(null)
  const [elapsed, setElapsed]             = useState(0)
  const [baseTodayHours, setBaseTodayH]   = useState(0)
  const [baseWeekHours, setBaseWeekH]     = useState(0)
  const [recentEntries, setRecentEntries] = useState([])
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)

  const refresh = useCallback(() => {
    const now    = new Date()
    const entry  = getActiveEntry(user.id)
    setActive(entry)
    const todayDone = getEntriesInRange(getTodayStart(), now, user.id).filter(e => e.clock_out).reduce((s, e) => s + entryDuration(e), 0)
    const weekDone  = getEntriesInRange(getWeekStart(),  now, user.id).filter(e => e.clock_out).reduce((s, e) => s + entryDuration(e), 0)
    setBaseTodayH(todayDone)
    setBaseWeekH(weekDone)
    setRecentEntries(getEntriesForUser(user.id).filter(e => e.clock_out).sort((a,b) => new Date(b.clock_in)-new Date(a.clock_in)).slice(0,6))
  }, [user.id])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!active) { setElapsed(0); return }
    const tick = () => setElapsed(Date.now() - new Date(active.clock_in).getTime())
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [active])

  async function handleClock() {
    setError(''); setLoading(true)
    try { if (active) await clockOut(user.id); else await clockIn(user.id); refresh() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const sessionHours = elapsed / 3600000
  const todayHours   = baseTodayHours + (active ? sessionHours : 0)
  const weekHours    = baseWeekHours  + (active ? sessionHours : 0)
  const pay          = calcPayroll(weekHours, user.hourly_rate || 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          {isFirstVisit ? 'Welcome' : 'Welcome back'}, {user.name.split(' ')[0]}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Your hours and estimated pay for this week</p>
      </div>

      {/* Clock card + stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col items-center text-center gap-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
            {active ? 'Time on Clock' : 'Status'}
          </p>
          {active
            ? <p className="text-4xl sm:text-5xl font-mono font-bold text-emerald-400 tabular-nums leading-none">{formatDuration(elapsed)}</p>
            : <p className="text-xl sm:text-2xl font-semibold text-slate-500">Not Clocked In</p>
          }
          {error && <p className="text-rose-400 text-xs -mb-2">{error}</p>}
          <button onClick={handleClock} disabled={loading}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed ${active?'bg-rose-600 hover:bg-rose-500 text-white':'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
            {loading ? '…' : active ? 'Clock Out' : 'Clock In'}
          </button>
          {active && <p className="text-xs text-slate-500">Since {new Date(active.clock_in).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>}
        </div>

        <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:gap-4">
          <Mini label="Today"          value={formatHours(todayHours)} />
          <Mini label="This Week"      value={formatHours(weekHours)} />
          <Mini label="Hourly Rate"    value={user.hourly_rate ? `$${user.hourly_rate}/hr` : 'Not set'} accent="indigo" />
          <Mini label="Gross This Wk"  value={formatCurrency(pay.gross)} accent="emerald" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Pay breakdown */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
          <h3 className="font-semibold text-white mb-4 sm:mb-5">Estimated Weekly Pay</h3>
          <div className="space-y-3">
            <PayRow label="Gross Pay"            value={formatCurrency(pay.gross)} />
            <PayRow label="Federal Income Tax"   value={`−${formatCurrency(pay.federalTax)}`}     negative />
            <PayRow label="Social Security 6.2%" value={`−${formatCurrency(pay.socialSecurity)}`} negative />
            <PayRow label="Medicare 1.45%"       value={`−${formatCurrency(pay.medicare)}`}        negative />
            <div className="border-t border-slate-700 pt-3 flex justify-between items-baseline">
              <span className="font-semibold text-white">Net Pay</span>
              <span className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">{formatCurrency(pay.netPay)}</span>
            </div>
          </div>
        </div>

        {/* Recent shifts */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
          <h3 className="font-semibold text-white mb-4 sm:mb-5">Recent Shifts</h3>
          {recentEntries.length === 0
            ? <p className="text-slate-500 text-sm">No completed shifts yet. Clock in to get started.</p>
            : <div className="space-y-1">
                {recentEntries.map(entry => (
                  <div key={entry.id} className="flex justify-between items-center py-2.5 border-b border-slate-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{new Date(entry.clock_in).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(entry.clock_in).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} – {new Date(entry.clock_out).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-200 tabular-nums">{formatHours(entryDuration(entry))}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

function Mini({ label, value, accent }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 sm:px-5 py-4">
      <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-lg sm:text-xl font-bold tabular-nums ${accent==='indigo'?'text-indigo-400':accent==='emerald'?'text-emerald-400':'text-white'}`}>{value}</p>
    </div>
  )
}

function PayRow({ label, value, negative }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${negative?'text-rose-400':'text-white'}`}>{value}</span>
    </div>
  )
}
