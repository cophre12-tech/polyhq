import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getInvoiceById, updateInvoice, deleteInvoice, getBusinessSettings } from '../lib/db.js'
import { formatCurrency } from '../lib/payroll.js'
import { supabase } from '../lib/supabase.js'
import { generateInvoicePdf } from '../lib/invoicePdf.js'

const SEND_INVOICE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice`

const STATUS_META = {
  draft:   { label: 'Draft',   color: 'bg-overlay/40 text-fg-muted', next: 'sent'  },
  sent:    { label: 'Sent',    color: 'bg-raised text-fg-muted',    next: 'viewed' },
  viewed:  { label: 'Viewed',  color: 'bg-raised text-fg-muted', next: 'paid' },
  paid:    { label: 'Paid',    color: 'bg-success/15 text-success', next: null },
  overdue: { label: 'Overdue', color: 'bg-danger/15 text-danger',    next: 'paid' },
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
  const [bizSettings, setBizSettings] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [emailState, setEmailState] = useState(null)  // null | 'sending' | 'sent' | 'error'
  const [emailError, setEmailError] = useState('')

  async function load() {
    const inv = await getInvoiceById(id)
    if (!inv) { navigate('/owner/invoices'); return }
    setInvoice(inv)
  }
  useEffect(() => { load() }, [id])
  useEffect(() => { getBusinessSettings().then(s => s && setBizSettings(s)) }, [])

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
    if (emailState === 'sending') return
    setEmailState('sending')
    setEmailError('')

    try {
      // Generate PDF client-side with business branding
      const pdfBase64 = await generateInvoicePdf(invoice, bizSettings)

      // Build HTML email body (summary — the PDF is the professional deliverable)
      const lineRows = (invoice.line_items || []).map(it => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155">${escHtml(it.description)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:right">${it.quantity}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:right">$${Number(it.unit_price).toFixed(2)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#1e293b;text-align:right">$${(it.quantity * it.unit_price).toFixed(2)}</td>
        </tr>`).join('')

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:620px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
    <div style="background:#1e293b;padding:32px 40px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">
        ${escHtml(bizSettings.name || 'PolyHQ')}
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Invoice</div>
        <div style="font-size:18px;font-weight:700;color:#ffffff">${escHtml(invoice.number)}</div>
      </div>
    </div>

    <div style="padding:32px 40px">
      <p style="margin:0 0 24px;font-size:15px;color:#475569">Dear ${escHtml(invoice.client_name)},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569">
        Please find your invoice attached to this email. The PDF contains the full invoice details.
      </p>

      <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;color:#94a3b8">Invoice Date</span>
          <span style="font-size:13px;font-weight:600;color:#1e293b">${fmtDate(invoice.service_date)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:13px;color:#94a3b8">Payment Due</span>
          <span style="font-size:13px;font-weight:600;color:#1e293b">${fmtDate(invoice.due_date)}</span>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Description</th>
            <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Qty</th>
            <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Price</th>
            <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Total</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div style="text-align:right;border-top:2px solid #1e293b;padding-top:16px;margin-bottom:32px">
        <span style="font-size:14px;color:#64748b">Total Due&nbsp;&nbsp;</span>
        <span style="font-size:22px;font-weight:800;color:#1e293b">${formatCurrency(invoice.total || subtotal)}</span>
      </div>

      ${invoice.notes ? `<div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:8px">Notes</div>
        <p style="margin:0;font-size:14px;color:#475569;line-height:1.6">${escHtml(invoice.notes)}</p>
      </div>` : ''}

      ${bizSettings.venmo_username ? (() => {
        const amount = (invoice.total || subtotal).toFixed(2)
        const note = encodeURIComponent(`Invoice ${invoice.number || ''}`)
        const venmoUrl = `https://venmo.com/u/${bizSettings.venmo_username}?txn=pay&amount=${amount}&note=${note}`
        return `<a href="${venmoUrl}" target="_blank" rel="noopener" style="display:block;text-decoration:none;background:#e8f4fc;border:1.5px solid #3D95CE;border-radius:10px;padding:20px 24px;margin-bottom:24px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#3D95CE;margin-bottom:8px">Pay via Venmo</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;margin-bottom:4px">@${bizSettings.venmo_username}</div>
          <div style="font-size:13px;color:#3D95CE">Amount: ${formatCurrency(invoice.total || subtotal)} &nbsp;·&nbsp; Note: Invoice ${escHtml(invoice.number || '')}</div>
        </a>`
      })() : ''}

      <p style="margin:0;font-size:14px;color:#94a3b8">
        Questions? Reply to this email and we'll be happy to help.
      </p>
    </div>

    <div style="border-top:1px solid #f1f5f9;padding:20px 40px;display:flex;justify-content:space-between">
      <span style="font-size:12px;color:#cbd5e1">Sent via PolyHQ</span>
      <span style="font-size:12px;color:#cbd5e1">Thank you for your business!</span>
    </div>
  </div>
</body>
</html>`

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(SEND_INVOICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: invoice.client_email,
          from_name: bizSettings.name || '',
          invoice_number: invoice.number,
          subject: `Invoice ${invoice.number} from ${bizSettings.name || 'PolyHQ'}`,
          html,
          pdf_base64: pdfBase64,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to send email')

      // Mark invoice as sent if it was a draft
      if (invoice.status === 'draft') {
        await updateInvoice(id, { status: 'sent', sent_at: new Date().toISOString() })
        load()
      }

      setEmailState('sent')
      setTimeout(() => setEmailState(null), 4000)
    } catch (err) {
      setEmailError(err.message)
      setEmailState('error')
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
          <Link to="/owner/invoices" className="text-fg-muted hover:text-fg transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold text-fg font-mono">{invoice.number}</h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
            </div>
            <p className="text-fg-muted text-sm mt-0.5 truncate">{invoice.client_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/owner/invoices/${id}/edit`} className="px-3 sm:px-4 py-2 text-sm text-fg-muted hover:text-fg border border-line hover:border-line-strong rounded-lg transition-colors">
            Edit
          </Link>
          <button onClick={printPDF} className="px-3 sm:px-4 py-2 text-sm text-fg-muted hover:text-fg border border-line hover:border-line-strong rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          {invoice.client_email && (
            <button
              onClick={sendEmail}
              disabled={emailState === 'sending'}
              className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                emailState === 'sent'
                  ? 'text-success bg-success/10 border border-success/30'
                  : 'btn-primary'
              }`}
            >
              {emailState === 'sending' ? (
                <>
                  <div className="w-4 h-4 border-2 border-fg/30 border-t-fg rounded-full animate-spin" />
                  <span className="hidden sm:inline">Sending…</span>
                </>
              ) : emailState === 'sent' ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <span className="hidden sm:inline">Sent!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span className="hidden sm:inline">Send Email</span>
                  <span className="sm:hidden">Email</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Email error banner */}
      {emailState === 'error' && (
        <div className="mb-5 flex items-start gap-3 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <p className="text-sm font-medium text-danger">Failed to send email</p>
            <p className="text-xs text-fg-muted mt-0.5">{emailError}</p>
          </div>
          <button onClick={() => setEmailState(null)} className="ml-auto text-fg-subtle hover:text-fg-muted transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Status actions */}
      {meta.next && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 sm:px-5 py-4">
          <div>
            <p className="text-sm font-medium text-fg">
              {invoice.status === 'draft'   && 'Ready to send this invoice?'}
              {invoice.status === 'sent'    && 'Has the client viewed the invoice?'}
              {invoice.status === 'viewed'  && 'Mark this invoice as paid?'}
              {invoice.status === 'overdue' && 'Mark this overdue invoice as paid?'}
            </p>
            <p className="text-xs text-fg-muted mt-0.5">
              {invoice.status === 'draft'   && 'Move to Sent after emailing the client.'}
              {invoice.status === 'sent'    && 'Update status once the client has seen it.'}
              {invoice.status === 'viewed'  && 'Record payment when you receive it.'}
              {invoice.status === 'overdue' && 'Record payment even if it came in late.'}
            </p>
          </div>
          <button onClick={advance} className="btn-primary px-4 py-2.5 sm:py-2 text-sm capitalize shrink-0">
            Mark as {STATUS_META[meta.next]?.label}
          </button>
        </div>
      )}

      {/* Overdue reminder box */}
      {invoice.status === 'overdue' && invoice.client_email && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-danger/10 border border-danger/25 rounded-xl px-4 sm:px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-danger">This invoice is overdue</p>
            <p className="text-xs text-fg-muted mt-0.5">Due {fmtDate(invoice.due_date)} — send a reminder to {invoice.client_email}</p>
          </div>
          <button onClick={sendEmail} className="px-4 py-2.5 sm:py-2 text-sm font-semibold text-fg bg-danger hover:bg-danger/85 rounded-lg transition-colors flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Send Reminder
          </button>
        </div>
      )}

      {/* Invoice preview — scrollable on mobile */}
      <div className="overflow-x-auto mb-6 -mx-4 sm:mx-0">
        <div className="min-w-[600px] sm:min-w-0 mx-4 sm:mx-0 bg-paper rounded-xl overflow-hidden">
          {/* Invoice header */}
          <div className="flex items-start justify-between px-8 sm:px-10 pt-8 sm:pt-10 pb-6 sm:pb-8 border-b border-paper-line">
            <div>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
                Poly<span className="text-accent-fg">HQ</span>
              </div>
              <div className="text-xs text-ink-muted mt-1 tracking-wide">Payroll & Crew Management</div>
            </div>
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-light tracking-tighter text-ink-muted">INVOICE</div>
              <div className="text-lg sm:text-xl font-semibold text-ink mt-1">{invoice.number}</div>
              <span className={`inline-block mt-2 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
            </div>
          </div>

          {/* Bill to + dates */}
          <div className="grid grid-cols-2 gap-6 sm:gap-10 px-8 sm:px-10 py-6 sm:py-8 border-b border-paper-line">
            <div>
              <p className="font-mono text-2xs font-medium uppercase tracking-wider text-ink-muted mb-3">Bill To</p>
              <p className="text-base sm:text-lg font-semibold text-ink">{invoice.client_name}</p>
              {invoice.client_email   && <p className="text-sm text-ink-muted mt-0.5">{invoice.client_email}</p>}
              {invoice.client_address && <p className="text-sm text-ink-muted mt-0.5">{invoice.client_address}</p>}
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
                <tr className="bg-paper-muted border-b-2 border-paper-line">
                  <th className="font-mono text-left py-3 px-3 sm:px-4 text-2xs font-medium text-ink-muted uppercase tracking-wider">Description</th>
                  <th className="font-mono text-right py-3 px-3 sm:px-4 text-2xs font-medium text-ink-muted uppercase tracking-wider">Qty</th>
                  <th className="font-mono text-right py-3 px-3 sm:px-4 text-2xs font-medium text-ink-muted uppercase tracking-wider">Unit Price</th>
                  <th className="font-mono text-right py-3 px-3 sm:px-4 text-2xs font-medium text-ink-muted uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {(invoice.line_items || []).map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm text-ink-muted">{item.description}</td>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm text-ink-muted text-right tabular-nums">{item.quantity}</td>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm text-ink-muted text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 sm:py-3.5 px-3 sm:px-4 text-sm font-medium text-ink text-right tabular-nums">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="px-8 sm:px-10 pb-6 sm:pb-8 flex justify-end">
            <div className="w-56 sm:w-64">
              <div className="flex justify-between items-center pt-4 border-t-2 border-line">
                <span className="text-base sm:text-lg font-semibold text-ink">Total Due</span>
                <span className="text-xl sm:text-2xl font-semibold text-ink tabular-nums">{formatCurrency(invoice.total || subtotal)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-8 sm:px-10 pb-6 sm:pb-8">
              <div className="bg-paper-muted rounded-xl p-4 sm:p-5">
                <p className="font-mono text-2xs font-medium uppercase tracking-wider text-ink-muted mb-2">Notes</p>
                <p className="text-sm text-ink-muted leading-relaxed">{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center px-8 sm:px-10 py-4 sm:py-5 border-t border-paper-line bg-paper-muted">
            <p className="text-xs text-ink-muted">Generated by PolyHQ</p>
            <p className="text-xs text-ink-muted">Thank you for your business!</p>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className="text-sm text-ink-muted">Delete this invoice permanently?</span>
            <button onClick={handleDelete} className="text-sm font-semibold text-fg bg-danger hover:bg-danger/85 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-ink-muted hover:text-fg transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-ink-muted hover:text-danger transition-colors">
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
      <span className="text-xs sm:text-sm text-ink-muted">{label}</span>
      <span className="text-xs sm:text-sm font-semibold text-ink w-28 sm:w-36 text-right">{value}</span>
    </div>
  )
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
