import { useState, useEffect, useCallback } from 'react'
import { getJobsInRange, getTodayClockRecords, getAllTeamMembers, getNotesForJobs } from '../lib/db.js'

const STATUS_META = {
  scheduled:   { label: 'Scheduled',   badge: 'bg-blue-500/15 text-blue-400',      border: 'border-l-blue-500' },
  in_progress: { label: 'In Progress', badge: 'bg-amber-500/15 text-amber-400',    border: 'border-l-amber-500' },
  completed:   { label: 'Completed',   badge: 'bg-emerald-500/15 text-emerald-400', border: 'border-l-emerald-500' },
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtDuration(start, end = new Date()) {
  const ms = Math.max(0, new Date(end) - new Date(start))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function ActiveJobsPage() {
  const today = new Date().toISOString().split('T')[0]
  const [jobs, setJobs]               = useState([])
  const [clockRecords, setClockRecords] = useState([])
  const [employees, setEmployees]     = useState([])
  const [notes, setNotes]             = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading]         = useState(true)

  const load = useCallback(async () => {
    const [j, cr, emps] = await Promise.all([
      getJobsInRange(today, today),
      getTodayClockRecords(),
      getAllTeamMembers(),
    ])
    const n = j.length ? await getNotesForJobs(j.map(x => x.id)) : []
    setJobs(j.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')))
    setClockRecords(cr)
    setEmployees(emps)
    setNotes(n)
    setLastUpdated(new Date())
    setLoading(false)
  }, [today])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const clockedIn  = clockRecords.filter(r => !r.clock_out)
  const clockedOut = clockRecords.filter(r =>  r.clock_out)

  // Latest note per job_id
  const latestNote = {}
  for (const note of notes) {
    if (!latestNote[note.job_id]) latestNote[note.job_id] = note
  }

  function empName(uid) {
    return employees.find(e => e.id === uid)?.name ?? 'Unknown'
  }
  function empInitial(uid) {
    return (employees.find(e => e.id === uid)?.name ?? '?')[0].toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 mt-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Active Jobs
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <button
            onClick={load}
            className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Refresh
          </button>
          {lastUpdated && (
            <p className="text-xs text-slate-600 mt-1.5">
              Updated {fmtTime(lastUpdated)} · auto-refreshes every 30s
            </p>
          )}
        </div>
      </div>

      {/* Today's Jobs */}
      <Section title="Today's Jobs" count={jobs.length} accentColor="indigo">
        {jobs.length === 0 ? (
          <Empty>No jobs scheduled for today.</Empty>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {jobs.map(job => {
              const meta = STATUS_META[job.status] || STATUS_META.scheduled
              const assigned = (job.assigned_to || []).map(uid => ({ uid, name: empName(uid), initial: empInitial(uid) }))
              const note = latestNote[job.id]
              return (
                <div key={job.id} className={`py-4 px-5 border-l-2 ${meta.border}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-semibold text-white">{job.client_name}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
                        {job.price > 0 && (
                          <span className="text-xs text-slate-500">${Number(job.price).toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{job.service_type}</p>
                      {job.client_address && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{job.client_address}</p>
                      )}
                      {job.start_time && (
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {fmt12(job.start_time)}{job.end_time ? ` – ${fmt12(job.end_time)}` : ''}
                        </p>
                      )}
                    </div>
                    {assigned.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {assigned.map(({ uid, name, initial }) => (
                          <div key={uid} title={name}
                            className="w-7 h-7 rounded-full bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                            {initial}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Latest progress note */}
                  {note && (
                    <div className="mt-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 leading-snug">"{note.body}"</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {empName(note.user_id)} · {timeAgo(note.created_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Assigned names list if no avatars fit info */}
                  {assigned.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                      {assigned.map(({ uid, name }) => (
                        <span key={uid} className="text-xs text-slate-500">{name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Currently Clocked In */}
      <Section title="Currently Clocked In" count={clockedIn.length} accentColor="amber">
        {clockedIn.length === 0 ? (
          <Empty>Nobody is clocked in right now.</Empty>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {clockedIn.map(r => (
              <div key={r.id} className="py-3.5 px-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-300 shrink-0">
                  {empInitial(r.user_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{empName(r.user_id)}</p>
                  <p className="text-xs text-slate-400">Clocked in at {fmtTime(r.clock_in)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-amber-400 tabular-nums">{fmtDuration(r.clock_in)}</p>
                  <p className="text-xs text-slate-500">elapsed</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Clocked Out Today */}
      <Section title="Clocked Out Today" count={clockedOut.length} accentColor="slate">
        {clockedOut.length === 0 ? (
          <Empty>No one has clocked out yet today.</Empty>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {clockedOut.map(r => (
              <div key={r.id} className="py-3.5 px-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
                  {empInitial(r.user_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{empName(r.user_id)}</p>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {fmtTime(r.clock_in)} → {fmtTime(r.clock_out)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-300 tabular-nums">{fmtDuration(r.clock_in, r.clock_out)}</p>
                  <p className="text-xs text-slate-500">total</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, count, accentColor = 'indigo', children }) {
  const countColors = {
    indigo: 'bg-indigo-500/15 text-indigo-400',
    amber:  'bg-amber-500/15 text-amber-400',
    slate:  'bg-slate-700/60 text-slate-400',
  }
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-4">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <h2 className="font-semibold text-white text-sm">{title}</h2>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${countColors[accentColor]}`}>{count}</span>
      </div>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p className="px-5 py-8 text-center text-slate-500 text-sm">{children}</p>
}
