-- Migration 016: Domain provisioning columns for organizations
-- Adds domain_status, domain_error, domain_last_checked_at to track subdomain provisioning state

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS domain_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS domain_error text,
  ADD COLUMN IF NOT EXISTS domain_last_checked_at timestamptz;

-- Index for status queries (e.g. finding all pending/failed domains)
CREATE INDEX IF NOT EXISTS idx_organizations_domain_status ON organizations(domain_status);
