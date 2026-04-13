-- Migration 010: Fix valid_doctor constraint + backfill missing profiles

-- 1. Drop the constraint that prevents doctor registration without license_number
--    (license_number is collected after email confirmation, not during trigger)
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_doctor;

-- 2. Backfill profiles for any auth users missing from public.users
INSERT INTO public.users (id, organization_id, email, first_name, last_name, role)
SELECT
  au.id,
  (SELECT id FROM organizations ORDER BY created_at LIMIT 1),
  au.email,
  COALESCE(au.raw_user_meta_data->>'first_name', split_part(au.email, '@', 1), ''),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  COALESCE(
    CASE
      WHEN au.raw_user_meta_data->>'role' IN ('patient','doctor','staff','admin')
      THEN (au.raw_user_meta_data->>'role')::user_role
      ELSE 'patient'::user_role
    END,
    'patient'::user_role
  )
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;
