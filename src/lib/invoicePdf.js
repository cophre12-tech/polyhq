import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from './payroll.js'

const PW = 612   // letter width in pt
const PH = 792   // letter height in pt
const M  = 48    // page margin

const C = {
  black:  [15,  23,  42],
  mid:    [71,  85, 105],
  muted:  [148, 163, 184],
  light:  [226, 232, 240],
  bg:     [248, 250, 252],
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, mo, day] = d.split('-')
  return new Date(+y, +mo - 1, +day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function loadImgDims(dataUrl, maxH = 52) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const h = Math.min(maxH, img.naturalHeight)
      resolve({ w: h * (img.naturalWidth / img.naturalHeight), h })
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/**
 * Generates an invoice PDF and returns the raw base64 string (no data-URI prefix).
 * @param {object} invoice  - invoice row from Supabase
 * @param {object} biz      - business settings ({ name, logo, address, phone })
 */
export async function generateInvoicePdf(invoice, biz = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const CW = PW - M * 2   // 516 pt content width

  let y = M

  // ── Header: logo / business name (left) + INVOICE (right) ─────────────────
  let headerH = 52
  if (biz.logo) {
    const dims = await loadImgDims(biz.logo, 52)
    if (dims) {
      const fmt = biz.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      try {
        doc.addImage(biz.logo, fmt, M, y, dims.w, dims.h)
        headerH = dims.h
        if (biz.name) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(...C.muted)
          doc.text(biz.name, M, y + dims.h + 11)
          headerH += 17
        }
      } catch {
        // fall through to text fallback below
        headerH = 0
      }
    }
  }

  if (headerH === 52 && !biz.logo) {
    // No logo — show business name as bold text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...C.black)
    doc.text(biz.name || 'PolyHQ', M, y + 22)
    headerH = 30
  }

  // "INVOICE" word (right, large, light gray)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...C.light)
  doc.text('INVOICE', PW - M, y + 24, { align: 'right' })

  // Invoice number under "INVOICE"
  doc.setFontSize(13)
  doc.setTextColor(...C.black)
  doc.text(invoice.number || '', PW - M, y + 42, { align: 'right' })

  y += Math.max(headerH, 52) + 18

  // ── Divider ────────────────────────────────────────────────────────────────
  doc.setDrawColor(...C.light)
  doc.setLineWidth(0.75)
  doc.line(M, y, PW - M, y)
  y += 22

  // ── Bill To (left) + Invoice detail pairs (right) ──────────────────────────
  const sectionTopY = y

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text('BILL TO', M, y)
  y += 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.black)
  doc.text(invoice.client_name || '', M, y)
  y += 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.mid)
  if (invoice.client_email) {
    doc.text(invoice.client_email, M, y)
    y += 13
  }
  if (invoice.client_address) {
    const wrapped = doc.splitTextToSize(invoice.client_address, CW * 0.47)
    doc.text(wrapped, M, y)
    y += wrapped.length * 13
  }

  // Invoice details column (right-aligned)
  const details = [
    ['Invoice #',     invoice.number || '—'],
    ['Invoice Date',  fmtDate(invoice.service_date)],
    ['Due Date',      fmtDate(invoice.due_date)],
  ]
  if (invoice.paid_at) {
    details.push(['Paid On', new Date(invoice.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })])
  }

  let dy = sectionTopY + 14    // align with "BILL TO" label
  const detLabelX = PW - M - 185
  const detValX   = PW - M
  for (const [label, val] of details) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...C.muted)
    doc.text(label, detLabelX, dy)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.black)
    doc.text(val, detValX, dy, { align: 'right' })
    dy += 16
  }

  y = Math.max(y, dy) + 22

  // ── Divider ────────────────────────────────────────────────────────────────
  doc.setDrawColor(...C.light)
  doc.line(M, y, PW - M, y)
  y += 4

  // ── Line items table ───────────────────────────────────────────────────────
  const subtotal = (invoice.line_items || []).reduce(
    (s, it) => s + it.quantity * it.unit_price, 0,
  )

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: (invoice.line_items || []).map(it => [
      it.description,
      String(it.quantity),
      formatCurrency(it.unit_price),
      formatCurrency(it.quantity * it.unit_price),
    ]),
    headStyles: {
      fillColor: C.bg,
      textColor: C.mid,
      fontSize: 8.5,
      fontStyle: 'bold',
      lineColor: C.light,
      lineWidth: { bottom: 1.25 },
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', cellWidth: 44 },
      2: { halign: 'right', cellWidth: 82 },
      3: { halign: 'right', cellWidth: 86, fontStyle: 'bold' },
    },
    styles: {
      fontSize: 11,
      cellPadding: { top: 10, bottom: 10, left: 12, right: 12 },
      textColor: C.black,
      lineColor: C.light,
      lineWidth: 0.5,
      overflow: 'linebreak',
    },
  })

  y = doc.lastAutoTable.finalY + 20

  // ── Total ──────────────────────────────────────────────────────────────────
  const totalW = 215
  const totalX = PW - M - totalW
  doc.setDrawColor(...C.black)
  doc.setLineWidth(1.5)
  doc.line(totalX, y, PW - M, y)
  y += 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...C.black)
  doc.text('Total Due', totalX, y)
  doc.setFontSize(15)
  doc.text(formatCurrency(invoice.total || subtotal), PW - M, y, { align: 'right' })
  y += 32

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (invoice.notes) {
    const lines = doc.splitTextToSize(invoice.notes, CW - 36)
    const noteH = lines.length * 14 + 32
    doc.setFillColor(...C.bg)
    doc.roundedRect(M, y, CW, noteH, 6, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.muted)
    doc.text('NOTES', M + 16, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...C.mid)
    doc.text(lines, M + 16, y + 30)
    y += noteH + 22
  }

  // ── Venmo payment box ──────────────────────────────────────────────────────
  // Venmo blue: #3D95CE. Only included when the business has a Venmo username.
  if (biz.venmo_username) {
    const venmoBlue  = [61, 149, 206]
    const venmoLight = [232, 244, 252]
    const total      = formatCurrency(invoice.total || subtotal)
    const note       = encodeURIComponent(`Invoice ${invoice.number || ''}`)
    const amount     = (invoice.total || subtotal).toFixed(2)
    const venmoUrl   = `https://venmo.com/u/${biz.venmo_username}?txn=pay&amount=${amount}&note=${note}`

    const boxH = 68
    doc.setFillColor(...venmoLight)
    doc.roundedRect(M, y, CW, boxH, 6, 6, 'F')
    doc.setDrawColor(...venmoBlue)
    doc.setLineWidth(1)
    doc.roundedRect(M, y, CW, boxH, 6, 6, 'S')

    // Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...venmoBlue)
    doc.text('PAY VIA VENMO', M + 16, y + 18)

    // Username
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text(`@${biz.venmo_username}`, M + 16, y + 36)

    // Amount
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...venmoBlue)
    doc.text(`Send ${total} · note: Invoice ${invoice.number || ''}`, M + 16, y + 52)

    // URL (right side)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...venmoBlue)
    doc.textWithLink(venmoUrl, PW - M - 16, y + 36, { url: venmoUrl, align: 'right' })

    y += boxH + 16
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(...C.light)
  doc.setLineWidth(0.5)
  doc.line(M, PH - 44, PW - M, PH - 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  doc.text('Generated by PolyHQ · polyhqapp.com', M, PH - 30)
  doc.text('Thank you for your business!', PW - M, PH - 30, { align: 'right' })

  // Return raw base64 (strip the "data:application/pdf;base64," prefix)
  const dataUri = doc.output('datauristring')
  return dataUri.split(',')[1]
}
