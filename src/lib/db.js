import { supabase } from './supabase.js'

// ── Pure utility functions (no DB) ────────────────────────────────────────────
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

export function entryDuration(entry) {
  const start = new Date(entry.clock_in)
  const end = entry.clock_out ? new Date(entry.clock_out) : new Date()
  return Math.max(0, (end - start) / 3600000)
}

export function calcPayroll(hours, hourlyRate) {
  const rate = parseFloat(hourlyRate) || 0
  const gross = parseFloat((hours * rate).toFixed(2))
  return { hours: parseFloat(hours.toFixed(2)), gross, net: gross }
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ── Business ID cache ─────────────────────────────────────────────────────────
let _businessId = null

async function biz() {
  if (_businessId) return _businessId
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()
  _businessId = data?.business_id ?? null
  return _businessId
}

export function clearBizCache() { _businessId = null }

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function getEmployees() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, role, hourly_rate')
    .eq('role', 'employee')
    .order('name')
  return data || []
}

export async function getCoOwners() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, role, hourly_rate')
    .eq('role', 'co_owner')
    .order('name')
  return data || []
}

export async function getOwners() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, role, hourly_rate')
    .in('role', ['owner', 'co_owner'])
    .order('name')
  return data || []
}

export async function getAllTeamMembers() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, role, hourly_rate')
    .in('role', ['employee', 'co_owner'])
    .order('name')
  return data || []
}

export async function updateEmployeeRate(userId, rate) {
  await supabase
    .from('profiles')
    .update({ hourly_rate: parseFloat(rate) || 0 })
    .eq('id', userId)
}

export async function updateTeamMemberRole(userId, newRole) {
  await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
}

export async function updateTeamMemberRate(userId, rate) {
  await supabase
    .from('profiles')
    .update({ hourly_rate: parseFloat(rate) || 0 })
    .eq('id', userId)
}

export async function removeEmployee(userId) {
  await supabase.from('profiles').delete().eq('id', userId)
}

export async function removeCoOwner(userId) {
  await supabase.from('profiles').delete().eq('id', userId)
}

export async function removeTeamMember(userId) {
  await supabase.from('profiles').delete().eq('id', userId)
}

// ── Pending invites ───────────────────────────────────────────────────────────
export async function inviteTeamMember({ name, email, role, hourly_rate }) {
  const businessId = await biz()
  const { error } = await supabase.from('pending_invites').upsert({
    business_id: businessId,
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role,
    hourly_rate: parseFloat(hourly_rate) || 0,
  }, { onConflict: 'business_id,email' })
  if (error) throw new Error(error.message)
}

export async function addEmployee(form) {
  return inviteTeamMember({ ...form, role: 'employee' })
}

export async function addCoOwner(form) {
  return inviteTeamMember({ ...form, role: 'co_owner' })
}

export async function getPendingInvites() {
  const { data } = await supabase
    .from('pending_invites')
    .select('*')
    .order('created_at')
  return data || []
}

export async function deletePendingInvite(id) {
  await supabase.from('pending_invites').delete().eq('id', id)
}

