import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { addExpense, deleteExpense, getAllExpenses } from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'

const CATEGORIES = ['Equipment', 'Supplies', 'Travel', 'Labor', 'Other']

const CAT_COLORS = {
  Equipment: 'bg-blue-500/15 text-blue-400',
  Supplies:  'bg-emerald-500/15 text-emerald-400',
  Travel:    'bg-amber-500/15 text-amber-400',
  Labor:     'bg-purple-500/15 text-purple-400',
  Other:     'bg-slate-600/50 text-slate-300',
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Supplies',
    description: '',
    amount: '',
  })
  const [error, setError] = useState('')

  function load() { setExpenses(getAllExpenses()) }
  useEffect(() => { load() }, [])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return }
    setError('')
    await addExpense({ ...form, amount, user_id: user.id })
    setForm(f => ({ ...f, description: '', amount: '' }))
    load()
  }

  async function handleDelete(id) {
    await deleteExpense(id)
    load()
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const byCategory = CATEGORIES
    .map(cat => ({
      cat,
      total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
      count: expenses.filter(e => e.category === cat).length,
    }))
    .filter(c => c.count > 0)

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
        <p className="text-slate-400 mt-1 text-sm">Log and track business expenses by category</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: form + breakdown */}
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h3 className="font-semibold text-white mb-5">Log Expense</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Date">
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  required
                  className="input"
                />
              </Field>

              <Field label="Category">
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className="input"
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Description">
                <input
                  type="text"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  required
                  placeholder="What was it for?"
                  className="input"
                />
              </Field>

              <Field label="Amount ($)">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  required
                  placeholder="0.00"
                  className="input"
                />
              </Field>

              {error && <p className="text-rose-400 text-xs">{error}</p>}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                Add Expense
              </button>
            </form>
          </div>

          {byCategory.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="font-semibold text-white mb-4">By Category</h3>
              <div className="space-y-3">
                {byCategory.map(({ cat, total: catTotal, count }) => (
                  <div key={cat} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{cat}</p>
                      <p className="text-xs text-slate-500">{count} item{count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-indigo-400 tabular-nums">{formatCurrency(catTotal)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
                  <span className="font-semibold text-white text-sm">Total</span>
                  <span className="font-bold text-white tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: expense list */}
        <div className="col-span-2">
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-white">All Expenses</h3>
              <span className="text-sm text-slate-400 tabular-nums">
                {expenses.length} items · {formatCurrency(total)}
              </span>
            </div>

            {expenses.length === 0 ? (
              <p className="px-6 py-12 text-center text-slate-500 text-sm">No expenses logged yet.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {expenses.map(exp => (
                  <div
                    key={exp.id}
                    className="flex items-center px-6 py-4 hover:bg-slate-800/40 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[exp.category]}`}>
                          {exp.category}
                        </span>
                        <span className="text-xs text-slate-500">{exp.date}</span>
                      </div>
                      <p className="text-sm text-white truncate">{exp.description}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-4 shrink-0">
                      <span className="text-base font-semibold text-white tabular-nums">
                        {formatCurrency(exp.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-lg leading-none"
                        title="Delete expense"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
