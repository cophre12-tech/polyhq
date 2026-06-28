import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getNotifications, getUnreadCount,
  markNotificationRead, markAllNotificationsRead,
} from '../lib/db.js'

function timeAgo(dt) {
  const s = (Date.now() - new Date(dt)) / 1000
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

const TYPE_ICON = {
  job_assigned: { bg: 'bg-indigo-500/15', icon: '📋' },
  job_updated:  { bg: 'bg-amber-500/15',  icon: '📅' },
  default:      { bg: 'bg-slate-700',     icon: '🔔' },
}

export default function NotificationBell() {
  const { user }    = useAuth()
  const [open, setOpen]   = useState(false)
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  function load() {
    setNotifs(getNotifications(user.id))
    setUnread(getUnreadCount(user.id))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [user.id])

  // Request browser notification permission once
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Trigger browser notification when new unread arrives (same session)
  const prevUnread = useRef(0)
  useEffect(() => {
    if (unread > prevUnread.current && prevUnread.current >= 0) {
      const latest = notifs.find(n => !n.read)
      if (latest && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('PolyHQ', { body: latest.message, icon: '/favicon.ico' })
      }
    }
    prevUnread.current = unread
  }, [unread])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function clickNotif(id) {
    markNotificationRead(id); load()
  }

  function markAll() {
    markAllNotificationsRead(user.id); load()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); load() }}
        className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h4 className="text-sm font-semibold text-white">Notifications</h4>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-slate-400 hover:text-indigo-400 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => {
                const { bg, icon } = TYPE_ICON[n.type] || TYPE_ICON.default
                return (
                  <button
                    key={n.id}
                    onClick={() => clickNotif(n.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors flex items-start gap-3 ${!n.read ? 'bg-indigo-500/5' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center text-sm shrink-0 mt-0.5`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug ${n.read ? 'text-slate-300' : 'text-white'}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-xs text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
