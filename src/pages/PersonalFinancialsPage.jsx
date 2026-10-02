import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getWeekStart, getEntriesInRange, entryDuration,
  getBusinessSettings,
  getPersonalIncome, addPersonalIncome, deletePersonalIncome,
  getPersonalExpenses, addPersonalExpense, deletePersonalExpense,
} from '../lib/db.js'
import { calcPayroll, formatCurrency, formatHours } from '../lib/payroll.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { key: 'Housing',       label: 'Housing',        emoji: '🏠' },
  { key: 'Transport',     label: 'Transport',       emoji: '🚗' },
  { key: 'Utilities',     label: 'Utilities',       emoji: '⚡' },
  { key: 'Food',          label: 'Food & Dining',   emoji: '🍽️' },
  { key: 'Insurance',     label: 'Insurance',       emoji: '🛡️' },
  { key: 'Subscriptions', label: 'Subscriptions',   emoji: '📱' },
  { key: 'Healthcare',    label: 'Healthcare',      emoji: '❤️' },
  { key: 'Other',         label: 'Other',           emoji: '📦' },
]

const FREQUENCY_LABELS = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function thisMonthStart() {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}
function lastMonthStart() {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0)
}
function lastMonthEnd() {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999)
}
function todayStr() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function monthlyEquiv(exp) {
  const amt = parseFloat(exp.amount) || 0
  if (exp.frequency === 'weekly') return (amt * 52) / 12
  if (exp.frequency === 'yearly') return amt / 12
  return amt
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PersonalFinancialsPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner' || user?.role === 'co_owner'
  const [tab, setTab] = useState('income')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Personal Financials</h1>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/25 rounded-full px-2.5 py-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Only you can see this
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          {isOwner
            ? 'Log your take-home pay and track personal expenses — never visible to your team.'
            : 'Your earnings and personal expenses — completely private from your employer and teammates.'}
        </p>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 w-fit">
        {[['income', 'Income'], ['expenses', 'Expenses']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'income'   && (isOwner ? <OwnerIncomeSection user={user} /> : <EmployeeIncomeSection user={user} />)}
      {tab === 'expenses' && <ExpensesSection userId={user.id} />}
    </div>
  )
}

// ── Employee Income ───────────────────────────────────────────────────────────

