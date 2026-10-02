import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getAllRevenue, getAllExpenses, getBusinessSettings, getOwners } from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const STRUCTURES = [
  {
    id: 'schedule_c',
    label: 'Single-Member LLC / Sole Proprietor',
    sub: 'Schedule C (Form 1040)',
    icon: '📋',
  },
  {
    id: 'form_1065',
    label: 'Multi-Member LLC / Partnership',
    sub: 'Form 1065 + Schedule K-1',
    icon: '🤝',
  },
  {
    id: 'form_1120s',
    label: 'S-Corporation',
    sub: 'Form 1120-S',
    icon: '🏢',
  },
]

// Schedule C line mappings for PolyHQ expense categories
const SCHED_C_LINES = {
  Equipment: { line: '12 / 179', label: 'Machinery & Equipment (Section 179)' },
  Supplies:  { line: '22',       label: 'Supplies' },
  Travel:    { line: '24a/b',    label: 'Travel & Transportation' },
  Labor:     { line: '26',       label: 'Contract Labor / Wages' },
  Other:     { line: '28',       label: 'Other Business Expenses' },
}

const QUARTER_DUE_DATES = [
  { q: 'Q1', income: 'Jan 1 – Mar 31', due: 'Apr 15' },
  { q: 'Q2', income: 'Apr 1 – May 31', due: 'Jun 16' },
  { q: 'Q3', income: 'Jun 1 – Aug 31', due: 'Sep 15' },
  { q: 'Q4', income: 'Sep 1 – Dec 31', due: 'Jan 15 (next yr)' },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function filterByYear(records, year) {
  return records.filter(r => r.date && r.date.startsWith(String(year)))
}

function sumBy(records, key = 'amount') {
  return records.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0)
}

