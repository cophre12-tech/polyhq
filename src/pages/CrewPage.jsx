import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useSubscription } from '../hooks/useSubscription.js'
import { supabase } from '../lib/supabase.js'
import {
  getAllTeamMembers, updateTeamMemberRole, updateTeamMemberRate,
  removeTeamMember,
} from '../lib/db.js'

export default function CrewPage() {
  const { user } = useAuth()
  const { employeeLimit, plan, isAdmin } = useSubscription()
  const navigate = useNavigate()
  const isPrimaryOwner = user?.role === 'owner'

  const [members, setMembers]         = useState([])
  const [inviteCode, setInviteCode]   = useState('')
  const [editingRate, setEditingRate] = useState(null)
  const [confirm, setConfirm]         = useState(null)
  const [copied, setCopied]           = useState(false)
  const [loading, setLoading]         = useState(true)

  async function load() {
    const [membersResult, codeResult] = await Promise.all([
      getAllTeamMembers(),
      supabase.from('businesses').select('invite_code').eq('id', user.business_id).single(),
    ])
    console.log('[Crew] invite code result:', codeResult.data, codeResult.error)
    setMembers(membersResult)
    setInviteCode(codeResult.data?.invite_code || '')
    setLoading(false)
  }
  useEffect(() => { if (user?.business_id) load() }, [user?.business_id])

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
  const atLimit = !isAdmin && isFinite(employeeLimit) && employees.length >= employeeLimit
  const nearLimit = !isAdmin && isFinite(employeeLimit) && employees.length >= employeeLimit - 1 && !atLimit

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Crew</h1>
          <p className="text-fg-muted mt-1 text-sm">Manage your team — employees and co-owners</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-line-strong border-t-fg rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Crew</h1>
          <p className="text-fg-muted mt-1 text-sm">Manage your team — employees and co-owners</p>
        </div>
        {!isAdmin && isFinite(employeeLimit) && (
          <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${
            atLimit
              ? 'text-danger bg-danger/10 border-danger/25'
              : nearLimit
              ? 'text-warning bg-warning/10 border-warning/25'
              : 'text-fg-muted bg-raised border-line'
          }`}>
            <span>{employees.length} / {employeeLimit} employees</span>
            {atLimit && <span>· At limit</span>}
          </div>
        )}
      </div>

      {/* Employee limit upgrade prompt */}
      {atLimit && (
        <div className="mb-6 bg-danger/5 border border-danger/20 rounded-xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-fg">Employee limit reached</p>
            <p className="text-xs text-fg-muted mt-0.5">
              You&apos;re on the <span className="capitalize font-medium text-fg-muted">{plan}</span> plan ({employeeLimit} employee{employeeLimit !== 1 ? 's' : ''} max).
              New employees won&apos;t be able to join until you upgrade.
            </p>
          </div>
          <button
            onClick={() => navigate('/owner/settings', { state: { tab: 'subscription' } })}
            className="btn-primary shrink-0 text-xs px-4 py-2"
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* Invite code */}
      {inviteCode && (
        <div className="bg-surface border border-line rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="label mb-1">Business Invite Code</p>
            <p className="text-2xl font-mono font-semibold text-fg tracking-widest">{inviteCode}</p>
            <p className="text-xs text-fg-muted mt-1">
              Share this code. Employees go to <span className="text-fg-muted">Sign Up → Join a Team</span> and enter it to create their account.
            </p>
          </div>
          <button
            onClick={copyCode}
            className={`shrink-0 text-xs font-medium border px-3 py-2 rounded-lg transition-colors ${
              copied
                ? 'text-success border-success/40 bg-success/10'
                : 'text-fg border-line hover:border-line-strong'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Co-owners */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-fg">Co-Owners</h2>
          <p className="text-xs text-fg-subtle mt-0.5">Full access — promote an employee to add one</p>
        </div>

        {coOwners.length === 0 ? (
          <p className="px-5 py-8 text-center text-fg-subtle text-sm">
            No co-owners yet. Promote an employee from the list below.
          </p>
        ) : (
          <div className="divide-y divide-line">
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
                roleColor="text-fg-muted bg-raised border-line"
                avatarColor="bg-raised border-line text-fg-muted"
                toggleLabel="Demote to Employee"
              />
            ))}
          </div>
        )}
      </div>

      {/* Employees */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-semibold text-fg">Employees</h2>
          <span className="text-xs text-fg-subtle">
            {employees.length}{isFinite(employeeLimit) && !isAdmin ? ` / ${employeeLimit}` : ''} registered
          </span>
        </div>

        {employees.length === 0 ? (
          <p className="px-5 py-10 text-center text-fg-subtle text-sm">
            No employees yet — share the invite code above so they can register.
          </p>
        ) : (
          <div className="divide-y divide-line">
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
                roleColor="text-fg-muted bg-overlay/50 border-line-strong"
                avatarColor="bg-raised border-line text-fg-muted"
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
      <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-semibold shrink-0 ${avatarColor}`}>
        {member.name[0]}
      </div>

      {/* Name / email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg truncate">{member.name}</p>
        <p className="text-xs text-fg-muted truncate">{member.email}</p>
      </div>

      {/* Role badge */}
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${roleColor}`}>
        {roleLabel}
      </span>

      {/* Rate editor */}
      <div className="w-full sm:w-auto order-last sm:order-none pl-12 sm:pl-0">
        {editingRate?.id === member.id ? (
          <div className="flex items-center gap-1">
            <span className="text-fg-muted text-xs">$</span>
            <input
              type="number" min="0" step="0.50" value={editingRate.value}
              onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
              onBlur={() => commitRate(member.id)}
              onKeyDown={e => { if (e.key === 'Enter') commitRate(member.id); if (e.key === 'Escape') setEditingRate(null) }}
              autoFocus
              className="w-20 bg-overlay border border-accent rounded px-2 py-1.5 text-fg text-sm text-right focus:outline-none tabular-nums"
            />
            <span className="text-fg-muted text-xs">/hr</span>
          </div>
        ) : (
          <button
            onClick={() => setEditingRate({ id: member.id, value: member.hourly_rate ?? '' })}
            className={`inline-flex items-center gap-1.5 text-sm transition-colors ${member.hourly_rate ? 'text-fg-muted hover:text-fg' : 'text-warning hover:text-warning/80'}`}
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
              <button onClick={() => onRemove(member.id)} className="text-xs font-semibold text-fg bg-danger hover:bg-danger/85 px-2.5 py-1.5 rounded-lg transition-colors">
                Remove
              </button>
              <button onClick={() => setConfirm(null)} className="text-xs text-fg-muted hover:text-fg transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleRole(member)}
                className="text-xs text-fg-muted hover:text-fg border border-line hover:border-line-strong px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                {toggleLabel}
              </button>
              <button
                onClick={() => setConfirm(member.id)}
                className="text-xs text-fg-muted hover:text-danger border border-line hover:border-danger/50 px-2.5 py-1.5 rounded-lg transition-colors"
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
