import { useState, useEffect } from 'react'
import {
  getAllRevenue, addRevenue, deleteRevenue,
  getAllExpenses, addExpense, deleteExpense,
} from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'

const SERVICE_TYPES = [
  'Lawn Care', 'Landscaping', 'Cleaning', 'Pressure Washing',
  'Snow Removal', 'Painting', 'Handyman', 'Consulting', 'Other',
]

const EXPENSE_CATEGORIES = ['Equipment', 'Supplies', 'Travel', 'Labor', 'Other']

const WRITEOFF_INFO = {
  Equipment: { schedule: 'Section 179 / Schedule C',  note: 'May qualify for full first-year deduction' },
  Supplies:  { schedule: 'Schedule C — Line 22',       note: 'Fully deductible business supplies' },
  Travel:    { schedule: 'Schedule C — Line 24a',      note: 'Business travel and transportation' },
  Labor:     { schedule: 'Schedule C — Line 26',       note: 'Contract labor and subcontractors' },
  Other:     { schedule: 'Schedule C',                 note: 'General business expenses' },
}

const CAT_COLORS = {
  Equipment: 'bg-blue-500/15 text-blue-400',
  Supplies:  'bg-emerald-500/15 text-emerald-400',
  Travel:    'bg-amber-500/15 text-amber-400',
  Labor:     'bg-purple-500/15 text-purple-400',
  Other:     'bg-slate-600/50 text-slate-300',
}

const TAX_RATE = 0.25
const TODAY = new Date().toISOString().split('T')[0]

