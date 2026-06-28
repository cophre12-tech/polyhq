import { useState, useMemo } from 'react'
import { getEmployees, getEntriesInRange, entryDuration, getWeekStart } from '../lib/db.js'
import { calcPayroll, formatCurrency, formatHours } from '../lib/payroll.js'

export default function PayrollPage() {
  const [periodIdx, setPeriodIdx] = useState(0)

  const periods = useMemo(() => {
    const thisMonday = getWeekStart(0)
    const lastMonday = getWeekStart(1)
    return [
      { label: 'This Week',    start: thisMonday,  end: new Date(),   payPeriods: 52 },
      { label: 'Last Week',    start: lastMonday,  end: thisMonday,   payPeriods: 52 },
      { label: 'Last 2 Wks',  start: lastMonday,  end: new Date(),   payPeriods: 26 },
      { label: 'All Time',    start: new Date(0), end: new Date(),   payPeriods: 52 },
    ]
  }, [])

  const period = periods[periodIdx]

  const rows = useMemo(() => {
    return getEmployees().map(emp => {
      const hours = getEntriesInRange(period.start, period.end, emp.id).reduce((s, e) => s + entryDuration(e), 0)
      const pay   = calcPayroll(hours, emp.hourly_rate || 0, period.payPeriods)
      return { ...emp, ...pay }
    })
  }, [period])

  const totals = rows.reduce(
    (acc, r) => ({ hours: acc.hours+r.hours, gross: acc.gross+r.gross, federalTax: acc.federalTax+r.federalTax, socialSecurity: acc.socialSecurity+r.socialSecurity, medicare: acc.medicare+r.medicare, totalDeductions: acc.totalDeductions+r.totalDeductions, netPay: acc.netPay+r.netPay }),
    { hours:0, gross:0, federalTax:0, socialSecurity:0, medicare:0, totalDeductions:0, netPay:0 }
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Payroll</h1>
          <p className="text-slate-400 mt-1 text-sm">Gross pay with federal, SS & Medicare deductions</p>
        </div>
        {/* Period buttons — scrollable row on mobile */}
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
        <SummaryCard label="Total Gross"      value={formatCurrency(totals.gross)} />
        <SummaryCard label="Federal Tax"      value={formatCurrency(totals.federalTax)}      accent="rose" />
        <SummaryCard label="Total Deductions" value={formatCurrency(totals.totalDeductions)} accent="rose" />
        <SummaryCard label="Total Net Pay"    value={formatCurrency(totals.netPay)}           accent="emerald" />
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">{period.label}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40">
                {[['Employee','left'],['Hours','right'],['Rate','right'],['Gross','right'],['Fed. Tax','right'],['SS 6.2%','right'],['Medicare','right'],['Net Pay','right']].map(([h,a]) => (
                  <th key={h} className={`px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-${a}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">{emp.name[0]}</div>
                      <div>
                        <p className="font-medium text-white">{emp.name}</p>
                        <p className="text-xs text-slate-400">${emp.hourly_rate}/hr</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300 tabular-nums">{formatHours(emp.hours)}</td>
                  <td className="px-6 py-4 text-right text-slate-400">${emp.hourly_rate}/hr</td>
                  <td className="px-6 py-4 text-right font-medium text-white tabular-nums">{formatCurrency(emp.gross)}</td>
                  <td className="px-6 py-4 text-right text-rose-400 tabular-nums">{formatCurrency(emp.federalTax)}</td>
                  <td className="px-6 py-4 text-right text-rose-400 tabular-nums">{formatCurrency(emp.socialSecurity)}</td>
                  <td className="px-6 py-4 text-right text-rose-400 tabular-nums">{formatCurrency(emp.medicare)}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-400 tabular-nums">{formatCurrency(emp.netPay)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-700 bg-slate-800/50">
                <td className="px-6 py-4 font-bold text-white">Totals</td>
                <td className="px-6 py-4 text-right font-semibold text-white tabular-nums">{formatHours(totals.hours)}</td>
                <td className="px-6 py-4" />
                <td className="px-6 py-4 text-right font-semibold text-white tabular-nums">{formatCurrency(totals.gross)}</td>
                <td className="px-6 py-4 text-right font-semibold text-rose-400 tabular-nums">{formatCurrency(totals.federalTax)}</td>
                <td className="px-6 py-4 text-right font-semibold text-rose-400 tabular-nums">{formatCurrency(totals.socialSecurity)}</td>
                <td className="px-6 py-4 text-right font-semibold text-rose-400 tabular-nums">{formatCurrency(totals.medicare)}</td>
                <td className="px-6 py-4 text-right font-bold text-emerald-400 tabular-nums text-base">{formatCurrency(totals.netPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3 mb-4">
        {rows.map(emp => (
          <div key={emp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold">{emp.name[0]}</div>
              <div>
                <p className="font-semibold text-white">{emp.name}</p>
                <p className="text-xs text-slate-400">{formatHours(emp.hours)} · ${emp.hourly_rate}/hr</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MobilePayRow label="Gross"     value={formatCurrency(emp.gross)}           color="text-white" />
              <MobilePayRow label="Net Pay"   value={formatCurrency(emp.netPay)}          color="text-emerald-400" />
              <MobilePayRow label="Fed. Tax"  value={formatCurrency(emp.federalTax)}      color="text-rose-400" />
              <MobilePayRow label="SS + Med." value={formatCurrency(emp.socialSecurity + emp.medicare)} color="text-rose-400" />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        * Federal withholding estimated using 2024 IRS single-filer brackets. SS: 6.2% up to $168,600/yr. Medicare: 1.45%.
        Consult a payroll provider or CPA before issuing payroll.
      </p>
    </div>
  )
}

function MobilePayRow({ label, value, color }) {
  return (
    <div className="bg-slate-800/50 rounded-lg px-3 py-2">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 sm:px-5 py-4">
      <p className="text-xs font-medium text-slate-400 mb-1 sm:mb-1.5 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-lg sm:text-xl font-bold tabular-nums ${accent==='rose'?'text-rose-400':accent==='emerald'?'text-emerald-400':'text-white'}`}>{value}</p>
    </div>
  )
}
