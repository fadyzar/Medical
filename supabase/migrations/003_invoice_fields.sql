-- Migration 003: Add invoice fields to appointments
-- Stores Green Invoice document ID and public PDF URL after payment

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_url text;

COMMENT ON COLUMN appointments.invoice_number IS 'Green Invoice document number';
COMMENT ON COLUMN appointments.invoice_url IS 'Public URL to view/download the invoice PDF';
