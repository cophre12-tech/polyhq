import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  getAllRevenue, addRevenue, updateRevenue, deleteRevenue,
  getAllExpenses, addExpense, updateExpense, deleteExpense,
  getServices,
} from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'
import { useAuth } from '../context/AuthContext.jsx'


const EXPENSE_CATEGORIES = ['Equipment', 'Supplies', 'Travel', 'Labor', 'Other']

const WRITEOFF_INFO = {
  Equipment: { schedule: 'Section 179 / Schedule C',  note: 'May qualify for full first-year deduction' },
  Supplies:  { schedule: 'Schedule C — Line 22',       note: 'Fully deductible business supplies' },
  Travel:    { schedule: 'Schedule C — Line 24a',      note: 'Business travel and transportation' },
  Labor:     { schedule: 'Schedule C — Line 26',       note: 'Contract labor and subcontractors' },
  Other:     { schedule: 'Schedule C',                 note: 'General business expenses' },
}

const CAT_COLORS = {
  Equipment: 'bg-raised text-fg-muted',
  Supplies:  'bg-success/15 text-success',
  Travel:    'bg-warning/15 text-warning',
  Labor:     'bg-raised text-fg-muted',
  Other:     'bg-overlay/50 text-fg-muted',
}

const DONUT_COLORS = [1, 2, 3, 4, 5, 6, 7].map(n => `var(--color-chart-${n})`)

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
  const [tab, setTab] = useState('charts')
  const [filter, setFilter] = useState('year')
  const [revenue, setRevenue] = useState([])
  const [expenses, setExpenses] = useState([])
  const [serviceNames, setServiceNames] = useState([])

  async function load() {
    const [rev, exp, svcs] = await Promise.all([getAllRevenue(), getAllExpenses(), getServices()])
    setRevenue(rev)
    setExpenses(exp)
    setServiceNames(svcs.map(s => s.name))
  }
  useEffect(() => { load() }, [])

  const { start, end } = getRange(filter)
  const filteredRevenue  = revenue.filter(r  => { const d = new Date(r.date);  return d >= start && d <= end })
  const filteredExpenses = expenses.filter(e => { const d = new Date(e.date); return d >= start && d <= end })

  const totalRevenue  = filteredRevenue.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const netProfit     = totalRevenue - totalExpenses

  const TABS    = ['Charts', 'Overview', 'Revenue', 'Expenses', 'Write-offs']
  const TAB_IDS = ['charts', 'overview', 'revenue', 'expenses', 'writeoffs']
  const FILTERS = [{ id: 'month', label: 'This Month' }, { id: 'year', label: 'This Year' }, { id: 'all', label: 'All Time' }]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Accounting</h1>
          <p className="text-fg-muted mt-1 text-sm">Revenue, expenses, P&amp;L, and tax write-offs</p>
        </div>
        {tab !== 'charts' && (
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f.id ? 'bg-accent text-fg' : 'bg-raised text-fg-muted hover:bg-overlay'}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab !== 'charts' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <SummaryCard label="Total Revenue"      value={formatCurrency(totalRevenue)}  accent="emerald" />
          <SummaryCard label="Total Expenses"     value={formatCurrency(totalExpenses)} accent="rose" />
          <SummaryCard label="Net Profit"         value={formatCurrency(netProfit)}     accent={netProfit >= 0 ? 'emerald' : 'rose'} sub={netProfit >= 0 ? 'Profitable' : 'Net loss'} />
          <SummaryCard label="Est. Tax Write-offs" value={formatCurrency(totalExpenses)} accent="indigo" sub={`~${formatCurrency(totalExpenses * TAX_RATE)} saved`} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface rounded-xl p-1 border border-line overflow-x-auto">
        {TABS.map((label, i) => (
          <button key={TAB_IDS[i]} onClick={() => setTab(TAB_IDS[i])}
            className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === TAB_IDS[i] ? 'bg-overlay text-fg' : 'text-fg-muted hover:text-fg'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'charts'   && <ChartsTab revenue={revenue} expenses={expenses} />}
      {tab === 'overview' && <OverviewTab revenue={filteredRevenue} expenses={filteredExpenses} totalRevenue={totalRevenue} totalExpenses={totalExpenses} netProfit={netProfit} />}
      {tab === 'revenue'  && <RevenueTab revenue={revenue} serviceNames={serviceNames} onUpdate={load} />}
      {tab === 'expenses' && <ExpensesTab expenses={expenses} onUpdate={load} />}
      {tab === 'writeoffs'&& <WriteoffsTab expenses={filteredExpenses} />}
    </div>
  )
}

// ── Charts ────────────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'var(--color-overlay)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius-lg)', fontSize: '13px', padding: '8px 12px' },
  labelStyle: { color: 'var(--color-fg-muted)', marginBottom: 4, fontSize: '11px', fontFamily: 'var(--font-mono)' },
  itemStyle: { color: 'var(--color-fg)', padding: 0 },
}
const AXIS_TICK = { fill: 'var(--color-fg-subtle)', fontSize: 11, fontFamily: 'var(--font-mono)' }

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  date.setHours(0, 0, 0, 0)
  return date
}

