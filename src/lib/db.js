const DEMO_USERS = [
  { id: 'owner0', email: 'cophre12@gmail.com', password: 'polyhq2024', role: 'owner', name: 'Conor Reilly', hourly_rate: null },
  { id: 'owner1', email: 'owner@demo.com', password: 'demo123', role: 'owner', name: 'Sarah Chen', hourly_rate: null },
]

const ENTRY_SEED = []

const EXPENSE_SEED = [
  { daysAgo: 6, category: 'Equipment', description: 'Power drill set',               amount: 189.99 },
  { daysAgo: 5, category: 'Supplies',  description: 'Cleaning supplies — bulk order', amount: 67.45  },
  { daysAgo: 4, category: 'Travel',    description: 'Gas reimbursement — job sites',  amount: 48.20  },
  { daysAgo: 3, category: 'Supplies',  description: 'Safety gloves (12 pairs)',        amount: 34.80  },
  { daysAgo: 2, category: 'Labor',     description: 'Subcontractor payment',           amount: 250.00 },
  { daysAgo: 1, category: 'Other',     description: 'Business cards printing',         amount: 55.00  },
]

export function getWeekStart(offsetWeeks = 0) {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getTodayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Clear old seed data that referenced removed demo employees
;(function purgeLegacySeed() {
  const entries = JSON.parse(localStorage.getItem('polyhq_time_entries') || '[]')
  if (entries.some(e => ['emp1', 'emp2', 'emp3'].includes(e.user_id))) {
    localStorage.removeItem('polyhq_seeded')
    localStorage.removeItem('polyhq_time_entries')
  }
})()

function seedDemoData() {
  if (localStorage.getItem('polyhq_seeded')) return

  const monday = getWeekStart()
  const today = getTodayStart()
  const DAY = 86400000

  const entries = ENTRY_SEED
    .map((s, i) => {
      const dayStart = new Date(monday.getTime() + s.dayOffset * DAY)
      if (dayStart >= today) return null // skip today and future
      const clockIn = new Date(dayStart)
      clockIn.setHours(s.clockInH, s.clockInM, 0, 0)
      const clockOut = new Date(clockIn.getTime() + s.hoursWorked * 3600000)
      return { id: `seed_${i}`, user_id: s.user_id, clock_in: clockIn.toISOString(), clock_out: clockOut.toISOString() }
    })
    .filter(Boolean)

  const now = Date.now()
  const expenses = EXPENSE_SEED.map((s, i) => {
    const d = new Date(now - s.daysAgo * DAY)
    return {
      id: `exp_seed_${i}`,
      user_id: 'owner1',
      category: s.category,
      description: s.description,
      amount: s.amount,
      date: d.toISOString().split('T')[0],
      created_at: d.toISOString(),
    }
  })

  localStorage.setItem('polyhq_time_entries', JSON.stringify(entries))
  localStorage.setItem('polyhq_expenses', JSON.stringify(expenses))
  localStorage.setItem('polyhq_seeded', 'true')
}

seedDemoData()

// ── Registered users (localStorage) ─────────────────────────────────────────

function getRegisteredUsers() {
  return JSON.parse(localStorage.getItem('polyhq_users') || '[]')
}

function findUser(email) {
  const lower = email.toLowerCase()
  const builtin = DEMO_USERS.find(u => u.email === lower)
  if (builtin) return builtin
  return getRegisteredUsers().find(u => u.email === lower) ?? null
}

export async function register({ name, email, password, role, hourly_rate }) {
  const lower = email.toLowerCase()
  if (findUser(lower)) throw new Error('An account with that email already exists')
  const user = {
    id: `user_${Date.now()}`,
    name: name.trim(),
    email: lower,
    password,
    role,
    hourly_rate: role === 'employee' ? (parseFloat(hourly_rate) || 0) : null,
  }
  const users = getRegisteredUsers()
  users.push(user)
  localStorage.setItem('polyhq_users', JSON.stringify(users))
  const { password: _, ...session } = user
  localStorage.setItem('polyhq_session', JSON.stringify(session))
  return session
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function readEntries() {
  return JSON.parse(localStorage.getItem('polyhq_time_entries') || '[]')
}

function writeEntries(entries) {
  localStorage.setItem('polyhq_time_entries', JSON.stringify(entries))
}

function readExpenses() {
  return JSON.parse(localStorage.getItem('polyhq_expenses') || '[]')
}

function writeExpenses(expenses) {
  localStorage.setItem('polyhq_expenses', JSON.stringify(expenses))
}

function readRevenue() {
  return JSON.parse(localStorage.getItem('polyhq_revenue') || '[]')
}

function writeRevenue(data) {
  localStorage.setItem('polyhq_revenue', JSON.stringify(data))
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const user = findUser(email)
  if (!user || user.password !== password) throw new Error('Invalid email or password')
  const { password: _, ...session } = user
  localStorage.setItem('polyhq_session', JSON.stringify(session))
  return session
}

export function logout() {
  localStorage.removeItem('polyhq_session')
}

export function getSession() {
  const s = localStorage.getItem('polyhq_session')
  return s ? JSON.parse(s) : null
}

export function addEmployee({ name, email, password, hourly_rate }) {
  const lower = email.toLowerCase()
  if (findUser(lower)) throw new Error('An account with that email already exists')
  const user = {
    id: `user_${Date.now()}`,
    name: name.trim(),
    email: lower,
    password,
    role: 'employee',
    hourly_rate: parseFloat(hourly_rate) || 0,
  }
  const users = getRegisteredUsers()
  users.push(user)
  localStorage.setItem('polyhq_users', JSON.stringify(users))
  return user
}

export function removeEmployee(userId) {
  const users = getRegisteredUsers().filter(u => u.id !== userId)
  localStorage.setItem('polyhq_users', JSON.stringify(users))
}

export function updateEmployeeRate(userId, rate) {
  const users = getRegisteredUsers()
  const idx = users.findIndex(u => u.id === userId)
  if (idx !== -1) {
    users[idx].hourly_rate = parseFloat(rate) || 0
    localStorage.setItem('polyhq_users', JSON.stringify(users))
  }
}

export function getEmployees() {
  const builtIn = DEMO_USERS.filter(u => u.role === 'employee')
  const registered = getRegisteredUsers().filter(u => u.role === 'employee')
  return [...builtIn, ...registered].map(({ password: _, ...u }) => u)
}

export function addCoOwner({ name, email, password }) {
  const lower = email.toLowerCase()
  if (findUser(lower)) throw new Error('An account with that email already exists')
  const user = {
    id: `user_${Date.now()}`,
    name: name.trim(),
    email: lower,
    password,
    role: 'co_owner',
    hourly_rate: null,
  }
  const users = getRegisteredUsers()
  users.push(user)
  localStorage.setItem('polyhq_users', JSON.stringify(users))
  return user
}

export function removeCoOwner(userId) {
  const users = getRegisteredUsers().filter(u => u.id !== userId)
  localStorage.setItem('polyhq_users', JSON.stringify(users))
}

export function getCoOwners() {
  return getRegisteredUsers()
    .filter(u => u.role === 'co_owner')
    .map(({ password: _, ...u }) => u)
}

// ── Time entries ─────────────────────────────────────────────────────────────

export async function clockIn(userId) {
  const entries = readEntries()
  if (entries.find(e => e.user_id === userId && !e.clock_out)) {
    throw new Error('Already clocked in')
  }
  const entry = { id: `entry_${Date.now()}`, user_id: userId, clock_in: new Date().toISOString(), clock_out: null }
  writeEntries([...entries, entry])
  return entry
}

export async function clockOut(userId) {
  const entries = readEntries()
  const idx = entries.findIndex(e => e.user_id === userId && !e.clock_out)
  if (idx === -1) throw new Error('Not clocked in')
  entries[idx] = { ...entries[idx], clock_out: new Date().toISOString() }
  writeEntries(entries)
  return entries[idx]
}

export function getActiveEntry(userId) {
  return readEntries().find(e => e.user_id === userId && !e.clock_out) ?? null
}

export function getEntriesForUser(userId) {
  return readEntries().filter(e => e.user_id === userId)
}

export function getEntriesInRange(start, end, userId = null) {
  return readEntries().filter(e => {
    const t = new Date(e.clock_in)
    const inRange = t >= start && t <= end
    return userId ? inRange && e.user_id === userId : inRange
  })
}

export function entryDuration(entry) {
  const start = new Date(entry.clock_in)
  const end = entry.clock_out ? new Date(entry.clock_out) : new Date()
  return Math.max(0, (end - start) / 3600000)
}

// ── Revenue ──────────────────────────────────────────────────────────────────

export async function addRevenue(data) {
  const revenue = readRevenue()
  const entry = { id: `rev_${Date.now()}`, ...data, created_at: new Date().toISOString() }
  writeRevenue([...revenue, entry])
  return entry
}

export async function deleteRevenue(id) {
  writeRevenue(readRevenue().filter(r => r.id !== id))
}

export function getAllRevenue() {
  return readRevenue().sort((a, b) => new Date(b.date) - new Date(a.date))
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export async function addExpense(data) {
  const expenses = readExpenses()
  const expense = { id: `exp_${Date.now()}`, ...data, created_at: new Date().toISOString() }
  writeExpenses([...expenses, expense])
  return expense
}

export async function deleteExpense(id) {
  writeExpenses(readExpenses().filter(e => e.id !== id))
}

export function getAllExpenses() {
  return readExpenses().sort((a, b) => new Date(b.date) - new Date(a.date))
}

// ── Invoices ──────────────────────────────────────────────────────────────────

function readInvoices() {
  return JSON.parse(localStorage.getItem('polyhq_invoices') || '[]')
}

function writeInvoices(data) {
  localStorage.setItem('polyhq_invoices', JSON.stringify(data))
}

function nextInvoiceNumber() {
  const invoices = readInvoices()
  const max = invoices.reduce((m, inv) => Math.max(m, parseInt(inv.number.slice(4)) || 0), 0)
  return `INV-${String(max + 1).padStart(4, '0')}`
}

export function createInvoice(data) {
  const invoices = readInvoices()
  const invoice = {
    id: `inv_${Date.now()}`,
    number: nextInvoiceNumber(),
    status: 'draft',
    sent_at: null,
    paid_at: null,
    created_at: new Date().toISOString(),
    ...data,
  }
  writeInvoices([...invoices, invoice])
  return invoice
}

export function updateInvoice(id, updates) {
  const invoices = readInvoices()
  const idx = invoices.findIndex(inv => inv.id === id)
  if (idx === -1) return null
  invoices[idx] = { ...invoices[idx], ...updates }
  writeInvoices(invoices)
  return invoices[idx]
}

export function deleteInvoice(id) {
  writeInvoices(readInvoices().filter(inv => inv.id !== id))
}

export function getAllInvoices() {
  const today = new Date().toISOString().split('T')[0]
  const invoices = readInvoices()
  let changed = false
  const updated = invoices.map(inv => {
    if (['sent', 'viewed'].includes(inv.status) && inv.due_date && inv.due_date < today) {
      changed = true
      return { ...inv, status: 'overdue' }
    }
    return inv
  })
  if (changed) writeInvoices(updated)
  return updated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function getInvoiceById(id) {
  return getAllInvoices().find(inv => inv.id === id) ?? null
}

// ── Jobs / Schedule ───────────────────────────────────────────────────────────

function readJobs() { return JSON.parse(localStorage.getItem('polyhq_jobs') || '[]') }
function writeJobs(d) { localStorage.setItem('polyhq_jobs', JSON.stringify(d)) }

function shiftDate(dateStr, pattern) {
  const d = new Date(dateStr + 'T00:00:00')
  if (pattern === 'weekly')   d.setDate(d.getDate() + 7)
  if (pattern === 'biweekly') d.setDate(d.getDate() + 14)
  if (pattern === 'monthly')  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

function recurringDates(start, pattern, endDate) {
  const cutoff = endDate || (() => {
    const d = new Date(start + 'T00:00:00'); d.setMonth(d.getMonth() + 3); return d.toISOString().split('T')[0]
  })()
  const dates = []
  let cur = start
  for (let i = 0; i < 52; i++) {
    cur = shiftDate(cur, pattern)
    if (cur > cutoff) break
    dates.push(cur)
  }
  return dates
}

export function createJob(data) {
  const jobs = readJobs()
  const id = `job_${Date.now()}`
  const base = { id, status: 'scheduled', parent_id: null, created_at: new Date().toISOString(), ...data }
  jobs.push(base)

  if (data.recurring) {
    recurringDates(data.date, data.recurring, data.recurring_end || '').forEach((date, i) => {
      jobs.push({ ...base, id: `job_${Date.now()}_r${i}`, date, parent_id: id, status: 'scheduled', created_at: new Date().toISOString() })
    })
  }

  writeJobs(jobs)
  ;(data.assigned_to || []).forEach(uid => _pushNotif(uid, 'job_assigned',
    'New job scheduled',
    `${data.service_type} for ${data.client_name} on ${data.date}${data.start_time ? ' at ' + fmt12(data.start_time) : ''}`,
    id))
  return base
}

export function updateJob(id, updates) {
  const jobs = readJobs()
  const idx = jobs.findIndex(j => j.id === id)
  if (idx === -1) return null
  const prev = jobs[idx]
  jobs[idx] = { ...prev, ...updates }
  writeJobs(jobs)

  const prevAssigned = prev.assigned_to || []
  const newAssigned  = updates.assigned_to ?? prevAssigned
  newAssigned.filter(uid => !prevAssigned.includes(uid)).forEach(uid =>
    _pushNotif(uid, 'job_assigned', 'New job scheduled',
      `${jobs[idx].service_type} for ${jobs[idx].client_name} on ${jobs[idx].date}`, id))
  if (updates.date && updates.date !== prev.date) {
    prevAssigned.filter(uid => newAssigned.includes(uid)).forEach(uid =>
      _pushNotif(uid, 'job_updated', 'Job rescheduled',
        `${jobs[idx].service_type} for ${jobs[idx].client_name} moved to ${updates.date}`, id))
  }
  return jobs[idx]
}

export function deleteJob(id, allInSeries = false) {
  const jobs = readJobs()
  const job = jobs.find(j => j.id === id)
  if (!job) return
  const root = job.parent_id || id
  writeJobs(jobs.filter(j => allInSeries ? (j.id !== root && j.parent_id !== root) : j.id !== id))
}

export function getJobsInRange(start, end) {
  return readJobs()
    .filter(j => j.date >= start && j.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
}

export function getJobsForEmployee(userId) {
  return readJobs()
    .filter(j => (j.assigned_to || []).includes(userId))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ── Availability ──────────────────────────────────────────────────────────────

function readAvail() { return JSON.parse(localStorage.getItem('polyhq_availability') || '{}') }
function writeAvail(d) { localStorage.setItem('polyhq_availability', JSON.stringify(d)) }

export function getAvailability(userId) { return readAvail()[userId] ?? [] }
export function getAllAvailability()    { return readAvail() }

export function toggleUnavailableDate(userId, date) {
  const all = readAvail()
  const cur = all[userId] ?? []
  all[userId] = cur.includes(date) ? cur.filter(d => d !== date) : [...cur, date]
  writeAvail(all)
  return all[userId]
}

// ── Notifications ─────────────────────────────────────────────────────────────

function readNotifs() { return JSON.parse(localStorage.getItem('polyhq_notifs') || '[]') }
function writeNotifs(d) { localStorage.setItem('polyhq_notifs', JSON.stringify(d)) }

function _pushNotif(userId, type, title, message, jobId = null) {
  const n = readNotifs()
  n.push({ id: `n_${Date.now()}_${Math.random().toString(36).slice(2,5)}`, user_id: userId, type, title, message, job_id: jobId, read: false, created_at: new Date().toISOString() })
  writeNotifs(n)
}

export function getNotifications(userId) {
  return readNotifs().filter(n => n.user_id === userId).sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0, 40)
}

export function getUnreadCount(userId) {
  return readNotifs().filter(n => n.user_id === userId && !n.read).length
}

export function markNotificationRead(id) {
  const n = readNotifs(); const i = n.findIndex(x => x.id === id)
  if (i >= 0) { n[i].read = true; writeNotifs(n) }
}

export function markAllNotificationsRead(userId) {
  writeNotifs(readNotifs().map(n => n.user_id === userId ? {...n, read: true} : n))
}

// ── All jobs (for comms / notes / photos filtering) ───────────────────────────

export function getAllJobs() {
  return readJobs().sort((a, b) => b.date.localeCompare(a.date))
}

// ── Owners list (so employees know who to DM) ─────────────────────────────────

export function getOwners() {
  const builtIn = DEMO_USERS.filter(u => u.role === 'owner')
  const registered = getRegisteredUsers().filter(u => ['owner', 'co_owner'].includes(u.role))
  return [...builtIn, ...registered].map(({ password: _, ...u }) => u)
}

// ── Direct Messages ───────────────────────────────────────────────────────────

function readDMs() { return JSON.parse(localStorage.getItem('polyhq_dm') || '[]') }
function writeDMs(d) { localStorage.setItem('polyhq_dm', JSON.stringify(d)) }

export function sendDM(fromId, toId, body) {
  const msg = { id: `dm_${Date.now()}`, from_id: fromId, to_id: toId, body: body.trim(), created_at: new Date().toISOString(), read: false }
  writeDMs([...readDMs(), msg])
  return msg
}

export function getDMThread(uid1, uid2) {
  return readDMs()
    .filter(m => (m.from_id === uid1 && m.to_id === uid2) || (m.from_id === uid2 && m.to_id === uid1))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export function markThreadRead(toId, fromId) {
  writeDMs(readDMs().map(m =>
    (m.from_id === fromId && m.to_id === toId && !m.read) ? { ...m, read: true } : m
  ))
}

export function getUnreadDMCount(userId) {
  return readDMs().filter(m => m.to_id === userId && !m.read).length
}

// ── Announcements ─────────────────────────────────────────────────────────────

function readAnn() { return JSON.parse(localStorage.getItem('polyhq_announcements') || '[]') }
function writeAnn(d) { localStorage.setItem('polyhq_announcements', JSON.stringify(d)) }

export function sendAnnouncement(authorId, body) {
  const a = { id: `ann_${Date.now()}`, author_id: authorId, body: body.trim(), created_at: new Date().toISOString(), read_by: [authorId] }
  writeAnn([...readAnn(), a])
  return a
}

export function deleteAnnouncement(id) {
  writeAnn(readAnn().filter(a => a.id !== id))
}

export function getAnnouncements() {
  return readAnn().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function markAnnouncementRead(userId, annId) {
  writeAnn(readAnn().map(a =>
    a.id === annId && !a.read_by.includes(userId)
      ? { ...a, read_by: [...a.read_by, userId] } : a
  ))
}

export function getUnreadAnnouncementCount(userId) {
  return readAnn().filter(a => !a.read_by.includes(userId)).length
}

// ── Job Notes ─────────────────────────────────────────────────────────────────

function readJobNotes() { return JSON.parse(localStorage.getItem('polyhq_job_notes') || '[]') }
function writeJobNotes(d) { localStorage.setItem('polyhq_job_notes', JSON.stringify(d)) }

export function addJobNote(jobId, userId, body) {
  const note = { id: `note_${Date.now()}`, job_id: jobId, user_id: userId, body: body.trim(), created_at: new Date().toISOString() }
  writeJobNotes([...readJobNotes(), note])
  return note
}

export function getJobNotes(jobId) {
  return readJobNotes()
    .filter(n => n.job_id === jobId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

// ── Photos ────────────────────────────────────────────────────────────────────

function readPhotos() { return JSON.parse(localStorage.getItem('polyhq_photos') || '[]') }
function writePhotos(d) { localStorage.setItem('polyhq_photos', JSON.stringify(d)) }

export function addPhoto({ job_id = null, user_id, caption = '', label = 'general', data_url }) {
  const p = { id: `photo_${Date.now()}`, job_id, user_id, caption, label, data_url, created_at: new Date().toISOString() }
  writePhotos([...readPhotos(), p])
  return p
}

export function getAllPhotos() {
  return readPhotos().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function getPhotosByJob(jobId) {
  return readPhotos().filter(p => p.job_id === jobId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function getPhotosByUser(userId) {
  return readPhotos().filter(p => p.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function deletePhoto(id) {
  writePhotos(readPhotos().filter(p => p.id !== id))
}

// ── Combined unread count (for nav badge) ─────────────────────────────────────

export function getUnreadCommsCount(userId) {
  return getUnreadDMCount(userId) + getUnreadAnnouncementCount(userId)
}
