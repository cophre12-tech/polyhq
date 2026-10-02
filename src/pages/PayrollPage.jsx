import { useState, useEffect, useMemo } from 'react'
import { getEmployees, getEntriesInRange, entryDuration, getWeekStart, getBusinessSettings } from '../lib/db.js'
import { calcPayroll, formatCurrency, formatHours, formatPct, STATE_TAXES } from '../lib/payroll.js'
import { InlineFeatureGate } from '../components/FeatureGate.jsx'

export default function PayrollPage() {
  const [periodIdx, setPeriodIdx]   = useState(0)
  const [rows, setRows]             = useState([])
  const [overrides, setOverrides]   = useState({})
  const [editingId, setEditingId]   = useState(null)
  const [editVal, setEditVal]       = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [businessState, setBusinessState] = useState(null)

  const periods = useMemo(() => {
    const thisMonday = getWeekStart(0)
    const lastMonday = getWeekStart(1)
    return [
      { label: 'This Week',   start: thisMonday,  end: new Date(),  payPeriods: 52 },
      { label: 'Last Week',   start: lastMonday,  end: thisMonday,  payPeriods: 52 },
      { label: 'Last 2 Wks', start: lastMonday,  end: new Date(),  payPeriods: 26 },
      { label: 'All Time',   start: new Date(0), end: new Date(),  payPeriods: 52 },
    ]
  }, [])

  const period = periods[periodIdx]

  // Fetch business state once
  useEffect(() => {
    getBusinessSettings().then(s => setBusinessState(s?.state || 'VT'))
  }, [])

  // Reload rows when period or business state changes
  useEffect(() => {
    if (businessState === null) return
    let mounted = true
    async function load() {
      const employees = await getEmployees()
      const rowData = await Promise.all(employees.map(async emp => {
        const entries = await getEntriesInRange(period.start, period.end, emp.id)
        const hours = entries.reduce((s, e) => s + entryDuration(e), 0)
        const pay = calcPayroll(hours, emp.hourly_rate || 0, period.payPeriods, 0, businessState)
        return { ...emp, ...pay }
      }))
      if (mounted) setRows(rowData)
    }
    load()
    return () => { mounted = false }
  }, [period, businessState])

  const displayRows = useMemo(() => rows.map(r => {
    if (overrides[r.id] !== undefined) {
      const pay = calcPayroll(overrides[r.id], r.hourly_rate || 0, period.payPeriods, 0, businessState)
      return { ...r, ...pay, hoursOverridden: true }
    }
    return r
  }), [rows, overrides, period, businessState])

  function startEdit(empId, currentHours) { setEditingId(empId); setEditVal(currentHours.toFixed(2)) }
  function commitEdit() {
    if (editingId !== null) {
      const val = parseFloat(editVal)
      if (!isNaN(val) && val >= 0) setOverrides(p => ({ ...p, [editingId]: val }))
    }
    setEditingId(null); setEditVal('')
  }
  function resetOverride(empId) { setOverrides(p => { const n = { ...p }; delete n[empId]; return n }) }
  function toggleExpand(id) { setExpandedId(p => p === id ? null : id) }

  const totals = useMemo(() => displayRows.reduce(
    (acc, r) => ({
      hours:          acc.hours          + r.hours,
      gross:          acc.gross          + r.gross,
      federalTax:     acc.federalTax     + r.federalTax,
      socialSecurity: acc.socialSecurity + r.socialSecurity,
      medicare:       acc.medicare       + r.medicare,
      stateTax:       acc.stateTax       + (r.stateTax || 0),
      totalDeductions:acc.totalDeductions+ r.totalDeductions,
      netPay:         acc.netPay         + r.netPay,
      employerSS:     acc.employerSS     + (r.employerSS || 0),
      employerMedicare:acc.employerMedicare + (r.employerMedicare || 0),
      eftpsThisPeriod:acc.eftpsThisPeriod + (r.eftpsThisPeriod || 0),
    }),
    { hours: 0, gross: 0, federalTax: 0, socialSecurity: 0, medicare: 0, stateTax: 0,
      totalDeductions: 0, netPay: 0, employerSS: 0, employerMedicare: 0, eftpsThisPeriod: 0 }
  ), [displayRows])

  const stateInfo = businessState ? STATE_TAXES[businessState] : null
  const stateName = stateInfo?.name ?? 'State'
  const stateLabel = businessState ? `${businessState} Tax` : 'State Tax'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Payroll</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Federal, FICA &amp; {stateName} withholding · employer matching · EFTPS remittance
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          {periods.map((p, i) => (
            <button key={i} onClick={() => setPeriodIdx(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${i===periodIdx?'bg-accent text-fg':'bg-raised text-fg-muted hover:bg-overlay'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <SummaryCard label="Total Gross"     value={formatCurrency(totals.gross)} />
        <SummaryCard label="Total Net Pay"   value={formatCurrency(totals.netPay)}            accent="emerald" />
        <SummaryCard label="EFTPS This Period" value={formatCurrency(totals.eftpsThisPeriod)} accent="rose"
          sub="Federal + both FICA shares" />
        <SummaryCard label={`${stateLabel} Due`} value={formatCurrency(totals.stateTax)}
          accent={stateInfo?.hasIncomeTax ? 'indigo' : 'none'}
          sub={stateInfo?.hasIncomeTax ? `${stateName} withholding` : stateInfo?.note ?? ''} />
      </div>

      {/* Desktop table — Employee deductions */}
      <div className="hidden sm:block bg-surface rounded-xl border border-line overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-semibold text-fg">{period.label} — Employee Withholdings</h2>
          <span className="text-xs text-fg-subtle">Click a row to see full tax math</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-base/40">
                {[
                  ['Employee','left'], ['Hours','right'], ['Gross','right'],
                  ['Fed. Tax','right'], ['SS 6.2%','right'], ['Medicare','right'],
                  [stateLabel,'right'], ['Net Pay','right'],
                ].map(([h, a]) => (
                  <th key={h} className={`px-4 py-3 font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider text-${a} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayRows.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-fg-subtle text-sm">No employees yet.</td></tr>
              )}
              {displayRows.map(emp => (
                <EmpRow
                  key={emp.id}
                  emp={emp}
                  expanded={expandedId === emp.id}
                  onToggle={() => toggleExpand(emp.id)}
                  editingId={editingId}
                  editVal={editVal}
                  onStartEdit={startEdit}
                  onCommitEdit={commitEdit}
                  onEscapeEdit={() => setEditingId(null)}
                  onEditVal={setEditVal}
                  onResetOverride={resetOverride}
                  stateInfo={stateInfo}
                  stateName={stateName}
                  stateLabel={stateLabel}
                />
              ))}
              {displayRows.length > 0 && (
                <tr className="border-t-2 border-line bg-raised/50">
                  <td className="px-4 py-4 font-semibold text-fg">Totals</td>
                  <td className="px-4 py-4 text-right font-semibold text-fg tabular-nums">{formatHours(totals.hours)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-fg tabular-nums">{formatCurrency(totals.gross)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-danger tabular-nums">{formatCurrency(totals.federalTax)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-danger tabular-nums">{formatCurrency(totals.socialSecurity)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-danger tabular-nums">{formatCurrency(totals.medicare)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-danger tabular-nums">{formatCurrency(totals.stateTax)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-success tabular-nums text-base">{formatCurrency(totals.netPay)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Desktop table — Employer obligations */}
      {displayRows.length > 0 && (
        <InlineFeatureGate feature="payroll_advanced">
          <div className="hidden sm:block bg-surface rounded-xl border border-line overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="font-semibold text-fg">Employer Obligations</h2>
              <p className="text-xs text-fg-subtle mt-0.5">These are your costs on top of each employee's net pay — not deducted from employees</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-base/40">
                    {[['Employee','left'],['Gross','right'],['Employer SS (6.2%)','right'],['Employer Med. (1.45%)','right'],['Total Employer Tax','right'],['Total Labor Cost','right']].map(([h, a]) => (
                      <th key={h} className={`px-4 py-3 font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider text-${a} whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {displayRows.map(emp => (
                    <tr key={emp.id} className="hover:bg-raised/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-raised border border-line flex items-center justify-center text-fg-muted text-xs font-semibold shrink-0">{emp.name[0]}</div>
                          <span className="text-fg font-medium">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-fg-muted tabular-nums">{formatCurrency(emp.gross)}</td>
                      <td className="px-4 py-3 text-right text-warning tabular-nums">{formatCurrency(emp.employerSS || 0)}</td>
                      <td className="px-4 py-3 text-right text-warning tabular-nums">{formatCurrency(emp.employerMedicare || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-warning tabular-nums">{formatCurrency((emp.employerSS || 0) + (emp.employerMedicare || 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-fg tabular-nums">{formatCurrency(emp.gross + (emp.employerSS || 0) + (emp.employerMedicare || 0))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line bg-raised/50">
                    <td className="px-4 py-4 font-semibold text-fg">Totals</td>
                    <td className="px-4 py-4 text-right font-semibold text-fg tabular-nums">{formatCurrency(totals.gross)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-warning tabular-nums">{formatCurrency(totals.employerSS)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-warning tabular-nums">{formatCurrency(totals.employerMedicare)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-warning tabular-nums">{formatCurrency(totals.employerSS + totals.employerMedicare)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-fg tabular-nums text-base">{formatCurrency(totals.gross + totals.employerSS + totals.employerMedicare)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </InlineFeatureGate>
      )}

      {/* Remittance summary */}
      {displayRows.length > 0 && (
        <InlineFeatureGate feature="payroll_advanced">
          <div className="hidden sm:block bg-surface rounded-xl border border-line p-5 sm:p-6 mb-6">
            <h2 className="font-semibold text-fg mb-1">Remittance Due — {period.label}</h2>
            <p className="text-xs text-fg-subtle mb-5">What you need to send to each tax authority this pay period</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <RemitCard
                title="IRS EFTPS"
                amount={totals.eftpsThisPeriod}
                accent="rose"
                lines={[
                  { label: 'Federal withholding', value: totals.federalTax },
                  { label: 'Employee SS (6.2%)', value: totals.socialSecurity },
                  { label: 'Employer SS (6.2%)', value: totals.employerSS },
                  { label: 'Employee Medicare (1.45%)', value: totals.medicare },
                  { label: 'Employer Medicare (1.45%)', value: totals.employerMedicare },
                ]}
              />
              <RemitCard
                title={`${stateName} DOR`}
                amount={totals.stateTax}
                accent={stateInfo?.hasIncomeTax ? 'indigo' : 'none'}
                note={stateInfo?.hasIncomeTax ? null : stateInfo?.note ?? 'No state income tax'}
                lines={stateInfo?.hasIncomeTax ? [
                  { label: `${stateName} income tax withheld`, value: totals.stateTax },
                ] : []}
              />
              <RemitCard
                title="Total Labor Cost"
                amount={totals.gross + totals.employerSS + totals.employerMedicare}
                accent="emerald"
                lines={[
                  { label: 'Gross wages', value: totals.gross },
                  { label: 'Employer FICA', value: totals.employerSS + totals.employerMedicare },
                ]}
              />
            </div>
          </div>
        </InlineFeatureGate>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3 mb-4">
        {displayRows.length === 0 && (
          <p className="text-center text-fg-subtle text-sm py-10">No employees yet.</p>
        )}
        {displayRows.map(emp => (
          <MobileEmpCard
            key={emp.id}
            emp={emp}
            expanded={expandedId === emp.id}
            onToggle={() => toggleExpand(emp.id)}
            editingId={editingId}
            editVal={editVal}
            onStartEdit={startEdit}
            onCommitEdit={commitEdit}
            onEscapeEdit={() => setEditingId(null)}
            onEditVal={setEditVal}
            onResetOverride={resetOverride}
            stateInfo={stateInfo}
            stateName={stateName}
          />
        ))}

        {/* Mobile remittance summary */}
        {displayRows.length > 0 && (
          <InlineFeatureGate feature="payroll_advanced">
            <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-fg">Remittance — {period.label}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-fg-muted">IRS EFTPS due</span>
                  <span className="text-danger font-semibold tabular-nums">{formatCurrency(totals.eftpsThisPeriod)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-fg-muted">{stateName} withholding</span>
                  <span className={`font-semibold tabular-nums ${stateInfo?.hasIncomeTax ? 'text-fg' : 'text-fg-subtle'}`}>
                    {stateInfo?.hasIncomeTax ? formatCurrency(totals.stateTax) : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-line pt-2">
                  <span className="text-fg-muted">Total labor cost</span>
                  <span className="text-fg font-semibold tabular-nums">{formatCurrency(totals.gross + totals.employerSS + totals.employerMedicare)}</span>
                </div>
              </div>
            </div>
          </InlineFeatureGate>
        )}
      </div>

      <p className="text-xs text-fg-subtle leading-relaxed">
        * 2024 single-filer withholding tables. SS wage base: $168,600/yr. Employer FICA matches employee FICA.
        EFTPS deposits typically due within 3 days of payroll. Consult a CPA or payroll provider before issuing payroll.
      </p>
    </div>
  )
}

// ── Desktop employee row with expandable tax detail ───────────────────────────

function EmpRow({ emp, expanded, onToggle, editingId, editVal, onStartEdit, onCommitEdit, onEscapeEdit, onEditVal, onResetOverride, stateInfo, stateName, stateLabel }) {
  return (
    <>
      <tr
        className="hover:bg-raised/30 transition-colors cursor-pointer"
        onClick={() => {
          // Don't toggle if user is editing hours
          if (editingId !== emp.id) onToggle()
        }}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-raised border border-line flex items-center justify-center text-fg-muted text-xs font-semibold shrink-0">{emp.name[0]}</div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-fg">{emp.name}</p>
                <svg className={`w-3 h-3 text-fg-subtle transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              <p className="text-xs text-fg-muted">${emp.hourly_rate}/hr</p>
            </div>
          </div>
        </td>
        {/* Hours — click to edit, stops row toggle */}
        <td className="px-4 py-4 text-right tabular-nums" onClick={e => e.stopPropagation()}>
          {editingId === emp.id ? (
            <input
              type="number" min="0" step="0.25" autoFocus
              value={editVal}
              onChange={e => onEditVal(e.target.value)}
              onBlur={onCommitEdit}
              onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onEscapeEdit() }}
              className="w-20 bg-overlay border border-accent rounded px-2 py-1 text-fg text-sm text-right tabular-nums focus:outline-none ml-auto block"
            />
          ) : (
            <button onClick={() => onStartEdit(emp.id, emp.hours)} title="Click to adjust"
              className="group inline-flex items-center gap-1.5 ml-auto hover:text-fg transition-colors">
              {emp.hoursOverridden && (
                <span onClick={e => { e.stopPropagation(); onResetOverride(emp.id) }}
                  className="text-danger hover:text-danger/80 text-xs cursor-pointer">✕</span>
              )}
              <span className={emp.hoursOverridden ? 'text-fg underline decoration-dotted underline-offset-4' : 'text-fg-muted'}>{formatHours(emp.hours)}</span>
              <svg className="w-3 h-3 text-fg-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
          )}
        </td>
        <td className="px-4 py-4 text-right font-medium text-fg tabular-nums">{formatCurrency(emp.gross)}</td>
        <td className="px-4 py-4 text-right text-danger tabular-nums">{formatCurrency(emp.federalTax)}</td>
        <td className="px-4 py-4 text-right text-danger tabular-nums">{formatCurrency(emp.socialSecurity)}</td>
        <td className="px-4 py-4 text-right text-danger tabular-nums">{formatCurrency(emp.medicare)}</td>
        <td className="px-4 py-4 text-right text-danger tabular-nums">
          {stateInfo?.hasIncomeTax ? formatCurrency(emp.stateTax) : <span className="text-fg-subtle">$0.00</span>}
        </td>
        <td className="px-4 py-4 text-right font-semibold text-success tabular-nums">{formatCurrency(emp.netPay)}</td>
      </tr>

      {expanded && (
        <tr className="bg-base/60">
          <td colSpan={8} className="px-6 py-5">
            <InlineFeatureGate feature="payroll_advanced">
              <TaxDetail emp={emp} stateInfo={stateInfo} stateName={stateName} />
            </InlineFeatureGate>
          </td>
        </tr>
      )}
    </>
  )
}

function TaxDetail({ emp, stateInfo, stateName }) {
  const hasState = stateInfo?.hasIncomeTax

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Employee side */}
      <div>
        <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider mb-3">Employee Withholdings</p>
        <div className="space-y-2.5 text-sm">
          <DetailRow label="Gross Pay" value={formatCurrency(emp.gross)} bold>
            <span className="text-xs text-fg-subtle">{formatHours(emp.hours)} × ${emp.hourly_rate}/hr = {formatCurrency(emp.gross)}</span>
          </DetailRow>
          <DetailRow label="Federal Income Tax" value={`−${formatCurrency(emp.federalTax)}`} neg>
            {emp.federalBracket && (
              <span className="text-xs text-fg-subtle">
                {formatPct(emp.federalBracket.rate)} marginal bracket · {formatPct(emp.federalEffRate)} effective
                {' '}(annualized {formatCurrency(emp.annualGross)})
              </span>
            )}
          </DetailRow>
          <DetailRow label="Social Security (emp)" value={`−${formatCurrency(emp.socialSecurity)}`} neg>
            <span className="text-xs text-fg-subtle">6.2% × {formatCurrency(emp.gross)} gross</span>
          </DetailRow>
          <DetailRow label="Medicare (emp)" value={`−${formatCurrency(emp.medicare)}`} neg>
            <span className="text-xs text-fg-subtle">1.45% × {formatCurrency(emp.gross)} gross</span>
          </DetailRow>
          <DetailRow
            label={`${stateName} Income Tax`}
            value={hasState ? `−${formatCurrency(emp.stateTax)}` : '$0.00'}
            neg={hasState}
            dim={!hasState}
          >
            {hasState && emp.stateBracket ? (
              <span className="text-xs text-fg-subtle">
                {formatPct(emp.stateBracket.rate)} marginal · {formatPct(emp.stateEffRate)} effective
              </span>
            ) : (
              <span className="text-xs text-fg-subtle">{stateInfo?.note ?? ''}</span>
            )}
          </DetailRow>
          <div className="border-t border-line pt-2 flex justify-between font-semibold">
            <span className="text-fg">Est. Net Pay</span>
            <span className="text-success tabular-nums">{formatCurrency(emp.netPay)}</span>
          </div>
        </div>
      </div>

      {/* Employer side */}
      <div>
        <p className="font-mono text-2xs font-medium text-warning/70 uppercase tracking-wider mb-3">Your Employer Cost (on top)</p>
        <div className="space-y-2.5 text-sm">
          <DetailRow label="Gross Wages Paid" value={formatCurrency(emp.gross)} />
          <DetailRow label="Employer SS (6.2%)" value={formatCurrency(emp.employerSS || 0)} amber>
            <span className="text-xs text-fg-subtle">6.2% × {formatCurrency(emp.gross)} gross (your match)</span>
          </DetailRow>
          <DetailRow label="Employer Medicare (1.45%)" value={formatCurrency(emp.employerMedicare || 0)} amber>
            <span className="text-xs text-fg-subtle">1.45% × {formatCurrency(emp.gross)} gross (your match)</span>
          </DetailRow>
          <div className="border-t border-line pt-2 space-y-1.5">
            <div className="flex justify-between font-semibold">
              <span className="text-fg">Total Labor Cost</span>
              <span className="text-fg tabular-nums">{formatCurrency(emp.gross + (emp.employerSS || 0) + (emp.employerMedicare || 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">EFTPS this period</span>
              <span className="text-danger font-medium tabular-nums">{formatCurrency(emp.eftpsThisPeriod || 0)}</span>
            </div>
            <p className="text-xs text-fg-subtle pt-1">
              EFTPS = federal withheld + employee FICA + employer FICA
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, bold, neg, amber, dim, children }) {
  const valueColor = neg ? 'text-danger' : amber ? 'text-warning' : dim ? 'text-fg-subtle' : bold ? 'text-fg' : 'text-fg'
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className={bold ? 'font-medium text-fg' : 'text-fg-muted'}>{label}</span>
        <span className={`font-medium tabular-nums ${valueColor}`}>{value}</span>
      </div>
      {children && <div className="mt-0.5">{children}</div>}
    </div>
  )
}

// ── Mobile employee card ──────────────────────────────────────────────────────

function MobileEmpCard({ emp, expanded, onToggle, editingId, editVal, onStartEdit, onCommitEdit, onEscapeEdit, onEditVal, onResetOverride, stateInfo, stateName }) {
  const hasState = stateInfo?.hasIncomeTax
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-raised border border-line flex items-center justify-center text-fg-muted text-sm font-semibold">{emp.name[0]}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-fg">{emp.name}</p>
          <div className="flex items-center gap-1.5">
            {editingId === emp.id ? (
              <input type="number" min="0" step="0.25" autoFocus value={editVal}
                onChange={e => onEditVal(e.target.value)}
                onBlur={onCommitEdit}
                onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onEscapeEdit() }}
                className="w-20 bg-overlay border border-accent rounded px-2 py-0.5 text-fg text-xs focus:outline-none"
              />
            ) : (
              <button onClick={() => onStartEdit(emp.id, emp.hours)} className="text-xs text-fg-muted hover:text-fg flex items-center gap-1">
                <span className={emp.hoursOverridden ? 'text-fg underline decoration-dotted underline-offset-4' : ''}>{formatHours(emp.hours)}</span>
                <svg className="w-3 h-3 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
            )}
            {emp.hoursOverridden && <button onClick={() => onResetOverride(emp.id)} className="text-xs text-danger hover:text-danger/80">reset</button>}
            <span className="text-xs text-fg-subtle">· ${emp.hourly_rate}/hr</span>
          </div>
        </div>
        <button onClick={onToggle} className="text-fg-subtle hover:text-fg-muted p-1">
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MobilePayRow label="Gross"     value={formatCurrency(emp.gross)}           color="text-fg" />
        <MobilePayRow label="Net Pay"   value={formatCurrency(emp.netPay)}          color="text-success" />
        <MobilePayRow label="Fed. Tax"  value={formatCurrency(emp.federalTax)}      color="text-danger" />
        <MobilePayRow label="SS + Med." value={formatCurrency(emp.socialSecurity + emp.medicare)} color="text-danger" />
        {hasState && <MobilePayRow label={`${stateName} Tax`} value={formatCurrency(emp.stateTax)} color="text-danger" />}
        <MobilePayRow label="Emp. SS + Med." value={formatCurrency((emp.employerSS || 0) + (emp.employerMedicare || 0))} color="text-warning" />
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-line">
          <InlineFeatureGate feature="payroll_advanced">
            <TaxDetail emp={emp} stateInfo={stateInfo} stateName={stateName} />
          </InlineFeatureGate>
        </div>
      )}
    </div>
  )
}

// ── Remittance card ───────────────────────────────────────────────────────────

function RemitCard({ title, amount, accent, lines = [], note }) {
  const amtColor = accent === 'rose' ? 'text-danger' : accent === 'indigo' ? 'text-fg' : accent === 'emerald' ? 'text-success' : 'text-fg-subtle'
  return (
    <div className="bg-raised/50 border border-line rounded-xl p-4">
      <p className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-xl font-semibold tabular-nums mb-3 ${amtColor}`}>{formatCurrency(amount)}</p>
      {note && <p className="text-xs text-fg-subtle italic">{note}</p>}
      {lines.length > 0 && (
        <div className="space-y-1">
          {lines.map(l => (
            <div key={l.label} className="flex justify-between text-xs">
              <span className="text-fg-subtle">{l.label}</span>
              <span className="text-fg-muted tabular-nums">{formatCurrency(l.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function MobilePayRow({ label, value, color }) {
  return (
    <div className="bg-raised/50 rounded-lg px-3 py-2">
      <p className="text-xs text-fg-subtle mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function SummaryCard({ label, value, accent, sub }) {
  const valColor = accent === 'rose' ? 'text-danger' : accent === 'emerald' ? 'text-success' : accent === 'indigo' ? 'text-fg' : 'text-fg'
  return (
    <div className="bg-surface border border-line rounded-xl px-4 sm:px-5 py-4">
      <p className="font-mono text-2xs font-medium text-fg-muted mb-1 sm:mb-1.5 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-lg sm:text-xl font-semibold tabular-nums ${valColor}`}>{value}</p>
      {sub && <p className="text-xs text-fg-subtle mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}
