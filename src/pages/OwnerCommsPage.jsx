import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getEmployees, getAllJobs,
  getDMThread, sendDM, markThreadRead,
  getAnnouncements, sendAnnouncement, deleteAnnouncement,
  getAllPhotos, getPhotosByJob, deletePhoto as dbDeletePhoto,
  getJobNotes, addJobNote,
} from '../lib/db.js'

function timeStr(dt) {
  const d = new Date(dt)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const LABEL_META = {
  before:  { label: 'Before',  cls: 'bg-amber-500/20 text-amber-400' },
  after:   { label: 'After',   cls: 'bg-emerald-500/20 text-emerald-400' },
  general: { label: 'General', cls: 'bg-slate-600/50 text-slate-300' },
}

const TABS = [
  { id: 'messages',   label: 'Messages' },
  { id: 'broadcast',  label: 'Broadcast' },
  { id: 'photos',     label: 'Photos' },
  { id: 'notes',      label: 'Job Notes' },
]

export default function OwnerCommsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('messages')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Communications</h1>
        <p className="text-slate-400 mt-1 text-sm">Messages, announcements, photos, and job notes</p>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'messages'  && <MessagesTab user={user} />}
      {tab === 'broadcast' && <BroadcastTab user={user} />}
      {tab === 'photos'    && <PhotosTab user={user} />}
      {tab === 'notes'     && <NotesTab user={user} />}
    </div>
  )
}

