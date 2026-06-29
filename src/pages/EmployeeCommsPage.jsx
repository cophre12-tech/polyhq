import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getOwners, getJobsForEmployee,
  getDMThread, sendDM, markThreadRead,
  getAnnouncements, markAnnouncementRead,
  addPhoto, getPhotosByUser,
} from '../lib/db.js'
import { compressImage } from '../lib/compress.js'

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
  { id: 'messages',       label: 'Messages' },
  { id: 'announcements',  label: 'Announcements' },
  { id: 'photos',         label: 'Photos' },
]

export default function EmployeeCommsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('messages')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Communications</h1>
        <p className="text-slate-400 mt-1 text-sm">Messages, announcements, and job photos</p>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'messages'      && <MessagesTab user={user} />}
      {tab === 'announcements' && <AnnouncementsTab user={user} />}
      {tab === 'photos'        && <PhotosTab user={user} />}
    </div>
  )
}

/* ── Messages Tab ───────────────────────────────────────────────────────────── */
function MessagesTab({ user }) {
  const [owner, setOwner]     = useState(null)
  const [thread, setThread]   = useState([])
  const [input, setInput]     = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    let mounted = true
    getOwners().then(owners => { if (mounted) setOwner(owners[0] || null) })
    return () => { mounted = false }
  }, [])

  const loadThread = useCallback(async () => {
    if (!owner) return
    const t = await getDMThread(user.id, owner.id)
    setThread(t)
    await markThreadRead(user.id, owner.id)
  }, [owner, user.id])

  useEffect(() => {
    if (!owner) return
    let mounted = true
    async function tick() { if (mounted) await loadThread() }
    tick()
    const id = setInterval(tick, 3000)
    return () => { mounted = false; clearInterval(id) }
  }, [owner, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !owner) return
    await sendDM(user.id, owner.id, input.trim())
    setInput('')
    await loadThread()
  }

  if (!owner) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
        <p className="text-slate-500 text-sm">No owner account found in this workspace</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col" style={{ height: '520px' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-sm font-bold shrink-0">
          {owner.name[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{owner.name}</p>
          <p className="text-xs text-slate-500">Owner</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {thread.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-500 text-sm">Send a message to your manager</p>
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
          placeholder="Message your manager…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        <button type="submit" disabled={!input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl p-2.5 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  )
}

/* ── Announcements Tab ──────────────────────────────────────────────────────── */
function AnnouncementsTab({ user }) {
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      const list = await getAnnouncements()
      if (!mounted) return
      setAnnouncements(list)
      await Promise.all(
        list
          .filter(a => !(a.read_by || []).includes(user.id))
          .map(a => markAnnouncementRead(user.id, a.id))
      )
    }
    load()
    return () => { mounted = false }
  }, [user.id])

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Announcements from Management</h3>
      </div>
      {announcements.length === 0 ? (
        <p className="px-5 py-14 text-center text-slate-500 text-sm">No announcements yet</p>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {announcements.map(a => {
            const unread = !(a.read_by || []).includes(user.id)
            return (
              <div key={a.id} className={`px-5 py-4 ${unread ? 'bg-indigo-500/5' : ''}`}>
                <div className="flex items-start gap-3">
                  {unread && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-2" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${unread ? 'text-white' : 'text-slate-300'}`}>{a.body}</p>
                    <p className="text-xs text-slate-500 mt-2">{timeStr(a.created_at)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Photos Tab ─────────────────────────────────────────────────────────────── */
function PhotosTab({ user }) {
  const [jobs, setJobs]           = useState([])
  const [myPhotos, setMyPhotos]   = useState([])
  const [form, setForm]           = useState({ job_id: '', label: 'before', caption: '' })
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const fileRef = useRef(null)

  async function load() {
    const [j, p] = await Promise.all([getJobsForEmployee(user.id), getPhotosByUser(user.id)])
    setJobs(j)
    setMyPhotos(p)
  }
  useEffect(() => { load() }, [user.id])

  async function handleUpload(e) {
    e.preventDefault()
    const file = fileRef.current?.files[0]
    if (!file) { setError('Please select a photo'); return }
    if (file.size > 15 * 1024 * 1024) { setError('File too large (max 15MB)'); return }
    setError(''); setSuccess(''); setUploading(true)
    try {
      const data_url = await compressImage(file)
      await addPhoto({ job_id: form.job_id || null, user_id: user.id, caption: form.caption, label: form.label, data_url })
      setSuccess('Photo uploaded!')
      setForm({ job_id: '', label: 'before', caption: '' })
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch {
      setError('Failed to upload photo. Try a smaller image.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Upload a Job Photo</h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Job (optional)</label>
              <select value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">No specific job</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.date} — {j.client_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Photo Type</label>
              <div className="flex gap-2">
                {['before', 'after', 'general'].map(l => (
                  <button key={l} type="button"
                    onClick={() => setForm(f => ({ ...f, label: l }))}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold capitalize transition-colors ${form.label === l ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Caption (optional)</label>
            <input type="text" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              placeholder="What's in the photo?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Photo</label>
            <input ref={fileRef} type="file" accept="image/*"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-slate-300 text-sm focus:outline-none
                file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer" />
          </div>

          {error   && <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{success}</p>}

          <button type="submit" disabled={uploading}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </button>
        </form>
      </div>

      {myPhotos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">My Uploaded Photos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {myPhotos.map(photo => {
              const meta = LABEL_META[photo.label] || LABEL_META.general
              const job  = jobs.find(j => j.id === photo.job_id)
              return (
                <div key={photo.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="aspect-square">
                    <img src={photo.data_url} alt={photo.caption || photo.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="px-3 py-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                    {job && <p className="text-[11px] text-slate-500 truncate mt-1">{job.client_name}</p>}
                    <p className="text-[11px] text-slate-600 mt-0.5">{timeStr(photo.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
