import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { useSubscription } from './hooks/useSubscription.js'
import FeatureGate from './components/FeatureGate.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import OwnerDashboard from './pages/OwnerDashboard.jsx'
import EmployeeDashboard from './pages/EmployeeDashboard.jsx'
import PayrollPage from './pages/PayrollPage.jsx'
import CrewPage from './pages/CrewPage.jsx'
import AccountingPage from './pages/AccountingPage.jsx'
import SchedulePage from './pages/SchedulePage.jsx'
import EmployeeSchedulePage from './pages/EmployeeSchedulePage.jsx'
import InvoicesPage from './pages/InvoicesPage.jsx'
import InvoiceEditorPage from './pages/InvoiceEditorPage.jsx'
import InvoiceViewPage from './pages/InvoiceViewPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import OwnerCommsPage from './pages/OwnerCommsPage.jsx'
import EmployeeCommsPage from './pages/EmployeeCommsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import EmployeeSettingsPage from './pages/EmployeeSettingsPage.jsx'
import ActiveJobsPage from './pages/ActiveJobsPage.jsx'
import PersonalFinancialsPage from './pages/PersonalFinancialsPage.jsx'
import TaxFormsPage from './pages/TaxFormsPage.jsx'
import ExpensesPage from './pages/ExpensesPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

const ADMIN_EMAIL = 'cophre12@gmail.com'

// Standalone guard — no Layout wrapper. Signed-out visitors go to login and
// come back here afterwards; a non-admin account gets an explicit message
// instead of a silent redirect (which looks like the page is broken).
function AdminGuard({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface border border-line rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-fg mb-2">Admin access required</h1>
          <p className="text-sm text-fg-muted mb-6">
            You're signed in as <span className="text-fg">{user.email}</span>, which isn't an admin account.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={logout}
              className="btn-primary w-full text-sm px-4 py-2.5"
            >
              Sign out and switch account
            </button>
            <a
              href={OWNER_ROLES.includes(user.role) ? '/owner' : '/employee'}
              className="text-sm text-fg-muted hover:text-fg py-2"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }
  return children
}

function AuthLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

const OWNER_ROLES = ['owner', 'co_owner']

function RoleGuard({ role, children }) {
  const { user } = useAuth()
  const userRole = user?.role
  const allowed = role === 'owner' ? OWNER_ROLES.includes(userRole) : userRole === role
  if (!allowed) {
    return <Navigate to={OWNER_ROLES.includes(userRole) ? '/owner' : '/employee'} replace />
  }
  return children
}

function SubscriptionGuard({ feature, children }) {
  const { canUse } = useSubscription()
  const { loading } = useAuth()
  if (loading) return null
  if (!canUse(feature)) return <FeatureGate feature={feature} />
  return children
}

function Root() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={OWNER_ROLES.includes(user.role) ? '/owner' : '/employee'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/" element={<Root />} />
      <Route element={<AuthLayout />}>
        <Route path="/owner" element={<RoleGuard role="owner"><OwnerDashboard /></RoleGuard>} />
        <Route path="/owner/crew" element={<RoleGuard role="owner"><CrewPage /></RoleGuard>} />
        <Route path="/owner/payroll" element={<RoleGuard role="owner"><PayrollPage /></RoleGuard>} />
        <Route path="/owner/accounting" element={<RoleGuard role="owner"><SubscriptionGuard feature="accounting"><AccountingPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/expenses" element={<RoleGuard role="owner"><ExpensesPage /></RoleGuard>} />
        <Route path="/owner/schedule" element={<RoleGuard role="owner"><SubscriptionGuard feature="scheduling"><SchedulePage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/active" element={<RoleGuard role="owner"><SubscriptionGuard feature="active_jobs"><ActiveJobsPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/employee/schedule" element={<RoleGuard role="employee"><SubscriptionGuard feature="scheduling"><EmployeeSchedulePage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/invoices" element={<RoleGuard role="owner"><SubscriptionGuard feature="invoicing"><InvoicesPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/invoices/new" element={<RoleGuard role="owner"><SubscriptionGuard feature="invoicing"><InvoiceEditorPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/invoices/:id" element={<RoleGuard role="owner"><SubscriptionGuard feature="invoicing"><InvoiceViewPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/invoices/:id/edit" element={<RoleGuard role="owner"><SubscriptionGuard feature="invoicing"><InvoiceEditorPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/comms" element={<RoleGuard role="owner"><SubscriptionGuard feature="comms"><OwnerCommsPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/employee/comms" element={<RoleGuard role="employee"><SubscriptionGuard feature="comms"><EmployeeCommsPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/owner/settings" element={<RoleGuard role="owner"><SettingsPage /></RoleGuard>} />
        <Route path="/employee/settings" element={<RoleGuard role="employee"><EmployeeSettingsPage /></RoleGuard>} />
        <Route path="/owner/personal" element={<RoleGuard role="owner"><PersonalFinancialsPage /></RoleGuard>} />
        <Route path="/owner/tax-forms" element={<RoleGuard role="owner"><SubscriptionGuard feature="tax_forms"><TaxFormsPage /></SubscriptionGuard></RoleGuard>} />
        <Route path="/employee/personal" element={<RoleGuard role="employee"><PersonalFinancialsPage /></RoleGuard>} />
        <Route path="/employee" element={<RoleGuard role="employee"><EmployeeDashboard /></RoleGuard>} />
      </Route>
    </Routes>
  )
}
