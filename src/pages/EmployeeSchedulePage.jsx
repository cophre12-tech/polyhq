import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getJobsForEmployee, updateJob, getAvailability, toggleUnavailableDate } from '../lib/db.js'

const STATUS_META = {
  scheduled:   { label: 'Scheduled',   badge: 'bg-blue-500/15 text-blue-400',     border: 'border-l-blue-500' },
  in_progress: { label: 'In Progress', badge: 'bg-amber-500/15 text-amber-400',   border: 'border-l-amber-500' },
  completed:   { label: 'Completed',   badge: 'bg-emerald-500/15 text-emerald-400', border: 'border-l-emerald-500' },
}

function fmt12(t) {
  if (!t) return ''
  const [h,m] = t.split(':').map(Number)
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function EmployeeSchedulePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('jobs')
  const [jobs, setJobs] = useState([])
  const [unavailable, setUnavailable] = useState([])

  function load() {
    setJobs(getJobsForEmployee(user.id))
    setUnavailable(getAvailability(user.id))
  }
  useEffect(() => { load() }, [user.id])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = jobs.filter(j => j.date >= today)
  const past     = jobs.filter(j => j.date < today)

  const grouped = upcoming.reduce((acc, job) => {
    acc[job.date] = acc[job.date] || []
    acc[job.date].push(job)
    return acc
  }, {})

  function handleStatus(jobId, status) {
    updateJob(jobId, { status }); load()
  }

  function handleToggle(date) {
    toggleUnavailableDate(user.id, date)
    setUnavailable(getAvailability(user.id))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">My Schedule</h1>
        <p className="text-slate-400 mt-1 text-sm">Your upcoming jobs and availability</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {[['jobs', 'My Jobs'], ['availability', 'My Availability']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <div className="space-y-8">
          {upcoming.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-14 text-center">
              <p className="text-slate-400 font-medium mb-1">No upcoming jobs</p>
              <p className="text-slate-500 text-sm">Your scheduled jobs will appear here when assigned by your manager.</p>
            </div>
          ) : (
            Object.entries(grouped)
              .sort(([a],[b]) => a.localeCompare(b))
              .map(([date, dayJobs]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-sm font-semibold text-slate-300">{fmtDate(date)}</p>
                    {date === today && <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">Today</span>}
                  </div>
                  <div className="space-y-3">
                    {dayJobs.map(job => (
                      <JobCard key={job.id} job={job} onStatus={s => handleStatus(job.id, s)} />
                    ))}
                  </div>
                </div>
              ))
          )}

          {past.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-slate-500 hover:text-slate-300 cursor-pointer select-none mb-4 py-1">
                Past jobs ({past.length})
              </summary>
              <div className="space-y-3 mt-3">
                {past.slice().reverse().map(job => <JobCard key={job.id} job={job} past />)}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'availability' && (
        <AvailCalendar unavailable={unavailable} onToggle={handleToggle} />
      )}
    </div>
  )
}

function JobCard({ job, onStatus, past }) {
  const meta = STATUS_META[job.status] || STATUS_META.scheduled
  return (
    <div className={`bg-slate-900 border border-slate-800 border-l-2 ${meta.border} rounded-r-xl p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <p className="font-semibold text-white">{job.client_name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            {job.recurring && <span className="text-xs text-slate-500">↻ Recurring</span>}
          </div>
          <p className="text-sm text-slate-400">{job.service_type}</p>
          {job.client_address && <p className="text-sm text-slate-500 mt-0.5">{job.client_address}</p>}
          {job.start_time && (
            <p className="text-sm text-slate-400 mt-1 tabular-nums">
              {fmt12(job.start_time)}{job.end_time ? ` – ${fmt12(job.end_time)}` : ''}
            </p>
          )}
          {job.notes && <p className="text-sm text-slate-500 mt-2 italic">"{job.notes}"</p>}
        </div>

        {!past && onStatus && (
          <div className="shrink-0 pt-0.5">
            {job.status === 'scheduled' && (
              <button onClick={() => onStatus('in_progress')}
                className="text-sm sm:text-xs font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 px-4 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-colors whitespace-nowrap">
                Start Job
              </button>
            )}
            {job.status === 'in_progress' && (
              <button onClick={() => onStatus('completed')}
                className="text-sm sm:text-xs font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 px-4 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-colors whitespace-nowrap">
                Mark Done
              </button>
            )}
            {job.status === 'completed' && (
              <span className="text-xs text-emerald-500">✓ Completed</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AvailCalendar({ unavailable, onToggle }) {
  const [view, setView] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const today  = new Date().toISOString().split('T')[0]
  const year   = view.getFullYear()
  const month  = view.getMonth()
  const label  = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const startDow = new Date(year, month, 1).getDay()
  const offset = startDow === 0 ? 6 : startDow - 1

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d).toISOString().split('T')[0])
  }

  const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  return (
    <div className="max-w-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-white">My Availability</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth()-1, 1))}
              className="p-2 sm:p-1.5 text-slate-400 hover:text-white rounded transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm text-slate-300 min-w-[130px] text-center">{label}</span>
            <button onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth()+1, 1))}
              className="p-2 sm:p-1.5 text-slate-400 hover:text-white rounded transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">Tap a day to mark yourself unavailable. Your manager can see these.</p>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DOW.map(d => <div key={d} className="text-center text-xs font-medium text-slate-600 py-1">{d[0]}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((ds, i) => {
            if (!ds) return <div key={`e${i}`} />
            const isPast     = ds < today
            const isUnavail  = unavailable.includes(ds)
            const isToday    = ds === today
            const day        = new Date(ds + 'T00:00:00').getDate()
            return (
              <button
                key={ds}
                onClick={() => !isPast && onToggle(ds)}
                disabled={isPast}
                title={isUnavail ? 'Mark available' : 'Mark unavailable'}
                className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                  isPast      ? 'text-slate-700 cursor-not-allowed' :
                  isUnavail   ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30' :
                  isToday     ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30' :
                                'text-slate-300 hover:bg-rose-500/10 hover:text-rose-400 border border-transparent'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/40" />
            <span className="text-xs text-slate-400">Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-700" />
            <span className="text-xs text-slate-400">Available</span>
          </div>
          {unavailable.length > 0 && (
            <span className="text-xs text-slate-500 ml-auto">{unavailable.length} day{unavailable.length !== 1 ? 's' : ''} off</span>
          )}
        </div>
      </div>
    </div>
  )
}
