-- Migration 012: Fix existing doctor profile that was created without specialties

UPDATE users u
SET
  is_active = true,
  specialties = CASE
    WHEN u.specialties IS NULL OR u.specialties = '{}'
    THEN (
      SELECT ARRAY(SELECT jsonb_array_elements_text(au.raw_user_meta_data->'specialties'))
      FROM auth.users au WHERE au.id = u.id
    )
    ELSE u.specialties
  END,
  license_number = CASE
    WHEN u.license_number IS NULL
    THEN (SELECT au.raw_user_meta_data->>'license_number' FROM auth.users au WHERE au.id = u.id LIMIT 1)
    ELSE u.license_number
  END
WHERE u.role = 'doctor';
