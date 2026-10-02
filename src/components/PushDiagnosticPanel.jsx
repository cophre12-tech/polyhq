import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { requestAndSubscribe } from '../lib/push.js'

export default function PushDiagnosticPanel() {
  const { user } = useAuth()
  const [steps, setSteps]     = useState(null)
  const [running, setRunning] = useState(false)

  const swSupported = 'serviceWorker' in navigator && 'PushManager' in window
  const vapidKeySet = !!import.meta.env.VITE_VAPID_PUBLIC_KEY
  const permission  = 'Notification' in window ? Notification.permission : 'unsupported'

  async function runTest() {
    setRunning(true)
    setSteps(null)
    const result = await requestAndSubscribe(user?.id, user?.business_id)
    setSteps(result)
    setRunning(false)
  }

  const allPassed = steps?.length > 0 && steps.every(s => s.ok)

  return (
    <div className="bg-surface border border-line rounded-xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-fg mb-1">Push Notifications</h2>
          <p className="text-xs text-fg-muted">
            Alerts for clock-ins, job completions, and reminders — even when the app is closed.
          </p>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={running}
          className="btn-primary shrink-0 flex gap-2 px-4 py-2 text-xs"
        >
          {running
            ? <><Spinner /> Testing…</>
            : steps ? 'Re-test' : 'Test Subscription'
          }
        </button>
      </div>

      {/* Static environment checks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <EnvCheck
          ok={swSupported}
          label="Browser support"
          detail={swSupported ? 'SW + PushManager' : 'Not supported'}
        />
        <EnvCheck
          ok={vapidKeySet}
          label="VAPID key"
          detail={vapidKeySet ? 'VITE_VAPID_PUBLIC_KEY set' : 'Not set in .env'}
        />
        <EnvCheck
          ok={permission === 'granted'}
          warn={permission === 'default'}
          label="Permission"
          detail={
            permission === 'granted'   ? 'Granted' :
            permission === 'denied'    ? 'Blocked — reset in browser settings' :
            permission === 'default'   ? 'Not yet requested' :
                                         'Unsupported'
          }
        />
      </div>

      {permission === 'denied' && (
        <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-4">
          Notifications are blocked. Click the lock icon in your browser address bar, set Notifications to Allow, then reload and re-test.
        </p>
      )}

      {steps && (
        <div className="border border-line rounded-lg overflow-hidden">
          <div className={`px-3 py-2 text-xs font-semibold border-b border-line ${allPassed ? 'text-success bg-success/5' : 'text-danger bg-danger/5'}`}>
            {allPassed ? 'All steps passed — subscription active' : 'Failed at step below'}
          </div>
          <div className="divide-y divide-line">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                <span className={`mt-0.5 shrink-0 text-sm ${s.ok ? 'text-success' : 'text-danger'}`}>
                  {s.ok ? '✓' : '✗'}
                </span>
                <div className="min-w-0">
                  <span className={`text-xs font-medium ${s.ok ? 'text-fg' : 'text-danger'}`}>{s.label}</span>
                  <p className="text-xs text-fg-subtle mt-0.5 break-all">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!steps && (
        <p className="text-xs text-fg-subtle">
          Click <span className="text-fg-muted">Test Subscription</span> to run the full subscription flow and see exactly where it succeeds or fails.
        </p>
      )}
    </div>
  )
}

function EnvCheck({ ok, warn, label, detail }) {
  const color = ok ? 'text-success' : warn ? 'text-warning' : 'text-danger'
  const bg    = ok ? 'bg-success/5 border-success/20' : warn ? 'bg-warning/5 border-warning/20' : 'bg-danger/5 border-danger/20'
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${bg}`}>
      <span className={`text-sm shrink-0 mt-0.5 ${color}`}>{ok ? '✓' : warn ? '~' : '✗'}</span>
      <div className="min-w-0">
        <p className={`text-xs font-medium ${color}`}>{label}</p>
        <p className="text-xs text-fg-subtle truncate">{detail}</p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
