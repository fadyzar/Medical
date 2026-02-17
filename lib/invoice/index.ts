import type { SupabaseClient } from '@supabase/supabase-js'

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
    return { success: false, error }
  }
}
