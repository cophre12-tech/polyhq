import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createInvoice, updateInvoice, getInvoiceById } from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'

const TODAY = new Date().toISOString().split('T')[0]

function due30() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

function newItem(id) {
  return { id: id ?? `item_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, description: '', quantity: 1, unit_price: '' }
}

export default function InvoiceEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_address: '',
    service_date: TODAY,
    due_date: due30(),
    notes: '',
  })
  const [items, setItems] = useState([newItem()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    getInvoiceById(id).then(inv => {
      if (!inv) { navigate('/owner/invoices'); return }
      setForm({
        client_name:    inv.client_name    ?? '',
        client_email:   inv.client_email   ?? '',
        client_address: inv.client_address ?? '',
        service_date:   inv.service_date   ?? TODAY,
        due_date:       inv.due_date       ?? due30(),
        notes:          inv.notes          ?? '',
      })
      setItems(inv.line_items?.length ? inv.line_items : [newItem()])
    })
  }, [id, isEdit, navigate])

  function setField(f, v) { setForm(p => ({ ...p, [f]: v })) }
  function setItem(itemId, field, val) {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, [field]: val } : it))
  }
  function addItem() { setItems(prev => [...prev, newItem()]) }
  function removeItem(itemId) {
    setItems(prev => prev.length > 1 ? prev.filter(it => it.id !== itemId) : prev)
  }

  const subtotal = items.reduce((s, it) => {
    return s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)
  }, 0)

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (items.every(it => !it.description.trim())) {
      setError('Add at least one line item with a description.')
      return
    }
    setSaving(true)
    const payload = {
      ...form,
      line_items: items.map(it => ({
        ...it,
        quantity:   parseFloat(it.quantity)   || 0,
        unit_price: parseFloat(it.unit_price) || 0,
      })),
      total: subtotal,
    }
    try {
      if (isEdit) {
        await updateInvoice(id, payload)
        navigate(`/owner/invoices/${id}`)
      } else {
        const inv = await createInvoice(payload)
        navigate(`/owner/invoices/${inv.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/owner/invoices')} className="text-fg-muted hover:text-fg transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
          <p className="text-fg-muted mt-0.5 text-sm">{isEdit ? 'Update invoice details' : 'Fill in the details below'}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Client details */}
        <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
          <h3 className="font-semibold text-fg mb-5">Client Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client Name *">
              <input type="text" required value={form.client_name} onChange={e => setField('client_name', e.target.value)} placeholder="Smith Residence" className="input" />
            </Field>
            <Field label="Client Email">
              <input type="email" value={form.client_email} onChange={e => setField('client_email', e.target.value)} placeholder="client@example.com" className="input" />
            </Field>
            <Field label="Address (optional)" className="sm:col-span-2">
              <input type="text" value={form.client_address} onChange={e => setField('client_address', e.target.value)} placeholder="123 Main St, Springfield, IL 62701" className="input" />
            </Field>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
          <h3 className="font-semibold text-fg mb-5">Invoice Dates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Service Date *">
              <input type="date" required value={form.service_date} onChange={e => setField('service_date', e.target.value)} className="input" />
            </Field>
            <Field label="Payment Due Date *">
              <input type="date" required value={form.due_date} onChange={e => setField('due_date', e.target.value)} className="input" />
            </Field>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-line flex justify-between items-center">
            <h3 className="font-semibold text-fg">Line Items</h3>
            <button type="button" onClick={addItem} className="text-sm text-fg underline-offset-4 hover:underline transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add item
            </button>
          </div>

          {/* Desktop line items */}
          <div className="hidden sm:block px-6 pt-4 pb-2">
            <div className="grid grid-cols-[1fr_80px_110px_100px_36px] gap-3 mb-2 font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider px-1">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
                return (
                  <div key={item.id} className="grid grid-cols-[1fr_80px_110px_100px_36px] gap-3 items-center">
                    <input type="text" placeholder={`Service ${idx + 1}`} value={item.description}
                      onChange={e => setItem(item.id, 'description', e.target.value)} className="input text-sm" />
                    <input type="number" min="0" step="0.5" value={item.quantity}
                      onChange={e => setItem(item.id, 'quantity', e.target.value)} className="input text-sm text-right tabular-nums" />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle text-sm">$</span>
                      <input type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={e => setItem(item.id, 'unit_price', e.target.value)}
                        placeholder="0.00" className="input text-sm text-right tabular-nums pl-6" />
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-fg tabular-nums">{formatCurrency(lineTotal)}</span>
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1}
                      className="text-fg-subtle hover:text-danger transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile line items — stacked card per item */}
          <div className="sm:hidden px-4 pt-4 pb-2 space-y-3">
            {items.map((item, idx) => {
              const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
              return (
                <div key={item.id} className="bg-raised/50 border border-line rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xs font-medium text-fg-muted uppercase tracking-wider">Item {idx + 1}</span>
                    <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1}
                      className="text-fg-subtle hover:text-danger transition-colors disabled:opacity-20">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <input type="text" placeholder={`Service ${idx + 1}`} value={item.description}
                    onChange={e => setItem(item.id, 'description', e.target.value)} className="input text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-fg-subtle mb-1">Qty</label>
                      <input type="number" min="0" step="0.5" value={item.quantity}
                        onChange={e => setItem(item.id, 'quantity', e.target.value)} className="input text-sm text-right tabular-nums" />
                    </div>
                    <div>
                      <label className="block text-xs text-fg-subtle mb-1">Unit Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle text-sm">$</span>
                        <input type="number" min="0" step="0.01" value={item.unit_price}
                          onChange={e => setItem(item.id, 'unit_price', e.target.value)}
                          placeholder="0.00" className="input text-sm text-right tabular-nums pl-6" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-line">
                    <span className="text-xs text-fg-subtle">Line total</span>
                    <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(lineTotal)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div className="flex justify-end items-center gap-6 px-5 sm:px-6 py-4 border-t border-line mt-2">
            <span className="text-sm font-semibold text-fg-muted">Total</span>
            <span className="text-2xl font-semibold text-fg tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-surface rounded-xl border border-line p-5 sm:p-6">
          <Field label="Notes (optional)">
            <textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              rows={3}
              placeholder="Payment terms, thank-you message, special instructions…"
              className="input resize-none"
            />
          </Field>
        </div>

        {error && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => navigate('/owner/invoices')} className="text-fg-muted hover:text-fg text-sm transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-6 py-3 sm:py-2.5 text-sm"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-fg-muted mb-1.5">{label}</label>
      {children}
    </div>
  )
}
