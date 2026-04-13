-- Migration 008: Fix user registration
-- Problem: handle_new_user trigger fails when no organization exists (organization_id NOT NULL)
-- Solution: make organization_id nullable + create default org + update trigger

-- 1. Make organization_id nullable on users
ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

-- 2. Create a default organization if none exists
INSERT INTO organizations (id, name, subdomain, slug, plan, subscription_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ברירת מחדל',
  'default',
  'default',
  'pro',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Fix the trigger to NOT fail if no org exists
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Use org from metadata, or first org, or NULL (allowed now)
  v_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.users (id, organization_id, email, first_name, last_name, role)
  VALUES (
    new.id,
    v_org_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'patient')
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
