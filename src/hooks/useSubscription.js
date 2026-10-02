import { useAuth } from '../context/AuthContext.jsx'

const ADMIN_EMAILS = new Set(['cophre12@gmail.com', 'caribera@icloud.com'])

const PLAN_FEATURES = {
  // Pro+ features
  scheduling:          ['pro', 'business'],
  active_jobs:         ['pro', 'business'],
  comms:               ['pro', 'business'],
  invoicing:           ['pro', 'business'],
  accounting:          ['pro', 'business'],
  // Business-only features
  payroll_advanced:    ['business'],
  tax_forms:           ['business'],
}

export const EMPLOYEE_LIMITS = {
  free:     3,
  pro:      10,
  business: Infinity,
}

export const PLAN_META = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: 'Free',
    employeeLimit: 3,
    color: 'slate',
    features: ['Clock in/out', 'Basic payroll', 'Expense tracking', 'Personal financials', 'Up to 3 employees'],
  },
  pro: {
    name: 'Pro',
    price: 15,
    priceLabel: '$15/mo',
    employeeLimit: 10,
    color: 'indigo',
    features: ['Everything in Free', 'Scheduling & active jobs', 'Invoicing', 'Full accounting & reports', 'Team chat', 'Up to 10 employees'],
  },
  business: {
    name: 'Business',
    price: 29,
    priceLabel: '$29/mo',
    employeeLimit: Infinity,
    color: 'violet',
    features: ['Everything in Pro', 'Payroll tax details & EFTPS', 'Tax forms (Sched C, 1065, 1120-S)', 'Unlimited employees'],
  },
}

export function useSubscription() {
  const { user, plan } = useAuth()
  const isAdmin = ADMIN_EMAILS.has(user?.email)
  const effectivePlan = isAdmin ? 'business' : (plan || 'free')

  function canUse(feature) {
    if (isAdmin) return true
    return (PLAN_FEATURES[feature] || []).includes(effectivePlan)
  }

  const employeeLimit = isAdmin ? Infinity : (EMPLOYEE_LIMITS[effectivePlan] ?? 3)

  return { plan: effectivePlan, isAdmin, canUse, employeeLimit }
}