// ── Clock records ─────────────────────────────────────────────────────────────
export async function clockIn(userId) {
  const businessId = await biz()
  const active = await getActiveEntry(userId)
  if (active) throw new Error('Already clocked in')
  const { data, error } = await supabase
    .from('clock_records')
    .insert({ business_id: businessId, user_id: userId, clock_in: new Date().toISOString() })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function clockOut(userId) {
  const active = await getActiveEntry(userId)
  if (!active) throw new Error('Not clocked in')
  const { data, error } = await supabase
    .from('clock_records')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', active.id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function getActiveEntry(userId) {
  const { data } = await supabase
    .from('clock_records')
    .select('*')
    .eq('user_id', userId)
    .is('clock_out', null)
    .limit(1)
  return data?.[0] || null
}

export async function getEntriesForUser(userId) {
  const { data } = await supabase
    .from('clock_records')
    .select('*')
    .eq('user_id', userId)
    .order('clock_in', { ascending: false })
  return data || []
}

export async function getEntriesInRange(start, end, userId = null) {
  let q = supabase
    .from('clock_records')
    .select('*')
    .gte('clock_in', start.toISOString())
    .lte('clock_in', end.toISOString())
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q
  return data || []
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
function shiftDate(dateStr, pattern) {
  const d = new Date(dateStr + 'T00:00:00')
  if (pattern === 'weekly')   d.setDate(d.getDate() + 7)
  if (pattern === 'biweekly') d.setDate(d.getDate() + 14)
  if (pattern === 'monthly')  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

function recurringDates(start, pattern, endDate) {
  const cutoff = endDate || (() => {
    const d = new Date(start + 'T00:00:00')
    d.setMonth(d.getMonth() + 3)
    return d.toISOString().split('T')[0]
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

async function pushJobNotif(userId, type, title, message, jobId) {
  const businessId = await biz()
  await supabase.from('notifications').insert({
    business_id: businessId, user_id: userId, type, title, message, job_id: jobId, read: false,
  })
}

export async function createJob(data) {
  const businessId = await biz()
  const payload = { ...data, business_id: businessId, parent_id: null, status: data.status || 'scheduled' }
  const { data: job, error } = await supabase.from('jobs').insert(payload).select().single()
  if (error) throw new Error(error.message)

  if (data.recurring && data.date) {
    const dates = recurringDates(data.date, data.recurring, data.recurring_end || '')
    if (dates.length > 0) {
      await supabase.from('jobs').insert(dates.map(date => ({
        ...payload, date, parent_id: job.id, status: 'scheduled',
      })))
    }
  }

  for (const uid of (data.assigned_to || [])) {
    await pushJobNotif(uid, 'job_assigned', 'New job scheduled',
      `${data.service_type} for ${data.client_name} on ${data.date}${data.start_time ? ' at ' + fmt12(data.start_time) : ''}`,
      job.id)
  }
  return job
}

export async function updateJob(id, updates) {
  const { data: prev } = await supabase.from('jobs').select('*').eq('id', id).single()
  const { data: job, error } = await supabase.from('jobs').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)

  if (prev && updates.assigned_to) {
    const prevAssigned = prev.assigned_to || []
    const newAssigned = updates.assigned_to
    for (const uid of newAssigned.filter(u => !prevAssigned.includes(u))) {
      await pushJobNotif(uid, 'job_assigned', 'New job scheduled',
        `${job.service_type} for ${job.client_name} on ${job.date}`, id)
    }
    if (updates.date && updates.date !== prev.date) {
      for (const uid of prevAssigned.filter(u => newAssigned.includes(u))) {
        await pushJobNotif(uid, 'job_updated', 'Job rescheduled',
          `${job.service_type} for ${job.client_name} moved to ${updates.date}`, id)
      }
    }
  }
  return job
}

export async function deleteJob(id, allInSeries = false) {
  if (allInSeries) {
    const { data: job } = await supabase.from('jobs').select('parent_id').eq('id', id).single()
    const root = job?.parent_id || id
    await supabase.from('jobs').delete().or(`id.eq.${root},parent_id.eq.${root}`)
  } else {
    await supabase.from('jobs').delete().eq('id', id)
  }
}

export async function getJobsInRange(start, end) {
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('start_time')
  return data || []
}

export async function getJobsForEmployee(userId) {
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .contains('assigned_to', [userId])
    .order('date')
  return data || []
}

export async function getAllJobs() {
  const { data } = await supabase.from('jobs').select('*').order('date', { ascending: false })
  return data || []
}

export async function getJobById(id) {
  const { data } = await supabase.from('jobs').select('*').eq('id', id).single()
  return data || null
}

// ── Availability ──────────────────────────────────────────────────────────────
export async function getAvailability(userId) {
  const { data } = await supabase.from('availability').select('date').eq('user_id', userId)
  return (data || []).map(r => r.date)
}

export async function getAllAvailability() {
  const { data } = await supabase.from('availability').select('user_id, date')
  const result = {}
  for (const row of (data || [])) {
    result[row.user_id] = result[row.user_id] || []
    result[row.user_id].push(row.date)
  }
  return result
}

export async function toggleUnavailableDate(userId, date) {
  const businessId = await biz()
  const { data: existing } = await supabase
    .from('availability')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .limit(1)
  if (existing?.length) {
    await supabase.from('availability').delete().eq('id', existing[0].id)
  } else {
    await supabase.from('availability').insert({ user_id: userId, date, business_id: businessId })
  }
  return getAvailability(userId)
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications(userId) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)
  return data || []
}

export async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  return count || 0
}

export async function markNotificationRead(id) {
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllNotificationsRead(userId) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
}

// ── Revenue ───────────────────────────────────────────────────────────────────
export async function addRevenue(data) {
  const businessId = await biz()
  const { data: rev, error } = await supabase
    .from('revenue')
    .insert({ ...data, business_id: businessId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rev
}

export async function deleteRevenue(id) {
  await supabase.from('revenue').delete().eq('id', id)
}

export async function getAllRevenue() {
  const { data } = await supabase.from('revenue').select('*').order('date', { ascending: false })
  return data || []
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export async function addExpense(data) {
  const businessId = await biz()
  const { data: exp, error } = await supabase
    .from('expenses')
    .insert({
      description: data.description,
      amount: parseFloat(data.amount) || 0,
      category: data.category,
      date: data.date,
      business_id: businessId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return exp
}

export async function deleteExpense(id) {
  await supabase.from('expenses').delete().eq('id', id)
}

export async function getAllExpenses() {
  const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false })
  return data || []
}

// ── Invoices ──────────────────────────────────────────────────────────────────
async function nextInvoiceNumber() {
  const { data } = await supabase
    .from('invoices')
    .select('number')
    .order('created_at', { ascending: false })
    .limit(200)
  const max = (data || []).reduce((m, inv) => {
    const n = parseInt((inv.number || '').replace('INV-', '')) || 0
    return Math.max(m, n)
  }, 0)
  return `INV-${String(max + 1).padStart(4, '0')}`
}

export async function createInvoice(data) {
  const businessId = await biz()
  const number = await nextInvoiceNumber()
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({ ...data, business_id: businessId, number, status: 'draft' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return inv
}

export async function updateInvoice(id, updates) {
  const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteInvoice(id) {
  await supabase.from('invoices').delete().eq('id', id)
}

export async function getAllInvoices() {
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })
  const today = new Date().toISOString().split('T')[0]
  const invoices = data || []
  const overdueIds = invoices
    .filter(inv => ['sent', 'viewed'].includes(inv.status) && inv.due_date && inv.due_date < today)
    .map(inv => inv.id)
  if (overdueIds.length > 0) {
    await supabase.from('invoices').update({ status: 'overdue' }).in('id', overdueIds)
    return invoices.map(inv => overdueIds.includes(inv.id) ? { ...inv, status: 'overdue' } : inv)
  }
  return invoices
}

export async function getInvoiceById(id) {
  const { data } = await supabase.from('invoices').select('*').eq('id', id).single()
  return data || null
}

// ── Direct messages ───────────────────────────────────────────────────────────
export async function sendDM(fromId, toId, body) {
  const businessId = await biz()
  const { data } = await supabase
    .from('direct_messages')
    .insert({ business_id: businessId, from_id: fromId, to_id: toId, body: body.trim(), read: false })
    .select()
    .single()
  return data
}

export async function getDMThread(uid1, uid2) {
  const { data } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`and(from_id.eq.${uid1},to_id.eq.${uid2}),and(from_id.eq.${uid2},to_id.eq.${uid1})`)
    .order('created_at')
  return data || []
}

export async function markThreadRead(toId, fromId) {
  await supabase
    .from('direct_messages')
    .update({ read: true })
    .eq('from_id', fromId)
    .eq('to_id', toId)
    .eq('read', false)
}

export async function getUnreadDMCount(userId) {
  const { count } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('to_id', userId)
    .eq('read', false)
  return count || 0
}

// ── Announcements ─────────────────────────────────────────────────────────────
export async function sendAnnouncement(senderId, body) {
  const businessId = await biz()
  const { data } = await supabase
    .from('announcements')
    .insert({ business_id: businessId, sender_id: senderId, body: body.trim(), read_by: [senderId] })
    .select()
    .single()
  return data
}

export async function deleteAnnouncement(id) {
  await supabase.from('announcements').delete().eq('id', id)
}

export async function getAnnouncements() {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export async function markAnnouncementRead(userId, annId) {
  const { data: ann } = await supabase
    .from('announcements')
    .select('read_by')
    .eq('id', annId)
    .single()
  if (!ann || (ann.read_by || []).includes(userId)) return
  await supabase
    .from('announcements')
    .update({ read_by: [...ann.read_by, userId] })
    .eq('id', annId)
}

export async function getUnreadAnnouncementCount(userId) {
  const { data } = await supabase.from('announcements').select('read_by')
  return (data || []).filter(a => !(a.read_by || []).includes(userId)).length
}

export async function getUnreadCommsCount(userId) {
  const [dm, ann] = await Promise.all([
    getUnreadDMCount(userId),
    getUnreadAnnouncementCount(userId),
  ])
  return dm + ann
}

// ── Job notes ─────────────────────────────────────────────────────────────────
export async function addJobNote(jobId, userId, body) {
  const businessId = await biz()
  const { data } = await supabase
    .from('job_notes')
    .insert({ business_id: businessId, job_id: jobId, user_id: userId, body: body.trim() })
    .select()
    .single()
  return data
}

export async function getJobNotes(jobId) {
  const { data } = await supabase
    .from('job_notes')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at')
  return data || []
}

// ── Photos ────────────────────────────────────────────────────────────────────
function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)[1]
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

function withPublicUrl(photo) {
  const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
  return { ...photo, data_url: data.publicUrl }
}

export async function addPhoto({ job_id = null, user_id, caption = '', label = 'general', data_url }) {
  const businessId = await biz()
  const blob = dataUrlToBlob(data_url)
  const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const { error: uploadErr } = await supabase.storage
    .from('photos')
    .upload(path, blob, { contentType: 'image/jpeg' })
  if (uploadErr) throw new Error(uploadErr.message)
  const { data, error } = await supabase
    .from('photos')
    .insert({ business_id: businessId, job_id: job_id || null, user_id, caption, label, storage_path: path })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return withPublicUrl(data)
}

export async function getAllPhotos() {
  const { data } = await supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false })
  return (data || []).map(withPublicUrl)
}

export async function getPhotosByJob(jobId) {
  const { data } = await supabase
    .from('photos')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
  return (data || []).map(withPublicUrl)
}

export async function getPhotosByUser(userId) {
  const { data } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data || []).map(withPublicUrl)
}

export async function deletePhoto(id) {
  const { data: photo } = await supabase.from('photos').select('storage_path').eq('id', id).single()
  if (photo) {
    await supabase.storage.from('photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', id)
  }
}

// ── Business settings ─────────────────────────────────────────────────────────
export async function getBusinessSettings() {
  const businessId = await biz()
  if (!businessId) return { name: '', logo: '', address: '', phone: '', service_radius: 25, invite_code: '' }
  const { data } = await supabase.from('businesses').select('*').eq('id', businessId).single()
  return data || { name: '', logo: '', address: '', phone: '', service_radius: 25, invite_code: '' }
}

export async function saveBusinessSettings(updates) {
  const businessId = await biz()
  const { name, logo, address, phone, service_radius } = updates
  await supabase.from('businesses').update({ name, logo, address, phone, service_radius }).eq('id', businessId)
}

// ── Payroll settings ──────────────────────────────────────────────────────────
export async function getPayrollSettings() {
  const businessId = await biz()
  if (!businessId) return { pay_period: 'biweekly', pay_day: 5, tax_method: 'single' }
  const { data } = await supabase
    .from('businesses')
    .select('pay_period, pay_day, tax_method')
    .eq('id', businessId)
    .single()
  return data || { pay_period: 'biweekly', pay_day: 5, tax_method: 'single' }
}

export async function savePayrollSettings(settings) {
  const businessId = await biz()
  await supabase.from('businesses').update(settings).eq('id', businessId)
}

// ── Services ──────────────────────────────────────────────────────────────────
const DEFAULT_SERVICES = [
  { name: 'Window Washing',         default_price: 0, duration_minutes: 60  },
  { name: 'Screen Cleaning',        default_price: 0, duration_minutes: 30  },
  { name: 'Track & Frame Cleaning', default_price: 0, duration_minutes: 45  },
  { name: 'Pressure Washing',       default_price: 0, duration_minutes: 90  },
  { name: 'Storm Window Service',   default_price: 0, duration_minutes: 120 },
]

export async function getServices() {
  const { data } = await supabase.from('services').select('*').order('created_at')
  return data || []
}

export async function addService({ name, default_price = 0, duration_minutes = 60 }) {
  const businessId = await biz()
  const { data, error } = await supabase
    .from('services')
    .insert({
      business_id: businessId,
      name: name.trim(),
      default_price: parseFloat(default_price) || 0,
      duration_minutes: parseInt(duration_minutes) || 60,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateService(id, updates) {
  await supabase.from('services').update({
    name: updates.name?.trim(),
    default_price: parseFloat(updates.default_price) || 0,
    duration_minutes: parseInt(updates.duration_minutes) || 60,
  }).eq('id', id)
}

export async function deleteService(id) {
  await supabase.from('services').delete().eq('id', id)
}

export async function seedDefaultServices(businessId) {
  await supabase.from('services').insert(DEFAULT_SERVICES.map(s => ({ ...s, business_id: businessId })))
}
