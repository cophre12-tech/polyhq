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
          <h1 className="text-xl sm:text-2xl font-bold text-white">Payroll</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Federal, FICA &amp; {stateName} withholding · employer matching · EFTPS remittance
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          {periods.map((p, i) => (
            <button key={i} onClick={() => setPeriodIdx(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${i===periodIdx?'bg-indigo-600 text-white':'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
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
      <div className="hidden sm:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">{period.label} — Employee Withholdings</h2>
          <span className="text-xs text-slate-500">Click a row to see full tax math</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40">
                {[
                  ['Employee','left'], ['Hours','right'], ['Gross','right'],
                  ['Fed. Tax','right'], ['SS 6.2%','right'], ['Medicare','right'],
                  [stateLabel,'right'], ['Net Pay','right'],
                ].map(([h, a]) => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-${a} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayRows.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500 text-sm">No employees yet.</td></tr>
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
                <tr className="border-t-2 border-slate-700 bg-slate-800/50">
                  <td className="px-4 py-4 font-bold text-white">Totals</td>
                  <td className="px-4 py-4 text-right font-semibold text-white tabular-nums">{formatHours(totals.hours)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-white tabular-nums">{formatCurrency(totals.gross)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-rose-400 tabular-nums">{formatCurrency(totals.federalTax)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-rose-400 tabular-nums">{formatCurrency(totals.socialSecurity)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-rose-400 tabular-nums">{formatCurrency(totals.medicare)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-rose-400 tabular-nums">{formatCurrency(totals.stateTax)}</td>
                  <td className="px-4 py-4 text-right font-bold text-emerald-400 tabular-nums text-base">{formatCurrency(totals.netPay)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Desktop table — Employer obligations */}
      {displayRows.length > 0 && (
        <InlineFeatureGate feature="payroll_advanced">
          <div className="hidden sm:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">Employer Obligations</h2>
              <p className="text-xs text-slate-500 mt-0.5">These are your costs on top of each employee's net pay — not deducted from employees</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40">
                    {[['Employee','left'],['Gross','right'],['Employer SS (6.2%)','right'],['Employer Med. (1.45%)','right'],['Total Employer Tax','right'],['Total Labor Cost','right']].map(([h, a]) => (
                      <th key={h} className={`px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-${a} whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayRows.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">{emp.name[0]}</div>
                          <span className="text-white font-medium">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{formatCurrency(emp.gross)}</td>
                      <td className="px-4 py-3 text-right text-amber-400 tabular-nums">{formatCurrency(emp.employerSS || 0)}</td>
                      <td className="px-4 py-3 text-right text-amber-400 tabular-nums">{formatCurrency(emp.employerMedicare || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-400 tabular-nums">{formatCurrency((emp.employerSS || 0) + (emp.employerMedicare || 0))}</td>
                      <td className="px-4 py-3 text-right font-bold text-white tabular-nums">{formatCurrency(emp.gross + (emp.employerSS || 0) + (emp.employerMedicare || 0))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-700 bg-slate-800/50">
                    <td className="px-4 py-4 font-bold text-white">Totals</td>
                    <td className="px-4 py-4 text-right font-semibold text-white tabular-nums">{formatCurrency(totals.gross)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-amber-400 tabular-nums">{formatCurrency(totals.employerSS)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-amber-400 tabular-nums">{formatCurrency(totals.employerMedicare)}</td>
                    <td className="px-4 py-4 text-right font-bold text-amber-400 tabular-nums">{formatCurrency(totals.employerSS + totals.employerMedicare)}</td>
                    <td className="px-4 py-4 text-right font-bold text-white tabular-nums text-base">{formatCurrency(totals.gross + totals.employerSS + totals.employerMedicare)}</td>
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
          <div className="hidden sm:block bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6 mb-6">
            <h2 className="font-semibold text-white mb-1">Remittance Due — {period.label}</h2>
            <p className="text-xs text-slate-500 mb-5">What you need to send to each tax authority this pay period</p>
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
          <p className="text-center text-slate-500 text-sm py-10">No employees yet.</p>
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Remittance — {period.label}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">IRS EFTPS due</span>
                  <span className="text-rose-400 font-semibold tabular-nums">{formatCurrency(totals.eftpsThisPeriod)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{stateName} withholding</span>
                  <span className={`font-semibold tabular-nums ${stateInfo?.hasIncomeTax ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {stateInfo?.hasIncomeTax ? formatCurrency(totals.stateTax) : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-800 pt-2">
                  <span className="text-slate-400">Total labor cost</span>
                  <span className="text-white font-bold tabular-nums">{formatCurrency(totals.gross + totals.employerSS + totals.employerMedicare)}</span>
                </div>
              </div>
            </div>
          </InlineFeatureGate>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
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
        className="hover:bg-slate-800/30 transition-colors cursor-pointer"
        onClick={() => {
          // Don't toggle if user is editing hours
          if (editingId !== emp.id) onToggle()
        }}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">{emp.name[0]}</div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-white">{emp.name}</p>
                <svg className={`w-3 h-3 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              <p className="text-xs text-slate-400">${emp.hourly_rate}/hr</p>
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
              className="w-20 bg-slate-700 border border-indigo-500 rounded px-2 py-1 text-white text-sm text-right tabular-nums focus:outline-none ml-auto block"
            />
          ) : (
            <button onClick={() => onStartEdit(emp.id, emp.hours)} title="Click to adjust"
              className="group inline-flex items-center gap-1.5 ml-auto hover:text-white transition-colors">
              {emp.hoursOverridden && (
                <span onClick={e => { e.stopPropagation(); onResetOverride(emp.id) }}
                  className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</span>
              )}
              <span className={emp.hoursOverridden ? 'text-indigo-300' : 'text-slate-300'}>{formatHours(emp.hours)}</span>
              <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
          )}
        </td>
        <td className="px-4 py-4 text-right font-medium text-white tabular-nums">{formatCurrency(emp.gross)}</td>
        <td className="px-4 py-4 text-right text-rose-400 tabular-nums">{formatCurrency(emp.federalTax)}</td>
        <td className="px-4 py-4 text-right text-rose-400 tabular-nums">{formatCurrency(emp.socialSecurity)}</td>
        <td className="px-4 py-4 text-right text-rose-400 tabular-nums">{formatCurrency(emp.medicare)}</td>
        <td className="px-4 py-4 text-right text-rose-400 tabular-nums">
          {stateInfo?.hasIncomeTax ? formatCurrency(emp.stateTax) : <span className="text-slate-600">$0.00</span>}
        </td>
        <td className="px-4 py-4 text-right font-bold text-emerald-400 tabular-nums">{formatCurrency(emp.netPay)}</td>
      </tr>

      {expanded && (
        <tr className="bg-slate-950/60">
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
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Employee Withholdings</p>
        <div className="space-y-2.5 text-sm">
          <DetailRow label="Gross Pay" value={formatCurrency(emp.gross)} bold>
            <span className="text-xs text-slate-500">{formatHours(emp.hours)} × ${emp.hourly_rate}/hr = {formatCurrency(emp.gross)}</span>
          </DetailRow>
          <DetailRow label="Federal Income Tax" value={`−${formatCurrency(emp.federalTax)}`} neg>
            {emp.federalBracket && (
              <span className="text-xs text-slate-500">
                {formatPct(emp.federalBracket.rate)} marginal bracket · {formatPct(emp.federalEffRate)} effective
                {' '}(annualized {formatCurrency(emp.annualGross)})
              </span>
            )}
          </DetailRow>
          <DetailRow label="Social Security (emp)" value={`−${formatCurrency(emp.socialSecurity)}`} neg>
            <span className="text-xs text-slate-500">6.2% × {formatCurrency(emp.gross)} gross</span>
          </DetailRow>
          <DetailRow label="Medicare (emp)" value={`−${formatCurrency(emp.medicare)}`} neg>
            <span className="text-xs text-slate-500">1.45% × {formatCurrency(emp.gross)} gross</span>
          </DetailRow>
          <DetailRow
            label={`${stateName} Income Tax`}
            value={hasState ? `−${formatCurrency(emp.stateTax)}` : '$0.00'}
            neg={hasState}
            dim={!hasState}
          >
            {hasState && emp.stateBracket ? (
              <span className="text-xs text-slate-500">
                {formatPct(emp.stateBracket.rate)} marginal · {formatPct(emp.stateEffRate)} effective
              </span>
            ) : (
              <span className="text-xs text-slate-500">{stateInfo?.note ?? ''}</span>
            )}
          </DetailRow>
          <div className="border-t border-slate-700 pt-2 flex justify-between font-semibold">
            <span className="text-white">Est. Net Pay</span>
            <span className="text-emerald-400 tabular-nums">{formatCurrency(emp.netPay)}</span>
          </div>
        </div>
      </div>

      {/* Employer side */}
      <div>
        <p className="text-xs font-semibold text-amber-500/70 uppercase tracking-wider mb-3">Your Employer Cost (on top)</p>
        <div className="space-y-2.5 text-sm">
          <DetailRow label="Gross Wages Paid" value={formatCurrency(emp.gross)} />
          <DetailRow label="Employer SS (6.2%)" value={formatCurrency(emp.employerSS || 0)} amber>
            <span className="text-xs text-slate-500">6.2% × {formatCurrency(emp.gross)} gross (your match)</span>
          </DetailRow>
          <DetailRow label="Employer Medicare (1.45%)" value={formatCurrency(emp.employerMedicare || 0)} amber>
            <span className="text-xs text-slate-500">1.45% × {formatCurrency(emp.gross)} gross (your match)</span>
          </DetailRow>
          <div className="border-t border-slate-700 pt-2 space-y-1.5">
            <div className="flex justify-between font-semibold">
              <span className="text-white">Total Labor Cost</span>
              <span className="text-white tabular-nums">{formatCurrency(emp.gross + (emp.employerSS || 0) + (emp.employerMedicare || 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">EFTPS this period</span>
              <span className="text-rose-400 font-medium tabular-nums">{formatCurrency(emp.eftpsThisPeriod || 0)}</span>
            </div>
            <p className="text-xs text-slate-600 pt-1">
              EFTPS = federal withheld + employee FICA + employer FICA
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, bold, neg, amber, dim, children }) {
  const valueColor = neg ? 'text-rose-400' : amber ? 'text-amber-400' : dim ? 'text-slate-600' : bold ? 'text-white' : 'text-slate-200'
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className={bold ? 'font-medium text-white' : 'text-slate-300'}>{label}</span>
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold">{emp.name[0]}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white">{emp.name}</p>
          <div className="flex items-center gap-1.5">
            {editingId === emp.id ? (
              <input type="number" min="0" step="0.25" autoFocus value={editVal}
                onChange={e => onEditVal(e.target.value)}
                onBlur={onCommitEdit}
                onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onEscapeEdit() }}
                className="w-20 bg-slate-700 border border-indigo-500 rounded px-2 py-0.5 text-white text-xs focus:outline-none"
              />
            ) : (
              <button onClick={() => onStartEdit(emp.id, emp.hours)} className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1">
                <span className={emp.hoursOverridden ? 'text-indigo-300' : ''}>{formatHours(emp.hours)}</span>
                <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
            )}
            {emp.hoursOverridden && <button onClick={() => onResetOverride(emp.id)} className="text-xs text-rose-400 hover:text-rose-300">reset</button>}
            <span className="text-xs text-slate-500">· ${emp.hourly_rate}/hr</span>
          </div>
        </div>
        <button onClick={onToggle} className="text-slate-500 hover:text-slate-300 p-1">
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MobilePayRow label="Gross"     value={formatCurrency(emp.gross)}           color="text-white" />
        <MobilePayRow label="Net Pay"   value={formatCurrency(emp.netPay)}          color="text-emerald-400" />
        <MobilePayRow label="Fed. Tax"  value={formatCurrency(emp.federalTax)}      color="text-rose-400" />
        <MobilePayRow label="SS + Med." value={formatCurrency(emp.socialSecurity + emp.medicare)} color="text-rose-400" />
        {hasState && <MobilePayRow label={`${stateName} Tax`} value={formatCurrency(emp.stateTax)} color="text-rose-400" />}
        <MobilePayRow label="Emp. SS + Med." value={formatCurrency((emp.employerSS || 0) + (emp.employerMedicare || 0))} color="text-amber-400" />
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800">
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
  const amtColor = accent === 'rose' ? 'text-rose-400' : accent === 'indigo' ? 'text-indigo-400' : accent === 'emerald' ? 'text-emerald-400' : 'text-slate-500'
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-xl font-bold tabular-nums mb-3 ${amtColor}`}>{formatCurrency(amount)}</p>
      {note && <p className="text-xs text-slate-500 italic">{note}</p>}
      {lines.length > 0 && (
        <div className="space-y-1">
          {lines.map(l => (
            <div key={l.label} className="flex justify-between text-xs">
              <span className="text-slate-500">{l.label}</span>
              <span className="text-slate-400 tabular-nums">{formatCurrency(l.value)}</span>
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
    <div className="bg-slate-800/50 rounded-lg px-3 py-2">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function SummaryCard({ label, value, accent, sub }) {
  const valColor = accent === 'rose' ? 'text-rose-400' : accent === 'emerald' ? 'text-emerald-400' : accent === 'indigo' ? 'text-indigo-400' : 'text-white'
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 sm:px-5 py-4">
      <p className="text-xs font-medium text-slate-400 mb-1 sm:mb-1.5 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-lg sm:text-xl font-bold tabular-nums ${valColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}
