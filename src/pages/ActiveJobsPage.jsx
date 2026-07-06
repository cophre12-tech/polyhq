import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getJobsInRange, getTodayClockRecords, getAllTeamMembers, getNotesForJobs, updateJob } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'

const STATUS_META = {
  scheduled:   { label: 'Scheduled',   badge: 'bg-blue-500/15 text-blue-400',       border: 'border-l-blue-500',    next: 'in_progress', nextLabel: 'Start Job',    nextClass: 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20' },
  in_progress: { label: 'In Progress', badge: 'bg-amber-500/15 text-amber-400',     border: 'border-l-amber-500',   next: 'completed',   nextLabel: 'Mark Complete', nextClass: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20' },
  completed:   { label: 'Completed',   badge: 'bg-emerald-500/15 text-emerald-400', border: 'border-l-emerald-500', next: null,          nextLabel: '',              nextClass: '' },
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
  const d = new Date()
  const today = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
  const [jobs, setJobs]               = useState([])
  const [clockRecords, setClockRecords] = useState([])
  const [employees, setEmployees]     = useState([])
  const [notes, setNotes]             = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [advancing, setAdvancing]     = useState({}) // jobId → true while saving
  const [, setTick]                   = useState(0)  // forces re-render for live elapsed

  // Tick every 10 s to update elapsed time display without re-fetching
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const loadJobs = useCallback(async () => {
    const j = await getJobsInRange(today, today)
    const n = j.length ? await getNotesForJobs(j.map(x => x.id)) : []
    setJobs(j.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')))
    setNotes(n)
    setLastUpdated(new Date())
    setLoading(false)
  }, [today])

  const loadClock = useCallback(async () => {
    const [cr, emps] = await Promise.all([getTodayClockRecords(), getAllTeamMembers()])
    setClockRecords(cr)
    setEmployees(emps)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  const load = useCallback(async () => {
    await Promise.all([loadJobs(), loadClock()])
  }, [loadJobs, loadClock])

  // Keep a ref to the latest load so realtime callbacks don't capture stale closures
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load }, [load])

  // Initial load + 30 s polling fallback
  useEffect(() => {
    load()
    const id = setInterval(() => loadRef.current(), 30000)
    return () => clearInterval(id)
  }, [load])

  // Supabase Realtime — instant sync for job status changes and clock events
  useEffect(() => {
    const channel = supabase
      .channel('active-jobs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        loadRef.current?.loadJobs ? loadRef.current.loadJobs() : loadRef.current()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_records' }, () => {
        loadRef.current?.loadClock ? loadRef.current.loadClock() : loadRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function advanceStatus(job) {
    const meta = STATUS_META[job.status] || STATUS_META.scheduled
    if (!meta.next) return
    setAdvancing(p => ({ ...p, [job.id]: true }))
    try {
      await updateJob(job.id, { status: meta.next })
      // Optimistic update while realtime/poll catches up
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: meta.next } : j))
    } finally {
      setAdvancing(p => { const n = { ...p }; delete n[job.id]; return n })
    }
  }

  const clockedIn  = clockRecords.filter(r => !r.clock_out)
  const clockedOut = clockRecords.filter(r =>  r.clock_out)

  const latestNote = {}
  for (const note of notes) {
    if (!latestNote[note.job_id]) latestNote[note.job_id] = note
  }

  // Set of user_ids currently clocked in — used to badge employees on job cards
  const clockedInIds = new Set(clockedIn.map(r => r.user_id))

  function empName(uid)    { return employees.find(e => e.id === uid)?.name ?? 'Unknown' }
  function empInitial(uid) { return (employees.find(e => e.id === uid)?.name ?? '?')[0].toUpperCase() }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const inProgressCount = jobs.filter(j => j.status === 'in_progress').length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 mt-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              Active Jobs
            </h1>
            {inProgressCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                {inProgressCount} in progress
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Link
              to="/owner/schedule"
              className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Schedule
            </Link>
            <button
              onClick={load}
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-600">
              Updated {fmtTime(lastUpdated)} · live
            </p>
          )}
        </div>
      </div>

      {/* Today's Jobs */}
      <Section title="Today's Jobs" count={jobs.length} accentColor="indigo">
        {jobs.length === 0 ? (
          <Empty>
            No jobs scheduled for today.{' '}
            <Link to="/owner/schedule" className="text-indigo-400 hover:text-indigo-300">
              Go to Schedule →
            </Link>
          </Empty>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {jobs.map(job => {
              const meta     = STATUS_META[job.status] || STATUS_META.scheduled
              const assigned = (job.assigned_to || []).map(uid => ({
                uid, name: empName(uid), initial: empInitial(uid), clockedIn: clockedInIds.has(uid),
              }))
              const note    = latestNote[job.id]
              const busy    = !!advancing[job.id]
              return (
                <div key={job.id} className={`py-4 px-5 border-l-2 ${meta.border}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-semibold text-white">{job.client_name}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
                        {job.price > 0 && (
                          <span className="text-xs text-emerald-400 tabular-nums">${Number(job.price).toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{job.service_type}</p>
                      {job.client_address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(job.client_address)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-400/70 hover:text-indigo-300 mt-0.5 transition-colors"
                        >
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          <span className="truncate">{job.client_address}</span>
                        </a>
                      )}
                      {job.start_time && (
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {fmt12(job.start_time)}{job.end_time ? ` – ${fmt12(job.end_time)}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Assigned avatars with clocked-in indicator */}
                    {assigned.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {assigned.map(({ uid, name, initial, clockedIn: ci }) => (
                          <div key={uid} title={`${name}${ci ? ' · clocked in' : ''}`}
                            className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              ci
                                ? 'bg-amber-600/25 border border-amber-500/50 text-amber-300'
                                : 'bg-indigo-600/25 border border-indigo-500/40 text-indigo-300'
                            }`}>
                            {initial}
                            {ci && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900" title="Clocked in" />
                            )}
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

                  {/* Assigned names + status action button */}
                  <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
                    {assigned.length > 0 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {assigned.map(({ uid, name, clockedIn: ci }) => (
                          <span key={uid} className={`text-xs ${ci ? 'text-amber-400' : 'text-slate-500'}`}>
                            {name}{ci ? ' ●' : ''}
                          </span>
                        ))}
                      </div>
                    ) : <div />}

                    {/* Quick status advance button */}
                    {meta.next && (
                      <button
                        onClick={() => advanceStatus(job)}
                        disabled={busy}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 shrink-0 ${meta.nextClass}`}
                      >
                        {busy ? '…' : meta.nextLabel}
                      </button>
                    )}
                    {!meta.next && (
                      <span className="text-xs text-emerald-500 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Done
                      </span>
                    )}
                  </div>
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
            {clockedIn.map(r => {
              // Find jobs this person is assigned to today
              const theirJobs = jobs.filter(j => (j.assigned_to || []).includes(r.user_id))
              return (
                <div key={r.id} className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-300 shrink-0">
                      {empInitial(r.user_id)}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{empName(r.user_id)}</p>
                      <p className="text-xs text-slate-400">Since {fmtTime(r.clock_in)}</p>
                      {theirJobs.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {theirJobs.map(j => j.client_name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-amber-400 tabular-nums">{fmtDuration(r.clock_in)}</p>
                      <p className="text-xs text-slate-500">elapsed</p>
                    </div>
                  </div>
                </div>
              )
            })}
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
