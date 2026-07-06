// ── 2024 IRS single-filer federal income tax brackets ──────────────────────────
const FEDERAL_BRACKETS = [
  { min: 0,       max: 11600,    rate: 0.10 },
  { min: 11600,   max: 47150,    rate: 0.12 },
  { min: 47150,   max: 100525,   rate: 0.22 },
  { min: 100525,  max: 191950,   rate: 0.24 },
  { min: 191950,  max: 243725,   rate: 0.32 },
  { min: 243725,  max: 609350,   rate: 0.35 },
  { min: 609350,  max: Infinity, rate: 0.37 },
]

const SS_RATE       = 0.062
const MEDICARE_RATE = 0.0145
const SS_WAGE_BASE  = 168600

// ── 2024 state income tax — single-filer annualized wage-withholding tables ───
export const STATE_TAXES = {
  VT: {
    name: 'Vermont', hasIncomeTax: true,
    brackets: [
      { min: 0,      max: 45400,    rate: 0.0335 },
      { min: 45400,  max: 110050,   rate: 0.0660 },
      { min: 110050, max: 229550,   rate: 0.0760 },
      { min: 229550, max: Infinity, rate: 0.0875 },
    ],
  },
  NH: {
    name: 'New Hampshire', hasIncomeTax: false,
    note: 'No state income tax on wages',
    brackets: [],
  },
  NY: {
    name: 'New York', hasIncomeTax: true,
    brackets: [
      { min: 0,       max: 17150,    rate: 0.04   },
      { min: 17150,   max: 23600,    rate: 0.045  },
      { min: 23600,   max: 27900,    rate: 0.0525 },
      { min: 27900,   max: 161550,   rate: 0.0585 },
      { min: 161550,  max: 323200,   rate: 0.0625 },
      { min: 323200,  max: 2155350,  rate: 0.0685 },
      { min: 2155350, max: Infinity, rate: 0.0965 },
    ],
  },
  MA: {
    name: 'Massachusetts', hasIncomeTax: true,
    note: 'Flat 5% rate on wages',
    brackets: [{ min: 0, max: Infinity, rate: 0.05 }],
  },
  CT: {
    name: 'Connecticut', hasIncomeTax: true,
    brackets: [
      { min: 0,      max: 10000,    rate: 0.02   },
      { min: 10000,  max: 50000,    rate: 0.045  },
      { min: 50000,  max: 100000,   rate: 0.055  },
      { min: 100000, max: 200000,   rate: 0.06   },
      { min: 200000, max: 250000,   rate: 0.065  },
      { min: 250000, max: 500000,   rate: 0.069  },
      { min: 500000, max: Infinity, rate: 0.0699 },
    ],
  },
  FL: { name: 'Florida',  hasIncomeTax: false, note: 'No state income tax', brackets: [] },
  TX: { name: 'Texas',    hasIncomeTax: false, note: 'No state income tax', brackets: [] },
  CA: {
    name: 'California', hasIncomeTax: true,
    note: 'CA SDI (0.9%) not included',
    brackets: [
      { min: 0,      max: 10756,    rate: 0.01  },
      { min: 10756,  max: 25499,    rate: 0.02  },
      { min: 25499,  max: 40245,    rate: 0.04  },
      { min: 40245,  max: 55866,    rate: 0.06  },
      { min: 55866,  max: 70606,    rate: 0.08  },
      { min: 70606,  max: 360659,   rate: 0.093 },
      { min: 360659, max: 432787,   rate: 0.103 },
      { min: 432787, max: 721314,   rate: 0.113 },
      { min: 721314, max: Infinity, rate: 0.123 },
    ],
  },
}

function bracketTax(annual, brackets) {
  let tax = 0
  for (const b of brackets) {
    if (annual <= b.min) break
    tax += (Math.min(annual, b.max) - b.min) * b.rate
  }
  return tax
}

function marginalBracket(annual, brackets) {
  let result = brackets[0] || null
  for (const b of brackets) {
    if (annual > b.min) result = b
    else break
  }
  return result
}

// ── Main payroll calculator ────────────────────────────────────────────────────
// Returns full breakdown including employer-side FICA for the owner view.
export function calcPayroll(hours, hourlyRate, payPeriodsPerYear = 52, ytdWages = 0, state = null) {
  const gross       = hours * hourlyRate
  const annualGross = gross * payPeriodsPerYear

  // Federal income tax
  const annualFederal   = bracketTax(annualGross, FEDERAL_BRACKETS)
  const federalTax      = annualFederal / payPeriodsPerYear
  const federalBracket  = marginalBracket(annualGross, FEDERAL_BRACKETS)
  const federalEffRate  = annualGross > 0 ? annualFederal / annualGross : 0

  // FICA — employee side
  const ssEligible    = Math.max(0, Math.min(gross, Math.max(0, SS_WAGE_BASE - ytdWages)))
  const socialSecurity = ssEligible * SS_RATE
  const medicare       = gross * MEDICARE_RATE

  // State income tax
  const stateInfo      = state ? (STATE_TAXES[state] ?? null) : null
  const annualState    = stateInfo?.hasIncomeTax ? bracketTax(annualGross, stateInfo.brackets) : 0
  const stateTax       = annualState / payPeriodsPerYear
  const stateBracket   = stateInfo?.hasIncomeTax ? marginalBracket(annualGross, stateInfo.brackets) : null
  const stateEffRate   = stateInfo?.hasIncomeTax && annualGross > 0 ? annualState / annualGross : 0

  const totalDeductions = federalTax + socialSecurity + medicare + stateTax
  const netPay = Math.max(0, gross - totalDeductions)

  // FICA — employer matching (employer owes these on top, not deducted from employee)
  const employerSS       = ssEligible * SS_RATE
  const employerMedicare = gross * MEDICARE_RATE

  // EFTPS = employee federal withholding + both employee and employer FICA shares
  const eftpsThisPeriod = federalTax + socialSecurity + employerSS + medicare + employerMedicare

  return {
    hours, hourlyRate, gross, annualGross,
    federalTax, federalBracket, federalEffRate,
    socialSecurity, medicare,
    stateTax, stateBracket, stateEffRate, stateInfo,
    totalDeductions, netPay,
    // Employer side
    employerSS, employerMedicare, eftpsThisPeriod,
  }
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

export function formatHours(h) {
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${hrs}h ${mins}m`
}

export function formatDuration(ms) {
  const s  = Math.floor(ms / 1000)
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return [hh, mm, ss].map(v => String(v).padStart(2, '0')).join(':')
}

export function formatPct(r, decimals = 2) {
  return `${(r * 100).toFixed(decimals).replace(/\.?0+$/, '')}%`
}
