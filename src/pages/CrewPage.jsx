import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getEmployees, addEmployee, removeEmployee, updateEmployeeRate,
  getCoOwners, addCoOwner, removeCoOwner,
} from '../lib/db.js'

const EMPTY_EMP = { name: '', email: '', password: '', hourly_rate: '' }
const EMPTY_CO  = { name: '', email: '', password: '' }

function isRegistered(emp) {
  return emp.id.startsWith('user_')
}

export default function CrewPage() {
  const { user } = useAuth()
  const isPrimaryOwner = user?.role === 'owner'

  const [employees, setEmployees]   = useState([])
  const [coOwners, setCoOwners]     = useState([])

  const [empForm, setEmpForm]       = useState(EMPTY_EMP)
  const [empError, setEmpError]     = useState('')
  const [empSuccess, setEmpSuccess] = useState('')

  const [coForm, setCoForm]         = useState(EMPTY_CO)
  const [coError, setCoError]       = useState('')
  const [coSuccess, setCoSuccess]   = useState('')
  const [showCoForm, setShowCoForm] = useState(false)

  const [editingRate, setEditingRate]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmCoDelete, setConfirmCoDelete] = useState(null)

  function load() {
    setEmployees(getEmployees())
    setCoOwners(getCoOwners())
  }
  useEffect(() => { load() }, [])

  function setEmp(f, v) { setEmpForm(p => ({ ...p, [f]: v })) }
  function setCo(f, v)  { setCoForm(p => ({ ...p, [f]: v })) }

  function handleAddEmployee(e) {
    e.preventDefault()
    setEmpError(''); setEmpSuccess('')
    try {
      addEmployee(empForm)
      setEmpSuccess(`${empForm.name} added successfully.`)
      setEmpForm(EMPTY_EMP)
      load()
    } catch (err) { setEmpError(err.message) }
  }

  function handleRemoveEmployee(id) {
    removeEmployee(id)
    setConfirmDelete(null)
    load()
  }

  function handleAddCoOwner(e) {
    e.preventDefault()
    setCoError(''); setCoSuccess('')
    try {
      addCoOwner(coForm)
      setCoSuccess(`${coForm.name} added as a co-owner. Share their credentials so they can log in.`)
      setCoForm(EMPTY_CO)
      setShowCoForm(false)
      load()
    } catch (err) { setCoError(err.message) }
  }

  function handleRemoveCoOwner(id) {
    removeCoOwner(id)
    setConfirmCoDelete(null)
    load()
  }

  function commitRate(empId) {
    const rate = parseFloat(editingRate.value)
    if (!isNaN(rate) && rate >= 0) { updateEmployeeRate(empId, rate); load() }
    setEditingRate(null)
  }
  function handleRateKey(e, empId) {
    if (e.key === 'Enter') commitRate(empId)
    if (e.key === 'Escape') setEditingRate(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Crew</h1>
        <p className="text-slate-400 mt-1 text-sm">Manage co-owners and employees</p>
      </div>

      {/* ── Co-Owners section ──────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-6">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-white">Co-Owners</h2>
            <p className="text-xs text-slate-500 mt-0.5">Full access to all business data</p>
          </div>
          {isPrimaryOwner && (
            <button
              onClick={() => { setShowCoForm(f => !f); setCoError(''); setCoSuccess('') }}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showCoForm ? 'Cancel' : '+ Invite'}
            </button>
          )}
        </div>

        {coOwners.length === 0 && !showCoForm && (
          <p className="px-6 py-8 text-center text-slate-500 text-sm">
            {isPrimaryOwner ? 'No co-owners yet — invite someone to share access.' : 'No co-owners have been added yet.'}
          </p>
        )}

        {coOwners.length > 0 && (
          <div className="divide-y divide-slate-800/60">
            {coOwners.map(co => (
              <div key={co.id} className="px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4">
                <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-sm font-bold shrink-0">
                  {co.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{co.name}</p>
                  <p className="text-xs text-slate-400 truncate">{co.email}</p>
                </div>
                <span className="text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full shrink-0">
                  Co-Owner
                </span>
                {isPrimaryOwner && (
                  <div className="shrink-0">
                    {confirmCoDelete === co.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleRemoveCoOwner(co.id)} className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 rounded-lg transition-colors">Remove</button>
                        <button onClick={() => setConfirmCoDelete(null)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmCoDelete(co.id)} className="text-xs text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 px-3 py-1.5 rounded-lg transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Invite form — owner only */}
        {isPrimaryOwner && showCoForm && (
          <div className="px-4 sm:px-6 py-5 border-t border-slate-800 bg-slate-800/30">
            <p className="text-sm font-medium text-slate-300 mb-4">Invite a Co-Owner</p>
            <form onSubmit={handleAddCoOwner}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input type="text" value={coForm.name} onChange={e => setCo('name', e.target.value)} required placeholder="Alex Rivera" className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                  <input type="email" value={coForm.email} onChange={e => setCo('email', e.target.value)} required placeholder="alex@company.com" className="input" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Temporary Password</label>
                  <input type="text" value={coForm.password} onChange={e => setCo('password', e.target.value)} required placeholder="Share this with them so they can log in" className="input" />
                </div>
              </div>
              {coError && <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4">{coError}</p>}
              {coSuccess && <p className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">{coSuccess}</p>}
              <button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-3 sm:py-2.5 text-sm transition-colors">
                Add Co-Owner
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Employees section ──────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-6">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-semibold text-white">Employees</h2>
          <span className="text-sm text-slate-400">{employees.length} total</span>
        </div>

        {employees.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500 text-sm">No employees yet — add one below.</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {employees.map(emp => (
              <div key={emp.id} className="px-4 sm:px-6 py-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold shrink-0">
                  {emp.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                  <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                </div>
                <div className="w-full sm:w-auto order-last sm:order-none mt-1 sm:mt-0 pl-12 sm:pl-0">
                  {isRegistered(emp) ? (
                    editingRate?.id === emp.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">$</span>
                        <input
                          type="number" min="0" step="0.50" value={editingRate.value}
                          onChange={e => setEditingRate(r => ({ ...r, value: e.target.value }))}
                          onBlur={() => commitRate(emp.id)}
                          onKeyDown={e => handleRateKey(e, emp.id)}
                          autoFocus
                          className="w-20 bg-slate-700 border border-indigo-500 rounded px-2 py-1.5 text-white text-sm text-right focus:outline-none tabular-nums"
                        />
                        <span className="text-slate-400 text-xs">/hr</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingRate({ id: emp.id, value: emp.hourly_rate ?? '' })}
                        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${emp.hourly_rate ? 'text-slate-300 hover:text-white' : 'text-amber-400 hover:text-amber-300'}`}
                        title="Click to edit rate"
                      >
                        {emp.hourly_rate ? `$${emp.hourly_rate}/hr` : 'Set rate'}
                        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                        </svg>
                      </button>
                    )
                  ) : (
                    <span className="text-sm text-slate-400">${emp.hourly_rate}/hr</span>
                  )}
                </div>
                <div className="shrink-0">
                  {isRegistered(emp) && (
                    confirmDelete === emp.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleRemoveEmployee(emp.id)} className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 rounded-lg transition-colors">Remove</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(emp.id)} className="text-xs text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 px-3 py-1.5 rounded-lg transition-colors">
                        Remove
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add employee form */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
        <h2 className="font-semibold text-white mb-5">Add Employee</h2>
        <form onSubmit={handleAddEmployee}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
              <input type="text" value={empForm.name} onChange={e => setEmp('name', e.target.value)} required placeholder="Jane Smith" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input type="email" value={empForm.email} onChange={e => setEmp('email', e.target.value)} required placeholder="jane@company.com" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Hourly Rate ($)</label>
              <input type="number" min="0" step="0.50" value={empForm.hourly_rate} onChange={e => setEmp('hourly_rate', e.target.value)} required placeholder="18.00" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Temporary Password</label>
              <input type="text" value={empForm.password} onChange={e => setEmp('password', e.target.value)} required placeholder="Share this with them to log in" className="input" />
            </div>
          </div>

          {empError && <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4">{empError}</p>}
          {empSuccess && <p className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">{empSuccess}</p>}

          <button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-3 sm:py-2.5 text-sm transition-colors">
            Add Employee
          </button>
        </form>
      </div>
    </div>
  )
}
