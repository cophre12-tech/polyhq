import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAllInvoices, deleteInvoice } from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'

const STATUS_META = {
  draft:   { label: 'Draft',   color: 'bg-overlay/40 text-fg-muted' },
  sent:    { label: 'Sent',    color: 'bg-raised text-fg-muted' },
  viewed:  { label: 'Viewed',  color: 'bg-raised text-fg-muted' },
  paid:    { label: 'Paid',    color: 'bg-success/15 text-success' },
  overdue: { label: 'Overdue', color: 'bg-danger/15 text-danger' },
}

const ALL_STATUSES = ['all', 'draft', 'sent', 'viewed', 'paid', 'overdue']

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientSearch, setClientSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() { setInvoices(await getAllInvoices()) }
  useEffect(() => { load() }, [])

  const overdue = invoices.filter(inv => inv.status === 'overdue')

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (clientSearch && !inv.client_name.toLowerCase().includes(clientSearch.toLowerCase())) return false
    return true
  })

  const totalValue = filtered.reduce((s, inv) => s + (inv.total || 0), 0)

  async function handleDelete(id) {
    await deleteInvoice(id)
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Invoices</h1>
          <p className="text-fg-muted mt-1 text-sm">Create and track client invoices</p>
        </div>
        <Link to="/owner/invoices/new" className="btn-primary px-4 sm:px-5 py-2.5 text-sm flex gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">New Invoice</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div className="mb-5 flex items-start gap-3 bg-danger/10 border border-danger/25 rounded-xl px-4 sm:px-5 py-3.5">
          <svg className="w-4 h-4 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-sm text-danger">
            <span className="font-semibold">{overdue.length} overdue {overdue.length === 1 ? 'invoice' : 'invoices'}</span>
            {' '}— open each to resend a reminder.
          </p>
        </div>
      )}

      {/* Summary cards — 3 cols on mobile, 5 on sm+ */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mb-5">
        {ALL_STATUSES.filter(s => s !== 'all').map(status => {
          const count = invoices.filter(inv => inv.status === status).length
          const val   = invoices.filter(inv => inv.status === status).reduce((s, inv) => s + (inv.total || 0), 0)
          const meta  = STATUS_META[status]
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`bg-surface border rounded-xl px-3 sm:px-4 py-3 text-left transition-all ${
                statusFilter === status ? 'border-accent' : 'border-line hover:border-line-strong'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                <span className="text-base sm:text-lg font-semibold text-fg">{count}</span>
              </div>
              <p className="text-xs text-fg-subtle tabular-nums">{formatCurrency(val)}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input
            type="text"
            placeholder="Search client…"
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-line rounded-lg p-1 overflow-x-auto">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                statusFilter === s ? 'bg-overlay text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 border-b border-line flex justify-between items-center">
          <span className="text-sm text-fg-muted">{filtered.length} {filtered.length === 1 ? 'invoice' : 'invoices'}</span>
          <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(totalValue)}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-fg-muted font-medium mb-1">No invoices found</p>
            <p className="text-fg-subtle text-sm">
              {invoices.length === 0 ? 'Create your first invoice to get started.' : 'Try adjusting the filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map(inv => {
              const meta = STATUS_META[inv.status] || STATUS_META.draft
              return (
                <div key={inv.id} className="px-4 sm:px-6 py-4 hover:bg-raised/30 transition-colors group">
                  {/* Mobile layout */}
                  <div className="sm:hidden">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg truncate">{inv.client_name}</p>
                        <p className="text-xs text-fg-subtle font-mono">{inv.number}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                        <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(inv.total || 0)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs ${inv.status === 'overdue' ? 'text-danger' : 'text-fg-subtle'}`}>
                        Due {inv.due_date || '—'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Link to={`/owner/invoices/${inv.id}`} className="text-xs text-fg underline-offset-4 hover:underline font-medium transition-colors">View →</Link>
                        {confirmDelete === inv.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(inv.id)} className="text-xs text-fg bg-danger hover:bg-danger/85 px-2 py-1 rounded transition-colors">Yes</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-fg-muted">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(inv.id)} className="text-fg-subtle hover:text-danger transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:flex items-center gap-4">
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-mono font-semibold text-fg">{inv.number}</p>
                      <p className="text-xs text-fg-subtle mt-0.5">{inv.service_date}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{inv.client_name}</p>
                      {inv.client_email && <p className="text-xs text-fg-subtle truncate">{inv.client_email}</p>}
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      <p className="text-xs text-fg-muted">Due</p>
                      <p className={`text-sm font-medium tabular-nums ${inv.status === 'overdue' ? 'text-danger' : 'text-fg-muted'}`}>{inv.due_date || '—'}</p>
                    </div>
                    <div className="w-24 shrink-0 flex justify-center">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(inv.total || 0)}</span>
                    </div>
                    <div className="w-32 shrink-0 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/owner/invoices/${inv.id}`} className="text-xs text-fg-muted hover:text-fg border border-line hover:border-line-strong px-2.5 py-1 rounded-md transition-colors">View</Link>
                      <Link to={`/owner/invoices/${inv.id}/edit`} className="text-xs text-fg-muted hover:text-fg border border-line hover:border-line-strong px-2.5 py-1 rounded-md transition-colors">Edit</Link>
                      {confirmDelete === inv.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(inv.id)} className="text-xs text-fg bg-danger hover:bg-danger/85 px-2 py-1 rounded transition-colors">Yes</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-fg-muted hover:text-fg px-1 py-1 transition-colors">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(inv.id)} className="text-fg-subtle hover:text-danger transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
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
