import { useState, useEffect } from 'react'
import {
  getJobsInRange, createJob, updateJob, deleteJob,
  getEmployees, getAllAvailability, getServices,
  logJobToRevenue, autoLogTodayRevenue,
} from '../lib/db.js'

const RECURRING_OPTS = [
  { value: '',          label: 'Does not repeat' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
]

const STATUS_META = {
  scheduled:   { label: 'Scheduled',   border: 'border-l-blue-500',    badge: 'bg-blue-500/15 text-blue-400',     btn: 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10',  next: 'in_progress', nextLabel: 'Start' },
  in_progress: { label: 'In Progress', border: 'border-l-amber-500',   badge: 'bg-amber-500/15 text-amber-400',   btn: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10', next: 'completed', nextLabel: 'Complete' },
  completed:   { label: 'Completed',   border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400', btn: '', next: null, nextLabel: '' },
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getMonday(from = new Date()) {
  const d = new Date(from); d.setHours(0,0,0,0)
  const dow = d.getDay(); d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function toStr(d) { return d.toISOString().split('T')[0] }
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

  // Auto-log today's priced jobs to revenue at 5 PM
  useEffect(() => {
    function checkAutoLog() {
      if (new Date().getHours() >= 17) {
        autoLogTodayRevenue().then(n => { if (n > 0) load() })
      }
    }
    checkAutoLog()
    const id = setInterval(checkAutoLog, 60000)
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
    await logJobToRevenue(job)
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
          <h1 className="text-xl sm:text-2xl font-bold text-white">Schedule</h1>
          <p className="text-slate-400 text-sm">{months.join(' / ')} {year}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-0.5 bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button onClick={() => setMonday(m => addDays(m,-7))} className="p-1.5 text-slate-400 hover:text-white rounded transition-colors">
              <ChevronLeft />
            </button>
            <button onClick={() => { setMonday(getMonday()); setActiveDay(today) }} className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors">
              Today
            </button>
            <button onClick={() => setMonday(m => addDays(m,7))} className="p-1.5 text-slate-400 hover:text-white rounded transition-colors">
              <ChevronRight />
            </button>
          </div>
          <button
            onClick={() => setModal({ type: 'create', date: activeDay })}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 sm:px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 sm:gap-2"
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
                isOver   ? 'border-indigo-500 bg-indigo-500/5' :
                isToday  ? 'border-indigo-500/50 bg-slate-900'  :
                           'border-slate-800 bg-slate-900'
              }`}
              onDragOver={e => onDragOver(e, ds)}
              onDrop={e => onDrop(e, ds)}
              onDragLeave={() => dragOver === ds && setDragOver(null)}
            >
              {/* Day header */}
              <button
                className={`text-left px-3 py-2.5 border-b shrink-0 hover:bg-slate-800/50 transition-colors ${isToday ? 'border-indigo-500/40' : 'border-slate-800'}`}
                onClick={() => setModal({ type: 'create', date: ds })}
              >
                <p className={`text-xs font-medium ${isToday ? 'text-indigo-400' : 'text-slate-500'}`}>{DAY_LABELS[i]}</p>
                <p className={`text-2xl font-bold leading-tight ${isToday ? 'text-indigo-300' : 'text-white'}`}>{date.getDate()}</p>
              </button>

              {/* Unavailability strip */}
              {unavail.length > 0 && (
                <div className="px-2 py-1 bg-rose-500/5 border-b border-rose-500/10 shrink-0">
                  <p className="text-xs text-rose-400/60 truncate">✗ {unavail.join(', ')}</p>
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
                      className={`border-l-2 ${meta.border} bg-slate-800 hover:bg-slate-700/80 rounded-r-lg px-2 py-1.5 cursor-pointer select-none transition-all ${isDragging ? 'opacity-30 scale-95' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold text-white leading-tight truncate flex-1">{job.client_name}</p>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {job.revenue_logged && <span className="text-emerald-400 text-xs font-bold" title="Logged to revenue">$</span>}
                          {job.recurring && <span className="text-slate-600 text-xs">↻</span>}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{job.service_type}</p>
                      {job.start_time && (
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {fmt12(job.start_time)}{job.end_time ? `–${fmt12(job.end_time)}` : ''}
                        </p>
                      )}
                      {(job.assigned_to||[]).length > 0 && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {job.assigned_to.slice(0,3).map(uid => {
                            const emp = employees.find(e => e.id === uid)
                            return emp ? (
                              <div key={uid} className="w-4 h-4 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs text-indigo-300 font-bold" title={emp.name}>
                                {emp.name[0]}
                              </div>
                            ) : null
                          })}
                          {job.assigned_to.length > 3 && <span className="text-xs text-slate-600">+{job.assigned_to.length-3}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => setModal({ type: 'create', date: ds })}
                  className="w-full py-1 text-xs text-slate-700 hover:text-slate-500 hover:bg-slate-800 rounded transition-colors"
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
                    isActive ? 'bg-indigo-600 border-indigo-500 text-white' :
                    isToday  ? 'border-indigo-500/40 bg-slate-900 text-indigo-300' :
                               'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <span className="text-xs font-medium mb-0.5">{DAY_LABELS[i]}</span>
                  <span className={`text-lg font-bold leading-none ${isActive ? 'text-white' : ''}`}>{date.getDate()}</span>
                  {count > 0 && (
                    <span className={`mt-1 text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day header */}
        <div className="px-4 mb-3 shrink-0">
          <p className="text-sm font-semibold text-slate-300">
            {activeDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {activeDay === today && <span className="ml-2 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">Today</span>}
          </p>
          {unavailNames(activeDay).length > 0 && (
            <p className="text-xs text-rose-400/60 mt-0.5">✗ Unavailable: {unavailNames(activeDay).join(', ')}</p>
          )}
        </div>

        {/* Jobs for selected day */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
          {dayJobs(activeDay).length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl py-10 text-center">
              <p className="text-slate-500 text-sm mb-3">No jobs scheduled</p>
              <button onClick={() => setModal({ type: 'create', date: activeDay })}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
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
                  className={`bg-slate-900 border border-slate-800 border-l-2 ${meta.border} rounded-r-xl p-4 cursor-pointer active:bg-slate-800 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-white">{job.client_name}</p>
                        {job.recurring && <span className="text-xs text-slate-500">↻</span>}
                        {job.revenue_logged && (
                          <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Logged</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{job.service_type}</p>
                      {job.client_address && <p className="text-xs text-slate-500 mt-0.5 truncate">{job.client_address}</p>}
                      {job.start_time && (
                        <p className="text-sm text-slate-400 mt-1 tabular-nums">
                          {fmt12(job.start_time)}{job.end_time ? ` – ${fmt12(job.end_time)}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${meta.badge}`}>{meta.label}</span>
                  </div>
                  {(job.assigned_to||[]).length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-800">
                      <span className="text-xs text-slate-500">Assigned:</span>
                      {job.assigned_to.map(uid => {
                        const emp = employees.find(e => e.id === uid)
                        return emp ? (
                          <div key={uid} className="flex items-center gap-1">
                            <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs text-indigo-300 font-bold">
                              {emp.name[0]}
                            </div>
                            <span className="text-xs text-slate-400">{emp.name.split(' ')[0]}</span>
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
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-xl flex items-center justify-center z-20 transition-colors"
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
  const [logging, setLogging] = useState(false)

  async function handleLogRevenue() {
    setLogging(true)
    try { await onLogRevenue(job) } finally { setLogging(false) }
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Job' : 'New Job'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={e => {
          e.preventDefault()
          onSave({ ...form, price: form.price !== '' ? parseFloat(form.price) : null })
        }} className="p-5 sm:p-6 space-y-4">
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
              ? <p className="text-sm text-slate-500">No employees yet — add some in Crew.</p>
              : <div className="flex flex-wrap gap-2 mt-0.5">
                  {employees.map(emp => (
                    <button key={emp.id} type="button" onClick={() => toggleEmp(emp.id)}
                      className={`flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg border text-sm transition-all ${
                        form.assigned_to.includes(emp.id)
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
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
                      form.status === val ? meta.badge + ' border-current' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
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
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {isEdit && (
                delConfirm ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">Delete:</span>
                    <button type="button" onClick={() => onDelete(job.id, false)} className="text-xs text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-colors">This one</button>
                    {job.parent_id && <button type="button" onClick={() => onDelete(job.id, true)} className="text-xs text-white bg-rose-700 hover:bg-rose-600 px-3 py-1.5 rounded-lg transition-colors">All in series</button>}
                    <button type="button" onClick={() => setDelConfirm(false)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDelConfirm(true)} className="text-xs text-slate-500 hover:text-rose-400 transition-colors">Delete job</button>
                )
              )}
              {isEdit && job.price > 0 && (
                job.revenue_logged
                  ? <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Logged to revenue
                    </span>
                  : <button
                      type="button"
                      onClick={handleLogRevenue}
                      disabled={logging}
                      className="text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-400/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {logging ? 'Logging…' : 'Log to Revenue'}
                    </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 sm:py-2 rounded-lg text-sm transition-colors">
                {isEdit ? 'Save Changes' : 'Create Job'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function MField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
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
