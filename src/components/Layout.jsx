import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import NotificationBell from './NotificationBell.jsx'
import { getUnreadCommsCount } from '../lib/db.js'

const OWNER_LINKS = [
  { to: '/owner',           label: 'Dashboard', icon: GridIcon },
  { to: '/owner/schedule',  label: 'Schedule',  icon: CalendarIcon },
  { to: '/owner/crew',      label: 'Crew',      icon: UsersIcon },
  { to: '/owner/payroll',   label: 'Payroll',   icon: DollarIcon },
  { to: '/owner/accounting',label: 'Finance',   icon: LedgerIcon },
  { to: '/owner/comms',     label: 'Chat',      icon: ChatIcon },
]

const OWNER_SIDEBAR_LINKS = [
  { to: '/owner',           label: 'Dashboard', icon: GridIcon },
  { to: '/owner/schedule',  label: 'Schedule',  icon: CalendarIcon },
  { to: '/owner/crew',      label: 'Crew',      icon: UsersIcon },
  { to: '/owner/payroll',   label: 'Payroll',   icon: DollarIcon },
  { to: '/owner/comms',     label: 'Chat',      icon: ChatIcon },
  { to: '/owner/settings',  label: 'Settings',  icon: GearIcon },
]

const OWNER_FINANCE_LINKS = [
  { to: '/owner/accounting', label: 'Accounting', icon: LedgerIcon },
  { to: '/owner/invoices',   label: 'Invoices',   icon: InvoiceIcon },
]

const EMPLOYEE_LINKS = [
  { to: '/employee',          label: 'My Hours',    icon: ClockIcon },
  { to: '/employee/schedule', label: 'My Schedule', icon: CalendarIcon },
  { to: '/employee/comms',    label: 'Chat',        icon: ChatIcon },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadComms, setUnreadComms] = useState(0)

  const isOwner = user?.role === 'owner' || user?.role === 'co_owner'
  const bottomLinks = isOwner ? OWNER_LINKS : EMPLOYEE_LINKS

  useEffect(() => {
    let mounted = true
    async function check() {
      const count = await getUnreadCommsCount(user.id)
      if (mounted) setUnreadComms(count)
    }
    check()
    const id = setInterval(check, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [user.id])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-slate-900 border-r border-slate-800">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <span className="text-xl font-bold tracking-tight text-white">
            Poly<span className="text-indigo-400">HQ</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {(isOwner ? OWNER_SIDEBAR_LINKS : EMPLOYEE_LINKS).map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`
                }>
                <Icon />{label}
              </NavLink>
            ))}
          </div>

          {isOwner && (
            <>
              <div className="my-4 border-t border-slate-800" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">Finance</p>
              <div className="space-y-0.5">
                {OWNER_FINANCE_LINKS.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`
                    }>
                    <Icon />{label}
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role === 'co_owner' ? 'Co-Owner' : user?.role === 'owner' ? 'Owner' : 'Employee'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="flex-1 text-sm text-slate-400 hover:text-white py-1.5 px-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="md:ml-60 min-h-screen pb-20 md:pb-0 relative">
        {/* Mobile top header */}
        <header className="md:hidden sticky top-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4 h-12 shrink-0">
          <span className="text-base font-bold text-white">Poly<span className="text-indigo-400">HQ</span></span>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Mobile background watermark */}
        <div className="md:hidden fixed inset-x-0 top-12 bottom-16 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
          <div className="opacity-[0.035] text-center -rotate-12">
            <p className="font-black tracking-tight text-white leading-none" style={{ fontSize: '22vw' }}>Poly</p>
            <p className="font-black tracking-tight text-indigo-400 leading-none" style={{ fontSize: '28vw' }}>HQ</p>
          </div>
        </div>
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800 flex">
        {bottomLinks.map(({ to, label, icon: Icon }) => {
          const isChat = to.endsWith('/comms')
          return (
            <NavLink key={to} to={to} end
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`
              }>
              <div className="relative">
                <Icon size="mobile" />
                {isChat && unreadComms > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                    {unreadComms > 9 ? '9+' : unreadComms}
                  </span>
                )}
              </div>
              <span className="leading-none mt-0.5">{label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

/* ── Icons ────────────────────────────────────────────────────────────── */
function GridIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function DollarIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  )
}
function UsersIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function CalendarIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function LedgerIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}
function InvoiceIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function ClockIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  )
}
function GearIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function ChatIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}
