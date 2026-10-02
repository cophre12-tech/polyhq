import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  getJobsInRange, createJob, updateJob, deleteJob,
  getEmployees, getAllAvailability, getServices,
  logJobToRevenue, autoCompleteJobs, autoLogTodayRevenue,
} from '../lib/db.js'
import { supabase } from '../lib/supabase.js'

const RECURRING_OPTS = [
  { value: '',          label: 'Does not repeat' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
]

const STATUS_META = {
  scheduled:   { label: 'Scheduled',   border: 'border-l-accent',    badge: 'bg-raised text-fg-muted',     btn: 'text-warning border-warning/30 hover:bg-warning/10',  next: 'in_progress', nextLabel: 'Start' },
  in_progress: { label: 'In Progress', border: 'border-l-warning',   badge: 'bg-warning/15 text-warning',   btn: 'text-success border-success/30 hover:bg-success/10', next: 'completed', nextLabel: 'Complete' },
  completed:   { label: 'Completed',   border: 'border-l-success', badge: 'bg-success/15 text-success', btn: '', next: null, nextLabel: '' },
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getMonday(from = new Date()) {
  const d = new Date(from); d.setHours(0,0,0,0)
  const dow = d.getDay(); d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function toStr(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function weekDates(mon) { return Array.from({length:7}, (_,i) => addDays(mon, i)) }
function fmt12(t) {
  if (!t) return ''
  const [h,m] = t.split(':').map(Number)
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}

function makeEmpty(defaultDate = '') {
  return {
    client_name: '', client_address: '', service_type: '',
    date: defaultDate, start_time: '08:00', end_time: '10:00',
    assigned_to: [], recurring: '', recurring_end: '', notes: '', status: 'scheduled',
    price: '',
  }
}

export default function SchedulePage() {
  const [monday, setMonday]         = useState(getMonday)
  const [jobs, setJobs]             = useState([])
  const [employees, setEmployees]   = useState([])
  const [avail, setAvail]           = useState({})
  const [modal, setModal]           = useState(null)
  const [dragging, setDragging]     = useState(null)
  const [dragOver, setDragOver]     = useState(null)
  const [activeDay, setActiveDay]   = useState(() => toStr(new Date()))

  const dates  = weekDates(monday)
  const wStart = toStr(dates[0])
  const wEnd   = toStr(dates[6])

  async function load() {
    const [j, emps, av] = await Promise.all([
      getJobsInRange(wStart, wEnd), getEmployees(), getAllAvailability()
    ])
    setJobs(j)
    setEmployees(emps)
    setAvail(av)
  }
  useEffect(() => { load() }, [wStart])

  // Keep ref to latest load so realtime callback always uses current week range
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  // Supabase Realtime — refresh when any job changes (status, assignment, etc.)
  useEffect(() => {
    const channel = supabase
      .channel('schedule-jobs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        loadRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Sync activeDay with week: if it falls outside current week, reset to first day of week
  useEffect(() => {
    if (activeDay < wStart || activeDay > wEnd) {
      setActiveDay(wStart)
    }
  }, [wStart, wEnd])

  const today = toStr(new Date())

  const months = [...new Set(dates.map(d => MONTH_NAMES[d.getMonth()]))]
  const year   = dates[0].getFullYear()

  function dayJobs(dateStr) {
    return jobs.filter(j => j.date === dateStr)
               .sort((a,b) => (a.start_time??'').localeCompare(b.start_time??''))
  }

  function unavailNames(dateStr) {
    return Object.entries(avail)
      .filter(([, ds]) => ds.includes(dateStr))
      .map(([uid]) => employees.find(e => e.id === uid)?.name.split(' ')[0])
      .filter(Boolean)
  }

  // At 5 PM: auto-complete today's unfinished jobs, then auto-log priced ones to revenue
  useEffect(() => {
    async function checkAt5pm() {
      if (new Date().getHours() < 17) return
      const [completed, logged] = await Promise.all([autoCompleteJobs(), autoLogTodayRevenue()])
      if (completed > 0 || logged > 0) load()
    }
    checkAt5pm()
    const id = setInterval(checkAt5pm, 60000)
    return () => clearInterval(id)
  }, [])

  async function handleSave(data) {
    if (modal.type === 'create') await createJob(data)
    else await updateJob(modal.job.id, data)
    setModal(null); load()
  }

  async function handleDelete(id, allInSeries) {
    await deleteJob(id, allInSeries); setModal(null); load()
  }

  async function handleLogRevenue(job) {
    await logJobToRevenue(job)   // throws on failure — caught and displayed by modal
    setModal(null); load()
  }

  function onDragStart(e, job) {
    e.dataTransfer.effectAllowed = 'move'
    setDragging(job.id)
  }
  function onDragOver(e, dateStr) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(dateStr)
  }
  async function onDrop(e, dateStr) {
    e.preventDefault()
    const job = jobs.find(j => j.id === dragging)
    if (job && job.date !== dateStr) { await updateJob(dragging, { date: dateStr }); load() }
    setDragging(null); setDragOver(null)
  }

  const activeDayDate = dates.find(d => toStr(d) === activeDay) ?? dates[0]

  return (
    <div className="flex flex-col h-screen md:h-auto">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Schedule</h1>
          <p className="text-fg-muted text-sm">{months.join(' / ')} {year}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Jobs link — highlighted when viewing current week */}
          <Link
            to="/owner/active"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              wStart <= today && today <= wEnd
                ? 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/15'
                : 'bg-raised border-line text-fg-muted hover:text-fg hover:border-line-strong'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {wStart <= today && today <= wEnd && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${wStart <= today && today <= wEnd ? 'bg-warning' : 'bg-overlay'}`} />
            </span>
            Live
          </Link>
          <div className="flex items-center gap-0.5 bg-raised border border-line rounded-lg p-1">
            <button onClick={() => setMonday(m => addDays(m,-7))} className="p-1.5 text-fg-muted hover:text-fg rounded transition-colors">
              <ChevronLeft />
            </button>
            <button onClick={() => { setMonday(getMonday()); setActiveDay(today) }} className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg transition-colors">
              Today
            </button>
            <button onClick={() => setMonday(m => addDays(m,7))} className="p-1.5 text-fg-muted hover:text-fg rounded transition-colors">
              <ChevronRight />
            </button>
          </div>
          <button
            onClick={() => setModal({ type: 'create', date: activeDay })}
            className="btn-primary px-3 sm:px-4 py-2 text-sm flex gap-1.5 sm:gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">New Job</span>
          </button>
        </div>
      </div>

      {/* ── Desktop: 7-column grid ─────────────────────────────────────── */}
      <div className="hidden md:grid grid-cols-7 gap-2 flex-1 min-h-0 px-6 pb-6">
        {dates.map((date, i) => {
          const ds        = toStr(date)
          const isToday   = ds === today
          const isOver    = dragOver === ds
          const colJobs   = dayJobs(ds)
          const unavail   = unavailNames(ds)

          return (
            <div
              key={ds}
              className={`flex flex-col rounded-xl border transition-all overflow-hidden ${
                isOver   ? 'border-accent bg-accent/5' :
                isToday  ? 'border-accent/50 bg-surface'  :
                           'border-line bg-surface'
              }`}
              onDragOver={e => onDragOver(e, ds)}
              onDrop={e => onDrop(e, ds)}
              onDragLeave={() => dragOver === ds && setDragOver(null)}
            >
              {/* Day header */}
              <div className={`border-b shrink-0 ${isToday ? 'border-accent/40' : 'border-line'}`}>
                <button
                  className="w-full text-left px-3 py-2.5 hover:bg-raised/50 transition-colors"
                  onClick={() => setModal({ type: 'create', date: ds })}
                >
                  <p className={`text-xs font-medium ${isToday ? 'text-accent-fg' : 'text-fg-subtle'}`}>{DAY_LABELS[i]}</p>
                  <p className={`text-2xl font-semibold leading-tight ${isToday ? 'text-accent-fg' : 'text-fg'}`}>{date.getDate()}</p>
                </button>
                {isToday && (
                  <Link
                    to="/owner/active"
                    className="flex items-center justify-center gap-1 py-1 text-xs text-warning hover:text-warning/80 bg-warning/5 hover:bg-warning/10 transition-colors border-t border-warning/10"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                    </span>
                    Live View
                  </Link>
                )}
              </div>

              {/* Unavailability strip */}
              {unavail.length > 0 && (
                <div className="px-2 py-1 bg-danger/5 border-b border-danger/10 shrink-0">
                  <p className="text-xs text-danger/60 truncate">✗ {unavail.join(', ')}</p>
                </div>
              )}

              {/* Jobs */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-0">
                {colJobs.map(job => {
                  const meta      = STATUS_META[job.status] || STATUS_META.scheduled
                  const isDragging = dragging === job.id
                  return (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={e => onDragStart(e, job)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      onClick={() => setModal({ type: 'edit', job })}
                      className={`border-l-2 ${meta.border} bg-raised hover:bg-overlay/80 rounded-r-lg px-2 py-1.5 cursor-pointer select-none transition-all ${isDragging ? 'opacity-30 scale-95' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold text-fg leading-tight truncate flex-1">{job.client_name}</p>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {job.price > 0 && job.status === 'completed' && (
                            job.revenue_logged
                              ? <span className="text-success text-2xs font-semibold leading-none" title="Revenue logged">✓$</span>
                              : <span className="text-warning text-2xs font-semibold leading-none" title="Revenue not yet logged">!$</span>
                          )}
                          {job.recurring && <span className="text-fg-subtle text-xs">↻</span>}
                        </div>
                      </div>
                      <p className="text-xs text-fg-muted truncate mt-0.5">{job.service_type}</p>
                      {job.price > 0 && (
                        <p className="text-xs text-success tabular-nums">${parseFloat(job.price).toFixed(2)}</p>
                      )}
                      {job.client_address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(job.client_address)}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-0.5 mt-0.5 text-fg-muted hover:text-fg transition-colors"
                        >
                          <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          <span className="text-xs truncate">{job.client_address}</span>
                        </a>
                      )}
                      {job.start_time && (
                        <p className="text-xs text-fg-subtle mt-0.5 tabular-nums">
                          {fmt12(job.start_time)}{job.end_time ? `–${fmt12(job.end_time)}` : ''}
                        </p>
                      )}
                      {(job.assigned_to||[]).length > 0 && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {job.assigned_to.slice(0,3).map(uid => {
                            const emp = employees.find(e => e.id === uid)
                            return emp ? (
                              <div key={uid} className="w-4 h-4 rounded-full bg-raised border border-line flex items-center justify-center text-xs text-fg-muted font-semibold" title={emp.name}>
                                {emp.name[0]}
                              </div>
                            ) : null
                          })}
                          {job.assigned_to.length > 3 && <span className="text-xs text-fg-subtle">+{job.assigned_to.length-3}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => setModal({ type: 'create', date: ds })}
                  className="w-full py-1 text-xs text-fg-subtle hover:text-fg-subtle hover:bg-raised rounded transition-colors"
                >
                  + add
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Mobile: day strip + job list ──────────────────────────────── */}
      <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Day strip — horizontal scroll */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dates.map((date, i) => {
              const ds      = toStr(date)
              const isToday = ds === today
              const isActive = ds === activeDay
              const count   = dayJobs(ds).length
              return (
                <button
                  key={ds}
                  onClick={() => setActiveDay(ds)}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border transition-all shrink-0 min-w-[52px] ${
                    isActive ? 'bg-accent border-accent text-fg' :
                    isToday  ? 'border-accent/40 bg-surface text-accent-fg' :
                               'border-line bg-surface text-fg-muted'
                  }`}
                >
                  <span className="text-xs font-medium mb-0.5">{DAY_LABELS[i]}</span>
                  <span className={`text-lg font-semibold leading-none ${isActive ? 'text-fg' : ''}`}>{date.getDate()}</span>
                  {count > 0 && (
                    <span className={`mt-1 text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold ${
                      isActive ? 'bg-fg/20 text-fg' : 'bg-overlay text-fg-muted'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day header */}
        <div className="px-4 mb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-fg-muted">
              {activeDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {activeDay === today && <span className="ml-2 text-xs text-fg-muted bg-raised border border-line px-2 py-0.5 rounded-full">Today</span>}
            </p>
            {activeDay === today && (
              <Link
                to="/owner/active"
                className="flex items-center gap-1.5 text-xs font-medium text-warning border border-warning/30 bg-warning/10 hover:bg-warning/15 px-2.5 py-1 rounded-lg transition-colors shrink-0"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                </span>
                Live View
              </Link>
            )}
          </div>
          {unavailNames(activeDay).length > 0 && (
            <p className="text-xs text-danger/60 mt-0.5">✗ Unavailable: {unavailNames(activeDay).join(', ')}</p>
          )}
        </div>

        {/* Jobs for selected day */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
          {dayJobs(activeDay).length === 0 ? (
            <div className="bg-surface border border-line border-dashed rounded-xl py-10 text-center">
              <p className="text-fg-subtle text-sm mb-3">No jobs scheduled</p>
              <button onClick={() => setModal({ type: 'create', date: activeDay })}
                className="text-sm text-fg underline-offset-4 hover:underline transition-colors">
                + Add a job
              </button>
            </div>
          ) : (
            dayJobs(activeDay).map(job => {
              const meta = STATUS_META[job.status] || STATUS_META.scheduled
              return (
                <div
                  key={job.id}
                  onClick={() => setModal({ type: 'edit', job })}
                  className={`bg-surface border border-line border-l-2 ${meta.border} rounded-r-xl p-4 cursor-pointer active:bg-raised transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-fg">{job.client_name}</p>
                        {job.recurring && <span className="text-xs text-fg-subtle">↻</span>}
                        {job.price > 0 && job.status === 'completed' && (
                          job.revenue_logged
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                Revenue logged
                              </span>
                            : <span className="text-xs font-medium text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded-full">
                                Revenue pending
                              </span>
                        )}
                      </div>
                      <p className="text-sm text-fg-muted">{job.service_type}</p>
                      {job.price > 0 && (
                        <p className="text-sm text-success tabular-nums mt-0.5">${parseFloat(job.price).toFixed(2)}</p>
                      )}
                      {job.client_address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(job.client_address)}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-sm text-fg underline-offset-4 hover:underline mt-0.5 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          <span className="truncate">{job.client_address}</span>
                        </a>
                      )}
                      {job.start_time && (
                        <p className="text-sm text-fg-muted mt-1 tabular-nums">
                          {fmt12(job.start_time)}{job.end_time ? ` – ${fmt12(job.end_time)}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${meta.badge}`}>{meta.label}</span>
                  </div>
                  {(job.assigned_to||[]).length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-line">
                      <span className="text-xs text-fg-subtle">Assigned:</span>
                      {job.assigned_to.map(uid => {
                        const emp = employees.find(e => e.id === uid)
                        return emp ? (
                          <div key={uid} className="flex items-center gap-1">
                            <div className="w-5 h-5 rounded-full bg-raised border border-line flex items-center justify-center text-xs text-fg-muted font-semibold">
                              {emp.name[0]}
                            </div>
                            <span className="text-xs text-fg-muted">{emp.name.split(' ')[0]}</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* FAB — floating add button */}
        <button
          onClick={() => setModal({ type: 'create', date: activeDay })}
          className="btn-primary fixed bottom-6 right-6 w-14 h-14 rounded-full flex z-20"
          aria-label="Add job"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {modal && (
        <JobModal
          type={modal.type}
          job={modal.job}
          defaultDate={modal.date}
          employees={employees}
          onSave={handleSave}
          onDelete={handleDelete}
          onLogRevenue={handleLogRevenue}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Job Modal ─────────────────────────────────────────────────────────────────

function JobModal({ type, job, defaultDate, employees, onSave, onDelete, onLogRevenue, onClose }) {
  const isEdit = type === 'edit'
  const [services, setServices] = useState([])
  const [form, setForm] = useState(() => isEdit
    ? { client_name: job.client_name??'', client_address: job.client_address??'', service_type: job.service_type??'', date: job.date??'', start_time: job.start_time??'08:00', end_time: job.end_time??'10:00', assigned_to: job.assigned_to??[], recurring: job.recurring??'', recurring_end: job.recurring_end??'', notes: job.notes??'', status: job.status??'scheduled', price: job.price??'' }
    : makeEmpty(defaultDate)
  )
  const [delConfirm, setDelConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [logging, setLogging] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaveError('')
    setSaving(true)
    try {
      await onSave({ ...form, price: form.price !== '' ? parseFloat(form.price) : null })
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogRevenue() {
    setLogging(true)
    setSaveError('')
    try {
      await onLogRevenue(job)
    } catch (err) {
      setSaveError('Revenue logging failed: ' + err.message)
    } finally {
      setLogging(false)
    }
  }

  useEffect(() => {
    getServices().then(svcs => {
      setServices(svcs)
      if (!isEdit && !form.service_type && svcs[0]) {
        setForm(f => ({ ...f, service_type: svcs[0].name }))
      }
    })
  }, [])

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }
  function toggleEmp(uid) {
    setForm(p => ({ ...p, assigned_to: p.assigned_to.includes(uid) ? p.assigned_to.filter(x => x !== uid) : [...p.assigned_to, uid] }))
  }

  return (
    <div className="fixed inset-0 bg-base/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-line rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-line sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-semibold text-fg">{isEdit ? 'Edit Job' : 'New Job'}</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MField label="Client Name *">
              <input type="text" required value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Smith Residence" className="input" />
            </MField>
            <MField label="Service Type">
              <select value={form.service_type} onChange={e => set('service_type', e.target.value)} className="input">
                {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                <option value="Custom">Custom</option>
              </select>
            </MField>
          </div>

          <MField label="Address">
            <input type="text" value={form.client_address} onChange={e => set('client_address', e.target.value)} placeholder="123 Main St, Springfield, IL" className="input" />
          </MField>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MField label="Date *">
              <input type="date" required value={form.date} onChange={e => set('date', e.target.value)} className="input" />
            </MField>
            <MField label="Start Time">
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="input" />
            </MField>
            <MField label="End Time">
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="input" />
            </MField>
            <MField label="Job Price ($)">
              <input type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" className="input" />
            </MField>
          </div>

          {/* Assign employees */}
          <MField label="Assign To">
            {employees.length === 0
              ? <p className="text-sm text-fg-subtle">No employees yet — add some in Crew.</p>
              : <div className="flex flex-wrap gap-2 mt-0.5">
                  {employees.map(emp => (
                    <button key={emp.id} type="button" onClick={() => toggleEmp(emp.id)}
                      className={`flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg border text-sm transition-all ${
                        form.assigned_to.includes(emp.id)
                          ? 'bg-accent/20 border-accent text-accent-fg'
                          : 'bg-raised border-line text-fg-muted hover:border-line-strong hover:text-fg'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-raised border border-line flex items-center justify-center text-xs font-semibold text-fg-muted">
                        {emp.name[0]}
                      </span>
                      {emp.name}
                    </button>
                  ))}
                </div>
            }
          </MField>

          {/* Recurring */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MField label="Repeat">
              <select value={form.recurring} onChange={e => set('recurring', e.target.value)} className="input">
                {RECURRING_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </MField>
            {form.recurring && (
              <MField label="Repeat Until (optional)">
                <input type="date" value={form.recurring_end} onChange={e => set('recurring_end', e.target.value)} className="input" />
              </MField>
            )}
          </div>

          {/* Status selector (edit only) */}
          {isEdit && (
            <MField label="Status">
              <div className="flex gap-2">
                {Object.entries(STATUS_META).map(([val, meta]) => (
                  <button key={val} type="button" onClick={() => set('status', val)}
                    className={`flex-1 py-2.5 sm:py-2 rounded-lg text-xs font-semibold border transition-all ${
                      form.status === val ? meta.badge + ' border-current' : 'bg-raised border-line text-fg-muted hover:border-line-strong hover:text-fg'
                    }`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            </MField>
          )}

          <MField label="Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Gate code, special instructions…" className="input resize-none" />
          </MField>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-line gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {isEdit && (
                delConfirm ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-fg-muted">Delete:</span>
                    <button type="button" onClick={() => onDelete(job.id, false)} className="text-xs text-fg bg-danger hover:bg-danger/85 px-3 py-1.5 rounded-lg transition-colors">This one</button>
                    {job.parent_id && <button type="button" onClick={() => onDelete(job.id, true)} className="text-xs text-fg bg-danger hover:bg-danger/85 px-3 py-1.5 rounded-lg transition-colors">All in series</button>}
                    <button type="button" onClick={() => setDelConfirm(false)} className="text-xs text-fg-muted hover:text-fg transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDelConfirm(true)} className="text-xs text-fg-subtle hover:text-danger transition-colors">Delete job</button>
                )
              )}
              {isEdit && job.price > 0 && (
                job.revenue_logged
                  ? <span className="text-xs font-medium text-success flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Logged to revenue
                    </span>
                  : <button
                      type="button"
                      onClick={handleLogRevenue}
                      disabled={logging}
                      className="text-xs font-medium text-success border border-success/30 hover:bg-success/10 hover:border-success/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {logging ? 'Logging…' : 'Log to Revenue'}
                    </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2.5 sm:py-2 text-sm">
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
              </button>
            </div>
          </div>
          {saveError && (
            <div className="mt-3 text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3.5 py-2.5">{saveError}</div>
          )}
        </form>
      </div>
    </div>
  )
}

function MField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-fg-muted mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ChevronLeft() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
}
function ChevronRight() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
}
