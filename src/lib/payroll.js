// 2024 IRS single-filer brackets
const BRACKETS = [
  { min: 0,       max: 11600,  rate: 0.10 },
  { min: 11600,   max: 47150,  rate: 0.12 },
  { min: 47150,   max: 100525, rate: 0.22 },
  { min: 100525,  max: 191950, rate: 0.24 },
  { min: 191950,  max: 243725, rate: 0.32 },
  { min: 243725,  max: 609350, rate: 0.35 },
  { min: 609350,  max: Infinity, rate: 0.37 },
]

const SS_RATE = 0.062
const MEDICARE_RATE = 0.0145
const SS_WAGE_BASE = 168600

function annualFederalTax(income) {
  let tax = 0
  for (const b of BRACKETS) {
    if (income <= b.min) break
    tax += (Math.min(income, b.max) - b.min) * b.rate
  }
  return tax
}

export function calcPayroll(hours, hourlyRate, payPeriodsPerYear = 52, ytdWages = 0) {
  const gross = hours * hourlyRate
  const federalTax = annualFederalTax(gross * payPeriodsPerYear) / payPeriodsPerYear
  const ssEligible = Math.max(0, Math.min(gross, Math.max(0, SS_WAGE_BASE - ytdWages)))
  const socialSecurity = ssEligible * SS_RATE
  const medicare = gross * MEDICARE_RATE
  const totalDeductions = federalTax + socialSecurity + medicare
  const netPay = Math.max(0, gross - totalDeductions)
  return { hours, hourlyRate, gross, federalTax, socialSecurity, medicare, totalDeductions, netPay }
}

export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function formatHours(h) {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${hrs}h ${mins}m`
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000)
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return [hh, mm, ss].map(v => String(v).padStart(2, '0')).join(':')
}
