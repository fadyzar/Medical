-- Migration 009: Bulletproof user registration trigger
-- Wraps everything in EXCEPTION so registration never fails due to trigger errors

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
  v_role   user_role;
  v_first  text;
  v_last   text;
BEGIN
  -- Safely extract metadata
  v_first := COALESCE(new.raw_user_meta_data->>'first_name', split_part(new.email, '@', 1), '');
  v_last  := COALESCE(new.raw_user_meta_data->>'last_name', '');

  -- Safely parse role
  BEGIN
    v_role := COALESCE((new.raw_user_meta_data->>'role')::user_role, 'patient');
  EXCEPTION WHEN OTHERS THEN
    v_role := 'patient';
  END;

  -- Safely get org_id
  BEGIN
    v_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_org_id := NULL;
  END;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  END IF;

  -- Insert profile — catch any error so auth.users insert always succeeds
  BEGIN
    INSERT INTO public.users (id, organization_id, email, first_name, last_name, role)
    VALUES (new.id, v_org_id, new.email, v_first, v_last, v_role)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log to postgres logs but don't fail the auth signup
    RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger (drop first to ensure clean state)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
