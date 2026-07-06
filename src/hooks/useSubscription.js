import { useAuth } from '../context/AuthContext.jsx'

const ADMIN_EMAIL = 'cophre12@gmail.com'

// Features available per plan
const PLAN_FEATURES = {
  invoicing:            ['pro', 'business'],
  accounting:           ['pro', 'business'],
  payroll_advanced:     ['business'],
  personal_financials:  ['pro', 'business'],
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
  },
  pro: {
    name: 'Pro',
    price: 15,
    priceLabel: '$15/mo',
    employeeLimit: 10,
    color: 'indigo',
  },
  business: {
    name: 'Business',
    price: 29,
    priceLabel: '$29/mo',
    employeeLimit: Infinity,
    color: 'violet',
  },
}

export function useSubscription() {
  const { user, plan } = useAuth()
  const isAdmin = user?.email === ADMIN_EMAIL
  const effectivePlan = isAdmin ? 'business' : (plan || 'free')

  function canUse(feature) {
    if (isAdmin) return true
    return (PLAN_FEATURES[feature] || []).includes(effectivePlan)
  }

  const employeeLimit = isAdmin ? Infinity : (EMPLOYEE_LIMITS[effectivePlan] ?? 3)

  return { plan: effectivePlan, isAdmin, canUse, employeeLimit }
}
