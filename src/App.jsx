import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
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

function Root() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={OWNER_ROLES.includes(user.role) ? '/owner' : '/employee'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/" element={<Root />} />
      <Route element={<AuthLayout />}>
        <Route path="/owner" element={<RoleGuard role="owner"><OwnerDashboard /></RoleGuard>} />
        <Route path="/owner/crew" element={<RoleGuard role="owner"><CrewPage /></RoleGuard>} />
        <Route path="/owner/payroll" element={<RoleGuard role="owner"><PayrollPage /></RoleGuard>} />
        <Route path="/owner/accounting" element={<RoleGuard role="owner"><AccountingPage /></RoleGuard>} />
        <Route path="/owner/schedule" element={<RoleGuard role="owner"><SchedulePage /></RoleGuard>} />
        <Route path="/employee/schedule" element={<RoleGuard role="employee"><EmployeeSchedulePage /></RoleGuard>} />
        <Route path="/owner/invoices" element={<RoleGuard role="owner"><InvoicesPage /></RoleGuard>} />
        <Route path="/owner/invoices/new" element={<RoleGuard role="owner"><InvoiceEditorPage /></RoleGuard>} />
        <Route path="/owner/invoices/:id" element={<RoleGuard role="owner"><InvoiceViewPage /></RoleGuard>} />
        <Route path="/owner/invoices/:id/edit" element={<RoleGuard role="owner"><InvoiceEditorPage /></RoleGuard>} />
        <Route path="/owner/comms" element={<RoleGuard role="owner"><OwnerCommsPage /></RoleGuard>} />
        <Route path="/employee/comms" element={<RoleGuard role="employee"><EmployeeCommsPage /></RoleGuard>} />
        <Route path="/employee" element={<RoleGuard role="employee"><EmployeeDashboard /></RoleGuard>} />
      </Route>
    </Routes>
  )
}
