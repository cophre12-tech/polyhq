import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  clockIn, clockOut, getActiveEntry, getEntriesForUser,
  getEntriesInRange, entryDuration, getWeekStart, getTodayStart,
  getBusinessSettings,
} from '../lib/db.js'
import { calcPayroll, formatCurrency, formatHours, formatDuration, formatPct } from '../lib/payroll.js'

export default function EmployeeDashboard() {
  const { user } = useAuth()

  const [active, setActive]               = useState(null)
  const [elapsed, setElapsed]             = useState(0)
  const [baseTodayHours, setBaseTodayH]   = useState(0)
  const [baseWeekHours, setBaseWeekH]     = useState(0)
  const [recentEntries, setRecentEntries] = useState([])
  const [businessState, setBusinessState] = useState(null)
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)

  const refresh = useCallback(async () => {
    const now = new Date()
    const [entry, todayEntries, weekEntries, allEntries, settings] = await Promise.all([
      getActiveEntry(user.id),
      getEntriesInRange(getTodayStart(), now, user.id),
      getEntriesInRange(getWeekStart(), now, user.id),
      getEntriesForUser(user.id),
      getBusinessSettings(),
    ])
    setActive(entry)
    setBaseTodayH(todayEntries.filter(e => e.clock_out).reduce((s, e) => s + entryDuration(e), 0))
    setBaseWeekH(weekEntries.filter(e => e.clock_out).reduce((s, e) => s + entryDuration(e), 0))
    setRecentEntries(allEntries.filter(e => e.clock_out).slice(0, 6))
    setBusinessState(settings?.state || 'VT')
  }, [user.id])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!active) { setElapsed(0); return }
    const tick = () => setElapsed(Date.now() - new Date(active.clock_in).getTime())
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [active])

  async function handleClock() {
    setError(''); setLoading(true)
    try {
      if (active) await clockOut(user.id); else await clockIn(user.id)
      await refresh()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const sessionHours = elapsed / 3600000
  const todayHours   = baseTodayHours + (active ? sessionHours : 0)
  const weekHours    = baseWeekHours  + (active ? sessionHours : 0)
  const pay          = calcPayroll(weekHours, user.hourly_rate || 0, 52, 0, businessState)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-fg">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="text-fg-muted mt-1 text-sm">Your hours and estimated pay for this week</p>
      </div>

      {/* Clock card + stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-surface rounded-xl border border-line p-6 flex flex-col items-center text-center gap-4">
          <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider">
            {active ? 'Time on Clock' : 'Status'}
          </p>
          {active
            ? <p className="text-4xl sm:text-5xl font-mono font-semibold text-success tabular-nums leading-none">{formatDuration(elapsed)}</p>
            : <p className="text-xl sm:text-2xl font-semibold text-fg-subtle">Not Clocked In</p>
          }
          {error && <p className="text-danger text-xs -mb-2">{error}</p>}
          <button onClick={handleClock} disabled={loading}
            className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed ${active?'bg-danger hover:bg-danger/85 text-fg':'bg-success hover:bg-success/85 text-fg'}`}>
            {loading ? '…' : active ? 'Clock Out' : 'Clock In'}
          </button>
          {active && <p className="text-xs text-fg-subtle">Since {new Date(active.clock_in).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>}
        </div>

        <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:gap-4">
          <Mini label="Today"          value={formatHours(todayHours)} />
          <Mini label="This Week"      value={formatHours(weekHours)} />
          <Mini label="Hourly Rate"    value={user.hourly_rate ? `$${user.hourly_rate}/hr` : 'Not set'} accent="indigo" />
          <Mini label="Gross This Wk"  value={formatCurrency(pay.gross)} accent="emerald" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Detailed pay breakdown */}
        <PayBreakdown pay={pay} weekHours={weekHours} hourlyRate={user.hourly_rate || 0} />

        {/* Recent shifts */}
        <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
          <h3 className="font-semibold text-fg mb-4 sm:mb-5">Recent Shifts</h3>
          {recentEntries.length === 0
            ? <p className="text-fg-subtle text-sm">No completed shifts yet. Clock in to get started.</p>
            : <div className="space-y-1">
                {recentEntries.map(entry => (
                  <div key={entry.id} className="flex justify-between items-center py-2.5 border-b border-line last:border-0">
                    <div>
                      <p className="text-sm font-medium text-fg">{new Date(entry.clock_in).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p>
                      <p className="text-xs text-fg-muted mt-0.5">{new Date(entry.clock_in).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} – {new Date(entry.clock_out).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                    <span className="text-sm font-semibold text-fg tabular-nums">{formatHours(entryDuration(entry))}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

function PayBreakdown({ pay, weekHours, hourlyRate }) {
  const { stateInfo } = pay
  const stateName = stateInfo ? stateInfo.name : 'State'

  return (
    <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
      <h3 className="font-semibold text-fg mb-5">Estimated Weekly Pay</h3>

      {/* Gross */}
      <div className="mb-4">
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-sm font-medium text-fg">Gross Pay</span>
          <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(pay.gross)}</span>
        </div>
        <p className="text-xs text-fg-subtle">
          {formatHours(weekHours)} × ${hourlyRate}/hr
        </p>
      </div>

      {/* Deductions header */}
      <p className="font-mono text-2xs font-medium text-fg-subtle uppercase tracking-wider mb-2 border-t border-line pt-3">Deductions</p>

      <div className="space-y-3 mb-4">
        {/* Federal */}
        <TaxLine
          label="Federal Income Tax"
          amount={pay.federalTax}
        >
          {pay.federalBracket && (
            <span className="text-xs text-fg-subtle">
              {formatPct(pay.federalBracket.rate)} marginal · {formatPct(pay.federalEffRate)} effective
              {pay.annualGross > 0 && <> · annualized {formatCurrency(pay.annualGross)}</>}
            </span>
          )}
        </TaxLine>

        {/* Social Security */}
        <TaxLine label="Social Security" amount={pay.socialSecurity}>
          <span className="text-xs text-fg-subtle">6.2% of gross (employee share)</span>
        </TaxLine>

        {/* Medicare */}
        <TaxLine label="Medicare" amount={pay.medicare}>
          <span className="text-xs text-fg-subtle">1.45% of gross (employee share)</span>
        </TaxLine>

        {/* State */}
        <TaxLine
          label={`${stateName} Income Tax`}
          amount={pay.stateTax}
          zero={!stateInfo?.hasIncomeTax}
        >
          {stateInfo?.hasIncomeTax && pay.stateBracket ? (
            <span className="text-xs text-fg-subtle">
              {formatPct(pay.stateBracket.rate)} marginal · {formatPct(pay.stateEffRate)} effective
            </span>
          ) : (
            <span className="text-xs text-fg-subtle">
              {stateInfo?.note ?? 'No state configured'}
            </span>
          )}
        </TaxLine>
      </div>

      {/* Total deductions */}
      <div className="flex justify-between items-center py-2.5 border-t border-line mb-3">
        <span className="text-sm text-fg-muted">Total Withheld</span>
        <span className="text-sm font-semibold text-danger tabular-nums">−{formatCurrency(pay.totalDeductions)}</span>
      </div>

      {/* Net pay */}
      <div className="flex justify-between items-baseline bg-success/5 border border-success/15 rounded-lg px-3 py-2.5">
        <span className="font-semibold text-fg">Est. Net Pay</span>
        <span className="text-xl font-semibold text-success tabular-nums">{formatCurrency(pay.netPay)}</span>
      </div>

      <p className="text-xs text-fg-subtle mt-3 leading-relaxed">
        * 2024 single-filer withholding tables. Not tax advice. Actual paycheck may differ.
      </p>
    </div>
  )
}

function TaxLine({ label, amount, zero, children }) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className={`text-sm font-medium tabular-nums ${zero ? 'text-fg-subtle' : 'text-danger'}`}>
          {zero ? '$0.00' : `−${formatCurrency(amount)}`}
        </span>
      </div>
      {children && <div className="mt-0.5">{children}</div>}
    </div>
  )
}

function Mini({ label, value, accent }) {
  return (
    <div className="bg-raised/50 border border-line rounded-xl px-4 sm:px-5 py-4">
      <p className="font-mono text-2xs text-fg-muted mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-lg sm:text-xl font-semibold tabular-nums ${accent==='indigo'?'text-fg':accent==='emerald'?'text-success':'text-fg'}`}>{value}</p>
    </div>
  )
}