function EmployeeIncomeSection({ user }) {
  const [periodIdx, setPeriodIdx] = useState(2) // default: This Month
  const [entries, setEntries]     = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [bizState, setBizState]   = useState('VT')
  const [loading, setLoading]     = useState(true)

  const periods = useMemo(() => [
    { label: 'This Week',  start: getWeekStart(0), end: new Date() },
    { label: 'Last Week',  start: getWeekStart(1), end: getWeekStart(0) },
    { label: 'This Month', start: thisMonthStart(), end: new Date() },
    { label: 'Last Month', start: lastMonthStart(), end: lastMonthEnd() },
  ], [])

  useEffect(() => {
    getBusinessSettings().then(s => setBizState(s?.state || 'VT'))
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      getEntriesInRange(periods[periodIdx].start, periods[periodIdx].end, user.id),
      getEntriesInRange(new Date(0), new Date(), user.id),
    ]).then(([period, all]) => {
      if (!mounted) return
      setEntries(period)
      setAllEntries(all)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [periodIdx, user.id])

  const rate = parseFloat(user?.hourly_rate) || 0

  const periodPay = useMemo(() => {
    const hours = entries.reduce((s, e) => s + entryDuration(e), 0)
    return calcPayroll(hours, rate, 52, 0, bizState)
  }, [entries, rate, bizState])

  // Group all entries by week for history view
  const weeklyHistory = useMemo(() => {
    const weeks = {}
    for (const e of allEntries) {
      const d = new Date(e.clock_in)
      const day = d.getDay()
      const mon = new Date(d)
      mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      mon.setHours(0, 0, 0, 0)
      const key = mon.toISOString().split('T')[0]
      if (!weeks[key]) weeks[key] = { label: mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), entries: [] }
      weeks[key].entries.push(e)
    }
    return Object.entries(weeks)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([, week]) => {
        const hours = week.entries.reduce((s, e) => s + entryDuration(e), 0)
        const pay = calcPayroll(hours, rate, 52, 0, bizState)
        return { ...week, hours, pay }
      })
  }, [allEntries, rate, bizState])

  const allTimePay = useMemo(() => {
    const hours = allEntries.reduce((s, e) => s + entryDuration(e), 0)
    return calcPayroll(hours, rate, 52, 0, bizState)
  }, [allEntries, rate, bizState])

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {periods.map((p, i) => (
          <button key={i} onClick={() => setPeriodIdx(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${i === periodIdx ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Main pay card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-8">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Est. Net Pay — {periods[periodIdx].label}</p>
            <p className="text-4xl sm:text-5xl font-black text-white tabular-nums mb-6">{formatCurrency(periodPay.netPay)}</p>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
              <PayStat label="Hours" value={formatHours(periodPay.hours)} />
              <PayStat label="Gross" value={formatCurrency(periodPay.gross)} />
              <PayStat label="Tax" value={`−${formatCurrency(periodPay.totalDeductions)}`} dim />
            </div>
          </div>

          {/* All-time total */}
          <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-wider">Total Earned Since Joining</p>
              <p className="text-2xl font-black text-white mt-0.5 tabular-nums">{formatCurrency(allTimePay.netPay)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500 tabular-nums">{formatHours(allTimePay.hours)} total hours</p>
              <p className="text-xs text-slate-500 mt-0.5">${rate.toFixed(2)}/hr</p>
            </div>
          </div>

          {/* Weekly history */}
          {weeklyHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">Recent Pay History</p>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="divide-y divide-slate-800/60">
                  {weeklyHistory.map((week, i) => (
                    <div key={i} className="px-4 sm:px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-300">Week of {week.label}</p>
                        <p className="text-xs text-slate-500">{formatHours(week.hours)} · gross {formatCurrency(week.pay.gross)}</p>
                      </div>
                      <p className="text-sm font-bold text-white tabular-nums shrink-0">{formatCurrency(week.pay.netPay)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600">* Estimates use your current hourly rate (${rate.toFixed(2)}/hr) and single-filer withholding tables. Actual net pay may vary.</p>
        </>
      )}
    </div>
  )
}

// ── Owner Income ──────────────────────────────────────────────────────────────

function OwnerIncomeSection({ user }) {
  const [entries, setEntries]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ amount: '', date: todayStr(), notes: '' })
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [periodIdx, setPeriodIdx] = useState(2) // default: This Month
  const [confirmDel, setConfirmDel] = useState(null)

  const periods = useMemo(() => [
    { label: 'This Week',  start: getWeekStart(0), end: new Date() },
    { label: 'Last Week',  start: getWeekStart(1), end: getWeekStart(0) },
    { label: 'This Month', start: thisMonthStart(), end: new Date() },
    { label: 'Last Month', start: lastMonthStart(), end: lastMonthEnd() },
    { label: 'All Time',   start: new Date(0),     end: new Date() },
  ], [])

  useEffect(() => {
    getPersonalIncome(user.id).then(data => { setEntries(data); setLoading(false) })
  }, [user.id])

  const filtered = useMemo(() => {
    const { start, end } = periods[periodIdx]
    return entries.filter(e => {
      const d = new Date(e.date + 'T00:00:00')
      return d >= start && d <= end
    })
  }, [entries, periodIdx, periods])

  const periodTotal = filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const allTotal    = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0)

  async function handleAdd(ev) {
    ev.preventDefault()
    if (!form.amount || !form.date) return
    setSaving(true)
    setSaveError(null)
    try {
      const entry = await addPersonalIncome({ userId: user.id, ...form })
      setEntries(prev => [entry, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
      setForm({ amount: '', date: todayStr(), notes: '' })
      setShowForm(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deletePersonalIncome(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setConfirmDel(null)
  }

  return (
    <div className="space-y-6">
      {/* Log button / form */}
      {showForm ? (
        <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Log Take-Home Pay</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount ($)</label>
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="1200.00" className="input" required autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Week of Jan 6" className="input" />
          </div>
          {saveError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{saveError}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setSaveError(null) }}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors">
          <PlusIcon /> Log Take-Home Pay
        </button>
      )}

      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {periods.map((p, i) => (
          <button key={i} onClick={() => setPeriodIdx(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${i === periodIdx ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {!loading && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{periods[periodIdx].label}</p>
              <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(periodTotal)}</p>
              <p className="text-xs text-slate-500 mt-1.5">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</p>
            </div>
            <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-5">
              <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-wider mb-2">Total Earned (All Time)</p>
              <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(allTotal)}</p>
              <p className="text-xs text-slate-500 mt-1.5">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
            </div>
          </div>

          {/* Entry list */}
          {filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl py-12 text-center">
              <p className="text-slate-400 font-medium mb-1">No entries for this period</p>
              <p className="text-slate-500 text-sm">Click "Log Take-Home Pay" to add one.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-800/60">
                {filtered.map(entry => (
                  <div key={entry.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white tabular-nums">{formatCurrency(entry.amount)}</p>
                      {entry.notes && <p className="text-xs text-slate-500 truncate mt-0.5">{entry.notes}</p>}
                    </div>
                    <p className="text-xs text-slate-500 shrink-0 tabular-nums">{entry.date}</p>
                    {confirmDel === entry.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => handleDelete(entry.id)} className="text-xs text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1 rounded-lg transition-colors">Delete</button>
                        <button onClick={() => setConfirmDel(null)} className="text-xs text-slate-400 hover:text-white px-1.5 py-1">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(entry.id)} className="shrink-0 text-slate-600 hover:text-rose-400 transition-colors p-1">
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Expenses Section ──────────────────────────────────────────────────────────

function ExpensesSection({ userId }) {
  const [expenses, setExpenses]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ description: '', amount: '', category: 'Housing', date: todayStr(), recurring: false, frequency: 'monthly' })
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [catFilter, setCatFilter] = useState('all')
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => {
    getPersonalExpenses(userId).then(data => { setExpenses(data); setLoading(false) })
  }, [userId])

  // Monthly recurring commitment total
  const monthlyCommitted = useMemo(
    () => expenses.filter(e => e.recurring).reduce((s, e) => s + monthlyEquiv(e), 0),
    [expenses]
  )

  // This month's expenses
  const tmStart = thisMonthStart()
  const thisMonthTotal = useMemo(
    () => expenses.filter(e => new Date(e.date + 'T00:00:00') >= tmStart).reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    [expenses]
  )

  const allTotal = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)

  const categoryTotals = useMemo(() => {
    const totals = {}
    for (const e of expenses) totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount || 0)
    return totals
  }, [expenses])

  const filtered = catFilter === 'all' ? expenses : expenses.filter(e => e.category === catFilter)

  async function handleAdd(ev) {
    ev.preventDefault()
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    setSaveError(null)
    try {
      const entry = await addPersonalExpense({ userId, ...form })
      setExpenses(prev => [entry, ...prev])
      setForm({ description: '', amount: '', category: 'Housing', date: todayStr(), recurring: false, frequency: 'monthly' })
      setShowForm(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deletePersonalExpense(id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    setConfirmDel(null)
  }

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl px-3 sm:px-5 py-4">
          <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-wider leading-tight mb-1">Monthly Recurring</p>
          <p className="text-xl sm:text-2xl font-black text-white tabular-nums">{formatCurrency(monthlyCommitted)}</p>
          <p className="text-xs text-slate-500 mt-0.5">est. / mo</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 sm:px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight mb-1">This Month</p>
          <p className="text-xl sm:text-2xl font-black text-white tabular-nums">{formatCurrency(thisMonthTotal)}</p>
          <p className="text-xs text-slate-500 mt-0.5">logged</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 sm:px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight mb-1">All Time</p>
          <p className="text-xl sm:text-2xl font-black text-white tabular-nums">{formatCurrency(allTotal)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{expenses.length} entries</p>
        </div>
      </div>

      {/* Add expense */}
      {showForm ? (
        <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Add Expense</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
              <input type="text" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Mortgage, Netflix, Car payment" className="input" required autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount ($)</label>
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" className="input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
              <select value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input">
                {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" required />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.recurring}
                onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))}
                className="w-4 h-4 rounded accent-indigo-500" />
              <span className="text-sm text-slate-300">Recurring</span>
            </label>
            {form.recurring && (
              <select value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="input max-w-[150px]">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>
          {saveError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{saveError}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setSaveError(null) }}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors">
          <PlusIcon /> Add Expense
        </button>
      )}

      {/* Category breakdown */}
      {Object.keys(categoryTotals).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">By Category</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.filter(c => categoryTotals[c.key]).map(cat => (
              <button key={cat.key}
                onClick={() => setCatFilter(f => f === cat.key ? 'all' : cat.key)}
                className={`bg-slate-900 border rounded-xl px-3 py-3 text-left transition-all ${catFilter === cat.key ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-slate-800 hover:border-slate-700'}`}>
                <span className="text-xl mb-1.5 block">{cat.emoji}</span>
                <p className="text-xs text-slate-400 leading-tight mb-0.5">{cat.label}</p>
                <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(categoryTotals[cat.key])}</p>
              </button>
            ))}
          </div>
          {catFilter !== 'all' && (
            <button onClick={() => setCatFilter('all')} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 px-1">
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Expense list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-12 text-center">
          <p className="text-slate-400 font-medium mb-1">No expenses yet</p>
          <p className="text-slate-500 text-sm">Add your first recurring bill or expense above.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-800/60">
            {filtered.map(exp => {
              const cat = EXPENSE_CATEGORIES.find(c => c.key === exp.category) || EXPENSE_CATEGORIES[7]
              return (
                <div key={exp.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
                  <span className="text-lg w-6 text-center shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">{exp.description}</p>
                      {exp.recurring && (
                        <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-1.5 py-0.5 shrink-0">
                          {FREQUENCY_LABELS[exp.frequency] || 'Recurring'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{cat.label} · {exp.date}</p>
                  </div>
                  <p className="text-sm font-semibold text-white tabular-nums shrink-0">{formatCurrency(exp.amount)}</p>
                  {confirmDel === exp.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleDelete(exp.id)} className="text-xs text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1 rounded-lg transition-colors">Delete</button>
                      <button onClick={() => setConfirmDel(null)} className="text-xs text-slate-400 hover:text-white px-1.5 py-1">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(exp.id)} className="shrink-0 text-slate-600 hover:text-rose-400 transition-colors p-1">
                      <TrashIcon />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function PayStat({ label, value, dim }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm sm:text-base font-semibold tabular-nums ${dim ? 'text-rose-400' : 'text-slate-200'}`}>{value}</p>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