function getRange(filter) {
  const now = new Date()
  if (filter === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
  if (filter === 'year')  return { start: new Date(now.getFullYear(), 0, 1), end: now }
  return { start: new Date(0), end: now }
}

function groupAndSum(items, keyField, valField) {
  return items.reduce((acc, item) => {
    acc[item[keyField]] = (acc[item[keyField]] || 0) + item[valField]
    return acc
  }, {})
}

export default function AccountingPage() {
  const [tab, setTab] = useState('overview')
  const [filter, setFilter] = useState('year')
  const [revenue, setRevenue] = useState([])
  const [expenses, setExpenses] = useState([])

  async function load() {
    const [rev, exp] = await Promise.all([getAllRevenue(), getAllExpenses()])
    setRevenue(rev)
    setExpenses(exp)
  }
  useEffect(() => { load() }, [])

  const { start, end } = getRange(filter)
  const filteredRevenue  = revenue.filter(r  => { const d = new Date(r.date);  return d >= start && d <= end })
  const filteredExpenses = expenses.filter(e => { const d = new Date(e.date); return d >= start && d <= end })

  const totalRevenue  = filteredRevenue.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const netProfit     = totalRevenue - totalExpenses

  const TABS    = ['Overview', 'Revenue', 'Expenses', 'Write-offs']
  const TAB_IDS = ['overview', 'revenue', 'expenses', 'writeoffs']
  const FILTERS = [{ id: 'month', label: 'This Month' }, { id: 'year', label: 'This Year' }, { id: 'all', label: 'All Time' }]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Accounting</h1>
          <p className="text-slate-400 mt-1 text-sm">Revenue, expenses, P&amp;L, and tax write-offs</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <SummaryCard label="Total Revenue"      value={formatCurrency(totalRevenue)}  accent="emerald" />
        <SummaryCard label="Total Expenses"     value={formatCurrency(totalExpenses)} accent="rose" />
        <SummaryCard label="Net Profit"         value={formatCurrency(netProfit)}     accent={netProfit >= 0 ? 'emerald' : 'rose'} sub={netProfit >= 0 ? 'Profitable' : 'Net loss'} />
        <SummaryCard label="Est. Tax Write-offs" value={formatCurrency(totalExpenses)} accent="indigo" sub={`~${formatCurrency(totalExpenses * TAX_RATE)} saved`} />
      </div>

      {/* Tabs — scrollable row */}
      <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 border border-slate-800 overflow-x-auto">
        {TABS.map((label, i) => (
          <button key={TAB_IDS[i]} onClick={() => setTab(TAB_IDS[i])}
            className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === TAB_IDS[i] ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview'  && <OverviewTab revenue={filteredRevenue} expenses={filteredExpenses} totalRevenue={totalRevenue} totalExpenses={totalExpenses} netProfit={netProfit} />}
      {tab === 'revenue'   && <RevenueTab  revenue={revenue} onUpdate={load} />}
      {tab === 'expenses'  && <ExpensesTab expenses={expenses} onUpdate={load} />}
      {tab === 'writeoffs' && <WriteoffsTab expenses={filteredExpenses} />}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ revenue, expenses, totalRevenue, totalExpenses, netProfit }) {
  const revenueByService   = groupAndSum(revenue,  'service_type', 'amount')
  const expensesByCategory = groupAndSum(expenses, 'category',     'amount')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
        <h3 className="font-semibold text-white mb-5">Profit &amp; Loss Statement</h3>

        <div className="space-y-2 mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">Revenue</p>
          {Object.keys(revenueByService).length === 0
            ? <p className="text-slate-500 text-sm py-1">No revenue recorded</p>
            : Object.entries(revenueByService).map(([type, amt]) => (
              <div key={type} className="flex justify-between">
                <span className="text-sm text-slate-400">{type}</span>
                <span className="text-sm text-white tabular-nums">{formatCurrency(amt)}</span>
              </div>
            ))
          }
          <div className="flex justify-between pt-2 border-t border-slate-700">
            <span className="text-sm font-semibold text-white">Total Revenue</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">Expenses</p>
          {Object.keys(expensesByCategory).length === 0
            ? <p className="text-slate-500 text-sm py-1">No expenses recorded</p>
            : Object.entries(expensesByCategory).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between">
                <span className="text-sm text-slate-400">{cat}</span>
                <span className="text-sm text-rose-400 tabular-nums">{formatCurrency(amt)}</span>
              </div>
            ))
          }
          <div className="flex justify-between pt-2 border-t border-slate-700">
            <span className="text-sm font-semibold text-white">Total Expenses</span>
            <span className="text-sm font-bold text-rose-400 tabular-nums">{formatCurrency(totalExpenses)}</span>
          </div>
        </div>

        <div className={`flex justify-between items-center py-3 px-4 rounded-xl border ${netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-rose-500/10 border-rose-500/25'}`}>
          <span className="font-bold text-white">Net Profit</span>
          <span className={`text-xl font-bold tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(netProfit)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
          <h3 className="font-semibold text-white mb-4">Revenue by Service</h3>
          {Object.keys(revenueByService).length === 0
            ? <p className="text-slate-500 text-sm">No revenue yet</p>
            : Object.entries(revenueByService).sort(([,a],[,b]) => b-a).map(([type, amt]) => (
              <BarRow key={type} label={type} amount={amt} total={totalRevenue} color="emerald" />
            ))
          }
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
          <h3 className="font-semibold text-white mb-4">Expenses by Category</h3>
          {Object.keys(expensesByCategory).length === 0
            ? <p className="text-slate-500 text-sm">No expenses yet</p>
            : Object.entries(expensesByCategory).sort(([,a],[,b]) => b-a).map(([cat, amt]) => (
              <BarRow key={cat} label={cat} amount={amt} total={totalExpenses} color="rose" />
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Revenue ───────────────────────────────────────────────────────────────────

function RevenueTab({ revenue, onUpdate }) {
  const [form, setForm] = useState({ date: TODAY, client: '', service_type: 'Lawn Care', amount: '' })
  const [error, setError] = useState('')

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Enter a valid amount'); return }
    setError('')
    await addRevenue({ ...form, amount: parseFloat(form.amount) })
    setForm(p => ({ ...p, client: '', amount: '' }))
    onUpdate()
  }

  const total = revenue.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
        <h3 className="font-semibold text-white mb-5">Log Revenue</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <Field label="Date"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} required className="input" /></Field>
          <Field label="Client Name"><input type="text" value={form.client} onChange={e => set('client', e.target.value)} required placeholder="Smith Residence" className="input" /></Field>
          <Field label="Service Type">
            <select value={form.service_type} onChange={e => set('service_type', e.target.value)} className="input">
              {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Amount ($)"><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00" className="input" /></Field>
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-3 sm:py-2.5 text-sm transition-colors">Add Revenue</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-white">Revenue Log</h3>
          <span className="text-sm text-slate-400 tabular-nums">{revenue.length} · {formatCurrency(total)}</span>
        </div>
        {revenue.length === 0
          ? <p className="px-6 py-10 text-center text-slate-500 text-sm">No revenue logged yet.</p>
          : <div className="divide-y divide-slate-800/60">
              {revenue.map(r => (
                <div key={r.id} className="flex items-center px-4 sm:px-6 py-4 gap-3 sm:gap-4 hover:bg-slate-800/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">{r.service_type}</span>
                      <span className="text-xs text-slate-500">{r.date}</span>
                    </div>
                    <p className="text-sm text-white truncate">{r.client}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-emerald-400 tabular-nums text-sm">{formatCurrency(r.amount)}</span>
                    <button onClick={async () => { await deleteRevenue(r.id); onUpdate() }} className="text-slate-600 hover:text-rose-400 transition-all sm:opacity-0 sm:group-hover:opacity-100"><TrashIcon /></button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Expenses ──────────────────────────────────────────────────────────────────

function ExpensesTab({ expenses, onUpdate }) {
  const [form, setForm] = useState({ date: TODAY, category: 'Supplies', description: '', amount: '' })
  const [error, setError] = useState('')

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Enter a valid amount'); return }
    setError('')
    await addExpense({ ...form, amount: parseFloat(form.amount), user_id: 'owner' })
    setForm(p => ({ ...p, description: '', amount: '' }))
    onUpdate()
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
        <h3 className="font-semibold text-white mb-5">Log Expense</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <Field label="Date"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} required className="input" /></Field>
          <Field label="Category">
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description"><input type="text" value={form.description} onChange={e => set('description', e.target.value)} required placeholder="What was it for?" className="input" /></Field>
          <Field label="Amount ($)"><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00" className="input" /></Field>
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-3 sm:py-2.5 text-sm transition-colors">Add Expense</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-white">Expense Log</h3>
          <span className="text-sm text-slate-400 tabular-nums">{expenses.length} · {formatCurrency(total)}</span>
        </div>
        {expenses.length === 0
          ? <p className="px-6 py-10 text-center text-slate-500 text-sm">No expenses logged yet.</p>
          : <div className="divide-y divide-slate-800/60">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center px-4 sm:px-6 py-4 gap-3 sm:gap-4 hover:bg-slate-800/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[exp.category]}`}>{exp.category}</span>
                      <span className="text-xs text-slate-500">{exp.date}</span>
                    </div>
                    <p className="text-sm text-white truncate">{exp.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-white tabular-nums text-sm">{formatCurrency(exp.amount)}</span>
                    <button onClick={async () => { await deleteExpense(exp.id); onUpdate() }} className="text-slate-600 hover:text-rose-400 transition-all sm:opacity-0 sm:group-hover:opacity-100"><TrashIcon /></button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Write-offs ────────────────────────────────────────────────────────────────

function WriteoffsTab({ expenses }) {
  const totalWriteoffs   = expenses.reduce((s, e) => s + e.amount, 0)
  const estimatedSavings = totalWriteoffs * TAX_RATE

  const grouped = EXPENSE_CATEGORIES
    .map(cat => ({
      cat,
      items: expenses.filter(e => e.category === cat),
      total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 sm:px-6 py-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Total Deductible</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-400 tabular-nums">{formatCurrency(totalWriteoffs)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 sm:px-6 py-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Est. Tax Savings</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">{formatCurrency(estimatedSavings)}</p>
          <p className="text-xs text-slate-500 mt-1">At 25% effective rate</p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-slate-900 border border-slate-800 rounded-xl px-4 sm:px-6 py-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Deductible Items</p>
          <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{expenses.length}</p>
        </div>
      </div>

      {grouped.length === 0
        ? <div className="bg-slate-900 rounded-xl border border-slate-800 px-6 py-12 text-center text-slate-500 text-sm">No expenses for this period.</div>
        : grouped.map(({ cat, items, total }) => (
          <div key={cat} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CAT_COLORS[cat]}`}>{cat}</span>
                <span className="text-xs text-slate-400">{WRITEOFF_INFO[cat]?.schedule}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(total)}</p>
                <p className="text-xs text-emerald-400 tabular-nums">~{formatCurrency(total * TAX_RATE)} saved</p>
              </div>
            </div>
            <div className="divide-y divide-slate-800/60">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center px-4 sm:px-6 py-3">
                  <div>
                    <p className="text-sm text-white">{item.description}</p>
                    <p className="text-xs text-slate-500">{item.date}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-300 tabular-nums">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 sm:px-6 py-3 bg-slate-800/40 border-t border-slate-800">
              <p className="text-xs text-slate-400">{WRITEOFF_INFO[cat]?.note}</p>
            </div>
          </div>
        ))
      }

      <p className="text-xs text-slate-500 leading-relaxed">
        * Estimates only. Tax savings calculated at 25% effective rate. Consult a licensed CPA before filing.
        Equipment purchases may require depreciation schedules rather than immediate deduction.
      </p>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent, sub }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 sm:px-5 py-4">
      <p className="text-xs font-medium text-slate-400 mb-1 sm:mb-1.5 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-lg sm:text-xl font-bold tabular-nums ${accent === 'emerald' ? 'text-emerald-400' : accent === 'rose' ? 'text-rose-400' : accent === 'indigo' ? 'text-indigo-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function BarRow({ label, amount, total, color }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-white tabular-nums font-medium">{formatCurrency(amount)}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
