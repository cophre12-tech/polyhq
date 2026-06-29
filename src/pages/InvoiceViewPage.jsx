import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getInvoiceById, updateInvoice, deleteInvoice } from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'

const STATUS_META = {
  draft:   { label: 'Draft',   color: 'bg-slate-600/40 text-slate-300', next: 'sent'  },
  sent:    { label: 'Sent',    color: 'bg-blue-500/15 text-blue-400',    next: 'viewed' },
  viewed:  { label: 'Viewed',  color: 'bg-purple-500/15 text-purple-400', next: 'paid' },
  paid:    { label: 'Paid',    color: 'bg-emerald-500/15 text-emerald-400', next: null },
  overdue: { label: 'Overdue', color: 'bg-rose-500/15 text-rose-400',    next: 'paid' },
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function InvoiceViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function load() {
    const inv = await getInvoiceById(id)
    if (!inv) { navigate('/owner/invoices'); return }
    setInvoice(inv)
  }
  useEffect(() => { load() }, [id])

  if (!invoice) return null

  const meta    = STATUS_META[invoice.status] || STATUS_META.draft
  const subtotal = (invoice.line_items || []).reduce((s, it) => s + it.quantity * it.unit_price, 0)

  async function advance() {
    if (!meta.next) return
    const updates = { status: meta.next }
    if (meta.next === 'sent')  updates.sent_at = new Date().toISOString()
    if (meta.next === 'paid')  updates.paid_at = new Date().toISOString()
    await updateInvoice(id, updates)
    load()
  }

  async function sendEmail() {
    const subject = encodeURIComponent(`Invoice ${invoice.number} from PolyHQ`)
    const lineList = (invoice.line_items || [])
      .map(it => `  • ${it.description}: ${it.quantity} × $${Number(it.unit_price).toFixed(2)} = $${(it.quantity * it.unit_price).toFixed(2)}`)
      .join('\n')
    const body = encodeURIComponent(
`Dear ${invoice.client_name},

Please find your invoice details below.

Invoice: ${invoice.number}
Date: ${fmtDate(invoice.service_date)}
Due: ${fmtDate(invoice.due_date)}

${lineList}

Total: ${formatCurrency(invoice.total || subtotal)}

${invoice.notes ? `\nNotes: ${invoice.notes}\n` : ''}
To pay or if you have questions, please reply to this email.

Thank you for your business!
PolyHQ`
    )
    window.location.href = `mailto:${invoice.client_email || ''}?subject=${subject}&body=${body}`
    if (invoice.status === 'draft') {
      await updateInvoice(id, { status: 'sent', sent_at: new Date().toISOString() })
      load()
    }
  }

  function printPDF() {
    const lineRows = (invoice.line_items || []).map(it => {
      const tot = it.quantity * it.unit_price
      return `
        <tr>
          <td>${escHtml(it.description)}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">$${Number(it.unit_price).toFixed(2)}</td>
          <td class="num">$${tot.toFixed(2)}</td>
        </tr>`
    }).join('')

    const statusColors = {
      draft: '#64748b', sent: '#3b82f6', viewed: '#8b5cf6',
      paid: '#10b981', overdue: '#ef4444',
    }

    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${escHtml(invoice.number)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#1e293b; background:#fff; padding:60px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:52px; }
  .logo { font-size:30px; font-weight:800; letter-spacing:-1px; color:#1e293b; }
  .logo span { color:#6366f1; }
  .logo-sub { font-size:11px; color:#94a3b8; margin-top:2px; letter-spacing:.05em; }
  .inv-block { text-align:right; }
  .inv-block h1 { font-size:40px; font-weight:200; letter-spacing:-2px; color:#cbd5e1; }
  .inv-block .number { font-size:20px; font-weight:700; color:#1e293b; margin-bottom:8px; }
  .status-pill { display:inline-block; padding:3px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; background:${statusColors[invoice.status] || '#64748b'}22; color:${statusColors[invoice.status] || '#64748b'}; }
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-bottom:48px; padding-bottom:32px; border-bottom:1px solid #e2e8f0; }
  .block label { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:#94a3b8; display:block; margin-bottom:6px; }
  .block .main { font-size:17px; font-weight:600; color:#1e293b; }
  .block .sub { font-size:13px; color:#64748b; margin-top:2px; }
  .detail-table { margin-left:auto; text-align:right; }
  .detail-table td { padding:3px 0; font-size:13px; }
  .detail-table td:first-child { color:#94a3b8; padding-right:24px; }
  .detail-table td:last-child { color:#1e293b; font-weight:500; }
  table.items { width:100%; border-collapse:collapse; margin-bottom:32px; }
  table.items thead tr { background:#f8fafc; }
  table.items th { padding:11px 16px; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0; }
  table.items th:first-child, table.items td:first-child { text-align:left; }
  table.items th.num, table.items td.num { text-align:right; }
  table.items td { padding:14px 16px; border-bottom:1px solid #f1f5f9; font-size:14px; color:#334155; }
  table.items tbody tr:last-child td { border-bottom:none; }
  .totals { margin-left:auto; width:280px; margin-bottom:48px; }
  .t-grand { display:flex; justify-content:space-between; padding:14px 0; font-size:20px; font-weight:800; border-top:2px solid #1e293b; margin-top:4px; }
  .notes { padding:24px; background:#f8fafc; border-radius:8px; margin-bottom:48px; }
  .notes label { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:#94a3b8; display:block; margin-bottom:6px; }
  .notes p { font-size:14px; color:#475569; line-height:1.6; }
  .footer { display:flex; justify-content:space-between; align-items:center; padding-top:24px; border-top:1px solid #e2e8f0; }
  .footer p { font-size:12px; color:#94a3b8; }
  @media print { @page { margin:0.5in; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Poly<span>HQ</span></div>
    <div class="logo-sub">Payroll &amp; Crew Management</div>
  </div>
  <div class="inv-block">
    <h1>INVOICE</h1>
    <div class="number">${escHtml(invoice.number)}</div>
    <span class="status-pill">${escHtml(meta.label)}</span>
  </div>
</div>
<div class="meta">
  <div class="block">
    <label>Bill To</label>
    <div class="main">${escHtml(invoice.client_name)}</div>
    ${invoice.client_email   ? `<div class="sub">${escHtml(invoice.client_email)}</div>` : ''}
    ${invoice.client_address ? `<div class="sub">${escHtml(invoice.client_address)}</div>` : ''}
  </div>
  <div>
    <table class="detail-table">
      <tr><td>Invoice #</td><td>${escHtml(invoice.number)}</td></tr>
      <tr><td>Service Date</td><td>${escHtml(fmtDate(invoice.service_date))}</td></tr>
      <tr><td>Due Date</td><td>${escHtml(fmtDate(invoice.due_date))}</td></tr>
      ${invoice.paid_at ? `<tr><td>Paid On</td><td>${escHtml(new Date(invoice.paid_at).toLocaleDateString())}</td></tr>` : ''}
    </table>
  </div>
</div>
<table class="items">
  <thead>
    <tr>
      <th>Description</th>
      <th class="num">Qty</th>
      <th class="num">Unit Price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>${lineRows}</tbody>
</table>
<div class="totals">
  <div class="t-grand">
    <span>Total Due</span>
    <span>${formatCurrency(invoice.total || subtotal).replace('$', '\\$')}</span>
  </div>
</div>
${invoice.notes ? `<div class="notes"><label>Notes</label><p>${escHtml(invoice.notes)}</p></div>` : ''}
<div class="footer">
  <p>Generated by PolyHQ · polyhq.app</p>
  <p>Thank you for your business!</p>
</div>
</body>
</html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  async function handleDelete() {
    await deleteInvoice(id)
    navigate('/owner/invoices')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/owner/invoices" className="text-slate-400 hover:text-white transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white font-mono">{invoice.number}</h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5 truncate">{invoice.client_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/owner/invoices/${id}/edit`} className="px-3 sm:px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors">
            Edit
          </Link>
          <button onClick={printPDF} className="px-3 sm:px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          {invoice.client_email && (
            <button onClick={sendEmail} className="px-3 sm:px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline">Send Email</span>
              <span className="sm:hidden">Email</span>
            </button>
          )}
        </div>
      </div>

      {/* Status actions */}
      {meta.next && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 sm:px-5 py-4">
          <div>
            <p className="text-sm font-medium text-white">
              {invoice.status === 'draft'   && 'Ready to send this invoice?'}
              {invoice.status === 'sent'    && 'Has the client viewed the invoice?'}
              {invoice.status === 'viewed'  && 'Mark this invoice as paid?'}
              {invoice.status === 'overdue' && 'Mark this overdue invoice as paid?'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {invoice.status === 'draft'   && 'Move to Sent after emailing the client.'}
              {invoice.status === 'sent'    && 'Update status once the client has seen it.'}
              {invoice.status === 'viewed'  && 'Record payment when you receive it.'}
              {invoice.status === 'overdue' && 'Record payment even if it came in late.'}
            </p>
          </div>
          <button onClick={advance} className="px-4 py-2.5 sm:py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors capitalize shrink-0">
            Mark as {STATUS_META[meta.next]?.label}
          </button>
        </div>
      )}

      {/* Overdue reminder box */}
      {invoice.status === 'overdue' && invoice.client_email && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 sm:px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-rose-300">This invoice is overdue</p>
            <p className="text-xs text-slate-400 mt-0.5">Due {fmtDate(invoice.due_date)} — send a reminder to {invoice.client_email}</p>
          </div>
          <button onClick={sendEmail} className="px-4 py-2.5 sm:py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Send Reminder
          </button>
        </div>
      )}

      {/* Invoice preview — scrollable on mobile */}
      <div className="overflow-x-auto mb-6 -mx-4 sm:mx-0">
        <div className="min-w-[600px] sm:min-w-0 mx-4 sm:mx-0 bg-white rounded-xl overflow-hidden shadow-2xl">
          {/* Invoice header */}
          <div className="flex items-start justify-between px-8 sm:px-10 pt-8 sm:pt-10 pb-6 sm:pb-8 border-b border-slate-100">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Poly<span className="text-indigo-500">HQ</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 tracking-wide">Payroll & Crew Management</div>
            </div>
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-light tracking-tighter text-slate-200">INVOICE</div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">{invoice.number}</div>
              <span className={`inline-block mt-2 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
            </div>
          </div>

          {/* Bill to + dates */}
          <div className="grid grid-cols-2 gap-6 sm:gap-10 px-8 sm:px-10 py-6 sm:py-8 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Bill To</p>
              <p className="text-base sm:text-lg font-semibold text-slate-900">{invoice.client_name}</p>
              {invoice.client_email   && <p className="text-sm text-slate-500 mt-0.5">{invoice.client_email}</p>}
              {invoice.client_address && <p className="text-sm text-slate-500 mt-0.5">{invoice.client_address}</p>}
            </div>
            <div className="text-right space-y-2">
              <InvDetail label="Invoice #"    value={invoice.number} />
              <InvDetail label="Service Date" value={fmtDate(invoice.service_date)} />
              <InvDetail label="Payment Due"  value={fmtDate(invoice.due_date)} />
              {invoice.paid_at && <InvDetail label="Paid On" value={new Date(invoice.paid_at).toLocaleDateString()} />}
            </div>
          </div>

          {/* Line items */}
          <div className="px-8 sm:px-10 py-6 sm:py-8">
            <table className="w-full mb-0">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="text-left py-3 px-3 sm:px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit Price</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoice.line_items || []).map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm text-slate-700">{item.description}</td>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm text-slate-600 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm text-slate-600 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm font-medium text-slate-900 text-right tabular-nums">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="px-8 sm:px-10 pb-6 sm:pb-8 flex justify-end">
            <div className="w-56 sm:w-64">
              <div className="flex justify-between items-center pt-4 border-t-2 border-slate-900">
                <span className="text-base sm:text-lg font-bold text-slate-900">Total Due</span>
                <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">{formatCurrency(invoice.total || subtotal)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-8 sm:px-10 pb-6 sm:pb-8">
              <div className="bg-slate-50 rounded-xl p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Notes</p>
                <p className="text-sm text-slate-600 leading-relaxed">{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center px-8 sm:px-10 py-4 sm:py-5 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">Generated by PolyHQ</p>
            <p className="text-xs text-slate-400">Thank you for your business!</p>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className="text-sm text-slate-400">Delete this invoice permanently?</span>
            <button onClick={handleDelete} className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-slate-500 hover:text-rose-400 transition-colors">
            Delete invoice
          </button>
        )}
      </div>
    </div>
  )
}

function InvDetail({ label, value }) {
  return (
    <div className="flex justify-end gap-4 sm:gap-6">
      <span className="text-xs sm:text-sm text-slate-400">{label}</span>
      <span className="text-xs sm:text-sm font-semibold text-slate-800 w-28 sm:w-36 text-right">{value}</span>
    </div>
  )
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