function ChartsTab({ revenue, expenses }) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Totals (all time)
  const totalRevenue  = revenue.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit     = totalRevenue - totalExpenses

  // Bar chart: weekly buckets for current calendar month
  const weeklyMap = revenue
    .filter(r => {
      const d = new Date(r.date + 'T00:00:00')
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    .reduce((acc, r) => {
      const day = new Date(r.date + 'T00:00:00').getDate()
      const key = `Wk ${Math.floor((day - 1) / 7) + 1}`
      acc[key] = (acc[key] || 0) + r.amount
      return acc
    }, {})
  const barData = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5'].map(w => ({
    week: w, revenue: weeklyMap[w] || 0,
  }))
  const hasBarData = barData.some(d => d.revenue > 0)

  // Line chart: weekly revenue over past 12 weeks (≈3 months)
  const thisMonday = getMonday(now)
  const trendData = Array.from({ length: 12 }, (_, i) => {
    const weekStart = new Date(thisMonday)
    weekStart.setDate(thisMonday.getDate() - (11 - i) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    const rev = revenue
      .filter(r => { const d = new Date(r.date + 'T00:00:00'); return d >= weekStart && d <= weekEnd })
      .reduce((s, r) => s + r.amount, 0)
    return {
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: rev,
    }
  })
  const hasTrendData = trendData.some(d => d.revenue > 0)

  // Donut chart: all-time revenue by service type
  const donutData = Object.entries(
    revenue.reduce((acc, r) => {
      acc[r.service_type] = (acc[r.service_type] || 0) + r.amount
      return acc
    }, {})
  ).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))
  const hasDonutData = donutData.length > 0

  function fmtAxis(v) {
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
    return `$${v}`
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryCard label="Total Revenue"  value={formatCurrency(totalRevenue)}  accent="emerald" sub="All time" />
        <SummaryCard label="Total Expenses" value={formatCurrency(totalExpenses)} accent="rose"    sub="All time" />
        <SummaryCard label="Net Profit"     value={formatCurrency(netProfit)}     accent={netProfit >= 0 ? 'emerald' : 'rose'} sub={netProfit >= 0 ? 'Profitable' : 'Net loss'} />
      </div>

      {/* Bar + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line p-5 sm:p-6">
          <h3 className="font-semibold text-fg mb-0.5">Revenue This Month</h3>
          <p className="text-xs text-fg-subtle mb-5">{monthName} — by week</p>
          {hasBarData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barSize={42} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="week" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={46} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  cursor={{ fill: 'var(--color-accent-subtle)' }}
                  formatter={v => [formatCurrency(v), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Donut chart */}
        <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
          <h3 className="font-semibold text-fg mb-0.5">By Service Type</h3>
          <p className="text-xs text-fg-subtle mb-4">All time</p>
          {hasDonutData ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      innerRadius={56}
                      outerRadius={82}
                      dataKey="value"
                      paddingAngle={2}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE.contentStyle}
                      itemStyle={TOOLTIP_STYLE.itemStyle}
                      formatter={(v, name) => [formatCurrency(v), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xs text-fg-subtle mb-0.5">Total</p>
                    <p className="text-base font-semibold text-fg tabular-nums">{formatCurrency(totalRevenue)}</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="mt-3 space-y-1.5">
                {donutData.slice(0, 6).map(({ name, value }, i) => (
                  <div key={name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-fg-muted truncate flex-1">{name}</span>
                    <span className="text-fg-muted tabular-nums font-medium">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Line chart */}
      <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
        <h3 className="font-semibold text-fg mb-0.5">Revenue Trend</h3>
        <p className="text-xs text-fg-subtle mb-5">Weekly — past 3 months</p>
        {hasTrendData ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-accent)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={46} />
              <Tooltip
                {...TOOLTIP_STYLE}
                cursor={{ stroke: 'var(--color-accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
                formatter={v => [formatCurrency(v), 'Revenue']}
              />
              <Line
                dataKey="revenue"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-accent)', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: 'var(--color-accent-hover)', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-56 flex items-center justify-center">
      <p className="text-fg-subtle text-sm">No data yet</p>
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ revenue, expenses, totalRevenue, totalExpenses, netProfit }) {
  const revenueByService   = groupAndSum(revenue,  'service_type', 'amount')
  const expensesByCategory = groupAndSum(expenses, 'category',     'amount')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
        <h3 className="font-semibold text-fg mb-5">Profit &amp; Loss Statement</h3>

        <div className="space-y-2 mb-5">
          <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider pb-1 border-b border-line">Revenue</p>
          {Object.keys(revenueByService).length === 0
            ? <p className="text-fg-subtle text-sm py-1">No revenue recorded</p>
            : Object.entries(revenueByService).map(([type, amt]) => (
              <div key={type} className="flex justify-between">
                <span className="text-sm text-fg-muted">{type}</span>
                <span className="text-sm text-fg tabular-nums">{formatCurrency(amt)}</span>
              </div>
            ))
          }
          <div className="flex justify-between pt-2 border-t border-line">
            <span className="text-sm font-semibold text-fg">Total Revenue</span>
            <span className="text-sm font-semibold text-success tabular-nums">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider pb-1 border-b border-line">Expenses</p>
          {Object.keys(expensesByCategory).length === 0
            ? <p className="text-fg-subtle text-sm py-1">No expenses recorded</p>
            : Object.entries(expensesByCategory).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between">
                <span className="text-sm text-fg-muted">{cat}</span>
                <span className="text-sm text-danger tabular-nums">{formatCurrency(amt)}</span>
              </div>
            ))
          }
          <div className="flex justify-between pt-2 border-t border-line">
            <span className="text-sm font-semibold text-fg">Total Expenses</span>
            <span className="text-sm font-semibold text-danger tabular-nums">{formatCurrency(totalExpenses)}</span>
          </div>
        </div>

        <div className={`flex justify-between items-center py-3 px-4 rounded-xl border ${netProfit >= 0 ? 'bg-success/10 border-success/25' : 'bg-danger/10 border-danger/25'}`}>
          <span className="font-semibold text-fg">Net Profit</span>
          <span className={`text-xl font-semibold tabular-nums ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(netProfit)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
          <h3 className="font-semibold text-fg mb-4">Revenue by Service</h3>
          {Object.keys(revenueByService).length === 0
            ? <p className="text-fg-subtle text-sm">No revenue yet</p>
            : Object.entries(revenueByService).sort(([,a],[,b]) => b-a).map(([type, amt]) => (
              <BarRow key={type} label={type} amount={amt} total={totalRevenue} color="emerald" />
            ))
          }
        </div>
        <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
          <h3 className="font-semibold text-fg mb-4">Expenses by Category</h3>
          {Object.keys(expensesByCategory).length === 0
            ? <p className="text-fg-subtle text-sm">No expenses yet</p>
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

function RevenueTab({ revenue, serviceNames, onUpdate }) {
  const [form, setForm] = useState({ date: TODAY, client: '', service_type: '', amount: '' })
  const [error, setError] = useState('')

  // Keep form default in sync with first available service
  useEffect(() => {
    if (serviceNames.length > 0 && !form.service_type) {
      setForm(p => ({ ...p, service_type: serviceNames[0] }))
    }
  }, [serviceNames])

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
      <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
        <h3 className="font-semibold text-fg mb-5">Log Revenue</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <Field label="Date"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} required className="input" /></Field>
          <Field label="Client Name"><input type="text" value={form.client} onChange={e => set('client', e.target.value)} required placeholder="Smith Residence" className="input" /></Field>
          <Field label="Service Type">
            <select value={form.service_type} onChange={e => set('service_type', e.target.value)} className="input">
              {serviceNames.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Amount ($)"><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00" className="input" /></Field>
          {error && <p className="text-danger text-xs">{error}</p>}
          <button type="submit" className="btn-primary w-full py-3 sm:py-2.5 text-sm">Add Revenue</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-surface rounded-xl border border-line overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-line flex justify-between items-center">
          <h3 className="font-semibold text-fg">Revenue Log</h3>
          <span className="text-sm text-fg-muted tabular-nums">{revenue.length} · {formatCurrency(total)}</span>
        </div>
        {revenue.length === 0
          ? <p className="px-6 py-10 text-center text-fg-subtle text-sm">No revenue logged yet.</p>
          : <div className="divide-y divide-line">
              {revenue.map(r => (
                <div key={r.id} className="flex items-center px-4 sm:px-6 py-4 gap-3 sm:gap-4 hover:bg-raised/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <select
                        defaultValue={r.service_type}
                        onChange={async e => {
                          await updateRevenue(r.id, { service_type: e.target.value })
                          onUpdate()
                        }}
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/15 text-success border border-transparent hover:border-success/40 focus:border-success focus:outline-none cursor-pointer transition-colors appearance-none"
                      >
                        {/* Keep current value selectable even if removed from settings */}
                        {[...new Set([r.service_type, ...serviceNames])].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {r.source === 'job'
                        ? <span className="text-2xs font-semibold text-fg-muted bg-raised border border-line rounded-full px-1.5 py-0.5 leading-none">Job</span>
                        : <span className="text-2xs font-semibold text-fg-subtle bg-raised border border-line rounded-full px-1.5 py-0.5 leading-none">Manual</span>
                      }
                      <span className="text-xs text-fg-subtle">{r.date}</span>
                    </div>
                    <p className="text-sm text-fg truncate">{r.client}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-success tabular-nums text-sm">{formatCurrency(r.amount)}</span>
                    <button onClick={async () => { await deleteRevenue(r.id); onUpdate() }} className="text-fg-subtle hover:text-danger transition-all sm:opacity-0 sm:group-hover:opacity-100"><TrashIcon /></button>
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
  const { user } = useAuth()
  const [form, setForm] = useState({ date: TODAY, category: 'Supplies', description: '', amount: '' })
  const [error, setError] = useState('')

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Enter a valid amount'); return }
    setError('')
    await addExpense({ ...form, amount: parseFloat(form.amount), user_id: user.id })
    setForm(p => ({ ...p, description: '', amount: '' }))
    onUpdate()
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
        <h3 className="font-semibold text-fg mb-5">Log Expense</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <Field label="Date"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} required className="input" /></Field>
          <Field label="Category">
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description"><input type="text" value={form.description} onChange={e => set('description', e.target.value)} required placeholder="What was it for?" className="input" /></Field>
          <Field label="Amount ($)"><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00" className="input" /></Field>
          {error && <p className="text-danger text-xs">{error}</p>}
          <button type="submit" className="btn-primary w-full py-3 sm:py-2.5 text-sm">Add Expense</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-surface rounded-xl border border-line overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-line flex justify-between items-center">
          <h3 className="font-semibold text-fg">Expense Log</h3>
          <span className="text-sm text-fg-muted tabular-nums">{expenses.length} · {formatCurrency(total)}</span>
        </div>
        {expenses.length === 0
          ? <p className="px-6 py-10 text-center text-fg-subtle text-sm">No expenses logged yet.</p>
          : <div className="divide-y divide-line">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center px-4 sm:px-6 py-4 gap-3 sm:gap-4 hover:bg-raised/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[exp.category]}`}>{exp.category}</span>
                      <input
                        type="date"
                        defaultValue={exp.date}
                        onBlur={async e => {
                          if (e.target.value && e.target.value !== exp.date) {
                            await updateExpense(exp.id, { date: e.target.value })
                            onUpdate()
                          }
                        }}
                        className="text-xs text-fg-muted bg-transparent border-b border-transparent hover:border-line-strong focus:border-accent focus:outline-none cursor-pointer transition-colors"
                      />
                    </div>
                    <p className="text-sm text-fg truncate">{exp.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-fg tabular-nums text-sm">{formatCurrency(exp.amount)}</span>
                    <button onClick={async () => { await deleteExpense(exp.id); onUpdate() }} className="text-fg-subtle hover:text-danger transition-all sm:opacity-0 sm:group-hover:opacity-100"><TrashIcon /></button>
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
        <div className="bg-surface border border-line rounded-xl px-4 sm:px-6 py-5">
          <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">Total Deductible</p>
          <p className="text-xl sm:text-2xl font-semibold text-fg tabular-nums">{formatCurrency(totalWriteoffs)}</p>
        </div>
        <div className="bg-surface border border-line rounded-xl px-4 sm:px-6 py-5">
          <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">Est. Tax Savings</p>
          <p className="text-xl sm:text-2xl font-semibold text-success tabular-nums">{formatCurrency(estimatedSavings)}</p>
          <p className="text-xs text-fg-subtle mt-1">At 25% effective rate</p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-surface border border-line rounded-xl px-4 sm:px-6 py-5">
          <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">Deductible Items</p>
          <p className="text-xl sm:text-2xl font-semibold text-fg tabular-nums">{expenses.length}</p>
        </div>
      </div>

      {grouped.length === 0
        ? <div className="bg-surface rounded-xl border border-line px-6 py-12 text-center text-fg-subtle text-sm">No expenses for this period.</div>
        : grouped.map(({ cat, items, total }) => (
          <div key={cat} className="bg-surface rounded-xl border border-line overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CAT_COLORS[cat]}`}>{cat}</span>
                <span className="text-xs text-fg-muted">{WRITEOFF_INFO[cat]?.schedule}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(total)}</p>
                <p className="text-xs text-success tabular-nums">~{formatCurrency(total * TAX_RATE)} saved</p>
              </div>
            </div>
            <div className="divide-y divide-line">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center px-4 sm:px-6 py-3">
                  <div>
                    <p className="text-sm text-fg">{item.description}</p>
                    <p className="text-xs text-fg-subtle">{item.date}</p>
                  </div>
                  <span className="text-sm font-medium text-fg-muted tabular-nums">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 sm:px-6 py-3 bg-raised/40 border-t border-line">
              <p className="text-xs text-fg-muted">{WRITEOFF_INFO[cat]?.note}</p>
            </div>
          </div>
        ))
      }

      <p className="text-xs text-fg-subtle leading-relaxed">
        * Estimates only. Tax savings calculated at 25% effective rate. Consult a licensed CPA before filing.
        Equipment purchases may require depreciation schedules rather than immediate deduction.
      </p>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent, sub }) {
  return (
    <div className="bg-surface border border-line rounded-xl px-4 sm:px-5 py-4">
      <p className="font-mono text-2xs font-medium text-fg-muted mb-1 sm:mb-1.5 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-lg sm:text-xl font-semibold tabular-nums ${accent === 'emerald' ? 'text-success' : accent === 'rose' ? 'text-danger' : accent === 'indigo' ? 'text-fg' : 'text-fg'}`}>{value}</p>
      {sub && <p className="text-xs text-fg-subtle mt-0.5">{sub}</p>}
    </div>
  )
}

function BarRow({ label, amount, total, color }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-fg-muted">{label}</span>
        <span className="text-fg tabular-nums font-medium">{formatCurrency(amount)}</span>
      </div>
      <div className="h-1.5 bg-overlay rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color === 'emerald' ? 'bg-success' : 'bg-danger'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-fg-muted mb-1.5">{label}</label>
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
