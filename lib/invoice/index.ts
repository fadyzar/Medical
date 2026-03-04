import type { SupabaseClient } from '@supabase/supabase-js'

// Max retry attempts before giving up
const MAX_RETRIES = 3

// ── Types ────────────────────────────────────────────

type InvoiceParams = {
  appointmentId: string
  amount: number
  patientName: string
  patientEmail: string | null
  patientPhone: string | null
  description: string
  organizationName: string
  admin: SupabaseClient
}

type InvoiceResult = {
  success: boolean
  invoiceNumber?: string
  invoiceUrl?: string
  error?: string
}

// ── Auth: Get JWT from Green Invoice ─────────────────

let _greenInvoiceToken: string | null = null
let _tokenExpiresAt = 0

async function getGreenInvoiceToken(): Promise<string> {
  const now = Date.now()
  if (_greenInvoiceToken && now < _tokenExpiresAt - 60_000) {
    return _greenInvoiceToken
  }

  const apiKey = process.env.GREEN_INVOICE_API_KEY
  const apiSecret = process.env.GREEN_INVOICE_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error('GREEN_INVOICE_API_KEY or GREEN_INVOICE_API_SECRET not configured')
  }

  const res = await fetch('https://api.greeninvoice.co.il/api/v1/account/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: apiKey, secret: apiSecret }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Green Invoice auth failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  _greenInvoiceToken = data.token
  // Tokens expire after 24h; cache for 23h to avoid edge-of-expiry races
  _tokenExpiresAt = now + 23 * 60 * 60 * 1000

  return _greenInvoiceToken!
}

// ── Core: Create Receipt Document ────────────────────

export async function generateInvoice(params: InvoiceParams): Promise<InvoiceResult> {
  const {
    appointmentId, amount, patientName, patientEmail,
    patientPhone, description, organizationName, admin,
  } = params

  try {
    const token = await getGreenInvoiceToken()

    // Document type 320 = קבלה (receipt)
    // Use 305 for חשבונית מס קבלה (tax invoice receipt) if org is VAT-registered
    const body = {
      type: 320,
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      rounding: false,
      signed: true,
      description: `קבלה עבור ${organizationName}`,
      client: {
        name: patientName,
        ...(patientEmail ? { emails: [patientEmail] } : {}),
        ...(patientPhone ? { phone: patientPhone } : {}),
      },
      income: [
        {
          description: description.slice(0, 100),
          quantity: 1,
          price: amount,
          currency: 'ILS',
          vatType: 0,
        },
      ],
      payment: [
        {
          type: 4, // 4 = credit card
          price: amount,
          currency: 'ILS',
          date: new Date().toISOString().slice(0, 10),
        },
      ],
    }

    const res = await fetch('https://api.greeninvoice.co.il/api/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Green Invoice API error: ${res.status} ${text}`)
    }

    const data = await res.json()
    const invoiceNumber = data.number as string
    const invoiceUrl = data.url as string

    // Persist to DB
    await admin.from('appointments').update({
      invoice_number: invoiceNumber,
      invoice_url: invoiceUrl,
    }).eq('id', appointmentId)

    return { success: true, invoiceNumber, invoiceUrl }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Invoice generation failed'
    // Do NOT log PHI — only the technical error
    console.error('[Invoice]', error)

    // Queue for retry: store pending invoice in audit_logs so it can be retried later
    try {
      await admin.from('audit_logs').insert({
        user_id: null,
        action: 'INVOICE_QUEUED_FOR_RETRY',
        resource_type: 'appointment',
        resource_id: appointmentId,
        metadata: {
          amount,
          patient_name: patientName,
          patient_email: patientEmail,
          patient_phone: patientPhone,
          description,
          organization_name: organizationName,
          error,
          queued_at: new Date().toISOString(),
          retry_count: 0,
        },
      })
    } catch {
      // If even logging fails, nothing more we can do
    }

    return { success: false, error }
  }
}

// ── Retry queued invoices ────────────────────────────

export async function retryQueuedInvoices(admin: SupabaseClient): Promise<{ processed: number; succeeded: number; failed: number }> {
  const { data: queued } = await admin.from('audit_logs')
    .select('id, resource_id, metadata')
    .eq('action', 'INVOICE_QUEUED_FOR_RETRY')
    .order('created_at', { ascending: true })
    .limit(10)

  if (!queued || queued.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const entry of queued) {
    const meta = entry.metadata as Record<string, unknown>
    const retryCount = (meta.retry_count as number) || 0

    if (retryCount >= MAX_RETRIES) {
      // Mark as permanently failed
      await admin.from('audit_logs').update({
        action: 'INVOICE_RETRY_EXHAUSTED',
        metadata: { ...meta, exhausted_at: new Date().toISOString() },
      }).eq('id', entry.id)
      failed++
      continue
    }

    const result = await generateInvoice({
      appointmentId: entry.resource_id as string,
      amount: meta.amount as number,
      patientName: meta.patient_name as string,
      patientEmail: (meta.patient_email as string) || null,
      patientPhone: (meta.patient_phone as string) || null,
      description: meta.description as string,
      organizationName: meta.organization_name as string,
      admin,
    })

    if (result.success) {
      // Remove from queue
      await admin.from('audit_logs').update({
        action: 'INVOICE_RETRY_SUCCEEDED',
        metadata: { ...meta, succeeded_at: new Date().toISOString(), invoice_url: result.invoiceUrl },
      }).eq('id', entry.id)
      succeeded++
    } else {
      // Increment retry count
      await admin.from('audit_logs').update({
        metadata: { ...meta, retry_count: retryCount + 1, last_retry_at: new Date().toISOString(), last_error: result.error },
      }).eq('id', entry.id)
      failed++
    }
  }

  return { processed: queued.length, succeeded, failed }
}
