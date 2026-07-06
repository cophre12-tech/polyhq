import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription.js'

const FEATURE_INFO = {
  invoicing:        { name: 'Invoicing',                       minPlan: 'Pro',      priceLabel: '$15/mo' },
  accounting:       { name: 'Accounting & Reports',            minPlan: 'Pro',      priceLabel: '$15/mo' },
  payroll_advanced: { name: 'Detailed Tax Breakdown & EFTPS',  minPlan: 'Business', priceLabel: '$29/mo' },
}

// Full-page lock — use as the return value of a page component
export default function FeatureGate({ feature }) {
  const navigate = useNavigate()
  const info = FEATURE_INFO[feature] || { name: feature, minPlan: 'Pro', priceLabel: '$15/mo' }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 sm:p-12 flex flex-col items-center text-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <LockIcon />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white mb-2">{info.name}</h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
            This feature is available on the <span className="text-white font-semibold">{info.minPlan}</span> plan
            ({info.priceLabel}). Upgrade to unlock it.
          </p>
        </div>
        <button
          onClick={() => navigate('/owner/settings', { state: { tab: 'subscription' } })}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors"
        >
          View Plans
        </button>
      </div>
    </div>
  )
}

// Inline lock — use inside a page to block a section
export function InlineFeatureGate({ feature, children }) {
  const { canUse } = useSubscription()
  if (canUse(feature)) return children

  const info = FEATURE_INFO[feature] || { name: feature, minPlan: 'Pro', priceLabel: '$15/mo' }
  const navigate = useNavigate()

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm opacity-30" aria-hidden>
        {children}
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl px-6 py-5 flex flex-col items-center gap-3 shadow-xl max-w-xs w-full mx-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <LockIcon small />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white mb-0.5">{info.name}</p>
            <p className="text-xs text-slate-400">Requires {info.minPlan} plan · {info.priceLabel}</p>
          </div>
          <button
            onClick={() => navigate('/owner/settings', { state: { tab: 'subscription' } })}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-2 text-xs transition-colors"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  )
}

function LockIcon({ small }) {
  const cls = small ? 'w-4 h-4 text-indigo-400' : 'w-6 h-6 text-indigo-400'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
