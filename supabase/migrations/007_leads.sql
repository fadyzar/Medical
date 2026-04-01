-- Migration 007: Leads management table
-- Supports full lead pipeline: new → contacted → qualified → converted / lost

CREATE TABLE IF NOT EXISTS leads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Contact info
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  phone                   TEXT,
  email                   TEXT,

  -- Lead context
  source                  TEXT DEFAULT 'other',         -- website | whatsapp | phone | referral | ad | other
  specialty_interest      TEXT,
  message                 TEXT,

  -- Pipeline
  status                  TEXT NOT NULL DEFAULT 'new',  -- new | contacted | qualified | converted | lost
  priority                TEXT DEFAULT 'normal',        -- low | normal | high | urgent
  assigned_to             UUID REFERENCES users(id) ON DELETE SET NULL,
  next_follow_up          TIMESTAMPTZ,
  notes                   TEXT,

  -- AI enrichment
  ai_score                INTEGER,                      -- 1-10 lead quality
  ai_analysis             TEXT,
  ai_recommendations      TEXT,

  -- Conversion tracking
  converted_patient_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  converted_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_status          ON leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to     ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at      ON leads(organization_id, created_at DESC);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_org_select" ON leads FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "leads_org_insert" ON leads FOR INSERT
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "leads_org_update" ON leads FOR UPDATE
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "leads_org_delete" ON leads FOR DELETE
  USING (organization_id = get_my_org_id());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_leads_updated_at();
