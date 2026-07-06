import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import NotificationBell from './NotificationBell.jsx'
import ProfilePanel from './ProfilePanel.jsx'
import { getUnreadCommsCount } from '../lib/db.js'

// Primary tabs shown in the mobile bottom bar
const OWNER_LINKS = [
  { to: '/owner',           label: 'Dashboard', icon: GridIcon },
  { to: '/owner/schedule',  label: 'Schedule',  icon: CalendarIcon },
  { to: '/owner/active',    label: 'Active',    icon: ActivityIcon },
  { to: '/owner/comms',     label: 'Chat',      icon: ChatIcon },
]

// Secondary pages accessible via the "More" drawer
const OWNER_MORE_LINKS = [
  { to: '/owner/crew',       label: 'Crew',       icon: UsersIcon },
  { to: '/owner/payroll',    label: 'Payroll',    icon: DollarIcon },
  { to: '/owner/accounting', label: 'Accounting', icon: LedgerIcon },
  { to: '/owner/invoices',   label: 'Invoices',   icon: InvoiceIcon },
  { to: '/owner/personal',   label: 'Personal',   icon: WalletIcon },
  { to: '/owner/settings',   label: 'Settings',   icon: GearIcon },
]

const OWNER_SIDEBAR_LINKS = [
  { to: '/owner',           label: 'Dashboard', icon: GridIcon },
  { to: '/owner/schedule',  label: 'Schedule',  icon: CalendarIcon },
  { to: '/owner/active',    label: 'Active Jobs', icon: ActivityIcon },
  { to: '/owner/crew',      label: 'Crew',      icon: UsersIcon },
  { to: '/owner/payroll',   label: 'Payroll',   icon: DollarIcon },
  { to: '/owner/comms',     label: 'Chat',      icon: ChatIcon },
  { to: '/owner/settings',  label: 'Settings',  icon: GearIcon },
]

const OWNER_FINANCE_LINKS = [
  { to: '/owner/accounting', label: 'Accounting', icon: LedgerIcon },
  { to: '/owner/invoices',   label: 'Invoices',   icon: InvoiceIcon },
  { to: '/owner/personal',   label: 'Personal',   icon: WalletIcon },
]

const EMPLOYEE_LINKS = [
  { to: '/employee',           label: 'My Hours',    icon: ClockIcon },
  { to: '/employee/schedule',  label: 'My Schedule', icon: CalendarIcon },
  { to: '/employee/comms',     label: 'Chat',        icon: ChatIcon },
  { to: '/employee/personal',  label: 'Personal',    icon: WalletIcon },
  { to: '/employee/settings',  label: 'Settings',    icon: GearIcon },
]

export default function Layout() {
  const { user, businesses, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadComms, setUnreadComms] = useState(0)
  const [moreOpen, setMoreOpen]       = useState(false)
  const [panelOpen, setPanelOpen]     = useState(false)

  const isOwner = user?.role === 'owner' || user?.role === 'co_owner'
  const bottomLinks = isOwner ? OWNER_LINKS : EMPLOYEE_LINKS
  const activeBiz = businesses.find(b => b.id === user?.business_id)

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

        {/* User footer — click to open profile panel */}
        <div className="p-3 border-t border-slate-800 shrink-0">
          <button
            onClick={() => setPanelOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors group mb-2"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.name?.[0]}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">
                {activeBiz ? activeBiz.name : (user?.role === 'co_owner' ? 'Co-Owner' : user?.role === 'owner' ? 'Owner' : 'Employee')}
              </p>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <NotificationBell />
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="md:ml-60 min-h-screen pb-14 md:pb-0 relative">
        {/* Mobile top header */}
        <header className="md:hidden sticky top-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4 h-12 shrink-0">
          <span className="text-base font-bold text-white">Poly<span className="text-indigo-400">HQ</span></span>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setPanelOpen(true)}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              title="Profile"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]}
              </div>
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
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-14 bg-slate-900 border-t border-slate-800 flex items-stretch">
        {bottomLinks.map(({ to, label, icon: Icon }) => {
          const isChat = to.endsWith('/comms')
          return (
            <NavLink key={to} to={to} end
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500'}`
              }>
              <div className="relative">
                <Icon size="mobile" />
                {isChat && unreadComms > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                    {unreadComms > 9 ? '9+' : unreadComms}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </NavLink>
          )
        })}

        {isOwner && (
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${moreOpen ? 'text-indigo-400' : 'text-slate-500'}`}
          >
            <MoreIcon size="mobile" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        )}
      </nav>

      {/* ── More drawer ──────────────────────────────────────────────── */}
      {isOwner && (
        <>
          {/* Backdrop */}
          <div
            className={`md:hidden fixed inset-0 z-30 bg-black/60 transition-opacity duration-300 ${moreOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet — slides up from bottom-0; h-14 spacer keeps content above nav bar */}
          <div className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${moreOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}>
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-9 h-1 rounded-full bg-slate-700" />
            </div>

            {/* Nav rows */}
            <div className="px-3 pt-1 pb-2">
              {OWNER_MORE_LINKS.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-4 px-4 py-3.5 rounded-xl mb-0.5 transition-colors ${isActive ? 'bg-indigo-600/15 text-indigo-400' : 'text-slate-200 active:bg-slate-800'}`
                  }
                >
                  <Icon size="mobile" />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <ChevronRight />
                </NavLink>
              ))}
            </div>

            {/* Profile */}
            <div className="mx-3 border-t border-slate-800 pt-1 pb-2">
              <button
                onClick={() => { setMoreOpen(false); setPanelOpen(true) }}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl w-full text-slate-200 active:bg-slate-800 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {user?.name?.[0]}
                </div>
                <span className="flex-1 text-sm font-medium">Profile & Accounts</span>
                <ChevronRight />
              </button>
            </div>

            {/* Spacer — exactly the nav bar height so content never hides behind it */}
            <div className="h-14" />
          </div>
        </>
      )}
      {/* Profile panel */}
      <ProfilePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
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
function ActivityIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
function MoreIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
function WalletIcon({ size }) {
  const cls = size === 'mobile' ? 'w-5 h-5' : 'w-4 h-4 shrink-0'
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2z" />
      <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
function ChevronRight() {
  return (
    <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
