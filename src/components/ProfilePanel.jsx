import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProfilePanel({ open, onClose }) {
  const { user, businesses, switchBusiness, createBusiness, logout } = useAuth()
  const navigate = useNavigate()
  const isOwner = user?.role === 'owner' || user?.role === 'co_owner'

  const [switching, setSwitching]     = useState(null)
  const [showCreate, setShowCreate]   = useState(false)
  const [newBizName, setNewBizName]   = useState('')
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleSwitch(bizId) {
    if (bizId === user?.business_id || switching) return
    setSwitching(bizId)
    try {
      await switchBusiness(bizId)
      handleClose()
      navigate('/owner')
    } catch (err) {
      console.error('[ProfilePanel] switch failed:', err)
    } finally {
      setSwitching(null)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newBizName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      await createBusiness(newBizName)
      handleClose()
      navigate('/owner')
    } catch (err) {
      setCreateError(err.message)
      setCreating(false)
    }
  }

  function handleLogout() {
    logout()
    handleClose()
    navigate('/login')
  }

  function handleClose() {
    setShowCreate(false)
    setNewBizName('')
    setCreateError('')
    onClose()
  }

  const roleLabel = user?.role === 'co_owner' ? 'Co-Owner' : user?.role === 'owner' ? 'Owner' : 'Employee'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-base/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
      />

      {/* Slide-up panel */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 mx-auto max-w-sm w-full bg-surface border border-line border-b-0 rounded-t-2xl  transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-overlay" />
        </div>

        {/* User header */}
        <div className="px-5 pt-2 pb-4 border-b border-line flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-overlay border border-line flex items-center justify-center text-fg font-semibold shrink-0">
            {user?.name?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg truncate">{user?.name}</p>
            <p className="text-xs text-fg-muted truncate">{user?.email}</p>
          </div>
          <span className="text-xs text-fg-subtle shrink-0 font-medium">{roleLabel}</span>
        </div>

        {/* Businesses — owners only */}
        {isOwner && (
          <div className="px-4 py-4 border-b border-line">
            <p className="font-mono text-2xs font-medium text-fg-subtle uppercase tracking-wider px-1 mb-3">Your Businesses</p>

            {businesses.length === 0 ? (
              <p className="text-xs text-fg-subtle px-1 py-2">Loading…</p>
            ) : (
              <div className="space-y-1.5">
                {businesses.map(biz => {
                  const isActive   = biz.id === user?.business_id
                  const isSwitching = switching === biz.id
                  return (
                    <div
                      key={biz.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-surface border border-line' : 'bg-raised/50 border border-transparent'}`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-overlay border border-line-strong flex items-center justify-center text-xs font-semibold text-fg shrink-0">
                        {biz.name[0]?.toUpperCase()}
                      </div>
                      <p className="flex-1 text-sm font-medium text-fg truncate">{biz.name}</p>
                      {isActive ? (
                        <span className="text-xs font-semibold text-accent-fg shrink-0">Active</span>
                      ) : (
                        <button
                          onClick={() => handleSwitch(biz.id)}
                          disabled={!!switching}
                          className="shrink-0 text-xs font-semibold text-fg-muted hover:text-fg border border-line hover:border-line-strong px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {isSwitching ? 'Switching…' : 'Switch'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Create new business */}
            {showCreate ? (
              <form onSubmit={handleCreate} className="mt-3 bg-raised/60 border border-line rounded-xl p-3 space-y-2.5">
                <p className="text-xs font-semibold text-fg-muted">New Business Name</p>
                <input
                  type="text"
                  value={newBizName}
                  onChange={e => setNewBizName(e.target.value)}
                  placeholder="e.g. Sunrise Landscaping"
                  className="input w-full text-sm"
                  autoFocus
                />
                {createError && <p className="text-xs text-danger">{createError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creating || !newBizName.trim()}
                    className="btn-primary flex-1 py-2 text-sm"
                  >
                    {creating ? 'Creating…' : 'Create & Switch'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewBizName(''); setCreateError('') }}
                    className="px-3 py-2 rounded-lg text-fg-muted hover:text-fg hover:bg-overlay text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-line hover:border-line-strong text-fg-muted hover:text-fg transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create New Business
              </button>
            )}
          </div>
        )}

        {/* Sign out */}
        <div className="px-3 pt-2 pb-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-danger hover:bg-danger/10 active:bg-danger/15 transition-colors"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )
}
