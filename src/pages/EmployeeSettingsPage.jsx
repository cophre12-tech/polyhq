import PushDiagnosticPanel from '../components/PushDiagnosticPanel.jsx'

export default function EmployeeSettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-fg">Settings</h1>
        <p className="text-fg-muted mt-1 text-sm">Manage your notification preferences</p>
      </div>
      <PushDiagnosticPanel />
    </div>
  )
}
