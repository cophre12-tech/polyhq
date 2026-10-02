import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    // ── Verify secrets ────────────────────────────────────────────────────────
    const resendKey   = Deno.env.get('RESEND_API_KEY')
    const fromEmail   = Deno.env.get('RESEND_FROM_EMAIL') ?? 'invoices@polyhqapp.com'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')

    console.log('[send-invoice] RESEND_API_KEY present:', !!resendKey, '| from:', fromEmail)

    if (!resendKey) return json({ error: 'RESEND_API_KEY not set in edge function secrets' }, 500)

    // ── Authenticate caller (owner must be logged in) ─────────────────────────
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)

    const anonClient = createClient(supabaseUrl!, supabaseAnon!)
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
    console.log('[send-invoice] auth — user present:', !!user, '| error:', authErr?.message ?? null)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // ── Parse request body ────────────────────────────────────────────────────
    const { to, from_name, invoice_number, subject, html, pdf_base64 } = await req.json()

    if (!to || !pdf_base64) return json({ error: 'to and pdf_base64 are required' }, 400)

    const fromField = from_name ? `${from_name} <${fromEmail}>` : fromEmail
    const emailSubject = subject || `Invoice ${invoice_number || ''} — Payment Due`

    console.log('[send-invoice] sending to:', to, '| subject:', emailSubject)

    // ── Send via Resend ───────────────────────────────────────────────────────
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromField,
        to: [to],
        subject: emailSubject,
        html,
        attachments: [{
          filename: `Invoice-${invoice_number || 'document'}.pdf`,
          content: pdf_base64,
        }],
      }),
    })

    const resBody = await res.json()
    console.log('[send-invoice] Resend response:', res.status, JSON.stringify(resBody).slice(0, 200))

    if (!res.ok) {
      const msg = resBody?.message || resBody?.name || 'Resend API error'
      return json({ error: msg }, 500)
    }

    return json({ ok: true, id: resBody.id })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[send-invoice] unhandled error:', msg)
    return json({ error: msg }, 500)
  }
})