function groupBy(records, key) {
  return records.reduce((acc, r) => {
    const k = r[key] || 'Other'
    acc[k] = (acc[k] || [])
    acc[k].push(r)
    return acc
  }, {})
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TaxFormsPage() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const [year, setYear]           = useState(currentYear)
  const [structure, setStructure] = useState(() => {
    return localStorage.getItem('polyhq_tax_structure') || null
  })
  const [revenue, setRevenue]     = useState([])
  const [expenses, setExpenses]   = useState([])
  const [bizName, setBizName]     = useState('')
  const [owners, setOwners]       = useState([])
  const [loading, setLoading]     = useState(true)
  const printRef = useRef(null)

  useEffect(() => {
    Promise.all([
      getAllRevenue(),
      getAllExpenses(),
      getBusinessSettings(),
      getOwners(),
    ]).then(([rev, exp, biz, ownrs]) => {
      setRevenue(rev)
      setExpenses(exp)
      setBizName(biz?.name || 'My Business')
      setOwners(ownrs)
      setLoading(false)
    })
  }, [])

  function pickStructure(id) {
    setStructure(id)
    if (id) {
      localStorage.setItem('polyhq_tax_structure', id)
    } else {
      localStorage.removeItem('polyhq_tax_structure')
    }
  }

  function handlePrint() {
    window.print()
  }

  const yearRevenue  = useMemo(() => filterByYear(revenue,  year), [revenue,  year])
  const yearExpenses = useMemo(() => filterByYear(expenses, year), [expenses, year])

  const grossRevenue  = sumBy(yearRevenue)
  const totalExpenses = sumBy(yearExpenses)
  const netProfit     = grossRevenue - totalExpenses

  return (
    <>
      {/* Print styles — injected at top of page, scoped to print media */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #tax-print-root { display: block !important; }
          #tax-print-root { position: fixed; inset: 0; background: white; z-index: 9999; padding: 24px; color: #000; font-family: Georgia, serif; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .form-line { display: flex; justify-content: space-between; border-bottom: 1px solid #ccc; padding: 4px 0; font-size: 11pt; }
          .form-section-title { font-weight: bold; font-size: 13pt; margin-top: 18px; margin-bottom: 6px; border-bottom: 2px solid #000; }
          .print-header { text-align: center; margin-bottom: 24px; }
          .print-disclaimer { margin-top: 24px; font-size: 9pt; color: #555; border-top: 1px solid #ccc; padding-top: 8px; }
          .k1-card { border: 1px solid #999; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
        }
        @media screen { .print-only { display: none !important; } }
      `}</style>

      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl no-print" ref={printRef}>
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-fg mb-1">Tax Forms</h1>
            <p className="text-fg-muted text-sm">Estimated figures for tax preparation — confirm with your CPA before filing.</p>
          </div>
          {structure && (
            <div className="flex items-center gap-2 no-print">
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                className="input text-sm py-2 w-28">
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear - 1}>{currentYear - 1}</option>
                <option value={currentYear - 2}>{currentYear - 2}</option>
              </select>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 bg-raised hover:bg-overlay text-fg font-semibold rounded-xl px-4 py-2 text-sm transition-colors border border-line">
                <PrintIcon /> Export PDF
              </button>
            </div>
          )}
        </div>

        {/* Disclaimer banner */}
        <div className="mb-6 flex items-start gap-3 bg-warning/10 border border-warning/25 rounded-xl px-4 py-3.5">
          <span className="text-warning mt-0.5 shrink-0">⚠️</span>
          <p className="text-warning text-sm leading-relaxed">
            <span className="font-semibold">For estimation only.</span> These calculations are based on data entered in PolyHQ and may not reflect all deductions, credits, or tax law changes.
            Consult a licensed CPA or tax professional before filing any return.
          </p>
        </div>

        {/* Structure picker */}
        {!structure ? (
          <StructurePicker onPick={pickStructure} />
        ) : (
          <>
            {/* Change structure link */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-4 py-2.5">
                <span className="text-base">{STRUCTURES.find(s => s.id === structure)?.icon}</span>
                <div>
                  <p className="text-xs text-fg-subtle leading-none mb-0.5">Business Structure</p>
                  <p className="text-sm font-semibold text-fg">{STRUCTURES.find(s => s.id === structure)?.label}</p>
                </div>
              </div>
              <button onClick={() => pickStructure(null)}
                className="text-xs text-fg underline-offset-4 hover:underline transition-colors no-print">
                Change
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-14">
                <div className="w-6 h-6 border-2 border-line-strong border-t-fg rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Running net profit */}
                <NetProfitBanner
                  year={year}
                  gross={grossRevenue}
                  expenses={totalExpenses}
                  net={netProfit}
                />

                {structure === 'schedule_c' && (
                  <ScheduleCView
                    year={year}
                    bizName={bizName}
                    ownerName={user?.name || ''}
                    grossRevenue={grossRevenue}
                    yearExpenses={yearExpenses}
                    netProfit={netProfit}
                  />
                )}

                {structure === 'form_1065' && (
                  <Form1065View
                    year={year}
                    bizName={bizName}
                    grossRevenue={grossRevenue}
                    yearExpenses={yearExpenses}
                    netProfit={netProfit}
                    owners={owners}
                  />
                )}

                {structure === 'form_1120s' && (
                  <Form1120SView
                    year={year}
                    bizName={bizName}
                    grossRevenue={grossRevenue}
                    yearExpenses={yearExpenses}
                    netProfit={netProfit}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Printable version — hidden on screen, visible in print */}
      <div id="tax-print-root" style={{ display: 'none' }}>
        {structure && !loading && (
          <PrintableForm
            structure={structure}
            year={year}
            bizName={bizName}
            grossRevenue={grossRevenue}
            yearExpenses={yearExpenses}
            netProfit={netProfit}
            owners={owners}
          />
        )}
      </div>
    </>
  )
}

// ── Structure Picker ──────────────────────────────────────────────────────────

function StructurePicker({ onPick }) {
  return (
    <div>
      <p className="text-sm font-semibold text-fg mb-4">What is your business structure?</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STRUCTURES.map(s => (
          <button key={s.id} onClick={() => onPick(s.id)}
            className="bg-surface border border-line hover:border-line-strong hover:bg-raised/80 rounded-xl p-5 text-left transition-all group">
            <span className="text-3xl mb-3 block">{s.icon}</span>
            <p className="text-sm font-semibold text-fg mb-1 group-hover:text-fg transition-colors">{s.label}</p>
            <p className="text-xs text-fg-subtle">{s.sub}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Net Profit Banner ─────────────────────────────────────────────────────────

function NetProfitBanner({ year, gross, expenses, net }) {
  const isProfit = net >= 0
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 sm:p-6 mb-8">
      <p className="font-mono text-2xs font-medium text-fg-subtle uppercase tracking-wider mb-4">
        {year} Running Summary
      </p>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-fg-subtle mb-1">Gross Revenue</p>
          <p className="text-xl sm:text-2xl font-semibold text-success tabular-nums">{formatCurrency(gross)}</p>
        </div>
        <div>
          <p className="text-xs text-fg-subtle mb-1">Total Expenses</p>
          <p className="text-xl sm:text-2xl font-semibold text-danger tabular-nums">−{formatCurrency(expenses)}</p>
        </div>
        <div>
          <p className="text-xs text-fg-subtle mb-1">Net {isProfit ? 'Profit' : 'Loss'}</p>
          <p className={`text-xl sm:text-2xl font-semibold tabular-nums ${isProfit ? 'text-fg' : 'text-danger'}`}>
            {formatCurrency(net)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Schedule C View ───────────────────────────────────────────────────────────

function ScheduleCView({ year, bizName, ownerName, grossRevenue, yearExpenses, netProfit }) {
  const expensesByCategory = useMemo(() => groupBy(yearExpenses, 'category'), [yearExpenses])

  const categorySums = useMemo(() => {
    const out = {}
    for (const [cat, items] of Object.entries(expensesByCategory)) {
      out[cat] = sumBy(items)
    }
    return out
  }, [expensesByCategory])

  const totalExpenses = Object.values(categorySums).reduce((s, v) => s + v, 0)

  // Self-employment tax
  const seEarnings   = Math.max(0, netProfit) * 0.9235
  const seTax        = seEarnings * 0.153
  const seDeductible = seTax / 2
  const agi          = netProfit - seDeductible

  // Estimated total tax (SE + ~22% federal income bracket, simplified)
  const estimatedIncomeTax = Math.max(0, agi) * 0.22
  const estimatedTotalTax  = seTax + estimatedIncomeTax
  const quarterlyPayment   = estimatedTotalTax / 4

  return (
    <div className="space-y-6">
      {/* Part I — Gross Income */}
      <FormSection
        title="Part I — Gross Income"
        badge="Schedule C"
        lines={[
          { line: '1', label: 'Gross receipts or sales', value: grossRevenue },
          { line: '2', label: 'Returns and allowances', value: 0, dim: true },
          { line: '3', label: 'Subtract line 2 from line 1', value: grossRevenue, bold: true },
          { line: '4', label: 'Cost of goods sold (Schedule C-EZ)', value: 0, dim: true },
          { line: '7', label: 'Gross income (line 3 minus line 4)', value: grossRevenue, bold: true, highlight: true },
        ]}
      />

      {/* Part II — Expenses */}
      <FormSection
        title="Part II — Expenses"
        badge="Schedule C"
        lines={[
          ...Object.entries(SCHED_C_LINES).map(([cat, info]) => ({
            line: info.line,
            label: info.label,
            value: categorySums[cat] || 0,
            dim: !categorySums[cat],
          })),
          { line: '28', label: 'Total expenses (sum of all lines)', value: totalExpenses, bold: true },
        ]}
        note="Employee payroll costs (W-2 wages) are tracked separately in Payroll — add those to Line 26 before filing."
      />

      {/* Net Profit */}
      <FormSection
        title="Part II — Net Profit or Loss"
        badge="Schedule C"
        lines={[
          { line: '31', label: 'Net profit or (loss). Subtract expenses from gross income.', value: netProfit, bold: true, highlight: true, loss: netProfit < 0 },
        ]}
      />

      {/* Self-Employment Tax */}
      <SEtaxSection
        netProfit={netProfit}
        seEarnings={seEarnings}
        seTax={seTax}
        seDeductible={seDeductible}
      />

      {/* Quarterly Estimated Payments */}
      <QuarterlySection
        year={year}
        estimatedIncomeTax={estimatedIncomeTax}
        seTax={seTax}
        totalTax={estimatedTotalTax}
        quarterlyPayment={quarterlyPayment}
      />
    </div>
  )
}

// ── Form 1065 View ────────────────────────────────────────────────────────────

function Form1065View({ year, bizName, grossRevenue, yearExpenses, netProfit, owners }) {
  const totalExpenses = sumBy(yearExpenses)

  // Default split: equal among all owners
  const [splits, setSplits] = useState(() => {
    const base = owners.length > 0 ? Math.floor(100 / owners.length) : 100
    const rem  = owners.length > 0 ? 100 - base * owners.length : 0
    return owners.reduce((acc, o, i) => {
      acc[o.id] = i === 0 ? base + rem : base
      return acc
    }, {})
  })

  const totalPct = Object.values(splits).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const pctError = Math.abs(totalPct - 100) > 0.01

  const expensesByCategory = useMemo(() => {
    const out = {}
    const byCat = groupBy(yearExpenses, 'category')
    for (const [cat, items] of Object.entries(byCat)) out[cat] = sumBy(items)
    return out
  }, [yearExpenses])

  function setOwnerSplit(id, val) {
    setSplits(s => ({ ...s, [id]: parseFloat(val) || 0 }))
  }

  return (
    <div className="space-y-6">
      {/* Form 1065 Overview */}
      <FormSection
        title="Form 1065 — U.S. Return of Partnership Income"
        badge="Form 1065"
        lines={[
          { line: '1a', label: 'Gross receipts or sales',    value: grossRevenue },
          { line: '2',  label: 'Cost of goods sold',          value: 0, dim: true },
          { line: '3',  label: 'Gross profit',                value: grossRevenue, bold: true },
          { line: '4–12', label: 'Other income (see return)', value: 0, dim: true },
          { line: '13', label: 'Total income / (loss)',       value: grossRevenue, bold: true, highlight: true },
        ]}
      />

      <FormSection
        title="Part I — Deductions"
        badge="Form 1065"
        lines={[
          ...Object.entries(SCHED_C_LINES).map(([cat, info]) => ({
            line: info.line,
            label: info.label,
            value: expensesByCategory[cat] || 0,
            dim: !expensesByCategory[cat],
          })),
          { line: '22', label: 'Total deductions', value: totalExpenses, bold: true },
          { line: '23', label: 'Ordinary business income / (loss)', value: netProfit, bold: true, highlight: true, loss: netProfit < 0 },
        ]}
        note="Add partner guaranteed payments and other adjustments before filing Form 1065."
      />

      {/* K-1 Breakdown */}
      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-3">
          <span className="text-xs font-semibold text-fg-muted bg-raised border border-line rounded-md px-2 py-0.5 shrink-0">Schedule K-1</span>
          <h3 className="text-sm font-semibold text-fg">Partner Distributive Share — Set Ownership %</h3>
        </div>

        {owners.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-fg-muted text-sm">No partners found. Add co-owners in the Crew page.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-line">
              {owners.map(o => {
                const pct   = parseFloat(splits[o.id]) || 0
                const share = netProfit * (pct / 100)
                return (
                  <div key={o.id} className="px-5 py-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-overlay border border-line flex items-center justify-center text-fg text-sm font-semibold shrink-0 mt-0.5">
                        {o.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-fg">{o.name}</p>
                            <p className="text-xs text-fg-subtle">{o.email} · {o.role}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="text-xs text-fg-muted">Ownership %</label>
                            <input
                              type="number" min="0" max="100" step="0.1"
                              value={splits[o.id] ?? ''}
                              onChange={e => setOwnerSplit(o.id, e.target.value)}
                              className="input w-20 py-1 text-sm text-center"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 bg-raised/50 rounded-lg px-3 py-2.5">
                          <K1Line label="Ownership" value={`${pct.toFixed(1)}%`} />
                          <K1Line label="Share of Revenue" value={formatCurrency(grossRevenue * pct / 100)} />
                          <K1Line label={`Share of ${netProfit >= 0 ? 'Profit' : 'Loss'}`} value={formatCurrency(Math.abs(share))} color={share >= 0 ? 'text-success' : 'text-danger'} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {pctError && (
              <div className="mx-5 mb-4 mt-1 bg-danger/10 border border-danger/25 rounded-lg px-3 py-2 text-xs text-danger">
                Ownership percentages total {totalPct.toFixed(1)}% — must equal 100% before filing.
              </div>
            )}

            <div className="px-5 py-4 border-t border-line bg-raised/30 flex justify-between items-center">
              <p className="text-xs font-semibold text-fg-muted">Total partnership income / (loss)</p>
              <p className={`text-sm font-semibold tabular-nums ${netProfit >= 0 ? 'text-fg' : 'text-danger'}`}>{formatCurrency(netProfit)}</p>
            </div>
          </>
        )}
      </div>

      <DisclaimerNote extra="Each partner reports their K-1 share on their personal Form 1040 (Schedule E). Guaranteed payments to partners are deductible by the partnership and taxable to the partner." />
    </div>
  )
}

// ── Form 1120-S View ──────────────────────────────────────────────────────────

function Form1120SView({ year, bizName, grossRevenue, yearExpenses, netProfit }) {
  const totalExpenses = sumBy(yearExpenses)
  const expensesByCategory = useMemo(() => {
    const out = {}
    const byCat = groupBy(yearExpenses, 'category')
    for (const [cat, items] of Object.entries(byCat)) out[cat] = sumBy(items)
    return out
  }, [yearExpenses])

  // S-Corp: ordinary income passes through to shareholders via Schedule K-1
  // No entity-level federal income tax (pass-through)
  // Built-in gains tax may apply if converted from C-Corp

  return (
    <div className="space-y-6">
      <FormSection
        title="Page 1 — Income"
        badge="Form 1120-S"
        lines={[
          { line: '1a', label: 'Gross receipts or sales',       value: grossRevenue },
          { line: '2',  label: 'Cost of goods sold',             value: 0, dim: true },
          { line: '3',  label: 'Gross profit',                   value: grossRevenue, bold: true },
          { line: '4',  label: 'Net gain / loss (Form 4797)',    value: 0, dim: true },
          { line: '5',  label: 'Other income (loss)',            value: 0, dim: true },
          { line: '6',  label: 'Total income / (loss)',          value: grossRevenue, bold: true, highlight: true },
        ]}
      />

      <FormSection
        title="Page 1 — Deductions"
        badge="Form 1120-S"
        lines={[
          ...Object.entries(SCHED_C_LINES).map(([cat, info]) => ({
            line: info.line,
            label: info.label,
            value: expensesByCategory[cat] || 0,
            dim: !expensesByCategory[cat],
          })),
          { line: '20', label: 'Total deductions',              value: totalExpenses, bold: true },
          { line: '21', label: 'Ordinary business income / (loss)', value: netProfit, bold: true, highlight: true, loss: netProfit < 0 },
        ]}
        note="Officer compensation (Line 7) and employee wages (Line 8) must be added separately — ensure reasonable compensation for officer-shareholders."
      />

      {/* Pass-through note */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <p className="text-sm font-semibold text-fg mb-2">S-Corporation Pass-Through</p>
        <p className="text-sm text-fg-muted leading-relaxed">
          An S-Corp pays <span className="text-fg font-medium">no federal income tax at the entity level</span> (with limited exceptions).
          The <span className="text-fg font-medium">{formatCurrency(netProfit)}</span> ordinary income passes through to shareholders
          via Schedule K-1 and is reported on each shareholder's personal Form 1040.
          Shareholders who are also employees must receive reasonable W-2 compensation subject to payroll taxes.
        </p>
      </div>

      <FormSection
        title="Schedule K — Shareholders' Pro-Rata Share Items"
        badge="Form 1120-S"
        lines={[
          { line: '1', label: 'Ordinary business income / (loss)', value: netProfit, bold: true },
          { line: '5a', label: 'Ordinary dividends',               value: 0, dim: true },
          { line: '16a', label: 'Tax-exempt interest income',      value: 0, dim: true },
        ]}
        note="Each shareholder's K-1 percentage is determined by their share of stock. Update shareholder ownership in Crew → Co-Owners before preparing K-1s."
      />

      <DisclaimerNote extra="S-Corporation shareholders must file Form 2553 to elect S status. Built-in gains tax applies if the corporation converted from a C-Corp within the past 5 years." />
    </div>
  )
}

// ── SE Tax Section ────────────────────────────────────────────────────────────

function SEtaxSection({ netProfit, seEarnings, seTax, seDeductible }) {
  if (netProfit <= 0) return null
  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <span className="text-xs font-semibold text-warning bg-warning/10 border border-warning/20 rounded-md px-2 py-0.5 shrink-0">Schedule SE</span>
        <h3 className="text-sm font-semibold text-fg">Self-Employment Tax Calculator</h3>
      </div>
      <div className="px-5 py-4 space-y-1">
        <FormLineRow line="1"   label="Net profit from Schedule C"                             value={formatCurrency(netProfit)} />
        <FormLineRow line="2"   label="Multiply by 92.35% (net earnings subject to SE tax)"   value={formatCurrency(seEarnings)} />
        <FormLineRow line="3"   label="Self-employment tax (15.3%)"                            value={formatCurrency(seTax)} bold />
        <FormLineRow line="4"   label="Deductible half of SE tax (on Form 1040)"               value={formatCurrency(seDeductible)} dim />
        <div className="pt-3 mt-3 border-t border-line">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-fg-muted">Breakdown: 12.4% Social Security + 2.9% Medicare</p>
              <p className="text-xs text-fg-subtle mt-0.5">Social Security portion applies to first $168,600 of net earnings (2024)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Quarterly Estimated Payments ──────────────────────────────────────────────

function QuarterlySection({ year, estimatedIncomeTax, seTax, totalTax, quarterlyPayment }) {
  if (totalTax <= 0) return null
  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <span className="text-xs font-semibold text-fg-muted bg-raised border border-line rounded-md px-2 py-0.5 shrink-0">Form 1040-ES</span>
        <h3 className="text-sm font-semibold text-fg">Quarterly Estimated Tax Payments — {year}</h3>
      </div>
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <div className="bg-raised/50 rounded-lg px-3 py-2.5 text-center">
            <p className="text-xs text-fg-subtle mb-1">Est. Income Tax</p>
            <p className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(estimatedIncomeTax)}</p>
            <p className="text-2xs text-fg-subtle">~22% federal bracket</p>
          </div>
          <div className="bg-raised/50 rounded-lg px-3 py-2.5 text-center">
            <p className="text-xs text-fg-subtle mb-1">SE Tax</p>
            <p className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(seTax)}</p>
            <p className="text-2xs text-fg-subtle">15.3% × 92.35%</p>
          </div>
          <div className="bg-raised/50 rounded-lg px-3 py-2.5 text-center">
            <p className="text-xs text-fg-subtle mb-1">Total Est. Tax</p>
            <p className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(totalTax)}</p>
          </div>
          <div className="bg-raised border border-line rounded-lg px-3 py-2.5 text-center">
            <p className="text-xs text-fg-muted mb-1">Each Payment</p>
            <p className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(quarterlyPayment)}</p>
            <p className="text-2xs text-fg-subtle">÷ 4 quarters</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {QUARTER_DUE_DATES.map(q => (
            <div key={q.q} className="flex items-center gap-3 bg-raised/40 rounded-lg px-3 py-2.5">
              <span className="text-xs font-semibold text-fg-muted w-6 shrink-0">{q.q}</span>
              <p className="text-sm text-fg-muted flex-1">Income {q.income}</p>
              <p className="text-xs text-fg-subtle">Due <span className="text-fg font-medium">{q.due}</span></p>
              <p className="text-sm font-semibold text-fg tabular-nums shrink-0">{formatCurrency(quarterlyPayment)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-fg-subtle mt-3">Pay via IRS Direct Pay at irs.gov or mail Form 1040-ES.</p>
      </div>
    </div>
  )
}

// ── Shared: Form Section ──────────────────────────────────────────────────────

function FormSection({ title, badge, lines, note }) {
  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        {badge && (
          <span className="text-xs font-semibold text-fg-muted bg-raised border border-line rounded-md px-2 py-0.5 shrink-0">
            {badge}
          </span>
        )}
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-1">
        {lines.map((l, i) => (
          <FormLineRow key={i}
            line={l.line}
            label={l.label}
            value={l.value !== undefined ? formatCurrency(l.value) : undefined}
            bold={l.bold}
            dim={l.dim}
            highlight={l.highlight}
            loss={l.loss}
          />
        ))}
      </div>
      {note && (
        <div className="px-5 pb-4">
          <p className="text-xs text-warning/80 bg-warning/5 border border-warning/15 rounded-lg px-3 py-2">
            ✎ {note}
          </p>
        </div>
      )}
    </div>
  )
}

function FormLineRow({ line, label, value, bold, dim, highlight, loss }) {
  return (
    <div className={`flex items-start gap-3 py-1.5 rounded-lg px-2 ${highlight ? (loss ? 'bg-danger/5' : 'bg-success/5') : ''}`}>
      {line && (
        <span className="text-2xs font-mono text-fg-subtle mt-0.5 w-10 shrink-0 leading-5">L{line}</span>
      )}
      <p className={`flex-1 text-sm ${dim ? 'text-fg-subtle' : bold ? 'text-fg font-semibold' : 'text-fg-muted'}`}>
        {label}
      </p>
      {value !== undefined && (
        <p className={`text-sm tabular-nums shrink-0 ${
          highlight
            ? (loss ? 'text-danger font-semibold' : 'text-success font-semibold')
            : dim ? 'text-fg-subtle'
            : bold ? 'text-fg font-semibold'
            : 'text-fg-muted'
        }`}>
          {value}
        </p>
      )}
    </div>
  )
}

function K1Line({ label, value, color = 'text-fg' }) {
  return (
    <div>
      <p className="text-2xs text-fg-subtle mb-0.5">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function DisclaimerNote({ extra }) {
  return (
    <p className="text-xs text-fg-subtle leading-relaxed px-1">
      ⚠ For estimation only — consult a licensed CPA before filing.
      {extra && ` ${extra}`}
    </p>
  )
}

// ── Printable Version ─────────────────────────────────────────────────────────

function PrintableForm({ structure, year, bizName, grossRevenue, yearExpenses, netProfit, owners }) {
  const totalExpenses = sumBy(yearExpenses)
  const expensesByCategory = useMemo(() => {
    const out = {}
    const byCat = groupBy(yearExpenses, 'category')
    for (const [cat, items] of Object.entries(byCat)) out[cat] = sumBy(items)
    return out
  }, [yearExpenses])

  const structureInfo = STRUCTURES.find(s => s.id === structure)

  const seEarnings   = Math.max(0, netProfit) * 0.9235
  const seTax        = seEarnings * 0.153
  const seDeductible = seTax / 2
  const totalTax     = Math.max(0, netProfit - seDeductible) * 0.22 + seTax
  const qPayment     = totalTax / 4

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: '#000' }}>
      <div className="print-header">
        <h1 style={{ fontSize: '18pt', margin: 0 }}>{bizName}</h1>
        <p style={{ fontSize: '12pt', margin: '4px 0' }}>{structureInfo?.label} — {structureInfo?.sub}</p>
        <p style={{ fontSize: '11pt', color: '#555' }}>Tax Year {year}</p>
      </div>

      <div className="form-section-title">Income Summary</div>
      <div className="form-line"><span>Gross Revenue</span><span>{formatCurrency(grossRevenue)}</span></div>
      <div className="form-line"><span>Total Expenses</span><span>{formatCurrency(totalExpenses)}</span></div>
      <div className="form-line" style={{ fontWeight: 'bold' }}><span>Net Profit / (Loss)</span><span>{formatCurrency(netProfit)}</span></div>

      <div className="form-section-title">Expenses by Category</div>
      {Object.entries(SCHED_C_LINES).map(([cat, info]) => (
        <div key={cat} className="form-line">
          <span>Line {info.line} — {info.label}</span>
          <span>{formatCurrency(expensesByCategory[cat] || 0)}</span>
        </div>
      ))}

      {structure === 'schedule_c' && netProfit > 0 && (
        <>
          <div className="form-section-title">Schedule SE — Self-Employment Tax</div>
          <div className="form-line"><span>Net Earnings Subject to SE Tax (×92.35%)</span><span>{formatCurrency(seEarnings)}</span></div>
          <div className="form-line"><span>Self-Employment Tax (15.3%)</span><span>{formatCurrency(seTax)}</span></div>
          <div className="form-line"><span>Deductible Portion (½ of SE tax)</span><span>{formatCurrency(seDeductible)}</span></div>

          <div className="form-section-title">Quarterly Estimated Payments (Form 1040-ES)</div>
          {QUARTER_DUE_DATES.map(q => (
            <div key={q.q} className="form-line">
              <span>{q.q} — Income {q.income} — Due {q.due}</span>
              <span>{formatCurrency(qPayment)}</span>
            </div>
          ))}
        </>
      )}

      {structure === 'form_1065' && owners.length > 0 && (
        <>
          <div className="form-section-title">Schedule K-1 — Partner Shares (Equal Split)</div>
          {owners.map(o => {
            const pct   = 100 / owners.length
            const share = netProfit * (pct / 100)
            return (
              <div key={o.id} className="k1-card">
                <p style={{ fontWeight: 'bold', marginBottom: 4 }}>{o.name}</p>
                <div className="form-line"><span>Ownership %</span><span>{pct.toFixed(1)}%</span></div>
                <div className="form-line"><span>Share of Income / (Loss)</span><span>{formatCurrency(share)}</span></div>
              </div>
            )
          })}
        </>
      )}

      <div className="print-disclaimer">
        ⚠ ESTIMATION ONLY — This document is generated from PolyHQ accounting data and is provided for informational purposes only.
        It does not constitute tax advice. Consult a licensed CPA or tax professional before filing any federal or state tax return.
        Tax laws change annually; verify all figures and due dates with the IRS (irs.gov).
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PrintIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}
