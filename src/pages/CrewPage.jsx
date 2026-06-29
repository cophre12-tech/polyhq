import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getAllTeamMembers, updateTeamMemberRole, updateTeamMemberRate,
  removeTeamMember, getBusinessSettings,
} from '../lib/db.js'

export default function CrewPage() {
  const { user } = useAuth()
  const isPrimaryOwner = user?.role === 'owner'

  const [members, setMembers]       = useState([])
  const [inviteCode, setInviteCode] = useState('')
  const [editingRate, setEditingRate] = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const [copied, setCopied]         = useState(false)

  async function load() {
    const [all, biz] = await Promise.all([getAllTeamMembers(), getBusinessSettings()])
    setMembers(all)
    setInviteCode(biz.invite_code || '')
  }
  useEffect(() => { load() }, [])

  async function commitRate(memberId) {
    const rate = parseFloat(editingRate.value)
    if (!isNaN(rate) && rate >= 0) { await updateTeamMemberRate(memberId, rate); load() }
    setEditingRate(null)
  }

  async function handleToggleRole(member) {
    const newRole = member.role === 'co_owner' ? 'employee' : 'co_owner'
    await updateTeamMemberRole(member.id, newRole)
    load()
  }

  async function handleRemove(id) {
    await removeTeamMember(id)
    setConfirm(null)
    load()
  }

  async function copyCode() {
    await navigator.clipboard?.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const coOwners = members.filter(m => m.role === 'co_owner')
  const employees = members.filter(m => m.role === 'employee')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Crew</h1>
        <p className="text-slate-400 mt-1 text-sm">Manage your team — employees and co-owners</p>
      </div>

      {/* Invite code */}
      {inviteCode && (
        <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-1">Business Invite Code</p>
            <p className="text-2xl font-mono font-bold text-white tracking-widest">{inviteCode}</p>
            <p className="text-xs text-slate-400 mt-1">
              Share this code. Employees go to <span className="text-slate-300">Sign Up → Join a Team</span> and enter it to create their account.
            </p>
          </div>
          <button
            onClick={copyCode}
            className={`shrink-0 text-xs font-medium border px-3 py-2 rounded-lg transition-colors ${
              copied
                ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                : 'text-indigo-400 border-indigo-500/30 hover:border-indigo-400/50 hover:text-indigo-300'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Co-owners */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Co-Owners</h2>
          <p className="text-xs text-slate-500 mt-0.5">Full access — promote an employee to add one</p>
        </div>

        {coOwners.length === 0 ? (
          <p className="px-5 py-8 text-center text-slate-500 text-sm">
            No co-owners yet. Promote an employee from the list below.
          </p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {coOwners.map(co => (
              <MemberRow
                key={co.id}
                member={co}
                isPrimaryOwner={isPrimaryOwner}
                editingRate={editingRate}
                setEditingRate={setEditingRate}
                commitRate={commitRate}
                confirm={confirm}
                setConfirm={setConfirm}
                onToggleRole={handleToggleRole}
                onRemove={handleRemove}
                roleLabel="Co-Owner"
                roleColor="text-violet-400 bg-violet-500/10 border-violet-500/20"
                avatarColor="bg-violet-600/20 border-violet-500/30 text-violet-300"
                toggleLabel="Demote to Employee"
              />
            ))}
          </div>
        )}
      </div>

      {/* Employees */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Employees</h2>
          <span className="text-xs text-slate-500">{employees.length} registered</span>
        </div>

        {employees.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-500 text-sm">
            No employees yet — share the invite code above so they can register.
          </p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {employees.map(emp => (
              <MemberRow
                key={emp.id}
                member={emp}
                isPrimaryOwner={isPrimaryOwner}
                editingRate={editingRate}
                setEditingRate={setEditingRate}
                commitRate={commitRate}
                confirm={confirm}
                setConfirm={setConfirm}
                onToggleRole={handleToggleRole}
                onRemove={handleRemove}
                roleLabel="Employee"
                roleColor="text-slate-300 bg-slate-700/50 border-slate-600/50"
                avatarColor="bg-indigo-600/20 border-indigo-500/30 text-indigo-300"
                toggleLabel="Promote to Co-Owner"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member, isPrimaryOwner,
  editingRate, setEditingRate, commitRate,
  confirm, setConfirm,
  onToggleRole, onRemove,
  roleLabel, roleColor, avatarColor, toggleLabel,
}) {
  return (
    <div className="px-5 py-4 flex flex-wrap sm:flex-nowrap items-center gap-3">
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor}`}>
        {member.name[0]}
      </div>

      {/* Name / email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{member.name}</p>
        <p className="text-xs text-slate-400 truncate">{member.email}</p>
      </div>

      {/* Role badge */}
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${roleColor}`}>
        {roleLabel}
      </span>

      {/* Rate editor */}
      <div className="w-full sm:w-auto order-last sm:order-none pl-12 sm:pl-0">
        {editingRate?.id === member.id ? (
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-xs">$</span>
            <input
              type="number" min="0" step="0.50" value={editingRate.value}
              onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
              onBlur={() => commitRate(member.id)}
              onKeyDown={e => { if (e.key === 'Enter') commitRate(member.id); if (e.key === 'Escape') setEditingRate(null) }}
              autoFocus
              className="w-20 bg-slate-700 border border-indigo-500 rounded px-2 py-1.5 text-white text-sm text-right focus:outline-none tabular-nums"
            />
            <span className="text-slate-400 text-xs">/hr</span>
          </div>
        ) : (
          <button
            onClick={() => setEditingRate({ id: member.id, value: member.hourly_rate ?? '' })}
            className={`inline-flex items-center gap-1.5 text-sm transition-colors ${member.hourly_rate ? 'text-slate-300 hover:text-white' : 'text-amber-400 hover:text-amber-300'}`}
            title="Click to edit rate"
          >
            {member.hourly_rate ? `$${member.hourly_rate}/hr` : 'Set rate'}
            <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
            </svg>
          </button>
        )}
      </div>

      {/* Actions */}
      {isPrimaryOwner && (
        <div className="shrink-0">
          {confirm === member.id ? (
            <div className="flex items-center gap-2">
              <button onClick={() => onRemove(member.id)} className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 rounded-lg transition-colors">
                Remove
              </button>
              <button onClick={() => setConfirm(null)} className="text-xs text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleRole(member)}
                className="text-xs text-slate-400 hover:text-indigo-400 border border-slate-700 hover:border-indigo-500/50 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                {toggleLabel}
              </button>
              <button
                onClick={() => setConfirm(member.id)}
                className="text-xs text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