/* ── Messages Tab ───────────────────────────────────────────────────────────── */
function MessagesTab({ user }) {
  const [employees, setEmployees]   = useState([])
  const [summaries, setSummaries]   = useState({})  // { [empId]: { last, unread } }
  const [selected, setSelected]     = useState(null)
  const [thread, setThread]         = useState([])
  const [input, setInput]           = useState('')
  const [mobileView, setMobileView] = useState('list')
  const bottomRef = useRef(null)

  useEffect(() => {
    let mounted = true
    getEmployees().then(emps => { if (mounted) setEmployees(emps) })
    return () => { mounted = false }
  }, [])

  const loadSummaries = useCallback(async () => {
    if (!employees.length) return
    const results = await Promise.all(employees.map(async emp => {
      const t = await getDMThread(user.id, emp.id)
      const unread = t.filter(m => m.from_id === emp.id && !m.read).length
      return [emp.id, { last: t[t.length - 1] || null, unread }]
    }))
    setSummaries(Object.fromEntries(results))
  }, [employees, user.id])

  useEffect(() => { loadSummaries() }, [loadSummaries])

  const loadThread = useCallback(async (emp) => {
    if (!emp) return
    const t = await getDMThread(user.id, emp.id)
    setThread(t)
    await markThreadRead(user.id, emp.id)
    setSummaries(s => ({ ...s, [emp.id]: { ...s[emp.id], unread: 0, last: t[t.length - 1] || null } }))
  }, [user.id])

  useEffect(() => {
    if (!selected) return
    let mounted = true
    async function tick() { if (mounted) await loadThread(selected) }
    tick()
    const id = setInterval(tick, 3000)
    return () => { mounted = false; clearInterval(id) }
  }, [selected?.id, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  async function select(emp) {
    setSelected(emp)
    setMobileView('thread')
    await loadThread(emp)
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !selected) return
    await sendDM(user.id, selected.id, input.trim())
    setInput('')
    await loadThread(selected)
  }

  const EmployeeList = (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Employees</h3>
      </div>
      {employees.length === 0 && (
        <p className="px-4 py-10 text-center text-slate-500 text-sm">No employees yet</p>
      )}
      <div className="divide-y divide-slate-800/60">
        {employees.map(emp => {
          const s = summaries[emp.id]
          return (
            <button key={emp.id} onClick={() => select(emp)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-800/50 transition-colors text-left ${selected?.id === emp.id ? 'bg-slate-800' : ''}`}>
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold">
                  {emp.name[0]}
                </div>
                {s?.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-rose-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                    {s.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-medium truncate ${s?.unread > 0 ? 'text-white' : 'text-slate-200'}`}>{emp.name}</p>
                  {s?.last && <span className="text-xs text-slate-500 shrink-0">{timeStr(s.last.created_at)}</span>}
                </div>
                {s?.last ? (
                  <p className={`text-xs truncate mt-0.5 ${s.unread > 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                    {s.last.from_id === user.id ? 'You: ' : ''}{s.last.body}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 mt-0.5">No messages yet</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const ThreadPanel = selected ? (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col" style={{ height: '520px' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button onClick={() => setMobileView('list')}
          className="md:hidden p-1 text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold shrink-0">
          {selected.name[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{selected.name}</p>
          <p className="text-xs text-slate-500">{selected.email}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {thread.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-500 text-sm">No messages yet — say hello!</p>
          </div>
        )}
        {thread.map(msg => {
          const isMe = msg.from_id === user.id
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-700 text-slate-100 rounded-bl-sm'}`}>
                <p className="text-sm leading-relaxed">{msg.body}</p>
                <p className={`text-[11px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{timeStr(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-slate-800 shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder={`Message ${selected.name}…`}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        <button type="submit" disabled={!input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl p-2.5 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  ) : (
    <div className="hidden md:flex bg-slate-900 border border-slate-800 rounded-xl items-center justify-center" style={{ height: '520px' }}>
      <p className="text-slate-500 text-sm">Select an employee to message</p>
    </div>
  )

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <div className={mobileView === 'list' ? 'block' : 'hidden md:block'}>{EmployeeList}</div>
      <div className={mobileView === 'thread' ? 'block' : 'hidden md:block'}>{ThreadPanel}</div>
    </div>
  )
}

/* ── Broadcast Tab ──────────────────────────────────────────────────────────── */
function BroadcastTab({ user }) {
  const [announcements, setAnnouncements] = useState([])
  const [employees, setEmployees] = useState([])
  const [input, setInput] = useState('')

  async function load() {
    const [anns, emps] = await Promise.all([getAnnouncements(), getEmployees()])
    setAnnouncements(anns)
    setEmployees(emps)
  }
  useEffect(() => { load() }, [])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    await sendAnnouncement(user.id, input.trim())
    setInput('')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Send to Entire Crew</h3>
        <p className="text-xs text-slate-500 mb-4">All {employees.length} employee{employees.length !== 1 ? 's' : ''} will see this in their Communications page</p>
        <form onSubmit={handleSend} className="space-y-3">
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={3}
            placeholder="Write an announcement for your whole team…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <div className="flex justify-end">
            <button type="submit" disabled={!input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
              Broadcast
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Sent Announcements</h3>
        </div>
        {announcements.length === 0 ? (
          <p className="px-5 py-12 text-center text-slate-500 text-sm">No announcements yet</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {announcements.map(a => {
              const readCount = Math.max(0, (a.read_by?.length || 0) - 1)
              return (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-200 leading-relaxed flex-1">{a.body}</p>
                    <button onClick={async () => { await deleteAnnouncement(a.id); load() }}
                      className="text-slate-600 hover:text-rose-400 transition-colors shrink-0 p-1 -mr-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-slate-500">{timeStr(a.created_at)}</span>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">
                      {readCount > 0 ? `${readCount} of ${employees.length} read` : `0 of ${employees.length} read`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Photos Tab ─────────────────────────────────────────────────────────────── */
function PhotosTab({ user }) {
  const [photos, setPhotos]         = useState([])
  const [employees, setEmployees]   = useState([])
  const [filterMode, setFilterMode] = useState('all')
  const [filterJob, setFilterJob]   = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [lightbox, setLightbox]     = useState(null)
  const [jobs, setJobs]             = useState([])

  async function load() {
    const [emps, allJobs] = await Promise.all([getEmployees(), getAllJobs()])
    setEmployees(emps)
    setJobs(allJobs)
    let p
    if (filterMode === 'job' && filterJob) {
      p = await getPhotosByJob(filterJob)
    } else {
      p = await getAllPhotos()
      if (filterMode === 'date' && filterDate) p = p.filter(ph => ph.created_at?.startsWith(filterDate))
    }
    setPhotos(p)
  }

  useEffect(() => { load() }, [filterMode, filterJob, filterDate])

  function empName(uid) {
    const e = employees.find(e => e.id === uid)
    return e ? e.name : 'Owner'
  }

  function jobLabel(jobId) {
    if (!jobId) return null
    const j = jobs.find(j => j.id === jobId)
    return j ? `${j.client_name} — ${j.service_type}` : null
  }

  async function handleDelete(id) {
    await dbDeletePhoto(id)
    if (lightbox?.id === id) setLightbox(null)
    load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {[['all', 'All Photos'], ['job', 'By Job'], ['date', 'By Date']].map(([mode, label]) => (
          <button key={mode}
            onClick={() => { setFilterMode(mode); setFilterJob(''); setFilterDate('') }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}

        {filterMode === 'job' && (
          <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All jobs…</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.date} — {j.client_name} ({j.service_type})</option>)}
          </select>
        )}

        {filterMode === 'date' && (
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        )}

        <span className="ml-auto text-xs text-slate-500">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </div>

      {photos.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-16 text-center">
          <p className="text-slate-400 font-medium mb-1">No photos yet</p>
          <p className="text-slate-500 text-sm">Employees upload before/after photos from their Chat page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map(photo => {
            const meta = LABEL_META[photo.label] || LABEL_META.general
            const job  = jobLabel(photo.job_id)
            return (
              <div key={photo.id} className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer"
                onClick={() => setLightbox(photo)}>
                <div className="aspect-square relative overflow-hidden">
                  <img src={photo.data_url} alt={photo.caption || photo.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(photo.id) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-slate-900/80 rounded-full items-center justify-center hidden group-hover:flex text-slate-400 hover:text-rose-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{timeStr(photo.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-300 truncate font-medium">{empName(photo.user_id)}</p>
                  {job   && <p className="text-[11px] text-slate-500 truncate mt-0.5">{job}</p>}
                  {photo.caption && <p className="text-[11px] text-slate-500 truncate mt-0.5 italic">"{photo.caption}"</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.data_url} alt={lightbox.caption || lightbox.label}
              className="w-full rounded-xl object-contain max-h-[70vh]" />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${(LABEL_META[lightbox.label] || LABEL_META.general).cls}`}>
                    {(LABEL_META[lightbox.label] || LABEL_META.general).label}
                  </span>
                </div>
                {lightbox.caption && <p className="text-white text-sm mb-1">"{lightbox.caption}"</p>}
                <p className="text-slate-400 text-sm">{empName(lightbox.user_id)} · {timeStr(lightbox.created_at)}</p>
                {jobLabel(lightbox.job_id) && <p className="text-slate-500 text-xs mt-0.5">{jobLabel(lightbox.job_id)}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(lightbox.id)}
                  className="text-rose-400 hover:text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg text-sm transition-colors">
                  Delete
                </button>
                <button onClick={() => setLightbox(null)}
                  className="text-slate-300 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg text-sm transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Job Notes Tab ──────────────────────────────────────────────────────────── */
function NotesTab({ user }) {
  const [jobs, setJobs]         = useState([])
  const [employees, setEmployees] = useState([])
  const [selected, setSelected] = useState(null)
  const [notes, setNotes]       = useState([])
  const [input, setInput]       = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    let mounted = true
    Promise.all([getAllJobs(), getEmployees()]).then(([j, e]) => {
      if (mounted) { setJobs(j); setEmployees(e) }
    })
    return () => { mounted = false }
  }, [])

  async function loadNotes(job) {
    if (!job) return
    const n = await getJobNotes(job.id)
    setNotes(n)
  }

  useEffect(() => {
    loadNotes(selected)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes.length])

  function authorName(uid) {
    if (uid === user.id) return 'You'
    const e = employees.find(e => e.id === uid)
    return e ? e.name : 'Unknown'
  }

  async function handleSelectJob(e) {
    const job = jobs.find(j => j.id === e.target.value) || null
    setSelected(job)
    setInput('')
    if (job) await loadNotes(job)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!input.trim() || !selected) return
    await addJobNote(selected.id, user.id, input.trim())
    setInput('')
    loadNotes(selected)
  }

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <label className="block text-xs font-medium text-slate-400 mb-2">Select a Job</label>
        <select value={selected?.id || ''} onChange={handleSelectJob}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Choose a job…</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.date} — {j.client_name} · {j.service_type}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30">
            <p className="text-sm font-semibold text-white">{selected.client_name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {selected.service_type} · {selected.date}
              {selected.client_address ? ` · ${selected.client_address}` : ''}
            </p>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
            {notes.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-6">No notes yet — add instructions or updates below</p>
            )}
            {notes.map(note => (
              <div key={note.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0 mt-0.5">
                  {authorName(note.user_id)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">{authorName(note.user_id)}</span>
                    <span className="text-[11px] text-slate-500">{timeStr(note.created_at)}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{note.body}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="px-5 py-4 border-t border-slate-800">
            <form onSubmit={handleAdd} className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                placeholder="Add a note or instruction…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={!input.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors whitespace-nowrap">
                Add
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
