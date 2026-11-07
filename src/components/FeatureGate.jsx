import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useSubscription } from '../hooks/useSubscription.js'

const FEATURE_INFO = {
  scheduling:          {
    name: 'Job Scheduling',
    minPlan: 'Pro',
    priceLabel: '$15/mo',
    description: 'Schedule jobs, assign crew, and manage your calendar. View upcoming work and track completions.',
  },
  active_jobs:         {
    name: 'Active Jobs',
    minPlan: 'Pro',
    priceLabel: '$15/mo',
    description: 'Real-time view of jobs in progress. Add notes, photos, and update job status from the field.',
  },
  comms:               {
    name: 'Team Chat',
    minPlan: 'Pro',
    priceLabel: '$15/mo',
    description: 'Direct messages and announcements between owners and crew members.',
  },
  invoicing:           {
    name: 'Invoicing',
    minPlan: 'Pro',
    priceLabel: '$15/mo',
    description: 'Create and send professional invoices. Track paid, pending, and overdue invoices.',
  },
  accounting:          {
    name: 'Accounting & Reports',
    minPlan: 'Pro',
    priceLabel: '$15/mo',
    description: 'Full revenue tracking, profit/loss graphs, expense reports, and financial summaries.',
  },
  payroll_advanced:    {
    name: 'Detailed Payroll & EFTPS',
    minPlan: 'Business',
    priceLabel: '$29/mo',
    description: 'Per-employee federal, state, and FICA breakdowns. EFTPS remittance tracking.',
  },
  personal_financials: {
    name: 'Personal Financials',
    minPlan: 'Business',
    priceLabel: '$29/mo',
    description: 'Private income and expense tracking — completely invisible to your team.',
  },
  tax_forms:           {
    name: 'Tax Forms',
    minPlan: 'Business',
    priceLabel: '$29/mo',
    description: 'Schedule C, Form 1065, and Form 1120-S walkthroughs powered by your real business data.',
  },
}

const PLAN_COLORS = {
  Pro:      { bar: ' ', btn: 'btn-primary', badge: 'text-accent-fg bg-accent-subtle border-accent/25' },
  Business: { bar: ' ', btn: 'btn-primary', badge: 'text-accent-fg bg-accent-subtle border-accent/25' },
}

// Full-page lock — returned instead of a page component
export default function FeatureGate({ feature }) {
  const { plan }  = useSubscription()
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const isOwner   = user?.role === 'owner' || user?.role === 'co_owner'

  const info   = FEATURE_INFO[feature] || { name: feature, minPlan: 'Pro', priceLabel: '$15/mo', description: 'Upgrade to unlock this feature.' }
  const colors = PLAN_COLORS[info.minPlan] || PLAN_COLORS.Pro
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex justify-start">
      <div className="bg-surface border border-line rounded-2xl overflow-hidden w-full max-w-md">
        <div className={`h-1  ${colors.bar}`} />
        <div className="p-8 flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-raised border border-line flex items-center justify-center">
            <LockIcon className="w-6 h-6 text-fg-muted" />
          </div>

          <div>
            {/* Plan badges */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-xs font-semibold text-fg-subtle bg-raised border border-line rounded-full px-2.5 py-0.5 capitalize">
                {planLabel} plan
              </span>
              <svg className="w-3 h-3 text-fg-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${colors.badge}`}>
                {info.minPlan} required
              </span>
            </div>

            <h2 className="text-lg font-semibold text-fg mb-2">{info.name}</h2>
            <p className="text-sm text-fg-muted leading-relaxed max-w-sm">{info.description}</p>
          </div>

          {isOwner ? (
            <>
              <button
                onClick={() => navigate('/owner/settings', { state: { tab: 'subscription' } })}
                className={`text-fg font-semibold rounded-xl px-6 py-2.5 text-sm transition-colors ${colors.btn}`}
              >
                View Plans &amp; Upgrade
              </button>
              <p className="text-xs text-fg-subtle">{info.priceLabel} · Cancel anytime</p>
            </>
          ) : (
            <div className="bg-raised border border-line rounded-xl px-5 py-4 text-sm text-fg-muted">
              Ask your business owner to upgrade to <span className="text-fg font-semibold">{info.minPlan}</span> to unlock this feature.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline lock — wraps a section inside a page
export function InlineFeatureGate({ feature, children }) {
  const { canUse }  = useSubscription()
  const { user }    = useAuth()
  const navigate    = useNavigate()
  if (canUse(feature)) return children

  const isOwner = user?.role === 'owner' || user?.role === 'co_owner'
  const info    = FEATURE_INFO[feature] || { name: feature, minPlan: 'Pro', priceLabel: '$15/mo' }
  const colors  = PLAN_COLORS[info.minPlan] || PLAN_COLORS.Pro

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-25" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface/95 border border-line rounded-xl px-6 py-5 flex flex-col items-center gap-3 max-w-xs w-full mx-4">
          <div className="w-9 h-9 rounded-xl bg-raised border border-line flex items-center justify-center">
            <LockIcon className="w-4 h-4 text-fg-muted" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-fg mb-0.5">{info.name}</p>
            <p className="text-xs text-fg-muted">{info.minPlan} plan · {info.priceLabel}</p>
          </div>
          {isOwner ? (
            <button
              onClick={() => navigate('/owner/settings', { state: { tab: 'subscription' } })}
              className={`text-fg font-semibold rounded-lg px-5 py-2 text-xs transition-colors ${colors.btn}`}
            >
              Upgrade to {info.minPlan}
            </button>
          ) : (
            <p className="text-xs text-fg-subtle text-center">Contact your owner to upgrade.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function LockIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
